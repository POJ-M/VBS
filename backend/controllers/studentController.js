const Student = require('../models/Student');
const { StagingStudent } = require('../models/Staging');
const Class = require('../models/Class');
const Settings = require('../models/Settings');
const { generateStudentId } = require('../services/studentIdService');
const { notifyPendingVerification } = require('../services/notificationService');

const GRADE_TO_CATEGORY = {
  PreKG: 'Beginner', LKG: 'Beginner', UKG: 'Beginner',
  '1': 'Beginner', '2': 'Beginner',
  '3': 'Primary', '4': 'Primary', '5': 'Primary',
  '6': 'Junior', '7': 'Junior', '8': 'Junior',
  '9': 'Inter', '10': 'Inter', '11': 'Inter', '12': 'Inter',
};

const buildStudentFilter = (query) => {
  const { search, grade, category, village, classAssigned, vbsYear, isActive, religion } = query;
  const filter = {};
  if (vbsYear) filter.vbsYear = Number(vbsYear);
  if (grade) filter.grade = grade;
  if (category) filter.category = category;
  if (village) filter.village = { $regex: village, $options: 'i' };
  if (isActive !== undefined) filter.isActive = isActive === 'true';
  if (religion) filter.religion = religion;

  // Handle classAssigned filter: 'unassigned' = null, otherwise ObjectId
  if (classAssigned === 'unassigned') {
    filter.classAssigned = null;
  } else if (classAssigned) {
    filter.classAssigned = classAssigned;
  }

  if (search) {
    filter.$or = [
      { name: { $regex: search, $options: 'i' } },
      { studentId: { $regex: search, $options: 'i' } },
      { parentName: { $regex: search, $options: 'i' } },
      { village: { $regex: search, $options: 'i' } },
      { contactNumber: { $regex: search, $options: 'i' } },
    ];
  }
  return filter;
};

const buildStudentData = (body) => {
  const data = {
    name: body.name,
    gender: body.gender,
    grade: body.grade,
    category: GRADE_TO_CATEGORY[body.grade],
    religion: body.religion || 'Christian',
    christianDenomination: body.religion === 'Christian' ? body.christianDenomination : undefined,
    contactNumber: body.contactNumber,
    sameAsContact: body.sameAsContact || false,
    whatsappNumber: body.sameAsContact ? body.contactNumber : body.whatsappNumber,
    parentName: body.parentName,
    village: body.village,
    schoolName: body.schoolName,
  };

  // Handle classAssigned — allow null to unset
  if (body.classAssigned !== undefined) {
    data.classAssigned = body.classAssigned || null;
  }

  return data;
};

// @desc    Get all students
const getStudents = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;
    let filter = buildStudentFilter(req.query);

    if (req.user.role === 'teacher') {
      const { Teacher } = require('../models/TeacherVolunteer');
      const teacher = await Teacher.findOne({ user: req.user._id });
      if (!teacher?.classAssigned) {
        return res.json({ success: true, count: 0, total: 0, pages: 0, currentPage: page, data: [] });
      }
      filter.classAssigned = teacher.classAssigned;
      delete filter.category;
      delete filter.religion;
    }

    const [students, total] = await Promise.all([
      Student.find(filter)
        .populate('classAssigned', 'name category')
        .populate('createdBy', 'name userID')
        .sort({ studentId: 1 })
        .skip(skip)
        .limit(limit),
      Student.countDocuments(filter),
    ]);

    res.json({
      success: true, count: students.length, total,
      pages: Math.ceil(total / limit), currentPage: page, data: students,
    });
  } catch (err) { next(err); }
};

const getStudent = async (req, res, next) => {
  try {
    const student = await Student.findById(req.params.id)
      .populate('classAssigned', 'name category year')
      .populate('createdBy', 'name userID');
    if (!student) return res.status(404).json({ success: false, message: 'Student not found' });

    if (req.user.role === 'teacher') {
      const { Teacher } = require('../models/TeacherVolunteer');
      const teacher = await Teacher.findOne({ user: req.user._id });
      if (!teacher?.classAssigned || student.classAssigned?._id?.toString() !== teacher.classAssigned.toString()) {
        return res.status(403).json({ success: false, message: 'Access denied. Not in your class.' });
      }
    }
    res.json({ success: true, data: student });
  } catch (err) { next(err); }
};

