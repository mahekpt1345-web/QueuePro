const mongoose = require('mongoose');
require('dotenv').config();
const ActivityLog = require('../models/ActivityLog');
const connectDB = require('../config/database');

async function cleanupOrphans() {
    try {
        await connectDB();

        const validServices = [
            'aadhaar_update',
            'caste_certificate_verification',
            'income_certificate_verification',
            'birth_certificate_verification',
            'municipal_enquiry',
            'other'
        ];
        const validRegex = new RegExp(validServices.join('|'), 'i');

        console.log('--- Step 1: Identifying Valid Token IDs ---');
        const validCreateLogs = await ActivityLog.find({
            action: 'CREATE_TOKEN',
            details: validRegex
        });

        const validTokenIds = new Set(validCreateLogs.map(l => {
            const match = l.details.match(/TOKEN-\d+/);
            return match ? match[0] : null;
        }).filter(id => id));

        console.log(`Found ${validTokenIds.size} valid Token IDs.`);

        console.log('\n--- Step 2: Identifying Legacy Token IDs ---');
        const allLogs = await ActivityLog.find({ details: /TOKEN-\d+/ });
        const allTokenIds = new Set(allLogs.map(l => {
            const match = l.details.match(/TOKEN-\d+/);
            return match ? match[0] : null;
        }).filter(id => id));

        const orphanTokenIds = Array.from(allTokenIds).filter(id => !validTokenIds.has(id));
        console.log(`Found ${orphanTokenIds.length} legacy/orphaned Token IDs.`);

        if (orphanTokenIds.length > 0) {
            console.log('\n--- Step 3: Deleting orphaned logs ---');
            // We use a regex to match any of the orphan IDs in the details string
            const orphanRegex = new RegExp(orphanTokenIds.join('|'));
            const result = await ActivityLog.deleteMany({ details: { $regex: orphanRegex } });
            console.log(`Successfully deleted ${result.deletedCount} orphaned log entries.`);
        } else {
            console.log('\nNo orphaned logs found.');
        }

        console.log('\nCleanup complete.');
        process.exit(0);
    } catch (error) {
        console.error('Cleanup failed:', error);
        process.exit(1);
    }
}

cleanupOrphans();
