const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('say')
    .setDescription('يرسل البوت رسالة')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .setDMPermission(false)
    .addStringOption(o => o.setName('message').setDescription('نص الرسالة').setRequired(true))
    .addChannelOption(o =>
      o.setName('channel')
        .setDescription('الروم (اتركه فاضي للروم الحالي)')
        .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
    ),

  async execute(interaction) {
    const text = interaction.options.getString('message');
    const channel = interaction.options.getChannel('channel') || interaction.channel;

    try {
      // parse: [] يمنع المنشنات (everyone/here/الرتب) عشان ما يُستغل الأمر
      await channel.send({ content: text, allowedMentions: { parse: [] } });
      return interaction.reply({ content: `✅ تم الإرسال في ${channel}.`, ephemeral: true });
    } catch (err) {
      console.error('say error:', err?.message || err);
      return interaction.reply({ content: '❌ ما قدرت أرسل في هذا الروم.', ephemeral: true });
    }
  },
};
