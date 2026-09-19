const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('userinfo')
    .setDescription('معلومات عضو')
    .setDMPermission(false)
    .addUserOption(o => o.setName('user').setDescription('العضو (اتركه فاضي لنفسك)')),

  async execute(interaction) {
    const user = interaction.options.getUser('user') || interaction.user;
    const member = await interaction.guild.members.fetch(user.id).catch(() => null);

    const created = Math.floor(user.createdTimestamp / 1000);
    const fields = [
      { name: 'الآيدي', value: user.id, inline: true },
      { name: 'أنشأ حسابه', value: `<t:${created}:R>`, inline: true },
    ];

    if (member) {
      const joined = Math.floor(member.joinedTimestamp / 1000);
      const roles = member.roles.cache.filter(r => r.id !== interaction.guild.id);
      fields.push(
        { name: 'دخل السيرفر', value: `<t:${joined}:R>`, inline: true },
        { name: 'أعلى رتبة', value: roles.size ? `${member.roles.highest}` : 'لا يوجد', inline: true },
        { name: `الرتب (${roles.size})`, value: roles.size ? roles.map(r => `${r}`).slice(0, 15).join(' ') : 'لا يوجد' },
      );
    }

    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setAuthor({ name: user.tag, iconURL: user.displayAvatarURL({ size: 128 }) })
      .setThumbnail(user.displayAvatarURL({ size: 256 }))
      .addFields(fields);

    return interaction.reply({ embeds: [embed] });
  },
};
