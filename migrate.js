require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');
const Account = require('./models/Account');
const Campaign = require('./models/Campaign');
const Config = require('./models/Config');
const FacebookToken = require('./models/FacebookToken');
const Log = require('./models/Log');
const Order = require('./models/Order');

async function migrate() {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/ads_tool');
  let admin = await User.findOne({ username: 'admin' });
  if (!admin) {
    admin = new User({ username: 'admin', password: 'admin', role: 'admin' });
    await admin.save();
    console.log('Created admin user with password: admin');
  }

  const filter = { userId: null }; // Or {$exists: false} but null works if not set
  const updates = { $set: { userId: admin._id } };

  // For documents missing userId
  const rawFilter = { userId: { $exists: false } };

  await Account.updateMany(rawFilter, updates);
  await Campaign.updateMany(rawFilter, updates);
  await Config.updateMany(rawFilter, updates);
  await FacebookToken.updateMany(rawFilter, updates);
  await Log.updateMany(rawFilter, updates);
  await Order.updateMany(rawFilter, updates);
  
  await Account.updateMany({ userId: null }, updates);
  await Campaign.updateMany({ userId: null }, updates);
  await Config.updateMany({ userId: null }, updates);
  await FacebookToken.updateMany({ userId: null }, updates);
  
  console.log('Migration completed');
  mongoose.disconnect();
}

migrate().catch(console.error);
