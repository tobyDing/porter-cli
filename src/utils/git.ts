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
    const result = execSync(`git ${command}`, {
      ...options,
      // 使用pipe捕获输出，而不是inherit
      stdio: options?.stdio || ["ignore", "pipe", "pipe"], // 忽略输入，捕获输出和错误
      // 设置GIT_EDITOR环境变量为true，禁用git的编辑器功能
      env: {
        ...process.env,
        ...options?.env,
        GIT_EDITOR: options?.env?.GIT_EDITOR || "true",
      },
    });
    // 确保result不为null再调用toString()
    return result ? result.toString().trim() : "";
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`Git命令执行失败: ${command}\n${errorMessage}`);
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
      // 使用pipe捕获输出，而不是inherit
      stdio: ["ignore", "pipe", "pipe"], // 忽略输入，捕获输出和错误
      // 设置GIT_EDITOR环境变量为true，禁用git的编辑器功能
      env: {
        ...process.env,
        GIT_EDITOR: "true",
      },
    };
    const result = execSync(`git ${command}`, options);
    // 确保result不为null再调用toString()
    return result ? result.toString().trim() : "";
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Git命令执行失败: ${command}\n在目录 ${cwd} 中执行失败：${errorMessage}`
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
 * 获取指定目录所属的Git仓库根目录
 * @param projectPath 项目目录路径
 * @returns Git仓库根目录路径
 */
export function getGitRoot(projectPath: string): string {
  const absolutePath = path.isAbsolute(projectPath)
    ? projectPath
    : path.resolve(process.cwd(), projectPath);

  return executeGitCommandInDir("rev-parse --show-toplevel", absolutePath);
}

/**
 * 判断两个项目路径是否属于同一个Git仓库
 * @param path1 第一个项目路径
 * @param path2 第二个项目路径
 * @returns 如果属于同一个Git仓库返回true，否则返回false
 */
export function isSameGitRepository(path1: string, path2: string): boolean {
  try {
    const gitRoot1 = getGitRoot(path1);
    const gitRoot2 = getGitRoot(path2);
    return gitRoot1 === gitRoot2;
  } catch (error) {
    // 如果任一路径不是Git仓库，则它们肯定不是同一个仓库
    return false;
  }
}

/**
 * 检查指定目录下的分支是否存在
 * @param projectPath 项目目录路径
 * @param branchName 分支名称
 * @returns 如果分支存在返回true，否则返回false
 */
export function checkBranchExists(
  projectPath: string,
  branchName: string
): boolean {
  const absolutePath = path.isAbsolute(projectPath)
    ? projectPath
    : path.resolve(process.cwd(), projectPath);

  try {
    executeGitCommandInDir(`show-ref refs/heads/${branchName}`, absolutePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * 检查指定目录下是否有未暂存的变更
 * @param projectPath 项目目录路径
 * @returns 如果有未暂存的变更返回true，否则返回false
 */
export function hasUnstagedChanges(projectPath: string): boolean {
  const absolutePath = path.isAbsolute(projectPath)
    ? projectPath
    : path.resolve(process.cwd(), projectPath);

  try {
    // 直接使用git status命令检查工作区状态
    // 使用--porcelain选项获取一致的输出格式
    const statusOutput = executeGitCommandInDir(
      "status --porcelain",
      absolutePath
    );

    // 如果输出为空，说明工作区干净，没有未暂存的变更
    if (!statusOutput || statusOutput.trim() === "") {
      return false;
    }

    return true;
  } catch (error) {
    throw new Error(`检查未暂存变更时出错：${(error as Error).message}`);
  }
}

/**
 * 获取指定目录下commit-id的完整形式
 * @param projectPath 项目目录路径
 * @param commitId 完整或短的commit-id
 * @returns 完整的commit-id
 * @throws 如果commit-id不存在则抛出错误
 */
export function getFullCommitId(projectPath: string, commitId: string): string {
  const absolutePath = path.isAbsolute(projectPath)
    ? projectPath
    : path.resolve(process.cwd(), projectPath);

  try {
    // 使用git rev-parse获取完整的commit-id
    const fullCommitId = executeGitCommandInDir(
      `rev-parse ${commitId}`,
      absolutePath
    );
    return fullCommitId;
  } catch (error) {
    throw new Error(`获取完整commit-id失败：${(error as Error).message}`);
  }
}

/**
 * 检查指定目录下的commit-id是否存在
 * @param projectPath 项目目录路径
 * @param commitId commit-id（支持完整或短形式）
 * @returns 如果commit-id存在返回true，否则返回false
 */
export function checkCommitIdExists(
  projectPath: string,
  commitId: string
): boolean {
  try {
    // 尝试获取完整的commit-id，如果成功则说明commit-id存在
    getFullCommitId(projectPath, commitId);
    return true;
  } catch {
    return false;
  }
}

/**
 * 清理所有以temp_porter_开头的临时远程仓库
 * @param projectPath 项目目录路径（可选，默认当前目录）
 */
export async function cleanupAllTempRemotes(
  projectPath?: string
): Promise<void> {
  const targetPath = projectPath || process.cwd();
  const absolutePath = path.isAbsolute(targetPath)
    ? targetPath
    : path.resolve(process.cwd(), targetPath);

  try {
    // 列出所有远程仓库
    const remotesOutput = executeGitCommandInDir("remote", absolutePath);

    if (!remotesOutput) {
      return; // 没有远程仓库
    }

    const remotes = remotesOutput
      .split("\n")
      .map((remote) => remote.trim())
      .filter((remote) => remote);

    // 过滤出临时远程仓库
    const tempRemotes = remotes.filter((remote) =>
      remote.startsWith("temp_porter_")
    );

    if (tempRemotes.length === 0) {
      return; // 没有临时远程仓库
    }

    console.log(`发现 ${tempRemotes.length} 个临时远程仓库，正在清理...`);

    // 删除临时远程仓库
    for (const remote of tempRemotes) {
      try {
        executeGitCommandInDir(`remote remove ${remote}`, absolutePath);
        console.log(`✅ 已移除临时远程仓库：${remote}`);
      } catch (error) {
        console.error(
          `移除临时远程仓库 ${remote} 时出错：${(error as Error).message}`
        );
      }
    }
  } catch (error) {
    // 如果不是git仓库或者其他错误，忽略
    console.error(`检查临时远程仓库时出错：${(error as Error).message}`);
  }
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
