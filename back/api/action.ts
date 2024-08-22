import { Router, Request, Response, NextFunction } from 'express';
import { Container } from 'typedi';
import { Logger } from 'winston';
import fs from 'fs';
import config from '../config';
import { celebrate, Joi } from 'celebrate';
import path from 'path';
import ActionService from '../services/action';
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
      res.status(405).send('禁止访问');
    },
  );
  // jsName 不要包含 .js
  route.post(
    '/:actionName',
    celebrate({
      params: Joi.object({
        actionName: Joi.string().required(),
      }),
      body: Joi.any(),
    }),
    async (req: Request, res: Response, next: NextFunction) => {
      const logger: Logger = Container.get('logger');
      try {
        let actionName = req.params.actionName;
        const jsPath = path.resolve(`${config.scriptPath}/actions/${actionName}/index.js`);
        console.log(jsPath)
        if (!fs.existsSync(jsPath)) {
          return res.json({ code: 404, data: '数据不存在' });
        }

        const execTime = dayjs().format('YYYYMMDD-HHmmss.SSS');
        const logPath = path.resolve(`${config.logPath}/actions/${actionName}/${execTime}.log`);
        fs.mkdirSync(path.dirname(logPath), { recursive: true });

        const actionService = Container.get(ActionService);
        const result =  await actionService.runActionWithVM2(jsPath, logPath, req.body);

        return res.json({ code: 0, result });
      } catch (e: any) {
        console.error(e)
        return res.json({ code: 1, error: e.message });
      }
    },
  );

};
