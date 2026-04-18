const express = require('express');
const rateLimit = require('express-rate-limit');
const { protect, adminOnly, editorOrAdmin, authorize } = require('../middleware/auth');

const { login, refresh, logout, changePassword, getMe } = require('../controllers/authController');
const { getUsers, createUser, updateUser, resetPassword, deleteUser } = require('../controllers/userController');
const {
  getStudents, getStudent, createStudent, updateStudent, deleteStudent,
  bulkDeleteStudents, bulkAllocate, getStagingStudents, approveStagedStudent,
  rejectStagedStudent, bulkApproveStagedStudents,
} = require('../controllers/studentController');
const {
  getTeachers, getTeacher, createTeacher, updateTeacher, deleteTeacher, assignTeacherToClass,
  getStagingTeachers, approveStagedTeacher, rejectStagedTeacher, bulkApproveStagedTeachers,
  getVolunteers, getVolunteer, createVolunteer, updateVolunteer, deleteVolunteer,
  getStagingVolunteers, approveStagedVolunteer, rejectStagedVolunteer, bulkApproveStagedVolunteers,
} = require('../controllers/teacherVolunteerController');
const { getClasses, getClass, createClass, updateClass, deleteClass, getEligibleStudents } = require('../controllers/classController');
const {
  getStudentAttendance, submitStudentAttendance, modifyStudentAttendance,
  deleteStudentAttendance, getWindowStatus, getTodaySummary,
} = require('../controllers/studentAttendanceController');
const {
  getTeacherAttendance, submitTeacherAttendance, modifyTeacherAttendance, deleteTeacherAttendance,
  getVolunteerAttendance, submitVolunteerAttendance, modifyVolunteerAttendance, deleteVolunteerAttendance,
} = require('../controllers/teacherVolunteerAttendanceController');
const { getDashboardStats, getStudentAnalytics, getAttendanceTrends, getModificationsSummary } = require('../controllers/analyticsController');
const {
  getDailyReport, getClassReport, getStudentReport, getTeacherReport,
  getVolunteerReport, getFullYearReport,
  getVillageList, getVillageReport, getCategoryReport,
} = require('../controllers/reportsController');
const {
  getSettings, getActiveSettings, createSettings, updateSettings, activateYear,
  getNotifications, markNotificationRead, markAllRead, broadcastNotification, toggleAttendanceWindow,
} = require('../controllers/settingsNotificationsController');
const { getTeacherExportData } = require('../controllers/exportController');

const {
  createQRSession,
  getQRSessions,
  getQRSession,
  deactivateQRSession,
  scanQRCode,
  adminScanForTeacher,
  validateToken,
} = require('../controllers/qrAttendanceController');

const router = express.Router();

// ─── Rate Limiters ─────────────────────────────────────────────────

// Strict: login endpoint
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.LOGIN_RATE_LIMIT_MAX, 10) || 5,
  message: { success: false, message: 'Too many login attempts. Try again in 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.ip,
});

// FIX: General API rate limit to prevent scraping / abuse
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.API_RATE_LIMIT_MAX, 10) || 500,
  message: { success: false, message: 'Too many requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.ip,
  skip: (req) => process.env.NODE_ENV === 'development',
});

// Tight limit for mutation operations (POST/PUT/DELETE) to prevent mass operations
const mutationLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: parseInt(process.env.MUTATION_RATE_LIMIT_MAX, 10) || 60,
  message: { success: false, message: 'Too many write operations. Please slow down.' },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.ip,
  skip: (req) => process.env.NODE_ENV === 'development',
});

// Apply general rate limit to all API routes
router.use(apiLimiter);

// ─── AUTH ──────────────────────────────────────────────────────────
router.post('/auth/login', loginLimiter, login);
router.post('/auth/refresh', refresh);
router.post('/auth/logout', protect, logout);
router.put('/auth/change-password', protect, mutationLimiter, changePassword);
router.get('/auth/me', protect, getMe);

// ─── USERS ─────────────────────────────────────────────────────────
router.get('/users', protect, adminOnly, getUsers);
router.post('/users', protect, adminOnly, mutationLimiter, createUser);
router.put('/users/:id', protect, adminOnly, mutationLimiter, updateUser);
router.put('/users/:id/reset-password', protect, adminOnly, mutationLimiter, resetPassword);
router.delete('/users/:id', protect, adminOnly, mutationLimiter, deleteUser);

