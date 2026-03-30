/**
 * ADMIN ROUTES
 * Covers:
 *  - /api/users
 *  - /api/admin/*
 *  - /api/queue/all-tokens (admin only)
 *  - /admin-dashboard, /admin-profile (EJS page renders)
 */

const express = require('express');
const router = express.Router();
const { verifyToken, checkRole } = require('../middleware/auth');
const { ensureAuthenticated, ensureRole } = require('../middleware/auth');
const adminController = require('../controllers/adminController');
const safeHandler = require('../utils/safeHandler');
const { body } = require('express-validator');
const { validate } = require('../utils/validation');

const isAdmin = [verifyToken, checkRole(['admin'])];

const userValidation = [
    body('fullName').notEmpty().withMessage('Full name is required'),
    body('email').isEmail().withMessage('Valid email is required'),
    body('username').isLength({ min: 3 }).withMessage('Username must be at least 3 characters'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
    body('role').isIn(['citizen', 'officer', 'admin']).withMessage('Invalid role'),
    validate
];

// ── User Management ──────────────────────────
router.get('/api/users', ...isAdmin, safeHandler(adminController.getUsers));
router.get('/api/admin/users', ...isAdmin, safeHandler(adminController.adminGetUsers));
router.delete('/api/admin/users/:userId', ...isAdmin, safeHandler(adminController.deleteUser));
router.post('/api/admin/create-user', ...isAdmin, ...userValidation, safeHandler(adminController.createUser));

// ── Analytics & Logs ─────────────────────────
router.get('/api/admin/analytics', ...isAdmin, safeHandler(adminController.getAnalytics));
router.get('/api/admin/filter', ...isAdmin, safeHandler(adminController.getFilteredData));
router.get('/api/admin/activity-logs', ...isAdmin, safeHandler(adminController.getActivityLogs));

// ── Settings ─────────────────────────────────
router.get('/api/admin/settings', ...isAdmin, safeHandler(adminController.getSettings));
router.put('/api/admin/settings', ...isAdmin, safeHandler(adminController.updateSettings));
router.get('/api/admin/config', verifyToken, safeHandler(adminController.getSystemConfig));
router.post('/api/admin/config', ...isAdmin, safeHandler(adminController.updateSystemConfig));

// ── Profile data ─────────────────────────────
router.get('/api/admin/profile-stats', ...isAdmin, safeHandler(adminController.getProfileStats));
router.get('/api/admin/profile-activity', ...isAdmin, safeHandler(adminController.getProfileActivity));

// ── All tokens (admin view) ───────────────────
router.get('/api/queue/all-tokens', ...isAdmin, safeHandler(adminController.getAllTokens));

// ── EJS Page Renders (protected) ─────────────
router.get('/admin-dashboard', ensureAuthenticated, ensureRole(['admin']), safeHandler(adminController.showDashboard));
router.get('/admin-profile', ensureAuthenticated, ensureRole(['admin']), safeHandler(adminController.showProfile));

module.exports = router;
