import fs from "node:fs/promises";
import path from "node:path";
import { PorterConfig, TargetProject } from "../types";
import { checkBranchName } from "./projectInfo";

/**
 * 配置文件路径
 */
export const CONFIG_FILE_PATH = path.join(
  process.cwd(),
  ".porter-ci.config.json"
);

/**
 * 读取配置文件
 * @returns 配置对象
 * @throws 如果配置文件不存在或格式错误则抛出错误
 */
export async function readConfigFile(): Promise<PorterConfig> {
  try {
    const content = await fs.readFile(CONFIG_FILE_PATH, "utf-8");
    return JSON.parse(content) as PorterConfig;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      throw new Error(
        `配置文件不存在，请在项目根目录下创建 ".porter-ci.config.json" 文件。`
      );
    }
    throw new Error(`配置文件格式错误：${(error as Error).message}`);
  }
}

/**
 * 验证配置文件的结构
 * @param config 配置对象
 * @throws 如果配置结构不符合要求则抛出错误
 */
export function validateConfigStructure(config: PorterConfig): void {
  // 检查必要字段
  if (!config.projectName) {
    throw new Error("配置文件缺少必要字段：projectName");
  }

  if (!config.targetProjects || !Array.isArray(config.targetProjects)) {
    throw new Error("配置文件缺少必要字段：targetProjects");
  }

  if (config.targetProjects.length === 0) {
    throw new Error("配置文件中的 targetProjects 不能为空数组");
  }
}

/**
 * 验证目标项目配置
 * @param targetProjects 目标项目列表
 * @throws 如果目标项目配置不符合要求则抛出错误
 */
export function validateTargetProjects(targetProjects: TargetProject[]): void {
  for (const project of targetProjects) {
    if (!project.projectName) {
      throw new Error("目标项目缺少必要字段：projectName");
    }

    if (!project.projectPath) {
      throw new Error("目标项目缺少必要字段：projectPath");
    }

    if (!project.branch) {
      throw new Error("目标项目缺少必要字段：branch");
    }

    // 检查目标分支名称是否符合规范
    checkBranchName(project.branch);
  }
}

/**
 * 验证配置文件的内容
 * @param _config 配置对象
 * @throws 如果配置内容不符合要求则抛出错误
 */
export function validateConfigContent(_config: PorterConfig): void {
  // 可以在这里添加更多的配置内容验证逻辑
  // 例如：验证projectPath是否存在等
}

/**
 * 验证配置文件
 * @param config 配置对象
 * @throws 如果配置不符合要求则抛出错误
 */
export function validateConfig(config: PorterConfig): void {
  validateConfigStructure(config);
  validateTargetProjects(config.targetProjects);
  validateConfigContent(config);
}

/**
 * 读取并验证配置文件
 * @returns 验证后的配置对象
 */
export async function readAndValidateConfig(): Promise<PorterConfig> {
  const config = await readConfigFile();
  validateConfig(config);
  return config;
}

/**
 * 创建默认配置文件
 * @param projectName 项目名称
 * @throws 如果创建配置文件失败则抛出错误
 */
export async function createDefaultConfig(projectName: string): Promise<void> {
  const defaultConfig: PorterConfig = {
    projectName,
    targetProjects: [],
  };

  try {
    await fs.writeFile(
      CONFIG_FILE_PATH,
      JSON.stringify(defaultConfig, null, 2),
      "utf-8"
    );
    console.log(`默认配置文件已创建：${CONFIG_FILE_PATH}`);
    console.log("请编辑该文件并添加目标项目配置。");
  } catch (error) {
    throw new Error(`创建默认配置文件失败：${(error as Error).message}`);
  }
}
