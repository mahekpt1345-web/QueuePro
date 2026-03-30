/**
 * AUTH ROUTES
 * Covers:
 *  - API JSON endpoints: /api/auth/*
 *  - EJS form routes: /register, /login, /admin-login, /logout
 *  - OAuth routes: /auth/google, etc.
 */

const express = require('express');
const router = express.Router();

const authController = require('../controllers/authController');
const { verifyToken } = require('../middleware/auth');
const { authValidation } = require('../utils/validation');
const safeHandler = require('../utils/safeHandler');

// ── API JSON Routes ──────────────────────────
router.post('/api/auth/register', authValidation.register, safeHandler(authController.apiRegister));
router.post('/api/auth/login', authValidation.login, safeHandler(authController.apiLogin));
router.post('/api/auth/admin-login', safeHandler(authController.apiAdminLogin));
router.get('/api/auth/me', safeHandler(authController.apiMe));
router.post('/api/auth/logout', safeHandler(authController.apiLogout));
router.post('/api/auth/change-password', safeHandler(authController.apiChangePassword));
router.post('/api/auth/fcm-token', verifyToken, safeHandler(authController.saveFcmToken));

// phone number management logic removed as it was for OAuth users.

// ── EJS Form Routes ──────────────────────────
router.get('/register', safeHandler(authController.showRegister));
router.post('/register', authValidation.register, safeHandler(authController.postRegister));

router.get('/login', safeHandler(authController.showLogin));
router.post('/login', authValidation.login, safeHandler(authController.postLogin));

router.get('/admin-login', safeHandler(authController.showAdminLogin));
router.post('/admin-login', safeHandler(authController.postAdminLogin));

router.get('/logout', safeHandler(authController.logout));

module.exports = router;
