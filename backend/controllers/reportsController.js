// backend/controllers/reportsController.js — UPDATED
// Added: getVillageList, getVillageReport, getCategoryReport

const Student = require('../models/Student');
const { Teacher, Volunteer } = require('../models/TeacherVolunteer');
const Class = require('../models/Class');
const { StudentAttendance, TeacherAttendance, VolunteerAttendance } = require('../models/Attendance');
const Settings = require('../models/Settings');
const { normalizeToISTMidnight } = require('../services/attendanceWindowService');

// ─── helpers ──────────────────────────────────────────────────────
const toISTDateStr = (date) =>
  new Date(date).toLocaleDateString('en-IN', {
    timeZone: 'Asia/Kolkata', day: '2-digit', month: '2-digit', year: 'numeric',
  });

// ─── Build per-student attendance stats helper ─────────────────────
const buildAttMap = (attendanceRecords) => {
  const attMap = {};
  attendanceRecords.forEach(rec => {
    rec.records.forEach(r => {
      const sid = r.student?._id?.toString() || r.student?.toString();
      if (!sid) return;
      if (!attMap[sid]) attMap[sid] = { present: 0, total: 0 };
      attMap[sid].total++;
      if (r.status === 'present') attMap[sid].present++;
    });
  });
  return attMap;
};

// @desc    Daily report
const getDailyReport = async (req, res, next) => {
  try {
    const { date, vbsYear } = req.query;
    if (!date) return res.status(400).json({ success: false, message: 'Date is required' });

    const reportDate = normalizeToISTMidnight(date);
    const yearFilter = vbsYear ? { vbsYear: Number(vbsYear) } : {};

    const [studentAttendance, teacherAttendance, volunteerAttendance, classes] = await Promise.all([
      StudentAttendance.find({ date: reportDate, ...yearFilter })
        .populate('class', 'name category')
        .populate('submittedBy', 'name role')
        .populate('records.student', 'name studentId grade'),
      TeacherAttendance.find({ date: reportDate, ...yearFilter })
        .populate('teacher', 'name classAssigned'),
      VolunteerAttendance.find({ date: reportDate, ...yearFilter })
        .populate('volunteer', 'name role shift'),
      Class.find(vbsYear ? { year: Number(vbsYear) } : {}),
    ]);

    const submittedClassIds = studentAttendance.map(a => a.class?._id?.toString());
    const unsubmittedClasses = classes.filter(c => !submittedClassIds.includes(c._id.toString()));

    const totalStudentPresent = studentAttendance.reduce(
      (s, a) => s + a.records.filter(r => r.status === 'present').length, 0);
    const totalStudentAbsent = studentAttendance.reduce(
      (s, a) => s + a.records.filter(r => r.status === 'absent').length, 0);

    res.json({
      success: true,
      data: {
        date: reportDate,
        summary: {
          students: {
            present: totalStudentPresent, absent: totalStudentAbsent,
            total: totalStudentPresent + totalStudentAbsent,
            rate: totalStudentPresent + totalStudentAbsent > 0
              ? Math.round((totalStudentPresent / (totalStudentPresent + totalStudentAbsent)) * 100) : 0,
          },
          teachers: {
            present: teacherAttendance.filter(t => t.status === 'present').length,
            absent: teacherAttendance.filter(t => t.status === 'absent').length,
            late: teacherAttendance.filter(t => t.status === 'late').length,
          },
          volunteers: {
            present: volunteerAttendance.filter(v => ['present', 'halfDay'].includes(v.status)).length,
            absent: volunteerAttendance.filter(v => v.status === 'absent').length,
          },
        },
        studentAttendance, teacherAttendance, volunteerAttendance, unsubmittedClasses,
      },
    });
  } catch (err) { next(err); }
};

