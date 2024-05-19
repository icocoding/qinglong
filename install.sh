#!/bin/bash

red='\033[0;31m'
green='\033[0;32m'
yellow='\033[0;33m'
plain='\033[0m'

cur_dir=$(pwd)

# check root
[[ $EUID -ne 0 ]] && echo -e "${red}错误: ${plain} 必须使用root用户运行此脚本!\n" && exit 1


# check Docker
if ! service docker status > /dev/null 2>&1; then
    echo -e "Docker 没有安装或未运行"
    exit 1
fi

# check os
if [[ -f /etc/redhat-release ]]; then
    release="centos"
elif cat /etc/issue | grep -Eqi "debian"; then
    release="debian"
elif cat /etc/issue | grep -Eqi "ubuntu"; then
    release="ubuntu"
elif cat /etc/issue | grep -Eqi "centos|red hat|redhat"; then
    release="centos"
elif cat /proc/version | grep -Eqi "debian"; then
    release="debian"
elif cat /proc/version | grep -Eqi "ubuntu"; then
    release="ubuntu"
elif cat /proc/version | grep -Eqi "centos|red hat|redhat"; then
    release="centos"
else
    echo -e "${red}未检测到系统版本, 请联系脚本作者! ${plain}\n" && exit 1
fi

arch=$(arch)

if [[ $arch == "x86_64" || $arch == "x64" || $arch == "amd64" ]]; then
    arch="amd64"
elif [[ $arch == "aarch64" || $arch == "arm64" ]]; then
    arch="arm64"
elif [[ $arch == "s390x" ]]; then
    arch="s390x"
else
    arch="amd64"
    echo -e "${red}检测架构失败, 使用默认架构: ${arch}${plain}"
fi

echo "架构: ${arch}"

install_base() {
    if [[ x"${release}" == x"centos" ]]; then
        yum install wget curl tar -y
    else
        apt install wget curl tar -y
    fi

    read -p "请设置Github用户名(默认:icocoding 回车):" maintainer
    read -p "请设置Github仓库分支(默认:develop 回车):" git_branch
    read -p "请设置主机端口(默认:5700 回车):" panel_port
    read -p "请设置数据目录(默认:当前目录下 ql-data 回车):" data_path

    if [ -z "$maintainer" ]; then
        maintainer="icocoding"
    fi
    if [ -z "$git_branch" ]; then
        git_branch="develop"
    fi
    if [ -z "$panel_port" ]; then
        panel_port=5700
    fi
    if [ -z "$data_path" ]; then
        data_path="ql-data"
    fi

    echo -e "${yellow} Github: ${maintainer}/qinglong/${git_branch} ${plain}"
    echo -e "${yellow} 主机端口: $panel_port ${plain}"
    echo -e "${yellow} 数据目录: ${data_path} ${plain}"
    read -p "确认是否安装?[y/n]": config_confirm
    if [[ x"${config_confirm}" == x"y" || x"${config_confirm}" == x"Y" ]]; then
        echo -e "${green}开始安装...${plain}"
    else
        echo -e "${red}退出安装!${plain}"
        exit 1
    fi

    export maintainer=$maintainer
    export git_branch=$git_branch
    export panel_port=$panel_port
    export data_path=$data_path
}

function downloadDockerfile() {
    dockerfile="Dockerfile"
    if [ -e "$dockerfile" ]; then
        echo -e "${red}请删除Dockerfile再执行脚本${plain}"
        exit 1
    fi

    echo -e "${green}下载 ${maintainer} ${git_branch} Dockerfile ...${plain}"

    url="https://151.101.8.133:443/${maintainer}/qinglong/${git_branch}/docker/Dockerfile"
    
    wget --no-cache --header "Host: raw.githubusercontent.com" -N --no-check-certificate -O ${dockerfile} ${url}
    
    if [[ $? -ne 0 ]]; then
        echo -e "${red}下载 Dockerfile, 请确保你的服务器能够下载 Github 的文件${plain}"
        exit 1
    fi
}

install_qinglong() {

    if [[ -f "Dockerfile" ]]; then
        echo -e "${yellow}Dockerfile文件已存在${plain}"
    else
        echo -e "${green}开始下载docker file ...${plain}"
        downloadDockerfile
    fi

    echo -e "${green}build docker qinglong ...${plain}"
    
    latest_version=$(curl -Ls "https://api.github.com/repos/${maintainer}/qinglong/releases/latest" | grep '"tag_name":' | sed -E 's/.*"([^"]+)".*/\1/')
    echo -e "${green}最新版本: ${latest_version}${plain}"

    docker build --pull \
        --build-arg QL_MAINTAINER=${maintainer} \
        --build-arg QL_BRANCH=${git_branch} \
        --build-arg LATEST_VERSION=${latest_version} \
        -t ${maintainer}/qinglong .
    
    echo -e "${green}docker build success and run ...${plain}"

    if [ ! -d "$data_path" ]; then
        mkdir -p ${data_path}
    fi
    echo -e "${green}数据目录: ${data_path}${plain}"

    docker run -dit \
        --name qinglong \
        --hostname qinglong -p ${panel_port}:5700 \
        -v ${data_path}:/ql/data \
        --restart always ${maintainer}/qinglong

    echo -e "${green}success ${plain}"
    echo -e "${green}使用 docker logs -f qinglong 查看安装日志${plain}"
}



echo -e "${green}开始安装${plain}"
install_base
install_qinglong
