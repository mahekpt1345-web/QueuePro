const express = require('express');
const router = express.Router();
const engagementController = require('../controllers/engagementController');
const { verifyToken, checkRole } = require('../middleware/auth');
const safeHandler = require('../utils/safeHandler');

/**
 * PUBLIC/USER ROUTES
 */

// Fetch random engagement content
router.get('/content', verifyToken, safeHandler(engagementController.getContent));
router.get('/puzzle', verifyToken, safeHandler(engagementController.getRandomPuzzle));
router.get('/reading', verifyToken, safeHandler(engagementController.getRandomReading));

/**
 * ADMIN ROUTES
 */
router.post('/puzzle', verifyToken, checkRole(['admin']), safeHandler(engagementController.addPuzzle));
router.post('/reading', verifyToken, checkRole(['admin']), safeHandler(engagementController.addReading));

module.exports = router;
