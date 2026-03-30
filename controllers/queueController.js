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
const socketEnhancer = require('../utils/socketEnhancer');
const queueIntelligenceService = require('../services/queueIntelligenceService');

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

        let crowdLevel = "Low";
        if (pendingCount > 10 && pendingCount <= 25) crowdLevel = "Moderate";
        else if (pendingCount > 25) crowdLevel = "High";

        await queueService.emitQueueUpdate(req.app.get('io'));
        socketEnhancer.emitQueueUpdated(req.app.get('io'));
        
        queueIntelligenceService.getBasicQueueAnalytics().then(analytics => {
            console.log(`[Queue Intelligence] Total tokens served globally: ${analytics.totalTokensServed}`);
        }).catch(() => {});

        return res.status(201).json({
            success: true,
            message: 'Token created successfully',
            data: token,
            token: token,
            crowdLevel
        });
    } catch (error) {
        console.error('Error creating token:', error);
        const statusCode = error.code === 11000 ? 409 : 500;
        const message = error.message || 'Failed to create token';
        return response.error(res, message, statusCode);
    }
};

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
        socketEnhancer.emitQueueUpdated(req.app.get('io'));

        return res.json({ success: true, message: 'Token cancelled successfully', data: token });
    } catch (error) {
        console.error('Error cancelling token:', error.message);
        return res.status(error.message.includes('not found') ? 404 : 403).json({ 
            success: false, 
            message: error.message 
        });
    }
};

exports.getPending = async (req, res) => {
    try {
        const tokens = await Token.find({ status: 'pending' }).sort({ position: 1 }).limit(20);
        res.json({ success: true, message: `Found ${tokens.length} pending tokens`, data: tokens });
    } catch (error) {
        console.error('Error fetching pending tokens:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch pending tokens' });
    }
};

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
        socketEnhancer.emitQueueUpdated(io);
        socketEnhancer.emitTokenCalled(io, token, officer);

        return res.json({ success: true, message: `Now serving token ${token.tokenId}`, data: token });
    } catch (error) {
        console.error('[OFFICER API] Error serving token:', error.message);
        return res.status(error.message.includes('not found') ? 404 : 400).json({ 
            success: false, 
            message: error.message 
        });
    }
};

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
        socketEnhancer.emitQueueUpdated(req.app.get('io'));

        return res.json({ success: true, message: `Token ${token.tokenId} completed`, data: token });
    } catch (error) {
        console.error('[OFFICER API] Error completing token:', error.message);
        return res.status(error.message.includes('not found') ? 404 : 400).json({ 
            success: false, 
            message: error.message 
        });
    }
};

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

        const officer = { userId: req.user.userId, username: req.user.username, role: req.user.role };
        await logActivity('SKIP_TOKEN', `Token ${token.tokenId} returned to pending queue`, 'TOKEN', req.user.userId, 'success', null, {
            user: officer, ip: req.ip, get: (h) => req.get(h)
        });

        await queueService.emitQueueUpdate(req.app.get('io'));
        socketEnhancer.emitQueueUpdated(req.app.get('io'));

        res.json({ success: true, message: `Token ${token.tokenId} returned to pending queue`, data: token });
    } catch (error) {
        console.error('[OFFICER API] Error skipping token:', error);
        res.status(500).json({ success: false, message: 'Failed to skip token' });
    }
};

exports.startServing = async (req, res) => {
    try {
        const token = await Token.findById(req.params.tokenId);
        if (!token) return res.status(404).json({ success: false, message: 'Token not found' });
        token.status = 'serving';
        token.handledBy = req.user.username;
        token.startedAt = new Date();
        await token.save();
        await queueService.emitQueueUpdate(req.app.get('io'));
        res.json({ success: true, message: 'Token status updated to serving', data: token });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to start serving token' });
    }
};

exports.completeTokenLegacy = async (req, res) => {
    try {
        const token = await Token.findById(req.params.tokenId);
        if (!token) return res.status(404).json({ success: false, message: 'Token not found' });
        token.status = 'completed';
        token.completedAt = new Date();
        await token.save();
        await queueService.emitQueueUpdate(req.app.get('io'));
        res.json({ success: true, message: 'Token marked as completed', data: token });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to complete token' });
    }
};

