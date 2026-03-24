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
        const [users, tokens, logs] = await Promise.all([
            User.countDocuments(),
            Token.countDocuments(),
            ActivityLog.countDocuments()
        ]);

        const recentActivity = await ActivityLog.find()
            .sort({ createdAt: -1 })
            .limit(10)
            .lean();

        return {
            summary: { users, tokens, logs },
            recentActivity
        };
    }

    /**
     * Get all users
     */
    async getUsers(currentAdminId) {
        return await User.find({ _id: { $ne: currentAdminId } })
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
