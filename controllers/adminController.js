/**
 * ADMIN CONTROLLER
 * Handles all admin-specific logic:
 * - User management (list, create, delete)
 * - Analytics
 * - Activity logs
 * - System settings
 * - Profile stats & activity
 * - All-tokens view
 * - Dashboard & Profile page renders
 */

const User = require('../models/User');
const Token = require('../models/Token');
const ActivityLog = require('../models/ActivityLog');
const { logActivity } = require('../middleware/auth');

// ─────────────────────────────────────────────
// GET /api/users  (alias for admin)
// ─────────────────────────────────────────────
exports.getUsers = async (req, res) => {
    try {
        const users = await User.find().select('-password').sort({ createdAt: -1 });
        return res.json({ success: true, users });
    } catch (err) {
        return res.status(500).json({ success: false, message: 'Failed to fetch users' });
    }
};

// ─────────────────────────────────────────────
// GET /api/admin/users
// ─────────────────────────────────────────────
exports.adminGetUsers = async (req, res) => {
    try {
        const users = await User.find().select('-password').sort({ createdAt: -1 });
        return res.json({ success: true, data: users });
    } catch (err) {
        console.error('GET /api/admin/users error:', err);
        return res.status(500).json({ success: false, message: 'Failed to fetch users' });
    }
};

// ─────────────────────────────────────────────
// DELETE /api/admin/users/:userId
// ─────────────────────────────────────────────
exports.deleteUser = async (req, res) => {
    try {
        const { userId } = req.params;
        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ success: false, message: 'User not found' });
        if (user.role === 'admin') return res.status(403).json({ success: false, message: 'Cannot delete admin accounts' });

        await User.findByIdAndDelete(userId);

        await logActivity('DELETE_USER', `User ${user.username} deleted by admin`, 'USER', userId, 'success', null, {
            user: { _id: req.user.userId, username: req.user.username, role: 'admin' },
            ip: req.ip, get: (h) => req.get(h)
        });

        return res.json({ success: true, message: `User "${user.username}" deleted successfully` });
    } catch (err) {
        console.error('DELETE /api/admin/users/:userId error:', err);
        return res.status(500).json({ success: false, message: 'Failed to delete user' });
    }
};

// ─────────────────────────────────────────────
// POST /api/admin/create-user
// ─────────────────────────────────────────────
exports.createUser = async (req, res) => {
    try {
        const { fullName, email, username, password, role } = req.body;

        if (!fullName || !email || !username || !password || !role)
            return res.status(400).json({ success: false, message: 'All fields are required' });
        if (username.length < 3)
            return res.status(400).json({ success: false, message: 'Username must be at least 3 characters' });
        if (password.length < 6)
            return res.status(400).json({ success: false, message: 'Password must be at least 6 characters' });
        if (!['citizen', 'officer', 'admin'].includes(role))
            return res.status(400).json({ success: false, message: 'Invalid role' });

        const existing = await User.findOne({ $or: [{ username }, { email }] });
        if (existing) {
            const msg = existing.username === username ? 'Username already taken' : 'Email already registered';
            return res.status(400).json({ success: false, message: msg });
        }

        const newUser = new User({ username, email, name: fullName, password, role });
        await newUser.save();

        await logActivity('CREATE_USER', `Admin created ${role} account: ${username}`, 'USER', newUser._id, 'success', null, {
            user: { _id: req.user.userId, username: req.user.username, role: 'admin' },
            ip: req.ip, get: (h) => req.get(h)
        });

        return res.json({ success: true, message: `User "${username}" created successfully`, data: newUser });
    } catch (err) {
        console.error('POST /api/admin/create-user error:', err);
        return res.status(500).json({ success: false, message: 'Failed to create user' });
    }
};

// ─────────────────────────────────────────────
// GET /api/admin/analytics
// ─────────────────────────────────────────────
exports.getAnalytics = async (req, res) => {
    try {
        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

        const [
            totalTokens, todayTokens, pending, serving, completed, cancelled,
            byService, dailyLast7, completedWithTime
        ] = await Promise.all([
            Token.countDocuments(),
            Token.countDocuments({ createdAt: { $gte: todayStart } }),
            Token.countDocuments({ status: 'pending' }),
            Token.countDocuments({ status: 'serving' }),
            Token.countDocuments({ status: 'completed' }),
            Token.countDocuments({ status: 'cancelled' }),
            Token.aggregate([
                { $group: { _id: '$serviceType', count: { $sum: 1 } } },
                { $sort: { count: -1 } }
            ]),
            Token.aggregate([
                { $match: { createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } } },
                { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, count: { $sum: 1 } } },
                { $sort: { _id: 1 } }
            ]),
            Token.find({ status: { $in: ['completed', 'serving'] }, actualWaitTime: { $ne: null } }).select('actualWaitTime').lean()
        ]);

        const avgWaitTime = completedWithTime.length
            ? Math.round(completedWithTime.reduce((s, t) => s + t.actualWaitTime, 0) / completedWithTime.length)
            : null;

        return res.json({
            success: true,
            data: { totalTokens, todayTokens, pending, serving, completed, cancelled, avgWaitTime, byService, dailyLast7 }
        });
    } catch (err) {
        console.error('GET /api/admin/analytics error:', err);
        return res.status(500).json({ success: false, message: 'Failed to fetch analytics' });
    }
};

