import { Service, Inject } from 'typedi';
import winston, { Container } from 'winston';

import dayjs from 'dayjs';
import * as fs from 'fs/promises';
import path from 'path';
import { Action, ActionModel, ActionStatus } from '../data/action';
import { FindOptions, Op } from 'sequelize';
import { Router, Request, Response, NextFunction } from 'express';

const { NodeVM } = require('vm2');
import { Worker } from 'worker_threads';
import { safeJSONParse } from '../config/util';


@Service()
export default class ActionService {
  public async create(payloads: Action[]): Promise<Action[]> {
    payloads.forEach((action) => (action.status = ActionStatus.normal));
    const docs = await this.insert(payloads);
    return docs;
  }

  public async insert(payloads: Action[]): Promise<Action[]> {
    const result = [];
    for (const action of payloads) {
      const doc = await ActionModel.create(action, { returning: true });
      result.push(doc);
    }
    return result;
  }

  public async update(payload: Action): Promise<Action> {
    const doc = await this.getDb({ id: payload.id });
    const tab = new Action({ ...doc, ...payload, name: doc.name });
    const newDoc = await this.updateDb(tab);
    return newDoc;
  }

  private async updateDb(payload: Action): Promise<Action> {
    await ActionModel.update({ ...payload }, { where: { id: payload.id } });
    return await this.getDb({ id: payload.id });
  }

  public async remove(ids: string[]) {
    await ActionModel.destroy({ where: { id: ids } });
  }

  public async disabled(ids: string[]) {
    await ActionModel.update(
      { status: ActionStatus.disabled },
      { where: { id: ids } },
    );
  }

  public async enabled(ids: string[]) {
    await ActionModel.update(
      { status: ActionStatus.normal },
      { where: { id: ids } },
    );
  }

  async actions(searchText: string = '', query: any = {}): Promise<Action[]> {
    let condition = { ...query };
    if (searchText) {
      const encodeText = encodeURI(searchText);
      const reg = {
        [Op.or]: [
          { [Op.like]: `%${searchText}%` },
          { [Op.like]: `%${encodeText}%` },
        ],
      };

      condition = {
        ...condition,
        [Op.or]: [
          {
            name: reg,
          },
          {
            remarks: reg,
          },
        ],
      };
    }
    try {
      const result = await this.find(condition, [['createdAt', 'ASC']]);
      return result as any;
    } catch (error) {
      throw error;
    }
  }

  private async find(query: any, sort: any = []): Promise<Action[]> {
    const docs = await ActionModel.findAll({
      where: { ...query },
      order: [...sort],
    });
    return docs;
  }

  public async getDb(query: FindOptions<Action>['where']): Promise<Action> {
    const doc: any = await ActionModel.findOne({ where: { ...query } });
    return doc && (doc.get({ plain: true }) as Action);
  }

  constructor(@Inject('logger') private logger: winston.Logger) {}
  public async runActionIsolated(
    jsFilePath: string,
    logPath: string,
    req: Request,
  ) {
    const params: any = req.body;
    const authorization = (req as any).authorization;
    // 创建新的 Worker 线程
    const worker = new Worker(path.join(__dirname, 'action_worker.js'), {
      workerData: {
        jsFilePath,
        logPath,
        params,
        authorization,
      },
    });
    return new Promise((resolve, reject) => {
      // 监听来自 Worker 的消息
      worker.on('message', (result) => {
        console.log('Result from worker, success');
        resolve(safeJSONParse(result))
      });

      worker.on('error', (error) => {
        console.error('Worker error:', error);
        reject(error)
      });

      worker.on('exit', (code) => {
        if (code !== 0) {
          console.error(`Worker stopped with exit code ${code}`);
        } else {
          console.log('Worker exited successfully');
        }
      });
    });
  }
  public async runActionWithVM2(
    jsFilePath: string,
    logPath: string,
    req: Request,
  ) {
    const params: any = req.body;
    const authorization = (req as any).authorization;
    this.logger.info('执行js脚本', jsFilePath);
    // 创建一个新的 NodeVM 实例
    let vm = new NodeVM({
      console: 'redirect', // 重定向 console 输出
      // console: 'inherit', // 继承主环境的 console
      sandbox: {
        authorization,
        args: params,
      }, // 沙箱中的变量
      require: {
        external: true, // 允许加载外部模块
        builtin: ['fs', 'path'], // 允许使用内建模块
        root: path.dirname(jsFilePath), // 允许访问的脚本目录
      },
      timeout: 30_000, // 运行脚本的超时时间 30s
    });
    console.log('vm sandbox', typeof vm.runFile);
    async function appendLog(...messages: any[]) {
      fs.appendFile(
        logPath,
        messages
          .map((m) => (typeof m == 'object' ? JSON.stringify(m) : m))
          .join(' ') + '\n',
        'utf8',
      ).then(() => {});
    }
    // 监听来自沙箱的日志
    vm.on('console.log', (...messages: any[]) => appendLog('I:', ...messages));
    vm.on('console.error', (...messages: any[]) =>
      appendLog('E:', ...messages),
    );
    const execTime = dayjs().format('YYYYMMDDHHmmss.SSS');
    try {
      appendLog('--> Time:', execTime, ' <--');
      appendLog('--> Params:', JSON.stringify(params), ' <--');
      // 在沙箱中加载并运行一个脚本文件
      const runner = vm.runFile(jsFilePath);
      const result = await runner({
        args: params,
      });
      appendLog('--> Success: \n' + JSON.stringify(result) + ' \n<--');
      return result;
    } catch (error) {
      appendLog('--> Error: ' + JSON.stringify(error) + ' <--');
      throw error;
    } finally {
      appendLog('--> End: ' + '' + ' <--');
      vm = null;
    }
  }
}
