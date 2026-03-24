/**
 * GLOBAL ERROR HANDLER
 * Ensures that unexpected errors are caught and logged without crashing the server.
 * Standardizes API error responses while preserving existing behavior.
 */

const errorHandler = (err, req, res, next) => {
    console.error(' [ERROR] ', {
        message: err.message,
        stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
        path: req.path,
        method: req.method
    });

    // If headers already sent, delegate to default express error handler
    if (res.headersSent) {
        return next(err);
    }

    // Default error status
    const statusCode = err.statusCode || 500;
    
    // Standard response format (matching project pattern: { success: false, message: '...' })
    res.status(statusCode).json({
        success: false,
        message: err.message || 'An unexpected error occurred on the server.',
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    });
};

/**
 * 404 NOT FOUND HANDLER (API Only)
 */
const notFoundHandler = (req, res, next) => {
    const error = new Error(`Not Found - ${req.originalUrl}`);
    error.statusCode = 404;
    next(error);
};

module.exports = {
    errorHandler,
    notFoundHandler
};
