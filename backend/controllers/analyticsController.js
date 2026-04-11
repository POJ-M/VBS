// FIX: Use safe model loading to prevent "model not registered" errors
const mongoose = require('mongoose');
const Student = require('../models/Student');
const { Teacher, Volunteer } = require('../models/TeacherVolunteer');
const Class = require('../models/Class');
const { StudentAttendance, TeacherAttendance, VolunteerAttendance } = require('../models/Attendance');
const Settings = require('../models/Settings');
const { StagingStudent, StagingTeacher, StagingVolunteer } = require('../models/Staging');
const { normalizeToISTMidnight } = require('../services/attendanceWindowService');

const GRADE_SORT_ORDER = ['PreKG', 'LKG', 'UKG', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'];

// @desc    Dashboard stats — Admin + Viewer
const getDashboardStats = async (req, res, next) => {
  try {
    // Guard: verify Student model is properly loaded
    if (typeof Student.countDocuments !== 'function') {
      return res.status(500).json({ success: false, message: 'Model loading error — please restart the server' });
    }

    const settings = await Settings.findOne({ isActive: true });
    const vbsYear = settings?.year;

    if (!vbsYear) {
      return res.json({
        success: true, data: {
          vbsYear: null,
          students: { total: 0, beginner: 0, primary: 0, junior: 0, inter: 0 },
          teachers: { total: 0 }, volunteers: { total: 0 }, classes: { total: 0 },
          today: { attendanceRate: 0, presentCount: 0, submittedClasses: 0, pendingClasses: 0, pendingClassList: [] },
          pendingVerifications: { students: 0, teachers: 0, volunteers: 0, total: 0 },
          recentModifications: [],
        }
      });
    }

    const todayIST = normalizeToISTMidnight(new Date());

    const [
      totalStudents, beginnerCount, primaryCount, juniorCount, interCount,
      totalTeachers, totalVolunteers, totalClasses, todayStudentAttendance,
      pendingStudents, pendingTeachers, pendingVolunteers,
    ] = await Promise.all([
      Student.countDocuments({ vbsYear, isActive: true }),
      Student.countDocuments({ vbsYear, category: 'Beginner', isActive: true }),
      Student.countDocuments({ vbsYear, category: 'Primary', isActive: true }),
      Student.countDocuments({ vbsYear, category: 'Junior', isActive: true }),
      Student.countDocuments({ vbsYear, category: 'Inter', isActive: true }),
      Teacher.countDocuments({ isActive: true }),
      Volunteer.countDocuments({ isActive: true }),
      Class.countDocuments({ year: vbsYear }),
      StudentAttendance.find({ date: todayIST, vbsYear }),
      StagingStudent.countDocuments(),
      StagingTeacher.countDocuments(),
      StagingVolunteer.countDocuments(),
    ]);

    const totalPresent = todayStudentAttendance.reduce((sum, a) => sum + a.records.filter(r => r.status === 'present').length, 0);
    const totalRecords = todayStudentAttendance.reduce((sum, a) => sum + a.records.length, 0);

    const allClasses = await Class.find({ year: vbsYear });
    const submittedIds = todayStudentAttendance.map(a => a.class?.toString());
    const pendingClasses = allClasses.filter(c => !submittedIds.includes(c._id.toString()));

    const recentModifications = await StudentAttendance.find({ isModified: true, vbsYear })
      .populate('class', 'name').sort({ updatedAt: -1 }).limit(5)
      .select('date class modificationHistory isModified');

    res.json({
      success: true, data: {
        vbsYear,
        students: { total: totalStudents, beginner: beginnerCount, primary: primaryCount, junior: juniorCount, inter: interCount },
        teachers: { total: totalTeachers },
        volunteers: { total: totalVolunteers },
        classes: { total: totalClasses },
        today: {
          date: todayIST,
          attendanceRate: totalRecords > 0 ? Math.round((totalPresent / totalRecords) * 100) : 0,
          presentCount: totalPresent,
          submittedClasses: todayStudentAttendance.length,
          pendingClasses: pendingClasses.length,
          pendingClassList: pendingClasses.map(c => ({ _id: c._id, name: c.name, category: c.category })),
        },
        pendingVerifications: {
          students: pendingStudents, teachers: pendingTeachers, volunteers: pendingVolunteers,
          total: pendingStudents + pendingTeachers + pendingVolunteers,
        },
        recentModifications,
      }
    });
  } catch (err) { next(err); }
};

// @desc    Student analytics
const getStudentAnalytics = async (req, res, next) => {
  try {
    const { vbsYear } = req.query;
    const filter = vbsYear ? { vbsYear: Number(vbsYear), isActive: true } : { isActive: true };

    const [gradeDistrib, categoryDistrib, genderDistrib, villageDistrib, schoolDistrib, religionDistrib, denominationDistrib] = await Promise.all([
      Student.aggregate([{ $match: filter }, { $group: { _id: '$grade', count: { $sum: 1 } } }]),
      Student.aggregate([{ $match: filter }, { $group: { _id: '$category', count: { $sum: 1 } } }]),
      Student.aggregate([{ $match: filter }, { $group: { _id: '$gender', count: { $sum: 1 } } }]),
      Student.aggregate([{ $match: filter }, { $group: { _id: '$village', count: { $sum: 1 } } }, { $sort: { count: -1 } }, { $limit: 20 }]),
      Student.aggregate([{ $match: { ...filter, schoolName: { $exists: true, $ne: '' } } }, { $group: { _id: '$schoolName', count: { $sum: 1 } } }, { $sort: { count: -1 } }, { $limit: 15 }]),
      Student.aggregate([{ $match: filter }, { $group: { _id: '$religion', count: { $sum: 1 } } }]),
      Student.aggregate([
        { $match: { ...filter, religion: 'Christian', christianDenomination: { $exists: true, $ne: '' } } },
        { $group: { _id: '$christianDenomination', count: { $sum: 1 } } },
      ]),
    ]);

    const sortedGradeDistrib = gradeDistrib.sort((a, b) => {
      const ai = GRADE_SORT_ORDER.indexOf(a._id);
      const bi = GRADE_SORT_ORDER.indexOf(b._id);
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    });

    const totalStudents = await Student.countDocuments(filter);

    res.json({
      success: true, data: {
        totalStudents,
        gradeDistribution: sortedGradeDistrib,
        categoryDistribution: categoryDistrib,
        genderDistribution: genderDistrib,
        villageDistribution: villageDistrib,
        schoolDistribution: schoolDistrib,
        religionDistribution: religionDistrib,
        denominationDistribution: denominationDistrib,
      }
    });
  } catch (err) { next(err); }
};

// @desc    Attendance trends
const getAttendanceTrends = async (req, res, next) => {
  try {
    const { vbsYear } = req.query;
    const yearFilter = vbsYear ? { vbsYear: Number(vbsYear) } : {};

    const [studentTrends, teacherTrends, volunteerTrends, classPerformance] = await Promise.all([
      StudentAttendance.aggregate([
        { $match: yearFilter },
        { $unwind: '$records' },
        {
          $group: {
            _id: '$date',
            present: { $sum: { $cond: [{ $eq: ['$records.status', 'present'] }, 1, 0] } },
            absent:  { $sum: { $cond: [{ $eq: ['$records.status', 'absent']  }, 1, 0] } },
          }
        },
        { $sort: { _id: 1 } },
        {
          $project: {
            date: '$_id', present: 1, absent: 1,
            total: { $add: ['$present', '$absent'] },
            rate: {
              $cond: [
                { $gt: [{ $add: ['$present', '$absent'] }, 0] },
                { $multiply: [{ $divide: ['$present', { $add: ['$present', '$absent'] }] }, 100] },
                0
              ]
            },
          }
        },
      ]),

      TeacherAttendance.aggregate([
        { $match: yearFilter },
        {
          $group: {
            _id: '$date',
            present: { $sum: { $cond: [{ $eq: ['$status', 'present'] }, 1, 0] } },
            absent:  { $sum: { $cond: [{ $eq: ['$status', 'absent']  }, 1, 0] } },
            late:    { $sum: { $cond: [{ $eq: ['$status', 'late']    }, 1, 0] } },
            leave:   { $sum: { $cond: [{ $eq: ['$status', 'leave']   }, 1, 0] } },
            total:   { $sum: 1 },
          }
        },
        { $sort: { _id: 1 } },
      ]),

      VolunteerAttendance.aggregate([
        { $match: yearFilter },
        {
          $group: {
            _id: '$date',
            present: { $sum: { $cond: [{ $in: ['$status', ['present', 'halfDay']] }, 1, 0] } },
            absent:  { $sum: { $cond: [{ $eq:  ['$status', 'absent'] }, 1, 0] } },
            total:   { $sum: 1 },
          }
        },
        { $sort: { _id: 1 } },
      ]),

      StudentAttendance.aggregate([
        { $match: yearFilter },
        { $unwind: '$records' },
        {
          $group: {
            _id: '$class',
            totalPresent:  { $sum: { $cond: [{ $eq: ['$records.status', 'present'] }, 1, 0] } },
            totalRecords:  { $sum: 1 },
            daysSubmitted: { $addToSet: '$date' },
          }
        },
        {
          $lookup: {
            from: 'classes',
            localField: '_id',
            foreignField: '_id',
            as: 'classInfo'
          }
        },
        // ✅ FIXED: was 'preserveNullAndEmpty', correct field is 'preserveNullAndEmptyArrays'
        { $unwind: { path: '$classInfo', preserveNullAndEmptyArrays: false } },
        {
          $project: {
            className: '$classInfo.name',
            category:  '$classInfo.category',
            totalPresent: 1,
            totalRecords: 1,
            attendanceRate: {
              $cond: [
                { $gt: ['$totalRecords', 0] },
                { $multiply: [{ $divide: ['$totalPresent', '$totalRecords'] }, 100] },
                0
              ]
            },
            daysSubmitted: { $size: '$daysSubmitted' },
          }
        },
        { $sort: { attendanceRate: -1 } },
      ]),
    ]);

    res.json({
      success: true,
      data: { studentTrends, teacherTrends, volunteerTrends, classPerformance }
    });
  } catch (err) { next(err); }
};

// @desc    Modifications summary
const getModificationsSummary = async (req, res, next) => {
  try {
    const { vbsYear } = req.query;
    const filter = { isModified: true, ...(vbsYear ? { vbsYear: Number(vbsYear) } : {}) };
    const modifiedRecords = await StudentAttendance.find(filter)
      .populate('class', 'name category').select('date class modificationHistory');

    const totalModifications = modifiedRecords.reduce((sum, r) => sum + r.modificationHistory.length, 0);
    const adminMods = {};
    modifiedRecords.forEach(rec => rec.modificationHistory.forEach(mod => {
      const key = mod.modifiedByName || 'Unknown';
      adminMods[key] = (adminMods[key] || 0) + 1;
    }));

    res.json({
      success: true, data: {
        totalModifiedRecords: modifiedRecords.length,
        totalModifications,
        adminModifications: Object.entries(adminMods).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count),
        recentModifications: modifiedRecords.slice(0, 10),
      }
    });
  } catch (err) { next(err); }
};

module.exports = { getDashboardStats, getStudentAnalytics, getAttendanceTrends, getModificationsSummary };
