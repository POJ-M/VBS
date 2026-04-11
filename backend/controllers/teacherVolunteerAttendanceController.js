const { TeacherAttendance, VolunteerAttendance } = require('../models/Attendance');
const { Teacher, Volunteer } = require('../models/TeacherVolunteer');
const { isWithinVBSSchedule, normalizeToISTMidnight } = require('../services/attendanceWindowService');

// ─── TEACHER ATTENDANCE ────────────────────────────────────────────

const getTeacherAttendance = async (req, res, next) => {
  try {
    const { date, startDate, endDate, teacherId, vbsYear } = req.query;
    const filter = {};
    if (vbsYear) filter.vbsYear = Number(vbsYear);
    if (teacherId) filter.teacher = teacherId;

    if (date) {
      filter.date = normalizeToISTMidnight(date);
    } else if (startDate || endDate) {
      filter.date = {};
      if (startDate) filter.date.$gte = normalizeToISTMidnight(startDate);
      if (endDate) filter.date.$lte = normalizeToISTMidnight(endDate);
    }

    // Teacher sees only their own attendance record
    if (req.user.role === 'teacher') {
      const t = await Teacher.findOne({ user: req.user._id });
      if (!t) return res.json({ success: true, count: 0, data: [] });
      filter.teacher = t._id;
    }

    const records = await TeacherAttendance.find(filter)
      .populate('teacher', 'name classAssigned')
      .populate('markedBy', 'name role')
      .sort({ date: -1 });

    res.json({ success: true, count: records.length, data: records });
  } catch (err) { next(err); }
};

// @desc    Submit teacher attendance (bulk - mark multiple teachers at once)
// @route   POST /api/attendance/teachers
// @access  Admin, Editor
const submitTeacherAttendance = async (req, res, next) => {
  try {
    const { date, records, reason } = req.body;
    if (!date || !records?.length) {
      return res.status(400).json({ success: false, message: 'date and records are required' });
    }

    const attendanceDate = normalizeToISTMidnight(date);
    const todayIST = normalizeToISTMidnight(new Date());

    if (attendanceDate > todayIST) {
      return res.status(400).json({ success: false, message: 'Cannot submit for future dates' });
    }

    const scheduleCheck = await isWithinVBSSchedule(attendanceDate);
    if (!scheduleCheck.valid) {
      return res.status(400).json({ success: false, message: scheduleCheck.message });
    }

    const results = { created: [], updated: [], failed: [] };

    for (const r of records) {
      try {
        const existing = await TeacherAttendance.findOne({
          date: attendanceDate,
          teacher: r.teacherId,
        });

        if (existing) {
          // Editor cannot modify existing records
          if (req.user.role === 'editor') {
            results.failed.push({
              teacherId: r.teacherId,
              reason: 'Editors cannot modify existing attendance',
            });
            continue;
          }

          // Admin modification — capture previousStatus BEFORE mutation (BUG FIX)
          const changes = [];
          if (existing.status !== r.status) {
            changes.push({
              entityId: r.teacherId,
              previousStatus: existing.status,  // captured before update
              newStatus: r.status,
            });
          }

          existing.status = r.status;
          if (r.arrivalTime !== undefined) existing.arrivalTime = r.arrivalTime;
          if (r.departureTime !== undefined) existing.departureTime = r.departureTime;
          if (r.remarks !== undefined) existing.remarks = r.remarks;
          existing.isModified = true;
          existing.modificationHistory.push({
            modifiedBy: req.user._id,
            modifiedByName: req.user.name,
            modifiedAt: new Date(),
            changes,
            reason: reason?.trim() || 'Attendance updated',
          });
          await existing.save();
          results.updated.push({ teacherId: r.teacherId });
        } else {
          const record = await TeacherAttendance.create({
            date: attendanceDate,
            teacher: r.teacherId,
            vbsYear: scheduleCheck.vbsYear,
            status: r.status,
            arrivalTime: r.arrivalTime,
            departureTime: r.departureTime,
            remarks: r.remarks,
            markedBy: req.user._id,
            markedByName: req.user.name,
          });
          results.created.push({ teacherId: r.teacherId, _id: record._id });
        }
      } catch (e) {
        results.failed.push({ teacherId: r.teacherId, reason: e.message });
      }
    }

    res.status(201).json({
      success: true,
      message: `${results.created.length} created, ${results.updated.length} updated, ${results.failed.length} failed`,
      data: results,
    });
  } catch (err) { next(err); }
};

