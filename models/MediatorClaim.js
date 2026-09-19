const mongoose = require('mongoose');

const schema = new mongoose.Schema({
  guildId: { type: String, index: true },
  channelId: { type: String, required: true, index: true },
  ticketOwnerId: { type: String, default: null },
  mediatorId: { type: String, required: true, index: true },
  status: { type: String, default: 'open' },
  claimedAt: { type: Date, default: Date.now },
  rated: { type: Boolean, default: false }
}, { strict: false, timestamps: true });

module.exports = mongoose.models.MediatorClaim || mongoose.model('MediatorClaim', schema);
