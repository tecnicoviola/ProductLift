const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Blocks the request unless a valid token is provided.
const auth = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      return res.status(401).json({ success: false, message: 'No token provided' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId).select('-password');

    if (!user) {
      return res.status(401).json({ success: false, message: 'User not found' });
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, message: 'Token expired' });
    }
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ success: false, message: 'Invalid token' });
    }
    res.status(401).json({ success: false, message: 'Authentication failed' });
  }
};

// Like auth, but never blocks the request: a missing, invalid, or
// expired token just means the visitor is treated as anonymous.
const authOptional = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (token) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.userId).select('-password');
      if (user) req.user = user;
    }
  } catch (error) {
    // Invalid or expired token: continue as anonymous
  }
  next();
};

module.exports = auth;
module.exports.authOptional = authOptional;