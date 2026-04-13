const Settings = require('../models/Settings');

const IST_TIMEZONE = 'Asia/Kolkata';

const getISTTimeParts = (date = new Date()) => {
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: IST_TIMEZONE,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  });
  const parts = formatter.formatToParts(date);
  const get = (type) => parseInt(parts.find((p) => p.type === type)?.value || '0', 10);
  return {
    year: get('year'), month: get('month'), day: get('day'),
    hour: get('hour'), minute: get('minute'), second: get('second'),
  };
};

const normalizeToISTMidnight = (date) => {
  const d = new Date(date);
  const { year, month, day } = getISTTimeParts(d);
  const istMidnightUTC = Date.UTC(year, month - 1, day, 0, 0, 0, 0) - (5.5 * 60 * 60 * 1000);
  return new Date(istMidnightUTC);
};

const getTodayISTString = () => {
  const { year, month, day } = getISTTimeParts(new Date());
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
};

/**
 * Checks if the current time (IST) is within the student attendance time window.
 * Also checks if the window has been manually stopped (for leave days / cancelled sessions).
 *
 * @returns {{ allowed: boolean, message: string, windowStart: string, windowEnd: string,
 *             currentTime: string, minutesRemaining: number, stopped: boolean }}
 */
const checkAttendanceWindow = async () => {
  const settings = await Settings.findOne({ isActive: true });
  if (!settings) {
    return {
      allowed: false,
      message: 'No active VBS year configured',
      windowStart: null,
      windowEnd: null,
      currentTime: null,
      minutesRemaining: 0,
      stopped: false,
    };
  }

  // ── NEW: Check if window is manually stopped ──────────────────────
  if (settings.timeWindow?.attendanceStopped === true) {
    const stopReason = settings.timeWindow?.stopReason || 'Attendance window has been stopped by admin.';
    const { hour: currentHour, minute: currentMin } = getISTTimeParts(new Date());
    const currentTimeStr = `${String(currentHour).padStart(2, '0')}:${String(currentMin).padStart(2, '0')}`;
    return {
      allowed: false,
      stopped: true,
      message: `⛔ ${stopReason}`,
      windowStart: settings.timeWindow?.studentAttendance?.startTime || null,
      windowEnd: settings.timeWindow?.studentAttendance?.endTime || null,
      currentTime: currentTimeStr,
      minutesRemaining: 0,
    };
  }

  const { startTime, endTime } = settings.timeWindow.studentAttendance;

  const { hour: currentHour, minute: currentMin } = getISTTimeParts(new Date());
  const currentTotalMin = currentHour * 60 + currentMin;
  const currentTimeStr = `${String(currentHour).padStart(2, '0')}:${String(currentMin).padStart(2, '0')}`;

  const [startH, startM] = startTime.split(':').map(Number);
  const [endH, endM] = endTime.split(':').map(Number);
  const startTotalMin = startH * 60 + startM;
  const endTotalMin = endH * 60 + endM;

  const allowed = currentTotalMin >= startTotalMin && currentTotalMin <= endTotalMin;
  const minutesRemaining = allowed ? endTotalMin - currentTotalMin : 0;

  return {
    allowed,
    stopped: false,
    message: allowed
      ? `Attendance window is open (${startTime}–${endTime} IST)`
      : `Attendance window is closed. Window: ${startTime}–${endTime} IST. Current IST: ${currentTimeStr}`,
    windowStart: startTime,
    windowEnd: endTime,
    currentTime: currentTimeStr,
    minutesRemaining,
  };
};

const isWithinVBSSchedule = async (date) => {
  const settings = await Settings.findOne({ isActive: true });
  if (!settings) return { valid: false, message: 'No active VBS year configured' };

  const checkDate = normalizeToISTMidnight(date);
  const startDate = normalizeToISTMidnight(settings.dates.startDate);
  const endDate = normalizeToISTMidnight(settings.dates.endDate);
  const endDateInclusive = new Date(endDate.getTime() + 24 * 60 * 60 * 1000 - 1);

  const valid = checkDate >= startDate && checkDate <= endDateInclusive;
  const startStr = settings.dates.startDate.toDateString();
  const endStr = settings.dates.endDate.toDateString();

  return {
    valid,
    message: valid
      ? 'Date is within VBS schedule'
      : `Date is outside VBS schedule (${startStr} – ${endStr})`,
    vbsYear: settings.year,
    settings,
  };
};

const getActiveVBSSettings = async () => {
  return Settings.findOne({ isActive: true });
};

module.exports = {
  checkAttendanceWindow,
  isWithinVBSSchedule,
  getActiveVBSSettings,
  normalizeToISTMidnight,
  getTodayISTString,
  getISTTimeParts,
};
