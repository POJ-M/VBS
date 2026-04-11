const mongoose = require('mongoose');

const GRADE_TO_CATEGORY = {
  PreKG: 'Beginner', LKG: 'Beginner', UKG: 'Beginner',
  '1': 'Beginner', '2': 'Beginner',
  '3': 'Primary', '4': 'Primary', '5': 'Primary',
  '6': 'Junior', '7': 'Junior', '8': 'Junior',
  '9': 'Inter', '10': 'Inter', '11': 'Inter', '12': 'Inter',
};

// ─── Staging Student ───────────────────────────────────────────────
const stagingStudentSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    gender: { type: String, enum: ['male', 'female', 'other'], required: true },
    grade: {
      type: String,
      enum: ['PreKG', 'LKG', 'UKG', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'],
      required: true,
    },
    category: { type: String, enum: ['Beginner', 'Primary', 'Junior', 'Inter'] },
    religion: { type: String, enum: ['Christian', 'Hindu', 'Muslim', 'Other'], default: 'Christian' },
    // FIX: allow empty string instead of null in enum
    christianDenomination: { type: String, default: '' },
    contactNumber: { type: String },
    whatsappNumber: { type: String },
    sameAsContact: { type: Boolean, default: false },
    parentName: { type: String, trim: true },
    village: { type: String, trim: true },
    schoolName: { type: String, trim: true },
    vbsYear: { type: Number, required: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    status: { type: String, enum: ['pending'], default: 'pending' },
  },
  { timestamps: true }
);

stagingStudentSchema.pre('save', function (next) {
  if (this.grade) this.category = GRADE_TO_CATEGORY[this.grade];
  if (this.sameAsContact && this.contactNumber) this.whatsappNumber = this.contactNumber;
  next();
});

// ─── Staging Teacher ───────────────────────────────────────────────
const stagingTeacherSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    contactNumber: { type: String, required: true },
    email: { type: String, trim: true, lowercase: true },
    dateOfBirth: { type: Date },
    yearsOfExperience: { type: Number, min: 0 },
    qualification: { type: String, trim: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    status: { type: String, enum: ['pending'], default: 'pending' },
  },
  { timestamps: true }
);

// ─── Staging Volunteer ─────────────────────────────────────────────
const stagingVolunteerSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    contactNumber: { type: String, required: true },
    email: { type: String, trim: true, lowercase: true },
    dateOfBirth: { type: Date },
    role: { type: String, required: true, trim: true },
    shift: { type: String, enum: ['Morning', 'Afternoon', 'Full Day'] },
    notes: { type: String, trim: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    status: { type: String, enum: ['pending'], default: 'pending' },
  },
  { timestamps: true }
);

// FIX: Use mongoose.models cache to prevent "Cannot overwrite model" error on hot-reload
const StagingStudent = mongoose.models.StagingStudent || mongoose.model('StagingStudent', stagingStudentSchema);
const StagingTeacher = mongoose.models.StagingTeacher || mongoose.model('StagingTeacher', stagingTeacherSchema);
const StagingVolunteer = mongoose.models.StagingVolunteer || mongoose.model('StagingVolunteer', stagingVolunteerSchema);

module.exports = { StagingStudent, StagingTeacher, StagingVolunteer };