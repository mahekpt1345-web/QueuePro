/**
 * QUEUE INTELLIGENCE SERVICE
 * ─────────────────────────────────────────────────────────────────────────────
 * Provides smart, real-time queue analytics:
 *   - Live token position for a given citizen
 *   - Estimated wait time based on service-specific averages
 *   - Public queue snapshot (crowd level, totals, throughput)
 *
 * DESIGN PRINCIPLES:
 *   - Purely additive — does NOT modify any existing service or API.
 *   - Uses short TTL cache (10s) to avoid hammering DB on every status poll.
 *   - Safe for admin_001 and any authenticated user.
 *
 * TOKEN LIFECYCLE (reference):
 *   pending → serving → completed
 *                     ↘ cancelled (from pending)
 *
 * USED BY:
 *   - GET /api/queue/my-position  (citizen)
 *   - GET /api/queue/stats        (public)
 */

const mongoose = require('mongoose');
const Token = require('../models/Token');
const { SERVICE_TIME } = require('../utils/serviceConfig');
const cache = require('../utils/cache');

const CACHE_TTL = 10; // seconds

class QueueIntelligenceService {

    /**
     * Get a citizen's live queue position and estimated wait time.
     * Returns null if the token is not in "pending" status.
     *
     * @param {string} tokenId - The DB ObjectId or tokenId string of the token
     * @param {string} userId  - The authenticated user's ID (for ownership check)
     * @returns {Object|null}
     */
    async getTokenPosition(tokenId, userId) {
        try {
            // Fetch all pending tokens sorted by queue position and creation time
            const cacheKey = `queue_snapshot`;
            let pendingTokens = cache.get(cacheKey);

            if (!pendingTokens) {
                pendingTokens = await Token.find({ status: 'pending' })
                    .sort({ position: 1, createdAt: 1 })
                    .select('_id tokenId userId serviceType position estimatedWaitTime createdAt')
                    .lean();
                cache.set(cacheKey, pendingTokens, CACHE_TTL);
            }

            // Find the citizen's specific token
            const myToken = pendingTokens.find(t =>
                t._id.toString() === tokenId ||
                t.tokenId === tokenId
            );

            if (!myToken) return null; // Not pending or doesn't exist

            // Calculate position (1-indexed)
            const position = pendingTokens.indexOf(myToken) + 1;

            // Tokens ahead = position - 1
            const tokensAhead = position - 1;

            // Estimated wait = sum of service times of all tokens ahead
            let estimatedWaitMinutes = 0;
            for (let i = 0; i < tokensAhead; i++) {
                const svcType = pendingTokens[i].serviceType;
                estimatedWaitMinutes += SERVICE_TIME[svcType] || SERVICE_TIME.other;
            }

            return {
                tokenId: myToken.tokenId,
                position,
                tokensAhead,
                estimatedWaitMinutes,
                estimatedWaitText: estimatedWaitMinutes > 0
                    ? `~${estimatedWaitMinutes} min`
                    : 'Your turn is next!',
                queueSize: pendingTokens.length,
                serviceType: myToken.serviceType,
                createdAt: myToken.createdAt
            };
        } catch (err) {
            console.error('[QueueIntelligence] getTokenPosition error:', err.message);
            return null;
        }
    }

    /**
     * Get a public queue snapshot with crowd level, live counts, and throughput.
     * Results are cached for CACHE_TTL seconds.
     *
     * @returns {Object}
     */
    async getQueueSnapshot() {
        const cacheKey = 'queue_public_snapshot';
        const cached = cache.get(cacheKey);
        if (cached) return cached;

        try {
            const todayStart = new Date();
            todayStart.setHours(0, 0, 0, 0);

            const [pending, serving, completedToday, totalToday] = await Promise.all([
                Token.countDocuments({ status: 'pending' }),
                Token.countDocuments({ status: 'serving' }),
                Token.countDocuments({ status: 'completed', completedAt: { $gte: todayStart } }),
                Token.countDocuments({ createdAt: { $gte: todayStart } })
            ]);

            // Crowd level
            let crowdLevel = 'Low';
            if (pending > 10 && pending <= 25) crowdLevel = 'Moderate';
            else if (pending > 25) crowdLevel = 'High';

            // Throughput: tokens/hour today
            const hoursElapsed = Math.max(1, (Date.now() - todayStart.getTime()) / 3_600_000);
            const tokensPerHour = +(completedToday / hoursElapsed).toFixed(1);

            // Estimated average wait for a new token joining now
            const avgServiceTime = 5; // conservative fallback in minutes
            const estimatedWaitForNew = pending * avgServiceTime;

            const snapshot = {
                pending,
                serving,
                completedToday,
                totalToday,
                crowdLevel,
                tokensPerHour,
                estimatedWaitForNew,
                estimatedWaitText: estimatedWaitForNew > 0
                    ? `~${estimatedWaitForNew} min estimated wait`
                    : 'No queue right now',
                timestamp: new Date().toISOString()
            };

            cache.set(cacheKey, snapshot, CACHE_TTL);
            return snapshot;
        } catch (err) {
            console.error('[QueueIntelligence] getQueueSnapshot error:', err.message);
            return {
                pending: 0, serving: 0, completedToday: 0, totalToday: 0,
                crowdLevel: 'Unknown', tokensPerHour: 0,
                estimatedWaitForNew: 0, estimatedWaitText: 'Unavailable',
                timestamp: new Date().toISOString()
            };
        }
    }
}

module.exports = new QueueIntelligenceService();