// @desc    Class report
const getClassReport = async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;
    const cls = await Class.findById(req.params.classId).populate('teacher', 'name');
    if (!cls) return res.status(404).json({ success: false, message: 'Class not found' });

    const students = await Student.find({ classAssigned: cls._id, isActive: true }).sort({ studentId: 1 });

    const attendanceFilter = { class: cls._id };
    if (startDate || endDate) {
      attendanceFilter.date = {};
      if (startDate) attendanceFilter.date.$gte = normalizeToISTMidnight(startDate);
      if (endDate) attendanceFilter.date.$lte = normalizeToISTMidnight(endDate);
    }

    const attendanceRecords = await StudentAttendance.find(attendanceFilter)
      .populate('submittedBy', 'name').sort({ date: 1 });

    const studentStats = students.map(s => {
      let present = 0, absent = 0;
      attendanceRecords.forEach(rec => {
        const r = rec.records.find(r => r.student?.toString() === s._id.toString());
        if (r) { if (r.status === 'present') present++; else absent++; }
      });
      const total = present + absent;
      return { ...s.toObject(), present, absent, total, rate: total > 0 ? Math.round((present / total) * 100) : 0 };
    });

    const classAvgRate = studentStats.length > 0
      ? Math.round(studentStats.reduce((s, x) => s + x.rate, 0) / studentStats.length) : 0;

    res.json({
      success: true,
      data: { class: cls, students: studentStats, attendanceRecords, totalDays: attendanceRecords.length, classAvgRate },
    });
  } catch (err) { next(err); }
};

// @desc    Student report
const getStudentReport = async (req, res, next) => {
  try {
    const student = await Student.findById(req.params.studentId).populate('classAssigned', 'name category');
    if (!student) return res.status(404).json({ success: false, message: 'Student not found' });

    const attendanceRecords = await StudentAttendance.find({
      class: student.classAssigned?._id,
      'records.student': student._id,
    }).sort({ date: 1 });

    const history = attendanceRecords.map(rec => {
      const r = rec.records.find(r => r.student?.toString() === student._id.toString());
      return { date: rec.date, status: r?.status || 'unknown', isModified: rec.isModified };
    });

    const present = history.filter(h => h.status === 'present').length;
    const absent = history.filter(h => h.status === 'absent').length;
    const total = history.length;

    res.json({
      success: true,
      data: {
        student,
        attendance: { history, present, absent, total, rate: total > 0 ? Math.round((present / total) * 100) : 0 },
      },
    });
  } catch (err) { next(err); }
};

// @desc    Teacher report
const getTeacherReport = async (req, res, next) => {
  try {
    const teacher = await Teacher.findById(req.params.teacherId)
      .populate('classAssigned', 'name category').populate('user', 'userID name');
    if (!teacher) return res.status(404).json({ success: false, message: 'Teacher not found' });

    const settings = await Settings.findOne({ isActive: true });
    const vbsYear = settings?.year;

    const [submissionHistory, ownAttendance] = await Promise.all([
      StudentAttendance.find({ class: teacher.classAssigned, vbsYear })
        .select('date submittedBy submittedByName records isModified').sort({ date: 1 }),
      TeacherAttendance.find({ teacher: teacher._id, vbsYear }).sort({ date: 1 }),
    ]);

    const totalDays = settings?.dates?.startDate && settings?.dates?.endDate
      ? Math.round((new Date(settings.dates.endDate) - new Date(settings.dates.startDate)) / (1000 * 60 * 60 * 24)) + 1 : 0;
    const daysPresent = ownAttendance.filter(a => a.status === 'present').length;

    res.json({
      success: true,
      data: {
        teacher,
        submissions: {
          history: submissionHistory, total: submissionHistory.length, expectedDays: totalDays,
          submissionRate: totalDays > 0 ? Math.round((submissionHistory.length / totalDays) * 100) : 0,
        },
        ownAttendance: {
          history: ownAttendance, present: daysPresent,
          absent: ownAttendance.filter(a => a.status === 'absent').length,
          late: ownAttendance.filter(a => a.status === 'late').length,
          total: ownAttendance.length,
          rate: totalDays > 0 ? Math.round((daysPresent / totalDays) * 100) : 0,
        },
      },
    });
  } catch (err) { next(err); }
};

