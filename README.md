# discord-7-bots

7 個 Discord Bot 帳號在同一頻道輪流討論提案，並支援 `@某一隻 bot` 讓該角色讀取聊天室近期訊息後回答。

## 功能

- `/proposal`: 7 角色輪流討論（1-3 輪）
- `@ARASAKA_Planner ...`: 被 tag 的那隻 bot 會讀最近訊息並以該角色身份回答

## 重要前置（Discord Developer Portal）

7 個 bot 都要開啟：
- `MESSAGE CONTENT INTENT`（Bot 頁面）

7 個 bot 進伺服器都要有：
- `View Channels`
- `Send Messages`
- `Read Message History`

## Railway 一鍵部署（電腦可關機）

### 1) 上傳到 GitHub

把這個專案推到你的 GitHub repository。

### 2) 在 Railway 建立專案

1. 開 [Railway](https://railway.app/) -> `New Project`
2. 選 `Deploy from GitHub repo`
3. 選你的 repo
4. Railway 會自動使用專案內的 `railway.json` + `Dockerfile`

### 3) 設定環境變數（Railway Variables）

完整清單在 [.env.example](/Users/mitrofan.tw/Side project/discord-7-bots/.env.example)。

重點：
- `OPENAI_API_KEY` 是 OpenAI 的
- `BOT_*_TOKEN` 是 7 隻 Discord bot token（共 7 個不同 token）
- `COMMAND_BOT_TOKEN` 可指定你要接 `/proposal` 的 bot（例如 Planner）
- `COMMAND_BOT_CLIENT_ID` 要對應同一隻 bot 的 Application ID

### 4) 註冊 slash command（只要做一次）

在 Railway 服務裡打開 `Shell` 後執行：

```bash
npm run deploy
```

看到 `slash commands 已註冊` 即完成。

### 5) 確認服務啟動

Railway Logs 看到 `系統就緒` 即代表 bot 已上線。

## 使用方式

### A) 7 角色討論

```text
/proposal idea:我想做AI創業社群 rounds:2
```

### B) 指定單一角色回覆

```text
@ARASAKA_Planner 請根據上面討論，幫我列下週執行計畫
```

被 tag 的 bot 會：
- 讀取該頻道最近 `MENTION_HISTORY_LIMIT` 則訊息
- 套用自己的角色 `prompt`
- 回覆精簡建議

## 自訂每個 AI 的個性與資歷

修改 [index.js](/Users/mitrofan.tw/Side project/discord-7-bots/index.js) 內 `AGENTS` 陣列的 `prompt`：

```js
const AGENTS = [
  {
    key: "企劃",
    token: process.env.BOT_PLANNER_TOKEN,
    prompt: "你是企劃，12 年 B2B SaaS 經驗，風格務實保守...",
  },
];
```

你可在 prompt 裡定義：
- 年資與背景
- 語氣個性
- 決策偏好（保守/成長）
- 回覆格式

## 本機執行（開發用）

```bash
cp .env.example .env
npm run deploy
npm start
```
