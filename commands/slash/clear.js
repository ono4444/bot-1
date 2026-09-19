const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('clear')
    .setDescription('حذف عدد من الرسائل')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .setDMPermission(false)
    .addIntegerOption(o =>
      o.setName('amount')
        .setDescription('عدد الرسائل (1 - 100)')
        .setMinValue(1)
        .setMaxValue(100)
        .setRequired(true)
    ),

  async execute(interaction) {
    const amount = interaction.options.getInteger('amount');
    await interaction.deferReply({ ephemeral: true });

    try {
      // الرسائل الأقدم من 14 يوم ما تنحذف بشكل جماعي (قيد من ديسكورد)
      const deleted = await interaction.channel.bulkDelete(amount, true);
      return interaction.editReply(`🧹 تم حذف **${deleted.size}** رسالة.`);
    } catch (err) {
      console.error('clear error:', err?.message || err);
      return interaction.editReply('❌ ما قدرت أحذف الرسائل، تأكد من صلاحيات البوت (Manage Messages).');
    }
  },
};
