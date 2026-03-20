const mongoose = require('mongoose');
const ActivityLog = require('../models/ActivityLog');
require('dotenv').config();

const findDuplicates = async () => {
    try {
        const mongoUrl = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/queuepro';
        await mongoose.connect(mongoUrl);
        console.log('Connected to MongoDB.');

        // Find all logout logs for non-admins
        const logs = await ActivityLog.find({
            action: { $regex: /LOGOUT/i },
            userRole: { $ne: 'admin' }
        }).sort({ createdAt: 1 });

        console.log(`Found ${logs.length} logout logs for non-admins.`);

        const toDelete = [];
        for (let i = 0; i < logs.length - 1; i++) {
            const current = logs[i];
            const next = logs[i+1];

            // If same user and close in time (within 10 seconds)
            if (current.username === next.username && 
                Math.abs(next.createdAt - current.createdAt) < 10000) {
                console.log(`Potential duplicate: user ${current.username} at ${current.createdAt} and ${next.createdAt}`);
                toDelete.push(next._id);
                i++; // Skip the next one as it's a duplicate of current
            }
        }

        if (toDelete.length > 0) {
            const res = await ActivityLog.deleteMany({ _id: { $in: toDelete } });
            console.log(`Deleted ${res.deletedCount} duplicate logout entries.`);
        } else {
            console.log('No duplicates found.');
        }

        process.exit(0);
    } catch (error) {
        console.error('Check failed:', error);
        process.exit(1);
    }
};

findDuplicates();
