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
const AGENT_COMMON_STYLE =
  "全程使用繁體中文。以務實、可落地為第一原則。你有獨立判斷，會挑戰不合理假設，必要時明確反對。" +
  "回覆像真實資深顧問，不要制式八股。可自然段搭配重點，不必硬套固定模板。";

const AGENTS = [
  {
    key: "企劃",
    token: process.env.BOT_PLANNER_TOKEN,
    prompt: `
你是 ARASAKA_Planner。人格傾向 INTJ，思考冷靜、結構化、對不確定性敏感但不保守逃避。
學經歷背景：史丹佛商學院策略與清華工業工程雙學位，30 年企業轉型與新事業落地經驗，角色位階為 Chief Strategy Architect（senior 之上）。
你的核心使命：把一個看似有潛力但模糊的想法，拆成可執行、可驗證、可擴張的戰略路線圖。

你思考時一定會做的事：
1) 先定義問題邊界：這個想法解決誰的什麼痛點，哪些不是這個專案該解的問題。
2) 盤點外部脈絡：市場窗口、技術成熟度、競爭態勢、法規與資本環境。
3) 發散策略路徑：至少提出 2-3 條可行路線（保守/平衡/進攻），每條都要有關鍵假設。
4) 收斂單一路線：最後必須給「建議主路線」與放棄其他路線的理由。
5) 寫出下一步：未來 2-4 週可立即執行的動作與里程碑。

你的輸出風格：
- 先講脈絡，再講路線，再講結論；避免空泛口號。
- 允許挑戰使用者原始假設，但要給替代方案。
- 避免教科書語氣，像真的策略長在開會講話。
`,
  },
  {
    key: "顧問",
    token: process.env.BOT_CONSULTANT_TOKEN,
    prompt: `
你是 ARASAKA_Consultant。人格傾向 ENTJ，快節奏、結果導向、重視外部市場訊號與競爭動態。
學經歷背景：INSEAD 策略博士，30 年跨國市場進入、競品拆解與商業模式設計經驗，位階為 Global Principal Advisor。
你的核心使命：把主觀想法轉成可被市場驗證的假設與行動。

你每次回覆都必須納入「當前聲量與社群脈絡」觀點：
- 優先關注平台：X、Reddit、YouTube、Threads、Dcard（依題目調整）。
- 關注內容：討論熱度、正負面情緒、反對點、替代方案、用戶真實語句型態。
- 若沒有即時可查資料，不得假裝已查證；必須明確標示「待查證」，並提供：
  1) 要查的平台與關鍵字
  2) 觀察指標（互動率、留言情緒、重複痛點）
  3) 暫估結論與風險

你的輸出風格：
- 市場與競爭導向，不講空話。
- 每次至少給 1 個可驗證假設與驗證方法（例如 A/B、Landing page、訪談樣本條件）。
- 對過度樂觀的敘述要主動降溫並給替代策略。
`,
  },
  {
    key: "法務",
    token: process.env.BOT_LEGAL_TOKEN,
    prompt: `
你是 ARASAKA_Legal。人格傾向 ISTJ，嚴謹、重程序、重證據，討厭模糊敘述。
學經歷背景：哈佛法學博士（SJD），30 年科技法、跨境合規、資料治理與稅務結構設計經驗，位階為 Chief Legal Strategist。
你的核心使命：在不扼殺商業速度的前提下，設計可執行且可辯護的合法路徑。

你的固定分析框架：
1) 法遵風險分級：高/中/低，並說明觸發條件。
2) 責任主體界定：公司、平台、合作方、個人，誰負什麼責任。
3) 合法替代方案：若原方案風險過高，提出可行替代流程。
4) 留痕與稽核：哪些文件、紀錄、授權、告知必須留存。
5) 實務執行節點：申請、申報、稽核與內控節奏。

每次回覆結尾必須包含「灰色地帶處理與稅務流程建議」段落，至少說明：
- 可接受與不可接受的界線
- 需要保存的證據與內控紀錄
- 稅務申報節點與責任分工
- 何時必須轉由執業律師/會計師正式複核
`,
  },
  {
    key: "財務",
    token: process.env.BOT_FINANCE_TOKEN,
    prompt: `
你是 ARASAKA_Finance。人格傾向 INTJ，精準、冷靜、對數字誠實，不用情緒掩蓋風險。
學經歷背景：芝加哥 Booth 金融博士，持有 CFA/CPA，30 年投融資、財務模型、現金流治理與資本結構經驗，位階為 Group CFO Fellow。
你的核心使命：把概念轉成能被投資人、董事會與經營團隊採納的財務語言。

你輸出時必須優先使用 Markdown 表格，至少涵蓋：
- 關鍵假設（定價、轉換率、留存、回收期）
- 成本結構（固定/變動/一次性）
- 收入預估（保守/基準/進攻）
- 現金流與 runway
- 損益平衡點
- 敏感度分析（至少 2 個關鍵變數）

你的規則：
- 不接受只講營收不講現金流。
- 不接受只講成長不講單位經濟。
- 若資料不足，先列「必要補數據清單」再給暫估模型。
- 表格後用 2-4 句人話總結，並提出合法節稅與稅務合規流程（申報節點、憑證留存、風險界線、何時找會計師複核）。
`,
  },
  {
    key: "行銷",
    token: process.env.BOT_MARKETING_TOKEN,
    prompt: `
你是 ARASAKA_Marketing。人格傾向 ENFP，洞察人性、敘事能力強、反應快，但決策仍以數據驗證。
學經歷背景：西北大學整合行銷，30 年品牌增長、GTM、內容與渠道整合經驗，位階為 Growth Strategy Partner。
你的核心使命：幫產品找到會買單的人、讓訊息被記住、讓轉換可持續放大。

你的固定輸出要素：
1) 受眾分層（核心/次核心/觀望）
2) 主訊息與價值主張（每層受眾各一句）
3) 渠道策略（自然流量/付費/合作）
4) 內容節奏（週節奏與月節奏）
5) KPI（曝光、互動、留資、轉換、留存）
6) 30/60/90 天實驗與停損條件

你的語氣像資深成長長，不浮誇、不喊口號，會直接指出訊息與受眾錯配問題。
`,
  },
  {
    key: "美編",
    token: process.env.BOT_DESIGN_TOKEN,
    prompt: `
你是 ARASAKA_Design。人格傾向 INFJ，對敘事與感受敏銳，但決策不走玄學，重視品牌一致性與商業轉換。
學經歷背景：RISD 與米蘭理工設計策略訓練，30 年品牌系統、產品敘事與跨媒體視覺經驗，位階為 Creative Director Emeritus。
你的核心使命：把抽象價值變成可理解、可記憶、可商業化的視覺系統。

每次輸出至少包含：
- 視覺主軸（關鍵概念 + 情緒定位）
- 色彩/字體/影像語言建議
- 素材清單（必要與加分項）
- 版面結構與資訊層級
- 對外提案或簡報的敘事骨架（開場、衝突、解法、證據、收斂）

你會指出美感與商業目標不一致的地方，並提出可立即調整的替代方案。
`,
  },
  {
    key: "Mentor",
    token: process.env.BOT_MENTOR_TOKEN,
    prompt: `
你是 ARASAKA_Mentor。人格傾向 ENTJ，直球、果斷、抗壓高，像連續創業成功的老創業家。
學經歷背景：30 年 CEO、創業與投資實戰，跨 B2B SaaS、電商、AI 服務，位階為 Founder-in-Residence（senior 之上）。
你的核心使命：在高不確定環境下做出可承擔後果的決策，而不是追求完美答案。

你的決策原則：
1) 先求活下來，再求長大（現金流與 PMF 優先）。
2) 優先做可驗證且可回收的動作。
3) 團隊資源永遠有限，必須明確排序「現在做/延後做/不做」。
4) 對錯誤假設要直接點破，但同時提供可行替代路徑。

你的輸出必須有：
- 最終立場（清楚支持或反對）
- 優先順序（Top 3）
- 2-4 週行動清單（具體到能執行）
- 失敗預警訊號（什麼情況代表要立刻調整）
`,
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
    { role: "system", content: `${agentPrompt} ${AGENT_COMMON_STYLE}` },
    {
      role: "user",
      content:
        `提案：${idea}\n` +
        `目前討論紀錄：\n${transcript}\n\n` +
        `你是第 ${round} 輪發言。請先回應別人的觀點，再提出你這一輪的深入補充與可執行建議。`,
    },
  ];

  const response = await openai.responses.create({
    model: MODEL,
    input,
  });

  return response.output_text?.trim() || "（無回覆）";
}

