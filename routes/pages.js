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

// ── Public Pages ─────────────────────────────
router.get('/', pageController.home);
router.get('/public-queue-status', pageController.publicQueueStatus);
router.get('/health', pageController.health);
router.get('/api/health', pageController.health);

// ── Citizen (protected) ──────────────────────
router.get('/citizen-dashboard', ensureAuthenticated, ensureRole(['citizen']), pageController.citizenDashboard);
router.get('/citizen-profile', ensureAuthenticated, ensureRole(['citizen']), pageController.citizenProfile);
router.get('/age-selection',   ensureAuthenticated, ensureRole(['citizen']), pageController.ageSelection);
router.get('/engagement-puzzles', ensureAuthenticated, ensureRole(['citizen']), pageController.engagementPuzzles);

// ── Officer (protected) ──────────────────────
router.get('/officer-dashboard', ensureAuthenticated, ensureRole(['officer']), pageController.officerDashboard);
router.get('/officer-profile', ensureAuthenticated, ensureRole(['officer']), pageController.officerProfile);

// ── Support Pages ────────────────────────────
router.get('/about', pageController.about);
router.get('/contact', pageController.showContact);
router.post('/contact', pageController.postContact);
router.get('/help', pageController.help);

module.exports = router;
