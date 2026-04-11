const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { generateTokens } = require('../middleware/auth');

// ─── Timing-safe string comparison helper ─────────────────────────
const crypto = require('crypto');
const safeEqual = (a, b) => {
  try {
    return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
  } catch {
    return false;
  }
};

// ─── Clean expired refresh tokens from user document ─────────────
const cleanExpiredTokens = (refreshTokens) => {
  const now = Date.now();
  return refreshTokens.filter((t) => {
    try {
      jwt.verify(t.token, process.env.JWT_REFRESH_SECRET, { algorithms: ['HS256'] });
      return true;
    } catch {
      return false; // Remove expired/invalid tokens
    }
  });
};

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
const login = async (req, res, next) => {
  try {
    const { userID, password } = req.body;
    if (!userID || !password) {
      return res.status(400).json({ success: false, message: 'Please provide username and password' });
    }

    // FIX: Always query regardless of user existence to prevent user enumeration timing attacks
    const user = await User.findOne({ userID: userID.toLowerCase().trim() }).select('+password');

    // FIX: Use constant-time comparison; compare password even if user not found
    // to prevent timing-based user enumeration
    const dummyHash = '$2a$12$invalidhashfortimingprotection.notarealpassword123';
    const isValid = user
      ? await user.comparePassword(password)
      : await User.schema.methods.comparePassword.call({ password: dummyHash }, password).catch(() => false);

    if (!user || !isValid) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }
    if (!user.isActive) {
      return res.status(401).json({ success: false, message: 'Account is deactivated. Contact admin.' });
    }

    const { accessToken, refreshToken } = generateTokens(user._id);

    // Clean expired tokens, then add new one (keep max 5)
    user.refreshTokens = cleanExpiredTokens(user.refreshTokens);
    user.refreshTokens.push({ token: refreshToken, createdAt: new Date() });
    if (user.refreshTokens.length > 5) user.refreshTokens = user.refreshTokens.slice(-5);
    user.lastLogin = new Date();
    await user.save();

    res.json({
      success: true,
      data: {
        accessToken,
        refreshToken,
        user: {
          _id: user._id,
          userID: user.userID,
          name: user.name,
          role: user.role,
          email: user.email,
          mustChangePassword: user.mustChangePassword,
        },
      },
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Refresh access token
// @route   POST /api/auth/refresh
// @access  Public
const refresh = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return res.status(401).json({ success: false, message: 'No refresh token' });
    }

    let decoded;
    try {
      decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET, { algorithms: ['HS256'] });
    } catch {
      return res.status(401).json({ success: false, message: 'Invalid or expired refresh token' });
    }

    const user = await User.findById(decoded.id).select('+refreshTokens');
    if (!user || !user.isActive) {
      return res.status(401).json({ success: false, message: 'Invalid refresh token' });
    }

    // FIX: Use timing-safe comparison to find the token
    const tokenEntry = user.refreshTokens.find((t) => safeEqual(t.token, refreshToken));
    if (!tokenEntry) {
      // FIX: Token not found = possible token reuse attack — invalidate ALL tokens for this user
      user.refreshTokens = [];
      await user.save();
      return res.status(401).json({ success: false, message: 'Invalid refresh token — all sessions invalidated' });
    }

    // FIX: Rotate refresh token — remove old, issue new (prevent replay attacks)
    const { accessToken, refreshToken: newRefreshToken } = generateTokens(user._id);
    user.refreshTokens = user.refreshTokens.filter((t) => !safeEqual(t.token, refreshToken));
    user.refreshTokens.push({ token: newRefreshToken, createdAt: new Date() });
    if (user.refreshTokens.length > 5) user.refreshTokens = user.refreshTokens.slice(-5);
    await user.save();

    res.json({ success: true, data: { accessToken, refreshToken: newRefreshToken } });
  } catch (err) {
    next(err);
  }
};

// @desc    Logout
// @route   POST /api/auth/logout
// @access  Private
const logout = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    const user = await User.findById(req.user._id).select('+refreshTokens');
    if (user && refreshToken) {
      user.refreshTokens = user.refreshTokens.filter((t) => {
        try {
          return !safeEqual(t.token, refreshToken);
        } catch {
          return true;
        }
      });
      await user.save();
    }
    res.json({ success: true, message: 'Logged out successfully' });
  } catch (err) {
    next(err);
  }
};

// @desc    Change password
// @route   PUT /api/auth/change-password
// @access  Private
const changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ success: false, message: 'Provide current and new password' });
    }
    if (newPassword.length < 8) {
      return res.status(400).json({ success: false, message: 'New password must be at least 8 characters' });
    }
    // FIX: Enforce stronger passwords in production
    if (process.env.NODE_ENV === 'production') {
      const strongPassword = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
      if (!strongPassword.test(newPassword)) {
        return res.status(400).json({
          success: false,
          message: 'Password must contain uppercase, lowercase, and a number',
        });
      }
    }

    const user = await User.findById(req.user._id).select('+password +refreshTokens');
    if (!(await user.comparePassword(currentPassword))) {
      return res.status(401).json({ success: false, message: 'Current password is incorrect' });
    }
    if (await user.comparePassword(newPassword)) {
      return res.status(400).json({ success: false, message: 'New password must differ from current password' });
    }

    user.password = newPassword;
    user.mustChangePassword = false;
    user.refreshTokens = []; // Invalidate all sessions on password change
    await user.save();

    res.json({ success: true, message: 'Password changed successfully. Please login again.' });
  } catch (err) {
    next(err);
  }
};

// @desc    Get current user profile
// @route   GET /api/auth/me
// @access  Private
const getMe = async (req, res) => {
  // req.user already excludes password and refreshTokens (set in protect middleware)
  res.json({ success: true, data: req.user });
};

module.exports = { login, refresh, logout, changePassword, getMe };
