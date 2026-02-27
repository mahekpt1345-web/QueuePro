/**
 * CAPPED CHECK: Check if activitylogs collection is capped
 */
require('dotenv').config();
const mongoose = require('mongoose');

const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/queuepro_db';

async function checkCapped() {
    try {
        await mongoose.connect(mongoURI);
        const db = mongoose.connection.db;

        const stats = await db.command({ collStats: 'activitylogs' });
        console.log('--- activitylogs Stats ---');
        console.log(`Capped: ${stats.capped}`);
        if (stats.capped) {
            console.log(`Max Documents: ${stats.max}`);
            console.log(`Max Size: ${stats.size}`);
        }
        console.log(`Total Documents: ${stats.count}`);

        process.exit(0);
    } catch (error) {
        console.error('Check failed:', error);
        process.exit(1);
    }
}

checkCapped();
