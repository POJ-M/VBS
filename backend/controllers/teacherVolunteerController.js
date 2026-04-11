const { Teacher, Volunteer } = require('../models/TeacherVolunteer');
const { StagingTeacher, StagingVolunteer } = require('../models/Staging');
const {
  notifyPendingVerification,
  notifyEntryApproved,
  notifyEntryRejected,
} = require('../services/notificationService');

// ─── TEACHER CONTROLLER ────────────────────────────────────────────

const getTeachers = async (req, res, next) => {
  try {
    const { search, isActive, classAssigned } = req.query;
    const filter = {};
    if (isActive !== undefined) filter.isActive = isActive === 'true';
    if (classAssigned) filter.classAssigned = classAssigned;
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { contactNumber: { $regex: search, $options: 'i' } },
      ];
    }

    const teachers = await Teacher.find(filter)
      .populate('classAssigned', 'name category year')
      .populate('user', 'userID name isActive')
      .populate('createdBy', 'name')
      .sort({ name: 1 });

    res.json({ success: true, count: teachers.length, data: teachers });
  } catch (err) { next(err); }
};

const getTeacher = async (req, res, next) => {
  try {
    const teacher = await Teacher.findById(req.params.id)
      .populate('classAssigned', 'name category year')
      .populate('user', 'userID name isActive lastLogin');
    if (!teacher) return res.status(404).json({ success: false, message: 'Teacher not found' });
    res.json({ success: true, data: teacher });
  } catch (err) { next(err); }
};

const createTeacher = async (req, res, next) => {
  try {
    const data = { ...req.body, createdBy: req.user._id };

    if (req.user.role === 'editor') {
      const staged = await StagingTeacher.create(data);
      await notifyPendingVerification('teacher', data.name, req.user.name);
      return res.status(201).json({
        success: true,
        message: 'Teacher submitted for approval',
        data: staged,
        staged: true,
      });
    }

    const teacher = await Teacher.create(data);
    res.status(201).json({ success: true, message: 'Teacher created', data: teacher });
  } catch (err) { next(err); }
};

const updateTeacher = async (req, res, next) => {
  try {
    const teacher = await Teacher.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    }).populate('classAssigned', 'name category');
    if (!teacher) return res.status(404).json({ success: false, message: 'Teacher not found' });
    res.json({ success: true, message: 'Teacher updated', data: teacher });
  } catch (err) { next(err); }
};

const deleteTeacher = async (req, res, next) => {
  try {
    const teacher = await Teacher.findByIdAndDelete(req.params.id);
    if (!teacher) return res.status(404).json({ success: false, message: 'Teacher not found' });
    res.json({ success: true, message: 'Teacher deleted' });
  } catch (err) { next(err); }
};

const assignTeacherToClass = async (req, res, next) => {
  try {
    const { classId } = req.body;
    const Class = require('../models/Class');
    const cls = await Class.findById(classId);
    if (!cls) return res.status(404).json({ success: false, message: 'Class not found' });

    // Unassign any teacher currently assigned to this class
    await Teacher.updateMany({ classAssigned: classId }, { $unset: { classAssigned: 1 } });

    const teacher = await Teacher.findByIdAndUpdate(
      req.params.id,
      { classAssigned: classId },
      { new: true }
    ).populate('classAssigned', 'name category');

    if (!teacher) return res.status(404).json({ success: false, message: 'Teacher not found' });

    // Keep Class.teacher in sync
    await Class.findByIdAndUpdate(classId, { teacher: req.params.id });

    res.json({
      success: true,
      message: `${teacher.name} assigned to ${cls.name}`,
      data: teacher,
    });
  } catch (err) { next(err); }
};

// ─── TEACHER STAGING ───────────────────────────────────────────────

const getStagingTeachers = async (req, res, next) => {
  try {
    const filter = req.user.role === 'editor' ? { createdBy: req.user._id } : {};
    const teachers = await StagingTeacher.find(filter)
      .populate('createdBy', 'name userID')
      .sort({ createdAt: -1 });
    res.json({ success: true, count: teachers.length, data: teachers });
  } catch (err) { next(err); }
};

