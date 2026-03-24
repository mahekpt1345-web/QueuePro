const User = require('../models/User');
const Token = require('../models/Token');
const ActivityLog = require('../models/ActivityLog');
const cache = require('../utils/cache');

/**
 * ADMIN SERVICE
 * ─────────────────────────────────────────────────────────────────────────────
 * Handles administrative business logic and complex analytics.
 *
 * ANALYTICS RESPONSE FIELDS:
 *   totalTokens, todayTokens, completed, pending, serving, cancelled
 *   avgWaitTime    — avg minutes for completed tokens (based on actualWaitTime)
 *   tokensPerHour  — throughput: today's completed ÷ hours elapsed
 *   queueEfficiency — completed ÷ total * 100 (as %)
 *   byService      — aggregate count per service type
 *   dailyLast7     — daily token counts for last 7 days (for sparkline)
 *
 * CACHE: analytics are cached for 30 seconds (config.cache.analyticsTtl)
 *        to prevent hammering DB during header dashboard polling.
 */
class AdminService {
    /**
     * Get system-wide analytics with caching.
     * @returns {Object} Full analytics payload
     */
    async getAnalytics() {
        const CACHE_KEY = 'admin_analytics';
        const cached = cache.get(CACHE_KEY);
        if (cached) return cached;

        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const weekAgo = new Date(todayStart);
        weekAgo.setDate(weekAgo.getDate() - 7);

        const [
            counts,
            avgWaitData,
            byService,
            dailyLast7,
            todayTokens,
            completedToday
        ] = await Promise.all([
            Token.aggregate([
                { $group: { _id: '$status', count: { $sum: 1 } } }
            ]),
            Token.aggregate([
                { $match: { status: 'completed', actualWaitTime: { $ne: null } } },
                { $group: { _id: null, avg: { $avg: '$actualWaitTime' } } }
            ]),
            Token.aggregate([
                { $group: { _id: '$serviceType', count: { $sum: 1 } } }
            ]),
            Token.aggregate([
                { $match: { createdAt: { $gte: weekAgo } } },
                {
                    $group: {
                        _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
                        count: { $sum: 1 }
                    }
                },
                { $sort: { _id: 1 } }
            ]),
            Token.countDocuments({ createdAt: { $gte: todayStart } }),
            Token.countDocuments({ status: 'completed', completedAt: { $gte: todayStart } })
        ]);

        const countMap = {};
        let totalTokens = 0;
        counts.forEach(c => {
            countMap[c._id] = c.count;
            totalTokens += c.count;
        });

        // Throughput: completed tokens per hour today
        const hoursElapsed = Math.max(1, (Date.now() - todayStart.getTime()) / 3_600_000);
        const tokensPerHour = +(completedToday / hoursElapsed).toFixed(1);

        // Efficiency: percentage of total tokens that were completed
        const completed = countMap.completed || 0;
        const queueEfficiency = totalTokens > 0
            ? +((completed / totalTokens) * 100).toFixed(1)
            : 0;

        const result = {
            totalTokens,
            todayTokens,
            completed,
            pending: countMap.pending || 0,
            serving: countMap.serving || 0,
            cancelled: countMap.cancelled || 0,
            avgWaitTime: avgWaitData.length ? Math.round(avgWaitData[0].avg) : 0,
            tokensPerHour,
            queueEfficiency,
            byService,
            dailyLast7
        };

        cache.set(CACHE_KEY, result, 30); // 30s TTL
        return result;
    }

    /**
     * Get all users (safe for admin_001 — uses find({}) not findById)
     * @param {string} currentAdminId
     */
    async getUsers(currentAdminId) {
        const query = currentAdminId === 'admin_001' ? {} : { _id: { $ne: currentAdminId } };
        
        return await User.find(query)
            .select('-password')
            .sort({ createdAt: -1 })
            .lean();
    }

    /**
     * Delete a user safely (guards against deleting admin accounts)
     * @param {string} userId
     */
    async deleteUser(userId) {
        const user = await User.findById(userId);
        if (!user) throw new Error('User not found');
        if (user.role === 'admin') throw new Error('Cannot delete admin user');

        await User.findByIdAndDelete(userId);
        return true;
    }
}

module.exports = new AdminService();
