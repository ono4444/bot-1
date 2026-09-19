const mongoose = require('mongoose');

const schema = new mongoose.Schema({
  guildId: { type: String, required: true, index: true },
  type: { type: String, enum: ['text', 'voice'], default: 'text' },
  level: { type: Number, required: true },
  roleId: { type: String, required: true }
}, { strict: false, timestamps: true });

module.exports = mongoose.models.LevelRole || mongoose.model('LevelRole', schema);
