const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('avatar')
    .setDescription('عرض صورة عضو')
    .addUserOption(o => o.setName('user').setDescription('العضو (اتركه فاضي لصورتك)')),

  async execute(interaction) {
    const user = interaction.options.getUser('user') || interaction.user;
    const url = user.displayAvatarURL({ size: 1024, extension: 'png' });

    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle(`صورة ${user.username}`)
      .setImage(url)
      .setURL(url);

    return interaction.reply({ embeds: [embed] });
  },
};
