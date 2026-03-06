const mongoose = require('mongoose');
require('dotenv').config();
const ActivityLog = require('../models/ActivityLog');
const connectDB = require('../config/database');

async function listLogs() {
    try {
        await connectDB();

        console.log('--- RECENT 100 LOGS ---');
        const logs = await ActivityLog.find().sort({ createdAt: -1 }).limit(100);

        logs.forEach(l => {
            console.log(`[${l.action}] [${l.status}] ${l.details}`);
        });

        // Search specifically for the IDs in the user's screenshot
        const screenshotIds = ['TOKEN-39666423', 'TOKEN-48318747', 'TOKEN-42802609', 'TOKEN-28463295'];
        console.log('\n--- SEARCHING FOR SCREENSHOT IDs ---');
        for (const tid of screenshotIds) {
            const count = await ActivityLog.countDocuments({ details: { $regex: tid } });
            console.log(`Found ${count} logs for ${tid}`);
        }

        process.exit(0);
    } catch (error) {
        console.error('List failed:', error);
        process.exit(1);
    }
}

listLogs();
