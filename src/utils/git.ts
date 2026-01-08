import { execSync, ExecSyncOptions } from "node:child_process";
import path from "node:path";

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
 * 在指定目录下执行Git命令
 * @param command Git命令
 * @param cwd 执行目录
 * @returns 命令执行结果
 */
export function executeGitCommandInDir(command: string, cwd: string): string {
  try {
    const options: ExecSyncOptions = {
      cwd: path.isAbsolute(cwd) ? cwd : path.resolve(process.cwd(), cwd),
    };
    return execSync(`git ${command}`, options).toString().trim();
  } catch (error) {
    throw new Error(
      `Git命令执行失败: ${command}\n在目录 ${cwd} 中执行失败：${
        (error as Error).message
      }`
    );
  }
}

/**
 * 获取指定目录下的项目名称
 * @param projectPath 项目目录路径
 * @returns 项目名称
 */
export async function getProjectName(projectPath: string): Promise<string> {
  const absolutePath = path.isAbsolute(projectPath)
    ? projectPath
    : path.resolve(process.cwd(), projectPath);

  try {
    const fs = await import("node:fs/promises");
    const packageJsonPath = path.join(absolutePath, "package.json");
    const packageJson = await fs.readFile(packageJsonPath, "utf-8");
    const packageData = JSON.parse(packageJson);
    return packageData.name;
  } catch {
    const remoteUrl = executeGitCommandInDir(
      "config --get remote.origin.url",
      absolutePath
    );
    return remoteUrl.split("/").pop()?.replace(".git", "") || "unknown";
  }
}

/**
 * 获取指定目录下的当前分支名称
 * @param projectPath 项目目录路径
 * @returns 分支名称
 */
export function getCurrentBranch(projectPath: string): string {
  return executeGitCommandInDir("rev-parse --abbrev-ref HEAD", projectPath);
}

/**
 * 获取指定目录下的分支自创建以来的所有提交记录
 * @param projectPath 项目目录路径
 * @param sinceCommit 起始提交ID（可选）
 * @returns 提交记录数组
 */
export function getCommits(
  projectPath: string,
  sinceCommit?: string
): string[] {
  const absolutePath = path.isAbsolute(projectPath)
    ? projectPath
    : path.resolve(process.cwd(), projectPath);

  const command = sinceCommit
    ? `log ${sinceCommit}^..HEAD --format="%H %s"`
    : `log --format="%H %s"`;

  const commitsOutput = executeGitCommandInDir(command, absolutePath);
  return commitsOutput ? commitsOutput.split("\n") : [];
}

/**
 * 切换到指定目录执行操作（临时更改工作目录）
 * @param projectPath 项目目录路径
 * @param callback 回调函数
 * @returns 回调函数的返回值
 */
export function withWorkingDirectory<T>(
  projectPath: string,
  callback: () => T
): T {
  const absolutePath = path.isAbsolute(projectPath)
    ? projectPath
    : path.resolve(process.cwd(), projectPath);

  const originalDir = process.cwd();
  process.chdir(absolutePath);

  try {
    return callback();
  } finally {
    process.chdir(originalDir);
  }
}
