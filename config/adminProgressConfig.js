// إعدادات نظام تقدم الإداريين (ترقيات / نقاط).
// كل القيم هنا افتراضية وفارغة عشان البوت يشتغل، عبّيها بمعرّفات سيرفرك.

module.exports = {
  // أسماء بديلة للأوامر: { WARN: ['warn', ...], TASKS: [...] }
  ALIASES: {},

  // رتبة الدعم/الإداريين اللي تكسب نقاط (اتركها null لتعطيل النظام)
  SUPPORT_ROLE_ID: process.env.SUPPORT_ROLE_ID || null,

  // رتبة مسموح لها أمر "تعديل" (كسر/تعديل النقاط)
  EDIT_BREAK_ALLOWED_ROLE_ID: process.env.EDIT_BREAK_ALLOWED_ROLE_ID || null,

  // رتبة مسموح لها أمر التحذير
  WARN_ALLOWED_ROLE_ID: process.env.WARN_ALLOWED_ROLE_ID || null,

  // رومات مسموح فيها أمر التحذير (فاضية = ما في تقييد بالروم)
  WARN_COMMAND_CHANNEL_IDS: (process.env.WARN_COMMAND_CHANNEL_IDS || '')
    .split(',').map(s => s.trim()).filter(Boolean),

  // صورة الخط اللي تظهر أسفل اللوحات (رابط يبدأ بـ https://) أو اتركها فاضية
  PANEL_LINE_IMAGE_URL: process.env.PANEL_LINE_IMAGE_URL || '',

  // روم إعلان الترقيات
  PROMOTION_ANNOUNCE_CHANNEL_ID: process.env.PROMOTION_ANNOUNCE_CHANNEL_ID || null,

  // مستويات الترقية. مثال:
  // {
  //   level: 1,
  //   name: 'إداري مبتدئ',
  //   roles: ['ROLE_ID'],
  //   req: { tickets: 20, warns: 5, xp: 500, xpLevel: 3 }
  // }
  LEVEL_CONFIGS: []
};
