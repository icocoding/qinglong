import 'reflect-metadata'; // We need this in order to use @Decorators
import config from './config';
import express from 'express';
import depInjectorLoader from './loaders/depInjector';
import Logger from './loaders/logger';


async function startServer() {
  const app = express();
  depInjectorLoader();

  await require('./loaders/functions').default({ app });

  app
    .listen(config.functionsPort, () => {
      Logger.debug(`✌️ FUNCTIONS 服务启动成功！`);
      console.debug(`✌️ FUNCTIONS 服务启动成功！ port: ${config.functionsPort}`);
      process.send?.('ready');
    })
    .on('error', (err) => {
      Logger.error(err);
      console.error(err);
      process.exit(1);
    });
}

startServer();
