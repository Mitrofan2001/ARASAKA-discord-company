# discord-7-bots

7 個 Discord Bot 帳號在同一頻道輪流討論提案，由 Mentor bot 接收 `/proposal` 指令並協調發言。

## Railway 一鍵部署（電腦可關機）

### 1) 上傳到 GitHub

把這個專案推到你的 GitHub repository。

### 2) 在 Railway 建立專案

1. 開 [Railway](https://railway.app/) -> `New Project`
2. 選 `Deploy from GitHub repo`
3. 選你的 `discord-7-bots` repo
4. Railway 會自動使用專案內的 `railway.json` + `Dockerfile`

### 3) 設定環境變數（Railway Variables）

把以下全部加進 Railway：

- `OPENAI_API_KEY`
- `OPENAI_MODEL`（可選，預設 `gpt-4.1-mini`）
- `COMMAND_BOT_TOKEN`
- `COMMAND_BOT_CLIENT_ID`
- `GUILD_ID`
- `BOT_PLANNER_TOKEN`
- `BOT_CONSULTANT_TOKEN`
- `BOT_LEGAL_TOKEN`
- `BOT_FINANCE_TOKEN`
- `BOT_MARKETING_TOKEN`
- `BOT_DESIGN_TOKEN`
- `BOT_MENTOR_TOKEN`

### 4) 註冊 slash command（只要做一次）

在 Railway 服務裡打開 `Shell` 後執行：

```bash
npm run deploy
```

看到 `slash commands 已註冊` 即完成。

### 5) 確認服務啟動

Railway Logs 看到 `系統就緒`，就代表 7 隻 bot 已上線。

### 6) 在 Discord 觸發

```text
/proposal idea:我想做AI創業社群 rounds:2
```

`rounds` 可省略，預設 2（範圍 1-3）。

## 自訂每個 AI 的個性與資歷（重點）

請修改 [index.js](/Users/mitrofan.tw/Side project/discord-7-bots/index.js) 內的 `AGENTS` 陣列，每個角色都有自己的 `prompt`：

```js
const AGENTS = [
  {
    key: "企劃",
    token: process.env.BOT_PLANNER_TOKEN,
    prompt: "你是企劃。給可執行方案：目標、里程碑、時程、風險。",
  },
  // ...
];
```

你可以直接把每個角色改成不同背景，例如：
- 年資（例：`10 年 SaaS 產品策略經驗`）
- 個性（例：`保守、風險優先` 或 `激進、成長優先`）
- 回覆格式（例：`每次固定 4 點，最後給 1 個反對意見`）
- 專長領域（例：`B2B、跨境電商、醫療法規`）

只要改 `prompt` 內容，不需要改其他程式碼。

## 本機執行（開發用）

1. 建 `.env`

```bash
cp .env.example .env
```

2. 註冊指令

```bash
npm run deploy
```

3. 啟動

```bash
npm start
```
