const mongoose = require('mongoose');

const dailyThemeSchema = new mongoose.Schema({
  day: { type: Number, required: true },
  title: { type: String, required: true, trim: true },
  verse: { type: String, trim: true },
  verseText: { type: String, trim: true },
  description: { type: String, trim: true },
});

const photoSchema = new mongoose.Schema({
  url: { type: String, required: true },
  caption: { type: String, trim: true },
  year: { type: Number },
});

// FIX: Added youtubeVideos schema (was used in frontend but missing from model)
const youtubeVideoSchema = new mongoose.Schema({
  url: { type: String, required: true, trim: true },
  title: { type: String, trim: true },
  year: { type: Number },
});

const settingsSchema = new mongoose.Schema(
  {
    year: {
      type: Number,
      required: [true, 'VBS year is required'],
      unique: true,
    },
    vbsTitle: {
      type: String,
      required: [true, 'VBS title is required'],
      trim: true,
      maxlength: [200, 'Title cannot exceed 200 characters'],
    },
    vbsVerseRef: {
      type: String,
      trim: true,
      maxlength: [100, 'Verse reference cannot exceed 100 characters'],
    },
    vbsVerse: {
      type: String,
      trim: true,
      maxlength: [500, 'Verse cannot exceed 500 characters'],
    },
    tagline: {
      type: String,
      trim: true,
      maxlength: [300, 'Tagline cannot exceed 300 characters'],
    },
    theme: {
      mainColor: { type: String, default: '#2563EB' },
      accentColor: { type: String, default: '#F59E0B' },
      logo: { type: String },
      bannerImage: { type: String },
    },
    dates: {
      startDate: { type: Date, required: [true, 'Start date is required'] },
      endDate: { type: Date, required: [true, 'End date is required'] },
    },
    timeWindow: {
      studentAttendance: {
        startTime: { type: String, default: '08:00' },
        endTime: { type: String, default: '10:00' },
      },
      teacherAttendance: { flexible: { type: Boolean, default: true } },
      volunteerAttendance: { flexible: { type: Boolean, default: true } },
      timezone: { type: String, default: 'Asia/Kolkata' },
    },
    dailyThemes: [dailyThemeSchema],
    previousYearPhotos: [photoSchema],
    // FIX: Added missing youtubeVideos field
    youtubeVideos: [youtubeVideoSchema],
    isActive: {
      type: Boolean,
      default: false,
    },
    registrationEnabled: {
      type: Boolean,
      default: false,
    },
    registrationMessage: {
      type: String,
      trim: true,
    },
    lowAttendanceThreshold: {
      type: Number,
      default: 70,
      min: 0,
      max: 100,
    },
  },
  {
    timestamps: true,
  }
);

// Ensure only one active year
settingsSchema.pre('save', async function (next) {
  if (this.isActive && this.isModified('isActive')) {
    await this.constructor.updateMany(
      { _id: { $ne: this._id }, isActive: true },
      { isActive: false }
    );
  }
  next();
});

module.exports = mongoose.model('Settings', settingsSchema);
