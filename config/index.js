/**
 * CENTRAL CONFIGURATION
 * Centralizes all environment variables and system constants.
 */
require('dotenv').config();

const config = {
    app: {
        name: 'QueuePro',
        port: process.env.PORT || 5000,
        env: process.env.NODE_ENV || 'development',
    },
    mongodb: {
        uri: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/queuepro',
    },
    auth: {
        jwtSecret: process.env.JWT_SECRET || 'queuepro_secret_2024',
        sessionSecret: process.env.SESSION_SECRET || 'queuepro_session_secret_2024',
        tokenExpiry: '1d',
    },
    queue: {
        maxPendingTokens: 100,
        cleanupSchedule: '0 0 * * *', // Every day at midnight
    },
    logging: {
        level: process.env.LOG_LEVEL || 'info',
    }
};

module.exports = config;
