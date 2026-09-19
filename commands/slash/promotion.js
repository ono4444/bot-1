const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('promotion')
    .setDescription('نظام الترقيات (نسخة مبسّطة)')
    .setDMPermission(false),

  async execute(interaction) {
    return interaction.reply({ content: 'ℹ️ نظام الترقيات غير مفعّل بعد في هذه النسخة.', ephemeral: true });
  },

  // أزرار promo_approve:* / promo_reject:* تستدعيها interactionCreate
  async handleButton(interaction) {
    const approve = interaction.customId.startsWith('promo_approve:');
    return interaction.reply({
      content: approve ? '✅ تمت الموافقة.' : '❌ تم الرفض.',
      ephemeral: true,
    });
  },
};