// @desc    Admin modify single teacher attendance record
// @route   PUT /api/attendance/teachers/:id/modify
// @access  Admin only
const modifyTeacherAttendance = async (req, res, next) => {
  try {
    const { status, arrivalTime, departureTime, remarks, reason } = req.body;
    const record = await TeacherAttendance.findById(req.params.id).populate('teacher', 'name');
    if (!record) return res.status(404).json({ success: false, message: 'Record not found' });

    // Capture changes BEFORE mutation
    const changes = [{
      entityId: record.teacher?._id?.toString(),
      entityName: record.teacher?.name,
      previousStatus: record.status,
      newStatus: status || record.status,
      previousArrivalTime: record.arrivalTime,
      newArrivalTime: arrivalTime,
      previousDepartureTime: record.departureTime,
      newDepartureTime: departureTime,
    }];

    if (status) record.status = status;
    if (arrivalTime !== undefined) record.arrivalTime = arrivalTime;
    if (departureTime !== undefined) record.departureTime = departureTime;
    if (remarks !== undefined) record.remarks = remarks;
    record.isModified = true;
    record.modificationHistory.push({
      modifiedBy: req.user._id,
      modifiedByName: req.user.name,
      modifiedAt: new Date(),
      changes,
      reason: reason?.trim() || 'No reason specified',
    });

    await record.save();
    res.json({ success: true, message: 'Teacher attendance modified', data: record });
  } catch (err) { next(err); }
};

const deleteTeacherAttendance = async (req, res, next) => {
  try {
    const r = await TeacherAttendance.findByIdAndDelete(req.params.id);
    if (!r) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, message: 'Teacher attendance deleted' });
  } catch (err) { next(err); }
};

// ─── VOLUNTEER ATTENDANCE ──────────────────────────────────────────

const getVolunteerAttendance = async (req, res, next) => {
  try {
    const { date, startDate, endDate, volunteerId, vbsYear, role } = req.query;
    const filter = {};
    if (vbsYear) filter.vbsYear = Number(vbsYear);
    if (volunteerId) filter.volunteer = volunteerId;

    if (role) {
      const volunteers = await Volunteer.find({ role: { $regex: role, $options: 'i' } }).select('_id');
      filter.volunteer = { $in: volunteers.map((v) => v._id) };
    }

    if (date) {
      filter.date = normalizeToISTMidnight(date);
    } else if (startDate || endDate) {
      filter.date = {};
      if (startDate) filter.date.$gte = normalizeToISTMidnight(startDate);
      if (endDate) filter.date.$lte = normalizeToISTMidnight(endDate);
    }

    const records = await VolunteerAttendance.find(filter)
      .populate('volunteer', 'name role shift')
      .populate('markedBy', 'name role')
      .sort({ date: -1 });

    res.json({ success: true, count: records.length, data: records });
  } catch (err) { next(err); }
};

