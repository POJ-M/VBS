const { StudentAttendance } = require('../models/Attendance');
const Student = require('../models/Student');
const Class = require('../models/Class');
const { Teacher } = require('../models/TeacherVolunteer');
const {
  checkAttendanceWindow,
  isWithinVBSSchedule,
  normalizeToISTMidnight,
  getTodayISTString,
} = require('../services/attendanceWindowService');

// @desc    Get student attendance records
// @route   GET /api/attendance/students
// @access  Admin, Viewer, Editor, Teacher (own class)
const getStudentAttendance = async (req, res, next) => {
  try {
    const { date, startDate, endDate, classId, vbsYear } = req.query;
    const filter = {};

    if (vbsYear) filter.vbsYear = Number(vbsYear);
    if (classId) filter.class = classId;

    if (date) {
      filter.date = normalizeToISTMidnight(date);
    } else if (startDate || endDate) {
      filter.date = {};
      if (startDate) filter.date.$gte = normalizeToISTMidnight(startDate);
      if (endDate) filter.date.$lte = normalizeToISTMidnight(endDate);
    }

    // Teacher: restrict to own class only
    if (req.user.role === 'teacher') {
      const teacher = await Teacher.findOne({ user: req.user._id });
      if (!teacher?.classAssigned) return res.json({ success: true, count: 0, data: [] });
      filter.class = teacher.classAssigned;
    }

    const records = await StudentAttendance.find(filter)
      .populate('class', 'name category')
      .populate('submittedBy', 'name role')
      .populate({ path: 'records.student', select: 'name studentId grade' })
      .sort({ date: -1 });

    res.json({ success: true, count: records.length, data: records });
  } catch (err) { next(err); }
};

// @desc    Submit student attendance
// @route   POST /api/attendance/students
// @access  Teacher, Admin, Editor (with restrictions)
const submitStudentAttendance = async (req, res, next) => {
  try {
    const { date, classId, records } = req.body;

    if (!date || !classId || !records?.length) {
      return res.status(400).json({ success: false, message: 'date, classId, and records are required' });
    }

    const attendanceDate = normalizeToISTMidnight(date);

    // Validate not in future (compare IST dates)
    const todayIST = normalizeToISTMidnight(new Date());
    if (attendanceDate > todayIST) {
      return res.status(400).json({ success: false, message: 'Cannot submit attendance for future dates' });
    }

    // Validate within VBS schedule
    const scheduleCheck = await isWithinVBSSchedule(attendanceDate);
    if (!scheduleCheck.valid) {
      return res.status(400).json({ success: false, message: scheduleCheck.message });
    }

    // ── Time window check for teachers AND editors ──────────────────
    if (req.user.role === 'teacher') {
      // Verify teacher owns this class
      const teacher = await Teacher.findOne({ user: req.user._id });
      if (!teacher || teacher.classAssigned?.toString() !== classId) {
        return res.status(403).json({
          success: false,
          message: 'You can only submit attendance for your assigned class',
        });
      }

      // Only enforce time window for today's attendance
      const isToday = attendanceDate.getTime() === todayIST.getTime();
      if (isToday) {
        const windowCheck = await checkAttendanceWindow();
        if (!windowCheck.allowed) {
          return res.status(400).json({ success: false, message: windowCheck.message });
        }
      }

      // Prevent duplicate submission
      const existing = await StudentAttendance.findOne({ date: attendanceDate, class: classId });
      if (existing) {
        return res.status(400).json({ success: false, message: 'Attendance already submitted for this date' });
      }
    }

    // ── Editor restrictions ─────────────────────────────────────────
    // Editors can submit for any class, but only today within the window
    if (req.user.role === 'editor') {
      // Editors can only submit for today
      const isToday = attendanceDate.getTime() === todayIST.getTime();
      if (!isToday) {
        return res.status(400).json({
          success: false,
          message: 'Editors can only submit attendance for today',
        });
      }

      // Enforce time window (same as teachers)
      const windowCheck = await checkAttendanceWindow();
      if (!windowCheck.allowed) {
        return res.status(400).json({ success: false, message: windowCheck.message });
      }

      // Prevent duplicate submission (editors cannot overwrite existing records)
      const existing = await StudentAttendance.findOne({ date: attendanceDate, class: classId });
      if (existing) {
        return res.status(400).json({
          success: false,
          message: 'Attendance already submitted for this class and date. Contact admin to modify.',
        });
      }
    }

    const cls = await Class.findById(classId);
    if (!cls) return res.status(404).json({ success: false, message: 'Class not found' });

    const attendance = await StudentAttendance.create({
      date: attendanceDate,
      class: classId,
      vbsYear: scheduleCheck.vbsYear,
      submittedBy: req.user._id,
      submittedByName: req.user.name,
      // Mark editor submissions clearly
      submittedByRole: req.user.role === 'admin' ? 'admin' : 'teacher',
      records: records.map((r) => ({ student: r.studentId, status: r.status })),
    });

    await attendance.populate([
      { path: 'class', select: 'name category' },
      { path: 'records.student', select: 'name studentId' },
    ]);

    res.status(201).json({
      success: true,
      message: 'Attendance submitted successfully',
      data: attendance,
    });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Attendance already exists for this date and class',
      });
    }
    next(err);
  }
};

