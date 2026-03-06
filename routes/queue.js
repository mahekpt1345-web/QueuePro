/**
 * QUEUE ROUTES
 * All queue-related endpoints — logic lives in controllers/queueController.js
 */

const express = require('express');
const router = express.Router();
const { verifyToken, checkRole } = require('../middleware/auth');
const queueController = require('../controllers/queueController');

// ── Citizen Routes ────────────────────────────
router.post('/create-token',          verifyToken,                                queueController.createToken);
router.get( '/my-tokens',             verifyToken,                                queueController.myTokens);
router.put( '/cancel-token/:tokenId', verifyToken,                                queueController.cancelToken);

// ── Officer / Admin Shared ────────────────────
router.get('/pending',                verifyToken, checkRole(['officer', 'admin']), queueController.getPending);
router.get('/pending-tokens',         verifyToken, checkRole(['officer', 'admin']), queueController.getPendingTokens);
router.get('/serving-token',          verifyToken, checkRole(['officer', 'admin']), queueController.getServingToken);
router.get('/statistics',             verifyToken, checkRole(['officer', 'admin']), queueController.getStatistics);

// ── Officer Token Actions ─────────────────────
router.put('/token/:tokenId/serve',    verifyToken, checkRole(['officer', 'admin']), queueController.serveToken);
router.put('/token/:tokenId/complete', verifyToken, checkRole(['officer', 'admin']), queueController.completeToken);
router.put('/token/:tokenId/skip',     verifyToken, checkRole(['officer', 'admin']), queueController.skipToken);

// ── Legacy Endpoints (kept for backwards compat) ──
router.put('/start-serving/:tokenId',  verifyToken, checkRole(['officer', 'admin']), queueController.startServing);
router.put('/complete-token/:tokenId', verifyToken, checkRole(['officer', 'admin']), queueController.completeTokenLegacy);

// ── Profile Data Endpoints ────────────────────
router.get('/officer-stats',    verifyToken, checkRole(['officer', 'admin']), queueController.officerStats);
router.get('/officer-activity', verifyToken, checkRole(['officer', 'admin']), queueController.officerActivity);
router.get('/citizen-stats',    verifyToken, checkRole(['citizen']),          queueController.citizenStats);

// ── NEW: Data fetch for profile migration ────
router.get('/officer-tokens', verifyToken, checkRole(['officer', 'admin']), queueController.getOfficerTokens);
router.get('/citizen-tokens', verifyToken, checkRole(['citizen']),          queueController.getCitizenTokens);
router.get('/user-activity',  verifyToken,                                  queueController.getUserActivity);
router.get('/user-prefs',     verifyToken,                                  queueController.getUserPrefs);
router.post('/user-prefs',    verifyToken,                                  queueController.saveUserPrefs);

module.exports = router;
