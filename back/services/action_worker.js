// import path from 'path';
// import { NodeVM } from 'vm2';
const { parentPort, workerData } = require('worker_threads');
const fs = require('fs').promises;
const dayjs = require('dayjs');
const { NodeVM } = require('vm2');
const path = require('path');
const { authorization, params, jsFilePath, logPath } = workerData;

const MESSAGE_MAX = 500
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
    await appendLog('==> Time:', execTime, ' <==');
    await appendLog('==> Args:', JSON.stringify(params), ' <==');

    // 在沙箱中加载并运行一个脚本文件
    const runner = vm.runFile(jsFilePath);

    // 执行脚本中的函数，传递参数
    const result = await runner({ args: params, authorization });

    await appendLog('==> Success: \n' + JSON.stringify(result) + ' \n<==');
    parentPort.postMessage(JSON.stringify(result));
  } catch (error) {
    await appendLog('==> Error: ' + JSON.stringify(error) + ' <==');
    parentPort.postMessage({ error: error.message });
  } finally {
    await appendLog('==> End <==');
  }
}

// 执行脚本
runScript();