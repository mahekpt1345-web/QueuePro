require('dotenv').config();
const express = require('express');
const http = require('http');
const path = require('path');
const cookieParser = require('cookie-parser');
const { Server } = require('socket.io');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

// Custom Config & Middleware
const connectDB = require('./config/database');
const sessionConfig = require('./config/session');
const setupSocket = require('./config/socket');
const logger = require('./middleware/logger');
const requestId = require('./middleware/requestId');
const { errorHandler } = require('./middleware/errorHandler');
const { loadUser } = require('./middleware/auth');

const { initTokenCleanup } = require('./jobs/tokenCleanup');

const app = express();
const server = http.createServer(app);

// Initialize Background Jobs
initTokenCleanup();

// Trust proxy for rate limiting if behind a proxy
app.set('trust proxy', 1);

// Standard Middlewares
app.use(requestId);
app.use(logger);
app.use(express.json());
const io = new Server(server, {
    cors: { origin: '*', methods: ['GET', 'POST'] }
});

// ========================================
// SECURITY & EXPRESS CONFIG
// ========================================
app.use(helmet({
    contentSecurityPolicy: false, // Disabled for EJS and inline scripts compatibility
}));

// Basic Rate Limiting (Non-aggressive - 100 requests per 15 mins)
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: { success: false, message: 'Too many requests, please try again later.' },
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => process.env.NODE_ENV === 'development' // Skip in dev
});
app.use('/api/', limiter);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// ========================================
// DATABASE CONNECTION
// ========================================
connectDB().catch(err => {
    console.error('Failed to connect to database:', err);
    process.exit(1);
});

// ========================================
// SESSION CONFIGURATION
// ========================================
app.use(sessionConfig);

app.use(express.static(path.join(__dirname, 'public')));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Global User Loader (Optional JWT Auth)
app.use(loadUser);

// ========================================
// SOCKET.IO — REAL-TIME QUEUE EVENTS
// ========================================
app.set('io', io);
setupSocket(io);

// ========================================
// ROUTES
// ========================================
app.use('/', require('./routes/auth'));       // Auth: /api/auth/*, /register, /login, /admin-login, /logout
app.use('/', require('./routes/admin'));      // Admin: /api/admin/*, /api/users, /admin-dashboard, /admin-profile
app.use('/api/queue', require('./routes/queue'));  // Queue: /api/queue/*
app.use('/api/engagement', require('./routes/engagement')); // Engagement Content
app.use('/', require('./routes/pages'));     // Pages: /, /citizen-*, /officer-*, /about, /contact, /help

// ========================================
// ERROR HANDLING (Standardized & Non-breaking)
// ========================================

// 404 Handler (renders custom 404 page)
app.use((req, res) => {
    res.status(404).render('error/404', { title: '404 - Page Not Found' });
});

// Global Error Handler
app.use(errorHandler);

// ========================================
// START SERVER
// ========================================
const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
    console.log(`\n QueuePro Server Running`);
    console.log(`   Local URL:  http://localhost:${PORT}`);
    console.log(`   Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`   Database: MongoDB`);
    console.log(`   Socket.IO: Enabled\n`);
}).on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
        console.error(`\n[FATAL ERROR] Port ${PORT} is already in use.`);
        process.exit(1);
    } else {
        console.error('\n[FATAL ERROR] Server failed to start:', err);
        process.exit(1);
    }
});

// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log('\nShutting down server gracefully...');
    server.close(() => {
        console.log('Server closed. Goodbye!');
        process.exit(0);
    });
});
