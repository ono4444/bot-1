const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const Warning = require('../../models/Warning');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('warnings')
    .setDescription('عرض تحذيرات عضو')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .setDMPermission(false)
    .addUserOption(o => o.setName('user').setDescription('العضو').setRequired(true)),

  async execute(interaction) {
    const user = interaction.options.getUser('user');
    const doc = await Warning.findOne({ guildId: interaction.guild.id, userId: user.id });

    if (!doc || !doc.total) {
      return interaction.reply({ content: `✅ لا توجد تحذيرات على <@${user.id}>.`, ephemeral: true });
    }

    const last = [...doc.infractions].slice(-10).reverse();
    const lines = last.map(inf => {
      const t = Math.floor(new Date(inf.createdAt).getTime() / 1000);
      return `**• ${inf.caseId}** — <t:${t}:R>\nبواسطة <@${inf.moderatorId}>\nالسبب: ${inf.reason}`;
    });

    const embed = new EmbedBuilder()
      .setColor(0xff0000)
      .setAuthor({ name: `تحذيرات ${user.tag}`, iconURL: user.displayAvatarURL({ size: 128 }) })
      .setDescription(lines.join('\n\n'))
      .setFooter({ text: `الإجمالي: ${doc.total}` });

    return interaction.reply({ embeds: [embed], ephemeral: true });
  },
};
