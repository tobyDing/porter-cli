import fs from "node:fs/promises";
import path from "node:path";
import { PorterConfig, TargetProject } from "../types";

let configFilePath: string | null = null;

/**
 * 设置配置文件路径
 * @param filePath 配置文件路径
 */
export function setConfigFilePath(filePath: string): void {
  configFilePath = filePath;
}

/**
 * 获取配置文件路径
 * @returns 配置文件路径
 */
export function getConfigFilePath(): string {
  if (configFilePath) {
    return configFilePath;
  }
  return path.join(process.cwd(), "porter.config.json");
}

/**
 * 读取配置文件
 * @returns 配置对象
 * @throws 如果配置文件不存在或格式错误则抛出错误
 */
export async function readConfigFile(): Promise<PorterConfig> {
  const filePath = getConfigFilePath();
  try {
    const content = await fs.readFile(filePath, "utf-8");
    return JSON.parse(content) as PorterConfig;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      throw new Error(
        `配置文件不存在：${filePath}\n请创建 "porter.config.json" 文件。`
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
  if (!config.projectPath) {
    throw new Error("配置文件缺少必要字段：projectPath（源项目目录路径）");
  }

  if (!config.projectName) {
    throw new Error("配置文件缺少必要字段：projectName（源项目名称）");
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
  }
}

/**
 * 验证配置文件的内容
 * @param config 配置对象
 * @throws 如果配置内容不符合要求则抛出错误
 */
export function validateConfigContent(_config: PorterConfig): void {}

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
 * @param projectPath 源项目目录路径
 * @throws 如果创建配置文件失败则抛出错误
 */
export async function createDefaultConfig(projectPath: string): Promise<void> {
  // 读取模板文件
  // 获取当前模块所在目录，确保模板文件路径正确
  const __filename = new URL(import.meta.url).pathname;
  const __dirname = path.dirname(__filename);
  const templatePath = path.join(__dirname, "../template/porter.config.json");
  let templateContent;
  try {
    templateContent = await fs.readFile(templatePath, "utf-8");
  } catch (error) {
    throw new Error(`读取模板文件失败：${(error as Error).message}`);
  }

  // 解析模板内容并替换projectPath
  const defaultConfig = JSON.parse(templateContent);
  defaultConfig.projectPath = projectPath;

  const filePath = getConfigFilePath();
  try {
    await fs.writeFile(
      filePath,
      JSON.stringify(defaultConfig, null, 2),
      "utf-8"
    );
    console.log(`默认配置文件已创建：${filePath}`);
    console.log("请编辑该文件并添加正确的项目配置。");
  } catch (error) {
    throw new Error(`创建默认配置文件失败：${(error as Error).message}`);
  }
}
