/**
 * SAFE HANDLER UTILITY
 * 
 * Provides a highly reliable wrapper for Express route controllers.
 * It strictly maintains exactly the same response format, routing logic,
 * and behavior, while catching any synchronous or asynchronous errors
 * that might otherwise crash the server.
 */

const safeHandler = (fn) => {
    return async (req, res, next) => {
        try {
            await fn(req, res, next);
        } catch (error) {
            console.error('[SAFE_HANDLER ERROR CAUGHT]:', error);
            // If the response headers are already sent, delegate to Express to close the connection safely
            if (res.headersSent) {
                return next(error);
            }
            // Otherwise, trigger the global error handler
            next(error);
        }
    };
};

module.exports = safeHandler;