// @desc    Admin modify student attendance (with full audit trail)
// @route   PUT /api/attendance/students/:id/modify
// @access  Admin only
const modifyStudentAttendance = async (req, res, next) => {
  try {
    const { changes, reason } = req.body;
    if (!changes?.length) {
      return res.status(400).json({ success: false, message: 'No changes provided' });
    }

    const attendance = await StudentAttendance.findById(req.params.id)
      .populate('records.student', 'name studentId');
    if (!attendance) {
      return res.status(404).json({ success: false, message: 'Attendance record not found' });
    }

    const auditChanges = [];

    for (const change of changes) {
    const record = attendance.records.find(
      (r) =>
        r.student?._id?.toString() === change.studentId ||
        r.student?.toString() === change.studentId
    );
  
    if (!record) {
      // Student was added to the class AFTER attendance was submitted.
      // Insert them as a new record entry.
      const Student = require('../models/Student');
      const studentDoc = await Student.findById(change.studentId)
        .select('name studentId');
  
      attendance.records.push({
        student: change.studentId,
        status: change.newStatus,
      });
  
      auditChanges.push({
        entityId: change.studentId,
        entityName: studentDoc?.name || 'Unknown (new student)',
        previousStatus: 'not_recorded',
        newStatus: change.newStatus,
      });
      continue;
    }
  
    const previousStatus = record.status;
    if (previousStatus === change.newStatus) continue;
  
    auditChanges.push({
      entityId: record.student?._id?.toString() || record.student?.toString(),
      entityName: record.student?.name || 'Unknown',
      previousStatus,
      newStatus: change.newStatus,
    });
  
    record.status = change.newStatus;
  }

    if (auditChanges.length === 0) {
      return res.status(400).json({ success: false, message: 'No actual changes detected' });
    }

    attendance.isModified = true;
    attendance.modificationHistory.push({
      modifiedBy: req.user._id,
      modifiedByName: req.user.name,
      modifiedAt: new Date(),
      changes: auditChanges,
      reason: reason?.trim() || 'No reason specified',
    });

    await attendance.save();

    res.json({
      success: true,
      message: `Attendance modified. ${auditChanges.length} record(s) updated.`,
      data: attendance,
    });
  } catch (err) { next(err); }
};

// @desc    Admin delete student attendance record
// @route   DELETE /api/attendance/students/:id
// @access  Admin only
const deleteStudentAttendance = async (req, res, next) => {
  try {
    const record = await StudentAttendance.findByIdAndDelete(req.params.id);
    if (!record) return res.status(404).json({ success: false, message: 'Record not found' });
    res.json({ success: true, message: 'Attendance record deleted' });
  } catch (err) { next(err); }
};

// @desc    Get attendance window status (IST-aware)
// @route   GET /api/attendance/window-status
// @access  Private
const getWindowStatus = async (req, res, next) => {
  try {
    const status = await checkAttendanceWindow();
    res.json({ success: true, data: status });
  } catch (err) { next(err); }
};

// @desc    Get today's attendance summary
// @route   GET /api/attendance/today-summary
// @access  Admin, Editor, Viewer
const getTodaySummary = async (req, res, next) => {
  try {
    const todayIST = normalizeToISTMidnight(new Date());
    const { vbsYear } = req.query;

    const settings = await require('../models/Settings').findOne({ isActive: true });
    const activeYear = vbsYear ? Number(vbsYear) : settings?.year;
    const yearFilter = activeYear ? { vbsYear: activeYear } : {};

    const [submitted, classes] = await Promise.all([
      StudentAttendance.find({ date: todayIST, ...yearFilter })
        .populate('class', 'name category')
        .populate('submittedBy', 'name'),
      Class.find(activeYear ? { year: activeYear } : {}),
    ]);

    const submittedClassIds = submitted.map((s) => s.class?._id?.toString());
    const pending = classes.filter((c) => !submittedClassIds.includes(c._id.toString()));

    const totalPresent = submitted.reduce(
      (sum, s) => sum + s.records.filter((r) => r.status === 'present').length,
      0
    );
    const totalAbsent = submitted.reduce(
      (sum, s) => sum + s.records.filter((r) => r.status === 'absent').length,
      0
    );

    res.json({
      success: true,
      data: {
        date: todayIST,
        submitted: submitted.length,
        pending: pending.length,
        pendingClasses: pending,
        totalPresent,
        totalAbsent,
        attendanceRate:
          totalPresent + totalAbsent > 0
            ? Math.round((totalPresent / (totalPresent + totalAbsent)) * 100)
            : 0,
        records: submitted,
      },
    });
  } catch (err) { next(err); }
};

module.exports = {
  getStudentAttendance,
  submitStudentAttendance,
  modifyStudentAttendance,
  deleteStudentAttendance,
  getWindowStatus,
  getTodaySummary,
};
