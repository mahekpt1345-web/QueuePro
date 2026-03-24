/**
 * ROLE-BASED ACCESS CONTROL (RBAC) MIDDLEWARE
 * Ensures the authenticated user has one of the required roles.
 */
const rbac = (allowedRoles = []) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ success: false, message: 'Authentication required' });
        }

        const { role } = req.user;

        if (allowedRoles.length > 0 && !allowedRoles.includes(role)) {
            return res.status(403).json({ 
                success: false, 
                message: `Access denied. Required roles: [${allowedRoles.join(', ')}]. Your role: ${role}` 
            });
        }

        next();
    };
};

module.exports = rbac;
