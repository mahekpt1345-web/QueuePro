const cron = require('node-cron');
const Token = require('../models/Token');
const config = require('../config');

/**
 * TOKEN CLEANUP JOB
 * Automatically cleans up or archives old tokens to keep the database performant.
 */
const initTokenCleanup = () => {
    // Default: Every midnight
    cron.schedule(config.queue.cleanupSchedule || '0 0 * * *', async () => {
        console.log('[CRON] Running expired token cleanup...');
        try {
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);

            // Mark old pending tokens as expired/cancelled if they are from yesterday
            const result = await Token.updateMany(
                { 
                    status: 'pending', 
                    createdAt: { $lt: yesterday } 
                },
                { 
                    $set: { 
                        status: 'cancelled', 
                        cancelReason: 'Expired (Auto-cleanup)' 
                    } 
                }
            );

            console.log(`[CRON] Cleanup complete. Affected tokens: ${result.modifiedCount}`);
        } catch (err) {
            console.error('[CRON] Token cleanup failed:', err);
        }
    });
};

module.exports = { initTokenCleanup };
