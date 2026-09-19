// أزرار الموافقة/الرفض على الترقية (promo_approve:* / promo_reject:*)
module.exports = {
  async handleButton(interaction) {
    const approve = interaction.customId.startsWith('promo_approve:');
    await interaction.reply({
      content: approve ? '✅ تمت الموافقة (نسخة مبسّطة، لا تنفّذ ترقية تلقائية).' : '❌ تم الرفض.',
      ephemeral: true
    });
  }
};
