/**
 * REQUEST LOGGER
 * Simple logging for every incoming request.
 */

const morgan = require('morgan');

// Custom format: method path status response-time ms
const logger = morgan(':method :url :status :response-time ms');

module.exports = logger;
