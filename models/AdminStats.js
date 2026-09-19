const mongoose = require('mongoose');

const schema = new mongoose.Schema({
  guildId: { type: String, required: true },
  adminId: { type: String, required: true },
  claimsCount: { type: Number, default: 0 }
}, { strict: false, timestamps: true });
schema.index({ guildId: 1, adminId: 1 }, { unique: true });

module.exports = mongoose.models.AdminStats || mongoose.model('AdminStats', schema);
