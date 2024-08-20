import { Service, Inject } from 'typedi';
import winston from 'winston';
import { join } from 'path';
import ScheduleService, { TaskCallbacks } from './schedule';

import dayjs from 'dayjs';
import * as fs from 'fs/promises';

@Service()
export default class ActionService {
  constructor(
    @Inject('logger') private logger: winston.Logger,
    private scheduleService: ScheduleService,
  ) { }

  public async runAction(filePath: string, logPath: string, params: any) {

    const execTime = dayjs().format('YYYYMMDDHHmmss.SSS');
    const execFilePath = join(filePath + execTime + `.js`);
    const resultJsonPath = join(filePath + execTime + `.json`);
    const script = `
    const fs = require('fs');
    const params = ${JSON.stringify(params)};
    console.log('--> Time:', ${execTime}, ' <--');
    console.log('--> Params:', params, ' <--');
    const target = require('${filePath}');
    target.main(params).then(res => {
      console.log('--> Success:', res, ' <--');
      fs.writeFileSync('${resultJsonPath}', JSON.stringify(res));
    }).catch(err => {
      console.error('--> Error:', err, ' <--');
      fs.writeFileSync('${resultJsonPath}', JSON.stringify(err));
    }).finally(() => {
      process.exit(0); // 正常退出
    });
`
    await fs.writeFile(execFilePath, script);
    const command = `node ${execFilePath}`;
    console.log(command)
    const that = this;
    return new Promise(function (resolve, reject) {
      try {
        that.scheduleService.runTask(
          command,
          {
            onStart: async(cp, startTime) => {
              console.log('Start:', startTime.format('YYYY-MM-DD HH:mm:ss'));
            },
            onEnd: async (cp, endTime, diff) => {
              const fileContent = await fs.readFile(resultJsonPath, 'utf8');
              resolve({
                result: JSON.parse(fileContent),
                takeTime: diff,
              });
            },
            onError: async (message: string) => {
              reject({ code: 100, msg: message })
            },
            onLog: async(message) => {
              console.log(message)
              await fs.appendFile(logPath, `${message}`);
            },
          },
          { command },
          'end',
        )
      } catch (error) {
        reject({ code: 101, msg: error })
      }
    }).finally(async() => {
      // 删除临时文件
      await fs.unlink(resultJsonPath);
      await fs.unlink(execFilePath);
    })
  }
}
