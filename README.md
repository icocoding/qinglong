# iCocoding 青龙面板

> 项目来源：https://github.com/whyour/qinglong


## 安装

> docker 一键安装
 ```shell
 bash <(curl -Ls https://github.com/icocoding/qinglong/releases/download/tools/install.sh)
 ```


## 开发说明

- 添加菜单
`src/layouts/defaultProps.tsx` 添加路由

- 修改标题

`src/utils/config.ts` documentTitleMap 添加路由对应的标题

- 表单用户名和密码自动填充问题
> 设置 autoComplete="new-password"


## Actions 

[接口调用](./README-actions.md)



## 更新日志

[变更记录](./version.yaml)