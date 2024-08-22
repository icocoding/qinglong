import { Service, Inject } from 'typedi';
import winston, { Container } from 'winston';

import dayjs from 'dayjs';
import * as fs from 'fs/promises';
import path from 'path';

const vm = require('vm');
const { NodeVM } = require('vm2');

@Service()
export default class ActionService {
  constructor(
    @Inject('logger') private logger: winston.Logger,
  ) { }

  public async runActionWithVM2(jsFilePath: string, logPath: string, params: any) {
    this.logger.info("执行js脚本", jsFilePath)
    // 创建一个新的 NodeVM 实例
    const vm = new NodeVM({
      console: 'redirect', // 重定向 console 输出
      // console: 'inherit', // 继承主环境的 console
      sandbox: {
        args: params
      }, // 沙箱中的变量
      require: {
          external: true, // 允许加载外部模块
          builtin: ['fs', 'path'], // 允许使用内建模块
          root: path.dirname(jsFilePath), // 允许访问的脚本目录
      },
      timeout: 30_000, // 运行脚本的超时时间 30s
    });
    async function appendLog(...messages: any[]) {
      fs.appendFile(logPath, messages.join(' ') + '\n', 'utf8').then(() => {});
    }
    // 监听来自沙箱的日志
    vm.on('console.log', (message: any) => appendLog(message));
    vm.on('console.error', (message: any) => appendLog(message));
    const execTime = dayjs().format('YYYYMMDDHHmmss.SSS');
    try {
      appendLog('--> Time:', execTime, ' <--');
      appendLog('--> Params:', JSON.stringify(params), ' <--');
      // 在沙箱中加载并运行一个脚本文件
      const runner = vm.runFile(jsFilePath);
      const result = await runner({
        args: params
      });
      appendLog('--> Success: \n' + JSON.stringify(result) + ' \n<--')
      return result;
    } catch (error) {
      appendLog('--> Error: ' + JSON.stringify(error) + ' <--')
      throw error;
    } finally {
      appendLog('--> End: ' + '' + ' <--')
    }
  }
}
