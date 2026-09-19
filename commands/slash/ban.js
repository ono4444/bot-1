const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ban')
    .setDescription('حظر عضو')
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
    .setDMPermission(false)
    .addUserOption(o => o.setName('user').setDescription('العضو').setRequired(true))
    .addStringOption(o => o.setName('reason').setDescription('السبب'))
    .addIntegerOption(o =>
      o.setName('delete_days')
        .setDescription('حذف رسائله لآخر كم يوم (0 - 7)')
        .setMinValue(0)
        .setMaxValue(7)
    ),

  async execute(interaction) {
    const user = interaction.options.getUser('user');
    const target = interaction.options.getMember('user');
    const reason = interaction.options.getString('reason') || 'بدون سبب';
    const deleteDays = interaction.options.getInteger('delete_days') || 0;

    if (user.id === interaction.user.id) return interaction.reply({ content: '❌ ما تقدر تحظر نفسك.', ephemeral: true });

    if (target) {
      if (target.roles.highest.position >= interaction.member.roles.highest.position && interaction.guild.ownerId !== interaction.user.id) {
        return interaction.reply({ content: '❌ رتبته أعلى منك أو تساوي رتبتك.', ephemeral: true });
      }
      if (!target.bannable) return interaction.reply({ content: '❌ ما أقدر أحظره (رتبته أعلى من البوت).', ephemeral: true });
    }

    try {
      await interaction.guild.members.ban(user.id, {
        reason: `${reason} | بواسطة ${interaction.user.tag}`,
        deleteMessageSeconds: deleteDays * 86400,
      });
      return interaction.reply({ content: `🔨 تم حظر **${user.tag}**.\n**السبب:** ${reason}` });
    } catch (err) {
      console.error('ban error:', err?.message || err);
      return interaction.reply({ content: '❌ صار خطأ أثناء الحظر.', ephemeral: true });
    }
  },
};