// ─────────────────────────────────────────────
// GET /api/admin/activity-logs
// ─────────────────────────────────────────────
exports.getActivityLogs = async (req, res) => {
    try {
        const { action, limit = 80, page = 1 } = req.query;
        const filter = {};
        if (action) filter.action = action;

        const skip = (parseInt(page) - 1) * parseInt(limit);
        const [logs, total] = await Promise.all([
            ActivityLog.find(filter).sort({ createdAt: -1 }).limit(parseInt(limit)).skip(skip).lean(),
            ActivityLog.countDocuments(filter)
        ]);

        return res.json({ success: true, data: logs, total, page: parseInt(page) });
    } catch (err) {
        console.error('GET /api/admin/activity-logs error:', err);
        return res.status(500).json({ success: false, message: 'Failed to fetch activity logs' });
    }
};

// ─────────────────────────────────────────────
// GET /api/admin/settings
// ─────────────────────────────────────────────
exports.getSettings = async (req, res) => {
    try {
        let SystemSettings;
        try { SystemSettings = require('../models/SystemSettings'); } catch (e) {
            return res.json({ success: true, data: { tokenGeneration: true, tokenCancellation: true, autoRefresh: true, registrations: true, officerRegistration: true, notifications: true } });
        }
        let settings = await SystemSettings.findOne({ _key: 'global' });
        if (!settings) settings = await SystemSettings.create({ _key: 'global' });
        return res.json({ success: true, data: settings });
    } catch (err) {
        console.error('GET /api/admin/settings error:', err);
        return res.status(500).json({ success: false, message: 'Failed to fetch settings' });
    }
};

// ─────────────────────────────────────────────
// PUT /api/admin/settings
// ─────────────────────────────────────────────
exports.updateSettings = async (req, res) => {
    try {
        let SystemSettings;
        try { SystemSettings = require('../models/SystemSettings'); } catch (e) {
            return res.status(500).json({ success: false, message: 'SystemSettings model not found.' });
        }
        const allowed = ['tokenGeneration', 'tokenCancellation', 'autoRefresh', 'registrations', 'officerRegistration', 'notifications'];
        const updates = { updatedAt: new Date(), updatedBy: req.user.username };
        allowed.forEach(key => { if (req.body[key] !== undefined) updates[key] = Boolean(req.body[key]); });

        const settings = await SystemSettings.findOneAndUpdate(
            { _key: 'global' },
            { $set: updates },
            { returnDocument: 'after', upsert: true }
        );
        return res.json({ success: true, message: 'Settings saved', data: settings });
    } catch (err) {
        console.error('PUT /api/admin/settings error:', err);
        return res.status(500).json({ success: false, message: 'Failed to save settings' });
    }
};

// ─────────────────────────────────────────────
// GET /api/admin/profile-stats
// ─────────────────────────────────────────────
exports.getProfileStats = async (req, res) => {
    try {
        const [totalUsers, totalTokens] = await Promise.all([
            User.countDocuments(),
            Token.countDocuments()
        ]);
        return res.json({ success: true, data: { totalUsers, totalTokens } });
    } catch (err) {
        console.error('GET /api/admin/profile-stats error:', err);
        return res.status(500).json({ success: false, message: 'Failed to fetch admin stats' });
    }
};

// ─────────────────────────────────────────────
// GET /api/admin/profile-activity
// ─────────────────────────────────────────────
exports.getProfileActivity = async (req, res) => {
    try {
        const logs = await ActivityLog.find({ userId: req.user.userId })
            .sort({ createdAt: -1 })
            .limit(20)
            .lean();
        return res.json({ success: true, data: logs });
    } catch (err) {
        console.error('GET /api/admin/profile-activity error:', err);
        return res.status(500).json({ success: false, message: 'Failed to fetch activity logs' });
    }
};

// ─────────────────────────────────────────────
// GET /api/queue/all-tokens (admin view)
// ─────────────────────────────────────────────
exports.getAllTokens = async (req, res) => {
    try {
        const { status, limit = 200 } = req.query;
        const filter = {};
        if (status) filter.status = status;
        const tokens = await Token.find(filter).sort({ createdAt: -1 }).limit(parseInt(limit)).lean();
        return res.json({ success: true, data: tokens });
    } catch (err) {
        console.error('GET /api/queue/all-tokens error:', err);
        return res.status(500).json({ success: false, message: 'Failed to fetch tokens' });
    }
};

// ─────────────────────────────────────────────
// GET /admin-dashboard  (EJS page render)
// ─────────────────────────────────────────────
exports.showDashboard = (req, res) => {
    res.render('admin-dashboard', { title: 'Admin Dashboard - QueuePro', user: req.user || null });
};

// ─────────────────────────────────────────────
// GET /admin-profile  (EJS page render)
// ─────────────────────────────────────────────
exports.showProfile = (req, res) => {
    res.render('admin-profile', { title: 'Admin Profile - QueuePro', user: req.user || null });
};
