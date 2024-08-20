import { Router, Request, Response, NextFunction } from 'express';
import { Container } from 'typedi';
import { Logger } from 'winston';
import fs from 'fs';
import config from '../config';
import { celebrate, Joi } from 'celebrate';
import path from 'path';
import ActionService from '../services/action';
import { error } from 'console';
import dayjs from 'dayjs';
const route = Router();
/**
 * 直接调用js，并返回结果
 * js 必须放在 actions/ 目录下
 */
export default (app: Router) => {
  app.use('/actions', route);
  // jsName 不要包含 .js
  route.get(
    '/:jsName',
    celebrate({
      params: Joi.object({
        jsName: Joi.string().required(),
      }),
    }),
    async (req: Request, res: Response, next: NextFunction) => {
      res.status(405).send({ code: 405, data: '禁止访问' });
    },
  );
  // jsName 不要包含 .js
  route.post(
    '/:jsName',
    celebrate({
      params: Joi.object({
        jsName: Joi.string().required(),
      }),
      body: Joi.any(),
    }),
    async (req: Request, res: Response, next: NextFunction) => {
      const logger: Logger = Container.get('logger');
      try {
        let jsName = req.params.jsName;
        const jsPath = path.resolve(`${config.scriptPath}/actions/${jsName}.js`);
        console.log(jsPath)
        if (!fs.existsSync(jsPath)) {
          return res.send({ code: 404, data: '数据不存在' });
        }

        const execTime = dayjs().format('YYYYMMDD-HHmmss.SSS');
        const logPath = path.resolve(`${config.logPath}/actions/${jsName}/${execTime}.log`);
        fs.mkdirSync(path.dirname(logPath), { recursive: true });

        const actionService = Container.get(ActionService);
        const content =  await actionService.runAction(jsPath, logPath, req.body);

        return res.send({ code: 0, data: content });
      } catch (e) {
        return res.send({ code: 1, error: e });
      }
    },
  );

};
