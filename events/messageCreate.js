// events/messageCreate.js (كامل مع التعديلات)
const { Events, EmbedBuilder, PermissionsBitField, AttachmentBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { handleAutoDeleteBotMessages, handleDeleteProBotReplyOnR } = require('../utils/autoDeleteBotMessages');
const { handleGiveRoleKeyword } = require('../utils/giveRoleKeyword');
const { handleManualUnban } = require('../utils/manualUnban');

let client;

const roleTask = require('../commands/roleTask');
const { redeemCode, getActiveBoost } = require('../utils/codeManager');
const { logAction } = require('../utils/botLogger');
const buildRankCard = require('../utils/rankCard');
const UserXP    = require('../models/UserXP');
const LevelRole = require('../models/LevelRole');
const AutoResponder = require('../models/AutoResponder');

// ===== تايمر فشل المهمة =====
setInterval(async () => {
  const now = Date.now();
  for (const [userId, task] of roleTask.activeTasks.entries()) {
    if (now >= task.endTime) {
      for (const guild of (client?.guilds?.cache?.values() || [])) {
        const member = guild.members.cache.get(userId);
        if (!member) continue;
        try {
          if (task.removeRoleId) await member.roles.remove(task.removeRoleId);
          else await member.roles.remove('1393320266620211341');
        } catch {}
        roleTask.activeTasks.delete(userId);
        try { await member.send('❌ لقد فشلت في الاختبار'); } catch {}
        break;
      }
    }
  }
}, 60000);

const TicketClaim = require('../models/TicketClaim');
const MediatorClaim = require('../models/MediatorClaim');
const AlayaClaim = require('../models/AlayaClaim');
const AdminStats = require('../models/AdminStats');
const Warning = require('../models/Warning');
const AdminApproval = require('../models/AdminApproval');
const { resetIfNeeded } = require('../utils/resetHelpers');
const {
  ALIASES,
  SUPPORT_ROLE_ID,
  EDIT_BREAK_ALLOWED_ROLE_ID,
  WARN_ALLOWED_ROLE_ID,
  WARN_COMMAND_CHANNEL_IDS,
  PANEL_LINE_IMAGE_URL,
  PROMOTION_ANNOUNCE_CHANNEL_ID,
  LEVEL_CONFIGS
} = require('../config/adminProgressConfig');
const {
  getOrCreate,
  addPoints,
  tryPromote,
  convertPoints,
  transferPoints,
  getMultiplier,
  getNextLevelConfig,
  scaledReq,
  normalizePointKey,
  demoteOneLevel,
  syncDocLevelWithMemberRoles,
  getWarnsBonus
} = require('../utils/adminProgressService');

const TICKET_PREFIX = 'ticket-';
const UNCLAIMED_TICKET_NAME = 'ticket-غير-مستلم';
const COOLDOWN = 60_000;
const TICKET_CATEGORY_ID = '1096476483142291546';

const WARN_LOG_CHANNEL_ID = '1467949324205031424';
const DM_USER_ON_WARN = true;
const MOD_REQUIRED_PERM = PermissionsBitField.Flags.ModerateMembers;
const FORCE_ADMIN_UNCLAIM_PERM = PermissionsBitField.Flags.ManageChannels;

const WARN_ACCESS_ROLE_ID = '1075197301464768522';
const EDIT_AUDIT_OWNER_ID = '1086312520874217644';

const LEVEL_UP_CHANNEL_ID = '1388151282606407790';
const LEVEL_UP_EMOJI_1 = '<:E24A_fairlogin:1423276615051378839>';
const LEVEL_UP_EMOJI_2 = '<:E24A_sus:1423274050544992306>';

const MEDIATOR_MAIN_ROLE_ID = '1545531442535071744';
const MEDIATOR_HELPER_ROLE_ID = '1486428538792968222';
const MEDIATOR_TICKET_CATEGORY_IDS = ['1545782491690831942'];
const VIP_ROLE_ID = '1486429309349396571';
const ADMIN_TICKET_CATEGORY_ID = '1096476483142291546';
const RESTRICTED_REPLY_CHANNEL_ID = '1468218606142881844';
const LOCKED_MEDIATOR_ROLE_IDS = [MEDIATOR_MAIN_ROLE_ID, MEDIATOR_HELPER_ROLE_ID].filter(Boolean);

const CODE_COMMAND_CHANNEL_IDS = ['1468218606142881844', '1239273797027233812'];
const CODE_COMMAND_ALLOWED_ROLES = ['1075197301464768522', '1393320266620211341'];
const CODE_COMMAND_CATEGORY_ID = '1378675851813720126';

const LINE_IMAGE_URL = 'https://cdn.discordapp.com/attachments/1390932617645260872/1391661420558422156/Picsart_25-07-07_09-05-01-827.png?ex=69a7cbb2&is=69a67a32&hm=67f646fb38d7285be13cfecf4e122ca1a68310158c0de7168228fc7710575c68';

const ALAYA_TRIGGER = '-عليا';
const ALAYA_ROLE_ID = '1388155427660759140';
const ALAYA_CLAIM_ROLE_IDS = ['1388155427660759140', '1369290706568347678', '1498736792059379863', '1463918984108966152'];
const ALAYA_STATS_TRIGGER = '-مهام العليا';
const alayaButtonSentChannels = new Set(); // channelId => الزر اتبعت مرة وحدة فهاذ الروم
const ALAYA_IMAGE_URL = 'https://cdn.discordapp.com/attachments/1390932617645260872/1391661420558422156/Picsart_25-07-07_09-05-01-827.png?ex=68769872&is=687546f2&hm=b164ca8d7e7eac15ac8240ed69f01425114a94f530ddc1e6450efb5e9729c697&';

const ALAYA_ALLOWED_ROLE_ID = '1075197301464768522';

// ===== أوامر الرانك =====
const RANK_ALIASES = ['rank', 'r'];
const ROLES_COMMAND_USER_ID = '1086312520874217644';
const ROLES_ALIASES = ['رتب'];

const attachAlias = (key, defaults) => {
  if (!Array.isArray(defaults)) return [];
  if (ALIASES && Array.isArray(ALIASES[key])) {
    const merged = [...new Set([...ALIASES[key], ...defaults])];
    ALIASES[key] = merged;
    return merged;
  }
  if (ALIASES) ALIASES[key] = [...defaults];
  return defaults;
};

const WARN_ALIASES = attachAlias('WARN', ['warn', 'تحذير', 'تحدير', 'اتحدير', 'اتحذير', 'تحزير', 'ت']);
const WARNINGS_ALIASES = attachAlias('WARNINGS', ['warnings', 'warns', 'تحذيرات', 'تحديرات', 'اتحديرات', 'اتحذيرات']);
const UNWARN_ALIASES   = attachAlias('UNWARN',   ['شيل', 'unwarn', 'شيلت', 'rm-warn']);
const CLAIM_ALIASES = attachAlias('CLAIM', ['claim', 'استلام', 'انا']);
const UNCLAIM_ALIASES = attachAlias('UNCLAIM', ['unclaim', 'إلغاء', 'الغاء', 'خروج', 'الغا']);
const XP_ALIASES = attachAlias('XP', ['xp', 'نقاط', 'خبرة']);
const TOP_ALIASES = attachAlias('TOP', ['t', 'top', 'توب']);
const BREAK_ALIASES = attachAlias('BREAK', ['كسر', 'break', 'demote', 'down']);
const ADD_ALIASES = attachAlias('ADD', [
  'add', 'addmember', 'زياده', 'زيادة', 'اضافه', 'إضافة',
  'اضافة', 'أضافة', 'ضيف', 'اضف', 'أضف'
]);
const STATS_ALIASES = attachAlias('STATS', [
  'ستات', 'stats', 'stat', 'استات', 'إحصائيات', 'احصائيات', 'بطاقة'
]);
const EDIT_ALIASES = attachAlias('EDIT', ['تعديل', 'edit', 'mod', 'set', 'اضبط', 'عدل']);
const PROMOTE_ALIASES = attachAlias('PROMOTE', ['ترقية', 'ترقيه', 'promote', 'up']);
const ROLE_TASK_ALIASES = ['رول'];

const APPROVAL_ROLE_ID = '1388289855582371860';
const APPROVAL_ALIASES = ['موافقه', 'موافقة', 'approve'];

// ===== دالة إنهاء المهمة وإعطاء الموافقة التلقائية + ترقية فورية =====
const completeTaskAndAutoPromote = async (guild, member, task, extraMessage = null) => {
  try {
    // 1. إزالة رتبة المهمة وإضافة رتبة الإداري
    try {
      if (task.removeRoleId) await member.roles.remove(task.removeRoleId);
      else await member.roles.remove('1393320266620211341');
      if (task.rewardRoleId) await member.roles.add(task.rewardRoleId);
      else await member.roles.add('1075197301464768522');
    } catch (e) {
      console.error('completeTaskAndAutoPromote role error:', e?.message || e);
    }

    // 2. رفع نقاط الـ XP الإدارية لتغطية شرط الترقية (بدون المساس بـ UserXP)
    const doc = await getOrCreate(guild.id, member.id);
    const adminLevel = Number(doc.level || 0);
    const nextCfg = getNextLevelConfig(adminLevel);

    if (nextCfg) {
      const multiplier = getMultiplier(member);
      const nextReq = scaledReq(nextCfg.req, multiplier);

      if (!doc.points) doc.points = { tickets: 0, warns: 0, xp: 0 };
      if (!doc.lifetime) doc.lifetime = { tickets: 0, warns: 0, xp: 0 };

      // رفع نقاط الـ XP الإدارية فقط إذا كانت ناقصة — الفل (UserXP) لا يُمس
      if (nextReq.xp && doc.points.xp < nextReq.xp) {
        doc.lifetime.xp = Math.max(doc.lifetime.xp || 0, nextReq.xp);
        doc.points.xp = nextReq.xp;
        await doc.save();
      }

      // 3. إنشاء موافقة تلقائية إذا لم توجد مسبقاً
      const existingApproval = await AdminApproval.findOne({
        guildId: guild.id,
        adminUserId: member.id,
        targetLevel: adminLevel + 1,
        used: false
      });

      if (!existingApproval) {
        await AdminApproval.create({
          guildId: guild.id,
          adminUserId: member.id,
          targetLevel: adminLevel + 1,
          approvedBy: guild.client.user.id // البوت هو الموافق تلقائياً
        });
      }

      // 4. تنفيذ الترقية مباشرة بدون انتظار أمر إضافي
      const fakeMessage = {
        guild,
        author: guild.client.user,
        member,
        channel: null,
        client: guild.client
      };
      await tryPromote(fakeMessage, member, { announceInChannel: true, dmOnPromote: true });
    }

    // 5. إشعار المسؤولين (اختياري، للسجل)
    try {
      const { notifyApproversTaskDone, systemState } = require('../utils/taskNotify');
      if (systemState.active === 'new') {
        await notifyApproversTaskDone(guild, member, {
          taskName:   task.taskName || 'اختبار الإداري',
          gainedXp:   task.gainedXp,
          requiredXp: task.requiredXp,
        });
      }
    } catch {}

    // 6. رسالة DM للإداري
    try {
      const dmLines = [
        '🎉 **مبروك! أنهيت المهمة بنجاح وتمت ترقيتك تلقائياً!**'
      ];
      if (extraMessage) dmLines.push(extraMessage);
      await member.send(dmLines.join('\n'));
    } catch {}

  } catch (err) {
    console.error('completeTaskAndAutoPromote error:', err?.message || err);
  }
};

// wrapper يتحقق من الموافقة قبل الترقية
const tryPromoteWithApproval = async (message, member, opts) => {
  try {
    const { getOrCreate: _getOrCreate, getNextLevelConfig: _getNextLevelConfig, scaledReq: _scaledReq, getMultiplier: _getMultiplier } = require('../utils/adminProgressService');
    const doc = await _getOrCreate(message.guild.id, member.id);
    const adminLevel = Number(doc.level || 0);
    const nextCfg = _getNextLevelConfig(adminLevel);
    if (!nextCfg) return await tryPromote(message, member, opts);

    const approval = await AdminApproval.findOne({
      guildId: message.guild.id,
      adminUserId: member.id,
      targetLevel: adminLevel + 1,
      used: false
    });
    if (!approval) return;

    const multiplier = _getMultiplier(member);
    const nextReq = _scaledReq(nextCfg.req, multiplier);
    const points = doc.points || {};
    const UserXPModel = require('../models/UserXP');
    const uxDoc = await UserXPModel.findOne({ guildId: message.guild.id, userId: member.id });
    const tXp = uxDoc ? Number(uxDoc.textXp || 0) : 0;
    const vXp = uxDoc ? Number(uxDoc.voiceXp || 0) : 0;
    const bestLvl = Math.max(calculateLevel(tXp), calculateLevel(vXp));
    const xpLevelReq = nextReq.xpLevel || 0;

    const ticketsOk = !nextReq.tickets || (points.tickets || 0) >= nextReq.tickets;
    const warnsOk   = !nextReq.warns   || (points.warns   || 0) >= nextReq.warns;
    const xpLvlOk   = !xpLevelReq      || bestLvl >= xpLevelReq;

    if (!ticketsOk || !warnsOk || !xpLvlOk) return;

    approval.used = true;
    await approval.save();
    await tryPromote(message, member, opts);
  } catch (err) {
    console.error('tryPromoteWithApproval error:', err?.message || err);
  }
};

const TEXT_CODE_ALIASES = ['كود'];
const LINE_ALIASES = ['خط'];

const mediatorCommandAliasSet = new Set(
  [...CLAIM_ALIASES, ...UNCLAIM_ALIASES, ...ADD_ALIASES].map(a => a.toLowerCase())
);

const TEXT_XP_MIN = 8;
const TEXT_XP_MAX = 36;
const TEXT_XP_COOLDOWN = 60_000;

const TOP_LIMIT = 5;
const TOP_PANEL_IMAGE_URL = PANEL_LINE_IMAGE_URL;
const TOP_REPLY_TTL = 10_000;
const MANAGED_REPLY_COOLDOWN = 2000;
const MESSAGE_GUARD_TTL = 15_000;

const POINT_TYPE_LABELS = { tickets: 'نقاط التذاكر', warns: 'نقاط التحذيرات' };
const POINT_TYPE_EMOJIS = { tickets: '🎟️', warns: '⚠️' };

const recentCommands = new Map();
const processedCommands = new Map();
const textXpCooldowns = new Map();
const recentWarnActions = new Map();
const replyLocks = new Map();
const messageGuards = new Map();
const recentLevelUps = new Map();
const mediatorClaimedByChannel = new Map();
const ticketOwnerCache = new Map();

const sendNoPing = (channel, payload) =>
  channel.send({ allowedMentions: { parse: [] }, ...payload });

const shouldSendRestrictedReply = channelId => channelId === RESTRICTED_REPLY_CHANNEL_ID;

const getChannelCategoryId = channel => {
  if (!channel) return null;
  if (channel.isThread?.()) return channel.parent?.parentId || channel.parentId || null;
  return channel.parentId || null;
};

const isMediatorTicketChannel = channel =>
  MEDIATOR_TICKET_CATEGORY_IDS.includes(getChannelCategoryId(channel));

const isAdminTicketChannel = channel =>
  getChannelCategoryId(channel) === ADMIN_TICKET_CATEGORY_ID;

const hasMediatorMainRole = member =>
  member?.roles?.cache?.has(MEDIATOR_MAIN_ROLE_ID) || false;

const hasAnyMediatorRole = member =>
  member?.roles?.cache?.has(MEDIATOR_MAIN_ROLE_ID) ||
  member?.roles?.cache?.has(MEDIATOR_HELPER_ROLE_ID) ||
  false;

const sanitizeTicketSlug = input => {
  if (!input) return 'ticket';
  const cleaned = input
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9_-]/g, '')
    .toLowerCase()
    .slice(0, 25);
  return cleaned || 'ticket';
};

