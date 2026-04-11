const mongoose = require('mongoose');

// ─── Teacher Model ─────────────────────────────────────────────────
const teacherSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Teacher name is required'],
      trim: true,
      maxlength: [100, 'Name cannot exceed 100 characters'],
    },
    contactNumber: {
      type: String,
      required: [true, 'Contact number is required'],
      match: [/^\d{10}$/, 'Contact number must be 10 digits'],
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email'],
    },
    dateOfBirth: { type: Date },
    yearsOfExperience: { type: Number, min: 0, default: 0 },
    qualification: {
      type: String,
      trim: true,
      maxlength: [200, 'Qualification cannot exceed 200 characters'],
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    classAssigned: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Class',
    },
    isActive: { type: Boolean, default: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    approvedAt: { type: Date },
  },
  { timestamps: true }
);

teacherSchema.index({ name: 'text' });

// ─── Volunteer Model ───────────────────────────────────────────────
const volunteerSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Volunteer name is required'],
      trim: true,
      maxlength: [100, 'Name cannot exceed 100 characters'],
    },
    contactNumber: {
      type: String,
      required: [true, 'Contact number is required'],
      match: [/^\d{10}$/, 'Contact number must be 10 digits'],
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email'],
    },
    dateOfBirth: { type: Date },
    role: {
      type: String,
      required: [true, 'Role is required'],
      trim: true,
      maxlength: [100, 'Role cannot exceed 100 characters'],
    },
    shift: {
      type: String,
      enum: ['Morning', 'Afternoon', 'Full Day'],
    },
    isActive: { type: Boolean, default: true },
    notes: { type: String, trim: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    approvedAt: { type: Date },
  },
  { timestamps: true }
);

volunteerSchema.index({ name: 'text' });

// FIX: Use mongoose.models cache to prevent "Cannot overwrite model" error
// on Vercel serverless hot-reload (same pattern as Attendance.js / Staging.js)
const Teacher = mongoose.models.Teacher || mongoose.model('Teacher', teacherSchema);
const Volunteer = mongoose.models.Volunteer || mongoose.model('Volunteer', volunteerSchema);

module.exports = { Teacher, Volunteer };
