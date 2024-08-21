import { Service, Inject } from 'typedi';
import winston from 'winston';
import ScheduleService, { TaskCallbacks } from './schedule';

import dayjs from 'dayjs';
import * as fs from 'fs/promises';

const vm = require('vm');

@Service()
export default class ActionService {
  constructor(
    @Inject('logger') private logger: winston.Logger,
    private scheduleService: ScheduleService,
  ) { }

  public async runActionWithVM(filePath: string, logPath: string, params: any) {
    async function appLog(message: string) {
      return fs.appendFile(logPath, message + '\n', 'utf8');
    }
    const execTime = dayjs().format('YYYYMMDDHHmmss.SSS');
    const scriptContent = `
      const fs = require('fs');
      const params = ${JSON.stringify(params)};
      console.log('--> Time:', ${execTime}, ' <--');
      console.log('--> Params:', params, ' <--');
      const target = require('${filePath}');
      const fn = target.main || target;
      const promise = fn({args: params});
      promise;
      `;
    // 创建一个处理程序
    const logHandler = {
      get(target: any, propKey: string) {
        // 拦截 'log' 方法
        if (propKey === 'log' || propKey === 'error') {
          return function() {
            const arr = Array.from(arguments).map(x => typeof x == 'object' ? JSON.stringify(x) : x);
            // 自定义处理 log 方法的行为
            appLog(arr.join(' '))
          };
        }
        // 对其他属性或方法的默认行为
        return target[propKey];
      }
    };

    // 使用 Proxy 对象代理全局 console 对象
    const proxiedConsole = new Proxy(console, logHandler);

    // 创建一个脚本并将 Proxy 对象传递到上下文中
    // 创建一个上下文，并将 proxiedConsole 替换到上下文中
    const context = vm.createContext({ console: proxiedConsole, require: require, params });

    // 编译和运行脚本
    const scriptObj = new vm.Script(scriptContent);
    const promise = scriptObj.runInContext(context);
    try {
      const result = await promise;
      appLog('--> Success: \n' + JSON.stringify(result) + ' \n<--')
      return result;
    } catch (error) {
      appLog('--> Error: ' + JSON.stringify(error) + ' <--')
      throw error;
    }
  }
}
