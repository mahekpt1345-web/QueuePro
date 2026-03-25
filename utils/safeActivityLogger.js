const ActivityLog = require('../models/ActivityLog');

/**
 * Reusable helper for safe activity logging.
 * Guarantees that validation errors never crash the log or the request.
 */
module.exports = async function safeActivityLogger(data, req) {
    try {
        // Prepare fallback values safely
        const userIdRaw = req?.user?._id || req?.user?.id || req?.user?.userId;
        const validUserId = /^[0-9a-fA-F]{24}$/.test(userIdRaw) ? userIdRaw : null;
        const username = req?.user?.name || req?.user?.username || "Unknown User";
        const userRole = req?.user?.role || "guest";
        const detailsStr = data.details || `User ID: ${userIdRaw || 'Unknown'}`;

        await ActivityLog.create({
            userId: validUserId,
            username: username,
            userRole: userRole,
            action: data.action || "UNKNOWN_ACTION",
            details: detailsStr,
            resourceType: data.resourceType || null,
            resourceId: data.resourceId || null,
            status: data.status || 'success',
            errorMessage: data.errorMessage || null,
            ipAddress: req?.ip || '0.0.0.0'
        });
    } catch (err) {
        console.error("Safe ActivityLog error:", err.message);
    }
};
