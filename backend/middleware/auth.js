const jwt = require('jsonwebtoken');
const User = require('../models/User');

// ─── Guard: JWT secrets must be set ───────────────────────────────
// Validated at server startup (server.js), but double-check here as a safety net
if (!process.env.JWT_SECRET || !process.env.JWT_REFRESH_SECRET) {
  throw new Error('JWT_SECRET and JWT_REFRESH_SECRET environment variables are required');
}

// ─── Minimum secret strength validation ───────────────────────────
if (process.env.JWT_SECRET.length < 32 || process.env.JWT_REFRESH_SECRET.length < 32) {
  console.warn('⚠️  JWT secrets should be at least 32 characters for production security');
}

// ─── Generate Tokens ───────────────────────────────────────────────
const generateTokens = (userId) => {
  const accessToken = jwt.sign(
    { id: userId },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRE || '15m' } // FIX: Shorter default (15m not 7d)
  );
  const refreshToken = jwt.sign(
    { id: userId },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: process.env.JWT_REFRESH_EXPIRE || '30d' }
  );
  return { accessToken, refreshToken };
};

// ─── Protect Routes ────────────────────────────────────────────────
const protect = async (req, res, next) => {
  try {
    let token;
    if (req.headers.authorization?.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }
    if (!token) {
      return res.status(401).json({ success: false, message: 'Not authorized, no token' });
    }

    // FIX: Explicitly specify algorithm to prevent algorithm confusion attacks
    const decoded = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
    const user = await User.findById(decoded.id).select('-password -refreshTokens');

    if (!user) {
      return res.status(401).json({ success: false, message: 'User not found' });
    }
    if (!user.isActive) {
      return res.status(401).json({ success: false, message: 'Account is deactivated' });
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, message: 'Token expired' });
    }
    // FIX: Don't leak internal error details
    return res.status(401).json({ success: false, message: 'Invalid token' });
  }
};

// ─── Role-Based Authorization ──────────────────────────────────────
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Access denied`,
      });
    }
    next();
  };
};

// ─── Admin Only ────────────────────────────────────────────────────
const adminOnly = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'This action is restricted to administrators only',
    });
  }
  next();
};

// ─── Editor or Admin ───────────────────────────────────────────────
const editorOrAdmin = (req, res, next) => {
  if (!['admin', 'editor'].includes(req.user.role)) {
    return res.status(403).json({
      success: false,
      message: 'This action requires editor or admin access',
    });
  }
  next();
};

module.exports = { generateTokens, protect, authorize, adminOnly, editorOrAdmin };