const submitVolunteerAttendance = async (req, res, next) => {
  try {
    const { date, records, reason } = req.body;
    if (!date || !records?.length) {
      return res.status(400).json({ success: false, message: 'date and records are required' });
    }

    const attendanceDate = normalizeToISTMidnight(date);
    const todayIST = normalizeToISTMidnight(new Date());

    if (attendanceDate > todayIST) {
      return res.status(400).json({ success: false, message: 'Cannot submit for future dates' });
    }

    const scheduleCheck = await isWithinVBSSchedule(attendanceDate);
    if (!scheduleCheck.valid) {
      return res.status(400).json({ success: false, message: scheduleCheck.message });
    }

    const results = { created: [], updated: [], failed: [] };

    for (const r of records) {
      try {
        const existing = await VolunteerAttendance.findOne({
          date: attendanceDate,
          volunteer: r.volunteerId,
        });

        if (existing) {
          if (req.user.role === 'editor') {
            results.failed.push({
              volunteerId: r.volunteerId,
              reason: 'Editors cannot modify existing attendance',
            });
            continue;
          }

          // Capture previousStatus BEFORE mutation (BUG FIX)
          const changes = [{
            entityId: r.volunteerId,
            previousStatus: existing.status,  // captured before update
            newStatus: r.status,
            previousShift: existing.shift,
            newShift: r.shift,
          }];

          existing.status = r.status;
          if (r.shift !== undefined) existing.shift = r.shift;
          if (r.checkInTime !== undefined) existing.checkInTime = r.checkInTime;
          if (r.checkOutTime !== undefined) existing.checkOutTime = r.checkOutTime;
          if (r.remarks !== undefined) existing.remarks = r.remarks;
          existing.isModified = true;
          existing.modificationHistory.push({
            modifiedBy: req.user._id,
            modifiedByName: req.user.name,
            modifiedAt: new Date(),
            changes,
            reason: reason?.trim() || 'Updated',
          });
          await existing.save();
          results.updated.push({ volunteerId: r.volunteerId });
        } else {
          await VolunteerAttendance.create({
            date: attendanceDate,
            volunteer: r.volunteerId,
            vbsYear: scheduleCheck.vbsYear,
            status: r.status,
            shift: r.shift,
            checkInTime: r.checkInTime,
            checkOutTime: r.checkOutTime,
            remarks: r.remarks,
            markedBy: req.user._id,
            markedByName: req.user.name,
          });
          results.created.push({ volunteerId: r.volunteerId });
        }
      } catch (e) {
        results.failed.push({ volunteerId: r.volunteerId, reason: e.message });
      }
    }

    res.status(201).json({
      success: true,
      message: `${results.created.length} created, ${results.updated.length} updated`,
      data: results,
    });
  } catch (err) { next(err); }
};

const modifyVolunteerAttendance = async (req, res, next) => {
  try {
    const { status, shift, checkInTime, checkOutTime, remarks, reason } = req.body;
    const record = await VolunteerAttendance.findById(req.params.id).populate('volunteer', 'name');
    if (!record) return res.status(404).json({ success: false, message: 'Not found' });

    // Capture changes BEFORE mutation
    const changes = [{
      entityId: record.volunteer?._id?.toString(),
      entityName: record.volunteer?.name,
      previousStatus: record.status,
      newStatus: status || record.status,
      previousShift: record.shift,
      newShift: shift,
    }];

    if (status) record.status = status;
    if (shift !== undefined) record.shift = shift;
    if (checkInTime !== undefined) record.checkInTime = checkInTime;
    if (checkOutTime !== undefined) record.checkOutTime = checkOutTime;
    if (remarks !== undefined) record.remarks = remarks;
    record.isModified = true;
    record.modificationHistory.push({
      modifiedBy: req.user._id,
      modifiedByName: req.user.name,
      modifiedAt: new Date(),
      changes,
      reason: reason?.trim() || 'No reason specified',
    });

    await record.save();
    res.json({ success: true, message: 'Volunteer attendance modified', data: record });
  } catch (err) { next(err); }
};

const deleteVolunteerAttendance = async (req, res, next) => {
  try {
    const r = await VolunteerAttendance.findByIdAndDelete(req.params.id);
    if (!r) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, message: 'Volunteer attendance deleted' });
  } catch (err) { next(err); }
};

module.exports = {
  getTeacherAttendance,
  submitTeacherAttendance,
  modifyTeacherAttendance,
  deleteTeacherAttendance,
  getVolunteerAttendance,
  submitVolunteerAttendance,
  modifyVolunteerAttendance,
  deleteVolunteerAttendance,
};