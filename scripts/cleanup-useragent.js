/**
 * CLEANUP SCRIPT: Remove userAgent field from all ActivityLog entries
 */
require('dotenv').config();
const mongoose = require('mongoose');

// Define a minimal schema for the cleanup if needed, 
// but Mongoose's updateMany handles it fine without strict schema if we use lean/direct.
const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/queuepro_db';

async function cleanup() {
    try {
        console.log('Connecting to MongoDB...');
        await mongoose.connect(mongoURI);
        console.log('Connected successfully.');

        console.log('Starting field removal: userAgent...');

        // Use direct MongoDB driver via mongoose for "unset"
        const result = await mongoose.connection.db.collection('activitylogs').updateMany(
            { userAgent: { $exists: true } },
            { $unset: { userAgent: "" } }
        );

        console.log(`Cleanup complete! Modified ${result.modifiedCount} documents.`);
        process.exit(0);
    } catch (error) {
        console.error('Cleanup failed:', error);
        process.exit(1);
    }
}

cleanup();
