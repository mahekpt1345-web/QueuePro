/**
 * PAGE CONTROLLER
 * Handles all EJS page renders:
 * - Home
 * - Dashboards (citizen, officer, admin)
 * - Profiles (citizen, officer, admin)
 * - Support pages (about, contact, help)
 * - Health check
 */

const contactHandler = require('../utils/contactHandler');

// ─────────────────────────────────────────────
// GET /
// ─────────────────────────────────────────────
exports.home = (req, res) => {
    res.render('index', { title: 'QueuePro - Smart Queue Management System' });
};

// ─────────────────────────────────────────────
// GET /health  &  GET /api/health
// ─────────────────────────────────────────────
exports.health = (req, res) => {
    const mongoose = require('mongoose');
    const dbState = mongoose.connection.readyState;
    const dbStatus = { 0: 'disconnected', 1: 'connected', 2: 'connecting', 3: 'disconnecting' };
    res.status(dbState === 1 ? 200 : 503).json({
        status: dbState === 1 ? 'ok' : 'error',
        timestamp: new Date().toISOString(),
        database: dbStatus[dbState] || 'unknown',
        server: 'running'
    });
};

// ─────────────────────────────────────────────
// DASHBOARD PAGES (protected)
// ─────────────────────────────────────────────
exports.citizenDashboard = (req, res) => {
    res.render('citizen-dashboard', { title: 'Citizen Dashboard - QueuePro', user: req.user || null });
};

exports.citizenProfile = (req, res) => {
    res.render('citizen-profile', { title: 'Citizen Profile - QueuePro', user: req.user || null });
};

exports.officerDashboard = (req, res) => {
    res.render('officer-dashboard', { title: 'Officer Dashboard - QueuePro', user: req.user || null });
};

exports.officerProfile = (req, res) => {
    res.render('officer-profile', { title: 'Officer Profile - QueuePro', user: req.user || null });
};

// ─────────────────────────────────────────────
// SUPPORT PAGES
// ─────────────────────────────────────────────
exports.about = (req, res) => {
    res.render('about', { title: 'About Us - QueuePro' });
};

exports.showContact = (req, res) => {
    res.render('contact', { title: 'Contact Us - QueuePro', message: null });
};

exports.postContact = (req, res) => {
    const { name, email, subject, message: contactMessage, phone } = req.body;
    try {
        contactHandler.saveContactMessage({
            name, email,
            phone: phone || 'Not provided',
            subject,
            message: contactMessage
        });
        res.render('contact', {
            title: 'Contact Us - QueuePro',
            message: {
                type: 'success',
                text: `Thank you ${name}! We received your message and will get back to you within 24 hours at ${email}.`
            }
        });
    } catch (error) {
        console.error('Error processing contact form:', error);
        res.render('contact', {
            title: 'Contact Us - QueuePro',
            message: { type: 'error', text: 'There was an error submitting your message. Please try again later.' }
        });
    }
};

exports.help = (req, res) => {
    res.render('help', { title: 'Help Center - QueuePro' });
};
