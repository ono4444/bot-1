const mongoose = require('mongoose');

const schema = new mongoose.Schema({
  guildId: { type: String, index: true },
  userId: { type: String, index: true },
  type: String,
  duration: String,
  reason: String,
  roleInfo: String,
  status: { type: String, default: 'pending' },
  messageId: String,
  channelId: String,
  dailyKey: { type: String, default: null },
  reviewedBy: String,
  officialDuration: String,
  leaveDays: Number,
  leaveEndsAt: Date,
  savedRoles: [String]
}, { strict: false, timestamps: true });

module.exports = mongoose.models.LeaveRequest || mongoose.model('LeaveRequest', schema);
