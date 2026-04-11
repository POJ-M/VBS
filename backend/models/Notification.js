const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: [
        'attendance_pending',
        'time_window_reminder',
        'time_window_expired',
        'pending_verification',
        'entry_approved',
        'entry_rejected',
        'low_attendance_alert',
        'teacher_attendance_reminder',
        'volunteer_attendance_reminder',
        'system_announcement',
        'deadline_approaching',
        'settings_updated',
        'attendance_modified',
      ],
      required: true,
    },
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    recipientRole: {
      type: String,
      enum: ['admin', 'editor', 'viewer', 'teacher'],
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: [200, 'Title cannot exceed 200 characters'],
    },
    message: {
      type: String,
      required: true,
      trim: true,
    },
    priority: {
      type: String,
      enum: ['critical', 'high', 'medium', 'low'],
      default: 'medium',
    },
    isRead: { type: Boolean, default: false },
    readAt: { type: Date },
    data: {
      classId: { type: mongoose.Schema.Types.ObjectId, ref: 'Class' },
      teacherId: { type: mongoose.Schema.Types.ObjectId, ref: 'Teacher' },
      volunteerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Volunteer' },
      studentId: String,
      date: Date,
      actionUrl: String,
      rejectionReason: String,
    },
    expiresAt: {
      type: Date,
      default: () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
    },
  },
  { timestamps: true }
);

notificationSchema.index({ recipient: 1, isRead: 1, createdAt: -1 });
notificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // TTL index

module.exports = mongoose.model('Notification', notificationSchema);
