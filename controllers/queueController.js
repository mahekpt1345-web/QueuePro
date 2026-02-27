/**
 * QUEUE CONTROLLER
 * Handles all queue-related logic:
 * - Citizen: createToken, myTokens, cancelToken
 * - Officer: pendingTokens, servingToken, serve, complete, skip
 * - Shared: pending, statistics
 * - Profile data: officerStats, officerActivity, citizenStats
 */

const Token = require('../models/Token');
const ActivityLog = require('../models/ActivityLog');
const { logActivity } = require('../middleware/auth');

// ─────────────────────────────────────────────
// POST /api/queue/create-token  (citizen)
// ─────────────────────────────────────────────
exports.createToken = async (req, res) => {
    try {
        const { serviceType, description } = req.body;
        const userId = req.user.userId;
        const username = req.user.username;
        const userName = req.user.name;

        if (!serviceType || !['passport', 'license', 'certificate', 'tax', 'other'].includes(serviceType)) {
            return res.status(400).json({ success: false, message: 'Invalid service type' });
        }

        const timestamp = Date.now();
        const tokenId = `TOKEN-${String(timestamp).slice(-5)}${Math.random().toString().slice(2, 5)}`;
        const pendingCount = await Token.countDocuments({ status: 'pending' });
        const estimatedWaitTime = pendingCount * 5;

        const newToken = new Token({
            tokenId, userId, username, userName, serviceType,
            description: description || '',
            status: 'pending',
            position: pendingCount + 1,
            estimatedWaitTime
        });

        await newToken.save();

        await logActivity('CREATE_TOKEN', `Token ${tokenId} created for ${serviceType}`, 'TOKEN', userId, 'success', null, {
            user: { _id: userId, username, role: req.user.role },
            ip: req.ip, get: (header) => req.get(header)
        });

        res.status(201).json({ success: true, message: 'Token created successfully', data: newToken });
    } catch (error) {
        console.error('Error creating token:', error);
        res.status(500).json({ success: false, message: 'Failed to create token', error: error.message });
    }
};

// ─────────────────────────────────────────────
// GET /api/queue/my-tokens  (citizen)
// ─────────────────────────────────────────────
exports.myTokens = async (req, res) => {
    try {
        const tokens = await Token.find({ userId: req.user.userId }).sort({ createdAt: -1 });
        res.json({ success: true, message: `Found ${tokens.length} tokens`, data: tokens });
    } catch (error) {
        console.error('Error fetching tokens:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch tokens' });
    }
};

