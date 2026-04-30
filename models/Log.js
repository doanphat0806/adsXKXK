const mongoose = require('mongoose');

const LogSchema = new mongoose.Schema({
  accountId: { type: mongoose.Schema.Types.ObjectId, ref: 'Account' },
  accountName: { type: String },
  level: { type: String, enum: ['info', 'success', 'warn', 'error', 'ai'], default: 'info' },
  message: { type: String },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Log', LogSchema);
