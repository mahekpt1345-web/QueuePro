/**
 * GAP ANALYSIS: How many logs are missing?
 */
require('dotenv').config();
const mongoose = require('mongoose');

const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/queuepro_db';

async function analyzeGap() {
    try {
        await mongoose.connect(mongoURI);
        const db = mongoose.connection.db;

        const tokens = await db.collection('tokens').find().toArray();
        const logs = await db.collection('activitylogs').find().toArray();
        const users = await db.collection('users').find().toArray();

        console.log(`Summary: ${tokens.length} Tokens, ${users.length} Users, ${logs.length} Activity Logs`);

        let missingTokenLogs = 0;
        tokens.forEach(t => {
            const hasLog = logs.some(l => l.action === 'CREATE_TOKEN' && l.resourceId === t.tokenId);
            if (!hasLog) missingTokenLogs++;
        });

        let missingUserLogs = 0;
        users.forEach(u => {
            const hasLog = logs.some(l => l.action === 'REGISTER' && l.userId.toString() === u._id.toString());
            if (!hasLog) missingUserLogs++;
        });

        console.log(`\n--- Gap Analysis ---`);
        console.log(`Tokens missing CREATE_TOKEN log: ${missingTokenLogs}`);
        console.log(`Users missing REGISTER log:      ${missingUserLogs}`);

        process.exit(0);
    } catch (error) {
        console.error('Analysis failed:', error);
        process.exit(1);
    }
}

analyzeGap();
