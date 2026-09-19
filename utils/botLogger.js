// يطبع في الكونسول، ويرسل لروم لو حطيت LOG_CHANNEL_ID.
const { EmbedBuilder } = require('discord.js');

async function logAction(client, info = {}) {
  try {
    const { action, userId, userTag, guildId, guildName, channelId, channelName, details } = info;
    console.log(`[LOG] ${action || 'action'} | ${userTag || userId} | ${guildName || guildId} | #${channelName || channelId}`);

    const logChannelId = process.env.LOG_CHANNEL_ID;
    if (!logChannelId || !client) return;
    const channel = client.channels.cache.get(logChannelId) || await client.channels.fetch(logChannelId).catch(() => null);
    if (!channel?.send) return;

    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle(String(action || 'Log').slice(0, 256))
      .addFields(
        { name: 'المستخدم', value: `<@${userId}> (${userTag || userId})`, inline: true },
        { name: 'الروم', value: channelId ? `<#${channelId}>` : '-', inline: true }
      )
      .setTimestamp();
    for (const [k, v] of Object.entries(details || {})) {
      embed.addFields({ name: String(k).slice(0, 256), value: String(v).slice(0, 1024) || '-' });
    }
    await channel.send({ embeds: [embed], allowedMentions: { parse: [] } });
  } catch (err) {
    console.error('logAction error:', err?.message || err);
  }
}

module.exports = { logAction };
