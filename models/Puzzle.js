const mongoose = require('mongoose');

const puzzleSchema = new mongoose.Schema({
    question: {
        type: String,
        required: true
    },
    answer: {
        type: String,
        required: true
    },
    category: {
        type: String,
        enum: ['spot-difference', 'emoji', 'logic', 'word', 'pattern', 'math'],
        required: true
    },
    difficulty: {
        type: String,
        enum: ['easy', 'medium', 'hard'],
        required: true
    },
    ageGroup: {
        type: String,
        enum: ['kids', 'teens', 'adults', 'seniors'],
        required: true
    },
    options: [{
        type: String
    }],
    isActive: {
        type: Boolean,
        default: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

const Puzzle = mongoose.model('Puzzle', puzzleSchema);
module.exports = Puzzle;
