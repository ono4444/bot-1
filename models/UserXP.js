const mongoose = require('mongoose');

const schema = new mongoose.Schema({
  guildId: { type: String, required: true, index: true },
  userId: { type: String, required: true, index: true },
  textXp: { type: Number, default: 0 },
  voiceXp: { type: Number, default: 0 },
  totalXp: { type: Number, default: 0 },
  level: { type: Number, default: 0 },
  lastAnnouncedLevel: { type: Number, default: -1 },
  totalVoiceMinutes: { type: Number, default: 0 },
  dailyResetAt: Date, weeklyResetAt: Date, monthlyResetAt: Date,
  dailyTextXp: { type: Number, default: 0 },
  weeklyTextXp: { type: Number, default: 0 },
  monthlyTextXp: { type: Number, default: 0 },
  dailyVoiceXp: { type: Number, default: 0 },
  weeklyVoiceXp: { type: Number, default: 0 },
  monthlyVoiceXp: { type: Number, default: 0 }
}, { strict: false, timestamps: true });
schema.index({ guildId: 1, userId: 1 }, { unique: true });

module.exports = mongoose.models.UserXP || mongoose.model('UserXP', schema);