// ─────────────────────────────────────────────
// PUT /api/queue/cancel-token/:tokenId  (citizen)
// ─────────────────────────────────────────────
exports.cancelToken = async (req, res) => {
    try {
        const { tokenId } = req.params;
        const { reason } = req.body;
        const userId = req.user.userId;

        const token = await Token.findById(tokenId);
        if (!token) return res.status(404).json({ success: false, message: 'Token not found' });
        if (token.userId.toString() !== userId)
            return res.status(403).json({ success: false, message: 'You can only cancel your own tokens' });
        if (token.status !== 'pending')
            return res.status(400).json({ success: false, message: `Token is already ${token.status}. Only pending tokens can be cancelled.` });

        token.status = 'cancelled';
        token.cancelledAt = new Date();
        token.cancelReason = reason || 'Cancelled by citizen';
        await token.save();

        await logActivity('CANCEL_TOKEN', `Token ${token.tokenId} cancelled`, 'TOKEN', userId, 'success', null, {
            user: { _id: userId, username: req.user.username, role: req.user.role },
            ip: req.ip, get: (header) => req.get(header)
        });

        res.json({ success: true, message: 'Token cancelled successfully', data: token });
    } catch (error) {
        console.error('Error cancelling token:', error);
        res.status(500).json({ success: false, message: 'Failed to cancel token' });
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

// ─────────────────────────────────────────────
// PUT /api/queue/token/:tokenId/serve  (officer/admin)
// ─────────────────────────────────────────────
exports.serveToken = async (req, res) => {
    try {
        const { tokenId } = req.params;
        const officerUsername = req.user.username;

        const currentServing = await Token.findOne({ status: 'serving' });
        if (currentServing) {
            return res.status(400).json({ success: false, message: 'Another token is currently being served. Complete or skip it first.' });
        }

        let token = null;
        if (tokenId.length === 24) token = await Token.findById(tokenId);
        if (!token) token = await Token.findOne({ tokenId });

        if (!token) return res.status(404).json({ success: false, message: 'Token not found' });
        if (token.status !== 'pending')
            return res.status(400).json({ success: false, message: `Token is already ${token.status}` });

        token.status = 'serving';
        token.handledBy = officerUsername;
        token.startedAt = new Date();
        await token.save();

        res.json({ success: true, message: `Now serving token ${token.tokenId}`, data: token });
    } catch (error) {
        console.error('[OFFICER API] Error serving token:', error);
        res.status(500).json({ success: false, message: 'Failed to serve token' });
    }
};

// ─────────────────────────────────────────────
// PUT /api/queue/token/:tokenId/complete  (officer/admin)
// ─────────────────────────────────────────────
exports.completeToken = async (req, res) => {
    try {
        const { tokenId } = req.params;

        let token = null;
        if (tokenId.length === 24) token = await Token.findById(tokenId);
        if (!token) token = await Token.findOne({ tokenId });

        if (!token) return res.status(404).json({ success: false, message: 'Token not found' });
        if (token.status !== 'serving')
            return res.status(400).json({ success: false, message: `Token must be in 'serving' status. Current: ${token.status}` });

        const completedAt = new Date();

        token.status = 'completed';
        token.completedAt = completedAt;
        // actualWaitTime is already calculated in the model's pre-save during serveToken
        await token.save();

        await logActivity('COMPLETE_TOKEN', `Token ${token.tokenId} completed. Wait: ${token.actualWaitTime}min`, 'TOKEN', req.user.userId, 'success', null, {
            user: { _id: req.user.userId, username: req.user.username, role: req.user.role },
            ip: req.ip, get: (header) => req.get(header)
        });

        res.json({ success: true, message: `Token ${token.tokenId} completed`, data: token });
    } catch (error) {
        console.error('[OFFICER API] Error completing token:', error);
        res.status(500).json({ success: false, message: 'Failed to complete token' });
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

        res.json({ success: true, message: 'Token marked as completed', data: token });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to complete token' });
    }
};

// ─────────────────────────────────────────────
// GET /api/queue/statistics  (officer/admin)
// ─────────────────────────────────────────────
exports.getStatistics = async (req, res) => {
    try {
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);

        const [total, pending, serving, completed, cancelled, completedToday] = await Promise.all([
            Token.countDocuments(),
            Token.countDocuments({ status: 'pending' }),
            Token.countDocuments({ status: 'serving' }),
            Token.countDocuments({ status: 'completed' }),
            Token.countDocuments({ status: 'cancelled' }),
            Token.countDocuments({ status: 'completed', completedAt: { $gte: todayStart } })
        ]);

        res.json({
            success: true,
            message: 'Queue statistics retrieved',
            data: {
                total, pending, serving, completed, cancelled, completedToday,
                distribution: {
                    pending: total > 0 ? ((pending / total) * 100).toFixed(2) + '%' : '0%',
                    serving: total > 0 ? ((serving / total) * 100).toFixed(2) + '%' : '0%',
                    completed: total > 0 ? ((completed / total) * 100).toFixed(2) + '%' : '0%',
                    cancelled: total > 0 ? ((cancelled / total) * 100).toFixed(2) + '%' : '0%'
                }
            }
        });
    } catch (error) {
        console.error('Error fetching statistics:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch statistics' });
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
        const logs = await ActivityLog.find({ userId: req.user.userId })
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
        const userId = req.user.userId;
        const [allTokens, completed, pending] = await Promise.all([
            Token.find({ userId }).select('status actualWaitTime createdAt completedAt serviceType tokenId').lean(),
            Token.countDocuments({ userId, status: 'completed' }),
            Token.countDocuments({ userId, status: { $in: ['pending', 'serving'] } })
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
