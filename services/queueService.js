const Token = require('../models/Token');
const User = require('../models/User');
const { logActivity } = require('../middleware/auth');
const { calculateEstimatedWaitTime } = require('../utils/serviceConfig');
const notificationService = require('../utils/notificationService');

/**
 * QUEUE SERVICE
 * Handles all business logic for tokens and queue management.
 */
class QueueService {
    /**
     * Emit queue updates via Socket.io
     */
    async emitQueueUpdate(io, targetUserId = null) {
        if (!io) return;

        try {
            const pendingTokens = await Token.find({ status: 'pending' })
                .sort({ position: 1 })
                .select('_id tokenId userId position serviceType notificationSent')
                .lean();

            // Broadcast general update
            io.to('queue_broadcast').emit('queue_update', {
                pendingCount: pendingTokens.length,
                timestamp: new Date().toISOString()
            });

            // Individual notifications
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

                    if (token.notificationSent !== 'next') {
                        const user = await User.findById(token.userId);
                        if (user && user.phone) {
                            await notificationService.sendSMS(user.phone, `QueuePro Update: Your turn is NEXT (Token ${token.tokenId}).`);
                            await Token.findByIdAndUpdate(token._id, { notificationSent: 'next' });
                        }
                    }
                } else if (position <= 3) {
                    io.to(room).emit('turn_notification', {
                        type: 'approaching',
                        position,
                        message: `🔔 Your turn is approaching (Position: ${position}).`,
                        tokenId: token.tokenId
                    });

                    if (!['next', 'approaching'].includes(token.notificationSent)) {
                        const user = await User.findById(token.userId);
                        if (user && user.phone) {
                            await notificationService.sendSMS(user.phone, `QueuePro Update: Your turn is approaching (Token ${token.tokenId}).`);
                            await Token.findByIdAndUpdate(token._id, { notificationSent: 'approaching' });
                        }
                    }
                }
            }
        } catch (err) {
            console.error('[QueueService] Socket error:', err.message);
        }
    }

    /**
     * Create a new token
     */
    async createToken(data, user, ip, userAgent) {
        const { serviceType, description } = data;
        const { userId, username, name: userName, role } = user;

        const pendingTokens = await Token.find({ status: 'pending' }).select('serviceType').lean();
        const pendingCount = pendingTokens.length;
        const estimatedWaitTime = calculateEstimatedWaitTime(pendingTokens, serviceType);

        const timestamp = Date.now();
        const tokenId = `TOKEN-${String(timestamp).slice(-5)}${Math.random().toString().slice(2, 5)}`;

        const newToken = new Token({
            tokenId, userId, username, userName, serviceType,
            description: description || '',
            status: 'pending',
            position: pendingCount + 1,
            estimatedWaitTime,
            checklistConfirmed: true
        });

        await newToken.save();

        await logActivity('CREATE_TOKEN', `Token ${tokenId} created`, 'TOKEN', userId, 'success', null, {
            user: { _id: userId, username, role },
            ip, get: (h) => userAgent[h]
        });

        return { token: newToken, pendingCount };
    }

    /**
     * Serve a token
     */
    async serveToken(tokenId, officer, ip, userAgent) {
        let token = tokenId.length === 24 ? await Token.findById(tokenId) : await Token.findOne({ tokenId });
        if (!token) throw new Error('Token not found');
        if (token.status !== 'pending') throw new Error(`Token is already ${token.status}`);

        const currentServing = await Token.findOne({ status: 'serving' });
        if (currentServing) throw new Error('Another token is currently being served');

        token.status = 'serving';
        token.handledBy = officer.username;
        token.startedAt = new Date();
        await token.save();

        await logActivity('SERVE_TOKEN', `Serving ${token.tokenId}`, 'TOKEN', officer.userId, 'success', null, {
            user: { _id: officer.userId, username: officer.username, role: officer.role },
            ip, get: (h) => userAgent[h]
        });

        return token;
    }

    /**
     * Cancel a token
     */
    async cancelToken(tokenId, userId, reason, ip, userAgent) {
        let token = await Token.findById(tokenId);
        if (!token) throw new Error('Token not found');
        if (token.userId.toString() !== userId.toString()) throw new Error('Not authorized to cancel this token');
        if (token.status !== 'pending') throw new Error(`Token is already ${token.status}`);

        token.status = 'cancelled';
        token.cancelledAt = new Date();
        token.cancelReason = reason || 'Cancelled by citizen';
        await token.save();

        await logActivity('CANCEL_TOKEN', `Cancelled ${token.tokenId}`, 'TOKEN', userId, 'success', null, {
            user: { _id: userId },
            ip, get: (h) => userAgent[h]
        });

        return token;
    }

    /**
     * Get queue statistics
     */
    async getStatistics() {
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
        if (pending > 10 && pending <= 25) crowdLevel = "Moderate";
        else if (pending > 25) crowdLevel = "High";

        return {
            total, pending, serving, completed, cancelled, completedToday,
            crowdLevel,
            distribution: {
                pending: total > 0 ? ((pending / total) * 100).toFixed(2) + '%' : '0%',
                serving: total > 0 ? ((serving / total) * 100).toFixed(2) + '%' : '0%',
                completed: total > 0 ? ((completed / total) * 100).toFixed(2) + '%' : '0%',
                cancelled: total > 0 ? ((cancelled / total) * 100).toFixed(2) + '%' : '0%'
            }
        };
    }
}

module.exports = new QueueService();
