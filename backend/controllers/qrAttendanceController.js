// backend/controllers/qrAttendanceController.js — Enhanced with admin time windows
const crypto = require('crypto');
const QRSession = require('../models/QRSession');
const { TeacherAttendance } = require('../models/Attendance');
const { Teacher } = require('../models/TeacherVolunteer');
const Settings = require('../models/Settings');
const { normalizeToISTMidnight } = require('../services/attendanceWindowService');

// ─── Helpers ──────────────────────────────────────────────────────
const generateToken = () => crypto.randomBytes(32).toString('hex');

/**
 * Returns current IST time as HH:MM string
 */
const getISTTimeString = (date = new Date()) => {
  return date.toLocaleTimeString('en-IN', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
};

/**
 * Returns current IST time as HH:MM:SS string (for display)
 */
const getISTTimeStringFull = (date = new Date()) => {
  return date.toLocaleTimeString('en-IN', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });
};

/**
 * Parse "HH:MM" time string on a given date in IST → returns UTC Date
 * e.g. "08:30" on 2026-06-10 IST → 2026-06-10T03:00:00.000Z
 */
const parseISTTime = (timeStr, baseDate) => {
  if (!timeStr || !baseDate) return null;
  const [hours, minutes] = timeStr.split(':').map(Number);
  if (isNaN(hours) || isNaN(minutes)) return null;

  // Get IST date parts from the base date
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric', month: '2-digit', day: '2-digit',
  });
  const parts = formatter.formatToParts(baseDate);
  const get = (type) => parseInt(parts.find(p => p.type === type)?.value || '0', 10);
  const year = get('year');
  const month = get('month') - 1; // 0-indexed
  const day = get('day');

  // Construct as UTC: IST = UTC+5:30
  const istOffset = 5.5 * 60 * 60 * 1000; // 5h30m in ms
  const utcMs = Date.UTC(year, month, day, hours, minutes, 0, 0) - istOffset;
  return new Date(utcMs);
};

/**
 * Determine scan status based on admin-configured time window.
 *
 * Logic:
 * - If onTimeUntil is set by admin:
 *   - scanTime <= onTimeUntil  → "present"
 *   - scanTime >  onTimeUntil  → "late"
 * - Fallback (legacy): sessions older than 30 min → "late"
 *
 * @param {QRSession} session
 * @param {Date} scanTime
 * @returns {'present'|'late'}
 */
const determineScanStatus = (session, scanTime) => {
  if (session.onTimeUntil) {
    return scanTime <= new Date(session.onTimeUntil) ? 'present' : 'late';
  }
  // Legacy fallback: 30-min window from session creation
  const sessionAgeMin = (scanTime - session.createdAt) / (1000 * 60);
  return sessionAgeMin <= 30 ? 'present' : 'late';
};

// Token format validation
const cleanToken = (raw) => {
  const token = raw.startsWith('QR_ATTENDANCE:') ? raw.slice(14) : raw;
  if (!/^[0-9a-f]{64}$/.test(token)) return null;
  return token;
};

