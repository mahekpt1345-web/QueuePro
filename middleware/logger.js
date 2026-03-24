const morgan = require('morgan');

// Custom token for request ID
morgan.token('id', (req) => req.id || 'initial');

// Custom format: [:id] :method :url :status :response-time ms - :res[content-length]
const format = '[:id] :method :url :status :response-time ms - :res[content-length]';

const logger = morgan(format);

module.exports = logger;
