require("dotenv").config();
const {
  Client,
  GatewayIntentBits,
} = require("discord.js");
const OpenAI = require("openai");

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`缺少環境變數: ${name}`);
  }
  return value;
}

const openai = new OpenAI({
  apiKey: requireEnv("OPENAI_API_KEY"),
});

const MODEL = process.env.OPENAI_MODEL || "gpt-4.1-mini";
const HISTORY_LIMIT = Number(process.env.MENTION_HISTORY_LIMIT || 20);

const AGENTS = [
  {
    key: "企劃",
    token: process.env.BOT_PLANNER_TOKEN,
    prompt: "你是企劃。給可執行方案：目標、里程碑、時程、風險。",
  },
  {
    key: "顧問",
    token: process.env.BOT_CONSULTANT_TOKEN,
    prompt: "你是顧問。做市場/競品分析，提出可驗證假設。",
  },
  {
    key: "法務",
    token: process.env.BOT_LEGAL_TOKEN,
    prompt: "你是法務。指出法遵風險與申請流程，提醒需找執業律師複核。",
  },
  {
    key: "財務",
    token: process.env.BOT_FINANCE_TOKEN,
    prompt: "你是財務。估成本、收入、現金流、損益平衡。",
  },
  {
    key: "行銷",
    token: process.env.BOT_MARKETING_TOKEN,
    prompt: "你是行銷。給受眾、渠道、內容節奏、KPI。",
  },
  {
    key: "美編",
    token: process.env.BOT_DESIGN_TOKEN,
    prompt: "你是美編。給品牌視覺、素材清單、簡報結構。",
  },
  {
    key: "Mentor",
    token: process.env.BOT_MENTOR_TOKEN,
    prompt: "你是 Mentor。整合各方意見，做優先順序和行動計畫。",
  },
];

function validateAgentTokens() {
  const missing = AGENTS.filter((a) => !a.token).map((a) => a.key);
  if (missing.length > 0) {
    throw new Error(`以下角色 token 未設定: ${missing.join(", ")}`);
  }
}

function makeClient() {
  return new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
    ],
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function chunk(text, size = 1700) {
  const out = [];
  for (let i = 0; i < text.length; i += size) {
    out.push(text.slice(i, i + size));
  }
  return out;
}

async function askRoundLLM(agentPrompt, idea, transcript, round) {
  const input = [
    { role: "system", content: `${agentPrompt} 全程用繁體中文，精簡且具體。` },
    {
      role: "user",
      content:
        `提案：${idea}\n` +
        `目前討論紀錄：\n${transcript}\n\n` +
        `你是第 ${round} 輪發言。請先回應別人的重點，再給你本輪建議（最多6點）。`,
    },
  ];

  const response = await openai.responses.create({
    model: MODEL,
    input,
  });

  return response.output_text?.trim() || "（無回覆）";
}

function stripBotMention(content, botUserId) {
  if (!content) return "";
  const mentionPattern = new RegExp(`<@!?${botUserId}>`, "g");
  return content.replace(mentionPattern, "").trim();
}

function formatMessageHistory(messages) {
  return messages
    .map((m) => {
      const sender = m.author?.bot ? `BOT:${m.author.username}` : `USER:${m.author.username}`;
      const text = (m.content || "").trim();
      const attachCount = m.attachments?.size || 0;
      const attachHint = attachCount > 0 ? `（附件 ${attachCount} 個）` : "";
      return `[${sender}] ${text || "（無文字）"}${attachHint}`;
    })
    .join("\n");
}

async function askMentionLLM(agent, historyText, userQuestion) {
  const input = [
    {
      role: "system",
      content:
        `${agent.prompt} 全程用繁體中文，精簡且具體。` +
        "回答前請先依角色立場進行推理，但只輸出結論與建議，不要輸出內部思考過程。",
    },
    {
      role: "user",
      content:
        `聊天室近期訊息：\n${historyText}\n\n` +
        `使用者問題：${userQuestion}\n\n` +
        "請先簡短點出你理解的上下文，再給具體建議（最多 6 點）。",
    },
  ];

  const response = await openai.responses.create({
    model: MODEL,
    input,
  });

  return response.output_text?.trim() || "（無回覆）";
}

