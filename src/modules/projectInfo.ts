import path from 'node:path';
import fsSync from 'node:fs';
import {
  getProjectName,
  getCurrentBranch,
  getCommits,
  checkBranchExists,
  executeGitCommandInDir,
  hasUnstagedChanges,
} from '../utils/git';
import { GitCommit, ProjectInfo, TargetProject } from '../types';

/**
 * 解析Git提交记录
 * @param commitLines Git提交记录行
 * @returns 解析后的提交记录数组
 */
function parseCommits(commitLines: string[]): GitCommit[] {
  return commitLines.map((line) => {
    const [id, ...messageParts] = line.split(' ');
    return {
      id,
      message: messageParts.join(' '),
      author: '',
      date: '',
    };
  });
}

/**
 * 读取指定项目的项目信息
 * @param projectPath 项目目录路径
 * @param projectName 项目名称（可选）
 * @param sinceCommit 起始提交ID或提交ID数组（可选）
 * @returns 项目信息
 */
export async function readProjectInfo(
  projectPath: string,
  projectName?: string,
  sinceCommit?: string | string[]
): Promise<ProjectInfo> {
  const name = projectName || (await getProjectName(projectPath));
  const branch = getCurrentBranch(projectPath);
  let commits: GitCommit[] = [];

  if (Array.isArray(sinceCommit)) {
    // 处理commit-id数组：直接使用指定的commit-id
    const commitLines: string[] = [];
    for (const commitId of sinceCommit) {
      // 使用git log获取单个commit的信息
      const commitInfo = executeGitCommandInDir(`log -1 --format="%H %s" ${commitId}`, projectPath);
      if (commitInfo) {
        commitLines.push(commitInfo);
      }
    }
    commits = parseCommits(commitLines);
  } else {
    // 处理单个sinceCommit：获取从sinceCommit到HEAD的所有提交
    const commitLines = getCommits(projectPath, sinceCommit);
    commits = parseCommits(commitLines);
  }

  return {
    name,
    branch,
    commits,
  };
}

/**
 * 检查项目是否有新增的提交
 * @param commits 提交记录数组
 * @throws 如果没有新增提交则抛出错误
 */
export function checkForNewCommits(commits: GitCommit[]): void {
  if (commits.length === 0) {
    throw new Error('源项目分支自创建以来没有新增的提交，请先提交代码后再使用porter-cli工具。');
  }
}

/**
 * 检查分支名称是否符合规范
 * @param branch 分支名称
 * @throws 如果分支名称不符合规范则抛出错误
 */
export function checkBranchName(branch: string): void {
  const forbiddenKeywords = ['master', 'test'];
  const lowerBranch = branch.toLowerCase();

  for (const keyword of forbiddenKeywords) {
    if (lowerBranch.includes(keyword)) {
      throw new Error(`分支名称不能包含"${keyword}"关键字，请使用其他分支名称。`);
    }
  }
}

/**
 * 检查目标项目是否存在
 * @param targetProject 目标项目配置
 * @throws 如果目标项目不存在则抛出错误
 */
export function checkTargetProjectExists(targetProject: TargetProject): void {
  try {
    const { projectPath } = targetProject;
    const absolutePath = path.isAbsolute(projectPath) ? projectPath : path.resolve(process.cwd(), projectPath);

    // 检查目录是否存在
    if (!fsSync.existsSync(absolutePath)) {
      throw new Error(`目标项目目录不存在：${absolutePath}`);
    }

    // 检查是否是Git仓库
    executeGitCommandInDir('rev-parse --is-inside-work-tree', absolutePath);
  } catch (error) {
    throw new Error(`目标项目"${targetProject.projectName}"不存在或不是有效的Git仓库：${targetProject.projectPath}`);
  }
}

/**
 * 检查目标项目的分支名称是否符合规范
 * @param targetProject 目标项目配置
 * @throws 如果分支名称不符合规范则抛出错误
 */
export function checkTargetBranchName(targetProject: TargetProject): void {
  checkBranchName(targetProject.branch);
}

/**
 * 检查所有目标项目
 * @param targetProjects 目标项目列表
 * @throws 如果任何一个项目检查失败则抛出错误
 */
export async function checkAllTargetProjects(targetProjects: TargetProject[]): Promise<void> {
  for (const project of targetProjects) {
    console.log(`\n检查目标项目: ${project.projectName}`);

    // 直接检查项目是否存在，不存在则抛出错误
    checkTargetProjectExists(project);
    console.log(`✅ 项目"${project.projectName}"存在`);

    // 检查目标项目分支字段是否存在
    if (!project.branch) {
      throw new Error(`目标项目"${project.projectName}"缺少必要字段：branch`);
    }

    // 检查目标项目分支名称规范
    checkTargetBranchName(project);
    console.log(`✅ 项目"${project.projectName}"分支名称符合规范`);

    // 直接检查分支是否存在，不存在则抛出错误
    const branchExists = checkBranchExists(project.projectPath, project.branch);
    if (!branchExists) {
      throw new Error(`目标项目"${project.projectName}"的分支"${project.branch}"不存在，请先创建分支。`);
    }
    console.log(`✅ 项目"${project.projectName}"分支"${project.branch}"存在`);

    // 检查目标项目分支是否有未暂存的变更
    try {
      // 切换到目标项目的指定分支
      executeGitCommandInDir(`checkout ${project.branch}`, project.projectPath);
      console.log(`✅ 已切换到项目"${project.projectName}"的分支"${project.branch}"`);

      // 检查是否有未暂存的变更
      const unstagedChanges = hasUnstagedChanges(project.projectPath);
      if (unstagedChanges) {
        throw new Error(
          `目标项目"${project.projectName}"的分支"${project.branch}"存在未暂存的变更，请先执行git add或git stash命令。`
        );
      }
      console.log(`✅ 项目"${project.projectName}"分支"${project.branch}"没有未暂存的变更`);
    } catch (error) {
      // 如果切换分支时出错（比如有未暂存变更），重新抛出更明确的错误
      if (
        (error as Error).message.includes('Your local changes') ||
        (error as Error).message.includes('unstaged changes')
      ) {
        throw new Error(
          `目标项目"${project.projectName}"的分支"${project.branch}"存在未暂存的变更，请先执行git add或git stash命令后再继续。`
        );
      }
      // 其他错误直接抛出
      throw error;
    }
  }
}

/**
 * 检查源项目是否存在
 * @param projectPath 源项目目录路径
 * @throws 如果源项目不存在则抛出错误
 */
export function checkSourceProjectExists(projectPath: string): void {
  try {
    const absolutePath = path.isAbsolute(projectPath) ? projectPath : path.resolve(process.cwd(), projectPath);

    // 检查目录是否存在
    if (!fsSync.existsSync(absolutePath)) {
      throw new Error(`源项目目录不存在：${absolutePath}`);
    }

    // 检查是否是Git仓库
    executeGitCommandInDir('rev-parse --is-inside-work-tree', absolutePath);
  } catch (error) {
    throw new Error(`源项目不存在或不是有效的Git仓库：${projectPath}`);
  }
}

/**
 * 检查源项目的分支是否存在
 * @param projectPath 源项目目录路径
 * @param branch 源项目分支名称
 * @throws 如果源项目分支不存在则立即抛出错误
 */
export function checkSourceBranchExists(projectPath: string, branch: string): void {
  const branchExists = checkBranchExists(projectPath, branch);
  if (!branchExists) {
    throw new Error(`源项目的分支"${branch}"不存在，请先创建分支。`);
  }
}