// ─── @desc  Create QR session (admin) ────────────────────────────
// @route POST /api/qr-attendance/sessions
// @access Admin
const createQRSession = async (req, res, next) => {
  try {
    const {
      date,
      label,
      expiryMinutes = 60,
      // NEW: Admin-configurable time window
      // windowStartTime: "HH:MM" — when session "opens" (informational)
      // onTimeUntilTime: "HH:MM" — scans up to this time are "present"; after = "late"
      windowStartTime,
      onTimeUntilTime,
    } = req.body;

    if (!date) {
      return res.status(400).json({ success: false, message: 'Date is required' });
    }

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
    const now = new Date();
    const expiresAt = new Date(now.getTime() + expiry * 60 * 1000);

    // ── Parse admin-defined time window ───────────────────────────
    let onTimeUntilDate = null;
    let resolvedWindowStart = windowStartTime || null;
    let resolvedOnTimeUntil = onTimeUntilTime || null;

    if (onTimeUntilTime) {
      // Validate HH:MM format
      if (!/^\d{2}:\d{2}$/.test(onTimeUntilTime)) {
        return res.status(400).json({ success: false, message: 'onTimeUntilTime must be in HH:MM format' });
      }
      onTimeUntilDate = parseISTTime(onTimeUntilTime, attendanceDate);
      if (!onTimeUntilDate) {
        return res.status(400).json({ success: false, message: 'Invalid onTimeUntilTime' });
      }

      // onTimeUntil must be before expiresAt
      if (onTimeUntilDate >= expiresAt) {
        return res.status(400).json({
          success: false,
          message: 'On-time cutoff must be before session expiry',
        });
      }
    }

    // Sanitize label
    const safeLabel = label
      ? label.trim().replace(/[<>"'&]/g, '').slice(0, 100)
      : `Attendance — ${attendanceDate.toLocaleDateString('en-IN', {
          timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric',
        })}`;

    const session = await QRSession.create({
      token,
      date: attendanceDate,
      vbsYear: settings.year,
      createdBy: req.user._id,
      expiresAt,
      label: safeLabel,
      isActive: true,
      onTimeUntil: onTimeUntilDate,
      windowStartTime: resolvedWindowStart,
      onTimeUntilTimeStr: resolvedOnTimeUntil,
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
        // Time window info
        onTimeUntil: session.onTimeUntil,
        windowStartTime: session.windowStartTime,
        onTimeUntilTimeStr: session.onTimeUntilTimeStr,
        hasTimeWindow: !!onTimeUntilDate,
      },
    });
  } catch (err) {
    next(err);
  }
};

// ─── @desc  Get all QR sessions ───────────────────────────────────
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

// ─── @desc  Get single QR session ─────────────────────────────────
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

    // Status for current moment
    const currentStatus = determineScanStatus(session, now);
    const isInLateWindow = session.onTimeUntil && now > new Date(session.onTimeUntil);

    res.json({
      success: true,
      data: {
        ...session.toObject(),
        isExpired,
        remainingSeconds: Math.floor(remainingMs / 1000),
        scansCount: session.scans.length,
        currentScanStatus: currentStatus,
        isInLateWindow,
      },
    });
  } catch (err) {
    next(err);
  }
};

// ─── @desc  Deactivate QR session ─────────────────────────────────
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

// ─── @desc  Teacher scans QR code ─────────────────────────────────
// @route POST /api/qr-attendance/scan
// @access Teacher
const scanQRCode = async (req, res, next) => {
  try {
    const { token: rawToken } = req.body;

    if (!rawToken) {
      return res.status(400).json({ success: false, message: 'QR token is required' });
    }

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

    // ── Determine status using admin time window ──────────────────
    const status = determineScanStatus(session, now);
    const arrivalTime = getISTTimeString(now);
    const arrivalTimeFull = getISTTimeStringFull(now);

    // Build status context for response
    const statusContext = session.onTimeUntil
      ? {
          method: 'admin_window',
          onTimeUntil: session.onTimeUntilTimeStr,
          scanTime: arrivalTime,
          isLate: status === 'late',
        }
      : {
          method: 'legacy_30min',
          sessionAgeMin: Math.round((now - session.createdAt) / (1000 * 60)),
          isLate: status === 'late',
        };

    session.scans.push({
      teacher: teacher._id,
      teacherName: teacher.name,
      scannedAt: now,
      status,
      arrivalTime,
      scannedAtTimeStr: arrivalTimeFull,
    });
    await session.save();

    // ── Upsert TeacherAttendance record ───────────────────────────
    const existing = await TeacherAttendance.findOne({
      date: session.date,
      teacher: teacher._id,
    });

    if (existing) {
      const previousStatus = existing.status;
      existing.status = status;
      existing.arrivalTime = arrivalTime;
      existing.remarks = `Marked via QR scan at ${arrivalTimeFull}${
        status === 'late' && session.onTimeUntilTimeStr
          ? ` (on-time cutoff was ${session.onTimeUntilTimeStr})`
          : ''
      }`;
      existing.isModified = true;
      existing.modificationHistory.push({
        modifiedBy: req.user._id,
        modifiedByName: req.user.name,
        modifiedAt: now,
        changes: [{
          entityId: teacher._id.toString(),
          entityName: teacher.name,
          previousStatus,
          newStatus: status,
        }],
        reason: `QR scan at ${arrivalTimeFull}`,
      });
      await existing.save();
    } else {
      await TeacherAttendance.create({
        date: session.date,
        teacher: teacher._id,
        vbsYear: session.vbsYear,
        status,
        arrivalTime,
        remarks: `Marked via QR scan at ${arrivalTimeFull}${
          status === 'late' && session.onTimeUntilTimeStr
            ? ` (on-time cutoff was ${session.onTimeUntilTimeStr})`
            : ''
        }`,
        markedBy: req.user._id,
        markedByName: req.user.name,
      });
    }

    // ── Build response message ────────────────────────────────────
    let message;
    if (status === 'present') {
      message = `✓ Attendance marked as Present at ${arrivalTimeFull}`;
    } else {
      const cutoffText = session.onTimeUntilTimeStr
        ? ` (on-time cutoff was ${session.onTimeUntilTimeStr})`
        : '';
      message = `⚠️ Marked as Late — arrived at ${arrivalTimeFull}${cutoffText}`;
    }

    res.json({
      success: true,
      message,
      data: {
        teacherName: teacher.name,
        status,
        arrivalTime,
        arrivalTimeFull,
        date: session.date,
        sessionLabel: session.label,
        statusContext,
        // Window info for display
        onTimeUntilTimeStr: session.onTimeUntilTimeStr || null,
      },
    });
  } catch (err) {
    next(err);
  }
};

