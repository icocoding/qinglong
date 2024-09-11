// import path from 'path';
// import { NodeVM } from 'vm2';
const { parentPort, workerData } = require('worker_threads');
const fs = require('fs').promises;
const dayjs = require('dayjs');
const { NodeVM } = require('vm2');
const path = require('path');
const { authorization, params, jsFilePath, logPath } = workerData;

const MESSAGE_MAX = 500;
const LOG_START = '=>';
const LOG_END = '<=';
async function appendLog(...messages) {
  const text = messages
  .map((m) => (typeof m == 'object' ? JSON.stringify(m) : m))
  .join(' ')
  fs.appendFile(
    logPath,
    (text.length > MESSAGE_MAX ? (text.substring(0, MESSAGE_MAX) + '...') : text) + '\n',
    'utf8',
  ).then(() => {});
}

// 创建一个新的 NodeVM 实例
const vm = new NodeVM({
  console: 'redirect', // 重定向 console 输出
  // console: 'inherit', // 继承主环境的 console
  sandbox: {
    // authorization,
    // args: params,
    console: {
      log: (...messages) => {
        appendLog('I:', ...messages);
      },
      error: (...messages) => {
        appendLog('E:', ...messages);
      },
    }
  }, // 沙箱中的变量
  require: {
    external: true, // 允许加载外部模块
    builtin: ['fs', 'path'], // 允许使用内建模块
    root: path.dirname(jsFilePath), // 允许访问的脚本目录
  },
  timeout: 30_000, // 运行脚本的超时时间 30s
});
// 监听来自沙箱的日志
// vm.on('console.log', (...messages) => appendLog('I:', ...messages));
// vm.on('console.error', (...messages) => appendLog('E:', ...messages));
const execTime = dayjs().format('YYYYMMDDHHmmss.SSS');
async function runScript() {
  try {
    await appendLog(LOG_START, 'Time:', execTime, LOG_END);
    await appendLog(LOG_START, 'Args:', JSON.stringify(params), LOG_END);

    // 在沙箱中加载并运行一个脚本文件
    const runner = vm.runFile(jsFilePath);

    // 执行脚本中的函数，传递参数
    const result = await runner({ args: params, authorization });

    await appendLog(LOG_START, 'Success: \n' + JSON.stringify(result) + ' \n', LOG_END);
    parentPort.postMessage(JSON.stringify(result));
  } catch (error) {
    await appendLog(LOG_START, 'Error: ' + JSON.stringify(error), LOG_END);
    parentPort.postMessage({ error: error.message });
  } finally {
    await appendLog(LOG_START, 'End', LOG_END);
  }
}

// 执行脚本
runScript();