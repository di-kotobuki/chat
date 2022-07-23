FROM node:16-alpine

RUN apk update && apk add --no-cache libc6-compat && ln -s /lib/libc.musl-x86_64.so.1 /lib/ld-linux-x86-64.so.2

WORKDIR /usr/src/app
COPY ./app/package.json ./app/yarn.lock ./
RUN yarn install

COPY ./app ./

EXPOSE 3000