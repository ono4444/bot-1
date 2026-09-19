const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ping')
    .setDescription('سرعة استجابة البوت'),

  async execute(interaction) {
    const sent = await interaction.reply({ content: '🏓 جاري القياس...', fetchReply: true });
    const latency = sent.createdTimestamp - interaction.createdTimestamp;
    await interaction.editReply(`🏓 Pong!\n• الرد: **${latency}ms**\n• الـ API: **${Math.round(interaction.client.ws.ping)}ms**`);
  },
};