// ─── STUDENTS ──────────────────────────────────────────────────────
router.get('/students', protect, getStudents);
router.post('/students', protect, authorize('admin', 'editor'), mutationLimiter, createStudent);
router.delete('/students/bulk', protect, adminOnly, mutationLimiter, bulkDeleteStudents);
router.put('/students/bulk-allocate', protect, adminOnly, mutationLimiter, bulkAllocate);
router.get('/students/staging', protect, authorize('admin', 'editor'), getStagingStudents);
router.post('/students/staging/bulk-approve', protect, adminOnly, mutationLimiter, bulkApproveStagedStudents);
router.post('/students/staging/:id/approve', protect, adminOnly, mutationLimiter, approveStagedStudent);
router.post('/students/staging/:id/reject', protect, adminOnly, mutationLimiter, rejectStagedStudent);
router.get('/students/:id', protect, getStudent);
router.put('/students/:id', protect, adminOnly, mutationLimiter, updateStudent);
router.delete('/students/:id', protect, adminOnly, mutationLimiter, deleteStudent);

// ─── TEACHERS ──────────────────────────────────────────────────────
router.get('/teachers', protect, getTeachers);
router.post('/teachers', protect, authorize('admin', 'editor'), mutationLimiter, createTeacher);
router.get('/teachers/staging', protect, authorize('admin', 'editor'), getStagingTeachers);
router.post('/teachers/staging/bulk-approve', protect, adminOnly, mutationLimiter, bulkApproveStagedTeachers);
router.post('/teachers/staging/:id/approve', protect, adminOnly, mutationLimiter, approveStagedTeacher);
router.post('/teachers/staging/:id/reject', protect, adminOnly, mutationLimiter, rejectStagedTeacher);
router.get('/teachers/:id', protect, getTeacher);
router.put('/teachers/:id', protect, adminOnly, mutationLimiter, updateTeacher);
router.put('/teachers/:id/assign-class', protect, adminOnly, mutationLimiter, assignTeacherToClass);
router.delete('/teachers/:id', protect, adminOnly, mutationLimiter, deleteTeacher);

// ─── VOLUNTEERS ─────────────────────────────────────────────────────
router.get('/volunteers', protect, getVolunteers);
router.post('/volunteers', protect, authorize('admin', 'editor'), mutationLimiter, createVolunteer);
router.get('/volunteers/staging', protect, authorize('admin', 'editor'), getStagingVolunteers);
router.post('/volunteers/staging/bulk-approve', protect, adminOnly, mutationLimiter, bulkApproveStagedVolunteers);
router.post('/volunteers/staging/:id/approve', protect, adminOnly, mutationLimiter, approveStagedVolunteer);
router.post('/volunteers/staging/:id/reject', protect, adminOnly, mutationLimiter, rejectStagedVolunteer);
router.get('/volunteers/:id', protect, getVolunteer);
router.put('/volunteers/:id', protect, adminOnly, mutationLimiter, updateVolunteer);
router.delete('/volunteers/:id', protect, adminOnly, mutationLimiter, deleteVolunteer);

// ─── CLASSES ────────────────────────────────────────────────────────
router.get('/classes', protect, getClasses);
router.post('/classes', protect, adminOnly, mutationLimiter, createClass);
router.get('/classes/:id', protect, getClass);
router.get('/classes/:id/eligible-students', protect, adminOnly, getEligibleStudents);
router.put('/classes/:id', protect, adminOnly, mutationLimiter, updateClass);
router.delete('/classes/:id', protect, adminOnly, mutationLimiter, deleteClass);

// ─── ATTENDANCE ──────────────────────────────────────────────────────
router.get('/attendance/window-status', protect, getWindowStatus);
router.get('/attendance/today-summary', protect, authorize('admin', 'editor', 'viewer'), getTodaySummary);

// CHANGE 2: Added 'editor' to GET student attendance (view submitted records)
router.get('/attendance/students', protect, authorize('admin', 'viewer', 'teacher', 'editor'), getStudentAttendance);

// CHANGE 2: Added 'editor' to POST student attendance (submit within window, no modify)
router.post('/attendance/students', protect, authorize('admin', 'teacher', 'editor'), mutationLimiter, submitStudentAttendance);

