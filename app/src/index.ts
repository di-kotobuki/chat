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
  app.use(express.static("public"));

  // 全てのkeyを取得
  const keys = await redis.keys("*");
  for (let i = 0; i < keys.length; i++) {
    await addSubscriber(keys[i]);
  }

  // Redis接続時の処理を登録（接続後、クライアント側からのメッセージ送信を待ち受ける）
  io.on("connection", (socket: socketio.Socket) => {
    socket.on("send",  async (key: string, msg: string) => {
      await redis.zadd(key, moment.now(), msg);
      await redis.publish(key, msg);
    });
  });

  // チャンネル作成
  app.use("/channel/create", async (req, res) => {
    try {
      const { key, msg } = req.body;
      await redis.zadd(key, moment.now(), msg);
      await addSubscriber(key);
      await redis.publish(key, msg);
      res.send("create channel");
    } catch(err) {
      res.send(`Error: ${err}`);
    }
  });

  // チャンネル削除
  app.use("/channel/delete", (req, res) => {
    try {
      const { key } = req.body;
      subscribers[key].disconnect();
      delete subscribers[key];
      res.send("delete channel");
    } catch(err) {
      res.send(`Error: ${err}`);
    }
  });

  // 履歴取得
  app.use("/channel/history", async (req, res) => {
    try {
      const { key } = req.body;
      const result = await redis.zrange(key, -1000, -1);
      res.send(result);
    } catch(err) {
      res.send(`Error: ${err}`);
    }
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
    io.emit(key, msg);
  });
  subscribers[key] = client;
}