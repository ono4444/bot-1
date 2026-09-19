const mongoose = require('mongoose');

const schema = new mongoose.Schema({
  guildId: { type: String, index: true },
  channelId: { type: String, required: true, index: true },
  claimedById: { type: String, required: true, index: true },
  claimedAt: { type: Date, default: Date.now }
}, { strict: false, timestamps: true });

module.exports = mongoose.models.TicketClaim || mongoose.model('TicketClaim', schema);