router.put('/attendance/students/:id/modify', protect, adminOnly, mutationLimiter, modifyStudentAttendance);
router.delete('/attendance/students/:id', protect, adminOnly, mutationLimiter, deleteStudentAttendance);
router.get('/attendance/teachers', protect, authorize('admin', 'editor', 'viewer', 'teacher'), getTeacherAttendance);
router.post('/attendance/teachers', protect, editorOrAdmin, mutationLimiter, submitTeacherAttendance);
router.put('/attendance/teachers/:id/modify', protect, adminOnly, mutationLimiter, modifyTeacherAttendance);
router.delete('/attendance/teachers/:id', protect, adminOnly, mutationLimiter, deleteTeacherAttendance);
router.get('/attendance/volunteers', protect, authorize('admin', 'editor', 'viewer'), getVolunteerAttendance);
router.post('/attendance/volunteers', protect, editorOrAdmin, mutationLimiter, submitVolunteerAttendance);
router.put('/attendance/volunteers/:id/modify', protect, adminOnly, mutationLimiter, modifyVolunteerAttendance);
router.delete('/attendance/volunteers/:id', protect, adminOnly, mutationLimiter, deleteVolunteerAttendance);

// ─── QR ATTENDANCE ───────────────────────────────────────────────────
router.get('/qr-attendance/sessions', protect, adminOnly, getQRSessions);
router.post('/qr-attendance/sessions', protect, adminOnly, mutationLimiter, createQRSession);
router.post('/qr-attendance/scan', protect, authorize('teacher', 'admin'), mutationLimiter, scanQRCode);
router.post('/qr-attendance/admin-scan', protect, adminOnly, mutationLimiter, adminScanForTeacher);
router.get('/qr-attendance/validate/:token', protect, validateToken);
router.get('/qr-attendance/sessions/:id', protect, adminOnly, getQRSession);
router.put('/qr-attendance/sessions/:id/deactivate', protect, adminOnly, mutationLimiter, deactivateQRSession);

// ─── ANALYTICS ───────────────────────────────────────────────────────
router.get('/analytics/dashboard', protect, authorize('admin', 'viewer'), getDashboardStats);
router.get('/analytics/students', protect, authorize('admin', 'viewer'), getStudentAnalytics);
router.get('/analytics/attendance-trends', protect, authorize('admin', 'viewer'), getAttendanceTrends);
router.get('/analytics/modifications', protect, adminOnly, getModificationsSummary);

// ─── REPORTS ─────────────────────────────────────────────────────────
router.get('/reports/daily', protect, authorize('admin', 'viewer'), getDailyReport);
router.get('/reports/full-year', protect, authorize('admin', 'viewer'), getFullYearReport);
router.get('/reports/villages', protect, authorize('admin', 'viewer'), getVillageList);
router.get('/reports/village', protect, authorize('admin', 'viewer'), getVillageReport);
router.get('/reports/category/:category', protect, authorize('admin', 'viewer'), getCategoryReport);
router.get('/reports/class/:classId', protect, authorize('admin', 'viewer'), getClassReport);
router.get('/reports/student/:studentId', protect, authorize('admin', 'viewer'), getStudentReport);
router.get('/reports/teacher/:teacherId', protect, authorize('admin', 'viewer'), getTeacherReport);
router.get('/reports/volunteer/:volunteerId', protect, authorize('admin', 'viewer'), getVolunteerReport);

// ─── TEACHER EXPORT ──────────────────────────────────────────────────
router.get('/teacher/export-data', protect, authorize('admin', 'teacher'), getTeacherExportData);

// ─── SETTINGS ────────────────────────────────────────────────────────
router.get('/settings', protect, getSettings);
router.get('/settings/active', getActiveSettings);
router.post('/settings', protect, adminOnly, createSettings);
router.put('/settings/:id', protect, adminOnly, updateSettings);
router.put('/settings/:id/activate', protect, adminOnly, activateYear);
router.put('/settings/:id/toggle-window', protect, adminOnly, mutationLimiter, toggleAttendanceWindow);

// ─── NOTIFICATIONS ───────────────────────────────────────────────────
router.get('/notifications', protect, getNotifications);
router.put('/notifications/mark-all-read', protect, mutationLimiter, markAllRead);
router.put('/notifications/:id/read', protect, mutationLimiter, markNotificationRead);
router.post('/notifications/broadcast', protect, adminOnly, mutationLimiter, broadcastNotification);

module.exports = router;
