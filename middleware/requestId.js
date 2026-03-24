const { v4: uuidv4 } = require('uuid');

/**
 * REQUEST ID MIDDLEWARE
 * Attaches a unique UUID to each request for tracing and logging.
 */
const requestId = (req, res, next) => {
    const id = req.header('X-Request-Id') || uuidv4();
    req.id = id;
    res.setHeader('X-Request-Id', id);
    next();
};

module.exports = requestId;
