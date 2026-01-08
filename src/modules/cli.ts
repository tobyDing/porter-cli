import inquirer from 'inquirer';
import { ProjectInfo } from '../types';
import { createDefaultConfig } from './config';

/**
 * 显示欢迎信息
 */
export function showWelcome(): void {
  console.log('====================================');
  console.log('          Porter-CI 工具');
  console.log('  基于git cherry-pick实现跨项目代码同步');
  console.log('====================================\n');
}

/**
 * 确认项目信息
 * @param projectInfo 项目信息
 * @returns 用户是否确认
 */
export async function confirmProjectInfo(projectInfo: ProjectInfo): Promise<boolean> {
  console.log(`当前项目：${projectInfo.name}`);
  console.log(`当前分支：${projectInfo.branch}`);
  console.log(`提交记录数量：${projectInfo.commits.length}`);
  
  const answers = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'confirm',
      message: '确认以上信息正确吗？',
      default: true
    }
  ]);
  
  return answers.confirm;
}

/**
 * 询问是否创建配置文件
 * @returns 用户是否要创建配置文件
 */
export async function askToCreateConfig(): Promise<boolean> {
  const answers = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'createConfig',
      message: '是否需要创建或编辑配置文件？',
      default: false
    }
  ]);
  
  return answers.createConfig;
}

/**
 * 询问是否启动同步
 * @returns 用户是否要启动同步
 */
export async function askToStartSync(): Promise<boolean> {
  const answers = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'startSync',
      message: '是否开始同步代码？',
      default: true
    }
  ]);
  
  return answers.startSync;
}

/**
 * 处理配置文件创建
 * @param projectName 项目名称
 */
export async function handleConfigCreation(projectName: string): Promise<void> {
  await createDefaultConfig(projectName);
  console.log('配置文件已创建，请编辑后重新运行porter-ci工具。');
}
