/**
 * One-time script: Drop the unique index on tokenId
 * This is needed because the schema no longer has unique:true on tokenId,
 * but MongoDB keeps old indexes until explicitly dropped.
 * 
 * Run: node scripts/drop-tokenId-index.js
 */
require('dotenv').config();
const mongoose = require('mongoose');

async function run() {
    const uri = process.env.MONGODB_URI;
    if (!uri) {
        console.error('MONGODB_URI not set in .env');
        process.exit(1);
    }
    
    await mongoose.connect(uri.trim());
    console.log('Connected to MongoDB');
    
    const collection = mongoose.connection.collection('tokens');
    
    // List current indexes
    const indexes = await collection.indexes();
    console.log('Current indexes:', JSON.stringify(indexes, null, 2));
    
    // Find and drop the tokenId unique index
    const tokenIdIndex = indexes.find(idx => idx.key && idx.key.tokenId && idx.unique);
    
    if (tokenIdIndex) {
        console.log(`Dropping unique index: ${tokenIdIndex.name}`);
        await collection.dropIndex(tokenIdIndex.name);
        console.log('✅ tokenId unique index dropped successfully!');
    } else {
        console.log('ℹ️  No unique index on tokenId found — nothing to drop.');
    }
    
    // Verify
    const newIndexes = await collection.indexes();
    console.log('Updated indexes:', JSON.stringify(newIndexes, null, 2));
    
    await mongoose.disconnect();
    console.log('Done.');
}

run().catch(err => {
    console.error('Error:', err);
    process.exit(1);
});
