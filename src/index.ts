import {
  showWelcome,
  askToCreateConfig,
  askToStartSync,
  handleConfigCreation,
} from "./modules/cli";
import {
  readProjectInfo,
  checkForNewCommits,
  checkBranchName,
  checkAllTargetProjects,
  checkSourceProjectExists,
  checkSourceBranchExists,
} from "./modules/projectInfo";
import { readAndValidateConfig, setConfigFilePath } from "./modules/config";
import { syncCode } from "./modules/syncCode";
import { checkCommitIdExists } from "./utils/git";
import path from "node:path";
import fs from "node:fs/promises";
import inquirer from "inquirer";

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

    // 检查源项目
    console.log("\n检查源项目...");
    checkSourceProjectExists(config.projectPath);
    console.log("✅ 源项目存在");

    // 检查源项目分支字段是否存在
    if (!config.branch) {
      throw new Error("配置文件缺少必要字段：branch（源项目的分支）");
    }

    // 检查源项目分支是否存在
    checkSourceBranchExists(config.projectPath, config.branch);
    console.log(`✅ 源项目分支"${config.branch}"存在`);

    // 检查源项目commit-id是否存在（如果指定了）
    if (config["commit-id"]) {
      const commitIdExists = checkCommitIdExists(
        config.projectPath,
        config["commit-id"]
      );
      if (!commitIdExists) {
        throw new Error(
          `源项目的commit-id "${config["commit-id"]}"不存在，请检查配置。`
        );
      }
      console.log(`✅ 源项目commit-id "${config["commit-id"]}"存在`);
    }

    // 显示源项目配置信息给用户确认
    console.log(`\n源项目名称：${config.projectName}`);
    console.log(`源项目分支：${config.branch}`);
    console.log(`源项目路径：${config.projectPath}`);

    // 询问用户是否确认配置信息
    const answers = await inquirer.prompt([
      {
        type: "confirm",
        name: "confirmConfig",
        message: "确认以上配置信息正确吗？",
        default: true,
      },
    ]);

    if (!answers.confirmConfig) {
      const shouldEditConfig = await askToCreateConfig();
      if (shouldEditConfig) {
        await handleConfigCreation("./");
      }
      return;
    }

    const projectInfo = await readProjectInfo(
      config.projectPath,
      config.projectName,
      config["commit-id"]
    );

    checkBranchName(projectInfo.branch);

    checkForNewCommits(projectInfo.commits);

    // 检查所有目标项目
    await checkAllTargetProjects(config.targetProjects);
    console.log("\n✅ 所有目标项目检查通过");

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
