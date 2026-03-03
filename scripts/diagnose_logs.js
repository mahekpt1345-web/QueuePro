const mongoose = require('mongoose');
require('dotenv').config();
const ActivityLog = require('../models/ActivityLog');
const Token = require('../models/Token');
const connectDB = require('../config/database');

async function diagnose() {
    try {
        await connectDB();

        const legacyKeywords = ['passport', 'license', 'tax', 'certificate', 'driving'];
        const regex = new RegExp(legacyKeywords.join('|'), 'i');

        console.log('--- DIAGNOSTICS ---');

        // 1. Check for legacy tokens
        const tokensCount = await Token.countDocuments({ serviceType: { $regex: regex } });
        console.log(`Legacy tokens remaining: ${tokensCount}`);

        // 2. Check for logs with legacy keywords in details
        const logsWithKeywords = await ActivityLog.find({ details: regex }).limit(5);
        console.log(`Logs with keywords remaining: ${await ActivityLog.countDocuments({ details: regex })}`);
        logsWithKeywords.forEach(l => console.log(` - [${l.action}] ${l.details}`));

        // 3. Find token IDs from "Token Created" logs that mention legacy services
        // Even if we deleted some, let's see what's left.
        const createLogs = await ActivityLog.find({
            action: 'CREATE_TOKEN',
            details: regex
        });

        const legacyTokenIds = [...new Set(createLogs.map(l => {
            const match = l.details.match(/TOKEN-\d+/);
            return match ? match[0] : null;
        }).filter(id => id))];

        console.log(`Discovered ${legacyTokenIds.length} legacy Token IDs from logs.`);

        // 4. Check for "COMPLETE TOKEN" logs for these IDs
        if (legacyTokenIds.length > 0) {
            const completeLogs = await ActivityLog.countDocuments({
                details: { $regex: new RegExp(legacyTokenIds.join('|')) },
                action: { $in: ['COMPLETE_TOKEN', 'CANCEL_TOKEN', 'TOKEN_COMPLETED', 'TOKEN_CANCELLED'] }
            });
            console.log(`Found ${completeLogs} "Complete/Cancel" logs for discovered legacy token IDs.`);
        }

        process.exit(0);
    } catch (error) {
        console.error('Diag failed:', error);
        process.exit(1);
    }
}

diagnose();
