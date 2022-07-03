import express from "express";
import * as http from "http";
import * as socketio from "socket.io"
import Redis from "ioredis";
import moment from "moment";
import bodyParser from "body-parser";


// 環境変数
const redis_host = process.env.REDIS_HOST;
const redis_port = parseInt(process.env.REDIS_PORT || "6379", 10);

const app: express.Express = express();
const server: http.Server = new http.Server(app);
const io: socketio.Server = new socketio.Server(server);
const redis: Redis = new Redis({ host: redis_host, port: redis_port });
const subscribers: Record<string, Redis> = {};

(async () => {
  // POSTのリクエストボディ
  app.use(bodyParser.urlencoded({
    extended: true
  }));
  app.use(bodyParser.json());

  // publicフォルダに静的ファイルを格納
  app.use(express.static("src/public"));

  // 全てのkeyを取得
  const keys = await redis.keys("*");
  for (let i = 0; i < keys.length; i++) {
    await addSubscriber(keys[i]);
  }

  // Redis接続時の処理を登録
  io.on("connection", (socket: socketio.Socket) => {
    // クライアント側からのメッセージ送信を待ち受ける
    socket.on("send",  async (key: string, id: number, text: string) => {
      const date = moment.now();
      const message = JSON.stringify({
        id: id,
        text: text,
        date: date
      });
      await redis.zadd(key, date, message);
      await redis.publish(key, message);
    });

    // クライアント側からのチャットルーム作成を待ち受ける
    socket.on("create", async (key: string, id: number) => {
      const date = moment.now();
      const message = JSON.stringify({
        id: id,
        text: `NEW CHANNEL: ${key}`,
        date: date
      });
      await redis.zadd(key, moment.now(), message);
      await addSubscriber(key);
      io.emit("created", JSON.parse(message));
    });

    // クライアント側からのチャットルーム削除を待ち受ける
    socket.on("delete", async (key: string) => {
      subscribers[key].disconnect();
      delete subscribers[key];
      io.emit("deleted", key);
    });

    // クライアント側からのチャット履歴取得を待ち受ける
    socket.on("get", async (key: string) => {
      const result = await redis.zrange(key, 0, -1);
      const messages = result.map((msg) => JSON.parse(msg));
      io.emit("getted", messages);
    });
  });

  server.listen(3000, () => {
    console.log("listening on *:3000")
  })
})();

// subscriberを追加
async function addSubscriber(key: string) {
  const client = new Redis({ host: redis_host, port: redis_port });
  await client.subscribe();
  client.on("message", (_, msg) => {
    io.emit(key, JSON.parse(msg));
  });
  subscribers[key] = client;
}