const createStudent = async (req, res, next) => {
  try {
    const settings = await Settings.findOne({ isActive: true });
    if (!settings) return res.status(400).json({ success: false, message: 'No active VBS year configured' });

    const studentData = { ...buildStudentData(req.body), vbsYear: settings.year, createdBy: req.user._id };

    if (req.user.role === 'editor') {
      const staged = await StagingStudent.create(studentData);
      await notifyPendingVerification('student', studentData.name, req.user.name);
      return res.status(201).json({ success: true, message: 'Student submitted for admin approval', data: staged, staged: true });
    }

    const studentId = await generateStudentId(studentData.grade, settings.year);
    const student = await Student.create({ ...studentData, studentId });
    res.status(201).json({ success: true, message: 'Student created successfully', data: student });
  } catch (err) { next(err); }
};

const updateStudent = async (req, res, next) => {
  try {
    const student = await Student.findById(req.params.id);
    if (!student) return res.status(404).json({ success: false, message: 'Student not found' });

    const updateData = buildStudentData(req.body);
    delete updateData.studentId; // Student ID is immutable

    const updated = await Student.findByIdAndUpdate(req.params.id, updateData, { new: true, runValidators: true })
      .populate('classAssigned', 'name category');
    res.json({ success: true, message: 'Student updated', data: updated });
  } catch (err) { next(err); }
};

const deleteStudent = async (req, res, next) => {
  try {
    const student = await Student.findByIdAndDelete(req.params.id);
    if (!student) return res.status(404).json({ success: false, message: 'Student not found' });
    res.json({ success: true, message: 'Student deleted' });
  } catch (err) { next(err); }
};

const bulkDeleteStudents = async (req, res, next) => {
  try {
    const { ids } = req.body;
    if (!ids?.length) return res.status(400).json({ success: false, message: 'No student IDs provided' });
    const result = await Student.deleteMany({ _id: { $in: ids } });
    res.json({ success: true, message: `${result.deletedCount} students deleted` });
  } catch (err) { next(err); }
};

const bulkAllocate = async (req, res, next) => {
  try {
    const { studentIds, classId } = req.body;
    if (!studentIds?.length || !classId) {
      return res.status(400).json({ success: false, message: 'Provide studentIds and classId' });
    }

    const cls = await Class.findById(classId);
    if (!cls) return res.status(404).json({ success: false, message: 'Class not found' });

    // Allow allocation even with grade mismatches — just warn about them
    await Student.updateMany({ _id: { $in: studentIds } }, { classAssigned: classId });

    const updatedStudents = await Student.find({ _id: { $in: studentIds } }).select('name grade');
    const { CLASS_GRADE_RANGES } = Class;
    const allowedGrades = CLASS_GRADE_RANGES[cls.category];
    const mismatched = updatedStudents.filter(s => !allowedGrades.includes(s.grade));

    res.json({
      success: true,
      message: `${studentIds.length} students allocated to ${cls.name}${mismatched.length > 0 ? ` (${mismatched.length} grade mismatch warnings)` : ''}`,
      data: { allocated: studentIds.length, mismatched: mismatched.map(s => ({ name: s.name, grade: s.grade })) }
    });
  } catch (err) { next(err); }
};

// ─── STAGING ──────────────────────────────────────────────────────

const getStagingStudents = async (req, res, next) => {
  try {
    const filter = {};
    if (req.user.role === 'editor') filter.createdBy = req.user._id;
    const students = await StagingStudent.find(filter).populate('createdBy', 'name userID').sort({ createdAt: -1 });
    res.json({ success: true, count: students.length, data: students });
  } catch (err) { next(err); }
};

