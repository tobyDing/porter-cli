import {
  showWelcome,
  confirmProjectInfo,
  askToCreateConfig,
  askToStartSync,
  handleConfigCreation,
} from "./modules/cli";
import {
  readProjectInfo,
  checkForNewCommits,
  checkBranchName,
} from "./modules/projectInfo";
import { readAndValidateConfig, setConfigFilePath } from "./modules/config";
import { syncCode } from "./modules/syncCode";
import path from "node:path";
import fs from "node:fs/promises";

/**
 * 查找配置文件
 * @returns 配置文件路径，如果未找到则返回null
 */
async function findConfigFile(): Promise<string | null> {
  const possiblePaths = [
    "porter.config.json",
    path.join(process.cwd(), "porter.config.json"),
  ];

  for (const configPath of possiblePaths) {
    try {
      await fs.access(configPath);
      return configPath;
    } catch {
      continue;
    }
  }

  return null;
}

/**
 * 主函数
 */
async function main() {
  try {
    showWelcome();

    const configPath = await findConfigFile();

    if (!configPath) {
      console.log("未找到配置文件 porter.config.json");
      console.log("请在当前目录或指定路径创建配置文件。");
      const shouldCreate = await askToCreateConfig();
      if (shouldCreate) {
        await handleConfigCreation("./");
      }
      return;
    }

    setConfigFilePath(configPath);
    console.log(`使用配置文件：${configPath}`);

    const config = await readAndValidateConfig();

    const projectInfo = await readProjectInfo(
      config.projectPath,
      config.projectName,
      config["commit-id"]
    );

    const isProjectInfoConfirmed = await confirmProjectInfo(projectInfo);
    if (!isProjectInfoConfirmed) {
      console.log("操作已取消。");
      return;
    }

    checkBranchName(projectInfo.branch);

    checkForNewCommits(projectInfo.commits);

    // 已找到配置文件，跳过创建配置文件的询问

    const shouldStartSync = await askToStartSync();
    if (!shouldStartSync) {
      console.log("操作已取消。");
      return;
    }

    await syncCode(projectInfo, config);
  } catch (error) {
    console.error(`❌ 错误：${(error as Error).message}`);
    process.exit(1);
  }
}

main();
