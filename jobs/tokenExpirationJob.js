/**
 * BACKGROUND JOB: TOKEN EXPIRATION
 * 
 * Automatically expires ("cancels") pending tokens that are older than 120 minutes.
 * Runs non-intrusively in the background via setInterval.
 */
const Token = require('../models/Token');
const { logActivity } = require('../middleware/auth');

// To prevent overlapping executions
let isRunning = false;

const expireOldTokens = async () => {
    if (isRunning) return;
    isRunning = true;

    try {
        const thresholdDate = new Date(Date.now() - 120 * 60 * 1000); // 120 minutes ago

        const oldTokens = await Token.find({
            status: 'pending',
            createdAt: { $lt: thresholdDate }
        });

        if (oldTokens.length > 0) {
            console.log(`[JOB: TokenExpiration] Found ${oldTokens.length} old pending tokens. Cancelling...`);
            
            for (const token of oldTokens) {
                // Atomic transition inside loop (safe)
                const updated = await Token.findOneAndUpdate(
                    { _id: token._id, status: 'pending' },
                    { 
                        status: 'cancelled', 
                        cancelledAt: new Date(), 
                        cancelReason: 'Auto-expired system cleanup' 
                    },
                    { new: true }
                );

                if (updated) {
                    await logActivity('CANCEL_TOKEN', `System auto-cancelled expired token ${token.tokenId}`, 'TOKEN', 'system', 'success', null, {
                        user: { _id: 'system', username: 'system', role: 'system' },
                        ip: '127.0.0.1', get: () => 'System Job'
                    }).catch(() => {});
                }
            }

            // Emit update to connected clients if any were processed
            const io = require('../config/socket').getIo ? require('../config/socket').getIo() : null;
            if (io) {
                const emitWithRetry = require('../utils/socketRetry');
                const pendingCount = await Token.countDocuments({ status: 'pending' });
                emitWithRetry(io, 'queue_broadcast', 'queue_update', {
                    pendingCount,
                    timestamp: new Date().toISOString()
                });
            }
        }
    } catch (error) {
        console.error('[JOB: TokenExpiration] Error expiring old tokens:', error.message);
    } finally {
        isRunning = false;
    }
};

const initTokenExpirationJob = () => {
    // Run every 60 seconds
    setInterval(expireOldTokens, 60 * 1000);
    console.log('[JOBS] Token expiration job initialized.');
};

module.exports = { initTokenExpirationJob, expireOldTokens };
