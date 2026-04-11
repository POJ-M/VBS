const Notification = require('../models/Notification');
const User = require('../models/User');

/**
 * Creates a notification for a specific user.
 */
const createNotification = async ({
  type,
  recipientId,
  recipientRole,
  title,
  message,
  priority = 'medium',
  data = {},
}) => {
  try {
    return await Notification.create({
      type,
      recipient: recipientId,
      recipientRole,
      title,
      message,
      priority,
      data,
    });
  } catch (err) {
    console.error('Notification creation failed:', err.message);
  }
};

/**
 * Broadcasts a notification to all users of a specific role.
 */
const broadcastToRole = async ({ type, role, title, message, priority = 'medium', data = {} }) => {
  try {
    const users = await User.find({ role, isActive: true }).select('_id role');
    const notifications = users.map((u) => ({
      type,
      recipient: u._id,
      recipientRole: u.role,
      title,
      message,
      priority,
      data,
    }));
    if (notifications.length > 0) {
      await Notification.insertMany(notifications);
    }
  } catch (err) {
    console.error('Broadcast notification failed:', err.message);
  }
};

/**
 * Notifies all admins.
 */
const notifyAdmins = async ({ type, title, message, priority = 'medium', data = {} }) => {
  return broadcastToRole({ type, role: 'admin', title, message, priority, data });
};

/**
 * Notifies all editors.
 */
const notifyEditors = async ({ type, title, message, priority = 'medium', data = {} }) => {
  return broadcastToRole({ type, role: 'editor', title, message, priority, data });
};

/**
 * Notify admin when editor submits new entry for verification.
 */
const notifyPendingVerification = async (entityType, entityName, editorName) => {
  return notifyAdmins({
    type: 'pending_verification',
    title: 'New Entry Pending Verification',
    message: `${editorName} added a new ${entityType}: "${entityName}". Please review and approve.`,
    priority: 'medium',
  });
};

/**
 * Notify editor when their entry is approved.
 */
const notifyEntryApproved = async (editorId, entityType, entityName) => {
  return createNotification({
    type: 'entry_approved',
    recipientId: editorId,
    recipientRole: 'editor',
    title: 'Entry Approved',
    message: `Your ${entityType} entry "${entityName}" has been approved and added to the system.`,
    priority: 'low',
  });
};

/**
 * Notify editor when their entry is rejected.
 */
const notifyEntryRejected = async (editorId, entityType, entityName, reason) => {
  return createNotification({
    type: 'entry_rejected',
    recipientId: editorId,
    recipientRole: 'editor',
    title: 'Entry Rejected',
    message: `Your ${entityType} entry "${entityName}" was rejected. Reason: ${reason}`,
    priority: 'medium',
    data: { rejectionReason: reason },
  });
};

/**
 * Notify teacher about attendance.
 */
const notifyTeacherAttendancePending = async (teacherUserId, className, minutesLeft) => {
  return createNotification({
    type: minutesLeft <= 30 ? 'time_window_reminder' : 'attendance_pending',
    recipientId: teacherUserId,
    recipientRole: 'teacher',
    title: minutesLeft <= 30 ? '⚠️ Attendance Deadline Approaching' : 'Attendance Pending',
    message:
      minutesLeft <= 30
        ? `Only ${minutesLeft} minutes left to submit attendance for ${className}!`
        : `Please submit attendance for ${className}. Time window is open.`,
    priority: minutesLeft <= 30 ? 'critical' : 'high',
  });
};

module.exports = {
  createNotification,
  broadcastToRole,
  notifyAdmins,
  notifyEditors,
  notifyPendingVerification,
  notifyEntryApproved,
  notifyEntryRejected,
  notifyTeacherAttendancePending,
};
