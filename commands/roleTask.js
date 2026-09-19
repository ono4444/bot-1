// نظام مهام الرتب (اختبار الإداري) — نسخة مبسّطة.
const { EmbedBuilder } = require('discord.js');

const activeTasks = new Map();

async function updateTaskPanel(userId, gainedXp, requiredXp, endTime, dmMessage, guildName, guildIconURL, opts = {}) {
  try {
    if (!dmMessage?.edit) return;
    const pct = requiredXp ? Math.min(100, Math.floor((gainedXp / requiredXp) * 100)) : 0;
    const embed = new EmbedBuilder()
      .setColor(opts.boostActive ? 0xffd700 : 0x5865f2)
      .setTitle(`📋 مهمة: ${opts.taskName || 'المهمة'}`)
      .setDescription([
        `**التقدم:** ${gainedXp}/${requiredXp} XP (${pct}%)`,
        `**ينتهي:** <t:${Math.floor(endTime / 1000)}:R>`,
        opts.boostActive && opts.boostEndsAt ? `**⚡ دبل XP ينتهي:** <t:${Math.floor(opts.boostEndsAt / 1000)}:R>` : null
      ].filter(Boolean).join('\n'))
      .setFooter({ text: guildName || '', iconURL: guildIconURL || undefined });
    await dmMessage.edit({ embeds: [embed] });
  } catch {}
}

async function execute(message /*, args */) {
  await message.reply({
    content: 'ℹ️ أمر المهام غير مفعّل في هذه النسخة، أضف منطقه في commands/roleTask.js',
    allowedMentions: { repliedUser: false }
  }).catch(() => {});
}

module.exports = { activeTasks, updateTaskPanel, execute };
