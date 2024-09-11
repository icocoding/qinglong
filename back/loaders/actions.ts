import { Request, Response, NextFunction, Application } from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import { openApiActions } from '../api';
import config from '../config';
import jwt, { UnauthorizedError } from 'express-jwt';
import fs from 'fs/promises';
import {
  getBasicToken,
  getPlatform,
  getToken,
  safeJSONParse,
} from '../config/util';
import * as Sentry from '@sentry/node';
import { errors } from 'celebrate';
import Logger from './logger';
import rewrite from 'express-urlrewrite';

import OpenService from '../services/open';
import Container from 'typedi';
import ActionService from '../services/action';
import TokenService from '../services/token';

export default ({ app }: { app: Application }) => {
  app.set('trust proxy', 'loopback');
  app.use(cors());

  app.use(bodyParser.json({ limit: '50mb' }));
  app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));

  const ACTION_PREFIX = '/actions/';
  
  // 兼容之前的api
  app.use(rewrite('/api/*', '/$1'));

  // app.use(
  //   jwt({
  //     secret: config.secret,
  //     algorithms: ['HS384'],
  //   }).unless({
  //     // path: [/^\/actions\//],
  //   }),
  // );
  // 获取平台信息
  app.use((req: any, res, next) => {

    if (!req.path.startsWith(ACTION_PREFIX)) {
      throw Error('Request Path Error');
    }

    console.log('Request Path:', req.path);
    if (!req.headers) {
      req.platform = 'desktop';
    } else {
      const platform = getPlatform(req.headers['user-agent'] || '');
      req.platform = platform;
    }
    return next();
  });

  app.use(async (req: any, res, next) => {

    const actionName = req.path.replace(ACTION_PREFIX, '');

    if (actionName.endsWith('/auth/token')) {
      return next();
    }

    const headerToken = getToken(req);
    console.log('headerToken', headerToken, 'actionName', actionName);
    const names = actionName.split('/');
    const actionService = Container.get(ActionService);
    const action = await actionService.getDb({app_name: names[0], name: names[1]});
    if (!action) {
      const err = new UnauthorizedError('error_action', { message: 'Action was not allowed' });
      return next(err);
    }
    // 不校验权限
    if (action.roles.length === 0) {
      return next();
    }
    if (!headerToken) {
      const err = new UnauthorizedError('need_permission', { message: 'No authorization token was found' });
      return next(err);
    }
    // 校验 Token
    // const redisKey = `token:${headerToken}`
    // const redisData = await getRedisData(redisKey);

    const tokenService = Container.get(TokenService);
    const tokenModel = await tokenService.getToken(headerToken);
    if (!tokenModel || tokenModel.expire_time < Date.now()) {
      const err = new UnauthorizedError('expiration_permission', { message: 'Authorization token was expired' });
      return next(err);
    } else {

      // 判断角色权限
      const actionRoles = action.roles;
      const tokenRoles = tokenModel.payload.roles;
      if (!actionRoles || actionRoles.length === 0 || !tokenRoles || tokenRoles.length === 0) {
        const err = new UnauthorizedError('role_permission', { message: 'Permission not set' });
        return next(err);
      }
      const isAllow = actionRoles.some( r => tokenRoles.includes(r) );
      if (!isAllow) {
        const err = new UnauthorizedError('permission_denied', { message: 'Permission denied' });
        return next(err);
      }
      if (names[0] != tokenModel.payload.app_name) {
        const err = new UnauthorizedError('permission_denied', { message: 'AppName error' });
        return next(err);
      }
      req.authorization = tokenModel.payload;
      return next();
    }

  });

  app.use('', openApiActions());

  app.use((req, res, next) => {
    const err: any = new Error('Not Found');
    err['status'] = 404;
    next(err);
  });


  app.use(errors());

  app.use(
    (
      err: Error & { status: number },
      req: Request,
      res: Response,
      next: NextFunction,
    ) => {
      if (err.name === 'UnauthorizedError') {
        return res
          .status(err.status)
          .send({ code: 401, message: err.message })
          .end();
      }
      return next(err);
    },
  );

  app.use(
    (
      err: Error & { errors: any[] },
      req: Request,
      res: Response,
      next: NextFunction,
    ) => {
      if (err.name.includes('Sequelize')) {
        return res
          .status(500)
          .send({
            code: 400,
            message: `${err.name} ${err.message}`,
            validation: err.errors,
          })
          .end();
      }
      return next(err);
    },
  );

  app.use(
    (
      err: Error & { status: number },
      req: Request,
      res: Response,
      next: NextFunction,
    ) => {
      Sentry.captureException(err);

      res.status(err.status || 500);
      res.json({
        code: err.status || 500,
        message: err.message,
      });
    },
  );
};
