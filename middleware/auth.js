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

// Middleware to check if user is authenticated (for EJS pages)
const ensureAuthenticated = async (req, res, next) => {
    try {
        const publicRoutes = [
            '/', '/login', '/api/auth/login', '/logout', '/health', 
            '/api/health', '/public-queue-status', '/about', '/contact', 
            '/help', '/admin-login', '/register'
        ];
        
        // Normalize path: lowercase and remove trailing slash (except for '/')
        const normalizedPath = req.path === '/' ? '/' : req.path.toLowerCase().replace(/\/$/, '');
        
        // Debug Logging
        console.log('[AUTH CHECK]', {
            path: req.originalUrl || req.path,
            normalized: normalizedPath,
            user: req.user ? 'exists' : 'missing'
        });

        // 1. Skip auth for public routes (normalized)
        if (publicRoutes.includes(normalizedPath)) {
            return next();
        }

        // 2. TRUST loadUser: If already decoded & verified by loadUser → proceed
        if (req.user) {
            return next();
        }

        // 3. Fail-safe: If no user and not on login page → redirect to login
        if (normalizedPath !== '/login') {
            console.log("[NO USER - REDIRECTING]", normalizedPath);
            return res.redirect('/login');
        }

        next();
    } catch (error) {
        console.log('[AUTH ERROR]', error.message);
        if (req.path === '/login') return next();
        return res.redirect('/login');
    }
};

/**
 * Middleware to check user role for EJS pages
 */
const ensureRole = (roles = []) => {
    return async (req, res, next) => {
        try {
            const normalizedPath = req.path === '/' ? '/' : req.path.toLowerCase().replace(/\/$/, '');

            // Fallback: If no user but on a public route, just next() and let ensureAuthenticated handle it
            const publicRoutes = ['/', '/login', '/api/auth/login', '/logout', '/health', '/api/health', '/public-queue-status'];
            if (publicRoutes.includes(normalizedPath)) {
                return next();
            }

            if (!req.user) {
                return res.redirect('/login?error=auth_required');
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

        // BSON Safety: If ID is not a valid ObjectId, don't try to save it in a strict field if it exists
        // Here we just ensure we don't crash the log if the userId is a string like 'admin_001'
        const activity = new ActivityLog({
            userId: /^[0-9a-fA-F]{24}$/.test(req.user._id || req.user.id) ? (req.user._id || req.user.id) : null,
            username: req.user.username,
            userRole: req.user.role,
            action,
            details: details || `User ID: ${req.user._id || req.user.id}`,
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
 * Attaches verified database user to req.user for every request if token exists.
 * Does not block if token is missing or invalid.
 */
const loadUser = async (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1] || req.cookies?.token;
    if (token) {
        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET || 'queuepro_secret_2024');
            
            let user = null;
            if (decoded.userId && /^[0-9a-fA-F]{24}$/.test(decoded.userId)) {
                user = await User.findById(decoded.userId).select('-password');
            }
            // HANDLE HARDCODED ADMIN (admin_001)
            if (!user && decoded.userId === 'admin_001') {
                user = {
                    _id: 'admin_001',
                    userId: 'admin_001',
                    username: 'mahek',
                    role: 'admin',
                    name: 'System Admin'
                };
            }
            if (user) {
                req.user = user;
                res.locals.user = user;
            }
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
