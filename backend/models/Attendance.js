const mongoose = require('mongoose');

// ─── Modification History Sub-Schema ──────────────────────────────
const modificationEntrySchema = new mongoose.Schema(
  {
    modifiedBy:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    modifiedByName: { type: String, required: true },
    modifiedAt:     { type: Date, default: Date.now },
    changes: [
      {
        entityId:            String,
        entityName:          String,
        previousStatus:      String,
        newStatus:           String,
        previousArrivalTime: String,
        newArrivalTime:      String,
        previousDepartureTime: String,
        newDepartureTime:    String,
        previousShift:       String,
        newShift:            String,
      },
    ],
    reason: { type: String, default: 'No reason specified' },
  },
  { _id: true }
);

// ─── Student Attendance ────────────────────────────────────────────
const attendanceRecordSchema = new mongoose.Schema({
  student: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
  status:  { type: String, enum: ['present', 'absent'], required: true },
});

const studentAttendanceSchema = new mongoose.Schema(
  {
    date:            { type: Date, required: true },
    class:           { type: mongoose.Schema.Types.ObjectId, ref: 'Class', required: true },
    vbsYear:         { type: Number, required: true },
    submittedBy:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    submittedByName: { type: String },
    submittedByRole: { type: String, enum: ['teacher', 'admin'] },
    records:         [attendanceRecordSchema],
    isModified:      { type: Boolean, default: false },
    modificationHistory: [modificationEntrySchema],
    deletedAt:       { type: Date },
  },
  { timestamps: true }
);

// FIXED: Added missing indexes for frequent query patterns
studentAttendanceSchema.index({ date: 1, class: 1 }, { unique: true });
studentAttendanceSchema.index({ date: 1, vbsYear: 1 });
studentAttendanceSchema.index({ class: 1, vbsYear: 1 });
studentAttendanceSchema.index({ vbsYear: 1, date: 1 });            // dashboard queries
studentAttendanceSchema.index({ 'records.student': 1 });           // report queries
studentAttendanceSchema.index({ isModified: 1, vbsYear: 1 });      // modifications summary

// ─── Teacher Attendance ────────────────────────────────────────────
const teacherAttendanceSchema = new mongoose.Schema(
  {
    date:        { type: Date, required: true },
    teacher:     { type: mongoose.Schema.Types.ObjectId, ref: 'Teacher', required: true },
    vbsYear:     { type: Number, required: true },
    status:      { type: String, enum: ['present', 'absent', 'leave', 'late'], required: true },
    arrivalTime: { type: String },
    departureTime: { type: String },
    remarks:     { type: String, trim: true },
    markedBy:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    markedByName: { type: String },
    isModified:  { type: Boolean, default: false },
    modificationHistory: [modificationEntrySchema],
  },
  { timestamps: true }
);

teacherAttendanceSchema.index({ date: 1, teacher: 1 }, { unique: true });
teacherAttendanceSchema.index({ date: 1, vbsYear: 1 });
teacherAttendanceSchema.index({ teacher: 1, vbsYear: 1 });  // teacher report queries

// ─── Volunteer Attendance ──────────────────────────────────────────
const volunteerAttendanceSchema = new mongoose.Schema(
  {
    date:         { type: Date, required: true },
    volunteer:    { type: mongoose.Schema.Types.ObjectId, ref: 'Volunteer', required: true },
    vbsYear:      { type: Number, required: true },
    status:       { type: String, enum: ['present', 'absent', 'halfDay', 'late'], required: true },
    shift:        { type: String, enum: ['Morning', 'Afternoon', 'Full Day'] },
    checkInTime:  { type: String },
    checkOutTime: { type: String },
    remarks:      { type: String, trim: true },
    markedBy:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    markedByName: { type: String },
    isModified:   { type: Boolean, default: false },
    modificationHistory: [modificationEntrySchema],
  },
  { timestamps: true }
);

volunteerAttendanceSchema.index({ date: 1, volunteer: 1 }, { unique: true });
volunteerAttendanceSchema.index({ date: 1, vbsYear: 1 });
volunteerAttendanceSchema.index({ volunteer: 1, vbsYear: 1 }); // volunteer report queries

const StudentAttendance  = mongoose.models.StudentAttendance  || mongoose.model('StudentAttendance',  studentAttendanceSchema);
const TeacherAttendance  = mongoose.models.TeacherAttendance  || mongoose.model('TeacherAttendance',  teacherAttendanceSchema);
const VolunteerAttendance = mongoose.models.VolunteerAttendance || mongoose.model('VolunteerAttendance', volunteerAttendanceSchema);

module.exports = { StudentAttendance, TeacherAttendance, VolunteerAttendance };
