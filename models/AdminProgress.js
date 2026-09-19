const mongoose = require('mongoose');

const schema = new mongoose.Schema({
  guildId: { type: String, required: true },
  userId: { type: String, required: true },
  level: { type: Number, default: 0 },
  points: {
    tickets: { type: Number, default: 0 },
    warns: { type: Number, default: 0 },
    xp: { type: Number, default: 0 }
  },
  lifetime: {
    tickets: { type: Number, default: 0 },
    warns: { type: Number, default: 0 },
    xp: { type: Number, default: 0 }
  }
}, { strict: false, timestamps: true });
schema.index({ guildId: 1, userId: 1 }, { unique: true });

module.exports = mongoose.models.AdminProgress || mongoose.model('AdminProgress', schema);
