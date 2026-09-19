// بطاقة الرانك (PNG). تحتاج @napi-rs/canvas
const xpRequiredToLevelUp = lv => Math.floor(110 + 2.9 * (Math.max(1, Number(lv) || 0) ** 2));

function progress(totalXp) {
  let xp = Math.max(0, Number(totalXp) || 0);
  let level = 0;
  for (let i = 0; i < 5000; i++) {
    const need = xpRequiredToLevelUp(level);
    if (xp < need) return { level, current: xp, need };
    xp -= need; level++;
  }
  return { level, current: 0, need: xpRequiredToLevelUp(level) };
}

function bar(ctx, x, y, w, h, ratio, color) {
  ctx.fillStyle = '#2b2d31';
  ctx.beginPath(); ctx.roundRect(x, y, w, h, h / 2); ctx.fill();
  if (ratio > 0) {
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.roundRect(x, y, Math.max(h, w * Math.min(1, ratio)), h, h / 2); ctx.fill();
  }
}

async function buildRankCard({ username, avatarURL, textXp = 0, voiceXp = 0, textRank = 1, voiceRank = 1, totalVoiceMinutes = 0 }) {
  const { createCanvas, loadImage } = require('@napi-rs/canvas');
  const W = 900, H = 300;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#1e1f22';
  ctx.beginPath(); ctx.roundRect(0, 0, W, H, 24); ctx.fill();

  try {
    const img = await loadImage(avatarURL);
    ctx.save();
    ctx.beginPath(); ctx.arc(120, 150, 80, 0, Math.PI * 2); ctx.clip();
    ctx.drawImage(img, 40, 70, 160, 160);
    ctx.restore();
  } catch {}

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 36px sans-serif';
  ctx.fillText(String(username).slice(0, 22), 240, 70);

  const t = progress(textXp), v = progress(voiceXp);

  ctx.font = '22px sans-serif';
  ctx.fillStyle = '#b5bac1';
  ctx.fillText(`💬 Text  •  Level ${t.level}  •  Rank #${textRank}`, 240, 120);
  bar(ctx, 240, 135, 620, 22, t.current / t.need, '#5865f2');
  ctx.fillStyle = '#b5bac1';
  ctx.font = '18px sans-serif';
  ctx.fillText(`${t.current} / ${t.need} XP`, 240, 180);

  ctx.font = '22px sans-serif';
  ctx.fillText(`🎙️ Voice  •  Level ${v.level}  •  Rank #${voiceRank}`, 240, 220);
  bar(ctx, 240, 235, 620, 22, v.current / v.need, '#57f287');
  ctx.font = '18px sans-serif';
  const h = Math.floor(totalVoiceMinutes / 60), m = totalVoiceMinutes % 60;
  ctx.fillText(`${v.current} / ${v.need} XP  •  ${h}h ${m}m`, 240, 280);

  return canvas.toBuffer('image/png');
}

module.exports = buildRankCard;
