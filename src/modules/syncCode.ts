import { execSync } from "node:child_process";
import { ProjectInfo } from "../types";
import { PorterConfig, TargetProject } from "../types";
import { isSameGitRepository } from "../utils/git";

/**
 * 执行命令并处理输出
 * @param command 要执行的命令
 * @param options 执行选项
 */
function executeCommand(command: string, options: any = {}): void {
  execSync(command, {
    ...options,
    stdio: "inherit", // 直接将命令输出打印到控制台
  });
}

/**
 * 同步代码到目标项目
 * @param _sourceProject 源项目信息
 * @param targetProject 目标项目配置
 * @param commitIds 要同步的提交ID列表
 * @throws 如果同步失败则抛出错误
 */
export function syncToTargetProject(
  _sourceProject: ProjectInfo,
  targetProject: TargetProject,
  commitIds: string[]
): void {
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

    // 执行git cherry-pick
    if (isCrossProject) {
      // 跨项目同步：添加源项目作为临时远程仓库
      const tempRemoteName = `temp_porter_${Date.now()}`;
      const sourceProjectPath = process.env.PORTER_SOURCE_PROJECT_PATH || "";

      try {
        // 添加源项目作为远程仓库
        console.log(`添加源项目作为临时远程仓库：${tempRemoteName}`);
        executeCommand(`git remote add ${tempRemoteName} ${sourceProjectPath}`);

        // 获取源项目的提交历史
        console.log(`获取源项目的提交历史...`);
        executeCommand(`git fetch ${tempRemoteName}`);

        // 执行git cherry-pick
        const cherryPickCommand = `git cherry-pick ${commitIds.join(" ")}`;
        console.log(`执行命令：${cherryPickCommand}`);

        try {
          executeCommand(cherryPickCommand);
          console.log(`✅ 成功同步到项目：${targetProject.projectName}`);
        } catch (error) {
          // 检查是否是冲突错误
          const errorMessage = (error as Error).message;
          if (errorMessage.includes("CONFLICT")) {
            console.log(
              `⚠️  项目 ${targetProject.projectName} 同步时发生冲突，请手动解决冲突。`
            );
            console.log(
              `解决冲突后，请在目标项目目录执行 git cherry-pick --continue 完成同步。`
            );
          } else {
            throw error;
          }
        }
      } finally {
        // 清理：移除临时远程仓库
        try {
          executeCommand(`git remote remove ${tempRemoteName}`);
          console.log(`移除临时远程仓库：${tempRemoteName}`);
        } catch (cleanupError) {
          console.log(
            `清理临时远程仓库时发生错误：${(cleanupError as Error).message}`
          );
        }
      }
    } else {
      // 同项目同步：直接执行cherry-pick
      const cherryPickCommand = `git cherry-pick ${commitIds.join(" ")}`;
      console.log(`执行命令：${cherryPickCommand}`);

      try {
        executeCommand(cherryPickCommand);
        console.log(`✅ 成功同步到项目：${targetProject.projectName}`);
      } catch (error) {
        // 检查是否是冲突错误
        const errorMessage = (error as Error).message;
        if (errorMessage.includes("CONFLICT")) {
          console.log(
            `⚠️  项目 ${targetProject.projectName} 同步时发生冲突，请手动解决冲突。`
          );
          console.log(
            `解决冲突后，请在目标项目目录执行 git cherry-pick --continue 完成同步。`
          );
        } else {
          throw error;
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
export function syncCode(projectInfo: ProjectInfo, config: PorterConfig): void {
  console.log(`\n=== 开始代码同步 ===`);
  console.log(`源项目：${projectInfo.name}`);
  console.log(`源分支：${projectInfo.branch}`);
  console.log(`要同步的提交数量：${projectInfo.commits.length}`);
  console.log(`源项目路径：${config.projectPath}`);

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

  // 同步到每个目标项目
  for (const targetProject of config.targetProjects) {
    try {
      syncToTargetProject(projectInfo, targetProject, commitIds);
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
  console.log(`请检查目标项目的同步结果，如有冲突请手动解决。`);
}
