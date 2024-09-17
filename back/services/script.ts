import { Service, Inject } from 'typedi';
import winston from 'winston';
import path, { join } from 'path';
import SockService from './sock';
import CronService from './cron';
import ScheduleService, { TaskCallbacks } from './schedule';
import config from '../config';
import { TASK_COMMAND } from '../config/const';
import { fileExist, getFileContentByName, getPid, killTask, rmPath } from '../config/util';

@Service()
export default class ScriptService {
  constructor(
    @Inject('logger') private logger: winston.Logger,
    private sockService: SockService,
    private cronService: CronService,
    private scheduleService: ScheduleService,
  ) {}

  private taskCallbacks(filePath: string): TaskCallbacks {
    return {
      onEnd: async (cp, endTime, diff) => {
        await rmPath(filePath);
      },
      onError: async (message: string) => {
        this.sockService.sendMessage({
          type: 'manuallyRunScript',
          message,
        });
      },
      onLog: async (message: string) => {
        this.sockService.sendMessage({
          type: 'manuallyRunScript',
          message,
        });
      },
    };
  }

  public async runScript(filePath: string) {
    const relativePath = path.relative(config.scriptPath, filePath);
    const command = `${TASK_COMMAND} ${relativePath} now`;
    const pid = await this.scheduleService.runTask(
      command,
      this.taskCallbacks(filePath),
      { command },
      'start',
    );

    return { code: 200, data: pid };
  }

  public async stopScript(filePath: string, pid: number) {
    if (!pid) {
      const relativePath = path.relative(config.scriptPath, filePath);
      pid = (await getPid(`${TASK_COMMAND} ${relativePath} now`)) as number;
    }
    try {
      await killTask(pid);
    } catch (error) {}

    return { code: 200 };
  }

  public async getFile(filePath: string, fileName: string) {
    const _filePath = join(config.scriptPath, filePath, fileName);
    const content = await getFileContentByName(_filePath);
    return content;
  }

  public async unzipFile(filePath: string, dirName: string) {
    const dirPath = path.resolve(path.dirname(filePath), dirName);
    if (await fileExist(dirPath)) {
      this.logger.error(`目录: ${dirName} exists`)
      return Promise.reject(`目录: ${dirName} exists`)
    }
    const command = `unzip ${filePath} -d ${dirPath}`;
    const that = this;
    return new Promise(async function(resolve, reject) {
      await that.scheduleService.runTask(
        command,
        {
          onEnd: async (cp, endTime, diff) => {
            resolve('success')
          },
          onError: async (message: string) => {
            that.logger.error(message)
            reject(message)
          },
          onLog: async (message: string) => {
            that.logger.info(message)
          },
        },
        { command },
        'start',
      );
    })
  }
  public async npmInstall(filePath: string) {
    const command = `npm install --omit=dev --prefix ${filePath}`;
    const that = this;
    return new Promise(async function(resolve, reject) {
      await that.scheduleService.runTask(
        command,
        {
          onEnd: async (cp, endTime, diff) => {
            resolve('success')
          },
          onError: async (message: string) => {
            that.logger.error(message)
            reject(message)
          },
          onLog: async (message: string) => {
            that.logger.info(message)
          },
        },
        { command },
        'start',
      );
    })
  }
}
