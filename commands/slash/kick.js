const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('kick')
    .setDescription('طرد عضو')
    .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers)
    .setDMPermission(false)
    .addUserOption(o => o.setName('user').setDescription('العضو').setRequired(true))
    .addStringOption(o => o.setName('reason').setDescription('السبب')),

  async execute(interaction) {
    const target = interaction.options.getMember('user');
    const reason = interaction.options.getString('reason') || 'بدون سبب';

    if (!target) return interaction.reply({ content: '❌ العضو مو موجود في السيرفر.', ephemeral: true });
    if (target.id === interaction.user.id) return interaction.reply({ content: '❌ ما تقدر تطرد نفسك.', ephemeral: true });
    if (target.roles.highest.position >= interaction.member.roles.highest.position && interaction.guild.ownerId !== interaction.user.id) {
      return interaction.reply({ content: '❌ رتبته أعلى منك أو تساوي رتبتك.', ephemeral: true });
    }
    if (!target.kickable) return interaction.reply({ content: '❌ ما أقدر أطرده (رتبته أعلى من البوت).', ephemeral: true });

    try {
      await target.kick(`${reason} | بواسطة ${interaction.user.tag}`);
      return interaction.reply({ content: `👢 تم طرد **${target.user.tag}**.\n**السبب:** ${reason}` });
    } catch (err) {
      console.error('kick error:', err?.message || err);
      return interaction.reply({ content: '❌ صار خطأ أثناء الطرد.', ephemeral: true });
    }
  },
};