// FIX: Spread only known Teacher fields — don't spread staging-specific fields like 'status','__v'
const approveStagedTeacher = async (req, res, next) => {
  try {
    const staged = await StagingTeacher.findById(req.params.id).populate('createdBy');
    if (!staged) {
      return res.status(404).json({ success: false, message: 'Staged teacher not found' });
    }

    const teacher = await Teacher.create({
      name: staged.name,
      contactNumber: staged.contactNumber,
      email: staged.email,
      dateOfBirth: staged.dateOfBirth,
      yearsOfExperience: staged.yearsOfExperience,
      qualification: staged.qualification,
      createdBy: staged.createdBy._id,
      approvedBy: req.user._id,
      approvedAt: new Date(),
    });

    await notifyEntryApproved(staged.createdBy._id, 'teacher', staged.name);
    await StagingTeacher.findByIdAndDelete(req.params.id);

    res.status(201).json({ success: true, message: 'Teacher approved', data: teacher });
  } catch (err) { next(err); }
};

const rejectStagedTeacher = async (req, res, next) => {
  try {
    const { reason } = req.body;
    if (!reason) return res.status(400).json({ success: false, message: 'Reason required' });

    const staged = await StagingTeacher.findById(req.params.id).populate('createdBy');
    if (!staged) return res.status(404).json({ success: false, message: 'Not found' });

    await notifyEntryRejected(staged.createdBy._id, 'teacher', staged.name, reason);
    await StagingTeacher.findByIdAndDelete(req.params.id);

    res.json({ success: true, message: 'Teacher rejected' });
  } catch (err) { next(err); }
};

// @desc    Bulk approve staged teachers
// @route   POST /api/teachers/staging/bulk-approve
const bulkApproveStagedTeachers = async (req, res, next) => {
  try {
    const { ids } = req.body;
    if (!ids?.length) {
      return res.status(400).json({ success: false, message: 'No IDs provided' });
    }

    const results = { approved: [], failed: [] };

    for (const id of ids) {
      try {
        const staged = await StagingTeacher.findById(id).populate('createdBy');
        if (!staged) { results.failed.push({ id, reason: 'Not found' }); continue; }

        const teacher = await Teacher.create({
          name: staged.name,
          contactNumber: staged.contactNumber,
          email: staged.email,
          dateOfBirth: staged.dateOfBirth,
          yearsOfExperience: staged.yearsOfExperience,
          qualification: staged.qualification,
          createdBy: staged.createdBy._id,
          approvedBy: req.user._id,
          approvedAt: new Date(),
        });

        await notifyEntryApproved(staged.createdBy._id, 'teacher', staged.name);
        await StagingTeacher.findByIdAndDelete(id);
        results.approved.push({ id, name: teacher.name });
      } catch (e) {
        results.failed.push({ id, reason: e.message });
      }
    }

    res.json({
      success: true,
      message: `${results.approved.length} approved, ${results.failed.length} failed`,
      data: results,
    });
  } catch (err) { next(err); }
};

// ─── VOLUNTEER CONTROLLER ──────────────────────────────────────────

const getVolunteers = async (req, res, next) => {
  try {
    const { search, isActive, role, shift } = req.query;
    const filter = {};
    if (isActive !== undefined) filter.isActive = isActive === 'true';
    if (role) filter.role = { $regex: role, $options: 'i' };
    if (shift) filter.shift = shift;
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { role: { $regex: search, $options: 'i' } },
      ];
    }

    const volunteers = await Volunteer.find(filter)
      .populate('createdBy', 'name')
      .sort({ name: 1 });
    res.json({ success: true, count: volunteers.length, data: volunteers });
  } catch (err) { next(err); }
};

const getVolunteer = async (req, res, next) => {
  try {
    const v = await Volunteer.findById(req.params.id);
    if (!v) return res.status(404).json({ success: false, message: 'Volunteer not found' });
    res.json({ success: true, data: v });
  } catch (err) { next(err); }
};

const createVolunteer = async (req, res, next) => {
  try {
    const data = { ...req.body, createdBy: req.user._id };

    if (req.user.role === 'editor') {
      const staged = await StagingVolunteer.create(data);
      await notifyPendingVerification('volunteer', data.name, req.user.name);
      return res.status(201).json({
        success: true,
        message: 'Volunteer submitted for approval',
        data: staged,
        staged: true,
      });
    }

    const volunteer = await Volunteer.create(data);
    res.status(201).json({ success: true, message: 'Volunteer created', data: volunteer });
  } catch (err) { next(err); }
};

