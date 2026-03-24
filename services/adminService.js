const User = require('../models/User');
const Token = require('../models/Token');
const ActivityLog = require('../models/ActivityLog');

/**
 * ADMIN SERVICE
 * Handles administrative business logic and complex analytics.
 */
class AdminService {
    /**
     * Get system-wide analytics
     */
    async getAnalytics() {
        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const weekAgo = new Date(todayStart);
        weekAgo.setDate(weekAgo.getDate() - 7);

        const [
            counts,
            avgWaitData,
            byService,
            dailyLast7,
            todayTokens
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
            Token.countDocuments({ createdAt: { $gte: todayStart } })
        ]);

        const countMap = {};
        let totalTokens = 0;
        counts.forEach(c => {
            countMap[c._id] = c.count;
            totalTokens += c.count;
        });

        return {
            totalTokens,
            todayTokens,
            completed: countMap.completed || 0,
            pending: countMap.pending || 0,
            serving: countMap.serving || 0,
            cancelled: countMap.cancelled || 0,
            avgWaitTime: avgWaitData.length ? Math.round(avgWaitData[0].avg) : 0,
            byService,
            dailyLast7
        };
    }

    /**
     * Get all users
     */
    async getUsers(currentAdminId) {
        const query = currentAdminId === 'admin_001' ? {} : { _id: { $ne: currentAdminId } };
        
        return await User.find(query)
            .select('-password')
            .sort({ createdAt: -1 })
            .lean();
    }

    /**
     * Delete a user safely
     */
    async deleteUser(userId) {
        const user = await User.findById(userId);
        if (!user) throw new Error('User not found');
        if (user.role === 'admin') throw new Error('Cannot delete admin user');

        await User.findByIdAndDelete(userId);
        // Optional: Cleanup tokens? Logic can be added here.
        return true;
    }
}

module.exports = new AdminService();
