const { tenantPlugin } = require('../middleware/tenant');
const mongoose = require('mongoose');

const ConfigSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  key: { type: String, required: true },
  fbToken: { type: String, default: '' },
  fbTokenExpiresAt: { type: Date },
  fbTokenLastRefreshTime: { type: Date },
  fbTokenLastDebugTime: { type: Date },
  fbTokenLastRefreshError: { type: String, default: '' },
  claudeKey: { type: String, default: '' },
  fbAppId: { type: String, default: '' },
  fbAppSecret: { type: String, default: '' },
  pancakeApiKey: { type: String, default: '' },
  pancakeShopId: { type: String, default: '' },
  autoRuleStartTime: { type: String, default: '00:00' },
  autoRuleEndTime: { type: String, default: '09:00' },
  
  dailyZeroMessageSpendLimit: { type: Number, default: 25000 },
  dailyHighCostPerMessageLimit: { type: Number, default: 20000 },
  dailyHighCostSpendLimit: { type: Number, default: 50000 },
  dailyClickLimit: { type: Number, default: 0 },
  dailyCpcLimit: { type: Number, default: 500 },
  
  lifetimeZeroMessageSpendLimit: { type: Number, default: 25000 },
  lifetimeHighCostPerMessageLimit: { type: Number, default: 20000 },
  lifetimeHighCostSpendLimit: { type: Number, default: 50000 },
  lifetimeClickLimit: { type: Number, default: 0 },
  lifetimeCpcLimit: { type: Number, default: 500 },

  updatedAt: { type: Date, default: Date.now }
});

ConfigSchema.plugin(tenantPlugin);
module.exports = mongoose.model('Config', ConfigSchema);
