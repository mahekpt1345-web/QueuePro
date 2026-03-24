/**
 * SESSION CONFIGURATION
 * Separates session logic from server.js
 */

const session = require('express-session');
const MongoStore = require('connect-mongo');

const sessionConfig = session({
    secret: process.env.SESSION_SECRET || 'queuepro_session_secret_2024',
    resave: false,
    saveUninitialized: false, // Changed to false for better practice (don't create empty sessions)
    store: (MongoStore.create ? MongoStore : MongoStore.default).create({
        mongoUrl: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/queuepro',
        ttl: 24 * 60 * 60 // 1 day
    }),
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000 // 1 day
    }
});

module.exports = sessionConfig;
