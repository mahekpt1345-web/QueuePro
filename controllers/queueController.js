/**
 * QUEUE CONTROLLER
 * Handles all queue-related logic:
 * - Citizen: createToken, myTokens, cancelToken
 * - Officer: pendingTokens, servingToken, serve, complete, skip
 * - Shared: pending, statistics
 * - Profile data: officerStats, officerActivity, citizenStats
 */

const Token = require('../models/Token');
const User = require('../models/User');
const ActivityLog = require('../models/ActivityLog');
const { logActivity } = require('../middleware/auth');
const { SERVICE_TYPES } = require('../utils/serviceConfig');
const queueService = require('../services/queueService');
const response = require('../utils/response');

/**
 * createToken (citizen)
 */
exports.createToken = async (req, res) => {
    try {
        const { serviceType, checklistConfirmed } = req.body;

        if (!serviceType || !SERVICE_TYPES.includes(serviceType)) {
            return response.error(res, 'Invalid service type', 400);
        }

        if (!checklistConfirmed) {
            return response.error(res, 'Document checklist must be confirmed', 400);
        }

        const { token, pendingCount } = await queueService.createToken(
            req.body, 
            req.user, 
            req.ip, 
            { get: (h) => req.get(h) }
        );

        // Crowd level calculated in controller for response (to keep service pure)
        let crowdLevel = "Low";
        if (pendingCount > 10 && pendingCount <= 25) crowdLevel = "Moderate";
        else if (pendingCount > 25) crowdLevel = "High";

        // Emit socket update via service
        await queueService.emitQueueUpdate(req.app.get('io'));

        return res.status(201).json({
            success: true,
            message: 'Token created successfully',
            data: token,
            token: token,
            crowdLevel
        });
    } catch (error) {
        console.error('Error creating token:', error);
        return response.error(res, 'Failed to create token', 500);
    }
};

// ─────────────────────────────────────────────
// GET /api/queue/my-tokens  (citizen)
// ─────────────────────────────────────────────
exports.myTokens = async (req, res) => {
    try {
        const mongoose = require('mongoose');
        const query = mongoose.Types.ObjectId.isValid(req.user.userId) ? { userId: req.user.userId } : { _id: null };
        const tokens = await Token.find(query).sort({ createdAt: -1 });
        res.json({ success: true, message: `Found ${tokens.length} tokens`, data: tokens });
    } catch (error) {
        console.error('Error fetching tokens:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch tokens' });
    }
};

// ─────────────────────────────────────────────
// PUT /api/queue/cancel-token/:tokenId  (citizen)
// ─────────────────────────────────────────────
/**
 * cancelToken (citizen)
 */
exports.cancelToken = async (req, res) => {
    try {
        const { tokenId } = req.params;
        const { reason } = req.body;

        const token = await queueService.cancelToken(
            tokenId, 
            req.user.userId, 
            reason, 
            req.ip, 
            { get: (h) => req.get(h) }
        );

        await queueService.emitQueueUpdate(req.app.get('io'));

        return res.json({ success: true, message: 'Token cancelled successfully', data: token });
    } catch (error) {
        console.error('Error cancelling token:', error.message);
        return res.status(error.message.includes('not found') ? 404 : 403).json({ 
            success: false, 
            message: error.message 
        });
    }
};

// ─────────────────────────────────────────────
// GET /api/queue/pending  (officer/admin)
// ─────────────────────────────────────────────
exports.getPending = async (req, res) => {
    try {
        const tokens = await Token.find({ status: 'pending' }).sort({ position: 1 }).limit(20);
        res.json({ success: true, message: `Found ${tokens.length} pending tokens`, data: tokens });
    } catch (error) {
        console.error('Error fetching pending tokens:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch pending tokens' });
    }
};

// ─────────────────────────────────────────────
// GET /api/queue/pending-tokens  (officer/admin)
// ─────────────────────────────────────────────
exports.getPendingTokens = async (req, res) => {
    try {
        const pendingTokens = await Token.find({ status: 'pending' })
            .select('_id tokenId userId username userName serviceType description status createdAt estimatedWaitTime position')
            .sort({ createdAt: 1 })
            .lean();
        res.json({ success: true, data: pendingTokens, count: pendingTokens.length });
    } catch (error) {
        console.error('[OFFICER API] Error fetching pending tokens:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch pending tokens' });
    }
};

