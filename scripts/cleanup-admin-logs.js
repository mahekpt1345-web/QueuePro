const mongoose = require('mongoose');
const ActivityLog = require('../models/ActivityLog');
require('dotenv').config();

const cleanupAdminLogs = async () => {
    try {
        const mongoUrl = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/queuepro';
        await mongoose.connect(mongoUrl);
        console.log('Connected to MongoDB.');

        const result = await ActivityLog.deleteMany({
            action: { $regex: /LOGOUT/i }, // Handle 'LOGOUT' and 'LOGOUT (API)'
            userRole: 'admin'
        });

        console.log(`Successfully deleted ${result.deletedCount} admin logout entries.`);
        process.exit(0);
    } catch (error) {
        console.error('Cleanup failed:', error);
        process.exit(1);
    }
};

cleanupAdminLogs();
