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
let QRCode;
try { QRCode = require('qrcode'); } catch (e) { QRCode = null; }
const SystemConfig = require('../models/SystemConfig');
const { logActivity } = require('../middleware/auth');
const adminService = require('../services/adminService');
const response = require('../utils/response');

// ─────────────────────────────────────────────
// GET /api/users  (alias for admin)
// ─────────────────────────────────────────────
exports.getUsers = async (req, res) => {
    try {
        const users = await adminService.getUsers(req.user.userId);
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
        const users = await adminService.getUsers(req.user.userId);
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
        await adminService.deleteUser(userId);

        await logActivity('DELETE_USER', `Account ID: ${userId} deleted by admin`, 'USER', userId, 'success', null, {
            user: { _id: req.user.userId, username: req.user.username, role: 'admin' },
            ip: req.ip, get: (h) => req.get(h)
        });

        return res.json({ success: true, message: `User deleted successfully` });
    } catch (err) {
        console.error('DELETE /api/admin/users/:userId error:', err.message);
        return res.status(err.message.includes('not found') ? 404 : 403).json({ 
            success: false, 
            message: err.message 
        });
    }
};

// ─────────────────────────────────────────────
// POST /api/admin/create-user
// ─────────────────────────────────────────────
exports.createUser = async (req, res) => {
    try {
        const { fullName, email, username, password, role } = req.body;

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

        return response.success(res, `User "${username}" created successfully`, { data: newUser }, 201);
    } catch (err) {
        console.error('POST /api/admin/create-user error:', err);
        return response.error(res, 'Failed to create user', 500);
    }
};

// ─────────────────────────────────────────────
// GET /api/admin/analytics
// ─────────────────────────────────────────────
exports.getAnalytics = async (req, res) => {
    try {
        const analytics = await adminService.getAnalytics();
        return res.json({
            success: true,
            data: analytics
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
        let { action, limit = 1000, page = 1 } = req.query;
        const filter = {};
        if (action) filter.action = action;

        // "all" support
        if (limit === 'all') limit = 10000;

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

        await logActivity('UPDATE_SETTINGS', `System settings updated by ${req.user.username}`, 'USER', req.user.userId, 'success', null, {
            user: { _id: req.user.userId, username: req.user.username, role: 'admin' },
            ip: req.ip, get: (h) => req.get(h)
        });

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

// GET /api/admin/profile-activity
exports.getProfileActivity = async (req, res) => {
    try {
        const query = {};

        // If not admin, only show their own logs
        // Admins can see everything
        if (req.user.role !== 'admin') {
            query.userId = req.user.userId;
        }

        const logs = await ActivityLog.find(query)
            .sort({ createdAt: -1 })
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
// GET /api/admin/config
// ─────────────────────────────────────────────
exports.getSystemConfig = async (req, res) => {
    try {
        const configs = await SystemConfig.find();
        const configMap = {};
        configs.forEach(c => configMap[c.key] = c.value);

        // Default values if not found
        if (configMap.broadcast === undefined) configMap.broadcast = "";
        if (configMap.serviceAvailability === undefined) {
            configMap.serviceAvailability = {
                aadhaar_update: true,
                caste_certificate_verification: true,
                income_certificate_verification: true,
                birth_certificate_verification: true,
                municipal_enquiry: true,
                other: true
            };
        }

        return res.json({ success: true, data: configMap });
    } catch (err) {
        console.error('GET /api/admin/config error:', err);
        return res.status(500).json({ success: false, message: 'Failed to fetch config' });
    }
};

// ─────────────────────────────────────────────
// POST /api/admin/config
// ─────────────────────────────────────────────
exports.updateSystemConfig = async (req, res) => {
    try {
        const { key, value } = req.body;
        if (!key) return res.status(400).json({ success: false, message: 'Key is required' });

        await SystemConfig.findOneAndUpdate(
            { key },
            { value, updatedBy: req.user.username },
            { upsert: true, new: true }
        );

        await logActivity('UPDATE_CONFIG', `System config updated: ${key}`, 'SYSTEM', req.user.userId, 'success', null, {
            user: { _id: req.user.userId, username: req.user.username, role: 'admin' },
            ip: req.ip, get: (h) => req.get(h)
        });

        return res.json({ success: true, message: `Config ${key} updated successfully` });
    } catch (err) {
        console.error('POST /api/admin/config error:', err);
        return res.status(500).json({ success: false, message: 'Failed to update config' });
    }
};

// ─────────────────────────────────────────────
// GET /admin-dashboard  (EJS page render)
// ─────────────────────────────────────────────
exports.showDashboard = async (req, res) => {
    let websiteQrDataUrl = null;
    let queueQrDataUrl = null;
    let initialStats = { totalTokens: 0, todayTokens: 0, avgWaitTime: 0, pending: 0, serving: 0, completed: 0, cancelled: 0 };
    let initialUsers = { total: 0, citizens: 0, officers: 0 };

    try {
        if (QRCode) {
            const baseUrl = process.env.OFFICIAL_URL || `${req.protocol}://${req.get('host')}`;
            const publicQueueUrl = `${baseUrl}/public-queue-status`;
            websiteQrDataUrl = await QRCode.toDataURL(baseUrl, { width: 200, margin: 2, color: { dark: '#000000', light: '#ffffff' } });
            queueQrDataUrl = await QRCode.toDataURL(publicQueueUrl, { width: 200, margin: 2, color: { dark: '#1e3a8a', light: '#ffffff' } });
        }
    } catch (e) {
        console.error('[QR] Failed to generate QR codes:', e.message);
    }

    // Pre-load initial dashboard stats from DB so they render immediately (SSR)
    try {
        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

        const [
            totalTokens, todayTokens, pending, serving, completed, cancelled,
            completedWithTime, totalUsers, userBreakdown
        ] = await Promise.all([
            Token.countDocuments(),
            Token.countDocuments({ createdAt: { $gte: todayStart } }),
            Token.countDocuments({ status: 'pending' }),
            Token.countDocuments({ status: 'serving' }),
            Token.countDocuments({ status: 'completed' }),
            Token.countDocuments({ status: 'cancelled' }),
            Token.find({ status: { $in: ['completed', 'serving'] }, actualWaitTime: { $ne: null } }).select('actualWaitTime').lean(),
            User.countDocuments(),
            User.aggregate([{ $group: { _id: '$role', count: { $sum: 1 } } }])
        ]);

        const avgWaitTime = completedWithTime.length
            ? Math.round(completedWithTime.reduce((s, t) => s + t.actualWaitTime, 0) / completedWithTime.length)
            : 0;

        initialStats = { totalTokens, todayTokens, avgWaitTime, pending, serving, completed, cancelled };

        const citizens = (userBreakdown.find(u => u._id === 'citizen') || {}).count || 0;
        const officers = (userBreakdown.find(u => u._id === 'officer') || {}).count || 0;
        initialUsers = { total: totalUsers, citizens, officers };

    } catch (e) {
        console.error('[Dashboard] Failed to pre-fetch stats:', e.message);
    }

    res.render('admin-dashboard', {
        title: 'Admin Dashboard - QueuePro',
        user: req.user || null,
        websiteQrDataUrl,
        queueQrDataUrl,
        initialStats,
        initialUsers
    });
};


// ─────────────────────────────────────────────
// GET /admin-profile  (EJS page render)
// ─────────────────────────────────────────────
exports.showProfile = (req, res) => {
    res.render('admin-profile', { title: 'Admin Profile - QueuePro', user: req.user || null });
};