// ─────────────────────────────────────────────
// GET /api/queue/serving-token  (officer/admin)
// ─────────────────────────────────────────────
exports.getServingToken = async (req, res) => {
    try {
        const servingToken = await Token.findOne({ status: 'serving' })
            .select('_id tokenId userId username userName serviceType description status createdAt startedAt handledBy')
            .lean();
        res.json({ success: true, data: servingToken || null });
    } catch (error) {
        console.error('[OFFICER API] Error fetching serving token:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch serving token' });
    }
};

/**
 * serveToken (officer/admin)
 */
exports.serveToken = async (req, res) => {
    try {
        const { tokenId } = req.params;
        const officer = { 
            userId: req.user.userId, 
            username: req.user.username, 
            role: req.user.role 
        };

        const token = await queueService.serveToken(
            tokenId, 
            officer, 
            req.ip, 
            { get: (h) => req.get(h) }
        );

        // Notify via service
        const io = req.app.get('io');
        if (io) {
            io.to(`token_${token._id}`).emit('token_called', {
                type: 'serving',
                message: '🔔 You are now being served. Please proceed to the counter.',
                tokenId: token.tokenId,
                handledBy: officer.username
            });
        }

        await queueService.emitQueueUpdate(io);

        return res.json({ success: true, message: `Now serving token ${token.tokenId}`, data: token });
    } catch (error) {
        console.error('[OFFICER API] Error serving token:', error.message);
        return res.status(error.message.includes('not found') ? 404 : 400).json({ 
            success: false, 
            message: error.message 
        });
    }
};

// ─────────────────────────────────────────────
// PUT /api/queue/token/:tokenId/complete  (officer/admin)
// ─────────────────────────────────────────────
/**
 * completeToken (officer/admin)
 */
exports.completeToken = async (req, res) => {
    try {
        const { tokenId } = req.params;
        const officer = { 
            userId: req.user.userId, 
            username: req.user.username, 
            role: req.user.role 
        };

        const token = await queueService.completeToken(
            tokenId, 
            officer, 
            req.ip, 
            { get: (h) => req.get(h) }
        );

        await queueService.emitQueueUpdate(req.app.get('io'));

        return res.json({ success: true, message: `Token ${token.tokenId} completed`, data: token });
    } catch (error) {
        console.error('[OFFICER API] Error completing token:', error.message);
        return res.status(error.message.includes('not found') ? 404 : 400).json({ 
            success: false, 
            message: error.message 
        });
    }
};

// ─────────────────────────────────────────────
// PUT /api/queue/token/:tokenId/skip  (officer/admin)
// ─────────────────────────────────────────────
exports.skipToken = async (req, res) => {
    try {
        const { tokenId } = req.params;

        let token = null;
        if (tokenId.length === 24) token = await Token.findById(tokenId);
        if (!token) token = await Token.findOne({ tokenId });

        if (!token) return res.status(404).json({ success: false, message: 'Token not found' });
        if (token.status !== 'serving')
            return res.status(400).json({ success: false, message: `Can only skip serving tokens. Current: ${token.status}` });

        token.status = 'pending';
        token.handledBy = null;
        token.startedAt = null;
        await token.save();

        await logActivity('SKIP_TOKEN', `Token ${token.tokenId} returned to pending queue`, 'TOKEN', req.user.userId, 'success', null, {
            user: { _id: req.user.userId, username: req.user.username, role: req.user.role },
            ip: req.ip, get: (header) => req.get(header)
        });
        await logActivity('TOKEN_SKIPPED', `Token ${token.tokenId} skipped by ${req.user.username}`, 'TOKEN', req.user.userId, 'success', null, {
            user: { _id: req.user.userId, username: req.user.username, role: req.user.role },
            ip: req.ip, get: (header) => req.get(header)
        });

        await queueService.emitQueueUpdate(req.app.get('io'));

        res.json({ success: true, message: `Token ${token.tokenId} returned to pending queue`, data: token });
    } catch (error) {
        console.error('[OFFICER API] Error skipping token:', error);
        res.status(500).json({ success: false, message: 'Failed to skip token' });
    }
};

