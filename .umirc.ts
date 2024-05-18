import { defineConfig } from '@umijs/max';
const CompressionPlugin = require('compression-webpack-plugin');

const baseUrl = process.env.QlBaseUrl || '/';
export default defineConfig({
  hash: true,
  jsMinifier: 'terser',
  antd: {},
  locale: {
    antd: true,
    title: true,
    baseNavigator: true,
  },
  outputPath: 'static/dist',
  fastRefresh: true,
  favicons: [`https://qn.whyour.cn/favicon.svg`],
  publicPath: process.env.NODE_ENV === 'production' ? './' : '/',
  proxy: {
    [`${baseUrl}api/update`]: {
      target: 'http://127.0.0.1:5300/',
      changeOrigin: true,
      pathRewrite: { [`^${baseUrl}api/update`]: '/api' },
    },
    [`${baseUrl}api/public`]: {
      target: 'http://127.0.0.1:5400/',
      changeOrigin: true,
      pathRewrite: { [`^${baseUrl}api/public`]: '/api' },
    },
    [`${baseUrl}api`]: {
      target: 'http://127.0.0.1:5600/',
      changeOrigin: true,
      ws: true,
      pathRewrite: { [`^${baseUrl}api`]: '/api' },
    },
  },
  codeSplitting: {
    jsStrategy: 'depPerChunk',
  },
  chainWebpack: ((config: any) => {
    config.plugin('compression-webpack-plugin').use(
      new CompressionPlugin({
        algorithm: 'gzip',
        test: new RegExp('\\.(js|css)$'),
        threshold: 10240,
        minRatio: 0.6,
      }),
    );
    if (process.env.NODE_ENV === 'production') {
      
      // config.optimization.splitChunks.chunks = function(chunk: { name: string; }) {
      //       // Exclude specific chunks
      //       return chunk.name.endsWith('.js'); 
      //     // },
      //   }
        // minimize: true,
        // minimizer: [
        //   new TerserPlugin({
        //     terserOptions: {
        //       compress: {
        //         drop_console: true,
        //         drop_debugger: true,
        //       },
        //     },
        //   }),
        // ],
      // };
      config.performance
      .maxEntrypointSize(5_000_000) // 设置入口文件大小限制
      .maxAssetSize(5_000_000); // 设置资源文件大小限制
      // config.performance = {
      //   hints: 'warning', // 或者"error"，如果你想要在限制内发出错误
      //   maxAssetSize: 200_000, // 最大资源大小（字节）
      //   maxEntrypointSize: 400_000, // 最大入口大小（字节）
      //   assetFilter: function (assetFilename: string) {
      //     return assetFilename.endsWith('.js');
      //   },
      // }
    }
  }) as any,
  externals: {
    react: 'window.React',
    'react-dom': 'window.ReactDOM',
  },
  headScripts: [
    `./api/env.js`,
    'https://gw.alipayobjects.com/os/lib/react/18.2.0/umd/react.production.min.js',
    'https://gw.alipayobjects.com/os/lib/react-dom/18.2.0/umd/react-dom.production.min.js',
  ],
  copy: [
    {
      from: 'node_modules/monaco-editor/min/vs',
      to: 'static/dist/monaco-editor/min/vs',
    },
  ],
});