const normalizeCommandToken = token =>
  (token || '').trim().replace(/^[!?.]+/, '').toLowerCase();

const lockMessage = (messageId, ttl = MESSAGE_GUARD_TTL) => {
  if (messageGuards.has(messageId)) return false;
  const timeout = setTimeout(() => messageGuards.delete(messageId), ttl);
  messageGuards.set(messageId, timeout);
  return true;
};

const isDuplicateCommand = (message, ms = 2000) => {
  const key = `${message.guild?.id}:${message.author.id}:${message.content.trim().toLowerCase()}`;
  const now = Date.now();
  const last = recentCommands.get(key) || 0;
  if (now - last < ms) return true;
  recentCommands.set(key, now);
  setTimeout(() => recentCommands.delete(key), ms + 500);
  return false;
};

const markProcessed = (key, ttl = 3000) => {
  if (processedCommands.has(key)) return false;
  const timeout = setTimeout(() => processedCommands.delete(key), ttl);
  processedCommands.set(key, timeout);
  return true;
};

const shouldSendManagedReply = (channelId, tag, ttl = MANAGED_REPLY_COOLDOWN) => {
  const key = `${channelId}:${tag}`;
  const now = Date.now();
  const last = replyLocks.get(key) || 0;
  if (now - last < ttl) return false;
  replyLocks.set(key, now);
  setTimeout(() => { if (replyLocks.get(key) === now) replyLocks.delete(key); }, ttl * 2);
  return true;
};

const shouldAnnounceLevelUp = (guildId, userId, level, ttl = 15000) => {
  const key = `${guildId}:${userId}:${level}`;
  const now = Date.now();
  const last = recentLevelUps.get(key) || 0;
  if (now - last < ttl) return false;
  recentLevelUps.set(key, now);
  setTimeout(() => { if (recentLevelUps.get(key) === now) recentLevelUps.delete(key); }, ttl + 1500);
  return true;
};

const sendManagedEmbedOnce = async (channel, tag, payload, ttl) => {
  if (!shouldSendManagedReply(channel.id, tag, ttl ?? MANAGED_REPLY_COOLDOWN)) return;
  await sendNoPing(channel, payload);
};

const hasAlayaPermission = (member, guild) => {
  if (!member?.roles?.cache) return false;
  const alayaRole = guild.roles.cache.get(ALAYA_ALLOWED_ROLE_ID);
  if (!alayaRole) return false;
  const alayaPosition = alayaRole.position;
  return member.roles.cache.some(r => r.position >= alayaPosition);
};

