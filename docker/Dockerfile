FROM python:3.11-alpine3.18 as builder
ARG QL_MAINTAINER="icocoding"
LABEL maintainer="${QL_MAINTAINER}"
ENV QL_MAINTAINER=${QL_MAINTAINER}
ARG QL_URL=https://github.com/${QL_MAINTAINER}/qinglong.git
ARG QL_BRANCH=develop
ENV QL_DIR=/ql
ARG BUILD_DIR=${QL_DIR}/.build
RUN set -x \
  && apk update -f \
  && apk upgrade \
  && apk --no-cache add -f bash \
  git \
  && git clone --depth=1 -b ${QL_BRANCH} ${QL_URL} ${BUILD_DIR} \
  && cd ${BUILD_DIR} \
  && cp -f .env.example .env

RUN set -x \
  && apk update \
  && apk add nodejs npm git \
  && npm i -g pnpm@8.3.1 pm2 tsx \
  && cd ${BUILD_DIR} \
  && pnpm install --prod


# 2

FROM python:3.11-alpine
ARG QL_MAINTAINER="icocoding"
LABEL maintainer="${QL_MAINTAINER}"
ARG QL_BRANCH=develop
ARG LATEST_VERSION='xxx'
ENV PNPM_HOME=/root/.local/share/pnpm \
  PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:/root/.local/share/pnpm:/root/.local/share/pnpm/global/5/node_modules:$PNPM_HOME \
  NODE_PATH=/usr/local/bin:/usr/local/pnpm-global/5/node_modules:/usr/local/lib/node_modules:/root/.local/share/pnpm/global/5/node_modules \
  LANG=C.UTF-8 \
  SHELL=/bin/bash \
  PS1="\u@\h:\w \$ " \
  QL_DIR=/ql \
  QL_BRANCH=${QL_BRANCH} \
  QL_MAINTAINER=${QL_MAINTAINER} \
  LATEST_VERSION=${LATEST_VERSION}

VOLUME /ql/data

ARG BUILD_DIR=${QL_DIR}/.build

EXPOSE 5700

COPY --from=builder /usr/local/lib/node_modules/. /usr/local/lib/node_modules/
COPY --from=builder /usr/local/bin/. /usr/local/bin/

RUN set -x \
  && apk update -f \
  && apk upgrade \
  && apk --no-cache add -f bash \
  coreutils \
  git \
  curl \
  wget \
  tzdata \
  perl \
  openssl \
  nginx \
  nodejs \
  jq \
  openssh \
  procps \
  netcat-openbsd \
  unzip \
  npm \
  && rm -rf /var/cache/apk/* \
  && apk update \
  && ln -sf /usr/share/zoneinfo/Asia/Shanghai /etc/localtime \
  && echo "Asia/Shanghai" > /etc/timezone \
  && git config --global user.email "qinglong@@users.noreply.github.com" \
  && git config --global user.name "qinglong" \
  && git config --global http.postBuffer 524288000 \
  && rm -rf /root/.pnpm-store \
  && rm -rf /root/.local/share/pnpm/store \
  && rm -rf /root/.cache \
  && ulimit -c 0

ARG SOURCE_COMMIT
COPY --from=builder ${BUILD_DIR}/. ${QL_DIR}/
RUN cd ${QL_DIR} \
  && chmod 777 ${QL_DIR}/shell/*.sh \
  && chmod 777 ${QL_DIR}/docker/*.sh \
  # && last_version=$(curl -Ls "https://api.github.com/repos/${QL_MAINTAINER}/qinglong/releases/latest" | grep '"tag_name":' | sed -E 's/.*"([^"]+)".*/\1/') \
  && wget -N --no-check-certificate -O qinglong_static.zip https://github.com/${QL_MAINTAINER}/qinglong/releases/download/${LATEST_VERSION}/qinglong_static.zip \
  && unzip -o qinglong_static.zip \
  && rm -f qinglong_static.zip

RUN bash -c 'cat ${QL_DIR}/.env'
RUN bash -c 'cat ${QL_DIR}/version.yaml'
WORKDIR ${QL_DIR}

HEALTHCHECK --interval=5s --timeout=2s --retries=20 \
  CMD curl -sf --noproxy '*' http://127.0.0.1:5400/api/health || exit 1

ENTRYPOINT ["./docker/docker-entrypoint.sh"]