// @desc    Volunteer report
const getVolunteerReport = async (req, res, next) => {
  try {
    const volunteer = await Volunteer.findById(req.params.volunteerId);
    if (!volunteer) return res.status(404).json({ success: false, message: 'Volunteer not found' });

    const settings = await Settings.findOne({ isActive: true });
    const attendance = await VolunteerAttendance.find({ volunteer: volunteer._id, vbsYear: settings?.year }).sort({ date: 1 });
    const totalDays = settings?.dates?.startDate && settings?.dates?.endDate
      ? Math.round((new Date(settings.dates.endDate) - new Date(settings.dates.startDate)) / (1000 * 60 * 60 * 24)) + 1 : 0;

    res.json({
      success: true,
      data: {
        volunteer,
        attendance: {
          history: attendance,
          present: attendance.filter(a => a.status === 'present').length,
          halfDay: attendance.filter(a => a.status === 'halfDay').length,
          absent: attendance.filter(a => a.status === 'absent').length,
          total: attendance.length,
          rate: totalDays > 0
            ? Math.round((attendance.filter(a => ['present', 'halfDay'].includes(a.status)).length / totalDays) * 100) : 0,
        },
      },
    });
  } catch (err) { next(err); }
};

// @desc    Full year report
const getFullYearReport = async (req, res, next) => {
  try {
    const { vbsYear } = req.query;
    const settings = await Settings.findOne(vbsYear ? { year: Number(vbsYear) } : { isActive: true });
    if (!settings) return res.status(404).json({ success: false, message: 'VBS year not found' });

    const year = settings.year;

    const [allClasses, allTeachers, allVolunteers, allStudentAttendance, allTeacherAttendance, allVolunteerAttendance] =
      await Promise.all([
        Class.find({ year }).populate('teacher', 'name contactNumber').sort({ category: 1, name: 1 }),
        Teacher.find({ isActive: true }).populate('classAssigned', 'name category year').sort({ name: 1 }),
        Volunteer.find({ isActive: true }).sort({ name: 1 }),
        StudentAttendance.find({ vbsYear: year })
          .populate('class', 'name category')
          .populate('records.student', 'name studentId grade gender village category')
          .sort({ date: 1 }),
        TeacherAttendance.find({ vbsYear: year }).populate('teacher', 'name classAssigned').sort({ date: 1 }),
        VolunteerAttendance.find({ vbsYear: year }).populate('volunteer', 'name role shift').sort({ date: 1 }),
      ]);

    const yearClassIds = new Set(allClasses.map(c => c._id.toString()));
    const yearTeachers = allTeachers.filter(t => {
      const cid = t.classAssigned?._id?.toString() || t.classAssigned?.toString();
      return !cid || yearClassIds.has(cid);
    });

    const allStudents = await Student.find({ vbsYear: year, isActive: true })
      .populate('classAssigned', 'name category').sort({ category: 1, studentId: 1 });

    const dateSet = new Set();
    allStudentAttendance.forEach(a => dateSet.add(normalizeToISTMidnight(a.date).getTime()));
    const vbsDates = [...dateSet].sort().map(ts => ({ ts, date: new Date(ts), dateStr: toISTDateStr(new Date(ts)) }));

    const attendanceByClass = {};
    allStudentAttendance.forEach(rec => {
      const cid = rec.class?._id?.toString();
      if (!cid) return;
      if (!attendanceByClass[cid]) attendanceByClass[cid] = {};
      const dateTs = normalizeToISTMidnight(rec.date).getTime();
      rec.records.forEach(r => {
        const sid = r.student?._id?.toString() || r.student?.toString();
        if (!sid) return;
        if (!attendanceByClass[cid][sid]) attendanceByClass[cid][sid] = {};
        attendanceByClass[cid][sid][dateTs] = r.status;
      });
    });

    const teacherAttMap = {};
    allTeacherAttendance.forEach(rec => {
      const tid = rec.teacher?._id?.toString() || rec.teacher?.toString();
      if (!tid) return;
      const dateTs = normalizeToISTMidnight(rec.date).getTime();
      if (!teacherAttMap[tid]) teacherAttMap[tid] = {};
      teacherAttMap[tid][dateTs] = rec;
    });

    const volAttMap = {};
    allVolunteerAttendance.forEach(rec => {
      const vid = rec.volunteer?._id?.toString() || rec.volunteer?.toString();
      if (!vid) return;
      const dateTs = normalizeToISTMidnight(rec.date).getTime();
      if (!volAttMap[vid]) volAttMap[vid] = {};
      volAttMap[vid][dateTs] = rec;
    });

    const classData = allClasses.map(cls => {
      const cid = cls._id.toString();
      const classStudents = allStudents.filter(
        s => s.classAssigned?._id?.toString() === cid || s.classAssigned?.toString() === cid
      );
      const classAttMap = attendanceByClass[cid] || {};

      const studentsWithAtt = classStudents.map((s, idx) => {
        const sid = s._id.toString();
        const attByDate = classAttMap[sid] || {};
        const presentDays = vbsDates.filter(d => attByDate[d.ts] === 'present').length;
        const attendanceRow = {};
        vbsDates.forEach(d => { attendanceRow[d.dateStr] = attByDate[d.ts] || ''; });
        return {
          sno: idx + 1, studentId: s.studentId, name: s.name, grade: s.grade,
          gender: s.gender, category: s.category, village: s.village || '',
          contactNumber: s.contactNumber || '', parentName: s.parentName || '',
          schoolName: s.schoolName || '', attendance: attendanceRow,
          totalPresent: presentDays, totalDays: vbsDates.length,
          percentage: vbsDates.length > 0 ? Math.round((presentDays / vbsDates.length) * 100) : 0,
        };
      });

      const totalPresent = studentsWithAtt.reduce((s, x) => s + x.totalPresent, 0);
      const totalPossible = studentsWithAtt.length * vbsDates.length;
      return {
        classId: cid, className: cls.name, category: cls.category, capacity: cls.capacity,
        teacher: cls.teacher ? { name: cls.teacher.name, contact: cls.teacher.contactNumber } : null,
        students: studentsWithAtt, studentCount: studentsWithAtt.length,
        stats: { totalPresent, totalPossible, attendanceRate: totalPossible > 0 ? Math.round((totalPresent / totalPossible) * 100) : 0 },
      };
    });

    const teacherSummary = yearTeachers.map(t => {
      const tid = t._id.toString();
      const attMap = teacherAttMap[tid] || {};
      const attHistory = vbsDates.map(d => ({
        dateStr: d.dateStr, status: attMap[d.ts]?.status || '', arrivalTime: attMap[d.ts]?.arrivalTime || '',
      }));
      const daysPresent = attHistory.filter(x => x.status === 'present').length;
      const daysLate = attHistory.filter(x => x.status === 'late').length;
      const classId = t.classAssigned?._id?.toString() || t.classAssigned?.toString();
      const submissions = allStudentAttendance.filter(a => a.class?._id?.toString() === classId);
      return {
        name: t.name, contactNumber: t.contactNumber, email: t.email || '',
        qualification: t.qualification || '', classAssigned: t.classAssigned?.name || 'Unassigned',
        classCategory: t.classAssigned?.category || '',
        attendance: {
          history: attHistory, daysPresent, daysLate,
          daysAbsent: attHistory.filter(x => x.status === 'absent').length,
          daysLeave: attHistory.filter(x => x.status === 'leave').length,
          totalDays: vbsDates.length,
          attendanceRate: vbsDates.length > 0 ? Math.round(((daysPresent + daysLate) / vbsDates.length) * 100) : 0,
        },
        submissions: {
          daysSubmitted: submissions.length, totalDays: vbsDates.length,
          submissionRate: vbsDates.length > 0 ? Math.round((submissions.length / vbsDates.length) * 100) : 0,
        },
      };
    });

    const volunteerSummary = allVolunteers.map(v => {
      const vid = v._id.toString();
      const attMap = volAttMap[vid] || {};
      const attHistory = vbsDates.map(d => ({
        dateStr: d.dateStr, status: attMap[d.ts]?.status || '', shift: attMap[d.ts]?.shift || '',
        checkInTime: attMap[d.ts]?.checkInTime || '',
      }));
      const daysPresent = attHistory.filter(x => ['present', 'halfDay'].includes(x.status)).length;
      return {
        name: v.name, role: v.role, shift: v.shift || '', contactNumber: v.contactNumber,
        email: v.email || '', notes: v.notes || '',
        attendance: {
          history: attHistory, daysPresent,
          daysHalfDay: attHistory.filter(x => x.status === 'halfDay').length,
          daysAbsent: attHistory.filter(x => x.status === 'absent').length,
          totalDays: vbsDates.length,
          attendanceRate: vbsDates.length > 0 ? Math.round((daysPresent / vbsDates.length) * 100) : 0,
        },
      };
    });

    const totalStudentRecords = allStudentAttendance.reduce((s, a) => s + a.records.length, 0);
    const totalStudentPresent = allStudentAttendance.reduce(
      (s, a) => s + a.records.filter(r => r.status === 'present').length, 0);
    const teacherPresent = allTeacherAttendance.filter(a => a.status === 'present').length;
    const volPresent = allVolunteerAttendance.filter(a => ['present', 'halfDay'].includes(a.status)).length;

    const generatedAt = new Date().toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata', day: '2-digit', month: '2-digit',
      year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true,
    });

    res.json({
      success: true,
      data: {
        ministry: 'Presence of Jesus Ministry, Tiruchirappalli',
        settings, vbsYear: year, vbsTitle: settings.vbsTitle, tagline: settings.tagline,
        generatedAt, vbsDates,
        summary: {
          totalStudents: allStudents.length, totalTeachers: yearTeachers.length,
          totalVolunteers: allVolunteers.length, totalClasses: allClasses.length,
          vbsDuration: vbsDates.length,
          attendance: {
            students: { rate: totalStudentRecords > 0 ? Math.round((totalStudentPresent / totalStudentRecords) * 100) : 0, present: totalStudentPresent, total: totalStudentRecords },
            teachers: { rate: allTeacherAttendance.length > 0 ? Math.round((teacherPresent / allTeacherAttendance.length) * 100) : 0, present: teacherPresent, total: allTeacherAttendance.length },
            volunteers: { rate: allVolunteerAttendance.length > 0 ? Math.round((volPresent / allVolunteerAttendance.length) * 100) : 0, present: volPresent, total: allVolunteerAttendance.length },
          },
          modifications: allStudentAttendance.filter(a => a.isModified).length,
        },
        classes: classData, teachers: teacherSummary, volunteers: volunteerSummary,
        allStudents: allStudents.map((s, idx) => ({
          sno: idx + 1, studentId: s.studentId, name: s.name, grade: s.grade,
          gender: s.gender, category: s.category, religion: s.religion || '',
          christianDenomination: s.christianDenomination || '', contactNumber: s.contactNumber || '',
          parentName: s.parentName || '', village: s.village || '', schoolName: s.schoolName || '',
          classAssigned: s.classAssigned?.name || 'Unassigned', classCategory: s.classAssigned?.category || '',
        })),
      },
    });
  } catch (err) { next(err); }
};

