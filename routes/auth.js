/**
 * AUTH ROUTES
 * Covers:
 *  - API JSON endpoints: /api/auth/*
 *  - EJS form routes: /register, /login, /admin-login, /logout
 */

const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

// ── API JSON Routes ──────────────────────────
router.post('/api/auth/register',        authController.apiRegister);
router.post('/api/auth/login',           authController.apiLogin);
router.post('/api/auth/admin-login',     authController.apiAdminLogin);
router.get( '/api/auth/me',              authController.apiMe);
router.post('/api/auth/logout',          authController.apiLogout);
router.post('/api/auth/change-password', authController.apiChangePassword);

// ── EJS Form Routes ──────────────────────────
router.get( '/register',    authController.showRegister);
router.post('/register',    authController.postRegister);

router.get( '/login',       authController.showLogin);
router.post('/login',       authController.postLogin);

router.get( '/admin-login', authController.showAdminLogin);
router.post('/admin-login', authController.postAdminLogin);

module.exports = router;