async function safeAskRoundLLM(agent, idea, transcript, round) {
  try {
    return await askRoundLLM(agent.prompt, idea, transcript, round);
  } catch (err) {
    console.error(`[${agent.key}] LLM 呼叫失敗:`, err);
    return "（本輪回覆失敗，請稍後重試）";
  }
}

async function safeAskMentionLLM(agent, historyText, userQuestion) {
  try {
    return await askMentionLLM(agent, historyText, userQuestion);
  } catch (err) {
    console.error(`[${agent.key}] @提及回覆失敗:`, err);
    return "（回覆失敗，請稍後再試）";
  }
}

async function sendAsAgent(agent, channelId, content) {
  const ch = await agent.client.channels.fetch(channelId);
  if (!ch || !ch.isTextBased()) {
    throw new Error(`[${agent.key}] 目標頻道不存在或不可傳訊息`);
  }

  const parts = chunk(content);
  for (const part of parts) {
    await ch.send(part);
    await sleep(350);
  }
}

async function handleMentionMessage(agent, message) {
  if (!agent.client.user) return;
  if (message.author.bot) return;
  if (!message.mentions.users.has(agent.client.user.id)) return;

  const userQuestion = stripBotMention(message.content, agent.client.user.id) || "請根據以上討論回答。";

  const recent = await message.channel.messages.fetch({ limit: HISTORY_LIMIT });
  const ordered = [...recent.values()].sort((a, b) => a.createdTimestamp - b.createdTimestamp);
  const historyText = formatMessageHistory(ordered);

  const answer = await safeAskMentionLLM(agent, historyText, userQuestion);
  await sendAsAgent(agent, message.channelId, `【${agent.key}】\n${answer}`);
}

function setupMentionHandlers() {
  for (const agent of AGENTS) {
    agent.client.on("messageCreate", async (message) => {
      try {
        await handleMentionMessage(agent, message);
      } catch (err) {
        console.error(`[${agent.key}] messageCreate 處理失敗:`, err);
      }
    });
  }
}

function setupSlashCommandHandler(commandBot) {
  commandBot.client.on("interactionCreate", async (interaction) => {
    if (!interaction.isChatInputCommand()) return;
    if (interaction.commandName !== "proposal") return;

    await interaction.deferReply();

    const idea = interaction.options.getString("idea", true);
    const rounds = interaction.options.getInteger("rounds") || 2;
    const channelId = interaction.channelId;

    await interaction.editReply(`收到提案，開始 ${rounds} 輪討論：${idea}`);

    let transcript = `使用者提案：${idea}\n`;

    for (let round = 1; round <= rounds; round += 1) {
      for (const agent of AGENTS) {
        const answer = await safeAskRoundLLM(agent, idea, transcript, round);
        transcript += `\n[${agent.key} 第${round}輪]\n${answer}\n`;

        try {
          await sendAsAgent(agent, channelId, `【${agent.key}｜第${round}輪】\n${answer}`);
        } catch (err) {
          console.error(`[${agent.key}] 訊息送出失敗:`, err);
        }
      }
    }

    try {
      await sendAsAgent(commandBot, channelId, "討論結束。你可以再用 `/proposal` 開新一輪。");
    } catch (err) {
      console.error("結束訊息送出失敗:", err);
    }
  });
}

(async () => {
  validateAgentTokens();
  const commandToken = requireEnv("COMMAND_BOT_TOKEN");

  for (const agent of AGENTS) {
    agent.client = makeClient();
    await agent.client.login(agent.token);
    console.log(`${agent.key} 已上線`);
  }

  const commandBot = AGENTS.find((a) => a.token === commandToken);
  if (!commandBot) {
    throw new Error("COMMAND_BOT_TOKEN 未對應到 AGENTS 內任一 bot token");
  }

  setupMentionHandlers();
  setupSlashCommandHandler(commandBot);

  console.log(`Slash 指令由 ${commandBot.key} bot 接收`);
  console.log("系統就緒");
})().catch((err) => {
  console.error("啟動失敗:", err);
  process.exitCode = 1;
});