const updateVolunteer = async (req, res, next) => {
  try {
    const v = await Volunteer.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!v) return res.status(404).json({ success: false, message: 'Volunteer not found' });
    res.json({ success: true, message: 'Volunteer updated', data: v });
  } catch (err) { next(err); }
};

const deleteVolunteer = async (req, res, next) => {
  try {
    const v = await Volunteer.findByIdAndDelete(req.params.id);
    if (!v) return res.status(404).json({ success: false, message: 'Volunteer not found' });
    res.json({ success: true, message: 'Volunteer deleted' });
  } catch (err) { next(err); }
};

// ─── VOLUNTEER STAGING ─────────────────────────────────────────────

const getStagingVolunteers = async (req, res, next) => {
  try {
    const filter = req.user.role === 'editor' ? { createdBy: req.user._id } : {};
    const volunteers = await StagingVolunteer.find(filter)
      .populate('createdBy', 'name userID')
      .sort({ createdAt: -1 });
    res.json({ success: true, count: volunteers.length, data: volunteers });
  } catch (err) { next(err); }
};

// FIX: Spread only known Volunteer fields
const approveStagedVolunteer = async (req, res, next) => {
  try {
    const staged = await StagingVolunteer.findById(req.params.id).populate('createdBy');
    if (!staged) return res.status(404).json({ success: false, message: 'Not found' });

    const v = await Volunteer.create({
      name: staged.name,
      contactNumber: staged.contactNumber,
      email: staged.email,
      dateOfBirth: staged.dateOfBirth,
      role: staged.role,
      shift: staged.shift,
      notes: staged.notes,
      createdBy: staged.createdBy._id,
      approvedBy: req.user._id,
      approvedAt: new Date(),
    });

    await notifyEntryApproved(staged.createdBy._id, 'volunteer', staged.name);
    await StagingVolunteer.findByIdAndDelete(req.params.id);

    res.status(201).json({ success: true, message: 'Volunteer approved', data: v });
  } catch (err) { next(err); }
};

const rejectStagedVolunteer = async (req, res, next) => {
  try {
    const { reason } = req.body;
    if (!reason) return res.status(400).json({ success: false, message: 'Reason required' });

    const staged = await StagingVolunteer.findById(req.params.id).populate('createdBy');
    if (!staged) return res.status(404).json({ success: false, message: 'Not found' });

    await notifyEntryRejected(staged.createdBy._id, 'volunteer', staged.name, reason);
    await StagingVolunteer.findByIdAndDelete(req.params.id);

    res.json({ success: true, message: 'Volunteer rejected' });
  } catch (err) { next(err); }
};

// @desc    Bulk approve staged volunteers
// @route   POST /api/volunteers/staging/bulk-approve
const bulkApproveStagedVolunteers = async (req, res, next) => {
  try {
    const { ids } = req.body;
    if (!ids?.length) {
      return res.status(400).json({ success: false, message: 'No IDs provided' });
    }

    const results = { approved: [], failed: [] };

    for (const id of ids) {
      try {
        const staged = await StagingVolunteer.findById(id).populate('createdBy');
        if (!staged) { results.failed.push({ id, reason: 'Not found' }); continue; }

        const v = await Volunteer.create({
          name: staged.name,
          contactNumber: staged.contactNumber,
          email: staged.email,
          dateOfBirth: staged.dateOfBirth,
          role: staged.role,
          shift: staged.shift,
          notes: staged.notes,
          createdBy: staged.createdBy._id,
          approvedBy: req.user._id,
          approvedAt: new Date(),
        });

        await notifyEntryApproved(staged.createdBy._id, 'volunteer', staged.name);
        await StagingVolunteer.findByIdAndDelete(id);
        results.approved.push({ id, name: v.name });
      } catch (e) {
        results.failed.push({ id, reason: e.message });
      }
    }

    res.json({
      success: true,
      message: `${results.approved.length} approved, ${results.failed.length} failed`,
      data: results,
    });
  } catch (err) { next(err); }
};

module.exports = {
  getTeachers, getTeacher, createTeacher, updateTeacher, deleteTeacher, assignTeacherToClass,
  getStagingTeachers, approveStagedTeacher, rejectStagedTeacher, bulkApproveStagedTeachers,
  getVolunteers, getVolunteer, createVolunteer, updateVolunteer, deleteVolunteer,
  getStagingVolunteers, approveStagedVolunteer, rejectStagedVolunteer, bulkApproveStagedVolunteers,
};