import { execSync, ExecSyncOptions } from "node:child_process";

/**
 * 执行Git命令
 * @param command Git命令
 * @param options 执行选项
 * @returns 命令执行结果
 */
export function executeGitCommand(
  command: string,
  options?: ExecSyncOptions
): string {
  try {
    return execSync(`git ${command}`, options).toString().trim();
  } catch (error) {
    throw new Error(`Git命令执行失败: ${command}\n${(error as Error).message}`);
  }
}

/**
 * 获取当前项目的名称
 * @returns 项目名称
 */
export async function getProjectName(): Promise<string> {
  try {
    // 尝试从package.json获取项目名称
    const fs = await import("node:fs/promises");
    const packageJson = await fs.readFile("package.json", "utf-8");
    const packageData = JSON.parse(packageJson);
    return packageData.name;
  } catch {
    // 如果package.json不存在，从git remote获取项目名称
    const remoteUrl = executeGitCommand("config --get remote.origin.url");
    return remoteUrl.split("/").pop()?.replace(".git", "") || "unknown";
  }
}

/**
 * 获取当前分支名称
 * @returns 分支名称
 */
export function getCurrentBranch(): string {
  return executeGitCommand("rev-parse --abbrev-ref HEAD");
}

/**
 * 获取分支自创建以来的所有提交记录
 * @param sinceCommit 起始提交ID（可选）
 * @returns 提交记录数组
 */
export function getCommits(sinceCommit?: string): string[] {
  const command = sinceCommit
    ? `log ${sinceCommit}..HEAD --oneline`
    : "log --oneline";

  const commitsOutput = executeGitCommand(command);
  return commitsOutput ? commitsOutput.split("\n") : [];
}
