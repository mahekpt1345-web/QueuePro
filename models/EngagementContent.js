/**
 * ENGAGEMENT CONTENT MODEL
 * Future feature: Content to keep citizens engaged while waiting in queue.
 * UI not implemented yet - schema only for architecture preparation.
 *
 * Planned feature types:
 *   - puzzle: Logic puzzles / quiz questions
 *   - quote: Motivational or informational quotes
 *   - reading: Short informational articles or tips
 */

const mongoose = require('mongoose');

const engagementContentSchema = new mongoose.Schema({
    type: {
        type: String,
        enum: ['quote', 'reading', 'poetry', 'fact', 'tip', 'info'],
        required: true
    },
    content: {
        type: String,
        required: true
    },
    ageGroup: {
        type: String,
        enum: ['kids', 'teens', 'adults', 'seniors', 'all'],
        default: 'all'
    },
    isActive: {
        type: Boolean,
        default: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

const EngagementContent = mongoose.model('EngagementContent', engagementContentSchema);
module.exports = EngagementContent;
