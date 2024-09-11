# Actions 介绍

## 启动端口

- 默认端口: 5710
- 可通过环境变量(`.env`文件)`ACTIONS_PORT`或者运行参数`process.env.ACTIONS_PORT`配置

## 脚本位置

> 脚本管理 > actions 目录
- 第一层目录为: `appName`, 应用名称
- 第二层为: Action, 是一个`npm`项目，也可以是一个`js`文件

## 调用方式
+ 内置函数调
    - 认证授权, 获取Token
        > 自动判断是否为 App Admin, 具体逻辑: 先判断用户是否为User表中当前App的管理员, 如果是, 则`is_admin` 为 `true`, 判断密码后返回Token; 否则为 `false`, 然后调用 `actions/:appName/auth/token.js`(自己创建), 将返回结果`{code: 0, data: {}}` 中的 `data` 存入 Token `permissions` 中, 如果 `code` 不为 `0` 则把返回结果给接口

        - 请求: `POST /actions/:appName/auth/token`
        - 参数: `{username: string, password: string}`
        - 返回: 
            ```json
            {
                "code": 0,
                "data": {
                    "token": "fd12a817-2308-4406-87df-86989f93c6e2",
                    "expire_time": 1726116313691
                }
            }
            ```
        - Token权限信息 `payload` 即 `authorization`
            ```json
                payload: 
                {
                    username,
                    roles,
                    permissions,
                    app_name,
                    is_admin
                },
            ```
            - username: 登录用户名
            - roles: 角色
            - permissions: 获取Token时设置的 `permissions`
            - app_name: 应用名
            - is_admin: 是否为管理员
        - 示例 `/auth/token.js`
            ```js
            const {mongodb, closeClient} = require('./lib/mongodb');
            /**
            * 校验用户信息
            * @param {*} param0 
            */
            async function checkUser({app_name, username, password}) {
                const client = await mongodb();
                try {
                    const collection = client.db('iot_db').collection('user');
                    const user = await collection.findOne({
                        username,
                    })
                    console.log(user)
                    if (user && user.password === password) {
                        return {
                            code: 0,
                            msg: 'success',
                            data: {
                                menus: ['user', 'device']
                            }
                        }
                    } else {
                        return {
                            code: 1,
                            msg: 'username or password error'
                        }
                    }
                } finally {
                    closeClient();
                }
            }

            module.exports = async function(params) {
                console.log('params', params)
                return checkUser(params.args)
            }
            ```
+ 自定义函数调
    - POST /actions/:appName/:actionName
    - appName: 是Action所属的应用名称
    - actionName:
        - Action是一个`npm`项目, `actionName`是项目目录名称, 项目必须包含`index.js`文件
        - Action是一个`js`文件, `actionName`是文件名称, 不包含`.js`后缀
    - 上下文参数:
        ```json
        {
            args,
            authrorization,
        }
        ```
        - args: API Post body(json)
        - authrorization: Token权限信息
    - 示例
        ```js
        module.exports = async function({ args, authorization }) {
            console.log('req args', args)
            return {
                username: 'hi ' + authorization.username,
            }
        }
        ```
+ 脚本文件执行方式: worker_threads+vm2 
    > 由于vm2执行环境并未完全隔离, 导致脚本文件执行时, 数据库连接被关闭, 所以采用worker_threads+vm2的方式执行脚本文件


## API注册

> 调用管理 注册API, 未注册的API无法调用
- 所属应用: AppName
- 无权限控制: 注册API可选择无权限控制, 即可直接调用
- 有权限控制: 
    - 控制角色: Admin/User
- AppToken:
    - AppKey和AppSecret生成的Token
    - 有效期24h

##