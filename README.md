# iCocoding 青龙面板

> 项目来源：https://github.com/whyour/qinglong


## 安装

 ```shell
 bash <(curl -Ls https://github.com/icocoding/qinglong/releases/download/tools/install.sh)
 ```

 ## 更新日志

- 2024.05.0
    > 2024-05-17 21:40
    
    **更新内容：**
    ```text
    1. 增加：脚本保存备份，防止异常时丢失脚本😭
    2. 优化：编辑脚本时，Command+S(Ctrl+S)直接保存，去掉提示框
    3. 优化：新增文件、文件夹后更新目录树
    ```

 - 2024.08.*
    > 2024-08-20 13:40

    **更新内容：**
    1. 增加：接口调用，/api/actions/:actionName
    - actionName 是放在脚本 actions 目录下action文件夹名, 必须包含index.js文件
        ```js
        module.exports = async function({args}) {
            console.log('args', args)
            return {
                backName: 'hi ' + args.name,
                args
            }
        }
        ```
    - TODO：增加接口调用权限验证
    - 采用VM2执行接口js脚本