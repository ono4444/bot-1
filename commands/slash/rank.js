const { SlashCommandBuilder, AttachmentBuilder } = require('discord.js');
const UserXP = require('../../models/UserXP');
const buildRankCard = require('../../utils/rankCard');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('rank')
    .setDescription('بطاقة الرانك (XP الكتابي والصوتي)')
    .setDMPermission(false)
    .addUserOption(o => o.setName('user').setDescription('العضو (اتركه فاضي لنفسك)')),

  async execute(interaction) {
    await interaction.deferReply();
    try {
      const user = interaction.options.getUser('user') || interaction.user;
      const guildId = interaction.guild.id;

      const doc = (await UserXP.findOne({ guildId, userId: user.id })) || { textXp: 0, voiceXp: 0, totalVoiceMinutes: 0 };

      const byText = await UserXP.find({ guildId }).sort({ textXp: -1 });
      const byVoice = await UserXP.find({ guildId }).sort({ voiceXp: -1 });
      const textRank = byText.findIndex(u => u.userId === user.id) + 1 || 1;
      const voiceRank = byVoice.findIndex(u => u.userId === user.id) + 1 || 1;

      const buffer = await buildRankCard({
        username: user.username,
        avatarURL: user.displayAvatarURL({ extension: 'png', size: 512, forceStatic: true }),
        textXp: doc.textXp || 0,
        voiceXp: doc.voiceXp || 0,
        textRank,
        voiceRank,
        totalVoiceMinutes: Math.max(0, Number(doc.totalVoiceMinutes) || 0),
      });

      return interaction.editReply({ files: [new AttachmentBuilder(buffer, { name: 'rank.png' })] });
    } catch (err) {
      console.error('rank slash error:', err?.message || err);
      return interaction.editReply('❌ صار خطأ أثناء توليد البطاقة.');
    }
  },
};
