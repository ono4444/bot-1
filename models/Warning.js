const mongoose = require('mongoose');

const schema = new mongoose.Schema({
  guildId: { type: String, required: true },
  userId: { type: String, required: true },
  total: { type: Number, default: 0 },
  infractions: [{
    caseId: String,
    moderatorId: String,
    reason: String,
    createdAt: { type: Date, default: Date.now }
  }]
}, { strict: false, timestamps: true });
schema.index({ guildId: 1, userId: 1 }, { unique: true });

module.exports = mongoose.models.Warning || mongoose.model('Warning', schema);
