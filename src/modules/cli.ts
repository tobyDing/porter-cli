import inquirer from 'inquirer';
import { ProjectInfo } from '../types';
import { createDefaultConfig } from './config';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * 获取package.json配置内容
 * @returns package.json配置对象
 */
export function getPackageConfig(): Record<string, any> {
  // 使用process.cwd()获取当前工作目录，确保能正确找到根目录的package.json
  const packageJsonPath = resolve(process.cwd(), 'package.json');
  const packageJsonContent = readFileSync(packageJsonPath, 'utf-8');
  return JSON.parse(packageJsonContent);
}

/**
 * 显示欢迎信息
 */
export function showWelcome(): void {
  // 从package.json中读取描述字段
  const packageJson = getPackageConfig();

  console.log('=============================================');
  console.log('          欢迎来到porter-ci的世界！         ');
  console.log(`  ${packageJson.description}`);
  console.log('=============================================');
  console.log('\n');
}

/**
 * 确认源项目信息
 * @param projectInfo 源项目信息
 * @returns 用户是否确认
 */
export async function confirmProjectInfo(projectInfo: ProjectInfo): Promise<boolean> {
  console.log(`源项目名称：${projectInfo.name}`);
  console.log(`源项目分支：${projectInfo.branch}`);
  console.log(`待同步的提交记录数量：${projectInfo.commits.length}`);

  const answers = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'confirm',
      message: '确认以上源项目信息正确吗？',
      default: true,
    },
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
      default: false,
    },
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
      default: true,
    },
  ]);

  return answers.startSync;
}

/**
 * 处理配置文件创建
 * @param projectPath 源项目目录路径
 */
export async function handleConfigCreation(projectPath: string): Promise<void> {
  await createDefaultConfig(projectPath);
  console.log('配置文件已创建，请编辑后重新运行porter-ci工具。');
}
