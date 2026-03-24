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

// ── API JSON Routes ──────────────────────────
router.post('/api/auth/register', authValidation.register, authController.apiRegister);
router.post('/api/auth/login', authValidation.login, authController.apiLogin);
router.post('/api/auth/admin-login', authController.apiAdminLogin);
router.get('/api/auth/me', authController.apiMe);
router.post('/api/auth/logout', authController.apiLogout);
router.post('/api/auth/change-password', authController.apiChangePassword);

// phone number management logic removed as it was for OAuth users.

// ── EJS Form Routes ──────────────────────────
router.get('/register', authController.showRegister);
router.post('/register', authValidation.register, authController.postRegister);

router.get('/login', authController.showLogin);
router.post('/login', authValidation.login, authController.postLogin);

router.get('/admin-login', authController.showAdminLogin);
router.post('/admin-login', authController.postAdminLogin);

router.get('/logout', authController.logout);

module.exports = router;
