const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

const PAGE_SIZE = 20;
const PERIOD_LABELS = { day: 'اليوم', week: 'الأسبوع', month: 'الشهر', all: 'الكل' };

function buildTicketStatsEmbed(user, claims, page, period, total) {
  const start = page * PAGE_SIZE;
  const slice = claims.slice(start, start + PAGE_SIZE);
  const lines = slice.map((c, i) => {
    const t = Math.floor(new Date(c.claimedAt).getTime() / 1000);
    return `**${start + i + 1}.** <#${c.channelId}> — <t:${t}:R>`;
  });
  return new EmbedBuilder()
    .setColor(0x2b2d31)
    .setAuthor({ name: `إحصائيات تكتات ${user.username}`, iconURL: user.displayAvatarURL({ size: 128 }) })
    .setDescription(lines.join('\n') || 'لا توجد تكتات.')
    .setFooter({ text: `الفترة: ${PERIOD_LABELS[period] || 'الكل'} • الإجمالي: ${total} • صفحة ${page + 1}/${Math.max(1, Math.ceil(total / PAGE_SIZE))}` });
}

// customId: tstats:<direction>:<userId>:<period>:<currentPage>
function buildTicketStatsButtons(page, total, userId, period) {
  const maxPage = Math.max(0, Math.ceil(total / PAGE_SIZE) - 1);
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`tstats:prev:${userId}:${period}:${page}`)
      .setLabel('◀️').setStyle(ButtonStyle.Secondary).setDisabled(page <= 0),
    new ButtonBuilder().setCustomId(`tstats:next:${userId}:${period}:${page}`)
      .setLabel('▶️').setStyle(ButtonStyle.Secondary).setDisabled(page >= maxPage)
  );
}

module.exports = { buildTicketStatsEmbed, buildTicketStatsButtons };
