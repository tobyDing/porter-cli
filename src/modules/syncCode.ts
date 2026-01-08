import { execSync } from "node:child_process";
import { ProjectInfo } from "../types";
import { PorterConfig, TargetProject } from "../types";

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

  console.log(`\n=== 代码同步完成 ===`);
  console.log(`请检查目标项目的同步结果，如有冲突请手动解决。`);
}
