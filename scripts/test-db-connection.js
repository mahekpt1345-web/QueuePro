require('dotenv').config();
const mongoose = require('mongoose');

async function testConnection() {
    const uri = process.env.MONGODB_URI;
    console.log('Testing connection to:', uri.replace(/:([^@]+)@/, ':****@')); // Hide password

    try {
        console.log('Attempting to connect...');
        await mongoose.connect(uri, {
            serverSelectionTimeoutMS: 5000, // Timeout after 5s
        });
        console.log('SUCCESS: Connected to MongoDB.');
        process.exit(0);
    } catch (err) {
        console.error('FAILURE: Could not connect to MongoDB.');
        console.error('Error Name:', err.name);
        console.error('Error Message:', err.message);

        if (err.message.includes('ETIMEOUT') || err.message.includes('querySrv')) {
            console.log('\n--- TROUBLESHOOTING TIPS ---');
            console.log('1. DNS ISSUE: Your network cannot resolve the MongoDB cluster address.');
            console.log('   Fix: Try changing your DNS settings to 8.8.8.8 (Google DNS).');
            console.log('2. IP WHITELIST: Your current IP might not be allowed in Atlas.');
            console.log('   Fix: Go to MongoDB Atlas > Network Access and click "Add Current IP Address".');
            console.log('3. FIREWALL: Port 27017 or DNS SRV might be blocked.');
        }
        process.exit(1);
    }
}

testConnection();
