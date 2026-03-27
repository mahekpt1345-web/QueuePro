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

            // Calculate position (1-indexed) based on DB count logic requested
            let tokensAhead = 0;
            if (myToken.tokenNumber && myToken.tokenNumber > 0) {
                tokensAhead = await Token.countDocuments({
                    serviceType: myToken.serviceType,
                    tokenNumber: { $lt: myToken.tokenNumber },
                    status: { $in: ["pending", "serving"] }
                });
            } else {
                // Fallback to position to ensure no system breaks if tokenNumber isn't populated
                tokensAhead = await Token.countDocuments({
                    serviceType: myToken.serviceType,
                    position: { $lt: myToken.position },
                    status: { $in: ["pending", "serving"] }
                });
            }
            
            const position = tokensAhead + 1;

            // Estimated wait = sum of service times of all tokens ahead (both serving and pending)
            let estimatedWaitMinutes = 0;
            
            // 1. Calculate time for tokens ahead from the pendingTokens snapshot
            // We need to find how many pending tokens are ahead of us
            const myIndexInPending = pendingTokens.findIndex(t => t._id.toString() === tokenId || t.tokenId === tokenId);
            if (myIndexInPending > 0) {
                for (let i = 0; i < myIndexInPending; i++) {
                    const svcType = pendingTokens[i].serviceType;
                    estimatedWaitMinutes += SERVICE_TIME[svcType] || SERVICE_TIME.other;
                }
            }

            // 2. Add time for tokens currently being served ahead of us
            // (If tokenNumber is used, we can find serving tokens with smaller tokenNumber)
            if (myToken.tokenNumber > 0) {
                const servingAhead = await Token.find({
                    serviceType: myToken.serviceType,
                    status: 'serving',
                    tokenNumber: { $lt: myToken.tokenNumber }
                }).select('serviceType').lean();

                for (const t of servingAhead) {
                    estimatedWaitMinutes += SERVICE_TIME[t.serviceType] || SERVICE_TIME.other;
                }
            }

            // Find the latest token currently being served for THIS service type
            const currentServing = await Token.findOne({ 
                    serviceType: myToken.serviceType,
                    status: 'serving' 
                })
                .sort({ startedAt: -1 })
                .select('tokenId')
                .lean();

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
                createdAt: myToken.createdAt,
                currentToken: currentServing ? currentServing.tokenId : "-"
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

    /**
     * Helper: calculate token position in queue safely.
     * @param {string} tokenId
     * @returns {Promise<number|null>}
     */
    async calculateTokenPosition(tokenId) {
        try {
            const pending = await Token.find({ status: 'pending' }).sort({ position: 1, createdAt: 1 }).lean();
            const index = pending.findIndex(t => t.tokenId === tokenId || t._id.toString() === tokenId);
            return index >= 0 ? index + 1 : null;
        } catch (error) {
            console.error('[QueueIntelligence] calculateTokenPosition error:', error.message);
            return null;
        }
    }

    /**
     * Helper: calculate tokens ahead of a position.
     * @param {number} position
     * @returns {number}
     */
    calculateTokensAhead(position) {
        return position > 1 ? position - 1 : 0;
    }

    /**
     * Helper: calculate simple estimated wait time (static formula).
     * @param {string} serviceType
     * @param {number} tokensAhead
     * @returns {number} Wait time in minutes
     */
    calculateEstimatedWaitTime(serviceType, tokensAhead) {
        try {
            const avgServiceTime = SERVICE_TIME[serviceType] || SERVICE_TIME.other || 5;
            return tokensAhead * avgServiceTime;
        } catch (error) {
            return 0; // Safe fallback
        }
    }

    /**
     * Helper: get basic queue analytics without intruding on existing stats APIs.
     * @returns {Promise<Object>}
     */
    async getBasicQueueAnalytics() {
        try {
            const totalServed = await Token.countDocuments({ status: 'completed' });
            return {
                totalTokensServed: totalServed,
                systemOverallWaitEstimateAvg: 5 // Static fallback based on config/knowledge
            };
        } catch (error) {
            console.error('[QueueIntelligence] getBasicQueueAnalytics error:', error.message);
            return { totalTokensServed: 0, systemOverallWaitEstimateAvg: 0 };
        }
    }
}

module.exports = new QueueIntelligenceService();
