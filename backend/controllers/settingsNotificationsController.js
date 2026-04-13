const Settings = require('../models/Settings');
const Notification = require('../models/Notification');
const User = require('../models/User');

// ─── SETTINGS ─────────────────────────────────────────────────────

const getSettings = async (req, res, next) => {
  try {
    const settings = await Settings.find().sort({ year: -1 });
    res.json({ success: true, data: settings });
  } catch (err) { next(err); }
};

const getActiveSettings = async (req, res, next) => {
  try {
    const settings = await Settings.findOne({ isActive: true });
    res.json({ success: true, data: settings });
  } catch (err) { next(err); }
};

const createSettings = async (req, res, next) => {
  try {
    const settings = await Settings.create(req.body);
    res.status(201).json({ success: true, message: 'VBS year created', data: settings });
  } catch (err) { next(err); }
};

const updateSettings = async (req, res, next) => {
  try {
    const settings = await Settings.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!settings) return res.status(404).json({ success: false, message: 'Settings not found' });
    res.json({ success: true, message: 'Settings updated', data: settings });
  } catch (err) { next(err); }
};

const activateYear = async (req, res, next) => {
  try {
    await Settings.updateMany({ isActive: true }, { isActive: false });
    const settings = await Settings.findByIdAndUpdate(req.params.id, { isActive: true }, { new: true });
    if (!settings) return res.status(404).json({ success: false, message: 'Settings not found' });
    res.json({ success: true, message: `VBS ${settings.year} is now active`, data: settings });
  } catch (err) { next(err); }
};

// ── NEW: Toggle attendance window stop/start ────────────────────────
// @desc    Stop or resume the attendance window (for leave days, cancelled sessions)
// @route   PUT /api/settings/:id/toggle-window
// @access  Admin
const toggleAttendanceWindow = async (req, res, next) => {
  try {
    const { stop, reason } = req.body;

    const settings = await Settings.findById(req.params.id);
    if (!settings) return res.status(404).json({ success: false, message: 'Settings not found' });

    if (!settings.isActive) {
      return res.status(400).json({ success: false, message: 'Can only toggle the active VBS year' });
    }

    const isStopping = stop === true;

    settings.timeWindow.attendanceStopped = isStopping;
    settings.timeWindow.stopReason = isStopping
      ? (reason?.trim() || 'Attendance window stopped by admin.')
      : '';
    settings.timeWindow.stoppedAt = isStopping ? new Date() : null;
    settings.timeWindow.stoppedBy = isStopping ? req.user._id : null;

    await settings.save();

    const message = isStopping
      ? `Attendance window stopped. Reason: ${settings.timeWindow.stopReason}`
      : 'Attendance window resumed. Teachers can now submit attendance.';

    res.json({
      success: true,
      message,
      data: {
        attendanceStopped: settings.timeWindow.attendanceStopped,
        stopReason: settings.timeWindow.stopReason,
        stoppedAt: settings.timeWindow.stoppedAt,
      },
    });
  } catch (err) { next(err); }
};

// ─── NOTIFICATIONS ─────────────────────────────────────────────────

const getNotifications = async (req, res, next) => {
  try {
    const { limit = 20, unreadOnly } = req.query;
    const filter = { recipient: req.user._id };
    if (unreadOnly === 'true') filter.isRead = false;

    const notifications = await Notification.find(filter)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit));

    const unreadCount = await Notification.countDocuments({ recipient: req.user._id, isRead: false });

    res.json({ success: true, data: notifications, unreadCount });
  } catch (err) { next(err); }
};

const markNotificationRead = async (req, res, next) => {
  try {
    const n = await Notification.findOneAndUpdate(
      { _id: req.params.id, recipient: req.user._id },
      { isRead: true, readAt: new Date() },
      { new: true }
    );
    if (!n) return res.status(404).json({ success: false, message: 'Notification not found' });
    res.json({ success: true, data: n });
  } catch (err) { next(err); }
};

const markAllRead = async (req, res, next) => {
  try {
    await Notification.updateMany(
      { recipient: req.user._id, isRead: false },
      { isRead: true, readAt: new Date() }
    );
    res.json({ success: true, message: 'All notifications marked as read' });
  } catch (err) { next(err); }
};

const broadcastNotification = async (req, res, next) => {
  try {
    const { roles, title, message, priority, type } = req.body;
    const targetRoles = roles || ['admin', 'editor', 'viewer', 'teacher'];

    const users = await User.find({ role: { $in: targetRoles }, isActive: true }).select('_id role');
    const notifications = users.map((u) => ({
      type: type || 'system_announcement',
      recipient: u._id,
      recipientRole: u.role,
      title,
      message,
      priority: priority || 'medium',
    }));

    await Notification.insertMany(notifications);
    res.json({ success: true, message: `Notification sent to ${notifications.length} users` });
  } catch (err) { next(err); }
};

module.exports = {
  getSettings, getActiveSettings, createSettings, updateSettings, activateYear,
  toggleAttendanceWindow,
  getNotifications, markNotificationRead, markAllRead, broadcastNotification,
};
