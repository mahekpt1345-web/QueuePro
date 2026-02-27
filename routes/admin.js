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

const isAdmin = [verifyToken, checkRole(['admin'])];

// ── User Management ──────────────────────────
router.get(   '/api/users',                    ...isAdmin, adminController.getUsers);
router.get(   '/api/admin/users',              ...isAdmin, adminController.adminGetUsers);
router.delete('/api/admin/users/:userId',      ...isAdmin, adminController.deleteUser);
router.post(  '/api/admin/create-user',        ...isAdmin, adminController.createUser);

// ── Analytics & Logs ─────────────────────────
router.get('/api/admin/analytics',             ...isAdmin, adminController.getAnalytics);
router.get('/api/admin/activity-logs',         ...isAdmin, adminController.getActivityLogs);

// ── Settings ─────────────────────────────────
router.get('/api/admin/settings',              ...isAdmin, adminController.getSettings);
router.put('/api/admin/settings',              ...isAdmin, adminController.updateSettings);

// ── Profile data ─────────────────────────────
router.get('/api/admin/profile-stats',         ...isAdmin, adminController.getProfileStats);
router.get('/api/admin/profile-activity',      ...isAdmin, adminController.getProfileActivity);

// ── All tokens (admin view) ───────────────────
router.get('/api/queue/all-tokens',            ...isAdmin, adminController.getAllTokens);

// ── EJS Page Renders (protected) ─────────────
router.get('/admin-dashboard', ensureAuthenticated, ensureRole(['admin']), adminController.showDashboard);
router.get('/admin-profile',   ensureAuthenticated, ensureRole(['admin']), adminController.showProfile);

module.exports = router;