const buildStyledPanel = ({ title, description, guildIconURL, authorAvatarURL, footerTag, imageURL }) => {
  const embed = new EmbedBuilder().setColor(0xff0000);
  if (title) embed.setTitle(title);
  if (description) embed.setDescription(description);
  if (guildIconURL) embed.setAuthor({ name: '⚡ نظام الإدارة', iconURL: guildIconURL });
  if (authorAvatarURL) embed.setThumbnail(authorAvatarURL);
  if (footerTag) {
    embed.setFooter({
      text: `${footerTag} • ${new Date().toLocaleString('ar-SA')}`,
      iconURL: authorAvatarURL || undefined
    });
  }
  if (imageURL && /^https?:\/\//i.test(imageURL)) embed.setImage(imageURL);
  return embed;
};

const redPanel = (text, title = null) => {
  const embed = new EmbedBuilder().setColor(0xff0000).setDescription(`**${text}**`);
  if (title) embed.setTitle(title);
  return embed;
};

const greenPanel = (text, title = null) => {
  const embed = new EmbedBuilder().setColor(0x00ff7f).setDescription(`**${text}**`);
  if (title) embed.setTitle(title);
  return embed;
};

const redConfirmPanel = text =>
  new EmbedBuilder().setColor(0xff0000).setDescription(`**✅ ${text}**`);

const formatRoleMentions = (roleIds = []) =>
  Array.isArray(roleIds) && roleIds.length
    ? roleIds.map(id => `<@&${id}>`).join('، ')
    : 'لا يوجد';

const msToLabel = (ms) => {
  const w = Math.floor(ms / 604800000);
  const d = Math.floor((ms % 604800000) / 86400000);
  const h = Math.floor((ms % 86400000) / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const parts = [];
  if (w) parts.push(`${w} أسبوع`);
  if (d) parts.push(`${d} يوم`);
  if (h) parts.push(`${h} ساعة`);
  if (m) parts.push(`${m} دقيقة`);
  return parts.join(' و ') || '0 دقيقة';
};

const warnDetailEmbed = ({ target, moderator, reason, caseId }) => {
  const modUser = moderator.user ?? moderator;
  return new EmbedBuilder()
    .setColor(0xff0000)
    .setTitle('⚠️ **تحذير جديد**')
    .addFields(
      { name: 'المُحذَّر', value: `**<@${target.id}> (${target.id})**` },
      { name: 'المُصدر', value: `**<@${modUser.id}> (${modUser.id})**` },
      { name: 'السبب', value: `**${reason}**` },
      { name: 'الوقت', value: `**${new Date().toLocaleString('ar-SA')}**` },
      { name: 'رقم الحالة', value: `**${caseId}**` }
    )
    .setFooter({
      text: `بطلب من ${modUser.tag}`,
      iconURL: modUser.displayAvatarURL?.({ size: 128 })
    });
};

const notifyEditCommandUsage = async ({ message, editorMember, targetMember, pointType, amount }) => {
  try {
    const owner = await message.client.users.fetch(EDIT_AUDIT_OWNER_ID, { force: true });
    if (!owner) return;
    const channelName = message.channel?.name ? `#${message.channel.name}` : 'unknown-channel';
    const nowLabel = new Date().toLocaleString('ar-SA');
    const embed = new EmbedBuilder()
      .setColor(0xff0000)
      .setTitle('تنبيه استخدام أمر تعديل')
      .setDescription('تم استخدام أمر تعديل في السيرفر.')
      .addFields(
        { name: 'المستخدم للأمر', value: `**<@${editorMember.id}> (${editorMember.id})**` },
        { name: 'العضو المستهدف', value: `**<@${targetMember.id}> (${targetMember.id})**` },
        { name: 'نوع النقاط', value: `**${pointType}**`, inline: true },
        { name: 'القيمة الجديدة', value: `**${amount}**`, inline: true },
        { name: 'السيرفر', value: `**${message.guild.name} (${message.guild.id})**`, inline: false },
        { name: 'الروم', value: `**${channelName} (${message.channel.id})**`, inline: false },
        { name: 'الوقت', value: `**${nowLabel}**`, inline: false }
      );
    await owner.send({ embeds: [embed] });
  } catch (err) {
    console.error('notifyEditCommandUsage error:', err?.message || err);
  }
};

const extractIdFromMention = input => {
  if (!input) return null;
  const raw = String(input).trim().replace(/[،,.;:!؟]+$/g, '');
  const mention = raw.match(/^<@!?(\d{16,21})>$/);
  if (mention) return mention[1];
  if (/^\d{16,21}$/.test(raw)) return raw;
  const anyId = raw.match(/(\d{16,21})/);
  return anyId ? anyId[1] : null;
};

const fetchMember = async (guild, arg, message = null) => {
  if (!guild) return null;
  const mentioned = message?.mentions?.members?.first();
  if (mentioned) return mentioned;
  if (!arg) return null;
  const raw = String(arg).trim();
  if (!raw) return null;
  const id = extractIdFromMention(raw);
  if (id) {
    const cached = guild.members.cache.get(id);
    if (cached) return cached;
    try { return await guild.members.fetch(id); } catch { return null; }
  }
  const normalized = raw.toLowerCase();
  const fromCache =
    guild.members.cache.find(m => (m.user.tag || '').toLowerCase() === normalized) ||
    guild.members.cache.find(m => (m.user.username || '').toLowerCase() === normalized) ||
    guild.members.cache.find(m => (m.displayName || '').toLowerCase() === normalized);
  if (fromCache) return fromCache;
  try {
    const queried = await guild.members.fetch({ query: raw, limit: 20 });
    return (
      queried.find(m => (m.user.tag || '').toLowerCase() === normalized) ||
      queried.find(m => (m.user.username || '').toLowerCase() === normalized) ||
      queried.find(m => (m.displayName || '').toLowerCase() === normalized) ||
      queried.first() ||
      null
    );
  } catch { return null; }
};

const isDuplicateWarnAction = (guildId, modId, targetId, reason, ms = 5000) => {
  const key = `${guildId}:${modId}:${targetId}:${reason.trim().toLowerCase()}`;
  const now = Date.now();
  const last = recentWarnActions.get(key) || 0;
  if (now - last < ms) return true;
  recentWarnActions.set(key, now);
  setTimeout(() => recentWarnActions.delete(key), ms + 500);
  return false;
};

const isAdminMember = member => {
  if (!member?.roles?.cache) return false;
  const adminRoles = new Set([String(SUPPORT_ROLE_ID)]);
  for (const cfg of LEVEL_CONFIGS) {
    for (const r of cfg.roles || []) adminRoles.add(String(r));
  }
  for (const roleId of adminRoles) {
    if (member.roles.cache.has(roleId)) return true;
  }
  return false;
};

const isWarnChannel = channelId =>
  Array.isArray(WARN_COMMAND_CHANNEL_IDS) && WARN_COMMAND_CHANNEL_IDS.includes(channelId);

const extractTicketOwnerId = channel => {
  if (!channel) return null;
  if (ticketOwnerCache.has(channel.id)) return ticketOwnerCache.get(channel.id);
  const topic = String(channel.topic || '');
  const keyed = topic.match(/(?:owner|ticket.?owner|opened.?by|user|member|creator)\D{0,20}(\d{16,21})/i);
  if (keyed) { ticketOwnerCache.set(channel.id, keyed[1]); return keyed[1]; }
  const mention = topic.match(/<@!?(\d{16,21})>/);
  if (mention) { ticketOwnerCache.set(channel.id, mention[1]); return mention[1]; }
  const anyId = topic.match(/(\d{16,21})/);
  if (anyId) { ticketOwnerCache.set(channel.id, anyId[1]); return anyId[1]; }
  return null;
};

const getMediatorClaimer = channelId => mediatorClaimedByChannel.get(channelId) || null;

const botAlreadyReactedCheckMark = async (channel, botId) => {
  try {
    const messages = await channel.messages.fetch({ limit: 50 });
    for (const msg of messages.values()) {
      const reaction = msg.reactions?.cache?.get('✅');
      if (!reaction) continue;
      const users = reaction.users.cache.has(botId)
        ? reaction.users.cache
        : await reaction.users.fetch();
      if (users.has(botId)) return true;
    }
  } catch {}
  return false;
};

const clearBotClaimReactions = async (channel, botId) => {
  try {
    if (!channel?.isTextBased?.()) return;
    const messages = await channel.messages.fetch({ limit: 50 });
    for (const msg of messages.values()) {
      const reaction = msg.reactions?.cache?.get('✅');
      if (!reaction) continue;
      const users = reaction.users.cache.has(botId)
        ? reaction.users.cache
        : await reaction.users.fetch();
      if (users.has(botId)) await reaction.users.remove(botId).catch(() => {});
    }
  } catch (e) { console.error('clearBotClaimReactions error:', e?.message || e); }
};

const isMediatorClaimStillValid = async (channel, guild, claimerId) => {
  try {
    if (!channel || !guild || !claimerId) return false;
    const overwrite = channel.permissionOverwrites?.cache?.get(claimerId);
    if (!overwrite) return false;
    const hasView = overwrite.allow.has(PermissionsBitField.Flags.ViewChannel);
    const hasSend = overwrite.allow.has(PermissionsBitField.Flags.SendMessages);
    if (!hasView || !hasSend) return false;
    let member = guild.members.cache.get(claimerId);
    if (!member) {
      try { member = await guild.members.fetch(claimerId); } catch { return false; }
    }
    if (!member) return false;
    if (!hasAnyMediatorRole(member)) return false;
    return true;
  } catch { return false; }
};

const getValidMediatorClaimer = async (channel, guild) => {
  const current = getMediatorClaimer(channel.id);
  if (!current) return null;
  const valid = await isMediatorClaimStillValid(channel, guild, current);
  if (valid) return current;
  mediatorClaimedByChannel.delete(channel.id);
  return null;
};

const setupClaimedTicket = async (channel, claimer) => {
  try {
    const sanitized = sanitizeTicketSlug(claimer.user.username);
    await channel.setName(`ticket-${sanitized}`).catch(() => {});
    for (const roleId of LOCKED_MEDIATOR_ROLE_IDS) {
      await channel.permissionOverwrites.edit(roleId, {
        ViewChannel: true, ReadMessageHistory: true,
        SendMessages: false, AttachFiles: false, AddReactions: false
      }, { reason: `Ticket locked for ${claimer.user.tag}` }).catch(() => {});
    }
    await channel.permissionOverwrites.edit(claimer.id, {
      ViewChannel: true, SendMessages: true, AttachFiles: true,
      ReadMessageHistory: true, AddReactions: true
    }, { reason: `Claimer full access - ${claimer.user.tag}` }).catch(() => {});
    const ownerId = extractTicketOwnerId(channel);
    if (ownerId && ownerId !== claimer.id) {
      await channel.permissionOverwrites.edit(ownerId, {
        ViewChannel: true, SendMessages: true, AttachFiles: true,
        ReadMessageHistory: true, AddReactions: true
      }, { reason: 'Ticket owner access' }).catch(() => {});
    }
    if (VIP_ROLE_ID) {
      await channel.permissionOverwrites.edit(VIP_ROLE_ID, {
        ViewChannel: true, SendMessages: true, AttachFiles: true,
        ReadMessageHistory: true, AddReactions: true
      }, { reason: 'VIP can still speak in claimed tickets' }).catch(() => {});
    }
  } catch (e) { console.error('setupClaimedTicket error:', e?.message || e); }
};

// يسجل عملية استلام تذكرة الوسيط فـ قاعدة البيانات (لأجل الإحصائيات ورسالة التقييم لاحقاً)
const persistMediatorClaim = async (channel, guild, mediatorId) => {
  try {
    const ownerId = extractTicketOwnerId(channel);
    const existing = await MediatorClaim.findOne({ channelId: channel.id, status: 'open' });
    if (existing) {
      existing.mediatorId = mediatorId;
      if (ownerId) existing.ticketOwnerId = ownerId;
      existing.claimedAt = new Date();
      await existing.save();
      return;
    }
    await MediatorClaim.create({
      guildId: guild.id,
      channelId: channel.id,
      ticketOwnerId: ownerId || null,
      mediatorId,
      status: 'open',
      claimedAt: new Date()
    });
  } catch (e) { console.error('persistMediatorClaim error:', e?.message || e); }
};

const restoreMediatorRoleAccess = async (channel, actorMember = null) => {
  const reason = actorMember
    ? `Ticket unlocked by ${actorMember.user?.tag || actorMember.tag || actorMember}`
    : 'Ticket unlocked';
  for (const roleId of LOCKED_MEDIATOR_ROLE_IDS) {
    try {
      await channel.permissionOverwrites.edit(roleId, {
        ViewChannel: true, ReadMessageHistory: true,
        SendMessages: true, AttachFiles: true, AddReactions: true
      }, { reason });
    } catch (e) { console.error('restoreMediatorRoleAccess error:', e?.message || e); }
  }
};

const clearMediatorClaimState = async (channel, actorMember = null, knownClaimerId = null) => {
  try {
    mediatorClaimedByChannel.delete(channel.id);
    await channel.setName(UNCLAIMED_TICKET_NAME).catch(() => {});
    await restoreMediatorRoleAccess(channel, actorMember);
    const idsToDelete = new Set();
    if (knownClaimerId) idsToDelete.add(knownClaimerId);
    if (actorMember?.id) idsToDelete.add(actorMember.id);
    for (const ow of channel.permissionOverwrites.cache.values()) {
      const targetId = ow.id;
      if (idsToDelete.has(targetId)) continue;
      let member = channel.guild.members.cache.get(targetId);
      if (!member) {
        try { member = await channel.guild.members.fetch(targetId); } catch { member = null; }
      }
      if (!member) continue;
      if (hasAnyMediatorRole(member)) {
        const mayView = ow.allow.has(PermissionsBitField.Flags.ViewChannel);
        const maySend = ow.allow.has(PermissionsBitField.Flags.SendMessages);
        if (mayView || maySend) idsToDelete.add(targetId);
      }
    }
    for (const id of idsToDelete) await channel.permissionOverwrites.delete(id).catch(() => {});
    await clearBotClaimReactions(channel, channel.client.user.id);
    await MediatorClaim.deleteOne({ channelId: channel.id, status: 'open' }).catch(() => {});
  } catch (e) { console.error('clearMediatorClaimState error:', e?.message || e); }
};

const handleMediatorAutoReactionClaim = async message => {
  try {
    if (!message.guild || message.author.bot || !message.member) return;
    const ch = message.channel;
    if (!ch?.isTextBased?.()) return;
    if (!isMediatorTicketChannel(ch)) return;
    if (isAdminTicketChannel(ch)) return;
    if (!hasMediatorMainRole(message.member)) return;
    const firstToken = normalizeCommandToken((message.content || '').split(/\s+/)[0] || '');
    if (mediatorCommandAliasSet.has(firstToken)) return;
    const ownerId = extractTicketOwnerId(ch);
    if (ownerId && ownerId === message.author.id) return;
    const activeClaimer = await getValidMediatorClaimer(ch, message.guild);
    if (activeClaimer) return;
    const already = await botAlreadyReactedCheckMark(ch, message.client.user.id);
    if (already) return;
    mediatorClaimedByChannel.set(ch.id, message.author.id);
    try { await message.react('✅'); } catch (e) { console.error('Mediator react error:', e?.message || e); }
    await setupClaimedTicket(ch, message.member);
    await persistMediatorClaim(ch, message.guild, message.author.id);
    try {
      await ch.send({
        allowedMentions: { parse: [] },
        embeds: [redPanel(`✅ تم استلام التذكرة بواسطة **${message.author.username}**.`)]
      });
    } catch {}
  } catch (e) { console.error('handleMediatorAutoReactionClaim error:', e?.message || e); }
};

const addWarningAndNotify = async (message, member, reason) => {
  let doc = await Warning.findOne({ guildId: message.guild.id, userId: member.id });
  if (!doc) {
    doc = new Warning({ guildId: message.guild.id, userId: member.id, infractions: [], total: 0 });
  }
  const caseId = `${Date.now().toString(36)}-${Math.floor(Math.random() * 1e4).toString(36)}`;
  doc.infractions.push({ caseId, moderatorId: message.author.id, reason, createdAt: new Date() });
  doc.total = (doc.total ?? 0) + 1;
  await doc.save();
  await addPoints({ guildId: message.guild.id, userId: message.author.id, warns: 1 });
  await tryPromoteWithApproval(message, message.member, { announceInChannel: true, dmOnPromote: true });
  const detailEmbed = warnDetailEmbed({ target: member, moderator: message.member, reason, caseId });
  if (DM_USER_ON_WARN) { try { await member.send({ embeds: [detailEmbed] }); } catch {} }
  await sendNoPing(message.channel, { embeds: [redConfirmPanel(`تم تحذير ${member.user.username}`)] });
  if (WARN_LOG_CHANNEL_ID) {
    const logChannel = message.guild.channels.cache.get(WARN_LOG_CHANNEL_ID);
    if (logChannel && logChannel.id !== message.channel.id) {
      try { await sendNoPing(logChannel, { embeds: [detailEmbed] }); } catch {}
    }
  }
};

const showWarnings = async (message, member) => {
  const doc = await Warning.findOne({ guildId: message.guild.id, userId: member.id });
  if (!doc || (doc.total ?? 0) === 0) {
    await sendNoPing(message.channel, { embeds: [redPanel(`لا توجد تحذيرات لـ <@${member.id}>`)] });
    return;
  }
  const last10 = [...doc.infractions].slice(-10).reverse();
  const lines = last10.map(inf => {
    const when = new Date(inf.createdAt).toLocaleString('ar-SA');
    return `**• رقم الحالة: ${inf.caseId}\nالزمان: ${when}\nبواسطة: <@${inf.moderatorId}>\nالسبب: ${inf.reason}**`;
  }).join('\n\n');
  const embed = new EmbedBuilder()
    .setColor(0xff0000)
    .setAuthor({ name: `تحذيرات ${member.user.tag}`, iconURL: member.displayAvatarURL({ size: 128 }) })
    .setDescription(lines)
    .setFooter({
      text: `الإجمالي: ${doc.total} • بطلب من ${message.author.tag}`,
      iconURL: message.author.displayAvatarURL({ size: 128 })
    });
  await sendNoPing(message.channel, { embeds: [embed] });
};

const startOfDay = value => { const d = new Date(value); d.setUTCHours(0, 0, 0, 0); return d.getTime(); };
const startOfWeek = value => {
  const d = new Date(value);
  const day = d.getUTCDay();
  d.setUTCDate(d.getUTCDate() - day);
  d.setUTCHours(0, 0, 0, 0);
  return d.getTime();
};
const startOfMonth = value => { const d = new Date(value); d.setUTCDate(1); d.setUTCHours(0, 0, 0, 0); return d.getTime(); };

const resetScopes = (doc, now) => {
  let changed = false;
  const daily = startOfDay(now);
  const weekly = startOfWeek(now);
  const monthly = startOfMonth(now);
  if (!doc.dailyResetAt || doc.dailyResetAt < daily) {
    doc.dailyTextXp = 0; doc.dailyVoiceXp = 0; doc.dailyResetAt = daily; changed = true;
  }
  if (!doc.weeklyResetAt || doc.weeklyResetAt < weekly) {
    doc.weeklyTextXp = 0; doc.weeklyVoiceXp = 0; doc.weeklyResetAt = weekly; changed = true;
  }
  if (!doc.monthlyResetAt || doc.monthlyResetAt < monthly) {
    doc.monthlyTextXp = 0; doc.monthlyVoiceXp = 0; doc.monthlyResetAt = monthly; changed = true;
  }
  return changed;
};

const randomBetween = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

const xpRequiredToLevelUp = currentLevel => {
  const lv = Math.max(1, Number(currentLevel) || 0);
  return Math.floor(110 + 2.9 * (lv ** 2));
};

const getTotalXpForLevel = level => {
  let total = 0;
  for (let l = 0; l < level; l++) total += xpRequiredToLevelUp(l);
  return total;
};

const calculateLevel = totalXp => {
  let xp = Math.max(0, Number(totalXp) || 0);
  let level = 0;
  for (let i = 0; i < 5000; i++) {
    const need = xpRequiredToLevelUp(level);
    if (xp < need) break;
    xp -= need;
    level++;
  }
  return level;
};

const getLevelProgress = totalXp => {
  const level = calculateLevel(totalXp);
  const startXp = getTotalXpForLevel(level);
  const nextNeed = xpRequiredToLevelUp(level);
  const inLevel = Math.max(0, totalXp - startXp);
  const left = Math.max(0, nextNeed - inLevel);
  return { level, inLevelXp: inLevel, requiredXp: nextNeed, leftXp: left };
};

// ===== إرسال DM عند الحصول على رتبة جديدة =====
const sendLevelRoleDM = async (member, role) => {
  try {
    const guildIconURL = member.guild.iconURL({ size: 256, extension: 'png' });
    const embed = new EmbedBuilder()
      .setColor(0xffd700)
      .setAuthor(guildIconURL ? { name: member.guild.name, iconURL: guildIconURL } : { name: member.guild.name })
      .setTitle('🎉 You got a new reward')
      .setDescription(`**${role.name}**`)
      .setFooter({ text: new Date().toLocaleString('ar-SA') });
    await member.send({ embeds: [embed] });
  } catch {}
};

// ===== إعطاء/سحب رتب اللفل (كتابي أو صوتي) =====
const applyLevelRoles = async (member, type, newLevel) => {
  try {
    const guildId  = member.guild.id;
    const allRoles = await LevelRole.find({ guildId, type });
    if (!allRoles.length) return;

    for (const entry of allRoles) {
      const hasRole    = member.roles.cache.has(entry.roleId);
      const shouldHave = newLevel >= entry.level;

      if (shouldHave && !hasRole) {
        const added = await member.roles.add(entry.roleId).then(() => true).catch(() => false);
        if (added) {
          const roleObj = member.guild.roles.cache.get(entry.roleId);
          if (roleObj) await sendLevelRoleDM(member, roleObj);
        }
      } else if (!shouldHave && hasRole) {
        await member.roles.remove(entry.roleId).catch(() => {});
      }
    }
  } catch (err) {
    console.error('applyLevelRoles error:', err?.message || err);
  }
};

const applyTextLevelRoles  = (member, newLevel) => applyLevelRoles(member, 'text',  newLevel);
const applyVoiceLevelRoles = (member, newLevel) => applyLevelRoles(member, 'voice', newLevel);

const grantTextXp = async message => {
  const hasPayload = message.content.trim().length > 0 || message.attachments.size > 0;
  if (!hasPayload) return;
  const key = `${message.guild.id}:${message.author.id}`;
  const now = Date.now();
  const last = textXpCooldowns.get(key) || 0;
  if (now - last < TEXT_XP_COOLDOWN) return;
  textXpCooldowns.set(key, now);

  const raw = (message.content || '').trim();
  const pureChars = raw.replace(/\s+/g, '').length;
  const hasAttachment = message.attachments.size > 0;
  if (pureChars < 8 && !hasAttachment) return;
  const blocks = Math.floor(pureChars / 35);
  const base = randomBetween(7, 11);
  const blockBonus = blocks * randomBetween(2, 4);
  const attachmentBonus = hasAttachment ? 4 : 0;
  let xpAmount = base + blockBonus + attachmentBonus;
  xpAmount = Math.max(TEXT_XP_MIN, Math.min(TEXT_XP_MAX, xpAmount));
  if (xpAmount <= 0) return;

  const boost = getActiveBoost(message.author.id);
  if (boost) xpAmount = Math.floor(xpAmount * boost.multiplier);

  if (message.member?.roles.cache.has(SUPPORT_ROLE_ID)) {
    await addPoints({ guildId: message.guild.id, userId: message.author.id, xp: xpAmount });
    await tryPromoteWithApproval(message, message.member, { announceInChannel: true, dmOnPromote: true });
  }

  let userXp = await UserXP.findOne({ guildId: message.guild.id, userId: message.author.id });
  if (!userXp) {
    userXp = new UserXP({
      guildId: message.guild.id, userId: message.author.id,
      textXp: 0, voiceXp: 0, totalXp: 0, level: 0, lastAnnouncedLevel: -1,
      dailyResetAt: startOfDay(now), weeklyResetAt: startOfWeek(now), monthlyResetAt: startOfMonth(now),
      dailyTextXp: 0, weeklyTextXp: 0, monthlyTextXp: 0,
      dailyVoiceXp: 0, weeklyVoiceXp: 0, monthlyVoiceXp: 0
    });
  }

  resetScopes(userXp, now);
  if (!Number.isFinite(userXp.lastAnnouncedLevel)) userXp.lastAnnouncedLevel = -1;

  const oldTotal = Number(userXp.totalXp || 0);
  const oldLevel = Number.isFinite(userXp.level) ? Number(userXp.level) : calculateLevel(oldTotal);

  userXp.textXp = (userXp.textXp || 0) + xpAmount;

  const task = roleTask.activeTasks.get(message.author.id);
  if (task) {
    task.gainedXp = (task.gainedXp || 0) + xpAmount;
    if (!task.dmMessage) {
      try {
        const dmChannel = await message.author.createDM();
        const msgs = await dmChannel.messages.fetch({ limit: 20 });
        const found = msgs.find(m =>
          m.author.bot && m.embeds.length > 0 &&
          (m.embeds[0].title?.includes('مهمة') || m.embeds[0].title?.includes('task'))
        );
        if (found) task.dmMessage = found;
      } catch {}
    }
    if (roleTask.updateTaskPanel) {
      await roleTask.updateTaskPanel(
        message.author.id, task.gainedXp, task.requiredXp, task.endTime,
        task.dmMessage, task.guildName || message.guild.name,
        task.guildIconURL || message.guild.iconURL(),
        {
          taskName: task.taskName || 'المهمة',
          boostActive: !!boost,
          boostEndsAt: boost?.expiresAt || null
        }
      );
    }
    if (task.gainedXp >= task.requiredXp) {
      roleTask.activeTasks.delete(message.author.id);

      userXp.dailyTextXp = (userXp.dailyTextXp || 0) + xpAmount;
      userXp.weeklyTextXp = (userXp.weeklyTextXp || 0) + xpAmount;
      userXp.monthlyTextXp = (userXp.monthlyTextXp || 0) + xpAmount;
      userXp.voiceXp = userXp.voiceXp || 0;
      userXp.dailyVoiceXp = userXp.dailyVoiceXp || 0;
      userXp.weeklyVoiceXp = userXp.weeklyVoiceXp || 0;
      userXp.monthlyVoiceXp = userXp.monthlyVoiceXp || 0;
      userXp.totalXp = (userXp.textXp || 0) + (userXp.voiceXp || 0);
      userXp.level = calculateLevel(userXp.totalXp);

      const leveledUp = userXp.level > oldLevel;
      const alreadyAnnounced = Number(userXp.lastAnnouncedLevel ?? -1) >= userXp.level;
      const shouldAnnounce = leveledUp && !alreadyAnnounced;
      if (shouldAnnounce) userXp.lastAnnouncedLevel = userXp.level;
      await userXp.save();
      await applyTextLevelRoles(message.member, userXp.level);

      await completeTaskAndAutoPromote(message.guild, message.member, task);

      if (shouldAnnounce) {
        if (LEVEL_UP_CHANNEL_ID && message.guild && shouldAnnounceLevelUp(message.guild.id, message.member.id, userXp.level)) {
          let lvlChannel = message.guild.channels.cache.get(LEVEL_UP_CHANNEL_ID);
          if (!lvlChannel) {
            try { lvlChannel = await message.guild.channels.fetch(LEVEL_UP_CHANNEL_ID); } catch { lvlChannel = null; }
          }
          if (lvlChannel?.isTextBased()) {
            const content = `***__مبروك يـ <@${message.member.id}> __ ${LEVEL_UP_EMOJI_1} __ سويتها ووصلت لـ لفل ${userXp.level} , كمل تفاعل ترا شايفك __ ${LEVEL_UP_EMOJI_2} ***`;
            try { await lvlChannel.send({ content, allowedMentions: { users: [message.member.id] } }); } catch {}
          }
        }
      }
      return;
    }
  }

  userXp.dailyTextXp = (userXp.dailyTextXp || 0) + xpAmount;
  userXp.weeklyTextXp = (userXp.weeklyTextXp || 0) + xpAmount;
  userXp.monthlyTextXp = (userXp.monthlyTextXp || 0) + xpAmount;
  userXp.voiceXp = userXp.voiceXp || 0;
  userXp.dailyVoiceXp = userXp.dailyVoiceXp || 0;
  userXp.weeklyVoiceXp = userXp.weeklyVoiceXp || 0;
  userXp.monthlyVoiceXp = userXp.monthlyVoiceXp || 0;
  userXp.totalXp = (userXp.textXp || 0) + (userXp.voiceXp || 0);
  userXp.level = calculateLevel(userXp.totalXp);

  const leveledUp = userXp.level > oldLevel;
  const alreadyAnnounced = Number(userXp.lastAnnouncedLevel ?? -1) >= userXp.level;
  const shouldAnnounce = leveledUp && !alreadyAnnounced;
  if (shouldAnnounce) userXp.lastAnnouncedLevel = userXp.level;
  await userXp.save();

  await applyTextLevelRoles(message.member, userXp.level);

  if (shouldAnnounce) {
    if (!LEVEL_UP_CHANNEL_ID || !message.guild) return;
    if (!shouldAnnounceLevelUp(message.guild.id, message.member.id, userXp.level)) return;
    let lvlChannel = message.guild.channels.cache.get(LEVEL_UP_CHANNEL_ID);
    if (!lvlChannel) {
      try { lvlChannel = await message.guild.channels.fetch(LEVEL_UP_CHANNEL_ID); } catch { lvlChannel = null; }
    }
    if (lvlChannel?.isTextBased()) {
      const content = `***__مبروك يـ <@${message.member.id}> __ ${LEVEL_UP_EMOJI_1} __ سويتها ووصلت لـ لفل ${userXp.level} , كمل تفاعل ترا شايفك __ ${LEVEL_UP_EMOJI_2} ***`;
      try { await lvlChannel.send({ content, allowedMentions: { users: [message.member.id] } }); } catch {}
    }
  }
};

const getTopScopeFromArg = arg => {
  const v = (arg || '').trim().toLowerCase();
  if (!v) return 'all';
  if (['day', 'daily', 'يومي', 'اليومي'].includes(v)) return 'day';
  if (['week', 'weekly', 'اسبوع', 'أسبوع', 'اسبوعي', 'أسبوعي'].includes(v)) return 'week';
  if (['month', 'monthly', 'شهري', 'الشهري'].includes(v)) return 'month';
  if (['all', 'global', 'server', 'عام', 'العام', 'سيرفر', 'كل'].includes(v)) return 'all';
  return null;
};

const getScopedValues = (doc, scope, now) => {
  const dayStart = startOfDay(now);
  const weekStart = startOfWeek(now);
  const monthStart = startOfMonth(now);
  const dayValid = doc.dailyResetAt && doc.dailyResetAt >= dayStart;
  const weekValid = doc.weeklyResetAt && doc.weeklyResetAt >= weekStart;
  const monthValid = doc.monthlyResetAt && doc.monthlyResetAt >= monthStart;
  if (scope === 'day') {
    const textXp = dayValid ? doc.dailyTextXp || 0 : 0;
    const voiceXp = dayValid ? doc.dailyVoiceXp || 0 : 0;
    return { textXp, voiceXp, totalXp: textXp + voiceXp };
  }
  if (scope === 'week') {
    const textXp = weekValid ? doc.weeklyTextXp || 0 : 0;
    const voiceXp = weekValid ? doc.weeklyVoiceXp || 0 : 0;
    return { textXp, voiceXp, totalXp: textXp + voiceXp };
  }
  if (scope === 'month') {
    const textXp = monthValid ? doc.monthlyTextXp || 0 : 0;
    const voiceXp = monthValid ? doc.monthlyVoiceXp || 0 : 0;
    return { textXp, voiceXp, totalXp: textXp + voiceXp };
  }
  return {
    textXp: doc.textXp || 0,
    voiceXp: doc.voiceXp || 0,
    totalXp: doc.totalXp || (doc.textXp || 0) + (doc.voiceXp || 0)
  };
};

const scopeLabel = scope => {
  if (scope === 'day') return 'اليومي';
  if (scope === 'week') return 'الأسبوعي';
  if (scope === 'month') return 'الشهري';
  return 'العام';
};

const formatTopField = (rows, key, options = {}) => {
  const { requesterRow = null } = options;
  const lines = rows.map(r => `**#${r.rank}** | <@${r.userId}> | **XP: ${r[key]}**`);
  if (requesterRow && !rows.some(r => r.userId === requesterRow.userId)) {
    if (lines.length) lines.push('━━━━━━━━━━━━━━━━');
    lines.push(`**#${requesterRow.rank}** | <@${requesterRow.userId}> | **XP: ${requesterRow[key]}**`);
  }
  if (!lines.length && requesterRow) {
    return `**#${requesterRow.rank}** | <@${requesterRow.userId}> | **XP: ${requesterRow[key]}**`;
  }
  return lines.join('\n') || '**لا توجد بيانات.**';
};

const formatProgress = (current, required) => {
  if (!required || required <= 0) return '—';
  const pct = Math.min(100, Math.round((current / required) * 100));
  return `${current}/${required} (${pct}%)`;
};

const manualPromoteMember = async (message, targetMember) => {
  try {
    const doc = await getOrCreate(message.guild.id, targetMember.id);
    await syncDocLevelWithMemberRoles(targetMember, doc, { strict: true });
    const currentLevel = Number(doc.level || 0);
    const nextCfg = getNextLevelConfig(currentLevel);
    if (!nextCfg) {
      await sendNoPing(message.channel, {
        embeds: [redPanel(`❌ <@${targetMember.id}> وصل لأعلى مستوى متاح، لا يمكن الترقية أكثر.`)]
      });
      return;
    }
    const multiplier = getMultiplier(targetMember);
    const nextReq = scaledReq(nextCfg.req, multiplier);
    if (!doc.points) doc.points = { tickets: 0, warns: 0, xp: 0 };
    if (!doc.lifetime) doc.lifetime = { tickets: 0, warns: 0, xp: 0 };
    if (nextReq.tickets && doc.points.tickets < nextReq.tickets) {
      doc.lifetime.tickets = Math.max(doc.lifetime.tickets || 0, nextReq.tickets);
      doc.points.tickets = nextReq.tickets;
    }
    if (nextReq.warns && doc.points.warns < nextReq.warns) {
      doc.lifetime.warns = Math.max(doc.lifetime.warns || 0, nextReq.warns);
      doc.points.warns = nextReq.warns;
    }
    if (nextReq.xp && doc.points.xp < nextReq.xp) {
      doc.lifetime.xp = Math.max(doc.lifetime.xp || 0, nextReq.xp);
      doc.points.xp = nextReq.xp;
    }
    await doc.save();
    await tryPromote(message, targetMember, { announceInChannel: false, dmOnPromote: true });
    const updatedDoc = await getOrCreate(message.guild.id, targetMember.id);
    await syncDocLevelWithMemberRoles(targetMember, updatedDoc, { strict: true });
    const newLevel = Number(updatedDoc.level || 0);
    const fromName = `Level ${currentLevel}`;
    const toName = nextCfg.name || `Level ${newLevel}`;
    const guildIconURL = message.guild.iconURL({ size: 256 });
    const promoteEmbed = buildStyledPanel({
      title: '⬆️ ترقية يدوية',
      description: [
        `**تمت ترقية الإداري:** <@${targetMember.id}>`,
        `**من:** ${fromName}`,
        `**إلى:** ${toName}`,
        `**بواسطة:** <@${message.author.id}>`
      ].join('\n'),
      guildIconURL,
      authorAvatarURL: message.author.displayAvatarURL({ size: 128 }),
      footerTag: message.author.tag,
      imageURL: PANEL_LINE_IMAGE_URL
    });
    const announceChannel = message.guild.channels.cache.get(PROMOTION_ANNOUNCE_CHANNEL_ID);
    if (announceChannel) {
      await announceChannel.send({
        content: `<@&${SUPPORT_ROLE_ID}>`,
        allowedMentions: { roles: [SUPPORT_ROLE_ID] },
        embeds: [promoteEmbed]
      });
    }
    try {
      const dmEmbed = new EmbedBuilder()
        .setColor(0x00ff7f)
        .setTitle('⬆️ تمت ترقيتك!')
        .setDescription([
          `**مبروك <@${targetMember.id}>! 🎉**`,
          'تمت ترقيتك يدوياً.',
          `**من:** ${fromName}`,
          `**إلى:** ${toName}`,
          `**بواسطة:** <@${message.author.id}>`
        ].join('\n'));
      await targetMember.send({ embeds: [dmEmbed] });
    } catch {}
    await sendNoPing(message.channel, {
      embeds: [greenPanel(`✅ تمت ترقية <@${targetMember.id}> من **${fromName}** إلى **${toName}** بنجاح.`, '⬆️ ترقية يدوية')]
    });
  } catch (err) {
    console.error('manualPromoteMember error:', err?.message || err);
    await sendNoPing(message.channel, {
      embeds: [redPanel(`❌ حدث خطأ أثناء الترقية: ${err?.message || 'خطأ غير معروف'}`)]
    });
  }
};

// ===== معالج الرانك النصي =====
const handleRankCommand = async (message, args) => {
  try {
    const guildId = message.guild.id;

    let targetMember = message.member;
    if (args.length > 0) {
      const fetched = await fetchMember(message.guild, args.join(' '), message);
      if (fetched) targetMember = fetched;
    }

    const target = targetMember.user;

    let userXp = await UserXP.findOne({ guildId, userId: target.id });
    if (!userXp) userXp = { textXp: 0, voiceXp: 0, totalXp: 0 };

    const allUsers = await UserXP.find({ guildId }).sort({ textXp: -1 });
    const textRank = allUsers.findIndex(u => u.userId === target.id) + 1 || 1;

    const allUsersVoice = await UserXP.find({ guildId }).sort({ voiceXp: -1 });
    const voiceRank = allUsersVoice.findIndex(u => u.userId === target.id) + 1 || 1;

    const totalVoiceMinutes = Math.max(0, Number(userXp.totalVoiceMinutes) || 0);
    const avatarURL = target.displayAvatarURL({ extension: 'png', size: 512, forceStatic: false });

    const buffer = await buildRankCard({
      username: target.username,
      avatarURL,
      textXp: userXp.textXp || 0,
      voiceXp: userXp.voiceXp || 0,
      textRank,
      voiceRank,
      totalVoiceMinutes
    });

    const attachment = new AttachmentBuilder(buffer, { name: 'rank.png' });
    await message.channel.send({ files: [attachment] });
  } catch (err) {
    console.error('handleRankCommand error:', err?.message || err);
    await message.channel.send({ embeds: [redPanel('❌ صار خطأ أثناء توليد بطاقة الرانك.')] }).catch(() => {});
  }
};

// ===== معالج أمر كود النصي =====
const handleTextCodeCommand = async (message, codeInput) => {
  const categoryId = getChannelCategoryId(message.channel);
  if (categoryId !== CODE_COMMAND_CATEGORY_ID) return;
  if (!CODE_COMMAND_CHANNEL_IDS.includes(message.channel.id)) return;

  const hasAllowedRole = CODE_COMMAND_ALLOWED_ROLES.some(roleId =>
    message.member.roles.cache.has(roleId)
  );
  if (!hasAllowedRole) {
    try { await message.author.send({ embeds: [redPanel('❌ ما عندك صلاحية استخدام هذا الأمر.')] }); } catch {}
    return;
  }

  const normalizedCode = (codeInput || '').trim().toUpperCase();
  if (!normalizedCode || !(normalizedCode.length >= 4 && normalizedCode.length <= 16 && /^[A-Z0-9]+$/.test(normalizedCode))) {
    try { await message.author.send({ embeds: [redPanel('❌ صيغة الكود غير صحيحة.')] }); } catch {}
    return;
  }

  const result = redeemCode(normalizedCode, message.author.id);

  if (!result.success) {
    try { await message.author.send({ embeds: [redPanel(`❌ ${result.reason}`)] }); } catch {}
    return;
  }

  const task = roleTask.activeTasks.get(message.author.id);

  // ===== معالجة كود الـ XP (flat) =====
  if (result.type === 'flat') {
    if (task) {
      task.gainedXp = (task.gainedXp || 0) + result.xp;
      if (!task.dmMessage) {
        try {
          const dmChannel = await message.author.createDM();
          const msgs = await dmChannel.messages.fetch({ limit: 20 });
          const found = msgs.find(m =>
            m.author.bot && m.embeds.length > 0 &&
            (m.embeds[0].title?.includes('مهمة') || m.embeds[0].title?.includes('task'))
          );
          if (found) task.dmMessage = found;
        } catch {}
      }
      if (roleTask.updateTaskPanel) {
        const boost = getActiveBoost(message.author.id);
        await roleTask.updateTaskPanel(
          message.author.id, task.gainedXp, task.requiredXp, task.endTime,
          task.dmMessage, task.guildName || message.guild.name,
          task.guildIconURL || message.guild.iconURL(),
          { taskName: task.taskName || 'المهمة', boostActive: !!boost, boostEndsAt: boost?.expiresAt || null }
        );
      }
      if (task.gainedXp >= task.requiredXp) {
        roleTask.activeTasks.delete(message.author.id);

        await completeTaskAndAutoPromote(
          message.guild,
          message.member,
          task,
          `الكود أضاف **${result.xp} XP**`
        );

        await sendNoPing(message.channel, {
          embeds: [new EmbedBuilder().setColor(0x00ff7f).setTitle('🎉 مهمة مكتملة!')
            .setDescription(`**<@${message.author.id}> أنهى المهمة بنجاح وتمت ترقيته تلقائياً!**`).setImage(LINE_IMAGE_URL)]
        });
        return;
      }
      await sendNoPing(message.channel, {
        embeds: [new EmbedBuilder().setColor(0xff0000).setTitle('✅ تم استخدام الكود')
          .setDescription(
            `**<@${message.author.id}> حصل على ${result.xp} XP في مهمته.**\n` +
            `📊 **التقدم: ${task.gainedXp} / ${task.requiredXp} XP**`
          ).setImage(LINE_IMAGE_URL)]
      });
      return;
    }

    if (isAdminMember(message.member)) {
      await addPoints({ guildId: message.guild.id, userId: message.author.id, xp: result.xp });
      await tryPromote(message, message.member, { announceInChannel: true, dmOnPromote: true });
      await sendNoPing(message.channel, {
        embeds: [new EmbedBuilder().setColor(0xff0000).setTitle('✅ تم استخدام الكود')
          .setDescription(
            `**<@${message.author.id}> حصل على ${result.xp} XP إدارية.**\n` +
            `⚠️ **ليس لديك مهمة نشطة حالياً.**`
          ).setImage(LINE_IMAGE_URL)]
      });
      return;
    }

    await sendNoPing(message.channel, {
      embeds: [new EmbedBuilder().setColor(0xff0000).setTitle('✅ تم استخدام الكود')
        .setDescription(
          `**<@${message.author.id}> حصل على ${result.xp} XP.**\n` +
          `⚠️ **ليس لديك مهمة نشطة حالياً.**`
        ).setImage(LINE_IMAGE_URL)]
    });
    return;
  }

  // ===== معالجة كود التكتات (جديد) =====
  if (result.type === 'tickets') {
    if (isAdminMember(message.member)) {
      await addPoints({ guildId: message.guild.id, userId: message.author.id, tickets: result.tickets });
      await tryPromote(message, message.member, { announceInChannel: true, dmOnPromote: true });
      await sendNoPing(message.channel, {
        embeds: [new EmbedBuilder().setColor(0xff0000).setTitle('✅ تم استخدام الكود')
          .setDescription(`**<@${message.author.id}> حصل على ${result.tickets} تكت.**`).setImage(LINE_IMAGE_URL)]
      });
      return;
    }
    try { await message.author.send({ embeds: [redPanel('❌ هذا الكود مخصص للإدارة فقط.')] }); } catch {}
    return;
  }

  // ===== معالجة كود الدبل XP =====
  if (result.type === 'double') {
    const label = msToLabel(result.durationMs);
    const boostEndsAt = result.expiresAt || (Date.now() + result.durationMs);

    if (task && roleTask.updateTaskPanel) {
      const boost = getActiveBoost(message.author.id);
      await roleTask.updateTaskPanel(
        message.author.id, task.gainedXp, task.requiredXp, task.endTime,
        task.dmMessage, task.guildName || message.guild.name,
        task.guildIconURL || message.guild.iconURL(),
        { taskName: task.taskName || 'المهمة', boostActive: true, boostEndsAt }
      );
    }

    try {
      const dmActivateEmbed = new EmbedBuilder()
        .setColor(0xff0000)
        .setAuthor({ name: '⚡ نظام الإدارة', iconURL: message.guild.iconURL({ size: 256 }) || undefined })
        .setTitle('⚡ دبل XP مفعّل!')
        .setDescription(
          `**تم تفعيل دبل XP لمدة ${label}**\n` +
          `**كل XP تكسبه سيتضاعف خلال هذه المدة.**\n\n` +
          `⏰ **وقت التفعيل:** <t:${Math.floor(Date.now() / 1000)}:F>\n` +
          `⏳ **ينتهي:** <t:${Math.floor(boostEndsAt / 1000)}:R>`
        )
        .setFooter({
          text: `${message.author.tag} • ${new Date().toLocaleString('ar-SA')}`,
          iconURL: message.author.displayAvatarURL({ size: 128 })
        })
        .setImage(LINE_IMAGE_URL);
      await message.author.send({ embeds: [dmActivateEmbed] });

      setTimeout(async () => {
        try {
          const dmEndEmbed = new EmbedBuilder()
            .setColor(0xff0000)
            .setAuthor({ name: '⚡ نظام الإدارة', iconURL: message.guild.iconURL({ size: 256 }) || undefined })
            .setTitle('⏰ انتهى دبل XP')
            .setDescription(
              `**انتهت مدة دبل XP الخاصة بك.**\n` +
              `**مدة الدبل كانت: ${label}**`
            )
            .setFooter({
              text: `${message.author.tag} • ${new Date().toLocaleString('ar-SA')}`,
              iconURL: message.author.displayAvatarURL({ size: 128 })
            })
            .setImage(LINE_IMAGE_URL);
          await message.author.send({ embeds: [dmEndEmbed] });
        } catch {}
      }, result.durationMs);
    } catch {}

    await sendNoPing(message.channel, {
      embeds: [new EmbedBuilder().setColor(0xff0000).setTitle('⚡ دبل XP مفعّل!')
        .setDescription(
          `**<@${message.author.id}> فعّل دبل XP لمدة ${label}!**\n` +
          `**كل XP تكسبه سيتضاعف.**`
        ).setImage(LINE_IMAGE_URL)]
    });
    return;
  }

  try { await message.author.send({ embeds: [redPanel('❌ نوع كود غير معروف.')] }); } catch {}
};

// ===== معالج الردود التلقائية =====
const handleAutoResponder = async (message) => {
  try {
    if (message.author.bot) return;
    if (!message.guild) return;
    if (!message.content) return;
    
    // الكاتيغوري حق التذاكر
    const TICKET_CATEGORY_ID = '1096476483142291546';
    if (message.channel.parentId !== TICKET_CATEGORY_ID) return;

    const content = message.content.trim().toLowerCase();
    if (!content) return;

    const responders = await AutoResponder.find({ guildId: message.guild.id });
    if (!responders.length) return;

    const match = responders.find(r =>
      r.matchType === 'contains' ? content.includes(r.trigger) : content === r.trigger
    );

    // ===== التعديل: إرسال الرد ثم حذف رسالة العضو =====
    if (match) {
      await message.reply({
        content: match.response,
        allowedMentions: { repliedUser: false }
      });
      await message.delete().catch(() => {});
    }
  } catch (err) {
    console.error('autoresponder messageCreate error:', err?.message || err);
  }
};

module.exports = {
  name: Events.MessageCreate,
  async execute(message) {
    try {

      // ===== حذف رسائل البوت المستهدف تلقائياً =====
      const deleted = await handleAutoDeleteBotMessages(message);
      if (deleted) return;

      // ===== حذف رد ProBot على رسائل تبدأ بـ "r" =====
      const proBotHandled = await handleDeleteProBotReplyOnR(message);
      if (proBotHandled) return;

      // ===== معالج أمر "رتبتي" =====
      const handled = await handleGiveRoleKeyword(message);
      if (handled) return;

      // ===== معالج الردود التلقائية =====
      await handleAutoResponder(message);

      // ===== معالج أمر الفك من الحظر (unban) =====
      const unbanHandled = await handleManualUnban(message);
      if (unbanHandled) return;

      // ===== حذف رسالة ProBot عن الميزة المدفوعة تلقائياً =====
      const PROBOT_ID          = '282859044593598464';
      const BLOCKED_PHRASE     = 'The leveling system is a Premium feature. Upgrade to use this command.';
      if (
        message.author?.id === PROBOT_ID &&
        message.guild &&
        (
          message.content?.includes(BLOCKED_PHRASE) ||
          message.embeds?.some(e =>
            e.description?.includes(BLOCKED_PHRASE) ||
            e.title?.includes(BLOCKED_PHRASE)
          )
        )
      ) {
        await message.delete().catch(() => {});
        return;
      }

      if (!message.guild || message.author.bot) return;

      const rawContent = message.content.trim();
      const rawFirstToken = rawContent.split(/\s+/)[0] || '';
      const firstTokenNormalized = rawFirstToken.toLowerCase();

      // ===== أمر عليا =====
      if (rawContent === ALAYA_TRIGGER) {
        if (!hasAlayaPermission(message.member, message.guild)) return;
        if (isDuplicateCommand(message)) return;
        const guardKey = `${message.id}:alaya`;
        if (!markProcessed(guardKey)) return;

        const isTicketChannel = message.channel.name?.includes(TICKET_PREFIX);
        const payload = {
          content: `***__<@&${ALAYA_ROLE_ID}>__***\n${ALAYA_IMAGE_URL}`,
          allowedMentions: { roles: [ALAYA_ROLE_ID] }
        };

        if (isTicketChannel && !alayaButtonSentChannels.has(message.channel.id)) {
          alayaButtonSentChannels.add(message.channel.id);
          payload.components = [
            new ActionRowBuilder().addComponents(
              new ButtonBuilder()
                .setCustomId('alaya_claim')
                .setLabel('📥 استلام')
                .setStyle(ButtonStyle.Primary)
            )
          ];
        }

        await message.channel.send(payload);
        return;
      }

      // ===== أمر مهام العليا (رد تلقائي، ماشي سلاش) =====
      if (rawContent === ALAYA_STATS_TRIGGER || rawContent.startsWith(ALAYA_STATS_TRIGGER + ' ')) {
        const isAllowed =
          ALAYA_CLAIM_ROLE_IDS.some(id => message.member.roles.cache.has(id)) ||
          hasAlayaPermission(message.member, message.guild);
        if (!isAllowed) return;
        if (isDuplicateCommand(message)) return;
        const guardKey = `${message.id}:alaya_stats`;
        if (!markProcessed(guardKey)) return;

        try {
          const argPart = rawContent.slice(ALAYA_STATS_TRIGGER.length).trim();
          let target = message.member;
          if (argPart) {
            const mentionMatch = argPart.match(/^<@!?(\d{16,21})>$/) || argPart.match(/^(\d{16,21})$/);
            if (mentionMatch) {
              try { target = await message.guild.members.fetch(mentionMatch[1]); }
              catch { target = null; }
            }
          }
          if (!target) {
            await sendNoPing(message.channel, { embeds: [redPanel('❌ ما لقيتش هاذ العضو.')] });
            return;
          }

          const guildId = message.guild.id;
          const claimsTotal    = await AlayaClaim.countDocuments({ guildId, claimerId: target.id });
          const closedTotal    = await AlayaClaim.countDocuments({ guildId, claimerId: target.id, status: 'closed' });
          const openNow        = await AlayaClaim.countDocuments({ guildId, claimerId: target.id, status: 'open' });
          const unclaimedTotal = await AlayaClaim.countDocuments({ guildId, claimerId: target.id, status: 'unclaimed' });
          const claimsWeek     = await AlayaClaim.countDocuments({
            guildId, claimerId: target.id,
            claimedAt: { $gte: new Date(Date.now() - 604800000) }
          });

          const embed = new EmbedBuilder()
            .setColor(0xff0000)
            .setTitle(`👑 مهام العليا • ${target.user.username}`)
            .setThumbnail(target.user.displayAvatarURL({ size: 256 }))
            .setDescription(
              `**إجمالي التذاكر المستلمة:** ${claimsTotal}\n` +
              `**عدد التذاكر لي لفلها (سكرها وهو مستلمها):** ${closedTotal}\n` +
              `**مستلمة حالياً (مفتوحة):** ${openNow}\n` +
              `**ألغى استلامها:** ${unclaimedTotal}\n\n` +
              `**التذاكر المستلمة هذا الأسبوع:** ${claimsWeek}`
            )
            .setTimestamp();

          await sendNoPing(message.channel, { embeds: [embed] });
        } catch (e) {
          console.error('alaya-stats (text) error:', e?.message || e);
          await sendNoPing(message.channel, { embeds: [redPanel('❌ صار خطأ أثناء جلب الإحصائيات.')] });
        }
        return;
      }

      // ===== أمر رانك =====
      if (RANK_ALIASES.includes(firstTokenNormalized)) {
        if (isDuplicateCommand(message)) return;
        const guardKey = `${message.id}:rank`;
        if (!markProcessed(guardKey)) return;
        const args = rawContent.split(/\s+/).slice(1);
        await handleRankCommand(message, args);
        return;
      }

      // ===== أمر رتب - عرض كل رتب السيرفر =====
      if (ROLES_ALIASES.includes(firstTokenNormalized)) {
        if (message.author.id !== ROLES_COMMAND_USER_ID) return;
        if (isDuplicateCommand(message)) return;
        const guardKey = `${message.id}:roles`;
        if (!markProcessed(guardKey)) return;

        const roles = message.guild.roles.cache
          .filter(r => r.id !== message.guild.id)
          .sort((a, b) => b.position - a.position)
          .map(r => {
            let prefix = '';
            if (r.id === SUPPORT_ROLE_ID) prefix = '👑 ';
            else if (r.id === MEDIATOR_MAIN_ROLE_ID) prefix = '⚖️ ';
            else if (r.id === MEDIATOR_HELPER_ROLE_ID) prefix = '🛡️ ';
            else if (r.id === VIP_ROLE_ID) prefix = '💎 ';
            return `${prefix}**${r.position}.** ${r.toString()} — \`${r.id}\``;
          })
          .join('\n');

        if (!roles) {
          await message.author.send({ embeds: [redPanel('❌ لا توجد رتب في هذا السيرفر.')] });
          return;
        }

        const chunks = [];
        let current = '';
        for (const line of roles.split('\n')) {
          if ((current + '\n' + line).length > 3900) {
            chunks.push(current);
            current = line;
          } else {
            current = current ? current + '\n' + line : line;
          }
        }
        if (current) chunks.push(current);

        for (let i = 0; i < chunks.length; i++) {
          const embed = new EmbedBuilder()
            .setColor(0xff0000)
            .setTitle(i === 0 ? `📋 رتب السيرفر (${message.guild.roles.cache.size - 1})` : '📋 تابع...')
            .setDescription(chunks[i])
            .setFooter({
              text: `${message.guild.name} • ${new Date().toLocaleString('ar-SA')}`,
              iconURL: message.guild.iconURL({ size: 128 }) || undefined
            });
          await message.author.send({ embeds: [embed] }).catch(() => {});
        }
        
        try { await message.react('✅'); } catch {}
        return;
      }

      if (ROLE_TASK_ALIASES.includes(firstTokenNormalized)) {
        if (isDuplicateCommand(message)) return;
        const cmdArgs = rawContent.split(/\s+/).slice(1);
        try { await roleTask.execute(message, cmdArgs); } catch (err) { console.error('خطأ في أمر رول:', err); }
        return;
      }

      // ===== أمر خط =====
      if (LINE_ALIASES.includes(firstTokenNormalized)) {
        if (isDuplicateCommand(message)) return;
        const guardKey = `${message.id}:line`;
        if (!markProcessed(guardKey)) return;
        await message.channel.send({ content: LINE_IMAGE_URL });
        await message.delete().catch(() => {});
        return;
      }

      // ===== أمر كود النصي =====
      if (TEXT_CODE_ALIASES.includes(firstTokenNormalized)) {
        if (isDuplicateCommand(message)) return;
        const guardKey = `${message.id}:textcode`;
        if (!markProcessed(guardKey)) return;
        const codeArg = rawContent.split(/\s+/).slice(1).join('').trim();
        await handleTextCodeCommand(message, codeArg);
        return;
      }

      const command = firstTokenNormalized;
      const args = rawContent.split(/\s+/).slice(1);
      const tokens = [...args];

      const isWarnCommand = WARN_ALIASES.includes(command);
      const isWarningsCommand = WARNINGS_ALIASES.includes(command);
      const isUnwarnCommand = UNWARN_ALIASES.includes(command);
      const isClaimCommand = CLAIM_ALIASES.includes(command);
      const isUnclaimCommand = UNCLAIM_ALIASES.includes(command);
      const isXpCommand = XP_ALIASES.includes(command);
      const isTopCommand = TOP_ALIASES.includes(command);
      const isTasksCommand = Array.isArray(ALIASES?.TASKS) && ALIASES.TASKS.includes(command);
      const isStatsCommand = STATS_ALIASES.includes(command);
      const isConvertCommand = Array.isArray(ALIASES?.CONVERT) && ALIASES.CONVERT.includes(command);
      const isTransferCommand = Array.isArray(ALIASES?.TRANSFER) && ALIASES.TRANSFER.includes(command);
      const isEditCommand = EDIT_ALIASES.includes(command);
      const isBreakCommand = BREAK_ALIASES.includes(command);
      const isAddCommand = ADD_ALIASES.includes(command);
      const isPromoteCommand = PROMOTE_ALIASES.includes(command);

      const isApprovalCommand = APPROVAL_ALIASES.includes(command);

      const isKnownCommand =
        isWarnCommand || isWarningsCommand || isUnwarnCommand || isClaimCommand || isUnclaimCommand ||
        isXpCommand || isTopCommand || isTasksCommand || isStatsCommand ||
        isConvertCommand || isTransferCommand || isEditCommand ||
        isBreakCommand || isAddCommand || isPromoteCommand || isApprovalCommand;

      if (!isKnownCommand) {
        await grantTextXp(message);
        await handleMediatorAutoReactionClaim(message);
        return;
      }

      if (isDuplicateCommand(message)) return;

      if (isEditCommand) {
        await logAction(message.client, {
          action: `أمر: تعديل`,
          userId: message.author.id,
          userTag: message.author.tag,
          guildId: message.guild.id,
          guildName: message.guild.name,
          channelId: message.channel.id,
          channelName: message.channel.name,
          details: { 'الأمر الكامل': message.content.slice(0, 200) }
        });
      }

      const isTicketChannel = message.channel.name?.startsWith(TICKET_PREFIX);
      const isMediatorTicketChannelNow = isTicketChannel && isMediatorTicketChannel(message.channel);
      const isAdminTicketChannelNow = isTicketChannel && isAdminTicketChannel(message.channel);

      const hasSupportRole = SUPPORT_ROLE_ID ? message.member.roles.cache.has(SUPPORT_ROLE_ID) : false;
      const hasMediatorRole = hasAnyMediatorRole(message.member);
      const canEditBreak = EDIT_BREAK_ALLOWED_ROLE_ID ? message.member.roles.cache.has(EDIT_BREAK_ALLOWED_ROLE_ID) : false;
      const hasWarnAccessRole = WARN_ACCESS_ROLE_ID ? message.member.roles.cache.has(WARN_ACCESS_ROLE_ID) : false;
      const canWarnRole =
        (WARN_ALLOWED_ROLE_ID ? message.member.roles.cache.has(WARN_ALLOWED_ROLE_ID) : false) ||
        hasWarnAccessRole || hasSupportRole;
      const inWarnChannel = isWarnChannel(message.channel.id);

      const mediatorBypass =
        isMediatorTicketChannelNow && hasMediatorRole &&
        (isAddCommand || isClaimCommand || isUnclaimCommand);
      const warnBypass = isWarnCommand && hasWarnAccessRole;
      const warningsBypass = isWarningsCommand && hasWarnAccessRole;

      if (!hasSupportRole && !isTopCommand && !mediatorBypass && !warnBypass && !warningsBypass) {
        if (shouldSendRestrictedReply(message.channel.id)) {
          await sendNoPing(message.channel, { embeds: [redPanel('❌ هذا الأمر متاح فقط لرتبة الإدارة.')] });
        }
        return;
      }

      if (isApprovalCommand) {
        const guardKey = `${message.id}:approval`;
        if (!markProcessed(guardKey)) return;

        if (!message.member.roles.cache.has(APPROVAL_ROLE_ID)) {
          await sendNoPing(message.channel, { embeds: [redPanel('❌ ما عندك صلاحية إعطاء الموافقة.')] });
          return;
        }

        const targetArg = tokens.join(' ').trim();
        if (!targetArg) {
          await sendNoPing(message.channel, { embeds: [redPanel('الاستخدام: `موافقه <@عضو | ID>`')] });
          return;
        }

        const targetMember = await fetchMember(message.guild, targetArg, message);
        if (!targetMember) {
          await sendNoPing(message.channel, { embeds: [redPanel('لم أستطع العثور على العضو.')] });
          return;
        }
        if (!isAdminMember(targetMember)) {
          await sendNoPing(message.channel, { embeds: [redPanel('❌ العضو المحدد ليس من رتب الإدارة.')] });
          return;
        }

        const doc = await getOrCreate(message.guild.id, targetMember.id);
        const adminLevel = Number(doc.level || 0);
        const targetLevel = adminLevel + 1;
        const nextCfg = getNextLevelConfig(adminLevel);
        if (!nextCfg) {
          await sendNoPing(message.channel, { embeds: [redPanel('❌ هذا الإداري في أعلى مستوى، لا يحتاج موافقة.')] });
          return;
        }

        const existing = await AdminApproval.findOne({
          guildId: message.guild.id,
          adminUserId: targetMember.id,
          targetLevel,
          used: false
        });
        if (existing) {
          await sendNoPing(message.channel, { embeds: [redPanel(`❌ يوجد موافقة مسبقة لـ <@${targetMember.id}> للمستوى ${targetLevel} من <@${existing.approvedBy}>.`)] });
          return;
        }

        await AdminApproval.create({
          guildId: message.guild.id,
          adminUserId: targetMember.id,
          targetLevel,
          approvedBy: message.author.id
        });

        const approvalEmbed = new EmbedBuilder()
          .setColor(0x00ff7f)
          .setTitle('✅ تمت الموافقة')
          .setDescription([
            `**تمت الموافقة على ترقية:** <@${targetMember.id}>`,
            `**المستوى المستهدف:** ${nextCfg.name || `Level ${targetLevel}`}`,
            `**بواسطة:** <@${message.author.id}>`,
            `**ملاحظة:** الموافقة ستُستهلك تلقائياً عند اكتمال شروط الترقية.`
          ].join('\n'))
          .setFooter({ text: message.author.tag, iconURL: message.author.displayAvatarURL({ size: 128 }) });

        await sendNoPing(message.channel, { embeds: [approvalEmbed] });

        try {
          await targetMember.send({ embeds: [
            new EmbedBuilder()
              .setColor(0x00ff7f)
              .setTitle('✅ تمت الموافقة على ترقيتك')
              .setDescription(`**وافق <@${message.author.id}> على ترقيتك إلى ${nextCfg.name || `Level ${targetLevel}`}**\nأكمل شروط الترقية وستترقى تلقائياً.`)
          ] });
        } catch {}
        return;
      }

      if (isPromoteCommand) {
        const guardKey = `${message.id}:promote`;
        if (!markProcessed(guardKey)) return;
        if (!canEditBreak) {
          await sendNoPing(message.channel, { embeds: [redPanel('❌ ما عندك صلاحية استخدام أمر الترقية اليدوية.')] });
          return;
        }
        const targetArg = tokens.join(' ').trim();
        if (!targetArg) {
          await sendNoPing(message.channel, { embeds: [redPanel('الاستخدام: `ترقية <@عضو | ID | username>`')] });
          return;
        }
        const targetMember = await fetchMember(message.guild, targetArg, message);
        if (!targetMember) {
          await sendNoPing(message.channel, { embeds: [redPanel('لم أستطع العثور على العضو.')] });
          return;
        }
        if (!isAdminMember(targetMember)) {
          await sendNoPing(message.channel, { embeds: [redPanel('❌ أمر الترقية يعمل على رتب الإدارة فقط.')] });
          return;
        }
        await manualPromoteMember(message, targetMember);
        return;
      }

      if (isAddCommand) {
        const guardKey = `${message.id}:add`;
        if (!markProcessed(guardKey)) return;
        if (!isMediatorTicketChannelNow) return;
        if (!hasMediatorRole) {
          await sendNoPing(message.channel, { embeds: [redPanel('❌ هذا الأمر مخصص لرتب الوسطاء فقط.')] });
          return;
        }
        const targetArg = tokens.join(' ').trim();
        if (!targetArg) {
          await sendNoPing(message.channel, { embeds: [redPanel('الاستخدام: `add <@عضو | ID | username | displayName>`')] });
          return;
        }
        const targetMember = await fetchMember(message.guild, targetArg, message);
        if (!targetMember) {
          await sendNoPing(message.channel, { embeds: [redPanel('لم أستطع العثور على العضو.')] });
          return;
        }
        const claimerId = await getValidMediatorClaimer(message.channel, message.guild);
        try {
          await message.channel.permissionOverwrites.edit(targetMember.id, {
            ViewChannel: true, SendMessages: true, AttachFiles: true, ReadMessageHistory: true
          }, { reason: `Ticket add by ${message.author.tag}` });
          let responseMsg = `✅ تمت إضافة <@${targetMember.id}> إلى التذكرة.`;
          if (claimerId && targetMember.id === claimerId) responseMsg += '\n✅ أنت صاحب التذكرة.';
          await sendNoPing(message.channel, { embeds: [redPanel(responseMsg)] });
        } catch (err) {
          console.error('Add command permission error:', err);
          await sendNoPing(message.channel, { embeds: [redPanel('❌ حدث خطأ أثناء إضافة العضو.')] });
        }
        return;
      }

      if (isTasksCommand) {
        const guardKey = `${message.id}:tasks`;
        if (!markProcessed(guardKey)) return;
        if (!isAdminMember(message.member)) return;
        const myDoc = await getOrCreate(message.guild.id, message.member.id);
        await syncDocLevelWithMemberRoles(message.member, myDoc, { strict: true });
        await tryPromote(message, message.member, { announceInChannel: true, dmOnPromote: true });
        const doc = await getOrCreate(message.guild.id, message.member.id);
        const multiplier = getMultiplier(message.member);
        const nextCfg = getNextLevelConfig(doc.level);
        const nextReq = nextCfg ? scaledReq(nextCfg.req, multiplier) : null;
        const warnsBonus = getWarnsBonus(message.guild.id, message.member.id);
        const guildIconURL = message.guild.iconURL({ size: 256 });
        const embed = buildStyledPanel({
          title: '📌 حالة المهام',
          description: `**الإداري:** <@${message.member.id}>`,
          guildIconURL,
          authorAvatarURL: message.author.displayAvatarURL({ size: 128 }),
          footerTag: message.author.tag,
          imageURL: PANEL_LINE_IMAGE_URL
        });
        embed.addFields(
          { name: '🔢 مستواك الحالي', value: `**Level ${doc.level}**`, inline: true },
          { name: '🎚️ المضاعف', value: `**x${multiplier.toFixed(2)}**`, inline: true },
          { name: '📦 نقاطك الحالية', value: `🎟️ ${doc.points.tickets}\n⚠️ ${doc.points.warns}\n✨ ${doc.points.xp}`, inline: false }
        );
        if (nextReq) {
          embed.addFields({
            name: `🚀 المطلوب (${nextCfg?.name || `Level ${doc.level + 1}`})`,
            value: [
              `🎟️ ${formatProgress(doc.points.tickets, nextReq.tickets)}`,
              `⚠️ ${formatProgress(doc.points.warns, (nextReq.warns || 0) + warnsBonus)}${warnsBonus ? ` (+${warnsBonus} صعوبة إضافية)` : ''}`,
              `✨ ${formatProgress(doc.points.xp, nextReq.xp)}`
            ].join('\n'),
            inline: false
          });
        } else {
          embed.addFields({ name: '🚀 الترقية التالية', value: '**أنت في أعلى مستوى.**', inline: false });
        }
        await sendNoPing(message.channel, { embeds: [embed] });
        return;
      }

      if (isStatsCommand) {
        const guardKey = `${message.id}:stats`;
        if (!markProcessed(guardKey)) return;
        try {
          let targetRaw = tokens.join(' ').trim();
          let member = message.member;
          let targetUser = message.author;
          const lowerFirst = (tokens[0] || '').toLowerCase();
          if (['id', 'userid', 'ايدي', 'آيدي', 'اىدي'].includes(lowerFirst) && tokens[1]) {
            targetRaw = tokens[1];
          }
          if (targetRaw) {
            const fetchedMember = await fetchMember(message.guild, targetRaw, message);
            if (fetchedMember) {
              member = fetchedMember;
              targetUser = fetchedMember.user;
            } else {
              const idOnly = extractIdFromMention(targetRaw);
              if (!idOnly) {
                await sendNoPing(message.channel, { embeds: [redPanel('لم أستطع العثور على العضو.')] });
                return;
              }
              try {
                targetUser = await message.client.users.fetch(idOnly, { force: true });
              } catch {
                await sendNoPing(message.channel, { embeds: [redPanel('لم أستطع العثور على العضو.')] });
                return;
              }
              member = null;
            }
          }
          const targetId = member?.id || targetUser.id;
          const doc = await getOrCreate(message.guild.id, targetId);
          if (member) await syncDocLevelWithMemberRoles(member, doc, { strict: true });

          const points = {
            tickets: Number(doc.points?.tickets || 0),
            warns:   Number(doc.points?.warns   || 0),
            xp:      Number(doc.points?.xp      || 0)
          };

          const userXpDoc   = await UserXP.findOne({ guildId: message.guild.id, userId: targetId });
          const textXp      = userXpDoc ? Number(userXpDoc.textXp  || 0) : 0;
          const voiceXp     = userXpDoc ? Number(userXpDoc.voiceXp || 0) : 0;
          const totalUserXp = textXp + voiceXp;
          const xpLevel     = calculateLevel(totalUserXp);
          const xpProgress  = getLevelProgress(totalUserXp);

          const adminLevel = Number(doc.level || 0);
          const nextCfg    = getNextLevelConfig(adminLevel);
          const multiplier = getMultiplier(member || message.member);
          const nextReq    = nextCfg ? scaledReq(nextCfg.req, multiplier) : null;
          const warnsBonus = getWarnsBonus(message.guild.id, targetId);
          const guildIconURL = message.guild.iconURL({ size: 256 });

          const embed = buildStyledPanel({
            title: `📊 بطاقة الإحصائيات`,
            guildIconURL,
            imageURL: PANEL_LINE_IMAGE_URL
          });
          embed.setFooter({
            text: message.author.tag,
            iconURL: message.author.displayAvatarURL({ size: 128 })
          });

          embed.addFields(
            { name: '👤 العضو', value: `**<@${targetId}>**`, inline: true },
            {
              name: '🔢 مستوى الإداري',
              value: `**Level ${adminLevel}**${doc.promotedAt ? `\nآخر ترقية: <t:${Math.floor(new Date(doc.promotedAt).getTime() / 1000)}:R>` : ''}`,
              inline: true
            },
            { name: '🎚️ معامل الصعوبة', value: `**x${multiplier.toFixed(2)}**`, inline: true },

            {
              name: '🏅 اللفل',
              value: `**لفل ${xpLevel}**\n📈 التقدم: **${xpProgress.inLevelXp} / ${xpProgress.requiredXp} XP**`,
              inline: false
            }
          );

          if (nextReq) {
            const textLevel  = calculateLevel(textXp);
            const voiceLevel = calculateLevel(voiceXp);
            const bestLevel  = Math.max(textLevel, voiceLevel);
            const requiredXpLevel = nextReq.xpLevel || 0;
            const xpLevelProgress = `${bestLevel}/${requiredXpLevel}`;
            const xpLevelPct = requiredXpLevel > 0 ? Math.min(100, Math.round((bestLevel / requiredXpLevel) * 100)) : 100;

            const approvalDoc = await AdminApproval.findOne({
              guildId: message.guild.id,
              adminUserId: targetId,
              targetLevel: adminLevel + 1,
              used: false
            });
            const approvalLine = approvalDoc
              ? `✅ موافقة المسؤول: 1/1 (بواسطة <@${approvalDoc.approvedBy}>)`
              : `❌ موافقة المسؤول: 0/1`;

            embed.addFields({
              name: `🚀 الترقية القادمة • ${nextCfg?.name || `Level ${adminLevel + 1}`}`,
              value: [
                `🎟️ ${formatProgress(points.tickets, nextReq.tickets)}`,
                `⚠️ ${formatProgress(points.warns, (nextReq.warns || 0) + warnsBonus)}${warnsBonus ? ` (+${warnsBonus} صعوبة إضافية)` : ''}`,
                `🏅 لفل XP: ${xpLevelProgress} (${xpLevelPct}%)`,
                approvalLine
              ].join('\n'),
              inline: false
            });
          } else {
            embed.addFields({ name: '🚀 الترقية القادمة', value: '**أعلى مستوى.**', inline: false });
          }

          await sendNoPing(message.channel, { embeds: [embed] });
        } catch (err) {
          console.error('Stats command error:', err);
          await sendNoPing(message.channel, { embeds: [redPanel('صار خطأ أثناء تنفيذ أمر ستات.')] });
        }
        return;
      }

      if (isBreakCommand) {
        const guardKey = `${message.id}:break`;
        if (!markProcessed(guardKey)) return;
        if (!canEditBreak) return;
        const targetArg = tokens.shift();
        const reason = tokens.join(' ').trim();
        if (!targetArg || !reason) {
          await sendNoPing(message.channel, { embeds: [redPanel('الاستخدام: `كسر <@عضو | ID> <السبب>`')] });
          return;
        }
        const targetMember = await fetchMember(message.guild, targetArg, message);
        if (!targetMember) {
          await sendNoPing(message.channel, { embeds: [redPanel('لم أستطع العثور على العضو.')] });
          return;
        }
        if (!isAdminMember(targetMember)) {
          await sendNoPing(message.channel, { embeds: [redPanel('❌ أمر الكسر يعمل على رتب الإدارة فقط.')] });
          return;
        }
        try {
          const result = await demoteOneLevel(message.guild, targetMember, { reason, byId: message.author.id });
          const guildIconURL = message.guild.iconURL({ size: 256 });
          const breakEmbed = buildStyledPanel({
            title: '⬇️ كسر رتبة إداري',
            description: [
              `**تم كسر رتبة الإداري:** <@${targetMember.id}>`,
              `**من:** ${result.fromName}`,
              `**إلى:** ${result.toName}`,
              `**السبب:** ${reason}`,
              `**بواسطة:** <@${message.author.id}>`,
              `**الرتب التي أُزيلت:** ${formatRoleMentions(result.removedRoles)}`,
              `**الرتب المضافة:** ${formatRoleMentions(result.addedRoles)}`
            ].join('\n'),
            guildIconURL,
            authorAvatarURL: message.author.displayAvatarURL({ size: 128 }),
            footerTag: message.author.tag,
            imageURL: PANEL_LINE_IMAGE_URL
          });
          const announceChannel = message.guild.channels.cache.get(PROMOTION_ANNOUNCE_CHANNEL_ID);
          if (announceChannel) {
            await announceChannel.send({
              content: `<@&${SUPPORT_ROLE_ID}>`,
              allowedMentions: { roles: [SUPPORT_ROLE_ID] },
              embeds: [breakEmbed]
            });
          }
          try {
            const dmEmbed = new EmbedBuilder()
              .setColor(0xff0000)
              .setTitle('⬇️ إشعار كسر رتبة')
              .setDescription([
                `**مرحباً <@${targetMember.id}>**`,
                'تم كسر رتبتك مستوى واحد.',
                `**من:** ${result.fromName}`,
                `**إلى:** ${result.toName}`,
                `**السبب:** ${reason}`,
                `**بواسطة:** <@${message.author.id}>`
              ].join('\n'));
            await targetMember.send({ embeds: [dmEmbed] });
          } catch {}
          await sendNoPing(message.channel, { embeds: [redPanel(`تم كسر رتبة <@${targetMember.id}> بنجاح.`)] });
        } catch (err) {
          await sendNoPing(message.channel, { embeds: [redPanel(err?.message || 'تعذر تنفيذ أمر كسر.')] });
        }
        return;
      }

      // ===== أمر تبديل (Convert) - يبدل بين التكت والتحذيرات فقط =====
      if (isConvertCommand) {
        const guardKey = `${message.id}:convert`;
        if (!markProcessed(guardKey)) return;
        
        let amountRaw, fromType, toType;
        
        if (tokens.length >= 3) {
          if (Number.isFinite(Number(tokens[0]))) {
            amountRaw = tokens[0]; 
            fromType = tokens[1]; 
            toType = tokens[2];
          } else {
            fromType = tokens[0]; 
            amountRaw = tokens[1]; 
            toType = tokens[2];
          }
        }
        
        if (!amountRaw || !fromType || !toType) {
          await sendNoPing(message.channel, { 
            embeds: [redPanel('الاستخدام: `تبديل <الكمية> <من-نوع> <إلى-نوع>`\nالأنواع المتاحة: تكت, تحذير')] 
          });
          return;
        }
        
        const amount = Number(amountRaw);
        if (!Number.isFinite(amount) || amount <= 0) {
          await sendNoPing(message.channel, { embeds: [redPanel('الكمية يجب أن تكون رقم صالح وأكبر من 0.')] });
          return;
        }
        
        const normalizeConvertType = (input) => {
          const lower = input.toLowerCase();
          if (lower === 'تكت' || lower === 'ticket' || lower === 'tickets' || lower === 'تذاكر') return 'tickets';
          if (lower === 'تحذير' || lower === 'warn' || lower === 'warns' || lower === 'تحذيرات') return 'warns';
          return null;
        };
        
        const fromKey = normalizeConvertType(fromType);
        const toKey = normalizeConvertType(toType);
        
        if (!fromKey || !toKey) {
          await sendNoPing(message.channel, { 
            embeds: [redPanel('نوع غير معروف.\nالأنواع المتاحة: تكت, تحذير')] 
          });
          return;
        }
        
        if (fromKey === toKey) {
          await sendNoPing(message.channel, { embeds: [redPanel('❌ لا يمكنك التبديل بين نفس النوع.')] });
          return;
        }
        
        const doc = await getOrCreate(message.guild.id, message.author.id);
        
        const currentPoints = doc.points?.[fromKey] || 0;
        if (currentPoints < amount) {
          await sendNoPing(message.channel, { 
            embeds: [redPanel(`❌ ليس لديك ${amount} ${fromKey === 'tickets' ? 'تكت' : 'تحذير'} للتبديل. لديك فقط ${currentPoints}.`)] 
          });
          return;
        }
        
        const conversionRate = 1;
        const convertedAmount = amount * conversionRate;
        
        if (!doc.points) doc.points = { tickets: 0, warns: 0, xp: 0 };
        if (!doc.lifetime) doc.lifetime = { tickets: 0, warns: 0, xp: 0 };
        
        doc.points[fromKey] = currentPoints - amount;
        doc.points[toKey] = (doc.points[toKey] || 0) + convertedAmount;
        
        doc.lifetime[fromKey] = Math.max(doc.lifetime[fromKey] || 0, doc.points[fromKey]);
        doc.lifetime[toKey] = Math.max(doc.lifetime[toKey] || 0, doc.points[toKey]);
        
        await doc.save();
        
        const fromLabel = fromKey === 'tickets' ? 'تكت' : 'تحذير';
        const toLabel = toKey === 'tickets' ? 'تكت' : 'تحذير';
        
        const embed = greenPanel(
          `**تم التبديل بنجاح!**\n` +
          `${POINT_TYPE_EMOJIS[fromKey] || '•'} -${amount} ${fromLabel}\n` +
          `${POINT_TYPE_EMOJIS[toKey] || '•'} +${convertedAmount} ${toLabel}`,
          '🔄 تبديل النقاط'
        );
        
        await sendNoPing(message.channel, { embeds: [embed] });
        
        await tryPromote(message, message.member, { announceInChannel: true, dmOnPromote: true });
        return;
      }

      if (isTransferCommand) {
        const guardKey = `${message.id}:transfer`;
        if (!markProcessed(guardKey)) return;
        if (tokens.length < 3) {
          await sendNoPing(message.channel, { embeds: [redPanel('الاستخدام: `تحويل <نوع> <@عضو | ID> <الكمية>`')] });
          return;
        }
        const typeArg = tokens[0];
        const targetArg = tokens[1];
        const amountArg = tokens[2];
        const pointType = normalizePointKey(typeArg);
        if (!pointType) {
          await sendNoPing(message.channel, { embeds: [redPanel('نوع النقاط غير معروف.')] });
          return;
        }
        const targetMember = await fetchMember(message.guild, targetArg, message);
        if (!targetMember) {
          await sendNoPing(message.channel, { embeds: [redPanel('لم أستطع العثور على العضو.')] });
          return;
        }
        if (targetMember.id === message.author.id) {
          await sendNoPing(message.channel, { embeds: [redPanel('لا يمكنك تحويل نقاط لنفسك.')] });
          return;
        }
        const amount = Number(amountArg);
        if (!Number.isFinite(amount) || amount <= 0) {
          await sendNoPing(message.channel, { embeds: [redPanel('الكمية يجب أن تكون رقم صالح.')] });
          return;
        }
        const fromDoc = await getOrCreate(message.guild.id, message.author.id);
        const toDoc = await getOrCreate(message.guild.id, targetMember.id);
        try {
          const result = await transferPoints(fromDoc, toDoc, typeArg, amount);
          await sendNoPing(message.channel, {
            embeds: [greenPanel(
              `**تم التحويل بنجاح من <@${message.author.id}> إلى <@${targetMember.id}> (${result.amount})**`,
              '📤 تحويل النقاط'
            )]
          });
          await tryPromote(message, message.member, { announceInChannel: true, dmOnPromote: true });
        } catch (err) {
          await sendNoPing(message.channel, { embeds: [redPanel(err.message || 'فشل التحويل.')] });
        }
        return;
      }

      if (isEditCommand) {
        const guardKey = `${message.id}:edit`;
        if (!markProcessed(guardKey)) return;
        if (!canEditBreak) return;
        if (tokens.length < 2) {
          await sendNoPing(message.channel, { embeds: [redPanel('الاستخدام: `تعديل <نوع> <قيمة> [@عضو]`')] });
          return;
        }
        const typeArg = tokens[0];
        const pointType = normalizePointKey(typeArg);
        if (!pointType) {
          await sendNoPing(message.channel, { embeds: [redPanel('نوع غير معروف.')] });
          return;
        }
        let targetMember = message.member;
        let amount = null;
        if (tokens[1] && extractIdFromMention(tokens[1])) {
          targetMember = await fetchMember(message.guild, tokens[1], message);
          amount = Number(tokens[2]);
        } else if (tokens[2] && extractIdFromMention(tokens[2])) {
          targetMember = await fetchMember(message.guild, tokens[2], message);
          amount = Number(tokens[1]);
        } else {
          amount = Number(tokens[1]);
        }
        if (!targetMember) {
          await sendNoPing(message.channel, { embeds: [redPanel('لم أستطع العثور على العضو.')] });
          return;
        }
        if (!Number.isFinite(amount) || amount < 0) {
          await sendNoPing(message.channel, { embeds: [redPanel('القيمة يجب أن تكون رقم صالح.')] });
          return;
        }
        const doc = await getOrCreate(message.guild.id, targetMember.id);
        if (!doc.points) doc.points = { tickets: 0, warns: 0, xp: 0 };
        if (!doc.lifetime) doc.lifetime = { tickets: 0, warns: 0, xp: 0 };
        doc.points[pointType] = amount;
        doc.lifetime[pointType] = Math.max(doc.lifetime[pointType] || 0, amount);
        await doc.save();
        await tryPromote(message, targetMember, { announceInChannel: true, dmOnPromote: true });
        await notifyEditCommandUsage({ message, editorMember: message.member, targetMember, pointType, amount });
        await sendNoPing(message.channel, {
          embeds: [greenPanel(
            `**تم تعديل ${POINT_TYPE_LABELS[pointType] || pointType} لـ <@${targetMember.id}> إلى ${amount}**`,
            '✏️ تعديل الإحصائيات'
          )]
        });
        return;
      }

      if (isWarnCommand) {
        const guardKey = `${message.id}:warn`;
        if (!markProcessed(guardKey)) return;
        if (!canWarnRole) {
          await sendNoPing(message.channel, { embeds: [redPanel('❌ ما عندك رتبة صلاحية التحذير.')] });
          return;
        }
        if (!inWarnChannel) {
          await sendNoPing(message.channel, { embeds: [redPanel('❌ أمر التحذير يعمل فقط في شات الاوامر.')] });
          return;
        }
        if (!message.member.permissions.has(MOD_REQUIRED_PERM) && !hasWarnAccessRole) {
          await sendNoPing(message.channel, { embeds: [redPanel('❌ تحتاج صلاحية Moderate Members.')] });
          return;
        }
        const targetArg = tokens.shift();
        if (!targetArg) {
          await sendNoPing(message.channel, { embeds: [redPanel('الرجاء تحديد العضو: `warn @user السبب`')] });
          return;
        }
        const targetMember = await fetchMember(message.guild, targetArg, message);
        if (!targetMember) {
          await sendNoPing(message.channel, { embeds: [redPanel('لم أستطع العثور على العضو.')] });
          return;
        }
        if (targetMember.user.bot) {
          await sendNoPing(message.channel, { embeds: [redPanel('❌ لا يمكن تحذير بوت.')] });
          return;
        }
        if (targetMember.id === message.author.id) {
          await sendNoPing(message.channel, { embeds: [redPanel('❌ لا يمكنك تحذير نفسك.')] });
          return;
        }
        if (
          message.guild.ownerId !== message.author.id &&
          message.member.roles.highest.position <= targetMember.roles.highest.position
        ) {
          await sendNoPing(message.channel, { embeds: [redPanel('❌ لا يمكنك تحذير عضو أعلى من رتبتك.')] });
          return;
        }
        const reason = tokens.join(' ').trim();
        if (!reason) {
          await sendNoPing(message.channel, { embeds: [redPanel('الرجاء كتابة سبب التحذير.')] });
          return;
        }
        if (isDuplicateWarnAction(message.guild.id, message.author.id, targetMember.id, reason)) return;
        await addWarningAndNotify(message, targetMember, reason);
        return;
      }

      if (isWarningsCommand) {
        const guardKey = `${message.id}:warnings`;
        if (!markProcessed(guardKey)) return;
        if (!hasSupportRole && !hasWarnAccessRole) {
          await sendNoPing(message.channel, { embeds: [redPanel('❌ هذا الأمر متاح فقط لرتبة الإدارة.')] });
          return;
        }
        const targetArg = tokens.join(' ').trim();
        const member = targetArg ? await fetchMember(message.guild, targetArg, message) : message.member;
        if (!member) {
          await sendNoPing(message.channel, { embeds: [redPanel('لم أستطع العثور على العضو.')] });
          return;
        }
        await showWarnings(message, member);
        return;
      }

      if (isUnwarnCommand) {
        const guardKey = `${message.id}:unwarn`;
        if (!markProcessed(guardKey)) return;

        const hasUnwarnRole = message.member.roles.cache.has('1075197301464768522');
        if (!hasUnwarnRole) {
          await sendNoPing(message.channel, { embeds: [redPanel('❌ ما عندك صلاحية استخدام هذا الأمر.')] });
          return;
        }

        if (message.channel.id !== '1468218606142881844') {
          await sendNoPing(message.channel, { embeds: [redPanel('❌ هذا الأمر يعمل فقط في شات الأوامر.')] });
          return;
        }

        const targetArg = tokens.shift();
        if (!targetArg) {
          await sendNoPing(message.channel, { embeds: [redPanel('الرجاء تحديد العضو: `شيل @user`')] });
          return;
        }
        const unwarnTarget = await fetchMember(message.guild, targetArg, message);
        if (!unwarnTarget) {
          await sendNoPing(message.channel, { embeds: [redPanel('لم أستطع العثور على العضو.')] });
          return;
        }
        if (unwarnTarget.user.bot) {
          await sendNoPing(message.channel, { embeds: [redPanel('❌ لا يمكن تعديل تحذيرات بوت.')] });
          return;
        }

        const unwarnDoc = await Warning.findOne({ guildId: message.guild.id, userId: unwarnTarget.id });
        if (!unwarnDoc || (unwarnDoc.total ?? 0) === 0 || unwarnDoc.infractions.length === 0) {
          await sendNoPing(message.channel, { embeds: [redPanel(`لا توجد تحذيرات لـ <@${unwarnTarget.id}>`)] });
          return;
        }

        const removed = unwarnDoc.infractions.pop();
        unwarnDoc.total = Math.max(0, (unwarnDoc.total ?? 1) - 1);
        await unwarnDoc.save();

        try {
          const { getOrCreate } = require('../utils/adminProgressService');
          const adminDoc = await getOrCreate({ guildId: message.guild.id, userId: unwarnTarget.id });
          if (adminDoc && adminDoc.points) {
            adminDoc.points.warns = Math.max(0, (adminDoc.points.warns || 0) - 1);
            await adminDoc.save();
          }
        } catch {}

        const unwarnEmbed = new EmbedBuilder()
          .setColor(0xff0000)
          .setTitle('🗑️ **تم إزالة تحذير**')
          .addFields(
            { name: 'العضو',               value: `**<@${unwarnTarget.id}> (${unwarnTarget.id})**` },
            { name: 'المشرف',              value: `**<@${message.author.id}> (${message.author.id})**` },
            { name: 'رقم الحالة المُزالة', value: `**${removed.caseId}**` },
            { name: 'السبب الأصلي',        value: `**${removed.reason || 'غير محدد'}**` },
            { name: 'التحذيرات المتبقية',  value: `**${unwarnDoc.total}**` },
            { name: 'الوقت',               value: `**${new Date().toLocaleString('ar-SA')}**` }
          )
          .setFooter({
            text: `بطلب من ${message.author.tag}`,
            iconURL: message.author.displayAvatarURL?.({ size: 128 })
          });

        await sendNoPing(message.channel, { embeds: [unwarnEmbed] });

        if (WARN_LOG_CHANNEL_ID) {
          const logChannel = message.guild.channels.cache.get(WARN_LOG_CHANNEL_ID);
          if (logChannel && logChannel.id !== message.channel.id) {
            try { await sendNoPing(logChannel, { embeds: [unwarnEmbed] }); } catch {}
          }
        }
        return;
      }

      if (isClaimCommand) {
        const guardKey = `${message.id}:claim`;
        if (!markProcessed(guardKey, COOLDOWN)) return;
        if (isMediatorTicketChannelNow) {
          if (!hasMediatorRole) {
            await sendNoPing(message.channel, { embeds: [redPanel('❌ هذا الأمر مخصص للوسطاء فقط.')] });
            return;
          }
          const current = await getValidMediatorClaimer(message.channel, message.guild);
          if (current) {
            await sendNoPing(message.channel, { embeds: [redPanel('❌ التذكرة مستلمة بالفعل.')] });
            return;
          }
          mediatorClaimedByChannel.set(message.channel.id, message.author.id);
          await clearBotClaimReactions(message.channel, message.client.user.id);
          await setupClaimedTicket(message.channel, message.member);
          await persistMediatorClaim(message.channel, message.guild, message.author.id);
          try { await message.react('✅'); } catch {}
          await sendNoPing(message.channel, { embeds: [redPanel(`✅ <@${message.author.id}> قام باستلام التذكرة.`)] });
          return;
        }
        if (!isAdminTicketChannelNow) {
          if (shouldSendRestrictedReply(message.channel.id)) {
            await sendManagedEmbedOnce(message.channel, 'claim-outside', {
              embeds: [redPanel('هذا الأمر يعمل فقط داخل قنوات التذاكر.')]
            });
          }
          return;
        }
        if (!hasSupportRole) {
          if (shouldSendRestrictedReply(message.channel.id)) {
            await sendManagedEmbedOnce(message.channel, 'claim-no-role', {
              embeds: [redPanel('❌ لا يمكنك استلام التذكرة.')]
            });
          }
          return;
        }
        let ticketClaim = await TicketClaim.findOne({ channelId: message.channel.id });
        if (ticketClaim) {
          await sendManagedEmbedOnce(message.channel, `claim-already:${ticketClaim.claimedById}`, {
            embeds: [redPanel(`❌ التذكرة مستلمة بالفعل بواسطة <@${ticketClaim.claimedById}>.`)]
          });
          return;
        }
        ticketClaim = new TicketClaim({
          guildId: message.guild.id,
          channelId: message.channel.id,
          claimedById: message.author.id,
          claimedAt: new Date()
        });
        await ticketClaim.save();
        try {
          if (getChannelCategoryId(message.channel) === ADMIN_TICKET_CATEGORY_ID) {
            let currentName = message.channel.name || '';
            if (currentName.startsWith('❌')) currentName = currentName.slice(1);
            if (!currentName.startsWith('✅')) {
              const botMember = message.guild.members.cache.get(message.client.user.id);
              const hasManage = message.channel.permissionsFor(botMember)?.has('ManageChannels');
              if (hasManage) {
                await message.channel.setName('✅' + currentName);
              }
            }
          }
        } catch (e) { console.error('[CLAIM setName error]', e?.message || e); }
        try {
          await addPoints({ guildId: message.guild.id, userId: message.author.id, tickets: 1 });
          await tryPromote(message, message.member, { announceInChannel: true, dmOnPromote: true });
        } catch (err) { console.error('Error adding ticket points:', err); }
        try {
          await AdminStats.findOneAndUpdate(
            { guildId: message.guild.id, adminId: message.author.id },
            { $inc: { claimsCount: 1 } },
            { upsert: true }
          );
        } catch {}
        await sendManagedEmbedOnce(message.channel, 'claim-success', {
          embeds: [redPanel(`✅ <@${message.author.id}> قام باستلام التذكرة.`)]
        });
        return;
      }

      if (isUnclaimCommand) {
        const guardKey = `${message.id}:unclaim`;
        if (!markProcessed(guardKey, COOLDOWN)) return;
        if (isAdminTicketChannelNow) {
          if (!hasSupportRole) {
            if (shouldSendRestrictedReply(message.channel.id)) {
              await sendManagedEmbedOnce(message.channel, 'unclaim-admin-no-role', {
                embeds: [redPanel('❌ لا يمكنك فك استلام التذكرة.')]
              });
            }
            return;
          }
          const ticketClaim = await TicketClaim.findOne({ channelId: message.channel.id });
          if (!ticketClaim) {
            await sendManagedEmbedOnce(message.channel, 'unclaim-admin-none', {
              embeds: [redPanel('❌ التذكرة غير مستلمة.')]
            });
            return;
          }
          const isClaimer = String(ticketClaim.claimedById) === String(message.author.id);
          const canForceUnclaim = canEditBreak || message.member.permissions.has(FORCE_ADMIN_UNCLAIM_PERM);
          if (!isClaimer && !canForceUnclaim) {
            await sendManagedEmbedOnce(message.channel, 'unclaim-admin-not-owner', {
              embeds: [redPanel(`❌ فقط <@${ticketClaim.claimedById}> يمكنه فك الاستلام.`)]
            });
            return;
          }
          await TicketClaim.deleteOne({ _id: ticketClaim._id });
          try {
            if (getChannelCategoryId(message.channel) === ADMIN_TICKET_CATEGORY_ID) {
              const currentName = message.channel.name || '';
              if (currentName.startsWith('✅')) {
                const botMember = message.guild.members.cache.get(message.client.user.id);
                const hasManage = message.channel.permissionsFor(botMember)?.has('ManageChannels');
                if (hasManage) {
                  await message.channel.setName(currentName.slice(1));
                }
              }
            }
          } catch (e) { console.error('[UNCLAIM setName error]', e?.message || e); }
          await sendManagedEmbedOnce(message.channel, 'unclaim-admin-success', {
            embeds: [redPanel('✅ تم فك الاستلام.')]
          });
          return;
        }
        if (!isMediatorTicketChannelNow) return;
        if (!hasMediatorRole) {
          await sendNoPing(message.channel, { embeds: [redPanel('❌ أمر خروج متاح للوسطاء فقط.')] });
          return;
        }
        const claimerId = await getValidMediatorClaimer(message.channel, message.guild);
        if (!claimerId) {
          await clearMediatorClaimState(message.channel, message.member, null);
          await sendManagedEmbedOnce(message.channel, 'unclaim-force-clean', {
            embeds: [redPanel('✅ تم تنظيف حالة الاستلام.')]
          });
          return;
        }
        if (claimerId !== message.author.id) {
          await sendNoPing(message.channel, { embeds: [redPanel('❌ فقط المستلم الحالي يمكنه استخدام خروج.')] });
          return;
        }
        await clearMediatorClaimState(message.channel, message.member, claimerId);
        await sendManagedEmbedOnce(message.channel, 'unclaim-success', {
          embeds: [redPanel('✅ تم فك الاستلام.')]
        });
        return;
      }

      if (isXpCommand) {
        const guardKey = `${message.id}:xp`;
        if (!markProcessed(guardKey)) return;
        const targetArg = tokens.join(' ').trim();
        const member = targetArg ? await fetchMember(message.guild, targetArg, message) : message.member;
        if (!member) {
          await sendNoPing(message.channel, { embeds: [redPanel('لم أستطع العثور على العضو.')] });
          return;
        }
        const now = Date.now();
        let userXp = await UserXP.findOne({ guildId: message.guild.id, userId: member.id });
        if (!userXp) {
          userXp = new UserXP({
            guildId: message.guild.id, userId: member.id,
            textXp: 0, voiceXp: 0, totalXp: 0, level: 0, lastAnnouncedLevel: -1,
            dailyResetAt: startOfDay(now), weeklyResetAt: startOfWeek(now), monthlyResetAt: startOfMonth(now),
            dailyTextXp: 0, weeklyTextXp: 0, monthlyTextXp: 0,
            dailyVoiceXp: 0, weeklyVoiceXp: 0, monthlyVoiceXp: 0
          });
        }
        resetScopes(userXp, now);
        if (!Number.isFinite(userXp.lastAnnouncedLevel)) userXp.lastAnnouncedLevel = -1;
        userXp.textXp = userXp.textXp || 0;
        userXp.voiceXp = userXp.voiceXp || 0;
        userXp.totalXp = (userXp.textXp || 0) + (userXp.voiceXp || 0);
        userXp.level = calculateLevel(userXp.totalXp);
        await userXp.save();
        const progress = getLevelProgress(userXp.totalXp);
        const guildIconURL = message.guild.iconURL({ size: 256 });
        const embed = buildStyledPanel({
          title: '🏅 لوحة XP',
          guildIconURL,
          authorAvatarURL: member.displayAvatarURL({ size: 128 }),
          footerTag: message.author.tag,
          imageURL: PANEL_LINE_IMAGE_URL
        });
        embed.addFields(
          { name: '🏅 المستوى', value: `**Level ${userXp.level} • ${userXp.totalXp} XP**`, inline: true },
          { name: '📝 خبرة كتابية', value: `**${userXp.textXp} XP**`, inline: true },
          { name: '🎙️ خبرة صوتية', value: `**${userXp.voiceXp} XP**`, inline: true },
          {
            name: '📈 التقدم للمستوى القادم',
            value: `**${progress.inLevelXp}/${progress.requiredXp} XP**\n**المتبقي:** ${progress.leftXp} XP`,
            inline: false
          }
        );
        await sendNoPing(message.channel, { embeds: [embed] });
        return;
      }

      if (isTopCommand) {
        const guardKey = `${message.id}:t`;
        if (!markProcessed(guardKey, 2000)) return;
        const scopeArg = tokens.shift();
        const scope = getTopScopeFromArg(scopeArg);
        if (!scope) {
          await sendNoPing(message.channel, {
            embeds: [redPanel('استخدم: `top day`, `top week`, `top month`, أو `top all`.')]
          });
          return;
        }
        const topReplyTag = `top:${scope}:${message.author.id}`;
        if (!shouldSendManagedReply(message.channel.id, topReplyTag, TOP_REPLY_TTL)) return;
        const now = Date.now();
        const docs = await UserXP.find({ guildId: message.guild.id });
        const rows = docs.map(doc => {
          const scoped = getScopedValues(doc, scope, now);
          const totalForLevel = doc.totalXp || (doc.textXp || 0) + (doc.voiceXp || 0);
          return {
            userId: doc.userId,
            textXp: Number(scoped.textXp || 0),
            voiceXp: Number(scoped.voiceXp || 0),
            totalXp: Number(scoped.totalXp || 0),
            level: doc.level ?? calculateLevel(totalForLevel)
          };
        });
        const requesterId = message.author.id;
        if (!rows.some(r => r.userId === requesterId)) {
          rows.push({ userId: requesterId, textXp: 0, voiceXp: 0, totalXp: 0, level: 0 });
        }
        const rankedText = [...rows]
          .sort((a, b) => {
            if (b.textXp !== a.textXp) return b.textXp - a.textXp;
            if (b.totalXp !== a.totalXp) return b.totalXp - a.totalXp;
            return String(a.userId).localeCompare(String(b.userId));
          })
          .map((r, i) => ({ ...r, rank: i + 1 }));
        const rankedVoice = [...rows]
          .sort((a, b) => {
            if (b.voiceXp !== a.voiceXp) return b.voiceXp - a.voiceXp;
            if (b.totalXp !== a.totalXp) return b.totalXp - a.totalXp;
            return String(a.userId).localeCompare(String(b.userId));
          })
          .map((r, i) => ({ ...r, rank: i + 1 }));
        const topTextRows = rankedText.filter(r => r.textXp > 0).slice(0, TOP_LIMIT);
        const topVoiceRows = rankedVoice.filter(r => r.voiceXp > 0).slice(0, TOP_LIMIT);
        const requesterTextRow = rankedText.find(r => r.userId === requesterId) || {
          userId: requesterId, rank: rankedText.length || 1, textXp: 0
        };
        const requesterVoiceRow = rankedVoice.find(r => r.userId === requesterId) || {
          userId: requesterId, rank: rankedVoice.length || 1, voiceXp: 0
        };
        const guildIconURL = message.guild.iconURL({ size: 256 }) || undefined;
        const embed = new EmbedBuilder()
          .setColor(0xff0000)
          .setAuthor({ name: '🏆 لائحة متصدرين نقاط السيرفر', iconURL: guildIconURL })
          .setDescription(`**التصنيف: ${scopeLabel(scope)}**`)
          .setThumbnail(message.author.displayAvatarURL({ size: 128 }))
          .addFields(
            {
              name: '🗨️ أعلى كتابيًا',
              value: formatTopField(topTextRows, 'textXp', { requesterRow: requesterTextRow }),
              inline: true
            },
            {
              name: '🎙️ أعلى صوتيًا',
              value: formatTopField(topVoiceRows, 'voiceXp', { requesterRow: requesterVoiceRow }),
              inline: true
            }
          )
          .setFooter({
            text: `${message.author.tag} • ${new Date().toLocaleString('ar-SA')}`,
            iconURL: message.author.displayAvatarURL({ size: 128 })
          });
        if (TOP_PANEL_IMAGE_URL && /^https?:\/\//i.test(TOP_PANEL_IMAGE_URL)) {
          embed.setImage(TOP_PANEL_IMAGE_URL);
        }
        await sendNoPing(message.channel, { embeds: [embed] });
        return;
      }

    } catch (err) {
      console.error('messageCreate fatal error:', err);
    }
  }
};
