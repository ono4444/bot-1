const mongoose = require('mongoose');

const schema = new mongoose.Schema({
  guildId: { type: String, index: true },
  channelId: { type: String, required: true },
  claimerId: { type: String, required: true, index: true },
  status: { type: String, enum: ['open', 'closed', 'unclaimed'], default: 'open' },
  claimedAt: { type: Date, default: Date.now },
  unclaimedAt: Date,
  closedAt: Date
}, { strict: false, timestamps: true });

module.exports = mongoose.models.AlayaClaim || mongoose.model('AlayaClaim', schema);
