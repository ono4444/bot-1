// نظام الأكواد (XP / تكتات / دبل XP) — في الذاكرة، يتصفّر عند إعادة التشغيل.
const codes = new Map();
const boosts = new Map();

const norm = c => String(c || '').trim().toUpperCase();

function addFlatCode(code, xp)          { codes.set(norm(code), { type: 'flat', xp, used: false }); }
function addTicketsCode(code, tickets)  { codes.set(norm(code), { type: 'tickets', tickets, used: false }); }
function addDoubleCode(code, durationMs, multiplier = 2) {
  codes.set(norm(code), { type: 'double', durationMs, multiplier, used: false });
}

function redeemCode(code, userId) {
  const entry = codes.get(norm(code));
  if (!entry) return { success: false, reason: 'الكود غير صحيح.' };
  if (entry.used) return { success: false, reason: 'هذا الكود مستخدم من قبل.' };

  entry.used = true;
  entry.usedBy = userId;

  if (entry.type === 'flat')    return { success: true, type: 'flat', xp: entry.xp };
  if (entry.type === 'tickets') return { success: true, type: 'tickets', tickets: entry.tickets };
  if (entry.type === 'double') {
    const expiresAt = Date.now() + entry.durationMs;
    boosts.set(userId, { multiplier: entry.multiplier || 2, expiresAt });
    return { success: true, type: 'double', durationMs: entry.durationMs, expiresAt };
  }
  return { success: false, reason: 'نوع الكود غير معروف.' };
}

function getActiveBoost(userId) {
  const b = boosts.get(userId);
  if (!b) return null;
  if (Date.now() >= b.expiresAt) { boosts.delete(userId); return null; }
  return b;
}

module.exports = { redeemCode, getActiveBoost, addFlatCode, addTicketsCode, addDoubleCode };
