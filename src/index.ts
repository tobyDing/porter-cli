import { Command } from 'commander';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { showWelcome, askToCreateConfig, askToStartSync, handleConfigCreation } from './modules/cli';
import {
  readProjectInfo,
  checkForNewCommits,
  checkBranchName,
  checkAllTargetProjects,
  checkSourceProjectExists,
  checkSourceBranchExists,
} from './modules/projectInfo';
import { readAndValidateConfig, setConfigFilePath } from './modules/config';
import { syncCode } from './modules/syncCode';
import { checkCommitIdExists, cleanupAllTempRemotes, getFullCommitId } from './utils/git';
import inquirer from 'inquirer';

/**
 * 查找配置文件
 * @returns 配置文件路径，如果未找到则返回null
 */
async function findConfigFile(): Promise<string | null> {
  const possiblePaths = ['porter-ci.config.json', path.join(process.cwd(), 'porter-ci.config.json')];

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
 * 获取版本信息
 */
async function getVersion(): Promise<string> {
  // 在ES模块中使用import.meta.url获取当前模块位置
  const __dirname = path.dirname(new URL(import.meta.url).pathname);
  const packagePath = path.resolve(__dirname, '../package.json');
  const packageContent = await fs.readFile(packagePath, 'utf-8');
  const packageJson = JSON.parse(packageContent);
  return packageJson.version;
}

/**
 * 初始化命令行程序
 */
async function initCLI() {
  const version = await getVersion();

  const program = new Command();

  // 设置版本信息
  program.version(version, '-v, --version', '查看工具版本');

  // 设置帮助信息
  program
    .name('porter-ci')
    .description('基于git实现跨项目代码功能同步的CI工具')
    .helpOption('-h, --help', '查看帮助信息');

  // 解析命令行参数
  program.parse(process.argv);

  // 如果没有提供任何命令行参数，则运行主程序
  if (!program.args.length && !program.opts().version && !program.opts().help) {
    return true;
  }

  return false;
}

/**
 * 主函数
 */
async function main() {
  try {
    // 初始化命令行程序
    const shouldRunMain = await initCLI();

    // 如果用户使用了命令行参数（如--version或--help），则不继续执行主程序
    if (!shouldRunMain) {
      return;
    }

    showWelcome();

    const configPath = await findConfigFile();

    if (!configPath) {
      console.log('未找到配置文件 porter-ci.config.json');
      console.log('请在当前目录或指定路径创建配置文件。');
      const shouldCreate = await askToCreateConfig();
      if (shouldCreate) {
        await handleConfigCreation('./');
      }
      return;
    }

    setConfigFilePath(configPath);
    console.log(`使用配置文件：${configPath}`);

    const config = await readAndValidateConfig();

    // 检查源项目
    console.log('\n检查源项目...');
    checkSourceProjectExists(config.projectPath);
    console.log('✅ 源项目存在');

    // 检查源项目分支字段是否存在
    if (!config.branch) {
      throw new Error('配置文件缺少必要字段：branch（源项目的分支）');
    }

    // 检查源项目分支是否存在
    checkSourceBranchExists(config.projectPath, config.branch);
    console.log(`✅ 源项目分支"${config.branch}"存在`);

    // 检查源项目commit-id是否存在（如果指定了）
    if (config['commit-id']) {
      if (Array.isArray(config['commit-id'])) {
        // 处理commit-id数组
        const fullCommitIds: string[] = [];
        for (const commitId of config['commit-id']) {
          const commitIdExists = checkCommitIdExists(config.projectPath, commitId);
          if (!commitIdExists) {
            throw new Error(`源项目的commit-id "${commitId}"不存在，请检查配置。`);
          }
          // 获取完整的commit-id
          const fullCommitId = getFullCommitId(config.projectPath, commitId);
          fullCommitIds.push(fullCommitId);
        }
        // 更新配置为完整的commit-id数组
        config['commit-id'] = fullCommitIds;
        console.log(`✅ 源项目${fullCommitIds.length}个commit-id都存在`);
      } else {
        // 处理单个commit-id
        const commitIdExists = checkCommitIdExists(config.projectPath, config['commit-id']);
        if (!commitIdExists) {
          throw new Error(`源项目的commit-id "${config['commit-id']}"不存在，请检查配置。`);
        }
        // 获取完整的commit-id
        const fullCommitId = getFullCommitId(config.projectPath, config['commit-id']);
        // 更新配置为完整的commit-id
        config['commit-id'] = fullCommitId;
        console.log(`✅ 源项目commit-id "${config['commit-id']}"存在`);
      }
    }

    // 显示源项目配置信息给用户确认
    console.log(`\n源项目名称：${config.projectName}`);
    console.log(`源项目分支：${config.branch}`);
    console.log(`源项目路径：${config.projectPath}`);

    // 询问用户是否确认配置信息
    const answers = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirmConfig',
        message: '确认以上配置信息正确吗？',
        default: true,
      },
    ]);

    if (!answers.confirmConfig) {
      const shouldEditConfig = await askToCreateConfig();
      if (shouldEditConfig) {
        await handleConfigCreation('./');
      }
      return;
    }

    const projectInfo = await readProjectInfo(config.projectPath, config.projectName, config['commit-id']);

    checkBranchName(projectInfo.branch);

    checkForNewCommits(projectInfo.commits);

    // 检查所有目标项目
    await checkAllTargetProjects(config.targetProjects);
    console.log('\n✅ 所有目标项目检查通过');

    const shouldStartSync = await askToStartSync();
    if (!shouldStartSync) {
      console.log('操作已取消。');
      return;
    }

    await syncCode(projectInfo, config);
  } catch (error) {
    const errorMessage = (error as Error).message;

    // 检查是否是用户选择退出程序
    if (errorMessage === 'USER_EXIT') {
      // 不显示错误信息，只显示退出提示
      console.log('\n程序已退出。');
    } else {
      // 显示其他错误信息
      console.error(`❌ 错误：${errorMessage}`);
    }

    // 清理所有临时远程仓库
    try {
      await cleanupAllTempRemotes();
    } catch (cleanupError) {
      console.error(`清理临时远程仓库时发生错误：${(cleanupError as Error).message}`);
    }

    // 用户主动退出时返回0，其他错误返回1
    process.exit(errorMessage === 'USER_EXIT' ? 0 : 1);
  }
}

