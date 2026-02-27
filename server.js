require('dotenv').config();
const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');

const connectDB = require('./config/database');

const app = express();
const JWT_SECRET = process.env.JWT_SECRET || 'queuepro_secret_2024';

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
// ROUTES
// ========================================
app.use('/', require('./routes/auth'));       // Auth: /api/auth/*, /register, /login, /admin-login, /logout
app.use('/', require('./routes/admin'));      // Admin: /api/admin/*, /api/users, /admin-dashboard, /admin-profile
app.use('/api/queue', require('./routes/queue'));  // Queue: /api/queue/*
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
app.listen(PORT, () => {
    console.log(`\n QueuePro Server Running`);
    console.log(`   URL: http://localhost:${PORT}`);
    console.log(`   Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`   Database: MongoDB\n`);
});
