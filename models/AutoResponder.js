const mongoose = require('mongoose');

const schema = new mongoose.Schema({
  guildId: { type: String, required: true, index: true },
  trigger: { type: String, required: true, lowercase: true, trim: true },
  response: { type: String, required: true },
  matchType: { type: String, enum: ['exact', 'contains'], default: 'exact' }
}, { strict: false, timestamps: true });

module.exports = mongoose.models.AutoResponder || mongoose.model('AutoResponder', schema);
