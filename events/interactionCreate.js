const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  PermissionsBitField,
  ChannelType
} = require('discord.js');

const pendingPanels = require('../utils/pendingPanels');
const { buildTicketStatsEmbed, buildTicketStatsButtons } = require('../utils/ticketStatsView');
const { handleUnbanButtonInteraction } = require('../utils/antiBanProtection');
const MediatorClaim = require('../models/MediatorClaim');
const MediatorRating = require('../models/MediatorRating');
const AlayaClaim = require('../models/AlayaClaim');
const {
  buildMediatorThanksDM,
  buildLeaderboardEmbed,
  buildLeaderboardButtons,
  buildMediatorLeaderboardRows,
  LB_PAGE_SIZE
} = require('../utils/mediatorRatingView');

// ==================== ثوابت ====================
const ADMIN_ROLE_ID          = '1388155427660759140';
const CO_OWNER_ID            = '1408218061655244810'; // يستقبل الشكاوي/التقارير فـ الخاص
const RESIGNATION_LOG_CHANNEL_ID = '1550117455450345633';
const RESIGNATION_ALLOWED_ROLE_ID = '1075197301464768522'; // أصحاب رتب العليا من هاذي وطالع يقدرو يقدمو استقالة
const ALAYA_CLAIM_ROLE_IDS = ['1388155427660759140', '1369290706568347678', '1498736792059379863', '1463918984108966152'];
const alayaClaimedByChannel = new Map(); // channelId -> claimerId (تُمسح تلقائياً بحذف/إعادة تشغيل، وهذا يكفي لأنها لكل تكت جديد)
const CATEGORY_ID            = '1426288612873474048';
const CLAIM_ALLOWED_ROLE     = '1075197301464768522';
const LOCKED_ADMIN_ROLE_IDS  = [CLAIM_ALLOWED_ROLE, '1103389551784890368'];
const ADMIN_LEAVE_ROLE       = '1075197301464768522';
const SENIOR_ROLE_ID         = '1388155427660759140';
const SENIOR_APPROVER_ROLES  = ['1071678540191371314', '1071678540191371313'];
const LEAVE_ROLE_ID          = '1424094146028896346';
const TEST_ROLE_ID           = '1490039126173679696';
const TICKET_STATS_ROLE_ID   = '1495816257352499401';
const SUPPORT_ROLE_ID        = '1075197301464768522';

const hasResignationPermission = (member, guild) => {
  const thresholdRole = guild.roles.cache.get(RESIGNATION_ALLOWED_ROLE_ID);
  if (!thresholdRole) return false;
  return member.roles.cache.some(r => r.position >= thresholdRole.position);
};

const PANEL_LINE_IMAGE =
  'https://cdn.discordapp.com/attachments/1390932617645260872/1391661420558422156/Picsart_25-07-07_09-05-01-827.png';

// ==================== مساعدات ====================
const activePayments = new Map();
const claimedTickets = new Map();

const red   = t => new EmbedBuilder().setColor('#ff0000').setDescription(`**${t}**`);
const green = t => new EmbedBuilder().setColor('#00c853').setDescription(`**${t}**`);

function todayKey(guildId, userId) {
  const d = new Date();
  return `${guildId}:${userId}:${d.getUTCFullYear()}-${d.getUTCMonth()}-${d.getUTCDate()}`;
}

function parseDuration(str) {
  if (!str) return null;
  const m = str.trim().toLowerCase().match(/^(\d+)\s*([dwmy])$/);
  if (!m) return null;
  const n = parseInt(m[1]);
  if (m[2] === 'd') return n;
  if (m[2] === 'w') return n * 7;
  if (m[2] === 'm') return n * 30;
  if (m[2] === 'y') return n * 365;
  return null;
}

function durationLabel(str) {
  if (!str) return str;
  const m = str.trim().toLowerCase().match(/^(\d+)\s*([dwmy])$/);
  if (!m) return str;
  const labels = { d: 'يوم', w: 'أسبوع', m: 'شهر', y: 'سنة' };
  return `${m[1]} ${labels[m[2]] || m[2]}`;
}

function ticketStatsFilter(userId, period) {
  const now = Date.now();
  const filter = { claimedById: userId };
  if (period === 'day')   filter.claimedAt = { $gte: new Date(now - 86400000) };
  if (period === 'week')  filter.claimedAt = { $gte: new Date(now - 604800000) };
  if (period === 'month') filter.claimedAt = { $gte: new Date(now - 2592000000) };
  return filter;
}

// ===== دالتين مساعدتين لقفل وفتح التذاكر =====
const getTicketOwnerIdFromTopic = (channel) => {
  const topic = String(channel.topic || '');
  const m = topic.match(/Owner:(\d{16,21})/);
  return m ? m[1] : null;
};

const lockTicketForClaimer = async (channel, claimerId, ownerId) => {
  try {
    for (const roleId of LOCKED_ADMIN_ROLE_IDS) {
      await channel.permissionOverwrites.edit(roleId, {
        ViewChannel: true, ReadMessageHistory: true,
        SendMessages: false, AttachFiles: false, AddReactions: false
      }, { reason: `Ticket locked by claimer ${claimerId}` });
    }
    await channel.permissionOverwrites.edit(claimerId, {
      ViewChannel: true, SendMessages: true, AttachFiles: true,
      ReadMessageHistory: true, AddReactions: true
    }, { reason: 'Claimer full access' });
    if (ownerId) {
      await channel.permissionOverwrites.edit(ownerId, {
        ViewChannel: true, SendMessages: true, AttachFiles: true,
        ReadMessageHistory: true, AddReactions: true
      }, { reason: 'Ticket owner access' });
    }
  } catch (e) { console.error('lockTicketForClaimer error:', e?.message || e); }
};

const unlockTicketFromClaimer = async (channel) => {
  try {
    for (const roleId of LOCKED_ADMIN_ROLE_IDS) {
      await channel.permissionOverwrites.edit(roleId, {
        ViewChannel: true, ReadMessageHistory: true,
        SendMessages: true, AttachFiles: true, AddReactions: true
      }, { reason: 'Ticket unlocked' });
    }
  } catch (e) { console.error('unlockTicketFromClaimer error:', e?.message || e); }
};