// 信号处理器：在程序被中断时清理临时远程仓库
process.on('SIGINT', async () => {
  console.log('\n接收到中断信号，正在清理临时资源...');
  try {
    await cleanupAllTempRemotes();
    console.log('✅ 临时资源已清理');
  } catch (error) {
    console.error(`清理临时资源时发生错误：${(error as Error).message}`);
  }
  process.exit(1);
});

// 信号处理器：在程序被终止时清理临时远程仓库
process.on('SIGTERM', async () => {
  console.log('\n程序正在终止，正在清理临时资源...');
  try {
    await cleanupAllTempRemotes();
    console.log('✅ 临时资源已清理');
  } catch (error) {
    console.error(`清理临时资源时发生错误：${(error as Error).message}`);
  }
  process.exit(1);
});

// 处理未捕获的Promise拒绝
process.on('unhandledRejection', async (reason, _promise) => {
  console.error('\n❌ 未处理的Promise拒绝：');
  console.error(`原因：${reason instanceof Error ? reason.message : reason}`);

  // 清理临时远程仓库
  try {
    await cleanupAllTempRemotes();
    console.log('✅ 临时资源已清理');
  } catch (error) {
    console.error(`清理临时资源时发生错误：${(error as Error).message}`);
  }

  process.exit(1);
});

// 处理未捕获的异常
process.on('uncaughtException', async (error) => {
  console.error('\n❌ 未捕获的异常：');
  console.error(error.message);

  // 清理临时远程仓库
  try {
    await cleanupAllTempRemotes();
    console.log('✅ 临时资源已清理');
  } catch (cleanupError) {
    console.error(`清理临时资源时发生错误：${(cleanupError as Error).message}`);
  }

  process.exit(1);
});

main();
