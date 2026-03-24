const jwt = require('jsonwebtoken');
const User = require('../models/User');
const ActivityLog = require('../models/ActivityLog');

/**
 * Middleware to verify JWT token
 */
const verifyToken = (req, res, next) => {
    try {
        // Get token from header
        const token = req.headers.authorization?.split(' ')[1] || req.cookies?.token;

        if (!token) {
            return res.status(401).json({
                success: false,
                message: 'No token provided'
            });
        }

        // Verify token
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'queuepro_secret_2024');
        req.userId = decoded.userId;
        req.user = decoded;
        next();
    } catch (error) {
        console.error('Token verification failed:', error.message);
        return res.status(401).json({
            success: false,
            message: 'Invalid or expired token'
        });
    }
};

/**
 * Middleware to check user role
 */
const checkRole = (roles = []) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required'
            });
        }

        if (roles.length > 0 && !roles.includes(req.user.role)) {
            return res.status(403).json({
                success: false,
                message: `Access denied. This page is for ${roles.join(', ')}s only`
            });
        }

        next();
    };
};

/**
 * Middleware to check if user is authenticated (for EJS pages)
 */
const ensureAuthenticated = async (req, res, next) => {
    try {
        const publicRoutes = [
            '/', '/login', '/api/auth/login', '/logout', '/health', 
            '/api/health', '/public-queue-status', '/about', '/contact', 
            '/help', '/admin-login', '/register'
        ];
        
        // Debug Logging
        console.log('[AUTH CHECK]', {
            path: req.originalUrl || req.path,
            user: req.user ? 'exists' : 'missing'
        });

        // Skip auth for public routes
        if (publicRoutes.includes(req.path)) {
            return next();
        }

        // Fail-safe for /login if already authenticated
        if (req.path === '/login' && req.user) {
            return next();
        }

        const token = req.headers.authorization?.split(' ')[1] || req.cookies?.token;

        if (!token) {
            if (req.path === '/login') return next();
            return res.redirect('/login?error=auth_required');
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'queuepro_secret_2024');
        const user = await User.findById(decoded.userId);

        if (!user) {
            return res.redirect('/login?error=auth_required');
        }

        req.user = user;
        res.locals.user = user;
        next();
    } catch (error) {
        if (req.path === '/login') return next();
        return res.redirect('/login?error=invalid_token');
    }
};

/**
 * Middleware to check user role for EJS pages
 */
const ensureRole = (roles = []) => {
    return async (req, res, next) => {
        try {
            if (!req.user) {
                return res.redirect('/login?admin?error=auth_required');
            }

            if (roles.length > 0 && !roles.includes(req.user.role)) {
                return res.redirect('/login?error=access_denied');
            }

            next();
        } catch (error) {
            return res.redirect('/login?error=invalid_token');
        }
    };
};

/**
 * Middleware to log activity
 */
const logActivity = async (action, details = '', resourceType = null, resourceId = null, status = 'success', errorMessage = null, req) => {
    try {
        if (!req.user) return;

        const activity = new ActivityLog({
            userId: req.user._id || req.user.id,
            username: req.user.username,
            userRole: req.user.role,
            action,
            details,
            resourceType,
            resourceId,
            status,
            errorMessage,
            ipAddress: req.ip
        });

        await activity.save();
    } catch (error) {
        console.error('Error logging activity:', error.message);
    }
};

/**
 * Custom middleware to log specific actions
 */
const activityLogger = (action, resourceType = null) => {
    return (req, res, next) => {
        // Store original res.json and res.redirect
        const originalJson = res.json;
        const originalRedirect = res.redirect;

        res.json = function (data) {
            // Log only if response is successful
            if (data && data.success !== false && req.user) {
                logActivity(action, '', resourceType, null, 'success', null, req).catch(console.error);
            }
            return originalJson.call(this, data);
        };

        res.redirect = function (path) {
            if (req.user) {
                logActivity(action, '', resourceType, null, 'success', null, req).catch(console.error);
            }
            return originalRedirect.call(this, path);
        };

        next();
    };
};

/**
 * Global User Loader (Optional)
 * Attaches decoded JWT user to req.user for every request if token exists.
 * Does not block if token is missing.
 */
const loadUser = (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1] || req.cookies?.token;
    if (token) {
        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET || 'queuepro_secret_2024');
            req.user = decoded;
            res.locals.user = decoded;
        } catch (error) {
            // invalid token — continue without user
        }
    }
    next();
};

module.exports = {
    verifyToken,
    checkRole,
    ensureAuthenticated,
    ensureRole,
    logActivity,
    activityLogger,
    loadUser
};