// ─────────────────────────────────────────────
// PUT /api/queue/start-serving/:tokenId  (legacy)
// ─────────────────────────────────────────────
exports.startServing = async (req, res) => {
    try {
        const token = await Token.findById(req.params.tokenId);
        if (!token) return res.status(404).json({ success: false, message: 'Token not found' });
        if (token.status !== 'pending')
            return res.status(400).json({ success: false, message: `Token is already ${token.status}` });

        token.status = 'serving';
        token.handledBy = req.user.username;
        token.startedAt = new Date();
        await token.save();

        await logActivity('SERVE_TOKEN', `Started serving token ${token.tokenId} (Legacy)`, 'TOKEN', req.user.userId, 'success', null, {
            user: { _id: req.user.userId, username: req.user.username, role: req.user.role },
            ip: req.ip, get: (header) => req.get(header)
        });
        await logActivity('TOKEN_SERVED', `Started serving token ${token.tokenId} (Legacy)`, 'TOKEN', req.user.userId, 'success', null, {
            user: { _id: req.user.userId, username: req.user.username, role: req.user.role },
            ip: req.ip, get: (header) => req.get(header)
        });

        await queueService.emitQueueUpdate(req.app.get('io'));

        res.json({ success: true, message: 'Token status updated to serving', data: token });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to start serving token' });
    }
};

// ─────────────────────────────────────────────
// PUT /api/queue/complete-token/:tokenId  (legacy)
// ─────────────────────────────────────────────
exports.completeTokenLegacy = async (req, res) => {
    try {
        const token = await Token.findById(req.params.tokenId);
        if (!token) return res.status(404).json({ success: false, message: 'Token not found' });
        if (token.status !== 'serving')
            return res.status(400).json({ success: false, message: 'Token must be in serving status' });

        token.status = 'completed';
        token.completedAt = new Date();
        await token.save();

        await logActivity('COMPLETE_TOKEN', `Token ${token.tokenId} marked as completed (Legacy)`, 'TOKEN', req.user.userId, 'success', null, {
            user: { _id: req.user.userId, username: req.user.username, role: req.user.role },
            ip: req.ip, get: (header) => req.get(header)
        });
        await logActivity('TOKEN_COMPLETED', `Token ${token.tokenId} completed by ${req.user.username} (Legacy)`, 'TOKEN', req.user.userId, 'success', null, {
            user: { _id: req.user.userId, username: req.user.username, role: req.user.role },
            ip: req.ip, get: (header) => req.get(header)
        });

        await queueService.emitQueueUpdate(req.app.get('io'));

        res.json({ success: true, message: 'Token marked as completed', data: token });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to complete token' });
    }
};

// ─────────────────────────────────────────────
// GET /api/queue/statistics  (officer/admin)
// ─────────────────────────────────────────────
/**
 * getStatistics (officer/admin)
 */
exports.getStatistics = async (req, res) => {
    try {
        const stats = await queueService.getStatistics();
        return res.json({
            success: true,
            message: 'Queue statistics retrieved',
            data: stats
        });
    } catch (error) {
        console.error('Error fetching statistics:', error);
        return response.error(res, 'Failed to fetch statistics', 500);
    }
};

// ─────────────────────────────────────────────
// GET /api/queue/officer-stats  (officer/admin)
// ─────────────────────────────────────────────
exports.officerStats = async (req, res) => {
    try {
        const officerUsername = req.user.username;
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);

        const completedToday = await Token.find({
            handledBy: officerUsername,
            status: 'completed',
            completedAt: { $gte: todayStart }
        }).select('startedAt completedAt').lean();

        const tokensToday = completedToday.length;
        let avgServiceTime = null;

        if (tokensToday > 0) {
            const totalMs = completedToday.reduce((sum, t) => {
                if (t.startedAt && t.completedAt) return sum + (new Date(t.completedAt) - new Date(t.startedAt));
                return sum;
            }, 0);
            const validTokens = completedToday.filter(t => t.startedAt && t.completedAt).length;
            if (validTokens > 0) avgServiceTime = Math.round(totalMs / validTokens / (1000 * 60));
        }

        res.json({ success: true, data: { tokensToday, avgServiceTime } });
    } catch (error) {
        console.error('[OFFICER STATS] Error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch officer stats' });
    }
};

