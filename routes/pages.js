/**
 * PAGE ROUTES
 * Covers:
 *  - / (home)
 *  - /health, /api/health
 *  - Citizen dashboard & profile
 *  - Officer dashboard & profile
 *  - Support pages: /about, /contact, /help
 */

const express = require('express');
const router = express.Router();
const { ensureAuthenticated, ensureRole } = require('../middleware/auth');
const pageController = require('../controllers/pageController');
const safeHandler = require('../utils/safeHandler');

// ── Public Pages ─────────────────────────────
router.get('/', safeHandler(pageController.home));
router.get('/public-queue-status', safeHandler(pageController.publicQueueStatus));
router.get('/health', safeHandler(pageController.health));
router.get('/api/health', safeHandler(pageController.health));

// ── Citizen (protected) ──────────────────────
router.get('/citizen-dashboard', ensureAuthenticated, ensureRole(['citizen']), safeHandler(pageController.citizenDashboard));
router.get('/citizen-profile', ensureAuthenticated, ensureRole(['citizen']), safeHandler(pageController.citizenProfile));
router.get('/age-selection',   ensureAuthenticated, ensureRole(['citizen']), safeHandler(pageController.ageSelection));
router.get('/engagement-puzzles', ensureAuthenticated, ensureRole(['citizen']), safeHandler(pageController.engagementPuzzles));

// ── Officer (protected) ──────────────────────
router.get('/officer-dashboard', ensureAuthenticated, ensureRole(['officer']), safeHandler(pageController.officerDashboard));
router.get('/officer-profile', ensureAuthenticated, ensureRole(['officer']), safeHandler(pageController.officerProfile));

// ── Support Pages ────────────────────────────
router.get('/about', safeHandler(pageController.about));
router.get('/contact', safeHandler(pageController.showContact));
router.post('/contact', safeHandler(pageController.postContact));
router.get('/help', safeHandler(pageController.help));

module.exports = router;
