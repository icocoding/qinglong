import { Router, Request, Response, NextFunction } from 'express';
import { Container } from 'typedi';
import { Logger } from 'winston';
import fs from 'fs';
import config from '../config';
import { celebrate, Joi } from 'celebrate';
import path from 'path';
import ActionService from '../services/action';
import dayjs from 'dayjs';
import requestIp from 'request-ip';
import TokenService from '../services/token';
import { Token, PermissionType } from '../data/token';
import UserService from '../services/user';
import rateLimit from 'express-rate-limit';
import { UserStatus } from '../data/user';
import OpenService from '../services/open';



function checkActionName(app_name: string, actionName: string) {
  let jsPath = path.resolve(`${config.scriptPath}/actions/${app_name}/${actionName}`);
  if (fs.existsSync(jsPath) && fs.statSync(jsPath).isDirectory()) {
    jsPath = path.resolve(jsPath, `index.js`);
  } else {
    jsPath = jsPath + '.js';
  }
  console.log(jsPath)
  return fs.existsSync(jsPath) ? jsPath : null;
}


/**
 * 对外开放接口
 * 直接调用js，并返回结果
 * js 必须放在 actions/ 目录下
 */
export const openApis = (app: Router) => {
  const route = Router();

  app.use('/actions', route);

  route.post(
    '/:appName/auth/token',
    rateLimit({
      windowMs: 1 * 60 * 1000,
      max: 5,
    }),
    celebrate({
      body: Joi.object({
        username: Joi.string().required(),
        password: Joi.string().required(),
      }),
    }),
    async (req: Request, res: Response, next: NextFunction) => {
      const logger: Logger = Container.get('logger');
      try {
        const ip = requestIp.getClientIp(req) || '';

        const app_name = req.params.appName;

        const { username, password } = req.body;

        console.log(username, password, app_name, ip)

        const openService = Container.get(OpenService);
        const app = await openService.getDb({ name: app_name });
        if (!app) {
          return res.json({ code: 404, data: '应用不存在' });
        }

        let roles: any[] = [];
        
        const userService = Container.get(UserService);
        const user = await userService.getUserByName(username);
        const is_admin = user && user.roles.includes('Admin');
        let permissions = {}
        if (is_admin) {
          if (!user || user.app_name != app_name || user.password !== password) {
            return res.json({ code: 401, data: '用户名或密码错误' });
          }
          if (user.status === UserStatus.disabled) {
            return res.json({ code: 403, data: '账号已禁用' });
          }
          roles = ['Admin']
        } else {
          const execTime = dayjs().format('YYYYMMDD-HHmmss.SSS');
          const logPath = path.resolve(`${config.logPath}/actions/${app_name}/auth/${execTime}.log`);
          fs.mkdirSync(path.dirname(logPath), { recursive: true });
          const jsPath = checkActionName(app_name, 'auth/token')!;
          if (!jsPath) {
            return res.json({ code: 401, data: '禁止登录' });
          }
          const actionService = Container.get(ActionService);
          const result: any = await actionService.runActionIsolated(jsPath, logPath, req);
          if (!result || result.code !== 0) {
            return res.json(result);
          }
          permissions = result.data;
          roles = ['User']
        }
        const tokenService = Container.get(TokenService);
        const result = await tokenService.create({
          payload: {
            username,
            roles,
            permissions,
            app_name,
            is_admin
          },
          client_ip: ip,
          permission_type: PermissionType.User,
        } as Token);
        logger.info(username, '登录成功', ip)
        return res.json({ code: 0, data: { token: result.token, expire_time: result.expire_time } });

      } catch (e) {
        next(e);
      }
    }
  )

  // 执行 actions 目录 js
  route.post(
    '/:appName/:actionName',
    rateLimit({
      windowMs: 1 * 60 * 1000,
      max: 100,
    }),
    celebrate({
      params: Joi.object({
        appName: Joi.string().required(),
        actionName: Joi.string().required(),
      }),
      body: Joi.any(),
    }),
    async (req: Request, res: Response, next: NextFunction) => {
      const logger: Logger = Container.get('logger');
      try {
        const app_name = req.params.appName as string;

        let actionName = req.params.actionName;
        let jsPath = checkActionName(app_name, actionName)

        if (!jsPath) {
          return res.json({ code: 404, data: '脚本文件不存在' });
        }

        const execTime = dayjs().format('YYYYMMDD-HHmmss.SSS');
        const logPath = path.resolve(`${config.logPath}/actions/${app_name}/${actionName}/${execTime}.log`);
        fs.mkdirSync(path.dirname(logPath), { recursive: true });

        const actionService = Container.get(ActionService);
        const result = await actionService.runActionIsolated(jsPath, logPath, req);

        return res.json({ code: 0, result });
      } catch (e: any) {
        console.error(e)
        return res.json({ code: 1, error: e.message });
      }
    },
  );
};