exports.getStatistics = async (req, res) => {
    try {
        const stats = await queueService.getStatistics();
        return res.json({ success: true, message: 'Queue statistics retrieved', data: stats });
    } catch (error) {
        console.error('Error fetching statistics:', error);
        return res.status(500).json({ success: false, message: 'Failed to fetch statistics' });
    }
};

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
            const valid = completedToday.filter(t => t.startedAt && t.completedAt).length;
            if (valid > 0) avgServiceTime = Math.round(totalMs / valid / 60000);
        }
        res.json({ success: true, data: { tokensToday, avgServiceTime } });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to fetch officer stats' });
    }
};

exports.officerActivity = async (req, res) => {
    try {
        const mongoose = require('mongoose');
        const query = mongoose.Types.ObjectId.isValid(req.user.userId) ? { userId: req.user.userId } : { _id: null };
        const logs = await ActivityLog.find(query).sort({ createdAt: -1 }).limit(10).lean();
        res.json({ success: true, data: logs });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to fetch activity log' });
    }
};

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
        res.json({ success: true, data: { total: allTokens.length, completed, pending, avgWaitTime, tokens: allTokens } });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to fetch citizen stats' });
    }
};

exports.getOfficerTokens = async (req, res) => {
    try {
        const tokens = await Token.find({ handledBy: req.user.username })
            .select('_id tokenId userId userName serviceType status createdAt startedAt completedAt actualWaitTime handledBy')
            .sort({ createdAt: -1 }).lean();
        res.json({ success: true, data: tokens });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to fetch officer tokens' });
    }
};

exports.getCitizenTokens = async (req, res) => {
    try {
        const mongoose = require('mongoose');
        const userId = req.user.userId;
        const query = mongoose.Types.ObjectId.isValid(userId) ? { userId } : { _id: null };
        const tokens = await Token.find(query).sort({ createdAt: -1 }).lean();
        res.json({ success: true, data: tokens });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to fetch citizen tokens' });
    }
};

exports.getUserActivity = async (req, res) => {
    try {
        const mongoose = require('mongoose');
        const userId = req.user.userId;
        const query = mongoose.Types.ObjectId.isValid(userId) ? { userId } : { _id: null };
        const logs = await ActivityLog.find(query).sort({ createdAt: -1 }).limit(parseInt(req.query.limit) || 50).lean();
        res.json({ success: true, data: logs });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to fetch activity logs' });
    }
};

exports.getUserPrefs = async (req, res) => {
    try {
        const User = require('../models/User');
        if (req.user.userId === 'admin_001') {
            return res.json({ success: true, data: { emailNotif: true, queueNotif: true, announceNotif: true, promoNotif: false } });
        }
        const user = await User.findById(req.user.userId).select('preferences').lean();
        res.json({ success: true, data: user?.preferences || { emailNotif: true, queueNotif: true, announceNotif: true, promoNotif: false } });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to fetch preferences' });
    }
};

exports.saveUserPrefs = async (req, res) => {
    try {
        const User = require('../models/User');
        const { emailNotif, queueNotif, announceNotif, promoNotif } = req.body;
        if (req.user.userId === 'admin_001') return res.json({ success: true });
        const user = await User.findById(req.user.userId);
        if (!user) return res.status(404).json({ success: false, message: 'User not found' });
        user.preferences = { emailNotif, queueNotif, announceNotif, promoNotif };
        await user.save();
        res.json({ success: true, data: user.preferences });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to save preferences' });
    }
};

// ─────────────────────────────────────────────
// GET /api/queue/my-position  (citizen)
// Returns the citizen's live queue position + ETA for their pending/serving token.
// ─────────────────────────────────────────────
exports.getMyPosition = async (req, res) => {
    try {
        const queueIntelligence = require('../services/queueIntelligenceService');
        const mongoose = require('mongoose');
        const userId = req.user.userId;

        const query = mongoose.Types.ObjectId.isValid(userId)
            ? { userId, status: { $in: ['pending', 'serving'] } }
            : { _id: null };

        const myToken = await Token.findOne(query).sort({ createdAt: -1 }).lean();

        if (!myToken) {
            return res.json({
                success: true,
                message: 'No active token found',
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
// GET /api/queue/stats  (public)
// Returns a real-time public queue snapshot.
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
