const mongoose = require('mongoose');

const schema = new mongoose.Schema({
  guildId: { type: String, required: true, index: true },
  adminUserId: { type: String, required: true, index: true },
  targetLevel: { type: Number, required: true },
  approvedBy: { type: String },
  used: { type: Boolean, default: false }
}, { strict: false, timestamps: true });

module.exports = mongoose.models.AdminApproval || mongoose.model('AdminApproval', schema);
