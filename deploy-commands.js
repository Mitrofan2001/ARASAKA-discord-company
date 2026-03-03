require("dotenv").config();
const { REST, Routes, SlashCommandBuilder } = require("discord.js");

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`缺少環境變數: ${name}`);
  }
  return value;
}

const commands = [
  new SlashCommandBuilder()
    .setName("proposal")
    .setDescription("讓七個角色討論你的提案")
    .addStringOption((o) =>
      o.setName("idea").setDescription("你的提案").setRequired(true)
    )
    .addIntegerOption((o) =>
      o
        .setName("rounds")
        .setDescription("討論輪數(1-3)")
        .setMinValue(1)
        .setMaxValue(3)
        .setRequired(false)
    ),
].map((c) => c.toJSON());

(async () => {
  const token = requireEnv("COMMAND_BOT_TOKEN");
  const appId = requireEnv("COMMAND_BOT_CLIENT_ID");
  const guildId = requireEnv("GUILD_ID");

  const rest = new REST({ version: "10" }).setToken(token);

  await rest.put(Routes.applicationGuildCommands(appId, guildId), {
    body: commands,
  });

  console.log("slash commands 已註冊");
})().catch((err) => {
  console.error("註冊指令失敗:", err);
  process.exitCode = 1;
});
