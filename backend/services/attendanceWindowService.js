const Settings = require('../models/Settings');

const IST_TIMEZONE = 'Asia/Kolkata';

/**
 * Returns the current time components in IST using Intl.DateTimeFormat.
 * This is the correct way — toLocaleString() returns a locale-formatted string
 * that is NOT reliably parseable by new Date().
 */
const getISTTimeParts = (date = new Date()) => {
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: IST_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  const parts = formatter.formatToParts(date);
  const get = (type) => parseInt(parts.find((p) => p.type === type)?.value || '0', 10);

  return {
    year: get('year'),
    month: get('month'),
    day: get('day'),
    hour: get('hour'),   // 0–23
    minute: get('minute'),
    second: get('second'),
  };
};

/**
 * Returns a Date object representing midnight (00:00:00.000) of the given date
 * interpreted in IST. This avoids the UTC vs IST offset problem where
 * setHours(0,0,0,0) uses server-local time (often UTC on cloud servers).
 *
 * Example: "2026-06-10" in IST → UTC 2026-06-09T18:30:00.000Z
 */
const normalizeToISTMidnight = (date) => {
  const d = new Date(date);
  // Extract IST date parts
  const { year, month, day } = getISTTimeParts(d);
  // Construct midnight IST as UTC: IST is UTC+5:30, so midnight IST = 18:30 previous UTC day
  // We achieve this by constructing the date string in IST and converting via Date.UTC offset
  const istMidnightUTC = Date.UTC(year, month - 1, day, 0, 0, 0, 0) - (5.5 * 60 * 60 * 1000);
  return new Date(istMidnightUTC);
};

/**
 * Gets today's date string in IST (YYYY-MM-DD) regardless of server timezone.
 */
const getTodayISTString = () => {
  const { year, month, day } = getISTTimeParts(new Date());
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
};

/**
 * Checks if the current time (IST) is within the student attendance time window.
 * Admin is always exempt from this check — this only validates for teachers.
 *
 * @returns {{ allowed: boolean, message: string, windowStart: string, windowEnd: string, currentTime: string, minutesRemaining: number }}
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
    };
  }

  const { startTime, endTime } = settings.timeWindow.studentAttendance;

  // Get current IST hour and minute using Intl API (correct approach)
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
    message: allowed
      ? `Attendance window is open (${startTime}–${endTime} IST)`
      : `Attendance window is closed. Window: ${startTime}–${endTime} IST. Current IST: ${currentTimeStr}`,
    windowStart: startTime,
    windowEnd: endTime,
    currentTime: currentTimeStr,
    minutesRemaining,
  };
};

/**
 * Checks if a given date falls within the active VBS schedule.
 * Uses IST-normalized midnight for accurate date comparison.
 *
 * @param {Date|string} date
 * @returns {{ valid: boolean, message: string, vbsYear: number, settings: object }}
 */
const isWithinVBSSchedule = async (date) => {
  const settings = await Settings.findOne({ isActive: true });
  if (!settings) return { valid: false, message: 'No active VBS year configured' };

  const checkDate = normalizeToISTMidnight(date);
  const startDate = normalizeToISTMidnight(settings.dates.startDate);
  const endDate = normalizeToISTMidnight(settings.dates.endDate);

  // End date is inclusive — add 1 day worth of ms
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

/**
 * Returns the active VBS year settings.
 */
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