const express = require('express');
const router = express.Router();
const engagementController = require('../controllers/engagementController');
const { verifyToken, checkRole } = require('../middleware/auth');

/**
 * PUBLIC/USER ROUTES
 */

// Fetch random engagement content
router.get('/content', verifyToken, engagementController.getContent);
router.get('/puzzle', verifyToken, engagementController.getRandomPuzzle);
router.get('/reading', verifyToken, engagementController.getRandomReading);

/**
 * ADMIN ROUTES
 */
router.post('/puzzle', verifyToken, checkRole(['admin']), engagementController.addPuzzle);
router.post('/reading', verifyToken, checkRole(['admin']), engagementController.addReading);

module.exports = router;
