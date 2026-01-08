import { getProjectName, getCurrentBranch, getCommits } from "../utils/git";
import { GitCommit, ProjectInfo } from "../types";

/**
 * 解析Git提交记录
 * @param commitLines Git提交记录行
 * @returns 解析后的提交记录数组
 */
function parseCommits(commitLines: string[]): GitCommit[] {
  return commitLines.map((line) => {
    const [id, ...messageParts] = line.split(" ");
    return {
      id,
      message: messageParts.join(" "),
      author: "", // 简化实现，实际项目中可以通过git log --pretty=format:"%an"获取
      date: "", // 简化实现，实际项目中可以通过git log --pretty=format:"%ad"获取
    };
  });
}

/**
 * 读取当前项目的信息
 * @returns 项目信息
 */
export async function readProjectInfo(): Promise<ProjectInfo> {
  const name = await getProjectName();
  const branch = getCurrentBranch();
  const commitLines = getCommits();
  const commits = parseCommits(commitLines);

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
    throw new Error(
      "当前项目分支自创建以来没有新增的提交，请先提交代码后再使用porter-ci工具。"
    );
  }
}

/**
 * 检查分支名称是否符合规范
 * @param branch 分支名称
 * @throws 如果分支名称不符合规范则抛出错误
 */
export function checkBranchName(branch: string): void {
  const forbiddenKeywords = ["master", "test"];
  const lowerBranch = branch.toLowerCase();

  for (const keyword of forbiddenKeywords) {
    if (lowerBranch.includes(keyword)) {
      throw new Error(
        `分支名称不能包含"${keyword}"关键字，请使用其他分支名称。`
      );
    }
  }
}
