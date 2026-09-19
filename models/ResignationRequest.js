const mongoose = require('mongoose');

const schema = new mongoose.Schema({
  guildId: { type: String, index: true },
  userId: { type: String, index: true },
  name: String,
  reason: String,
  roleInfo: String,
  status: { type: String, default: 'pending' },
  messageId: String,
  channelId: String
}, { strict: false, timestamps: true });

module.exports = mongoose.models.ResignationRequest || mongoose.model('ResignationRequest', schema);
