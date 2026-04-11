const Student = require('../models/Student');
const { Teacher } = require('../models/TeacherVolunteer');
const { StudentAttendance } = require('../models/Attendance');
const Settings = require('../models/Settings');
const Class = require('../models/Class');

// Helper: IST date string
const toISTDateStr = (date) => {
  if (!date) return '';
  return new Date(date).toLocaleDateString('en-IN', {
    timeZone: 'Asia/Kolkata', day: '2-digit', month: '2-digit', year: 'numeric',
  });
};

const toISTDateTimeStr = (date) => {
  if (!date) return '';
  return new Date(date).toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata', day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true,
  });
};

// @desc    Get teacher's class data for PDF export
// @route   GET /api/teacher/export-data
// @access  Teacher (own class), Admin
const getTeacherExportData = async (req, res, next) => {
  try {
    const settings = await Settings.findOne({ isActive: true });
    if (!settings) return res.status(400).json({ success: false, message: 'No active VBS year' });

    let classId = req.query.classId;

    // For teachers: get their assigned class
    if (req.user.role === 'teacher') {
      const teacher = await Teacher.findOne({ user: req.user._id });
      if (!teacher?.classAssigned) return res.status(400).json({ success: false, message: 'No class assigned' });
      classId = teacher.classAssigned.toString();
    }

    if (!classId) return res.status(400).json({ success: false, message: 'classId is required' });

    const [cls, students, attendanceRecords, teacher] = await Promise.all([
      Class.findById(classId),
      Student.find({ classAssigned: classId, isActive: true }).sort({ name: 1 }),
      StudentAttendance.find({ class: classId, vbsYear: settings.year }).sort({ date: 1 }),
      Teacher.findOne({ classAssigned: classId }).populate('user', 'name'),
    ]);

    if (!cls) return res.status(404).json({ success: false, message: 'Class not found' });

    // Build attendance matrix: student × day
    const attendanceMap = {};
    attendanceRecords.forEach(record => {
      const dateStr = toISTDateStr(record.date);
      record.records.forEach(r => {
        const sid = r.student?.toString();
        if (!attendanceMap[sid]) attendanceMap[sid] = {};
        attendanceMap[sid][dateStr] = r.status;
      });
    });

    const vbsDates = attendanceRecords.map(r => ({
      date: r.date,
      dateStr: toISTDateStr(r.date),
      dayLabel: `Day ${attendanceRecords.indexOf(r) + 1}`,
    }));

    const studentsWithAttendance = students.map((s, idx) => {
      const att = attendanceMap[s._id.toString()] || {};
      const presentDays = Object.values(att).filter(v => v === 'present').length;
      return {
        sno: idx + 1,
        studentId: s.studentId,
        name: s.name,
        grade: s.grade,
        gender: s.gender,
        religion: s.religion,
        christianDenomination: s.christianDenomination,
        contactNumber: s.contactNumber,
        whatsappNumber: s.sameAsContact ? s.contactNumber : s.whatsappNumber,
        parentName: s.parentName,
        village: s.village,
        schoolName: s.schoolName,
        attendance: att,
        totalPresent: presentDays,
        totalDays: vbsDates.length,
        percentage: vbsDates.length > 0 ? Math.round((presentDays / vbsDates.length) * 100) : 0,
      };
    });

    res.json({
      success: true,
      data: {
        ministry: 'Presence of Jesus Ministry, Tiruchirappalli',
        vbsYear: settings.year,
        vbsTitle: settings.vbsTitle,
        tagline: settings.tagline,
        class: { id: cls._id, name: cls.name, category: cls.category },
        teacher: teacher ? { name: teacher.name } : null,
        totalStudents: students.length,
        vbsDates,
        students: studentsWithAttendance,
        generatedAt: toISTDateTimeStr(new Date()),
        generatedBy: req.user.name,
      },
    });
  } catch (err) { next(err); }
};

module.exports = { getTeacherExportData };