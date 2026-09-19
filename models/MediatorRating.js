const mongoose = require('mongoose');

const schema = new mongoose.Schema({
  guildId: { type: String, index: true },
  channelId: String,
  claimId: { type: mongoose.Schema.Types.ObjectId },
  mediatorId: { type: String, index: true },
  raterId: String,
  stars: { type: Number, min: 1, max: 5 }
}, { strict: false, timestamps: true });

module.exports = mongoose.models.MediatorRating || mongoose.model('MediatorRating', schema);
