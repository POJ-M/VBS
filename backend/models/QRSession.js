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
    scans: [
      {
        teacher:     { type: mongoose.Schema.Types.ObjectId, ref: 'Teacher' },
        teacherName: String,
        scannedAt:   { type: Date, default: Date.now },
        status:      { type: String, enum: ['present', 'late'], default: 'present' },
        arrivalTime: String,
      },
    ],
  },
  { timestamps: true }
);

// FIXED: TTL changed from 86400s (1 day) to 2592000s (30 days)
// Admins can now review QR session history for a full month
qrSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 2592000 });
qrSessionSchema.index({ token: 1 });
qrSessionSchema.index({ date: 1, vbsYear: 1 });

module.exports = mongoose.models.QRSession || mongoose.model('QRSession', qrSessionSchema);
