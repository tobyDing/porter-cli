import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { ProjectInfo } from "../types";
import { PorterConfig, TargetProject } from "../types";
import { isSameGitRepository, executeGitCommandInDir } from "../utils/git";
import inquirer from "inquirer";

/**
 * 执行命令并处理输出
 * @param command 要执行的命令
 * @param options 执行选项
 */
function executeCommand(command: string, options: any = {}): void {
  execSync(command, {
    ...options,
    // 不使用 stdio: "inherit"，避免占用标准输入影响readline
    stdio: ["ignore", "inherit", "inherit"], // 忽略输入，继承输出和错误
    // 设置GIT_EDITOR环境变量为true，禁用git的编辑器功能
    env: {
      ...process.env,
      GIT_EDITOR: "true",
    },
  });
}

/**
 * 检测差异文件是否包含冲突标记
 * @param targetProjectPath 目标项目路径
 * @returns 是否存在冲突标记
 */
function hasConflictMarkers(targetProjectPath: string): boolean {
  try {
    // 获取当前冲突的文件列表
    const conflictedFiles = executeGitCommandInDir(
      "status --porcelain",
      targetProjectPath
    )
      .split("\n")
      .filter((line) => line.startsWith("UU"))
      .map((line) => line.slice(3));

    // 检查每个冲突文件是否包含冲突标记
    for (const file of conflictedFiles) {
      const filePath = `${targetProjectPath}/${file}`;
      const content = readFileSync(filePath, "utf-8");

      // 检查是否包含冲突标记
      if (
        content.includes("<<<<<<< HEAD") ||
        content.includes("=======") ||
        content.includes(">>>>>>> ")
      ) {
        return true;
      }
    }

    return false;
  } catch (error) {
    console.error(`检测冲突标记时出错：${(error as Error).message}`);
    return false;
  }
}

/**
 * 等待用户手动解决冲突
 * @param targetProjectPath 目标项目路径
 * @returns 用户是否选择继续，undefined表示需要重新再试
 */
async function waitForUserToResolveConflict(
  targetProjectPath: string
): Promise<boolean | undefined> {
  console.log(`\n请在目标项目路径 ${targetProjectPath} 中手动解决代码冲突。`);
  console.log("解决冲突后，请选择以下操作：");

  const answers = await inquirer.prompt([
    {
      type: "list",
      name: "action",
      message: "请选择操作：",
      choices: [
        { name: "继续同步", value: "continue" },
        { name: "取消当前同步", value: "abort" },
        { name: "退出程序", value: "exit" },
        { name: "重新再试", value: "retry" },
      ],
    },
  ]);

  const response = answers.action;

  if (response === "continue") {
    return true;
  } else if (response === "abort") {
    // 执行 git cherry-pick --abort
    try {
      executeGitCommandInDir("cherry-pick --abort", targetProjectPath);
      console.log("已取消当前 cherry-pick 操作。");
    } catch (error) {
      console.error(`取消 cherry-pick 时出错：${(error as Error).message}`);
    }
    return false;
  } else if (response === "exit") {
    console.log("程序将退出。");
    process.exit(0);
  } else if (response === "retry") {
    // 重新再试前先取消当前的cherry-pick操作
    try {
      executeGitCommandInDir("cherry-pick --abort", targetProjectPath);
      console.log("已取消当前 cherry-pick 操作。");
    } catch (error) {
      console.error(`取消 cherry-pick 时出错：${(error as Error).message}`);
    }
    // 返回特殊值，让调用者知道需要重新执行当前提交
    return undefined;
  } else {
    console.log("无效的输入，请重新输入。");
    // 递归调用以获取有效输入
    return waitForUserToResolveConflict(targetProjectPath);
  }
}

/**
 * 同步代码到目标项目
 * @param _sourceProject 源项目信息
 * @param targetProject 目标项目配置
 * @param commitIds 要同步的提交ID列表
 * @throws 如果同步失败则抛出错误
 */
