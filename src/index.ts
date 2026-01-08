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
import { readAndValidateConfig } from "./modules/config";
import { syncCode } from "./modules/syncCode";

/**
 * 主函数
 */
async function main() {
  try {
    // 1. 显示欢迎信息
    showWelcome();

    // 2. 读取项目信息
    const projectInfo = await readProjectInfo();

    // 3. 确认项目信息
    const isProjectInfoConfirmed = await confirmProjectInfo(projectInfo);
    if (!isProjectInfoConfirmed) {
      console.log("操作已取消。");
      return;
    }

    // 4. 检查分支名称
    checkBranchName(projectInfo.branch);

    // 5. 检查是否有新提交
    checkForNewCommits(projectInfo.commits);

    // 6. 询问是否创建配置文件
    const shouldCreateConfig = await askToCreateConfig();
    if (shouldCreateConfig) {
      await handleConfigCreation(projectInfo.name);
      return;
    }

    // 7. 读取并验证配置文件
    const config = await readAndValidateConfig();

    // 8. 询问是否启动同步
    const shouldStartSync = await askToStartSync();
    if (!shouldStartSync) {
      console.log("操作已取消。");
      return;
    }

    // 9. 执行代码同步
    syncCode(projectInfo, config);
  } catch (error) {
    console.error(`❌ 错误：${(error as Error).message}`);
    process.exit(1);
  }
}

// 启动程序
main();