// ==================== الحدث الرئيسي ====================
module.exports = {
  name: 'interactionCreate',

  async execute(interaction) {

    // ==================== AUTOCOMPLETE ====================
    if (interaction.isAutocomplete()) {
      try {
        const command = require(`../commands/slash/${interaction.commandName}`);
        if (command?.autocomplete) return command.autocomplete(interaction);
      } catch (err) {
        console.error('Autocomplete error:', err?.message || err);
      }
      return;
    }

    // ==================== SLASH ====================
    if (interaction.isChatInputCommand()) {
      try {
        const command = require(`../commands/slash/${interaction.commandName}`);
        if (command) return command.execute(interaction);
      } catch (err) {
        console.error('Slash error:', err?.message || err);
        if (!interaction.replied && !interaction.deferred)
          return interaction.reply({ embeds: [red('❌ صار خطأ.')], ephemeral: true });
      }
    }

    // ==================== SELECT MENUS ====================
    if (interaction.isStringSelectMenu()) {

      if (interaction.customId === 'panel_buy_rank') {
        if (interaction.values[0] === 'buy') {
          const menu = new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
              .setCustomId('select_rank')
              .setPlaceholder('اختر الرتبة')
              .addOptions([
                new StringSelectMenuOptionBuilder().setLabel('VIP - 5').setValue('vip').setEmoji('💎'),
                new StringSelectMenuOptionBuilder().setLabel('GOLD - 50000').setValue('gold').setEmoji('🥇'),
                new StringSelectMenuOptionBuilder().setLabel('ELITE - 100000').setValue('elite').setEmoji('👑')
              ])
          );
          return interaction.reply({ embeds: [red('💰 اختر الرتبة')], components: [menu], ephemeral: true });
        }
        if (interaction.values[0] === 'special') {
          return interaction.reply({
            content: `<@&${ADMIN_ROLE_ID}>`,
            embeds: [red('⏳ تم إشعار الإدارة')]
          });
        }
      }

      if (interaction.customId === 'select_type') {
        if (interaction.values[0] === 'buy') {
          const menu = new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
              .setCustomId('select_rank')
              .setPlaceholder('اختر الرتبة')
              .addOptions([
                new StringSelectMenuOptionBuilder().setLabel('VIP - 5').setValue('vip'),
                new StringSelectMenuOptionBuilder().setLabel('GOLD - 50000').setValue('gold'),
                new StringSelectMenuOptionBuilder().setLabel('ELITE - 100000').setValue('elite')
              ])
          );
          return interaction.reply({ embeds: [red('💰 اختر الرتبة')], components: [menu] });
        }
        if (interaction.values[0] === 'special') {
          return interaction.reply({ content: `<@&${ADMIN_ROLE_ID}>`, embeds: [red('⏳ انتظر الإدارة')] });
        }
      }

      if (interaction.customId === 'select_rank') {
        const roles = {
          vip:   { price: 5,      roleId: '1470481986056359946' },
          gold:  { price: 50000,  roleId: 'ROLE_ID_GOLD' },
          elite: { price: 100000, roleId: 'ROLE_ID_ELITE' }
        };
        const data = roles[interaction.values[0]];
        activePayments.set(interaction.user.id, { price: data.price, roleId: data.roleId, channelId: interaction.channel.id });
        const btn = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('verify_payment').setLabel('تأكيد الاستلام').setStyle(ButtonStyle.Success)
        );
        return interaction.reply({
          embeds: [red(`💳 قم بالتحويل:\n\`\`\`\nc 1050858109129736273 ${data.price}\n\`\`\``)],
          components: [btn]
        });
      }

      // ============================================================
      // leave_select
      // customId البنية: leave_select:<approvalRoleId>:<requestsChannelId>
      // requestsChannelId = الروم المخصص لاستقبال طلبات الإجازة (مختلف عن روم البنل)
      // ============================================================
      if (interaction.customId.startsWith('leave_select:')) {
        const idParts           = interaction.customId.split(':');
        const approvalRoleId    = idParts[1];
        const requestsChannelId = idParts[2]; // روم الطلبات فقط، وليس روم البنل
        const leaveType         = interaction.values[0];
        const member            = interaction.member;
        const isTestRole        = member.roles.cache.has(TEST_ROLE_ID);

        if (!requestsChannelId) {
          return interaction.reply({
            embeds: [red('❌ خطأ في إعداد البنل: روم الطلبات غير محدد. أعد إنشاء البنل.')],
            ephemeral: true
          });
        }

        if (leaveType === 'senior') {
          if (!member.roles.cache.has(ADMIN_ROLE_ID)) {
            return interaction.reply({
              embeds: [red('❌ هذا الخيار مخصص لأصحاب رتبة الإدارة العليا فقط.')],
              ephemeral: true
            });
          }
        }

        if (leaveType === 'admin') {
          if (member.roles.cache.has(ADMIN_ROLE_ID)) {
            return interaction.reply({
              embeds: [red('❌ أنت من الإدارة العليا، يرجى استخدام خيار "إجازات العليا".')],
              ephemeral: true
            });
          }
          if (!member.roles.cache.has(ADMIN_LEAVE_ROLE)) {
            return interaction.reply({
              embeds: [red('❌ ما عندك الرتبة المطلوبة للتقديم في إجازات الإدارة.')],
              ephemeral: true
            });
          }
        }

        if (!isTestRole) {
          try {
            const LeaveRequest = require('../models/LeaveRequest');
            const daily = todayKey(interaction.guild.id, interaction.user.id);

            const todayReq = await LeaveRequest.findOne({ dailyKey: daily });
            if (todayReq) {
              return interaction.reply({
                embeds: [red('❌ لقد قدمت طلباً بالفعل اليوم، يمكنك التقديم مرة واحدة فقط يومياً.')],
                ephemeral: true
              });
            }

            const openReq = await LeaveRequest.findOne({
              guildId: interaction.guild.id,
              userId:  interaction.user.id,
              status:  'pending'
            });
            if (openReq) {
              return interaction.reply({
                embeds: [red('❌ عندك طلب إجازة مفتوح بالفعل، انتظر حتى يتم مراجعته.')],
                ephemeral: true
              });
            }

            const activeLeave = await LeaveRequest.findOne({
              guildId:     interaction.guild.id,
              userId:      interaction.user.id,
              status:      'approved',
              leaveEndsAt: { $gt: new Date() }
            });
            if (activeLeave) {
              return interaction.reply({
                embeds: [red('❌ أنت في إجازة حالياً ولا يمكنك التقديم.')],
                ephemeral: true
              });
            }
          } catch (err) {
            console.error('leave check error:', err?.message);
          }
        }

        const typeLabel = leaveType === 'admin' ? 'الإدارة' : 'الإدارة العليا';
        const modal = new ModalBuilder()
          .setCustomId(`leave_modal:${leaveType}:${approvalRoleId}:${requestsChannelId}`)
          .setTitle(`📋 طلب إجازة ${typeLabel}`);

        modal.addComponents(
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId('leave_duration')
              .setLabel('كم مدة إجازتك؟')
              .setStyle(TextInputStyle.Short)
              .setRequired(true)
              .setPlaceholder('مثال: أسبوع، 10 أيام...')
          ),
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId('leave_reason')
              .setLabel('ما سبب الإجازة؟')
              .setStyle(TextInputStyle.Paragraph)
              .setRequired(true)
              .setPlaceholder('اكتب سبب إجازتك بشكل واضح...')
          ),
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId('leave_role_info')
              .setLabel('اكتب آيدي رتبتك أو اسمها')
              .setStyle(TextInputStyle.Short)
              .setRequired(true)
              .setPlaceholder('مثال: 𝐒𝐭𝐚𝐟𝐟 / 𝐌𝐨𝐝 / 123456789')
          )
        );

        return interaction.showModal(modal);
      }
    }

    // ==================== BUTTONS ====================
    if (interaction.isButton()) {

      // ===== زر فك الباند التلقائي (رسالة الخاص عند البند) =====
      const unbanHandled = await handleUnbanButtonInteraction(interaction);
      if (unbanHandled) return;

      // ===== تصفح إحصائيات التذاكر (prev/next) =====
      // customId البنية: tstats:<direction>:<userId>:<period>:<currentPage>
      if (interaction.customId.startsWith('tstats:')) {
        try {
          if (!interaction.member.roles.cache.has(TICKET_STATS_ROLE_ID)) {
            return interaction.reply({ embeds: [red('❌ ليس لديك صلاحية.')], ephemeral: true });
          }

          const [, direction, targetUserId, period, currentPageStr] = interaction.customId.split(':');
          let page = parseInt(currentPageStr, 10) || 0;
          page = direction === 'next' ? page + 1 : page - 1;
          if (page < 0) page = 0;

          await interaction.deferUpdate();

          const TicketClaim = require('../models/TicketClaim');
          const claims = await TicketClaim.find(ticketStatsFilter(targetUserId, period)).sort({ claimedAt: -1 });
          const total  = claims.length;

          const maxPage = Math.max(0, Math.ceil(total / 20) - 1);
          if (page > maxPage) page = maxPage;

          const targetUser = await interaction.client.users.fetch(targetUserId).catch(() => null);
          if (!targetUser) {
            return interaction.editReply({ embeds: [red('❌ تعذر إيجاد المستخدم.')], components: [] });
          }

          const embed = buildTicketStatsEmbed(targetUser, claims, page, period, total);
          const row   = buildTicketStatsButtons(page, total, targetUserId, period);

          return interaction.editReply({ embeds: [embed], components: total > 20 ? [row] : [] });
        } catch (err) {
          console.error('tstats pagination error:', err?.message || err);
          if (!interaction.replied && !interaction.deferred)
            return interaction.reply({ embeds: [red('❌ صار خطأ.')], ephemeral: true });
        }
        return;
      }

      // ===== زر تقديم تقرير =====
      if (interaction.customId === 'report_open_modal') {
        const modal = new ModalBuilder()
          .setCustomId('report_modal')
          .setTitle('📋 تقديم تقرير');

        modal.addComponents(
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId('report_details')
              .setLabel('التقرير')
              .setStyle(TextInputStyle.Paragraph)
              .setPlaceholder('اشرح تقريرك بالتفصيل')
              .setRequired(true)
          ),
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId('report_link')
              .setLabel('رابط صورة / لينك (اختياري)')
              .setStyle(TextInputStyle.Short)
              .setPlaceholder('https://... (إذا عندك صورة أو رابط يوضح تقريرك)')
              .setRequired(false)
          )
        );

        return interaction.showModal(modal);
      }

      // ===== زر طلب استقالة =====
      if (interaction.customId === 'resign_open_modal') {
        if (!hasResignationPermission(interaction.member, interaction.guild)) {
          return interaction.reply({ embeds: [red('❌ هذا الزر مخصص لأصحاب رتب العليا فقط.')], ephemeral: true });
        }

        const modal = new ModalBuilder()
          .setCustomId('resign_modal')
          .setTitle('📝 طلب استقالة');

        modal.addComponents(
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId('resign_name')
              .setLabel('اسمك')
              .setStyle(TextInputStyle.Short)
              .setRequired(true)
          ),
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId('resign_reason')
              .setLabel('سبب الاستقالة')
              .setStyle(TextInputStyle.Paragraph)
              .setRequired(true)
          ),
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId('resign_role')
              .setLabel('رتبتك')
              .setStyle(TextInputStyle.Short)
              .setRequired(true)
          )
        );

        return interaction.showModal(modal);
      }

      // ===== قبول / رفض الاستقالة =====
      if (interaction.customId.startsWith('resign_accept:') || interaction.customId.startsWith('resign_reject:')) {
        if (!SENIOR_APPROVER_ROLES.some(r => interaction.member.roles.cache.has(r))) {
          return interaction.reply({ embeds: [red('❌ هذا الزر مخصص للأونر والكو-أونر فقط.')], ephemeral: true });
        }

        await interaction.deferReply({ ephemeral: true });

        try {
          const isAccept = interaction.customId.startsWith('resign_accept:');
          const targetUserId = interaction.customId.split(':')[1];

          const ResignationRequest = require('../models/ResignationRequest');
          const reqDoc = await ResignationRequest.findOne({ guildId: interaction.guild.id, userId: targetUserId, status: 'pending' });
          if (!reqDoc) {
            return interaction.editReply({ embeds: [red('❌ هذا الطلب غير موجود أو تمت مراجعته بالفعل.')] });
          }

          reqDoc.status = isAccept ? 'approved' : 'rejected';
          reqDoc.reviewedBy = interaction.user.id;
          await reqDoc.save();

          const disabledRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('resign_accept_done').setLabel(isAccept ? '✅ تم القبول' : 'تم القبول').setStyle(ButtonStyle.Success).setDisabled(true),
            new ButtonBuilder().setCustomId('resign_reject_done').setLabel(!isAccept ? '❌ تم الرفض' : 'تم الرفض').setStyle(ButtonStyle.Danger).setDisabled(true)
          );
          try { await interaction.message.edit({ components: [disabledRow] }); } catch {}

          try {
            const targetUser = await interaction.client.users.fetch(targetUserId);
            await targetUser.send({
              embeds: [isAccept
                ? green(`✅ تم قبول طلب استقالتك بواسطة <@${interaction.user.id}>.`)
                : red(`❌ تم رفض طلب استقالتك بواسطة <@${interaction.user.id}>.`)]
            });
          } catch {}

          return interaction.editReply({
            embeds: [green(`✅ تم ${isAccept ? 'قبول' : 'رفض'} استقالة <@${targetUserId}>.`)]
          });
        } catch (err) {
          console.error('resign_accept/reject error:', err?.message || err);
          return interaction.editReply({ embeds: [red('❌ صار خطأ.')] });
        }
      }

      // ===== استلام منشن "عليا" داخل التكت =====
      if (interaction.customId === 'alaya_claim') {
        try {
          const channelId = interaction.channel.id;
          const isAllowed = ALAYA_CLAIM_ROLE_IDS.some(id => interaction.member.roles.cache.has(id));
          if (!isAllowed) {
            return interaction.reply({ embeds: [red('❌ هذا الزر مخصص للإدارة العليا فقط.')], ephemeral: true });
          }

          const existingClaimer = alayaClaimedByChannel.get(channelId);
          if (existingClaimer) {
            return interaction.reply({
              embeds: [red(`❌ تم استلامها مسبقاً بواسطة <@${existingClaimer}>.`)],
              ephemeral: true
            });
          }

          alayaClaimedByChannel.set(channelId, interaction.user.id);
          AlayaClaim.create({
            guildId: interaction.guild.id,
            channelId,
            claimerId: interaction.user.id,
            status: 'open'
          }).catch(e => console.error('AlayaClaim create error:', e?.message || e));

          const unclaimRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId('alaya_unclaim')
              .setLabel(`❌ إلغاء الاستلام (${interaction.user.username})`)
              .setStyle(ButtonStyle.Danger)
          );

          await interaction.update({ components: [unclaimRow] });
        } catch (err) {
          console.error('alaya_claim error:', err?.message || err);
          if (!interaction.replied && !interaction.deferred) {
            return interaction.reply({ embeds: [red('❌ صار خطأ أثناء الاستلام.')], ephemeral: true });
          }
        }
        return;
      }

      // ===== إلغاء استلام منشن "عليا" =====
      if (interaction.customId === 'alaya_unclaim') {
        try {
          const channelId = interaction.channel.id;
          const currentClaimer = alayaClaimedByChannel.get(channelId);

          if (currentClaimer !== interaction.user.id) {
            return interaction.reply({ embeds: [red('❌ فقط من استلمها يقدر يلغي الاستلام.')], ephemeral: true });
          }

          alayaClaimedByChannel.delete(channelId);
          AlayaClaim.findOneAndUpdate(
            { channelId, claimerId: interaction.user.id, status: 'open' },
            { status: 'unclaimed', unclaimedAt: new Date() }
          ).catch(e => console.error('AlayaClaim unclaim update error:', e?.message || e));

          const claimRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId('alaya_claim')
              .setLabel('📥 استلام')
              .setStyle(ButtonStyle.Primary)
          );

          await interaction.update({ components: [claimRow] });
        } catch (err) {
          console.error('alaya_unclaim error:', err?.message || err);
          if (!interaction.replied && !interaction.deferred) {
            return interaction.reply({ embeds: [red('❌ صار خطأ أثناء إلغاء الاستلام.')], ephemeral: true });
          }
        }
        return;
      }

      // ===== تقييم الوسيط (أزرار النجوم فـ الخاص) =====
      // customId البنية: mediator_rate:<claimId>:<stars>
      if (interaction.customId.startsWith('mediator_rate:')) {
        try {
          const [, claimId, starsStr] = interaction.customId.split(':');
          const stars = parseInt(starsStr, 10);

          const claim = await MediatorClaim.findById(claimId).catch(() => null);
          if (!claim) {
            return interaction.update({ embeds: [red('❌ هذه التذكرة غير موجودة.')], components: [] });
          }
          if (claim.ticketOwnerId !== interaction.user.id) {
            return interaction.reply({ embeds: [red('❌ هذا التقييم ماشي ليك.')], ephemeral: true });
          }
          if (claim.rated) {
            return interaction.update({ embeds: [buildMediatorThanksDM(stars)], components: [] });
          }

          await MediatorRating.create({
            guildId: claim.guildId,
            channelId: claim.channelId,
            claimId: claim._id,
            mediatorId: claim.mediatorId,
            raterId: interaction.user.id,
            stars
          });

          claim.rated = true;
          await claim.save();

          return interaction.update({ embeds: [buildMediatorThanksDM(stars)], components: [] });
        } catch (err) {
          console.error('mediator_rate error:', err?.message || err);
          if (!interaction.replied && !interaction.deferred) {
            return interaction.reply({ embeds: [red('❌ صار خطأ أثناء حفظ تقييمك.')], ephemeral: true });
          }
        }
        return;
      }

      // ===== تصفح لوحة نقاط الوسطاء (prev/next) =====
      // customId البنية: mpoints:<direction>:<currentPage>
      if (interaction.customId.startsWith('mpoints:')) {
        try {
          const [, direction, currentPageStr] = interaction.customId.split(':');
          let page = parseInt(currentPageStr, 10) || 0;
          page = direction === 'next' ? page + 1 : page - 1;
          if (page < 0) page = 0;

          await interaction.deferUpdate();

          const rows = await buildMediatorLeaderboardRows(interaction.guild.id);
          const totalPages = Math.max(1, Math.ceil(rows.length / LB_PAGE_SIZE));
          if (page > totalPages - 1) page = totalPages - 1;

          const embed = buildLeaderboardEmbed(rows, page, rows.length);
          const row   = buildLeaderboardButtons(page, rows.length);

          return interaction.editReply({ embeds: [embed], components: rows.length > LB_PAGE_SIZE ? [row] : [] });
        } catch (err) {
          console.error('mpoints pagination error:', err?.message || err);
          if (!interaction.replied && !interaction.deferred)
            return interaction.reply({ embeds: [red('❌ صار خطأ.')], ephemeral: true });
        }
        return;
      }

      // ===== task approval buttons =====
      if (interaction.customId.startsWith('task_approve_promo:') || interaction.customId.startsWith('task_reject_promo:')) {
        try {
          const APPROVER_ROLE_ID = '1388289855582371860';
          if (!interaction.member.roles.cache.has(APPROVER_ROLE_ID) &&
              !interaction.member.permissions.has('Administrator')) {
            return interaction.reply({ content: '❌ ما عندك صلاحية.', ephemeral: true });
          }

          const action  = interaction.customId.startsWith('task_approve_promo:') ? 'approve' : 'reject';
          const adminId = interaction.customId.split(':')[1];
          const guild   = interaction.guild;

          await interaction.deferReply({ ephemeral: true });

          const targetMember = await guild.members.fetch(adminId).catch(() => null);

          // شيل الأزرار من رسالة الـ DM
          try {
            const updatedEmbed = EmbedBuilder.from(interaction.message.embeds[0])
              .setColor(action === 'approve' ? 0x2ecc71 : 0xe74c3c)
              .setFooter({ text: `${action === 'approve' ? '✅ تمت الموافقة' : '❌ تم الرفض'} بواسطة ${interaction.user.tag} • ${new Date().toLocaleString('ar-SA')}` });
            await interaction.message.edit({ embeds: [updatedEmbed], components: [] }).catch(() => {});
          } catch {}

          if (action === 'approve') {
            // أعطه رتبة الإداري
            if (targetMember) {
              try { await targetMember.roles.add('1075197301464768522'); } catch {}
              try { await targetMember.roles.remove('1393320266620211341'); } catch {}
              try {
                await targetMember.send({
                  embeds: [new EmbedBuilder()
                    .setColor(0x2ecc71)
                    .setTitle('🎉 تمت الموافقة على ترقيتك!')
                    .setDescription(`**مبروك! وافق <@${interaction.user.id}> على ترقيتك بعد إنهاء المهمة.**`)
                    .setTimestamp()
                  ]
                });
              } catch {}
            }
            await interaction.editReply({
              embeds: [new EmbedBuilder().setColor(0x2ecc71).setDescription(`✅ تمت الموافقة على ترقية <@${adminId}> وتطبيق الرتبة.`)]
            });
          } else {
            if (targetMember) {
              try {
                await targetMember.send({
                  embeds: [new EmbedBuilder()
                    .setColor(0xe74c3c)
                    .setTitle('❌ تم رفض ترقيتك')
                    .setDescription('تم رفض ترقيتك من قبل المسؤول رغم إنهائك المهمة.\nتواصل مع الإدارة لمعرفة السبب.')
                    .setTimestamp()
                  ]
                });
              } catch {}
            }
            await interaction.editReply({
              embeds: [new EmbedBuilder().setColor(0xe74c3c).setDescription(`✅ تم رفض ترقية <@${adminId}>.`)]
            });
          }
        } catch (err) {
          console.error('task approval button error:', err?.message || err);
          if (!interaction.replied && !interaction.deferred)
            return interaction.reply({ embeds: [red('❌ صار خطأ.')], ephemeral: true });
        }
        return;
      }

      // ===== promotion buttons =====
      if (interaction.customId.startsWith('promo_approve:') || interaction.customId.startsWith('promo_reject:')) {
        try {
          const promotion = require('../commands/slash/promotion');
          await promotion.handleButton(interaction);
        } catch (err) {
          console.error('promotion button error:', err?.message || err);
          if (!interaction.replied && !interaction.deferred)
            return interaction.reply({ embeds: [red('❌ صار خطأ.')], ephemeral: true });
        }
        return;
      }

      if (interaction.customId.startsWith('cp_')) {
        try {
          const custompanel = require('../commands/slash/custompanel');
          const handled = await custompanel.handleButton(interaction);
          if (handled) return;
        } catch (err) {
          console.error('custompanel button error:', err?.message || err);
        }
      }

      if (interaction.customId.startsWith('panel_write_desc:')) {
        const panelType = interaction.customId.split(':')[1];

        const modal = new ModalBuilder()
          .setCustomId(`panel_desc_modal:${panelType}`)
          .setTitle(panelType === 'rank' ? '✏️ وصف بنل الرتب' : '✏️ وصف/قوانين بنل الإجازات');

        modal.addComponents(
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId('panel_description')
              .setLabel('اكتب الوصف أو القوانين')
              .setStyle(TextInputStyle.Paragraph)
              .setRequired(true)
              .setMaxLength(4000)
              .setPlaceholder('اكتب الوصف بالشكل اللي تبيه، يدعم Markdown...\n**굵게** | *italics* | ~~strikethrough~~')
          )
        );

        return interaction.showModal(modal);
      }

      if (interaction.customId.startsWith('leave_accept:')) {
        const parts        = interaction.customId.split(':');
        const targetUserId = parts[1];
        const leaveType    = parts[2];
        const member       = interaction.member;

        if (leaveType === 'senior') {
          const ok = SENIOR_APPROVER_ROLES.some(r => member.roles.cache.has(r));
          if (!ok) {
            return interaction.reply({
              embeds: [red('❌ أنت لست من الإدارة العليا ولا يمكنك قبول هذا الطلب.')],
              ephemeral: true
            });
          }
        }

        try {
          const LeaveRequest = require('../models/LeaveRequest');
          const req = await LeaveRequest.findOne({ guildId: interaction.guild.id, userId: targetUserId, status: 'pending' });
          if (!req) {
            return interaction.reply({ embeds: [red('❌ هذا الطلب تمت مراجعته مسبقاً أو غير موجود.')], ephemeral: true });
          }
        } catch (err) { console.error('leave accept check:', err?.message); }

        const modal = new ModalBuilder()
          .setCustomId(`leave_accept_modal:${targetUserId}:${leaveType}:${interaction.message.id}`)
          .setTitle('✅ قبول طلب الإجازة');

        modal.addComponents(
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId('official_duration')
              .setLabel('مدة الإجازة الرسمية (مثال: 7d, 2w, 1m)')
              .setStyle(TextInputStyle.Short)
              .setRequired(true)
              .setPlaceholder('7d = 7 أيام | 2w = أسبوعين | 1m = شهر')
          )
        );

        return interaction.showModal(modal);
      }

      if (interaction.customId.startsWith('leave_reject:')) {
        const parts        = interaction.customId.split(':');
        const targetUserId = parts[1];
        const leaveType    = parts[2];
        const member       = interaction.member;

        if (leaveType === 'senior') {
          const ok = SENIOR_APPROVER_ROLES.some(r => member.roles.cache.has(r));
          if (!ok) {
            return interaction.reply({
              embeds: [red('❌ أنت لست من الإدارة العليا ولا يمكنك رفض هذا الطلب.')],
              ephemeral: true
            });
          }
        }

        await interaction.deferReply({ ephemeral: true });

        try {
          const LeaveRequest = require('../models/LeaveRequest');
          const req = await LeaveRequest.findOne({ guildId: interaction.guild.id, userId: targetUserId, status: 'pending' });
          if (!req) {
            return interaction.editReply({ embeds: [red('❌ هذا الطلب تمت مراجعته مسبقاً.')] });
          }
          await LeaveRequest.findOneAndUpdate(
            { guildId: interaction.guild.id, userId: targetUserId, status: 'pending' },
            { status: 'rejected', reviewedBy: interaction.user.id }
          );
        } catch (err) { console.error('leave reject update:', err?.message); }

        try {
          const updatedEmbed = EmbedBuilder.from(interaction.message.embeds[0])
            .setColor('#6e0000')
            .setFooter({ text: `❌ تمت المراجعة • ${new Date().toLocaleString('ar-SA')}` });

          await interaction.message.edit({
            content: `❌ **تم رفض الطلب** بواسطة <@${interaction.user.id}> • العضو: <@${targetUserId}>`,
            embeds: [updatedEmbed],
            components: [],
            allowedMentions: { parse: [] }
          }).catch(() => {});
        } catch {}

        try {
          const targetMember = await interaction.guild.members.fetch(targetUserId).catch(() => null);
          if (targetMember) {
            await targetMember.send({
              embeds: [
                new EmbedBuilder()
                  .setColor('#ff0000')
                  .setTitle('❌ تم رفض طلب إجازتك')
                  .setDescription('**تم رفض طلب إجازتك من قبل المسؤولين.**\nيمكنك التقديم مجدداً في وقت لاحق.')
                  .setImage(PANEL_LINE_IMAGE)
                  .setTimestamp()
              ]
            });
          }
        } catch {}

        return interaction.editReply({
          embeds: [green(`✅ تم رفض طلب إجازة <@${targetUserId}> وإشعاره عبر الخاص.`)]
        });
      }

      // ===== زر فتح التذكرة =====
      if (interaction.customId === 'open_ticket') {
        const existing = interaction.guild.channels.cache.find(c => c.name === `ticket-${interaction.user.username}`);
        if (existing) return interaction.reply({ embeds: [red(`❌ عندك تذكرة مفتوحة بالفعل\n${existing}`)], ephemeral: true });

        const channel = await interaction.guild.channels.create({
          name: `ticket-${interaction.user.username}`,
          type: ChannelType.GuildText,
          parent: CATEGORY_ID,
          topic: `Owner:${interaction.user.id}`,
          permissionOverwrites: [
            { id: interaction.guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
            { id: interaction.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] }
          ]
        });

        // ===== الأزرار العلوية =====
        const buttons = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('close_ticket').setLabel('🔒 إغلاق').setStyle(ButtonStyle.Danger),
          new ButtonBuilder().setCustomId('call_admin').setLabel('📢 استدعاء الإدارة').setStyle(ButtonStyle.Secondary)
        );

        // ===== الزرين الجدد جنب بعض (تحت النل) =====
        const claimButtons = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('confirm_claim').setLabel('✅ تأكيد الاستلام').setStyle(ButtonStyle.Success),
          new ButtonBuilder().setCustomId('ticket_rules').setLabel('📋 قوانين التكت').setStyle(ButtonStyle.Primary),
          new ButtonBuilder().setCustomId('ticket_replies').setLabel('💬 أوامر ردود').setStyle(ButtonStyle.Secondary)
        );

        const menu = new ActionRowBuilder().addComponents(
          new StringSelectMenuBuilder()
            .setCustomId('select_type')
            .setPlaceholder('اختر نوع الرتبة')
            .addOptions([
              new StringSelectMenuOptionBuilder().setLabel('🛒 رتبة شرائية').setValue('buy'),
              new StringSelectMenuOptionBuilder().setLabel('⭐ رتبة خاصة').setValue('special')
            ])
        );

        // ===== إرسال رسالة الترحيب =====
        await channel.send({ 
          content: `<@${interaction.user.id}>`, 
          embeds: [red('🎫 تم فتح التذكرة\nاختر نوع الرتبة من الأسفل')], 
          components: [buttons, menu] 
        });

        // ===== إرسال رسالة الإدارة مع الزرين جنب بعض =====
        await channel.send({
          embeds: [
            new EmbedBuilder()
              .setColor(0xff0000)
              .setDescription('**🛡️ للإدارة فقط**\nاضغط الزر بالأسفل لتأكيد استلام هذه التذكرة')
          ],
          components: [claimButtons]
        });

        return interaction.reply({ 
          embeds: [red(`✅ تم فتح التذكرة\n${channel}`)], 
          ephemeral: true 
        });
      }

      // ===== زر قوانين التكت =====
      if (interaction.customId === 'ticket_rules') {
        try {
          // التأكد من أن المستخدم عنده صلاحية الإدارة
          const hasSupportRole = interaction.member.roles.cache.has(SUPPORT_ROLE_ID);
          const hasAdminRole = interaction.member.roles.cache.has('1075197301464768522');
          
          if (!hasSupportRole && !hasAdminRole) {
            return interaction.reply({
              embeds: [red('❌ هذا الزر مخصص للإدارة فقط.')],
              ephemeral: true
            });
          }

          const rulesEmbed = new EmbedBuilder()
            .setColor(0xff0000)
            .setAuthor({
              name: '🛡️ دليل التعامل السريع (خاص بالطاقم الإداري)',
              iconURL: interaction.guild.iconURL({ size: 256 }) || undefined
            })
            .setDescription(`
**1️⃣ في حال وجود (سب وشتم أو قلة أدب) داخل التكت:**
> **التصرف المباشر:** لا تتهاون ولا تدخل في جدال عقيم مع العضو.
>
> **الخطوات:**
> 1. وجّه له تنبيه لمرة واحدة بوجوب الالتزام بالاحترام.
> 2. إذا استمر، صكّه ميوت (Mute) من ساعة إلى 12 ساعة (حسب قوة السب).
> 3. قفّل التكت فوراً وارفع اللوج (Log) في روم المخالفات.

━━━━━━━━━━━━━━━━━━━━━━━

**2️⃣ في حال قيام العضو بـ (منشن عشوائي للإدارة العليا):**
> **التصرف المباشر:** طبّق النظام فوراً، ولا تلتفت لأي أعذار (حتى لو قال العضو إن الإداري صديقه بالخاص).
>
> **الخطوات:**
> 1. امسح المنشن ونبّه العضو شفهياً أول مرة.
> 2. إذا كررها وعمل منشن مرة ثانية، صكّه تحذير رسمي (Warn) داخل السيرفر تحت بند منشن عشوائي.

━━━━━━━━━━━━━━━━━━━━━━━

**3️⃣ في حال تبين أن التكت (استهبال وإضاعة وقت):**
> **التصرف المباشر:** اقطع السالفة فوراً ولا تشخصن الموضوع أو تشتكي للعضو وتقول له "ضيعت وقتي".
>
> **الخطوات:**
> 1. اكتب بند المخالفة في التكت: (تذكرة غير جدية / إضاعة وقت الإدارة).
> 2. صكّ العضو تحذير (Warn) في السيرفر، وإذا كان يكررها صكّه ميوت 3 ساعات.
> 3. قفّل التكت مباشرة وبكل برود.

━━━━━━━━━━━━━━━━━━━━━━━

**4️⃣ في حال وجود (شكوى ضد إداري أعلى منك رتبة):**
> **التصرف المباشر:** يُمنع منعاً باتاً قفل التكت أو تهديد العضو بالطرد، وحماية حق العضو هي أولويتك.
>
> **الخطوات:**
> 1. اطلب من العضو رفع الدلائل (فيديو أو صور واضحة) داخل التكت.
> 2. اكتب للعضو في التكت: "انتظر الرد من العليا وهم بيجوك في أقرب وقت"
            `)
            .setImage(PANEL_LINE_IMAGE)
            .setFooter({
              text: `بطلب من ${interaction.user.tag} • ${new Date().toLocaleString('ar-SA')}`,
              iconURL: interaction.user.displayAvatarURL({ size: 128 })
            })
            .setTimestamp();

          // ===== التعديل: إظهار القوانين للإداري الضاغط فقط =====
          return interaction.reply({
            embeds: [rulesEmbed],
            ephemeral: true
          });

        } catch (err) {
          console.error('ticket_rules error:', err?.message || err);
          if (!interaction.replied && !interaction.deferred) {
            return interaction.reply({
              embeds: [red('❌ صار خطأ أثناء عرض القوانين.')],
              ephemeral: true
            });
          }
        }
      }

      // ===== زر أوامر الردود =====
      if (interaction.customId === 'ticket_replies') {
        try {
          const hasSupportRole = interaction.member.roles.cache.has(SUPPORT_ROLE_ID);
          const hasAdminRole = interaction.member.roles.cache.has('1075197301464768522');

          if (!hasSupportRole && !hasAdminRole) {
            return interaction.reply({
              embeds: [red('❌ هذا الزر مخصص للإدارة فقط.')],
              ephemeral: true
            });
          }

          const repliesEmbed = new EmbedBuilder()
            .setColor(0xff0000)
            .setAuthor({
              name: '💬 دليل الردود الجاهزة (خاص بالطاقم الإداري)',
              iconURL: interaction.guild.iconURL({ size: 256 }) || undefined
            })
            .setDescription(`
**الأمر:** \`+ترحيب\`
> مرحباً بك عزيزي العضو في مركز الدعم الفني. معك الطاقم الإداري لمساعدتك، يسعدنا الاستماع لاستفسارك أو مشكلتك، تفضل بطرحها الآن وسنكون معك خطوة بخطوة.

━━━━━━━━━━━━━━━━━━━━━━━

**الأمر:** \`+تنبيه\`
> عزيزي العضو، يرجى الالتزام بالهدوء والأسلوب المحترم أثناء التحدث مع طاقم الإدارة لتتم مساعدتك. أي إساءة، سب، أو تخطي للحدود سيعرض تذكرتك للإغلاق وحسابك للعقوبة مباشرة.

━━━━━━━━━━━━━━━━━━━━━━━

**الأمر:** \`+منشن\`
> يرجى عدم منشنة الإدارة العليا عشوائياً؛ طاقم الدعم المتواجد هنا مؤهل لحل مشكلتك، وفي حال تطلب الأمر سيتم تحويلك للإدارة العليا من قبلنا.

━━━━━━━━━━━━━━━━━━━━━━━

**الأمر:** \`+استهبال\`
> بما أن المشكلة المطروحة غير جدية وتم التأكد من رغبتك في إضاعة وقت الطاقم فقط، سيتم إغلاق التكت وتطبيق العقوبة بحقك.

━━━━━━━━━━━━━━━━━━━━━━━

**الأمر:** \`+عليا\`
> أهلاً بك، نظراً لأن موضوعك يتطلب صلاحيات أعلى، فقد تم رفع تذكرتك ونقلها للإدارة العليا. انتظر الرد من العليا وهم بيجوك في أقرب وقت.

━━━━━━━━━━━━━━━━━━━━━━━

**الأمر:** \`+حل\`
> يسعدنا دائماً خدمتكم. بما أنه تم حل مشكلتك والإجابة على كامل استفساراتك بنجاح، سيتم إغلاق هذه التذكرة الآن. في حال واجهت أي مشكلة أخرى مستقبلاً، لا تتردد في فتح تكت جديد.
            `)
            .setImage(PANEL_LINE_IMAGE)
            .setFooter({
              text: `بطلب من ${interaction.user.tag} • ${new Date().toLocaleString('ar-SA')}`,
              iconURL: interaction.user.displayAvatarURL({ size: 128 })
            })
            .setTimestamp();

          return interaction.reply({
            embeds: [repliesEmbed],
            ephemeral: true
          });

        } catch (err) {
          console.error('ticket_replies error:', err?.message || err);
          if (!interaction.replied && !interaction.deferred) {
            return interaction.reply({
              embeds: [red('❌ صار خطأ أثناء عرض الردود.')],
              ephemeral: true
            });
          }
        }
      }

      if (interaction.customId === 'close_ticket') {
        claimedTickets.delete(interaction.channel.id);
        return interaction.channel.delete();
      }

      if (interaction.customId === 'call_admin') {
        if (interaction.channel.called) return interaction.reply({ embeds: [red('❌ تم الاستدعاء مسبقًا')], ephemeral: true });
        interaction.channel.called = true;
        await interaction.channel.send({ content: `<@&${ADMIN_ROLE_ID}>`, embeds: [red('📢 تم استدعاء الإدارة')] });
        return interaction.reply({ embeds: [red('✅ تم استدعاء الإدارة')], ephemeral: true });
      }

      // ===== زر تأكيد الاستلام =====
      if (interaction.customId === 'confirm_claim') {
        try {
          const member  = interaction.member;
          const hasRole = member?.roles?.cache?.has(CLAIM_ALLOWED_ROLE);
          if (!hasRole) return interaction.reply({ embeds: [red('❌ ما عندك صلاحية تأكيد الاستلام.')], ephemeral: true });

          const channelId = interaction.channel.id;
          if (claimedTickets.has(channelId)) return interaction.reply({ embeds: [red(`❌ التذكرة مستلمة بالفعل بواسطة <@${claimedTickets.get(channelId)}>`)], ephemeral: true });

          try {
            const TicketClaim = require('../models/TicketClaim');
            const existing = await TicketClaim.findOne({ channelId });
            if (existing) {
              claimedTickets.set(channelId, existing.claimedById);
              return interaction.reply({ embeds: [red(`❌ التذكرة مستلمة بالفعل بواسطة <@${existing.claimedById}>`)], ephemeral: true });
            }
          } catch {}

          // ===== قيد: إلا عندو 3 تكتات مفتوحة، خاصو يستنى 5 دقايق من فتح التكت الرابعة =====
          try {
            const TicketClaim = require('../models/TicketClaim');
            const myClaims = await TicketClaim.find({ guildId: interaction.guild.id, claimedById: interaction.user.id });
            const openClaims = myClaims.filter(c => interaction.guild.channels.cache.has(c.channelId));

            if (openClaims.length >= 3) {
              const elapsed = Date.now() - interaction.channel.createdTimestamp;
              const waitMs = 5 * 60 * 1000;
              if (elapsed < waitMs) {
                const remainingMin = Math.ceil((waitMs - elapsed) / 60000);
                return interaction.reply({
                  embeds: [red(`❌ عندك بالفعل 3 تذاكر مفتوحة. خاصك تستنى ${remainingMin} دقيقة أخرى قبل ما تستلم هاذي (لازم تعدي 5 دقايق من فتح التذكرة).`)],
                  ephemeral: true
                });
              }
            }
          } catch (e) { console.error('claim cooldown check error:', e?.message || e); }

          claimedTickets.set(channelId, interaction.user.id);

          try {
            const { addPoints, tryPromote } = require('../utils/adminProgressService');
            const TicketClaim = require('../models/TicketClaim');
            await TicketClaim.create({ guildId: interaction.guild.id, channelId, claimedById: interaction.user.id, claimedAt: new Date() });
            await addPoints({ guildId: interaction.guild.id, userId: interaction.user.id, tickets: 1 });
            await tryPromote({ guild: interaction.guild }, member, { announceInChannel: true, dmOnPromote: true });
          } catch {}

          // ===== قفل الروم: بس المستلم وصاحب التكت يقدرون يتكلمون =====
          const ownerId = getTicketOwnerIdFromTopic(interaction.channel);
          await lockTicketForClaimer(interaction.channel, interaction.user.id, ownerId);

          const claimedRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('unclaim_ticket').setLabel('🔓 إلغاء الاستلام').setStyle(ButtonStyle.Danger),
            new ButtonBuilder().setCustomId('ticket_rules').setLabel('📋 قوانين التكت').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('ticket_replies').setLabel('💬 أوامر ردود').setStyle(ButtonStyle.Secondary)
          );
          try { await interaction.message.edit({ components: [claimedRow] }); } catch {}

          // ===== غيّر اسم القناة: شيل ❌ وحط ✅ =====
          try {
            let currentName = interaction.channel.name || '';
            if (currentName.startsWith('❌')) currentName = currentName.slice(1);
            if (!currentName.startsWith('✅')) {
              await interaction.channel.setName('✅' + currentName);
            }
          } catch (e) { console.error('[confirm_claim setName]', e?.message || e); }

          await interaction.channel.send({ allowedMentions: { parse: [] }, embeds: [new EmbedBuilder().setColor(0xff0000).setDescription(`**✅ تم استلام التذكرة بواسطة <@${interaction.user.id}>**`)] });
          return interaction.reply({ embeds: [red('✅ تم تسجيل استلامك للتذكرة')], ephemeral: true });
        } catch (err) {
          console.error('confirm_claim error:', err?.message);
          if (!interaction.replied && !interaction.deferred)
            return interaction.reply({ embeds: [red('❌ صار خطأ.')], ephemeral: true });
        }
      }

      // ===== زر إلغاء الاستلام =====
      if (interaction.customId === 'unclaim_ticket') {
        try {
          const channelId = interaction.channel.id;
          let claimerId = claimedTickets.get(channelId);

          const TicketClaim = require('../models/TicketClaim');
          if (!claimerId) {
            const existing = await TicketClaim.findOne({ channelId });
            claimerId = existing?.claimedById || null;
          }

          if (!claimerId) {
            return interaction.reply({ embeds: [red('❌ التذكرة غير مستلمة أصلاً.')], ephemeral: true });
          }

          const isClaimer = claimerId === interaction.user.id;
          const canForce = interaction.member.permissions.has(PermissionsBitField.Flags.ManageChannels);
          if (!isClaimer && !canForce) {
            return interaction.reply({ embeds: [red(`❌ فقط <@${claimerId}> يقدر يلغي الاستلام.`)], ephemeral: true });
          }

          claimedTickets.delete(channelId);
          await TicketClaim.deleteOne({ channelId }).catch(() => {});
          await unlockTicketFromClaimer(interaction.channel);

          try {
            let currentName = interaction.channel.name || '';
            if (currentName.startsWith('✅')) await interaction.channel.setName(currentName.slice(1));
          } catch {}

          const resetRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('confirm_claim').setLabel('✅ تأكيد الاستلام').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId('ticket_rules').setLabel('📋 قوانين التكت').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('ticket_replies').setLabel('💬 أوامر ردود').setStyle(ButtonStyle.Secondary)
          );
          try { await interaction.message.edit({ components: [resetRow] }); } catch {}

          await interaction.channel.send({
            allowedMentions: { parse: [] },
            embeds: [red(`🔓 تم إلغاء استلام <@${claimerId}> للتذكرة.`)]
          });
          return interaction.reply({ embeds: [green('✅ تم إلغاء الاستلام.')], ephemeral: true });
        } catch (err) {
          console.error('unclaim_ticket error:', err?.message || err);
          if (!interaction.replied && !interaction.deferred)
            return interaction.reply({ embeds: [red('❌ صار خطأ.')], ephemeral: true });
        }
      }

      if (interaction.customId === 'verify_payment') {
        try {
          const member  = interaction.member;
          const hasRole = member?.roles?.cache?.has(CLAIM_ALLOWED_ROLE);
          if (!hasRole) return interaction.reply({ embeds: [red('❌ ما عندك صلاحية.')], ephemeral: true });

          let paymentOwnerId = null, paymentData = null;
          for (const [uid, d] of activePayments.entries()) {
            if (d.channelId === interaction.channel.id) { paymentOwnerId = uid; paymentData = d; break; }
          }
          if (!paymentOwnerId) return interaction.reply({ embeds: [red('❌ ما في طلب دفع نشط.')], ephemeral: true });

          let targetMember;
          try { targetMember = await interaction.guild.members.fetch(paymentOwnerId); } catch { targetMember = null; }
          if (!targetMember) return interaction.reply({ embeds: [red('❌ ما أقدرت أجد العضو.')], ephemeral: true });

          await targetMember.roles.add(paymentData.roleId).catch(() => {});
          activePayments.delete(paymentOwnerId);
          await interaction.channel.send({ embeds: [new EmbedBuilder().setColor(0x00ff7f).setDescription(`**✅ تم تأكيد الاستلام وإضافة الرتبة لـ <@${paymentOwnerId}>**`)], allowedMentions: { parse: [] } });
          try { await targetMember.send({ embeds: [new EmbedBuilder().setColor(0x00ff7f).setDescription('**✅ تم تأكيد دفعك وإضافة الرتبة!**')] }); } catch {}
          return interaction.reply({ embeds: [red('✅ تم التأكيد')], ephemeral: true });
        } catch (err) {
          console.error('verify_payment error:', err?.message);
          if (!interaction.replied && !interaction.deferred)
            return interaction.reply({ embeds: [red('❌ صار خطأ.')], ephemeral: true });
        }
      }
    }

    // ==================== MODALS ====================
    if (interaction.isModalSubmit()) {

      // ===== استمارة التقرير =====
      if (interaction.customId === 'report_modal') {
        await interaction.deferReply({ ephemeral: true });

        try {
          const details = interaction.fields.getTextInputValue('report_details').trim();
          const rawLink = interaction.fields.getTextInputValue('report_link')?.trim() || '';

          const user  = interaction.user;
          const guild = interaction.guild;

          let link = null;
          let isImageLink = false;
          if (rawLink) {
            try {
              const parsed = new URL(rawLink);
              if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
                link = rawLink;
                isImageLink = /\.(png|jpe?g|gif|webp)$/i.test(parsed.pathname);
              }
            } catch {
              link = null; // رابط غير صالح، يتم تجاهله بدون ما يوقف الإرسال
            }
          }

          const reportEmbed = new EmbedBuilder()
            .setColor('#8B0000')
            .setAuthor({ name: `${user.username} • تقرير جديد`, iconURL: user.displayAvatarURL({ size: 256 }) })
            .setTitle('📋 تقرير جديد')
            .setThumbnail(user.displayAvatarURL({ size: 256 }))
            .addFields(
              { name: '👤 المرسل',  value: `${user.tag} (<@${user.id}>)`, inline: false },
              { name: '🏠 السيرفر', value: guild.name,                     inline: false },
              { name: '📝 التقرير', value: `\`\`\`${details}\`\`\``,       inline: false }
            )
            .setFooter({ text: new Date().toLocaleString('ar-SA') })
            .setTimestamp();

          if (link) {
            reportEmbed.addFields({ name: '🔗 رابط مرفق', value: link, inline: false });
            if (isImageLink) reportEmbed.setImage(link);
          }

          const Report = require('../models/Report');
          let dmStatus = 'sent';

          try {
            const coOwner = await interaction.client.users.fetch(CO_OWNER_ID);
            await coOwner.send({ embeds: [reportEmbed] });
          } catch (err) {
            dmStatus = 'dm_failed';
            console.error('report DM failed:', err?.message || err);
          }

          await Report.create({
            guildId: guild.id,
            channelId: interaction.channelId,
            reporterId: user.id,
            details,
            link,
            status: dmStatus
          });

          if (dmStatus === 'dm_failed') {
            return interaction.editReply({ embeds: [red('⚠️ تم تسجيل تقريرك، لكن تعذر إرساله فـ الخاص (ممكن يكون قافل الخاص). راجع الإدارة مباشرة.')] });
          }

          return interaction.editReply({ embeds: [green('✅ تم إرسال تقريرك للكو-أونر، انتظر الرد.')] });
        } catch (err) {
          console.error('report_modal error:', err?.message || err);
          return interaction.editReply({ embeds: [red('❌ صار خطأ أثناء إرسال تقريرك.')] });
        }
      }

      // ===== استمارة طلب الاستقالة =====
      if (interaction.customId === 'resign_modal') {
        await interaction.deferReply({ ephemeral: true });

        try {
          const name     = interaction.fields.getTextInputValue('resign_name').trim();
          const reason   = interaction.fields.getTextInputValue('resign_reason').trim();
          const roleInfo = interaction.fields.getTextInputValue('resign_role').trim();

          const user  = interaction.user;
          const guild = interaction.guild;

          const logChannel = guild.channels.cache.get(RESIGNATION_LOG_CHANNEL_ID);
          if (!logChannel) {
            return interaction.editReply({ embeds: [red('❌ روم سجل الاستقالات غير موجود.')] });
          }

          const requestEmbed = new EmbedBuilder()
            .setColor('#8B0000')
            .setAuthor({ name: `${user.username} • طلب استقالة`, iconURL: user.displayAvatarURL({ size: 256 }) })
            .setTitle('📝 طلب استقالة')
            .setThumbnail(user.displayAvatarURL({ size: 256 }))
            .addFields(
              { name: '👤 الاسم',   value: `\`\`\`${name}\`\`\``,   inline: false },
              { name: '🎖️ الرتبة',  value: `\`\`\`${roleInfo}\`\`\``, inline: false },
              { name: '📝 السبب',   value: `\`\`\`${reason}\`\`\``,  inline: false }
            )
            .setFooter({ text: new Date().toLocaleString('ar-SA') })
            .setTimestamp();

          const btnRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`resign_accept:${user.id}`).setLabel('✅ قبول').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId(`resign_reject:${user.id}`).setLabel('❌ رفض').setStyle(ButtonStyle.Danger)
          );

          const mentionContent = SENIOR_APPROVER_ROLES.map(r => `<@&${r}>`).join(' ');

          const reqMsg = await logChannel.send({
            content: mentionContent,
            embeds: [requestEmbed],
            components: [btnRow],
            allowedMentions: { roles: SENIOR_APPROVER_ROLES }
          });

          const ResignationRequest = require('../models/ResignationRequest');
          await ResignationRequest.create({
            guildId: guild.id,
            userId: user.id,
            name,
            reason,
            roleInfo,
            status: 'pending',
            messageId: reqMsg.id,
            channelId: logChannel.id
          });

          return interaction.editReply({ embeds: [green('✅ تم إرسال طلب استقالتك، انتظر مراجعته.')] });
        } catch (err) {
          console.error('resign_modal error:', err?.message || err);
          return interaction.editReply({ embeds: [red('❌ صار خطأ أثناء إرسال طلبك.')] });
        }
      }

      // ===== custompanel modals =====
      if (
        interaction.customId === 'cp_step1' ||
        interaction.customId.startsWith('cp_modal_btn:') ||
        interaction.customId.startsWith('cp_modal_menu:') ||
        interaction.customId.startsWith('cp_modal_option:')
      ) {
        try {
          const custompanel = require('../commands/slash/custompanel');
          await custompanel.handleModal(interaction);
        } catch (err) {
          console.error('custompanel modal error:', err?.message || err);
        }
        return;
      }

      if (interaction.customId.startsWith('panel_desc_modal:')) {
        await interaction.deferReply({ ephemeral: true });

        const panelType   = interaction.customId.split(':')[1];
        const description = interaction.fields.getTextInputValue('panel_description').trim();

        const key  = `${panelType === 'rank' ? 'rank' : 'leave'}:${interaction.user.id}`;
        const data = pendingPanels.get(key);

        if (!data) {
          return interaction.editReply({
            embeds: [red('❌ انتهت صلاحية الجلسة، أعد تشغيل الأمر من جديد.')]
          });
        }

        pendingPanels.delete(key);

        if (panelType === 'rank') {
          const embed = new EmbedBuilder()
            .setColor('#ff0000')
            .setTitle(data.title)
            .setDescription(description)
            .setImage(data.image);

          if (data.thumbnail) embed.setThumbnail(data.thumbnail);
          else embed.setThumbnail(interaction.guild.iconURL({ size: 256 }));

          const menu = new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
              .setCustomId('panel_buy_rank')
              .setPlaceholder('🛒 اختر نوع الرتبة')
              .addOptions([
                new StringSelectMenuOptionBuilder()
                  .setLabel('رتبة شرائية')
                  .setValue('buy')
                  .setEmoji(data.emojiBuy),
                new StringSelectMenuOptionBuilder()
                  .setLabel('رتبة خاصة')
                  .setValue('special')
                  .setEmoji(data.emojiSpc)
              ])
          );

          await interaction.channel.send({ embeds: [embed], components: [menu] });
          return interaction.editReply({
            embeds: [new EmbedBuilder().setColor('#00c853').setDescription('**✅ تم إرسال بنل الرتب بنجاح!**')]
          });
        }

        if (panelType === 'leave') {
          // panelChannelId = الروم اللي يُرسل فيه البنل (حيث يتفاعل الأعضاء)
          const panelChannel = interaction.guild.channels.cache.get(data.panelChannelId);
          if (!panelChannel) {
            return interaction.editReply({ embeds: [red('❌ روم البنل المحدد غير موجود.')] });
          }

          // التحقق من وجود روم الطلبات أيضاً
          const requestsChannel = interaction.guild.channels.cache.get(data.requestsChannelId);
          if (!requestsChannel) {
            return interaction.editReply({ embeds: [red('❌ روم الطلبات المحدد غير موجود.')] });
          }

          const embed = new EmbedBuilder()
            .setColor('#8B0000')
            .setAuthor({
              name:    interaction.guild.name,
              iconURL: interaction.guild.iconURL({ size: 256 }) || undefined
            })
            .setTitle(`${data.emojiTitle} ${data.title}`)
            .setDescription(description)
            .setImage(data.image)
            .setFooter({ text: 'نظام الإجازات • اختر نوع إجازتك من المنيو أدناه' });

          if (data.thumbnail) embed.setThumbnail(data.thumbnail);

          const menu = new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
              // customId يحتوي على: approvalRoleId و requestsChannelId (روم الطلبات فقط)
              // البنل نفسه يُرسل في panelChannel، بينما الطلبات تُرسل في requestsChannel
              .setCustomId(`leave_select:${data.approvalRoleId}:${data.requestsChannelId}`)
              .setPlaceholder('اختر نوع الإجازة')
              .addOptions([
                new StringSelectMenuOptionBuilder()
                  .setLabel('إجازات الإدارة')
                  .setValue('admin')
                  .setDescription('للإداريين العاديين فقط')
                  .setEmoji(data.emojiAdmin),
                new StringSelectMenuOptionBuilder()
                  .setLabel('إجازات العليا')
                  .setValue('senior')
                  .setDescription('لأصحاب رتبة الإدارة العليا فقط')
                  .setEmoji(data.emojiSenior)
              ])
          );

          // ✅ البنل يُرسل في panelChannel (الروم المخصص للأعضاء)
          await panelChannel.send({ embeds: [embed], components: [menu] });
          return interaction.editReply({
            embeds: [
              new EmbedBuilder()
                .setColor('#00c853')
                .setDescription(
                  `**✅ تم إرسال البنل بنجاح!**\n` +
                  `📌 البنل في: ${panelChannel}\n` +
                  `📨 الطلبات ستُرسل في: ${requestsChannel}`
                )
            ]
          });
        }
      }

      if (interaction.customId.startsWith('leave_modal:')) {
        await interaction.deferReply({ ephemeral: true });

        const parts             = interaction.customId.split(':');
        const leaveType         = parts[1];
        const approvalRole      = parts[2];
        const requestsChannelId = parts[3]; // روم الطلبات (مختلف عن روم البنل)

        if (!requestsChannelId) {
          return interaction.editReply({ embeds: [red('❌ خطأ في بيانات البنل. أعد إنشاء البنل.')] });
        }

        const duration   = interaction.fields.getTextInputValue('leave_duration').trim();
        const reason     = interaction.fields.getTextInputValue('leave_reason').trim();
        const roleInfo   = interaction.fields.getTextInputValue('leave_role_info').trim();

        const member     = interaction.member;
        const user       = interaction.user;
        const guild      = interaction.guild;
        const daily      = todayKey(guild.id, user.id);
        const isTestRole = member.roles.cache.has(TEST_ROLE_ID);

        if (!isTestRole) {
          try {
            const LeaveRequest = require('../models/LeaveRequest');
            const todayReq = await LeaveRequest.findOne({ dailyKey: daily });
            if (todayReq) {
              return interaction.editReply({ embeds: [red('❌ لقد قدمت طلباً بالفعل اليوم.')] });
            }
          } catch (err) { console.error('leave final check:', err?.message); }
        }

        // ✅ الطلب يُرسل في requestsChannel (الروم المخصص للإدارة)، وليس روم البنل
        const requestsChannel = guild.channels.cache.get(requestsChannelId);
        if (!requestsChannel) {
          return interaction.editReply({ embeds: [red('❌ روم الطلبات غير موجود أو تم حذفه. تواصل مع الإدارة.')] });
        }

        const topRole = member.roles.cache
          .filter(r => r.id !== guild.id && !r.managed)
          .sort((a, b) => b.position - a.position)
          .first();

        const typeLabel = leaveType === 'admin' ? '📋 إجازات الإدارة' : '👑 إجازات الإدارة العليا';
        const typeColor = leaveType === 'admin' ? '#c0392b' : '#6c3483';

        const requestEmbed = new EmbedBuilder()
          .setColor(typeColor)
          .setAuthor({ name: `${user.username} • طلب إجازة`, iconURL: user.displayAvatarURL({ size: 256 }) })
          .setTitle(typeLabel)
          .setThumbnail(user.displayAvatarURL({ size: 256 }))
          .addFields(
            { name: '👤 العضو',                value: `<@${user.id}>\n\`${user.id}\``,                               inline: true  },
            { name: '🏅 أعلى رتبة',            value: topRole ? `<@&${topRole.id}>\n\`${topRole.id}\`` : 'لا يوجد',  inline: true  },
            { name: '\u200b',                  value: '\u200b',                                                       inline: true  },
            { name: '⏱️ مدة الإجازة المطلوبة', value: `\`\`\`${duration}\`\`\``,                                     inline: false },
            { name: '📝 سبب الإجازة',           value: `\`\`\`${reason}\`\`\``,                                      inline: false },
            { name: '🎖️ الرتبة',               value: `\`\`\`${roleInfo}\`\`\``,                                     inline: false }
          )
          .setImage(PANEL_LINE_IMAGE)
          .setFooter({ text: `نوع الطلب: ${leaveType === 'admin' ? 'إجازة إدارة' : 'إجازة عليا'} • ${new Date().toLocaleString('ar-SA')}` })
          .setTimestamp();

        const btnRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId(`leave_accept:${user.id}:${leaveType}`).setLabel('✅ قبول').setStyle(ButtonStyle.Success),
          new ButtonBuilder().setCustomId(`leave_reject:${user.id}:${leaveType}`).setLabel('❌ رفض').setStyle(ButtonStyle.Danger)
        );

        const mentionContent = leaveType === 'senior'
          ? SENIOR_APPROVER_ROLES.map(r => `<@&${r}>`).join(' ')
          : `<@&${approvalRole}>`;

        // ✅ الإرسال في requestsChannel فقط
        const reqMsg = await requestsChannel.send({
          content: mentionContent,
          embeds: [requestEmbed],
          components: [btnRow],
          allowedMentions: { roles: leaveType === 'senior' ? SENIOR_APPROVER_ROLES : [approvalRole] }
        });

        try {
          const LeaveRequest = require('../models/LeaveRequest');
          await LeaveRequest.create({
            guildId:   guild.id,
            userId:    user.id,
            type:      leaveType,
            duration,
            reason,
            roleInfo,
            status:    'pending',
            messageId: reqMsg.id,
            channelId: requestsChannel.id,
            dailyKey:  isTestRole ? null : daily
          });
        } catch (err) { console.error('leave save error:', err?.message); }

        return interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setColor('#00c853')
              .setDescription('**✅ تم إرسال طلب إجازتك بنجاح!**\nسيتم إشعارك عبر الخاص عند مراجعته.')
          ]
        });
      }

      if (interaction.customId.startsWith('leave_accept_modal:')) {
        await interaction.deferReply({ ephemeral: true });

        const parts            = interaction.customId.split(':');
        const targetUserId     = parts[1];
        const leaveType        = parts[2];
        const originalMsgId    = parts[3];
        const officialDuration = interaction.fields.getTextInputValue('official_duration').trim();

        const days = parseDuration(officialDuration);
        if (!days || days < 1) {
          return interaction.editReply({ embeds: [red('❌ صيغة المدة غير صحيحة. مثال: 3d أو 1w أو 2m')] });
        }

        const guild    = interaction.guild;
        const approver = interaction.user;

        let targetMember;
        try { targetMember = await guild.members.fetch(targetUserId); } catch { targetMember = null; }
        if (!targetMember) {
          return interaction.editReply({ embeds: [red('❌ العضو غير موجود في السيرفر.')] });
        }

        const leaveRole = guild.roles.cache.get(LEAVE_ROLE_ID);
        let savedRoles  = [];

        try {
          if (leaveRole) {
            savedRoles = targetMember.roles.cache
              .filter(r => r.id !== guild.id && r.position > leaveRole.position && !r.managed)
              .map(r => r.id);
            for (const rid of savedRoles) await targetMember.roles.remove(rid).catch(() => {});
            await targetMember.roles.add(LEAVE_ROLE_ID).catch(() => {});
          }
        } catch (err) { console.error('leave apply roles:', err?.message); }

        const now     = new Date();
        const endsAt  = new Date(now.getTime() + days * 86400000);
        const endsTs  = Math.floor(endsAt.getTime() / 1000);
        const startTs = Math.floor(now.getTime() / 1000);

        try {
          const LeaveRequest = require('../models/LeaveRequest');
          await LeaveRequest.findOneAndUpdate(
            { guildId: guild.id, userId: targetUserId, status: 'pending' },
            { status: 'approved', reviewedBy: approver.id, officialDuration, leaveDays: days, leaveEndsAt: endsAt, savedRoles }
          );
        } catch (err) { console.error('leave approve update:', err?.message); }

        // تعديل رسالة الطلب في روم الطلبات (نجلب الروم من قاعدة البيانات)
        try {
          const LeaveRequest = require('../models/LeaveRequest');
          const leaveRecord  = await LeaveRequest.findOne({ guildId: guild.id, userId: targetUserId }).catch(() => null);
          const reqChannelId = leaveRecord?.channelId;
          const reqChannel   = reqChannelId ? guild.channels.cache.get(reqChannelId) : null;

          if (reqChannel) {
            const origMsg = await reqChannel.messages.fetch(originalMsgId).catch(() => null);
            if (origMsg) {
              const updatedEmbed = EmbedBuilder.from(origMsg.embeds[0])
                .setColor('#00c853')
                .setFooter({ text: `✅ تمت المراجعة • ${new Date().toLocaleString('ar-SA')}` });

              await origMsg.edit({
                content: `✅ **تم قبول الطلب** بواسطة <@${approver.id}> • المدة: **${durationLabel(officialDuration)}** • تنتهي <t:${endsTs}:R>`,
                embeds: [updatedEmbed],
                components: [],
                allowedMentions: { parse: [] }
              }).catch(() => {});
            }
          }
        } catch (err) { console.error('leave edit msg:', err?.message); }

        try {
          await targetMember.send({
            embeds: [
              new EmbedBuilder()
                .setColor('#00c853')
                .setTitle('✅ تم قبول طلب إجازتك')
                .setDescription('**مبروك! تم قبول طلب إجازتك من قبل المسؤولين يمكنك ارجوع الي الاداره في اي وقت فقط افتح تكت.**')
                .addFields(
                  { name: '⏱️ المدة الرسمية', value: durationLabel(officialDuration), inline: true  },
                  { name: '📅 تاريخ البداية',  value: `<t:${startTs}:F>`,             inline: true  },
                  { name: '📅 تاريخ النهاية',  value: `<t:${endsTs}:F>`,              inline: true  },
                  { name: '⏳ الوقت المتبقي',  value: `<t:${endsTs}:R>`,              inline: false }
                )
                .setImage(PANEL_LINE_IMAGE)
                .setTimestamp()
            ]
          });
        } catch {}

        const msLeft = endsAt.getTime() - Date.now();
        if (msLeft > 0) {
          setTimeout(async () => {
            try {
              const m = await guild.members.fetch(targetUserId).catch(() => null);
              if (!m) return;
              await m.roles.remove(LEAVE_ROLE_ID).catch(() => {});
              for (const rid of savedRoles) {
                const r = guild.roles.cache.get(rid);
                if (r && !r.managed) await m.roles.add(rid).catch(() => {});
              }
              const LeaveRequest = require('../models/LeaveRequest');
              await LeaveRequest.findOneAndUpdate(
                { guildId: guild.id, userId: targetUserId, status: 'approved' },
                { status: 'ended' }
              ).catch(() => {});
              try {
                await m.send({
                  embeds: [
                    new EmbedBuilder()
                      .setColor('#ff9800')
                      .setTitle('🔔 انتهت إجازتك')
                      .setDescription('**تم إنهاء إجازتك وإعادة رتبك تلقائياً. مرحباً بعودتك!**')
                      .setTimestamp()
                  ]
                });
              } catch {}
            } catch (err) { console.error('leave restore:', err?.message); }
          }, msLeft);
        }

        return interaction.editReply({
          embeds: [green(`✅ تم قبول إجازة <@${targetUserId}> لمدة ${durationLabel(officialDuration)} وتم تطبيق الرتب.`)]
        });
      }
    }
  }
};

module.exports.activePayments = activePayments;
