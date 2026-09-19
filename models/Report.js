const mongoose = require('mongoose');

const schema = new mongoose.Schema({
  guildId: { type: String, index: true },
  channelId: String,
  reporterId: String,
  details: String,
  link: String,
  status: String
}, { strict: false, timestamps: true });

module.exports = mongoose.models.Report || mongoose.model('Report', schema);
