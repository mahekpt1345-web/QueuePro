/**
 * SEED SCRIPT - Admin only
 * Creates the admin account if it doesn't exist.
 * Does NOT create demo users.
 * Run: node scripts/seed.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const User = require('../models/User');

const MONGO_URI = process.env.MONGODB_URI || 'mongodb+srv://queuepro_user:root%40123@cluster.ayfkpr3.mongodb.net/queuepro';

async function seed() {
    console.log('\n🌱 QueuePro Seed Script\n');
    await mongoose.connect(MONGO_URI);
    console.log('✅ Connected to MongoDB\n');

    // Create admin if not exists
    const existing = await User.findOne({ username: 'mahek', role: 'admin' });
    if (existing) {
        console.log('ℹ️  Admin account already exists. Skipping.\n');
    } else {
        const admin = new User({
            username: 'mahek',
            email: 'mahek@queuepro.admin',
            password: 'mahek2013',
            name: 'Mahek Admin',
            role: 'admin'
        });
        await admin.save();
        console.log('✅ Admin account created: mahek / mahek2013\n');
    }

    await mongoose.disconnect();
    console.log('✅ Seed complete.\n');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('  Admin: mahek / mahek2013');
    console.log('  URL: http://localhost:5000/admin-login');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

seed().catch(err => {
    console.error('❌ Seed failed:', err.message);
    process.exit(1);
});
