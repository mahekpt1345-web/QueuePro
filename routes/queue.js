/**
 * QUEUE ROUTES
 * All queue-related endpoints — logic lives in controllers/queueController.js
 */

const express = require('express');
const router = express.Router();
const { verifyToken, checkRole } = require('../middleware/auth');
const queueController = require('../controllers/queueController');
const safeHandler = require('../utils/safeHandler');


// ── Citizen Routes ────────────────────────────
router.post('/create-token',          verifyToken,                                safeHandler(queueController.createToken));
router.get( '/my-tokens',             verifyToken,                                safeHandler(queueController.myTokens));
router.put( '/cancel-token/:tokenId', verifyToken,                                safeHandler(queueController.cancelToken));

// ── Officer / Admin Shared ────────────────────
router.get('/pending',                verifyToken, checkRole(['officer', 'admin']), safeHandler(queueController.getPending));
router.get('/pending-tokens',         verifyToken, checkRole(['officer', 'admin']), safeHandler(queueController.getPendingTokens));
router.get('/serving-token',          verifyToken, checkRole(['officer', 'admin']), safeHandler(queueController.getServingToken));
router.get('/statistics',             verifyToken, checkRole(['officer', 'admin']), safeHandler(queueController.getStatistics));

// ── Officer Token Actions ─────────────────────
router.put('/token/:tokenId/serve',    verifyToken, checkRole(['officer', 'admin']), safeHandler(queueController.serveToken));
router.put('/token/:tokenId/complete', verifyToken, checkRole(['officer', 'admin']), safeHandler(queueController.completeToken));
router.put('/token/:tokenId/skip',     verifyToken, checkRole(['officer', 'admin']), safeHandler(queueController.skipToken));

// ── Legacy Endpoints (kept for backwards compat) ──
router.put('/start-serving/:tokenId',  verifyToken, checkRole(['officer', 'admin']), safeHandler(queueController.startServing));
router.put('/complete-token/:tokenId', verifyToken, checkRole(['officer', 'admin']), safeHandler(queueController.completeTokenLegacy));

// ── Profile Data Endpoints ────────────────────
router.get('/officer-stats',    verifyToken, checkRole(['officer', 'admin']), safeHandler(queueController.officerStats));
router.get('/officer-activity', verifyToken, checkRole(['officer', 'admin']), safeHandler(queueController.officerActivity));
router.get('/citizen-stats',    verifyToken, checkRole(['citizen']),          safeHandler(queueController.citizenStats));

// ── NEW: Data fetch for profile migration ────
router.get('/officer-tokens', verifyToken, checkRole(['officer', 'admin']), safeHandler(queueController.getOfficerTokens));
router.get('/citizen-tokens', verifyToken, checkRole(['citizen']),          safeHandler(queueController.getCitizenTokens));
router.get('/user-activity',  verifyToken,                                  safeHandler(queueController.getUserActivity));
router.get('/user-prefs',     verifyToken,                                  safeHandler(queueController.getUserPrefs));
router.post('/user-prefs',    verifyToken,                                  safeHandler(queueController.saveUserPrefs));

// ── Smart Queue Intelligence (NEW - Additive Only) ──────────────────
// These endpoints do NOT replace any existing endpoint.
// They call queueIntelligenceService which uses a short TTL cache.
router.get('/my-position',    verifyToken,                                  safeHandler(queueController.getMyPosition));
router.get('/stats',          safeHandler(queueController.getPublicStats));  // No auth — public snapshot

module.exports = router;
