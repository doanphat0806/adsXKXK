const mongoose = require('mongoose');

mongoose.connect('mongodb://127.0.0.1:27017/fb_ads_dashboard').then(async () => {
  const AccountSchema = new mongoose.Schema({ fbToken: String }, { strict: false });
  const Account = mongoose.model('Account', AccountSchema);
  
  const result = await Account.updateMany({}, { $set: { fbToken: '' } });
  console.log('Cleared tokens from accounts:', result);
  process.exit(0);
}).catch(err => {
  console.error(err);
  process.exit(1);
});
