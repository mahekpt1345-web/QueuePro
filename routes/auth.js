/**
 * AUTH ROUTES
 * Covers:
 *  - API JSON endpoints: /api/auth/*
 *  - EJS form routes: /register, /login, /admin-login, /logout
 *  - OAuth routes: /auth/google, /auth/apple, etc.
 */

const express = require('express');
const router = express.Router();
const passport = require('passport');
const authController = require('../controllers/authController');
const { verifyToken } = require('../middleware/auth');

// ── API JSON Routes ──────────────────────────
router.post('/api/auth/register',        authController.apiRegister);
router.post('/api/auth/login',           authController.apiLogin);
router.post('/api/auth/admin-login',     authController.apiAdminLogin);
router.get( '/api/auth/me',              authController.apiMe);
router.post('/api/auth/logout',          authController.apiLogout);
router.post('/api/auth/change-password', authController.apiChangePassword);

// ── OAuth Routes ─────────────────────────────
// Google OAuth
router.get('/auth/google', 
    passport.authenticate('google', { scope: ['profile', 'email'] })
);

router.get('/auth/google/callback',
    passport.authenticate('google', { failureRedirect: '/register?error=google_auth_failed' }),
    authController.googleCallback
);

// Apple OAuth
router.get('/auth/apple',
    passport.authenticate('apple', { scope: ['name', 'email'] })
);

router.get('/auth/apple/callback',
    passport.authenticate('apple', { failureRedirect: '/register?error=apple_auth_failed' }),
    authController.appleCallback
);

// Phone number management for OAuth users
router.post('/api/auth/phone', verifyToken, authController.updateUserPhone);
router.get('/api/auth/oauth-login-status', verifyToken, authController.getOAuthLoginStatus);

// ── EJS Form Routes ──────────────────────────
router.get( '/register',    authController.showRegister);
router.post('/register',    authController.postRegister);

router.get( '/login',       authController.showLogin);
router.post('/login',       authController.postLogin);

router.get( '/admin-login', authController.showAdminLogin);
router.post('/admin-login', authController.postAdminLogin);

router.get('/logout', authController.logout);

module.exports = router;
