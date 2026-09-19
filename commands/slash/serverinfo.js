const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('serverinfo')
    .setDescription('معلومات السيرفر')
    .setDMPermission(false),

  async execute(interaction) {
    const g = interaction.guild;
    const created = Math.floor(g.createdTimestamp / 1000);

    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle(g.name)
      .setThumbnail(g.iconURL({ size: 256 }))
      .addFields(
        { name: 'المالك', value: `<@${g.ownerId}>`, inline: true },
        { name: 'الأعضاء', value: `${g.memberCount}`, inline: true },
        { name: 'الرتب', value: `${g.roles.cache.size}`, inline: true },
        { name: 'الرومات', value: `${g.channels.cache.size}`, inline: true },
        { name: 'البوست', value: `${g.premiumSubscriptionCount || 0} (لفل ${g.premiumTier})`, inline: true },
        { name: 'تاريخ الإنشاء', value: `<t:${created}:R>`, inline: true },
      )
      .setFooter({ text: `ID: ${g.id}` });

    return interaction.reply({ embeds: [embed] });
  },
};
