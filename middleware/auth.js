const jwt = require('jsonwebtoken');
const User = require('../models/User');

const JWT_SECRET = process.env.JWT_SECRET || 'adsctrl_secret_key_12345';

async function authMiddleware(req, res, next) {
  try {
    const authHeader = req.header('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Chua dang nhap (Thieu token)' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET);

    const user = await User.findById(decoded.id);
    if (!user) {
      return res.status(401).json({ error: 'Tai khoan khong ton tai' });
    }

    req.user = user;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Token khong hop le hoac da het han' });
  }
}

module.exports = { authMiddleware, JWT_SECRET };
