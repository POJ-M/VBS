const crypto = require('crypto');
const QRSession = require('../models/QRSession');
const { TeacherAttendance } = require('../models/Attendance');
const { Teacher } = require('../models/TeacherVolunteer');
const Settings = require('../models/Settings');
const { normalizeToISTMidnight } = require('../services/attendanceWindowService');

// ─── Helpers ──────────────────────────────────────────────────────
const generateToken = () => crypto.randomBytes(32).toString('hex');

const getISTTimeString = () => {
  const now = new Date();
  return now.toLocaleTimeString('en-IN', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
};

// FIX: Safe token cleaning — strip prefix and validate format
const cleanToken = (raw) => {
  const token = raw.startsWith('QR_ATTENDANCE:') ? raw.slice(14) : raw;
  // Validate token is a 64-char hex string (crypto.randomBytes(32).toString('hex'))
  if (!/^[0-9a-f]{64}$/.test(token)) return null;
  return token;
};

// @desc    Create a new QR session (admin generates QR code)
// @route   POST /api/qr-attendance/sessions
// @access  Admin
const createQRSession = async (req, res, next) => {
  try {
    const { date, label, expiryMinutes = 10 } = req.body;

    if (!date) {
      return res.status(400).json({ success: false, message: 'Date is required' });
    }
    // FIX: Validate expiryMinutes range
    const expiry = parseInt(expiryMinutes, 10);
    if (isNaN(expiry) || expiry < 1 || expiry > 480) {
      return res.status(400).json({ success: false, message: 'expiryMinutes must be between 1 and 480' });
    }

    const settings = await Settings.findOne({ isActive: true });
    if (!settings) {
      return res.status(400).json({ success: false, message: 'No active VBS year configured' });
    }

    const attendanceDate = normalizeToISTMidnight(date);

    const startDate = normalizeToISTMidnight(settings.dates.startDate);
    const endDate = new Date(normalizeToISTMidnight(settings.dates.endDate).getTime() + 24 * 60 * 60 * 1000 - 1);
    if (attendanceDate < startDate || attendanceDate > endDate) {
      return res.status(400).json({
        success: false,
        message: `Date is outside VBS schedule (${settings.dates.startDate.toDateString()} – ${settings.dates.endDate.toDateString()})`,
      });
    }

    const token = generateToken();
    const expiresAt = new Date(Date.now() + expiry * 60 * 1000);

    // FIX: Sanitize label to prevent stored XSS
    const safeLabel = label
      ? label.trim().replace(/[<>"'&]/g, '').slice(0, 100)
      : `Attendance — ${attendanceDate.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric' })}`;

    const session = await QRSession.create({
      token,
      date: attendanceDate,
      vbsYear: settings.year,
      createdBy: req.user._id,
      expiresAt,
      label: safeLabel,
      isActive: true,
    });

    res.status(201).json({
      success: true,
      message: 'QR session created',
      data: {
        _id: session._id,
        token: session.token,
        date: session.date,
        vbsYear: session.vbsYear,
        label: session.label,
        expiresAt: session.expiresAt,
        expiryMinutes: expiry,
        isActive: session.isActive,
        scansCount: 0,
        qrPayload: `QR_ATTENDANCE:${token}`,
      },
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get all QR sessions (admin view)
// @route   GET /api/qr-attendance/sessions
// @access  Admin
const getQRSessions = async (req, res, next) => {
  try {
    const { date, vbsYear } = req.query;
    const filter = {};
    if (vbsYear) filter.vbsYear = Number(vbsYear);
    if (date) filter.date = normalizeToISTMidnight(date);

    const sessions = await QRSession.find(filter)
      .populate('createdBy', 'name')
      .populate('scans.teacher', 'name classAssigned')
      .sort({ createdAt: -1 })
      .limit(50);

    res.json({ success: true, count: sessions.length, data: sessions });
  } catch (err) {
    next(err);
  }
};

// @desc    Get a single QR session by ID
// @route   GET /api/qr-attendance/sessions/:id
// @access  Admin
const getQRSession = async (req, res, next) => {
  try {
    const session = await QRSession.findById(req.params.id)
      .populate('createdBy', 'name')
      .populate('scans.teacher', 'name classAssigned contactNumber');

    if (!session) {
      return res.status(404).json({ success: false, message: 'QR session not found' });
    }

    const now = new Date();
    const isExpired = now > session.expiresAt;
    const remainingMs = Math.max(0, session.expiresAt - now);

    res.json({
      success: true,
      data: {
        ...session.toObject(),
        isExpired,
        remainingSeconds: Math.floor(remainingMs / 1000),
        scansCount: session.scans.length,
      },
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Deactivate a QR session
// @route   PUT /api/qr-attendance/sessions/:id/deactivate
// @access  Admin
const deactivateQRSession = async (req, res, next) => {
  try {
    const session = await QRSession.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true }
    );
    if (!session) {
      return res.status(404).json({ success: false, message: 'QR session not found' });
    }
    res.json({ success: true, message: 'QR session deactivated', data: session });
  } catch (err) {
    next(err);
  }
};

// @desc    Teacher scans QR code — marks their attendance
// @route   POST /api/qr-attendance/scan
// @access  Teacher (must be logged in)
const scanQRCode = async (req, res, next) => {
  try {
    const { token: rawToken } = req.body;

    if (!rawToken) {
      return res.status(400).json({ success: false, message: 'QR token is required' });
    }

    // FIX: Validate and clean the token
    const token = cleanToken(rawToken);
    if (!token) {
      return res.status(400).json({ success: false, message: 'Invalid QR code format' });
    }

    const session = await QRSession.findOne({ token });

    if (!session) {
      return res.status(404).json({ success: false, message: 'Invalid QR code. Please ask admin for a new one.' });
    }

    if (!session.isActive) {
      return res.status(400).json({ success: false, message: 'This QR session has been deactivated by the admin.' });
    }

    const now = new Date();
    if (now > session.expiresAt) {
      return res.status(400).json({
        success: false,
        message: 'This QR code has expired. Please ask admin to generate a new one.',
        expired: true,
      });
    }

    const teacher = await Teacher.findOne({ user: req.user._id });
    if (!teacher) {
      return res.status(403).json({
        success: false,
        message: 'No teacher profile linked to your account. Contact admin.',
      });
    }

    const alreadyScanned = session.scans.some(
      (s) => s.teacher?.toString() === teacher._id.toString()
    );
    if (alreadyScanned) {
      return res.status(400).json({
        success: false,
        message: 'You have already marked your attendance for this session.',
        alreadyScanned: true,
      });
    }

    const sessionAgeMin = (now - session.createdAt) / (1000 * 60);
    const status = sessionAgeMin <= 30 ? 'present' : 'late';
    const arrivalTime = getISTTimeString();

    session.scans.push({
      teacher: teacher._id,
      teacherName: teacher.name,
      scannedAt: now,
      status,
      arrivalTime,
    });
    await session.save();

    const existing = await TeacherAttendance.findOne({
      date: session.date,
      teacher: teacher._id,
    });

    if (existing) {
      // FIX: Capture previousStatus BEFORE mutation (was a bug in original)
      const previousStatus = existing.status;
      existing.status = status;
      existing.arrivalTime = arrivalTime;
      existing.remarks = `Marked via QR scan at ${arrivalTime}`;
      existing.isModified = true;
      existing.modificationHistory.push({
        modifiedBy: req.user._id,
        modifiedByName: req.user.name,
        modifiedAt: now,
        changes: [{
          entityId: teacher._id.toString(),
          entityName: teacher.name,
          previousStatus, // ← correctly captured before mutation
          newStatus: status,
        }],
        reason: 'QR code scan',
      });
      await existing.save();
    } else {
      await TeacherAttendance.create({
        date: session.date,
        teacher: teacher._id,
        vbsYear: session.vbsYear,
        status,
        arrivalTime,
        remarks: `Marked via QR scan at ${arrivalTime}`,
        markedBy: req.user._id,
        markedByName: req.user.name,
      });
    }

    res.json({
      success: true,
      message: status === 'present'
        ? `✓ Attendance marked! Present at ${arrivalTime}`
        : `✓ Attendance marked as Late at ${arrivalTime}`,
      data: {
        teacherName: teacher.name,
        status,
        arrivalTime,
        date: session.date,
        sessionLabel: session.label,
      },
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Admin manually marks on behalf of teacher
// @route   POST /api/qr-attendance/admin-scan
// @access  Admin
const adminScanForTeacher = async (req, res, next) => {
  try {
    const { sessionId, teacherId, status = 'present' } = req.body;

    if (!sessionId || !teacherId) {
      return res.status(400).json({ success: false, message: 'sessionId and teacherId are required' });
    }

    // FIX: Validate status value
    if (!['present', 'late', 'absent', 'leave'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status value' });
    }

    const session = await QRSession.findById(sessionId);
    if (!session) {
      return res.status(404).json({ success: false, message: 'Session not found' });
    }

    const teacher = await Teacher.findById(teacherId);
    if (!teacher) {
      return res.status(404).json({ success: false, message: 'Teacher not found' });
    }

    const arrivalTime = getISTTimeString();
    const now = new Date();

    session.scans = session.scans.filter(
      (s) => s.teacher?.toString() !== teacher._id.toString()
    );
    session.scans.push({
      teacher: teacher._id,
      teacherName: teacher.name,
      scannedAt: now,
      status,
      arrivalTime,
    });
    await session.save();

    const existing = await TeacherAttendance.findOne({
      date: session.date,
      teacher: teacher._id,
    });

    if (existing) {
      // FIX: Capture previousStatus BEFORE mutation (was a bug in original adminScanForTeacher)
      const previousStatus = existing.status;
      existing.status = status;
      existing.arrivalTime = arrivalTime;
      existing.remarks = `Manually marked by admin via QR session`;
      existing.isModified = true;
      existing.modificationHistory.push({
        modifiedBy: req.user._id,
        modifiedByName: req.user.name,
        modifiedAt: now,
        changes: [{
          entityId: teacher._id.toString(),
          entityName: teacher.name,
          previousStatus, // ← correctly captured before mutation
          newStatus: status,
        }],
        reason: 'Admin manual mark via QR session',
      });
      await existing.save();
    } else {
      await TeacherAttendance.create({
        date: session.date,
        teacher: teacher._id,
        vbsYear: session.vbsYear,
        status,
        arrivalTime,
        remarks: `Manually marked by admin via QR session`,
        markedBy: req.user._id,
        markedByName: req.user.name,
      });
    }

    res.json({
      success: true,
      message: `${teacher.name} marked as ${status}`,
      data: { teacherName: teacher.name, status, arrivalTime },
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Validate QR token
// @route   GET /api/qr-attendance/validate/:token
// @access  Teacher
const validateToken = async (req, res, next) => {
  try {
    // FIX: Validate token format before querying DB
    const token = cleanToken(req.params.token);
    if (!token) {
      return res.status(400).json({ success: false, message: 'Invalid QR code format' });
    }

    const session = await QRSession.findOne({ token });

    if (!session) {
      return res.status(404).json({ success: false, message: 'Invalid QR code' });
    }

    const now = new Date();
    const isExpired = now > session.expiresAt;
    const remainingMs = Math.max(0, session.expiresAt - now);

    let alreadyScanned = false;
    if (req.user?.role === 'teacher') {
      const teacher = await Teacher.findOne({ user: req.user._id });
      if (teacher) {
        alreadyScanned = session.scans.some(
          (s) => s.teacher?.toString() === teacher._id.toString()
        );
      }
    }

    res.json({
      success: true,
      data: {
        sessionId: session._id,
        label: session.label,
        date: session.date,
        vbsYear: session.vbsYear,
        isActive: session.isActive,
        isExpired,
        alreadyScanned,
        remainingSeconds: Math.floor(remainingMs / 1000),
        scansCount: session.scans.length,
      },
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  createQRSession,
  getQRSessions,
  getQRSession,
  deactivateQRSession,
  scanQRCode,
  adminScanForTeacher,
  validateToken,
};