// @desc    Village list
// @route   GET /api/reports/villages
const getVillageList = async (req, res, next) => {
  try {
    const { vbsYear } = req.query;
    const filter = { isActive: true, village: { $exists: true, $ne: '' } };
    if (vbsYear) filter.vbsYear = Number(vbsYear);

    const villages = await Student.aggregate([
      { $match: filter },
      { $group: { _id: '$village', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $project: { village: '$_id', count: 1, _id: 0 } },
    ]);

    res.json({ success: true, data: villages });
  } catch (err) { next(err); }
};

// @desc    Village report
// @route   GET /api/reports/village
const getVillageReport = async (req, res, next) => {
  try {
    const { village, vbsYear } = req.query;
    if (!village) return res.status(400).json({ success: false, message: 'village is required' });

    const filter = {
      village: { $regex: `^${village.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' },
      isActive: true,
    };
    if (vbsYear) filter.vbsYear = Number(vbsYear);

    const students = await Student.find(filter)
      .populate('classAssigned', 'name category').sort({ name: 1 });

    const studentIds = students.map(s => s._id);
    const attFilter = { 'records.student': { $in: studentIds } };
    if (vbsYear) attFilter.vbsYear = Number(vbsYear);

    const attendanceRecords = await StudentAttendance.find(attFilter);
    const attMap = buildAttMap(attendanceRecords);

    const studentsWithAtt = students.map(s => ({
      ...s.toObject(),
      attendance: (() => {
        const att = attMap[s._id.toString()] || { present: 0, total: 0 };
        return { present: att.present, total: att.total, rate: att.total > 0 ? Math.round((att.present / att.total) * 100) : 0 };
      })(),
    }));

    const totalPresent = studentsWithAtt.reduce((s, x) => s + x.attendance.present, 0);
    const totalRecords = studentsWithAtt.reduce((s, x) => s + x.attendance.total, 0);

    res.json({
      success: true,
      data: {
        village, totalStudents: students.length, students: studentsWithAtt,
        stats: { attendance: { present: totalPresent, total: totalRecords, rate: totalRecords > 0 ? Math.round((totalPresent / totalRecords) * 100) : 0 } },
      },
    });
  } catch (err) { next(err); }
};

// @desc    Category report
// @route   GET /api/reports/category/:category
const getCategoryReport = async (req, res, next) => {
  try {
    const { category } = req.params;
    const { vbsYear } = req.query;
    const validCats = ['Beginner', 'Primary', 'Junior', 'Inter'];
    if (!validCats.includes(category)) {
      return res.status(400).json({ success: false, message: 'Invalid category. Must be one of: ' + validCats.join(', ') });
    }

    const filter = { category, isActive: true };
    if (vbsYear) filter.vbsYear = Number(vbsYear);

    const [students, classes] = await Promise.all([
      Student.find(filter).populate('classAssigned', 'name category').sort({ grade: 1, name: 1 }),
      Class.find({ category, ...(vbsYear ? { year: Number(vbsYear) } : {}) }).populate('teacher', 'name'),
    ]);

    const studentIds = students.map(s => s._id);
    const attFilter = { 'records.student': { $in: studentIds } };
    if (vbsYear) attFilter.vbsYear = Number(vbsYear);

    const attendanceRecords = await StudentAttendance.find(attFilter);
    const attMap = buildAttMap(attendanceRecords);

    const studentsWithAtt = students.map(s => ({
      ...s.toObject(),
      attendance: (() => {
        const att = attMap[s._id.toString()] || { present: 0, total: 0 };
        return { present: att.present, total: att.total, rate: att.total > 0 ? Math.round((att.present / att.total) * 100) : 0 };
      })(),
    }));

    const totalPresent = studentsWithAtt.reduce((s, x) => s + x.attendance.present, 0);
    const totalRecords = studentsWithAtt.reduce((s, x) => s + x.attendance.total, 0);

    res.json({
      success: true,
      data: {
        category, totalStudents: students.length, totalClasses: classes.length,
        students: studentsWithAtt,
        classes: classes.map(c => ({ _id: c._id, name: c.name, teacher: c.teacher?.name || 'Unassigned', capacity: c.capacity })),
        stats: { attendance: { present: totalPresent, total: totalRecords, rate: totalRecords > 0 ? Math.round((totalPresent / totalRecords) * 100) : 0 } },
      },
    });
  } catch (err) { next(err); }
};

module.exports = {
  getDailyReport, getClassReport, getStudentReport, getTeacherReport,
  getVolunteerReport, getFullYearReport,
  getVillageList, getVillageReport, getCategoryReport,
};
