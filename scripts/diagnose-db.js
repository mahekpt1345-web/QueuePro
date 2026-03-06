/**
 * DIAGNOSTIC SCRIPT: Check ActivityLog and User collection counts
 */
require('dotenv').config();
const mongoose = require('mongoose');

const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/queuepro_db';

async function diagnose() {
    try {
        console.log('Connecting to:', mongoURI);
        await mongoose.connect(mongoURI);
        console.log('Connected.');

        const db = mongoose.connection.db;
        const collections = await db.listCollections().toArray();
        console.log('Collections in DB:', collections.map(c => c.name));

        const activityCount = await db.collection('activitylogs').countDocuments();
        const userCount = await db.collection('users').countDocuments();
        const tokenCount = await db.collection('tokens').countDocuments();

        console.log('\n--- Database Stats ---');
        console.log(`Activity Logs: ${activityCount}`);
        console.log(`Users:         ${userCount}`);
        console.log(`Tokens:        ${tokenCount}`);

        if (activityCount > 0) {
            console.log('\n--- Last 5 Activity Logs ---');
            const recent = await db.collection('activitylogs')
                .find()
                .sort({ createdAt: -1 })
                .limit(5)
                .toArray();

            recent.forEach(log => {
                console.log(`[${log.createdAt.toISOString()}] ${log.action}: ${log.username} (${log.status})`);
            });
        }

        process.exit(0);
    } catch (error) {
        console.error('Diagnosis failed:', error);
        process.exit(1);
    }
}

diagnose();