/**
 * 管理接口
 */
export default (app: Router) => {
  const route = Router();
  app.use('/actions', route);
  route.get('', async (req: Request, res: Response, next: NextFunction) => {
    const logger: Logger = Container.get('logger');
    try {
      const actionService = Container.get(ActionService);
      const data = await actionService.actions(req.query.searchValue as string);
      return res.send({ code: 200, data });
    } catch (e) {
      logger.error('🔥 error: %o', e);
      return next(e);
    }
});
  route.post(
    '/',
    celebrate({
      body: Joi.array().items(
        Joi.object({
          roles: Joi.array(),
          name: Joi.string()
            .required()
            .pattern(/^[a-zA-Z_][0-9a-zA-Z_\-]*$/),
          remarks: Joi.string().optional().allow(''),
          app_name: Joi.string().required(),
        }),
      ),
    }),
    async (req: Request, res: Response, next: NextFunction) => {
      const logger: Logger = Container.get('logger');
      try {
        let jsPath = checkActionName(req.body[0].app_name, req.body[0].name)
        if (!jsPath) {
          return res.json({ code: 404, data: '脚本文件不存在' });
        }
        const actionService = Container.get(ActionService);
        const data = await actionService.create(req.body);
        return res.send({ code: 200, data });
      } catch (e) {
        return next(e);
      }
    },
  );
  route.put(
    '/',
    celebrate({
      body: Joi.object({
        roles: Joi.array(),
        name: Joi.string(),
        remarks: Joi.string().optional().allow('').allow(null),
        id: Joi.number().required(),
        app_name: Joi.string().required(),
      }),
    }),
    async (req: Request, res: Response, next: NextFunction) => {
      const logger: Logger = Container.get('logger');
      try {
        let jsPath = checkActionName(req.body.app_name, req.body.name)
        if (!jsPath) {
          return res.json({ code: 404, data: '脚本文件不存在' });
        }
        const actionService = Container.get(ActionService);
        const data = await actionService.update(req.body);
        return res.send({ code: 200, data });
      } catch (e) {
        return next(e);
      }
    },
  );

  route.delete(
    '/',
    celebrate({
      body: Joi.array().items(Joi.number().required()),
    }),
    async (req: Request, res: Response, next: NextFunction) => {
      const logger: Logger = Container.get('logger');
      try {
        const actionService = Container.get(ActionService);
        const data = await actionService.remove(req.body);
        return res.send({ code: 200, data });
      } catch (e) {
        return next(e);
      }
    },
  );
  route.put(
    '/disable',
    celebrate({
      body: Joi.array().items(Joi.number().required()),
    }),
    async (req: Request, res: Response, next: NextFunction) => {
      const logger: Logger = Container.get('logger');
      try {
        const actionService = Container.get(ActionService);
        const data = await actionService.disabled(req.body);
        return res.send({ code: 200, data });
      } catch (e) {
        return next(e);
      }
    },
  );

  route.put(
    '/enable',
    celebrate({
      body: Joi.array().items(Joi.number().required()),
    }),
    async (req: Request, res: Response, next: NextFunction) => {
      const logger: Logger = Container.get('logger');
      try {
        const actionService = Container.get(ActionService);
        const data = await actionService.enabled(req.body);
        return res.send({ code: 200, data });
      } catch (e) {
        return next(e);
      }
    },
  );

};