// ─────────────────────────────────────────────
// GET /api/queue/officer-activity  (officer/admin)
// ─────────────────────────────────────────────
exports.officerActivity = async (req, res) => {
    try {
        const mongoose = require('mongoose');
        const query = mongoose.Types.ObjectId.isValid(req.user.userId) ? { userId: req.user.userId } : { _id: null };
        const logs = await ActivityLog.find(query)
            .sort({ createdAt: -1 })
            .limit(10)
            .lean();
        res.json({ success: true, data: logs });
    } catch (error) {
        console.error('[OFFICER ACTIVITY] Error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch activity log' });
    }
};

// ─────────────────────────────────────────────
// GET /api/queue/citizen-stats  (citizen)
// ─────────────────────────────────────────────
exports.citizenStats = async (req, res) => {
    try {
        const mongoose = require('mongoose');
        const userId = req.user.userId;
        const query = mongoose.Types.ObjectId.isValid(userId) ? { userId } : { _id: null };

        const [allTokens, completed, pending] = await Promise.all([
            Token.find(query).select('status actualWaitTime createdAt completedAt serviceType tokenId').lean(),
            Token.countDocuments({ ...query, status: 'completed' }),
            Token.countDocuments({ ...query, status: { $in: ['pending', 'serving'] } })
        ]);

        const completedTokens = allTokens.filter(t => t.status === 'completed' && t.actualWaitTime != null);
        let avgWaitTime = null;
        if (completedTokens.length > 0) {
            const total = completedTokens.reduce((s, t) => s + t.actualWaitTime, 0);
            avgWaitTime = Math.round(total / completedTokens.length);
        }

        res.json({
            success: true,
            data: { total: allTokens.length, completed, pending, avgWaitTime, tokens: allTokens }
        });
    } catch (error) {
        console.error('[CITIZEN STATS] Error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch citizen stats' });
    }
};

// ─────────────────────────────────────────────
// GET /api/queue/officer-tokens  (officer/admin)
// Return all tokens handled by this officer for profile display
// ─────────────────────────────────────────────
exports.getOfficerTokens = async (req, res) => {
    try {
        const officerUsername = req.user.username;
        
        const tokens = await Token.find({ handledBy: officerUsername })
            .select('_id tokenId userId userName serviceType status createdAt startedAt completedAt actualWaitTime handledBy')
            .sort({ createdAt: -1 })
            .lean();

        res.json({
            success: true,
            message: `Found ${tokens.length} tokens handled by officer`,
            data: tokens
        });
    } catch (error) {
        console.error('[OFFICER TOKENS] Error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch officer tokens' });
    }
};

// ─────────────────────────────────────────────
// GET /api/queue/citizen-tokens  (citizen)
// Return all tokens created by this citizen for profile display
// ─────────────────────────────────────────────
exports.getCitizenTokens = async (req, res) => {
    try {
        const mongoose = require('mongoose');
        const userId = req.user.userId;
        const query = mongoose.Types.ObjectId.isValid(userId) ? { userId } : { _id: null };
        
        const tokens = await Token.find(query)
            .select('_id tokenId userId userName serviceType description status createdAt completedAt actualWaitTime cancelReason')
            .sort({ createdAt: -1 })
            .lean();

        res.json({
            success: true,
            message: `Found ${tokens.length} tokens created by citizen`,
            data: tokens
        });
    } catch (error) {
        console.error('[CITIZEN TOKENS] Error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch citizen tokens' });
    }
};

// ─────────────────────────────────────────────
// GET /api/queue/user-activity  (citizen/officer/admin)
// Return activity logs for the authenticated user
// ─────────────────────────────────────────────
exports.getUserActivity = async (req, res) => {
    try {
        const mongoose = require('mongoose');
        const userId = req.user.userId;
        const query = mongoose.Types.ObjectId.isValid(userId) ? { userId } : { _id: null };
        
        const limit = req.query.limit ? parseInt(req.query.limit) : 50;
        
        const logs = await ActivityLog.find(query)
            .select('_id userId username userRole action details resourceType status createdAt')
            .sort({ createdAt: -1 })
            .limit(limit)
            .lean();

        res.json({
            success: true,
            message: `Found ${logs.length} activity logs for user`,
            data: logs
        });
    } catch (error) {
        console.error('[USER ACTIVITY] Error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch user activity logs' });
    }
};

