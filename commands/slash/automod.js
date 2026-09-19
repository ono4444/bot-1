// commands/slash/automod.js
const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');

const ALLOWED_USERS = ['1086312520874217644', '1502082364925280377'];

module.exports = {
  data: new SlashCommandBuilder()
    .setName('automod')
    .setDescription('إدارة قواعد AutoMod عبر البوت')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)

    .addSubcommand(sub =>
      sub.setName('block')
        .setDescription('إضافة كلمة أو جملة محظورة عبر AutoMod')
        .addStringOption(o =>
          o.setName('word')
            .setDescription('الكلمة المراد حظرها')
            .setRequired(true)
        )
    )

    .addSubcommand(sub =>
      sub.setName('list')
        .setDescription('عرض قواعد AutoMod الحالية في السيرفر')
    ),

  async execute(interaction) {
    if (!ALLOWED_USERS.includes(interaction.user.id)) {
      return interaction.reply({ content: '❌ ما عندك صلاحية.', ephemeral: true });
    }

    const sub  = interaction.options.getSubcommand();
    const word = interaction.options.getString('word')?.trim();

    // ================================================================
    // BLOCK
    // ================================================================
    if (sub === 'block') {
      // نرد فوراً عشان ما يظهر "thinking"
      await interaction.reply({
        embeds: [new EmbedBuilder().setColor(0x2ecc71).setDescription(`⏳ جاري إضافة \`${word}\`...`)],
        ephemeral: true,
      });

      try {
        const rules    = await interaction.guild.autoModerationRules.fetch();
        const existing = rules.find(r => r.name === 'Bot Blocked Words');

        if (existing) {
          const currentWords = existing.triggerMetadata?.keywordFilter || [];
          if (currentWords.includes(word)) {
            return interaction.editReply({
              embeds: [new EmbedBuilder().setColor(0xe67e22).setDescription(`⚠️ الكلمة \`${word}\` موجودة مسبقاً.`)]
            });
          }
          await existing.edit({ triggerMetadata: { keywordFilter: [...currentWords, word] } });
        } else {
          await interaction.guild.autoModerationRules.create({
            name:            'Bot Blocked Words',
            eventType:       1,
            triggerType:     1,
            triggerMetadata: { keywordFilter: [word] },
            actions:         [{ type: 1 }],
            enabled:         true,
          });
        }

        return interaction.editReply({
          embeds: [new EmbedBuilder().setColor(0x2ecc71).setDescription(
            `✅ تم إضافة \`${word}\` لقائمة الكلمات المحظورة عبر AutoMod.`
          )]
        });

      } catch (err) {
        console.error('automod block error:', err?.message || err);
        return interaction.editReply({
          embeds: [new EmbedBuilder().setColor(0xe74c3c).setDescription(`❌ صار خطأ: ${err?.message || err}`)]
        });
      }
    }

    // ================================================================
    // LIST
    // ================================================================
    if (sub === 'list') {
      await interaction.reply({
        embeds: [new EmbedBuilder().setColor(0x5865f2).setDescription('⏳ جاري جلب القواعد...')],
        ephemeral: true,
      });

      try {
        const rules = await interaction.guild.autoModerationRules.fetch();

        if (!rules.size) {
          return interaction.editReply({ content: '📭 لا توجد قواعد AutoMod في السيرفر.' });
        }

        return interaction.editReply({
          embeds: [new EmbedBuilder()
            .setColor(0x5865f2)
            .setTitle('🛡️ قواعد AutoMod الحالية')
            .setDescription(rules.map(r => `**${r.name}** — ${r.enabled ? '✅ مفعّل' : '❌ معطّل'}`).join('\n'))
            .setTimestamp()
          ]
        });

      } catch (err) {
        console.error('automod list error:', err?.message || err);
        return interaction.editReply({
          embeds: [new EmbedBuilder().setColor(0xe74c3c).setDescription(`❌ صار خطأ: ${err?.message || err}`)]
        });
      }
    }
  },
};
