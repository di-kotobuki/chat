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
  // publicフォルダに静的ファイルを格納
  app.use(express.static("src/public"));

  // POSTのリクエストボディ
  app.use(bodyParser.urlencoded({
    extended: true
  }));
  app.use(bodyParser.json());

  // 全てのkeyを取得
  const keys = await redis.keys("*");
  for (let i = 0; i < keys.length; i++) {
    await addSubscriber(keys[i]);
  }

  // チャットルーム作成
  app.use("/create", async (req, res) => {
    const { key, id } = req.body;
    const date = moment.now();
    const message = { id: id, text: `NEW CHANNEL: ${key}`, date: date };
    await redis.zadd(key, moment.now(), JSON.stringify(message));
    await addSubscriber(key);
    res.send({ name: key, messages: [message] });
  });

  // チャットルーム閉鎖
  app.use("/delete", async (req, res) => {
    const { key } = req.body;
    subscribers[key].disconnect();
    delete subscribers[key];
    res.send("ok");
  });

  // チャットルーム取得
  app.use("/get", async (req, res) => {
    const keys = await redis.keys("*");
    const rooms = [];
    for (let i = 0; i < keys.length; i++) {
      const result = await redis.zrange(keys[i], 0, -1);
      const room = {
        name: keys[i],
        messages: result.map((msg) => JSON.parse(msg))
      }
      rooms.push(room);
    }
    res.send(rooms);
  })

  // Redis接続時の処理を登録
  io.on("connection", (socket: socketio.Socket) => {
    // クライアント側からのメッセージ送信を待ち受ける
    // クライアント側: socket.emit("send", { key: channel, id: id, text: text })
    socket.on("send", async (data) => {
      const date = moment.now();
      const message = JSON.stringify({
        id: data.id,
        text: data.text,
        date: date
      });
      await redis.zadd(data.key, date, message);
      await redis.publish(data.key, message);
      console.log(`メッセージ送信: ${message}`);
    });
  });

  server.listen(3000, () => {
    console.log("listening on *:3000")
  })
})();

// subscriberを追加
async function addSubscriber(key: string) {
  const client = new Redis({ host: redis_host, port: redis_port });
  await client.subscribe(key);
  client.on("message", (_, msg) => {
    // クライアント側: socket.on(room_name, (message) => {})
    io.emit(key, JSON.parse(msg));
    console.log(`メッセージ転送: ${msg}`);
  });
  subscribers[key] = client;
}
