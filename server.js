require('dotenv').config();
const express = require('express');
const http = require('http');
const path = require('path');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');
const { Server } = require('socket.io');
const session = require('express-session');

const passport = require('passport');

const connectDB = require('./config/database');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: '*', methods: ['GET', 'POST'] }
});

const JWT_SECRET = process.env.JWT_SECRET || 'queuepro_secret_2024';

// Export io so controllers can emit events
app.set('io', io);

// ========================================
// DATABASE CONNECTION
// ========================================
connectDB().catch(err => {
    console.error('Failed to connect to database:', err);
    process.exit(1);
});

// ========================================
// MIDDLEWARE
// ========================================
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

const MongoStore = require('connect-mongo');

// ========================================
// SESSION CONFIGURATION
// ========================================
app.use(session({
    secret: process.env.SESSION_SECRET || 'queuepro_session_secret_2024',
    resave: false,
    saveUninitialized: true,
    store: (MongoStore.create ? MongoStore : MongoStore.default).create({
        mongoUrl: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/queuepro',
        ttl: 24 * 60 * 60 // 1 day
    }),
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000
    }
}));

// ========================================
// PASSPORT AUTHENTICATION
// ========================================
require('./middleware/passport-config')(passport);
app.use(passport.initialize());
app.use(passport.session());

app.use(express.static(path.join(__dirname, 'public')));

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Attach decoded JWT user to req.user for every request
app.use((req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1] || req.cookies?.token;
    if (token) {
        try {
            const decoded = jwt.verify(token, JWT_SECRET);
            req.user = decoded;
            res.locals.user = decoded;
        } catch (error) {
            // invalid token — continue without user
        }
    }
    next();
});

// ========================================
// SOCKET.IO — REAL-TIME QUEUE EVENTS
// ========================================
io.on('connection', (socket) => {
    // Citizen subscribes to their token updates
    socket.on('subscribe_token', (tokenId) => {
        socket.join(`token_${tokenId}`);
    });

    // Citizen subscribes to general queue updates
    socket.on('subscribe_queue', () => {
        socket.join('queue_broadcast');
    });

    socket.on('disconnect', () => {
        // cleanup handled automatically by socket.io
    });
});

// ========================================
// ROUTES
// ========================================
app.use('/', require('./routes/auth'));       // Auth: /api/auth/*, /register, /login, /admin-login, /logout
app.use('/', require('./routes/admin'));      // Admin: /api/admin/*, /api/users, /admin-dashboard, /admin-profile
app.use('/api/queue', require('./routes/queue'));  // Queue: /api/queue/*
app.use('/api/engagement', require('./routes/engagement')); // Engagement Content
app.use('/', require('./routes/pages'));     // Pages: /, /citizen-*, /officer-*, /about, /contact, /help

// ========================================
// 404 HANDLER
// ========================================
app.use((req, res) => {
    res.status(404).send(`
        <!DOCTYPE html><html><head><title>404 - Page Not Found</title>
        <style>body{font-family:Arial,sans-serif;display:flex;justify-content:center;align-items:center;height:100vh;margin:0;background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);color:white;}.container{text-align:center;}h1{font-size:72px;margin:0;}p{font-size:24px;}a{color:white;text-decoration:none;border:2px solid white;padding:10px 20px;border-radius:5px;display:inline-block;margin-top:20px;}a:hover{background:white;color:#667eea;}</style>
        </head><body><div class="container"><h1>404</h1><p>Page Not Found</p><a href="/">Go Home</a></div></body></html>
    `);
});

// ========================================
// START SERVER
// ========================================
const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
    console.log(`\n QueuePro Server Running`);
    console.log(`   Local URL:  http://localhost:${PORT}`);
    console.log(`   Official:   https://queuepro-45hu.onrender.com/`);
    console.log(`   Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`   Database: MongoDB`);
    console.log(`   Socket.IO: Enabled\n`);
}).on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
        console.error(`\n[FATAL ERROR] Port ${PORT} is already in use.`);
        console.error(`Please kill the process using port ${PORT} or change the port in .env`);
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
