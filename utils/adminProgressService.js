// نظام نقاط وترقية الإداريين (نسخة مبسّطة).
// إذا LEVEL_CONFIGS فاضية = النظام خامل والبوت يشتغل عادي.
const { EmbedBuilder } = require('discord.js');
const AdminProgress = require('../models/AdminProgress');
const { LEVEL_CONFIGS, PROMOTION_ANNOUNCE_CHANNEL_ID } = require('../config/adminProgressConfig');

const KEY_MAP = {
  tickets: 'tickets', ticket: 'tickets', تكت: 'tickets', تكتات: 'tickets', تذاكر: 'tickets', تذكرة: 'tickets',
  warns: 'warns', warn: 'warns', تحذير: 'warns', تحذيرات: 'warns', وارن: 'warns',
  xp: 'xp', اكس: 'xp', 'اكس-بي': 'xp', خبرة: 'xp', نقاط: 'xp'
};

const normalizePointKey = raw => KEY_MAP[String(raw || '').trim().toLowerCase()] || null;

async function getOrCreate(guildId, userId) {
  let doc = await AdminProgress.findOne({ guildId, userId });
  if (!doc) doc = await AdminProgress.create({ guildId, userId });
  if (!doc.points) doc.points = { tickets: 0, warns: 0, xp: 0 };
  if (!doc.lifetime) doc.lifetime = { tickets: 0, warns: 0, xp: 0 };
  return doc;
}

async function addPoints({ guildId, userId, tickets = 0, warns = 0, xp = 0 }) {
  const inc = {};
  for (const [k, v] of Object.entries({ tickets, warns, xp })) {
    if (v) { inc[`points.${k}`] = v; inc[`lifetime.${k}`] = v; }
  }
  if (!Object.keys(inc).length) return getOrCreate(guildId, userId);
  return AdminProgress.findOneAndUpdate(
    { guildId, userId }, { $inc: inc }, { upsert: true, new: true, setDefaultsOnInsert: true }
  );
}

const getMultiplier = () => 1;
const getWarnsBonus = () => 0;

const scaledReq = (req = {}, multiplier = 1) => {
  const out = { ...req };
  for (const k of ['tickets', 'warns', 'xp']) {
    if (out[k]) out[k] = Math.ceil(out[k] * multiplier);
  }
  return out;
};

const getConfig = level => LEVEL_CONFIGS.find(c => Number(c.level) === Number(level)) || null;
const getNextLevelConfig = currentLevel => getConfig(Number(currentLevel || 0) + 1);

const rolesOf = cfg => (cfg?.roles || []).map(String);

async function tryPromote(message, member, opts = {}) {
  try {
    if (!LEVEL_CONFIGS.length || !member) return false;
    const guild = message?.guild || member.guild;
    const doc = await getOrCreate(guild.id, member.id);
    const current = Number(doc.level || 0);
    const nextCfg = getNextLevelConfig(current);
    if (!nextCfg) return false;

    const req = scaledReq(nextCfg.req, getMultiplier(member));
    const p = doc.points || {};
    if (req.tickets && (p.tickets || 0) < req.tickets) return false;
    if (req.warns && (p.warns || 0) < req.warns) return false;
    if (req.xp && (p.xp || 0) < req.xp) return false;

    const removed = rolesOf(getConfig(current));
    const added = rolesOf(nextCfg);
    for (const r of removed) if (!added.includes(r)) await member.roles.remove(r).catch(() => {});
    for (const r of added) await member.roles.add(r).catch(() => {});

    doc.level = Number(nextCfg.level);
    await doc.save();

    const embed = new EmbedBuilder()
      .setColor(0x00ff7f)
      .setTitle('🎉 ترقية جديدة')
      .setDescription(`تمت ترقية <@${member.id}> إلى **${nextCfg.name || `Level ${nextCfg.level}`}**`);

    if (opts.dmOnPromote) await member.send({ embeds: [embed] }).catch(() => {});
    if (opts.announceInChannel) {
      const ch = guild.channels.cache.get(PROMOTION_ANNOUNCE_CHANNEL_ID) || message?.channel;
      if (ch?.send) await ch.send({ embeds: [embed], allowedMentions: { parse: [] } }).catch(() => {});
    }
    return true;
  } catch (err) {
    console.error('tryPromote error:', err?.message || err);
    return false;
  }
}

async function demoteOneLevel(guild, member, { reason, byId } = {}) {
  const doc = await getOrCreate(guild.id, member.id);
  const current = Number(doc.level || 0);
  if (current <= 0) throw new Error('❌ هذا الإداري في أدنى مستوى.');

  const curCfg = getConfig(current);
  const prevCfg = getConfig(current - 1);
  const removedRoles = rolesOf(curCfg);
  const addedRoles = rolesOf(prevCfg);

  for (const r of removedRoles) if (!addedRoles.includes(r)) await member.roles.remove(r).catch(() => {});
  for (const r of addedRoles) await member.roles.add(r).catch(() => {});

  doc.level = current - 1;
  await doc.save();

  return {
    fromName: curCfg?.name || `Level ${current}`,
    toName: prevCfg?.name || `Level ${current - 1}`,
    removedRoles: removedRoles.filter(r => !addedRoles.includes(r)),
    addedRoles,
    reason, byId
  };
}

async function syncDocLevelWithMemberRoles(member, doc /*, { strict } */) {
  if (!LEVEL_CONFIGS.length || !member?.roles?.cache || !doc) return doc;
  let level = 0;
  for (const cfg of LEVEL_CONFIGS) {
    if (rolesOf(cfg).some(r => member.roles.cache.has(r))) level = Math.max(level, Number(cfg.level));
  }
  if (Number(doc.level || 0) !== level) {
    doc.level = level;
    await doc.save();
  }
  return doc;
}

async function transferPoints(fromDoc, toDoc, typeArg, amount) {
  const key = normalizePointKey(typeArg);
  if (!key) throw new Error('❌ نوع النقاط غير صحيح (tickets / warns / xp).');
  const n = Math.floor(Number(amount));
  if (!Number.isFinite(n) || n <= 0) throw new Error('❌ الكمية لازم تكون رقم أكبر من 0.');
  if ((fromDoc.points?.[key] || 0) < n) throw new Error('❌ ما عندك نقاط كافية للتحويل.');

  fromDoc.points[key] -= n;
  toDoc.points[key] = (toDoc.points[key] || 0) + n;
  await fromDoc.save();
  await toDoc.save();
  return { amount: n, type: key };
}

async function convertPoints(doc, fromKey, toKey, amount) {
  const a = normalizePointKey(fromKey), b = normalizePointKey(toKey);
  if (!a || !b) throw new Error('❌ نوع غير صحيح.');
  const n = Math.floor(Number(amount));
  if (!Number.isFinite(n) || n <= 0 || (doc.points[a] || 0) < n) throw new Error('❌ كمية غير صالحة.');
  doc.points[a] -= n;
  doc.points[b] = (doc.points[b] || 0) + n;
  await doc.save();
  return { amount: n };
}

module.exports = {
  getOrCreate, addPoints, tryPromote, convertPoints, transferPoints,
  getMultiplier, getNextLevelConfig, scaledReq, normalizePointKey,
  demoteOneLevel, syncDocLevelWithMemberRoles, getWarnsBonus
};