const approveStagedStudent = async (req, res, next) => {
  try {
    const staged = await StagingStudent.findById(req.params.id).populate('createdBy');
    if (!staged) return res.status(404).json({ success: false, message: 'Staged student not found' });

    const settings = await Settings.findOne({ isActive: true });
    if (!settings) return res.status(400).json({ success: false, message: 'No active VBS year' });

    const overrides = req.body || {};
    const finalGrade = overrides.grade || staged.grade;
    const finalCategory = GRADE_TO_CATEGORY[finalGrade];

    // Duplicate check
    const nameToCheck = overrides.name || staged.name;
    const existing = await Student.findOne({
      name: { $regex: `^${nameToCheck.trim()}$`, $options: 'i' },
      contactNumber: staged.contactNumber,
      vbsYear: settings.year,
    });
    if (existing) {
      return res.status(400).json({
        success: false,
        message: `Possible duplicate: "${existing.name}" (${existing.studentId}) already exists.`,
        data: { existingStudentId: existing.studentId }
      });
    }

    const studentId = await generateStudentId(finalGrade, settings.year);
    const sameAsContact = overrides.sameAsContact ?? staged.sameAsContact;

    const student = await Student.create({
      studentId,
      name: overrides.name || staged.name,
      gender: overrides.gender || staged.gender,
      grade: finalGrade,
      category: finalCategory,
      religion: overrides.religion || staged.religion,
      christianDenomination: (overrides.religion || staged.religion) === 'Christian'
        ? (overrides.christianDenomination || staged.christianDenomination) : undefined,
      contactNumber: overrides.contactNumber || staged.contactNumber,
      sameAsContact,
      whatsappNumber: sameAsContact
        ? (overrides.contactNumber || staged.contactNumber)
        : (overrides.whatsappNumber || staged.whatsappNumber),
      parentName: overrides.parentName || staged.parentName,
      village: overrides.village || staged.village,
      schoolName: overrides.schoolName || staged.schoolName,
      vbsYear: settings.year,
      createdBy: staged.createdBy._id,
      approvedBy: req.user._id,
      approvedAt: new Date(),
    });

    const { notifyEntryApproved } = require('../services/notificationService');
    await notifyEntryApproved(staged.createdBy._id, 'student', staged.name);
    await StagingStudent.findByIdAndDelete(req.params.id);

    res.status(201).json({ success: true, message: `Student approved. ID: ${studentId}`, data: student });
  } catch (err) { next(err); }
};

const rejectStagedStudent = async (req, res, next) => {
  try {
    const { reason } = req.body;
    if (!reason) return res.status(400).json({ success: false, message: 'Rejection reason is required' });
    const staged = await StagingStudent.findById(req.params.id).populate('createdBy');
    if (!staged) return res.status(404).json({ success: false, message: 'Staged student not found' });
    const { notifyEntryRejected } = require('../services/notificationService');
    await notifyEntryRejected(staged.createdBy._id, 'student', staged.name, reason);
    await StagingStudent.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Student entry rejected' });
  } catch (err) { next(err); }
};

const bulkApproveStagedStudents = async (req, res, next) => {
  try {
    const { ids } = req.body;
    if (!ids?.length) return res.status(400).json({ success: false, message: 'No IDs provided' });
    const settings = await Settings.findOne({ isActive: true });
    if (!settings) return res.status(400).json({ success: false, message: 'No active VBS year' });

    const results = { approved: [], failed: [] };
    const { notifyEntryApproved } = require('../services/notificationService');

    for (const id of ids) {
      try {
        const staged = await StagingStudent.findById(id).populate('createdBy');
        if (!staged) { results.failed.push({ id, reason: 'Not found' }); continue; }
        const finalCategory = GRADE_TO_CATEGORY[staged.grade];
        const studentId = await generateStudentId(staged.grade, settings.year);
        const student = await Student.create({
          studentId, name: staged.name, gender: staged.gender,
          grade: staged.grade, category: finalCategory,
          religion: staged.religion, christianDenomination: staged.christianDenomination,
          contactNumber: staged.contactNumber, sameAsContact: staged.sameAsContact,
          whatsappNumber: staged.whatsappNumber, parentName: staged.parentName,
          village: staged.village, schoolName: staged.schoolName,
          vbsYear: settings.year, createdBy: staged.createdBy._id,
          approvedBy: req.user._id, approvedAt: new Date(),
        });
        await notifyEntryApproved(staged.createdBy._id, 'student', staged.name);
        await StagingStudent.findByIdAndDelete(id);
        results.approved.push({ id, studentId, name: student.name });
      } catch (e) { results.failed.push({ id, reason: e.message }); }
    }

    res.json({
      success: true,
      message: `${results.approved.length} approved, ${results.failed.length} failed`,
      data: results
    });
  } catch (err) { next(err); }
};

module.exports = {
  getStudents, getStudent, createStudent, updateStudent, deleteStudent,
  bulkDeleteStudents, bulkAllocate,
  getStagingStudents, approveStagedStudent, rejectStagedStudent, bulkApproveStagedStudents,
};