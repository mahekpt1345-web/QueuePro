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
const { SERVICE_TYPES, SERVICE_TIME, calculateEstimatedWaitTime } = require('../utils/serviceConfig');
const notificationService = require('../utils/notificationService');

// ─────────────────────────────────────────────
// Helper: emit queue update events via Socket.io
// ─────────────────────────────────────────────
async function emitQueueUpdate(req, targetUserId = null) {
    try {
        const io = req.app.get('io');
        if (!io) return;

        // Get current pending tokens for position notifications
        const pendingTokens = await Token.find({ status: 'pending' })
            .sort({ position: 1 })
            .select('_id tokenId userId position serviceType')
            .lean();

        // Broadcast general queue update to all subscribers
        io.to('queue_broadcast').emit('queue_update', {
            pendingCount: pendingTokens.length,
            timestamp: new Date().toISOString()
        });

        // Send position-specific notifications to each citizen
        for (const [idx, token] of pendingTokens.entries()) {
            const position = idx + 1;
            const room = `token_${token._id}`;

            if (position === 1) {
                io.to(room).emit('turn_notification', {
                    type: 'next',
                    position,
                    message: '🔔 You are next. Please proceed to the counter.',
                    tokenId: token.tokenId
                });

                // SMS Notification for NEXT
                if (token.notificationSent !== 'next') {
                    const user = await User.findById(token.userId);
                    if (user && user.phone) {
                        await notificationService.sendSMS(user.phone, `QueuePro Update: Your turn is NEXT (Token ${token.tokenId}). Please proceed to the counter.`);
                        await Token.findByIdAndUpdate(token._id, { notificationSent: 'next' });
                    }
                }
            } else if (position <= 3) {
                const isApproaching = token.notificationSent === 'approaching' || token.notificationSent === 'next';
                
                io.to(room).emit('turn_notification', {
                    type: 'approaching',
                    position,
                    message: `🔔 Your turn will arrive in approximately 5–7 minutes (Position: ${position}).`,
                    tokenId: token.tokenId
                });

                // SMS Notification for APPROACHING
                if (!isApproaching) {
                    const user = await User.findById(token.userId);
                    if (user && user.phone) {
                        await notificationService.sendSMS(user.phone, `QueuePro Update: Your turn is approaching (Position: ${position}, Token ${token.tokenId}). Stay near the counter.`);
                        await Token.findByIdAndUpdate(token._id, { notificationSent: 'approaching' });
                    }
                }
            }
        }
    } catch (err) {
        console.error('[SOCKET] Error emitting queue update:', err.message);
    }
}

// ─────────────────────────────────────────────
// POST /api/queue/create-token  (citizen)
// ─────────────────────────────────────────────
exports.createToken = async (req, res) => {
    try {
        const { serviceType, description, checklistConfirmed } = req.body;
        const userId = req.user.userId;
        const username = req.user.username;
        const userName = req.user.name;

        if (!serviceType || !SERVICE_TYPES.includes(serviceType)) {
            return res.status(400).json({ success: false, message: 'Invalid service type' });
        }

        if (!checklistConfirmed) {
            return res.status(400).json({ success: false, message: 'Document checklist must be confirmed' });
        }

        const timestamp = Date.now();
        const tokenId = `TOKEN-${String(timestamp).slice(-5)}${Math.random().toString().slice(2, 5)}`;

        // Get all pending tokens to calculate realistic wait time
        const pendingTokens = await Token.find({ status: 'pending' })
            .select('serviceType')
            .lean();

        const pendingCount = pendingTokens.length;

        // Realistic wait time: sum of average times of all pending tokens
        const estimatedWaitTime = calculateEstimatedWaitTime(pendingTokens, serviceType);

        let crowdLevel = "Low";
        if (pendingCount > 10 && pendingCount <= 25) {
            crowdLevel = "Moderate";
        } else if (pendingCount > 25) {
            crowdLevel = "High";
        }

        const newToken = new Token({
            tokenId, userId, username, userName, serviceType,
            description: description || '',
            status: 'pending',
            position: pendingCount + 1,
            estimatedWaitTime,
            checklistConfirmed: true
        });

        await newToken.save();

        await logActivity('CREATE_TOKEN', `Token ${tokenId} created for ${serviceType}. Crowd Level: ${crowdLevel}`, 'TOKEN', userId, 'success', null, {
            user: { _id: userId, username, role: req.user.role },
            ip: req.ip, get: (header) => req.get(header)
        });

        // Emit queue updates to all subscribers
        await emitQueueUpdate(req);

        res.status(201).json({
            success: true,
            message: 'Token created successfully',
            data: newToken,
            token: newToken,
            crowdLevel
        });
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

        // Emit queue updates after cancellation
        await emitQueueUpdate(req);

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

        await logActivity('SERVE_TOKEN', `Started serving token ${token.tokenId}`, 'TOKEN', req.user.userId, 'success', null, {
            user: { _id: req.user.userId, username: req.user.username, role: req.user.role },
            ip: req.ip, get: (header) => req.get(header)
        });

        // Notify the citizen being served
        const io = req.app.get('io');
        if (io) {
            io.to(`token_${token._id}`).emit('token_called', {
                type: 'serving',
                message: '🔔 You are now being served. Please proceed to the counter.',
                tokenId: token.tokenId,
                handledBy: officerUsername
            });
        }

        // Emit queue re-positioning for all others
        await emitQueueUpdate(req);

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
        await token.save();

        await logActivity('COMPLETE_TOKEN', `Token ${token.tokenId} completed. Wait: ${token.actualWaitTime}min`, 'TOKEN', req.user.userId, 'success', null, {
            user: { _id: req.user.userId, username: req.user.username, role: req.user.role },
            ip: req.ip, get: (header) => req.get(header)
        });

        // Emit queue update
        await emitQueueUpdate(req);

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

        await logActivity('SKIP_TOKEN', `Token ${token.tokenId} returned to pending queue`, 'TOKEN', req.user.userId, 'success', null, {
            user: { _id: req.user.userId, username: req.user.username, role: req.user.role },
            ip: req.ip, get: (header) => req.get(header)
        });

        await emitQueueUpdate(req);

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

        await emitQueueUpdate(req);

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

        await emitQueueUpdate(req);

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

        let crowdLevel = "Low";
        if (pending > 10 && pending <= 25) {
            crowdLevel = "Moderate";
        } else if (pending > 25) {
            crowdLevel = "High";
        }

        res.json({
            success: true,
            message: 'Queue statistics retrieved',
            data: {
                total, pending, serving, completed, cancelled, completedToday,
                crowdLevel,
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
        const userId = req.user.userId;
        
        const tokens = await Token.find({ userId })
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
        const userId = req.user.userId;
        const limit = req.query.limit ? parseInt(req.query.limit) : 50;
        
        const logs = await ActivityLog.find({ userId })
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
