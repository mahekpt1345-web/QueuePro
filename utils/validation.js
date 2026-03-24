/**
 * VALIDATION UTILS
 * Standard validation rules using express-validator.
 * implemented in a non-disruptive way.
 */

const { body, validationResult } = require('express-validator');

/**
 * Middleware to handle validation results
 * Returns existing controller logic if successful, or standard error response if not.
 */
const validate = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        const errorMsg = errors.array().map(err => err.msg).join(', ');
        
        // For API requests
        if (req.path.startsWith('/api/')) {
            return res.status(400).json({ success: false, message: errorMsg });
        }
        
        // For EJS requests - usually we'd want to re-render the form with errors
        // but to keep it simple and preserve existing behavior, we let the controller handle it
        // Or we can attach errors to req and let controller check it
        req.validationErrors = errors.array();
    }
    next();
};

// Common validation rules
const authValidation = {
    register: [
        body('username').trim().isLength({ min: 3 }).withMessage('Username must be at least 3 characters'),
        body('email').isEmail().withMessage('Please enter a valid email address'),
        body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
        body('fullName').notEmpty().withMessage('Full name is required'),
        body('phone').notEmpty().withMessage('Phone number is required'),
        validate
    ],
    login: [
        body('username').notEmpty().withMessage('Username or Phone is required'),
        body('password').notEmpty().withMessage('Password is required'),
        validate
    ]
};

module.exports = {
    authValidation,
    validate
};