export async function syncToTargetProject(
  _sourceProject: ProjectInfo,
  targetProject: TargetProject,
  commitIds: string[]
): Promise<void> {
  const originalDir = process.cwd();

  try {
    // 切换到目标项目目录
    console.log(`\n正在同步到项目：${targetProject.projectName}`);
    console.log(`目标项目路径：${targetProject.projectPath}`);
    console.log(`目标分支：${targetProject.branch}`);

    process.chdir(targetProject.projectPath);

    // 切换到目标分支
    executeCommand(`git checkout ${targetProject.branch}`);

    // 检查源项目和目标项目是否属于同一个Git仓库
    const isCrossProject = !isSameGitRepository(
      process.env.PORTER_SOURCE_PROJECT_PATH || "",
      targetProject.projectPath
    );

    console.log(`是否跨项目同步：${isCrossProject}`);
    console.log(`准备同步 ${commitIds.length} 个提交...`);

    // 跨项目同步需要添加临时远程仓库
    let tempRemoteName = "";
    if (isCrossProject) {
      // 跨项目同步：添加源项目作为临时远程仓库
      tempRemoteName = `temp_porter_${Date.now()}`;
      const sourceProjectPath = process.env.PORTER_SOURCE_PROJECT_PATH || "";

      // 添加源项目作为远程仓库
      console.log(`添加源项目作为临时远程仓库：${tempRemoteName}`);
      executeCommand(`git remote add ${tempRemoteName} ${sourceProjectPath}`);

      // 获取源项目的提交历史
      console.log(`获取源项目的提交历史...`);
      executeCommand(`git fetch ${tempRemoteName}`);
    }

    try {
      // 逐个执行git cherry-pick
      for (let i = 0; i < commitIds.length; i++) {
        const commitId = commitIds[i];
        const commitIndex = i + 1;

        console.log(
          `\n=== 开始同步第 ${commitIndex}/${commitIds.length} 个提交 ===`
        );
        console.log(`提交ID：${commitId}`);

        // 构建cherry-pick命令
        // 跨项目同步时，直接使用提交ID，而不是远程名称/提交ID的格式
        // 添加--no-edit参数，避免自动打开编辑器
        const cherryPickCommand = `git cherry-pick --no-edit ${commitId}`;

        console.log(`执行命令：${cherryPickCommand}`);

        // 使用循环确保用户解决问题后能完成同步
        let syncSuccess = false;
        while (!syncSuccess) {
          try {
            executeCommand(cherryPickCommand);
            console.log(`✅ 成功同步提交：${commitId}`);

            // 成功后执行git add .
            console.log(`执行：git add .`);
            executeCommand(`git add .`);
            syncSuccess = true;
          } catch (error) {
            console.log(`⚠️  同步提交 ${commitId} 失败`);

            // 检查是否是冲突错误
            let isConflict = false;
            const errorMessage = (error as Error).message;

            // 检查错误信息是否包含冲突标记
            if (errorMessage.includes("CONFLICT")) {
              isConflict = true;
            } else {
              // 主动检测差异文件是否包含冲突标记
              isConflict = hasConflictMarkers(targetProject.projectPath);
            }

            // 无论是什么错误，都等待用户解决
            if (isConflict) {
              console.log("❌ 检测到代码冲突！");
            } else {
              console.log(`❌ 错误详情：${errorMessage}`);
            }

            console.log(`请手动解决问题后继续同步。`);

            // 等待用户解决问题
            const shouldContinue = await waitForUserToResolveConflict(
              targetProject.projectPath
            );

            if (shouldContinue === undefined) {
              // 用户选择了重新再试，不改变syncSuccess，继续循环
              console.log(`重新执行提交 ${commitId}...`);
            } else if (!shouldContinue) {
              console.log(`跳过提交 ${commitId}，继续下一个提交...`);
              syncSuccess = true; // 设置为true以退出循环
              break;
            } else {
              // 用户选择了继续同步，直接认为当前提交已经同步完成
              // 进入下一个提交的处理流程，不再进行额外的检测
              console.log(`✅ 用户确认提交 ${commitId} 已同步完成`);
              syncSuccess = true;
            }
          }
        }
      }

      console.log(
        `\n✅ 成功完成所有提交到项目 ${targetProject.projectName} 的同步！`
      );
    } finally {
      // 清理：移除临时远程仓库
      if (isCrossProject && tempRemoteName) {
        try {
          executeCommand(`git remote remove ${tempRemoteName}`);
          console.log(`移除临时远程仓库：${tempRemoteName}`);
        } catch (cleanupError) {
          console.log(
            `清理临时远程仓库时发生错误：${(cleanupError as Error).message}`
          );
        }
      }
    }
  } finally {
    // 返回到原始目录
    process.chdir(originalDir);
  }
}

/**
 * 执行代码同步
 * @param projectInfo 源项目信息
 * @param config 配置对象
 * @throws 如果同步失败则抛出错误
 */
export async function syncCode(
  projectInfo: ProjectInfo,
  config: PorterConfig
): Promise<void> {
  console.log(`\n=== 开始代码同步 ===`);
  console.log(`源项目：${projectInfo.name}`);
  console.log(`源分支：${projectInfo.branch}`);
  console.log(`要同步的提交数量：${projectInfo.commits.length}`);
  console.log(`源项目路径：${config.projectPath}`);
  console.log(`目标项目数量：${config.targetProjects.length}`);

  // 设置源项目路径到环境变量，供syncToTargetProject函数使用
  process.env.PORTER_SOURCE_PROJECT_PATH = config.projectPath;

  // 提交记录已经在readProjectInfo中过滤过了
  const commitsToSync = projectInfo.commits;

  if (commitsToSync.length === 0) {
    console.log("没有需要同步的提交。");
    return;
  }

  console.log(`\n准备同步以下提交：`);
  commitsToSync.forEach((commit, index) => {
    console.log(`${index + 1}. ${commit.id}: ${commit.message}`);
  });

  // 获取提交ID列表，并反转顺序（从旧到新）
  const commitIds = commitsToSync.map((commit) => commit.id).reverse();

  // 同步到每个目标项目（串行）
  for (const targetProject of config.targetProjects) {
    try {
      await syncToTargetProject(projectInfo, targetProject, commitIds);
    } catch (error) {
      console.error(
        `❌ 同步到项目 ${targetProject.projectName} 失败：${
          (error as Error).message
        }`
      );
      // 继续同步其他项目
    }
  }

  // 清理环境变量
  delete process.env.PORTER_SOURCE_PROJECT_PATH;

  console.log(`\n=== 代码同步完成 ===`);
  console.log(`✅ 已完成所有目标项目的代码同步。`);
  console.log(`\n注意事项：`);
  console.log(`1. porter 只负责代码的同步，不负责 git commit 和推送远程分支。`);
  console.log(`2. 请在目标项目中手动确认代码是否正确。`);
  console.log(`3. 确认无误后，请执行 git commit 和 git push 完成代码提交。`);
  console.log(`==============================================`);
  console.log(`\n感谢使用 porter！\n`);
  console.log(`==============================================`);
}
