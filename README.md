### 起動
```
docker-compose up -d

# コンテナ内で
yarn dev
```

### ディレクトリ構成
```
/
├ app
│   ├ src
│   │   ├ public
│   │   │   ├ index.html
│   │   │   └ style.css
│   │   └ index.ts
│   ├ package.json
│   ├ tsconfig.json
│   └ yarn.lock
├ .gitignore
├ docker-compose.yml
├ Dockerfile
└ README.md
```