// ─── @desc  Admin manual mark for teacher ─────────────────────────
// @route POST /api/qr-attendance/admin-scan
// @access Admin
const adminScanForTeacher = async (req, res, next) => {
  try {
    const { sessionId, teacherId, status = 'present', overrideTime } = req.body;

    if (!sessionId || !teacherId) {
      return res.status(400).json({ success: false, message: 'sessionId and teacherId are required' });
    }

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

    const now = new Date();
    const arrivalTime = overrideTime || getISTTimeString(now);
    const arrivalTimeFull = getISTTimeStringFull(now);

    // Remove previous scan for this teacher (admin override)
    session.scans = session.scans.filter(
      (s) => s.teacher?.toString() !== teacher._id.toString()
    );
    session.scans.push({
      teacher: teacher._id,
      teacherName: teacher.name,
      scannedAt: now,
      status,
      arrivalTime,
      scannedAtTimeStr: arrivalTimeFull,
    });
    await session.save();

    const existing = await TeacherAttendance.findOne({
      date: session.date,
      teacher: teacher._id,
    });

    if (existing) {
      const previousStatus = existing.status;
      existing.status = status;
      existing.arrivalTime = arrivalTime;
      existing.remarks = `Manually marked by admin via QR session at ${arrivalTimeFull}`;
      existing.isModified = true;
      existing.modificationHistory.push({
        modifiedBy: req.user._id,
        modifiedByName: req.user.name,
        modifiedAt: now,
        changes: [{
          entityId: teacher._id.toString(),
          entityName: teacher.name,
          previousStatus,
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
        remarks: `Manually marked by admin via QR session at ${arrivalTimeFull}`,
        markedBy: req.user._id,
        markedByName: req.user.name,
      });
    }

    res.json({
      success: true,
      message: `${teacher.name} marked as ${status}`,
      data: { teacherName: teacher.name, status, arrivalTime, arrivalTimeFull },
    });
  } catch (err) {
    next(err);
  }
};

// ─── @desc  Validate QR token ─────────────────────────────────────
// @route GET /api/qr-attendance/validate/:token
// @access Teacher
const validateToken = async (req, res, next) => {
  try {
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
    let existingScanStatus = null;

    if (req.user?.role === 'teacher') {
      const teacher = await Teacher.findOne({ user: req.user._id });
      if (teacher) {
        const existingScan = session.scans.find(
          (s) => s.teacher?.toString() === teacher._id.toString()
        );
        alreadyScanned = !!existingScan;
        existingScanStatus = existingScan?.status || null;
      }
    }

    // What status would a scan right now get?
    const projectedStatus = !isExpired ? determineScanStatus(session, now) : null;
    const isInLateWindow = session.onTimeUntil && now > new Date(session.onTimeUntil);

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
        existingScanStatus,
        remainingSeconds: Math.floor(remainingMs / 1000),
        scansCount: session.scans.length,
        projectedStatus,
        isInLateWindow,
        // Time window config
        windowStartTime: session.windowStartTime,
        onTimeUntilTimeStr: session.onTimeUntilTimeStr,
        onTimeUntil: session.onTimeUntil,
        hasTimeWindow: !!session.onTimeUntil,
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
