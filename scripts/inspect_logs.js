const mongoose = require('mongoose');
require('dotenv').config();
const ActivityLog = require('../models/ActivityLog');
const connectDB = require('../config/database');

async function inspect() {
    try {
        await connectDB();
        const tid = 'TOKEN-28463295';
        const logs = await ActivityLog.find({ details: { $regex: tid } });
        console.log(`--- LOGS FOR ${tid} ---`);
        logs.forEach(l => {
            console.log(`ID: ${l._id} | Action: ${l.action} | Details: "${l.details}"`);
        });

        // Also check for license and tax keywords strictly
        console.log('\n--- KEYWORD SEARCH ---');
        const keywords = ['passport', 'license', 'tax', 'certificate', 'driving'];
        for (const k of keywords) {
            const count = await ActivityLog.countDocuments({ details: { $regex: new RegExp(k, 'i') } });
            console.log(`Keyword "${k}": ${count} found`);
            if (count > 0) {
                const sample = await ActivityLog.findOne({ details: { $regex: new RegExp(k, 'i') } });
                console.log(` - Sample: "${sample.details}"`);
            }
        }

        process.exit(0);
    } catch (error) {
        console.error('Inspect failed:', error);
        process.exit(1);
    }
}

inspect();
