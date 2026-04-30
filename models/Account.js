const mongoose = require('mongoose');

const AccountSchema = new mongoose.Schema({
  name: { type: String, required: true },
  provider: { type: String, enum: ['facebook', 'shopee'], default: 'facebook' },
  fbToken: { type: String, default: '' },
  adAccountId: { type: String, required: true },
  claudeKey: { type: String, default: '' },
  spendThreshold: { type: Number, default: 20000 },
  checkInterval: { type: Number, default: 60 },
  autoEnabled: { type: Boolean, default: false },
  status: { type: String, enum: ['connected', 'error', 'disconnected'], default: 'disconnected' },
  lastChecked: { type: Date },
  linkedPageIds: [{ type: String }],
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Account', AccountSchema);
