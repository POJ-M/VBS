// backend/models/QRSession.js — Enhanced with admin-defined time windows
const mongoose = require('mongoose');

const qrSessionSchema = new mongoose.Schema(
  {
    token: {
      type: String,
      required: true,
      unique: true,
    },
    date: {
      type: Date,
      required: true,
    },
    vbsYear: {
      type: Number,
      required: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    label: {
      type: String,
      trim: true,
      default: '',
    },

    // ─── Admin-defined Attendance Time Window ───────────────────────
    // onTimeUntil: Scans at or before this time are "present"
    // Scans after onTimeUntil but before expiresAt are "late"
    // onTimeUntil is stored as an ISO datetime string (IST)
    onTimeUntil: {
      type: Date,
      required: false,
      default: null,
      // If null, the legacy 30-min heuristic is used as fallback
    },

    // Human-readable time strings for display (IST HH:MM)
    windowStartTime: {
      type: String,  // e.g. "08:00"
      default: null,
    },
    onTimeUntilTimeStr: {
      type: String,  // e.g. "08:30"
      default: null,
    },

    scans: [
      {
        teacher:     { type: mongoose.Schema.Types.ObjectId, ref: 'Teacher' },
        teacherName: String,
        scannedAt:   { type: Date, default: Date.now },
        status:      { type: String, enum: ['present', 'late'], default: 'present' },
        arrivalTime: String,
        // Store the raw IST time string for audit
        scannedAtTimeStr: String,
      },
    ],
  },
  { timestamps: true }
);

// TTL: keep sessions for 30 days after expiry for audit
qrSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 2592000 });
qrSessionSchema.index({ token: 1 });
qrSessionSchema.index({ date: 1, vbsYear: 1 });

module.exports = mongoose.models.QRSession || mongoose.model('QRSession', qrSessionSchema);
