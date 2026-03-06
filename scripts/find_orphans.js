const mongoose = require('mongoose');
require('dotenv').config();
const ActivityLog = require('../models/ActivityLog');
const connectDB = require('../config/database');

async function findOrphans() {
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

        // 1. Find all token IDs that have a "CREATE_TOKEN" log for a VALID service
        const validCreateLogs = await ActivityLog.find({
            action: 'CREATE_TOKEN',
            details: validRegex
        });

        const validTokenIds = new Set(validCreateLogs.map(l => {
            const match = l.details.match(/TOKEN-\d+/);
            return match ? match[0] : null;
        }).filter(id => id));

        console.log(`Valid Token IDs: ${Array.from(validTokenIds).join(', ')}`);

        // 2. Find all token IDs mentioned in ANY log
        const allLogs = await ActivityLog.find({ details: /TOKEN-\d+/ });
        const allTokenIds = new Set(allLogs.map(l => {
            const match = l.details.match(/TOKEN-\d+/);
            return match ? match[0] : null;
        }).filter(id => id));

        // 3. IDs that are in allLogs but not validTokenIds are orphans (likely legacy)
        const orphanTokenIds = Array.from(allTokenIds).filter(id => !validTokenIds.has(id));

        console.log(`Orphan Token IDs (Legacy candidates): ${orphanTokenIds.join(', ')}`);

        if (orphanTokenIds.length > 0) {
            console.log('\n--- ORPHAN LOG DETAILS ---');
            for (const id of orphanTokenIds) {
                const logs = await ActivityLog.find({ details: { $regex: id } });
                console.log(`Token ${id}:`);
                logs.forEach(l => console.log(` - [${l.action}] ${l.details}`));
            }
        }

        process.exit(0);
    } catch (error) {
        process.exit(1);
    }
}

findOrphans();