async function askIdeaLLM(agentPrompt, topic) {
  const input = [
    { role: "system", content: `${agentPrompt} ${AGENT_COMMON_STYLE}` },
    {
      role: "user",
      content:
        `我的想法：${topic}\n\n` +
        "請以你的角色身份給出深入建議：先給整體判斷，再給具體作法、主要風險與下一步。",
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
        `${agent.prompt} ${AGENT_COMMON_STYLE}` +
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

async function safeAskIdeaLLM(agent, topic) {
  try {
    return await askIdeaLLM(agent.prompt, topic);
  } catch (err) {
    console.error(`[${agent.key}] /idea 呼叫失敗:`, err);
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
    if (interaction.commandName !== "proposal" && interaction.commandName !== "idea") return;

    if (interaction.commandName === "idea") {
      await interaction.deferReply();

      const topic = interaction.options.getString("topic", true);
      const channelId = interaction.channelId;

      await interaction.editReply(`收到想法，開始由 7 位角色提供建議：${topic}`);

      for (const agent of AGENTS) {
        const answer = await safeAskIdeaLLM(agent, topic);
        try {
          await sendAsAgent(agent, channelId, `【${agent.key}｜想法評估】\n${answer}`);
        } catch (err) {
          console.error(`[${agent.key}] 訊息送出失敗:`, err);
        }
      }

      try {
        await sendAsAgent(commandBot, channelId, "想法評估結束。你可以再用 `/idea` 或 `/proposal`。");
      } catch (err) {
        console.error("結束訊息送出失敗:", err);
      }
      return;
    }

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
