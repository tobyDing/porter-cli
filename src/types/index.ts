// 配置文件类型定义
export interface TargetProject {
  /** 项目名称，用于在同步时提示用户 */
  projectName: string;
  /** 项目路径，用于指定要同步的项目路径 */
  projectPath: string;
  /** 要同步的目标分支，必须指定 */
  branch: string;
}

export interface PorterConfig {
  /** 源项目的目录路径，指向同步的源项目。必填项 */
  projectPath: string;
  /** 源项目的名称，用于在同步时提示用户。必填项，不填报错 */
  projectName: string;
  /** 源项目的分支，必须指定。必填项 */
  branch: string;
  /** 指定从源项目当前分支哪次 commit 开始同步。可选项 */
  "commit-id"?: string;
  /** 要同步的目标项目列表 */
  targetProjects: TargetProject[];
}

// Git 提交信息类型定义
export interface GitCommit {
  /** 提交 ID */
  id: string;
  /** 提交消息 */
  message: string;
  /** 作者 */
  author: string;
  /** 提交时间 */
  date: string;
}

// 项目信息类型定义
export interface ProjectInfo {
  /** 项目名称 */
  name: string;
  /** 当前分支 */
  branch: string;
  /** 提交记录 */
  commits: GitCommit[];
}
