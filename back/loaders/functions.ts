import { Request, Response, NextFunction, Application } from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import { functions } from '../api';
import config from '../config';
import jwt, { UnauthorizedError } from 'express-jwt';
import fs from 'fs/promises';
import { getPlatform, getToken, safeJSONParse } from '../config/util';
import * as Sentry from '@sentry/node';
import { errors } from 'celebrate';
import Logger from './logger';

export default ({ app }: { app: Application }) => {
  app.set('trust proxy', 'loopback');
  app.use(cors());

  app.use(bodyParser.json({ limit: '50mb' }));
  app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));

  app.use(
    jwt({
      secret: config.secret,
      algorithms: ['HS384'],
    }).unless({
      path: [/^\/api\/actions\//],
    }),
  );

  // 获取平台信息
  app.use((req: Request, res, next) => {
    console.log('Request Path:', req.path);
    if (!req.headers) {
      req.platform = 'desktop';
    } else {
      const platform = getPlatform(req.headers['user-agent'] || '');
      req.platform = platform;
    }
    return next();
  });

  app.use(async (req, res, next) => {
    const headerToken = getToken(req);
   
    // 不校验权限
    if (req.path.startsWith('/api/actions/')) {
      return next();
    }

    const originPath = `${req.baseUrl}${req.path === '/' ? '' : req.path}`;
    if (
      !headerToken &&
      originPath &&
      config.apiWhiteList.includes(originPath)
    ) {
      return next();
    }

    const data = await fs.readFile(config.authConfigFile, 'utf8');
    if (data && headerToken) {
      const { token = '', tokens = {} } = safeJSONParse(data);
      if (headerToken === token || tokens[req.platform] === headerToken) {
        return next();
      }
    }

    const errorCode = headerToken ? 'invalid_token' : 'credentials_required';
    const errorMessage = headerToken
      ? 'jwt malformed'
      : 'No authorization token was found';
    const err = new UnauthorizedError(errorCode, { message: errorMessage });
    next(err);
  });

  app.use(config.api.prefix, functions());

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
