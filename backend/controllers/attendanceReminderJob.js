/**
 * Attendance Reminder Job
 * 
 * Sends notifications to teachers who haven't submitted attendance
 * during the active VBS schedule, within or near the attendance window.
 * 
 * Call this from server.js on a schedule (e.g. every 15 minutes via setInterval,
 * or via a cron library like node-cron).
 * 
 * Usage from server.js:
 *   const { startAttendanceReminderJob } = require('./controllers/attendanceReminderJob');
 *   startAttendanceReminderJob();
 */

const Settings = require('../models/Settings');
const { Teacher } = require('../models/TeacherVolunteer');
const User = require('../models/User');
const { StudentAttendance } = require('../models/Attendance');
const { notifyTeacherAttendancePending } = require('../services/notificationService');
const { checkAttendanceWindow, normalizeToISTMidnight, getISTTimeParts } = require('../services/attendanceWindowService');

let reminderInterval = null;

/**
 * Core reminder logic — runs on every tick.
 */
const runReminder = async () => {
  try {
    // Only proceed if there's an active VBS year
    const settings = await Settings.findOne({ isActive: true });
    if (!settings) return;

    // Only run on VBS days
    const todayIST = normalizeToISTMidnight(new Date());
    const startDate = normalizeToISTMidnight(settings.dates.startDate);
    const endDate = normalizeToISTMidnight(settings.dates.endDate);
    if (todayIST < startDate || todayIST > endDate) return;

    // Only run during or near the attendance window
    const windowStatus = await checkAttendanceWindow();
    if (!windowStatus.allowed && windowStatus.minutesRemaining !== undefined) return;

    // Calculate remaining minutes (send reminders when 60min and 30min remain)
    const { minutesRemaining } = windowStatus;
    const shouldSendReminder = windowStatus.allowed && (minutesRemaining <= 60);
    if (!shouldSendReminder) return;

    // Find all teachers with a class assigned
    const teachers = await Teacher.find({
      isActive: true,
      classAssigned: { $ne: null },
      user: { $ne: null },
    }).populate('classAssigned', 'name').populate('user', '_id name');

    if (!teachers.length) return;

    // Find which classes already submitted attendance today
    const submittedToday = await StudentAttendance.find({ date: todayIST, vbsYear: settings.year })
      .select('class');
    const submittedClassIds = new Set(submittedToday.map(a => a.class?.toString()));

    // Notify teachers whose classes have NOT submitted yet
    const remindPromises = teachers
      .filter(t => {
        const classId = t.classAssigned?._id?.toString() || t.classAssigned?.toString();
        return classId && !submittedClassIds.has(classId);
      })
      .map(t => {
        const userId = t.user?._id || t.user;
        const className = t.classAssigned?.name || 'your class';
        if (!userId) return Promise.resolve();
        return notifyTeacherAttendancePending(userId, className, minutesRemaining)
          .catch(err => console.error(`Reminder failed for teacher ${t.name}:`, err.message));
      });

    if (remindPromises.length > 0) {
      await Promise.allSettled(remindPromises);
      console.log(`[Reminder] Sent attendance reminders to ${remindPromises.length} teacher(s) — ${minutesRemaining} min remaining`);
    }
  } catch (err) {
    // Non-fatal: log but don't crash the server
    console.error('[Reminder] Error in attendance reminder job:', err.message);
  }
};

/**
 * Starts the reminder job. Runs every 15 minutes.
 * Safe to call multiple times — will not create duplicate intervals.
 * 
 * @returns {function} stopJob — call to cancel the interval
 */
const startAttendanceReminderJob = () => {
  if (reminderInterval) {
    console.log('[Reminder] Attendance reminder job already running');
    return () => clearInterval(reminderInterval);
  }

  const INTERVAL_MS = 15 * 60 * 1000; // 15 minutes

  // Run once immediately on start
  runReminder();

  reminderInterval = setInterval(runReminder, INTERVAL_MS);
  console.log('[Reminder] Attendance reminder job started (every 15 min)');

  return () => {
    clearInterval(reminderInterval);
    reminderInterval = null;
    console.log('[Reminder] Attendance reminder job stopped');
  };
};

const stopAttendanceReminderJob = () => {
  if (reminderInterval) {
    clearInterval(reminderInterval);
    reminderInterval = null;
    console.log('[Reminder] Attendance reminder job stopped');
  }
};

module.exports = { startAttendanceReminderJob, stopAttendanceReminderJob, runReminder };
