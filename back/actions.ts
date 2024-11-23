import 'reflect-metadata'; // We need this in order to use @Decorators
import config from './config';
import express from 'express';
import depInjectorLoader from './loaders/depInjector';
import Logger from './loaders/logger';


async function startServer() {
  const app = express();
  depInjectorLoader();

  await require('./loaders/actions').default({ app });

  app
    .listen(config.actionsPort, () => {
      Logger.debug(`✌️ actions 服务启动...`);
      process.send?.('ready');
      Logger.debug(`✌️ actions 服务启动成功！`);
      console.debug(`✌️ actions 服务启动成功！ port: ${config.actionsPort}`);
    })
    .on('error', (err) => {
      Logger.debug(`✌️ actions 服务启动失败--------------`);
      Logger.error(err);
      console.error(err);
      process.exit(1);
    });
}

startServer();
