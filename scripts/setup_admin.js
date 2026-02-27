/**
 * SETUP ADMIN SCRIPT
 * Removes demo users from database and ensures admin account exists.
 * Run: node scripts/setup_admin.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const User = require('../models/User');
const Token = require('../models/Token');

const MONGO_URI = process.env.MONGODB_URI || 'mongodb+srv://queuepro_user:root%40123@cluster.ayfkpr3.mongodb.net/queuepro';

async function setupAdmin() {
    console.log('\n🔧 QueuePro Database Setup\n');
    console.log('Connecting to MongoDB...');

    await mongoose.connect(MONGO_URI);
    console.log('✅ Connected to MongoDB\n');

    // ─── 1. Remove demo users ──────────────────────────────────────────
    console.log('🧹 Removing demo users...');
    const demoResult = await User.deleteMany({
        $or: [
            { username: /^demo_/i },
            { username: { $in: ['demo_citizen', 'demo_citizen2', 'demo_officer', 'demo_officer2'] } },
            { email: /demo@queuepro\.com$/i },
            { email: /citizen@queuepro\.com$/i },
            { email: /officer@queuepro\.com$/i }
        ]
    });
    console.log(`   Removed ${demoResult.deletedCount} demo user(s)\n`);

    // ─── 2. Ensure admin account exists ────────────────────────────────
    console.log('👤 Checking admin account...');
    let admin = await User.findOne({ username: 'mahek', role: 'admin' });
    if (!admin) {
        admin = new User({
            username: 'mahek',
            email: 'mahek@queuepro.admin',
            password: 'mahek2013',   // will be bcrypt-hashed by pre-save hook
            name: 'Mahek Admin',
            role: 'admin'
        });
        await admin.save();
        console.log('   ✅ Admin account created: mahek / mahek2013\n');
    } else {
        console.log(`   ✅ Admin account exists: ${admin.username}\n`);
    }

    // ─── 3. Show current users ─────────────────────────────────────────
    const users = await User.find().select('username email role createdAt').sort({ role: 1, createdAt: -1 });
    console.log(`📋 Current users in database (${users.length} total):\n`);
    const grouped = { admin: [], officer: [], citizen: [] };
    users.forEach(u => { if (grouped[u.role]) grouped[u.role].push(u); });
    ['admin', 'officer', 'citizen'].forEach(role => {
        if (grouped[role].length > 0) {
            console.log(`  ${role.toUpperCase()}S (${grouped[role].length}):`);
            grouped[role].forEach(u => console.log(`    - ${u.username} (${u.email})`));
            console.log('');
        }
    });

    // ─── 4. Show token stats ───────────────────────────────────────────
    const [total, pending, serving, completed, cancelled] = await Promise.all([
        Token.countDocuments(),
        Token.countDocuments({ status: 'pending' }),
        Token.countDocuments({ status: 'serving' }),
        Token.countDocuments({ status: 'completed' }),
        Token.countDocuments({ status: 'cancelled' })
    ]);
    console.log('📊 Token Statistics:');
    console.log(`   Total: ${total} | Pending: ${pending} | Serving: ${serving} | Completed: ${completed} | Cancelled: ${cancelled}\n`);

    await mongoose.disconnect();
    console.log('✅ Setup complete!\n');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('  Admin Login: mahek / mahek2013');
    console.log('  URL: http://localhost:5000/admin-login');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

setupAdmin().catch(err => {
    console.error('❌ Setup failed:', err.message);
    process.exit(1);
});