// ─────────────────────────────────────────────
// GET /api/queue/user-prefs  (citizen/officer/admin)
// Get user notification preferences from User model
// ─────────────────────────────────────────────
exports.getUserPrefs = async (req, res) => {
    try {
        const User = require('../models/User');
        if (req.user.userId === 'admin_001') {
             return res.json({
                success: true,
                message: 'Admin session (default prefs)',
                data: { emailNotif: true, queueNotif: true, announceNotif: true, promoNotif: false }
            });
        }
        const user = await User.findById(req.user.userId).select('preferences').lean();
        
        const prefs = user?.preferences || {
            emailNotif: true,
            queueNotif: true,
            announceNotif: true,
            promoNotif: false
        };

        res.json({
            success: true,
            message: 'User preferences retrieved',
            data: prefs
        });
    } catch (error) {
        console.error('[USER PREFS GET] Error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch user preferences' });
    }
};

// ─────────────────────────────────────────────
// POST /api/queue/user-prefs  (citizen/officer/admin)
// Save user notification preferences to User model
// ─────────────────────────────────────────────
exports.saveUserPrefs = async (req, res) => {
    try {
        const User = require('../models/User');
        const { emailNotif, queueNotif, announceNotif, promoNotif } = req.body;
        
        if (req.user.userId === 'admin_001') {
            return res.json({ success: true, message: 'Preferences saved (Admin Local Only)' });
        }
        const user = await User.findById(req.user.userId);
        if (!user) return res.status(404).json({ success: false, message: 'User not found' });

        user.preferences = {
            emailNotif: emailNotif !== false,
            queueNotif: queueNotif !== false,
            announceNotif: announceNotif !== false,
            promoNotif: promoNotif === true
        };

        await user.save();

        await logActivity('UPDATE_PREFERENCES', 'User updated notification preferences', 'USER', req.user.userId, 'success', null, {
            user: { _id: req.user.userId, username: req.user.username, role: req.user.role },
            ip: req.ip, get: (header) => req.get(header)
        });

        res.json({
            success: true,
            message: 'Preferences saved successfully',
            data: user.preferences
        });
    } catch (error) {
        console.error('[USER PREFS SAVE] Error:', error);
        res.status(500).json({ success: false, message: 'Failed to save user preferences' });
    }
};

// ─────────────────────────────────────────────
// GET /api/queue/my-position  (citizen)
// Returns the citizen's live queue position + ETA for their pending token.
// Uses queueIntelligenceService (cached, non-blocking).
// ─────────────────────────────────────────────
exports.getMyPosition = async (req, res) => {
    try {
        const queueIntelligence = require('../services/queueIntelligenceService');
        const mongoose = require('mongoose');
        const userId = req.user.userId;

        // Find the citizen's most recent pending token
        const query = mongoose.Types.ObjectId.isValid(userId)
            ? { userId, status: 'pending' }
            : { _id: null }; // admin_001 safe fallback

        const myToken = await Token.findOne(query).sort({ createdAt: -1 }).lean();

        if (!myToken) {
            return res.json({
                success: true,
                message: 'No pending token found',
                data: null
            });
        }

        const positionData = await queueIntelligence.getTokenPosition(
            myToken._id.toString(),
            userId
        );

        return res.json({
            success: true,
            message: positionData ? 'Position retrieved' : 'Token not in queue',
            data: positionData
        });
    } catch (error) {
        console.error('[MY POSITION] Error:', error);
        res.status(500).json({ success: false, message: 'Failed to get queue position' });
    }
};

// ─────────────────────────────────────────────
// GET /api/queue/stats  (public — no auth required)
// Returns a real-time public queue snapshot.
// Uses queueIntelligenceService (cached, non-blocking).
// ─────────────────────────────────────────────
exports.getPublicStats = async (req, res) => {
    try {
        const queueIntelligence = require('../services/queueIntelligenceService');
        const snapshot = await queueIntelligence.getQueueSnapshot();
        return res.json({ success: true, data: snapshot });
    } catch (error) {
        console.error('[PUBLIC STATS] Error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch queue stats' });
    }
};
