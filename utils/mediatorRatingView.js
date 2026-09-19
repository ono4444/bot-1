const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const MediatorRating = require('../models/MediatorRating');

const LB_PAGE_SIZE = 10;

function buildMediatorThanksDM(stars) {
  const n = Math.max(1, Math.min(5, Number(stars) || 1));
  return new EmbedBuilder()
    .setColor(0x00ff7f)
    .setTitle('شكراً على تقييمك!')
    .setDescription(`${'⭐'.repeat(n)}\nتم حفظ تقييمك بنجاح.`);
}

async function buildMediatorLeaderboardRows(guildId) {
  const agg = await MediatorRating.aggregate([
    { $match: { guildId } },
    { $group: { _id: '$mediatorId', total: { $sum: '$stars' }, count: { $sum: 1 } } }
  ]);
  return agg
    .map(r => ({ mediatorId: r._id, total: r.total, count: r.count, avg: r.count ? r.total / r.count : 0 }))
    .sort((a, b) => b.total - a.total || b.avg - a.avg);
}

function buildLeaderboardEmbed(rows, page, total) {
  const start = page * LB_PAGE_SIZE;
  const slice = rows.slice(start, start + LB_PAGE_SIZE);
  const lines = slice.map((r, i) =>
    `**${start + i + 1}.** <@${r.mediatorId}> — ${r.total} نقطة • ${r.avg.toFixed(2)}⭐ (${r.count} تقييم)`
  );
  return new EmbedBuilder()
    .setColor(0xffd700)
    .setTitle('🏆 لوحة نقاط الوسطاء')
    .setDescription(lines.join('\n') || 'لا توجد تقييمات بعد.')
    .setFooter({ text: `صفحة ${page + 1}/${Math.max(1, Math.ceil(total / LB_PAGE_SIZE))}` });
}

// customId: mpoints:<direction>:<currentPage>
function buildLeaderboardButtons(page, total) {
  const maxPage = Math.max(0, Math.ceil(total / LB_PAGE_SIZE) - 1);
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`mpoints:prev:${page}`).setLabel('◀️')
      .setStyle(ButtonStyle.Secondary).setDisabled(page <= 0),
    new ButtonBuilder().setCustomId(`mpoints:next:${page}`).setLabel('▶️')
      .setStyle(ButtonStyle.Secondary).setDisabled(page >= maxPage)
  );
}

module.exports = {
  buildMediatorThanksDM,
  buildLeaderboardEmbed,
  buildLeaderboardButtons,
  buildMediatorLeaderboardRows,
  LB_PAGE_SIZE
};
