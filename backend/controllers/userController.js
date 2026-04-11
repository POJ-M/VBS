const User = require('../models/User');
const { Teacher } = require('../models/TeacherVolunteer');

// @desc    Get all users
// @route   GET /api/users
// @access  Admin
const getUsers = async (req, res, next) => {
  try {
    const { role, isActive, search } = req.query;
    const filter = {};
    if (role) filter.role = role;
    if (isActive !== undefined) filter.isActive = isActive === 'true';
    if (search) filter.name = { $regex: search, $options: 'i' };

    const users = await User.find(filter)
      .populate('createdBy', 'name userID')
      .sort({ createdAt: -1 });

    res.json({ success: true, count: users.length, data: users });
  } catch (err) {
    next(err);
  }
};

// @desc    Create user (editor/viewer/teacher)
// @route   POST /api/users
// @access  Admin
const createUser = async (req, res, next) => {
  try {
    const { userID, password, role, name, email } = req.body;

    if (role === 'admin') {
      return res.status(403).json({ success: false, message: 'Admin accounts cannot be created via UI' });
    }
    if (!['editor', 'viewer', 'teacher'].includes(role)) {
      return res.status(400).json({ success: false, message: 'Invalid role. Must be editor, viewer, or teacher' });
    }

    const existing = await User.findOne({ userID: userID.toLowerCase() });
    if (existing) {
      return res.status(400).json({ success: false, message: 'Username already exists' });
    }

    const user = await User.create({
      userID,
      password,
      role,
      name,
      email,
      createdBy: req.user._id,
      mustChangePassword: true,
    });

    res.status(201).json({
      success: true,
      message: 'User created successfully',
      data: { ...user.toJSON(), tempPassword: password },
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Update user
// @route   PUT /api/users/:id
// @access  Admin
const updateUser = async (req, res, next) => {
  try {
    const { name, email, isActive, role } = req.body;

    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    if (user.role === 'admin' && req.user._id.toString() !== user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Cannot modify another admin account' });
    }
    if (role === 'admin') {
      return res.status(403).json({ success: false, message: 'Cannot assign admin role via UI' });
    }

    if (name !== undefined) user.name = name;
    if (email !== undefined) user.email = email;
    if (isActive !== undefined) user.isActive = isActive;
    if (role !== undefined) user.role = role;

    await user.save();
    res.json({ success: true, message: 'User updated', data: user });
  } catch (err) {
    next(err);
  }
};

// @desc    Reset user password (admin resets for another user)
// @route   PUT /api/users/:id/reset-password
// @access  Admin
const resetPassword = async (req, res, next) => {
  try {
    const { newPassword } = req.body;
    if (!newPassword || newPassword.length < 8) {
      return res.status(400).json({ success: false, message: 'Password must be at least 8 characters' });
    }

    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    user.password = newPassword;
    user.mustChangePassword = true;
    user.refreshTokens = [];
    await user.save();

    res.json({ success: true, message: 'Password reset. User must change on next login.' });
  } catch (err) {
    next(err);
  }
};

// @desc    Delete user
// @route   DELETE /api/users/:id
// @access  Admin
const deleteUser = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    if (user.role === 'admin') {
      return res.status(403).json({ success: false, message: 'Admin accounts cannot be deleted via UI' });
    }
    await User.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'User deleted' });
  } catch (err) {
    next(err);
  }
};

module.exports = { getUsers, createUser, updateUser, resetPassword, deleteUser };
