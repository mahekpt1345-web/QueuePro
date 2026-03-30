const mongoose = require('mongoose');
const Puzzle = require('../models/Puzzle');
const EngagementContent = require('../models/EngagementContent');
const Token = require('../models/Token');
const User = require('../models/User');

/**
 * Helper to determine difficulty based on wait time
 */
const getDifficultyFromWaitTime = (waitTime) => {
    if (waitTime > 15) return 'hard';
    if (waitTime >= 5) return 'medium';
    return 'easy';
};

/**
 * GET RANDOM PUZZLE
 * GET /api/engagement/puzzle?ageGroup=adults
 */
exports.getRandomPuzzle = async (req, res) => {
    try {
        let { ageGroup } = req.query;
        const userId = req.user.userId || req.user._id;

        if (!['kids', 'teens', 'adults', 'seniors'].includes(ageGroup)) {
            ageGroup = 'adults';
        }

        // 1. Calculate Wait Time
        let waitTime = 0;
        const activeToken = await Token.findOne({ 
            userId: userId, 
            status: { $in: ['pending', 'serving'] } 
        });

        if (activeToken && (activeToken.status === 'pending' || activeToken.status === 'serving')) {
            const countAhead = await Token.countDocuments({
                status: { $in: ['pending', 'serving'] },
                createdAt: { $lt: activeToken.createdAt }
            });
            // Use 7 minutes as a consistent factor matching the dashboard's approx wait
            waitTime = countAhead * 7; 
        }

        const preferredDifficulty = getDifficultyFromWaitTime(waitTime);

        // 2. Database-backed Rotation (User Model)
        const user = await User.findById(userId);
        if (!user.engagementHistory) {
            user.engagementHistory = { puzzles: [], reading: [] };
        }
        
        const shownPuzzles = user.engagementHistory.puzzles || [];
        console.log(`[ENGAGEMENT] Mode: Puzzle, Age: ${ageGroup}, PrefDifficulty: ${preferredDifficulty}, Seen: ${shownPuzzles.length}`);

        let puzzle = null;

        // Try to get a new puzzle from PREFERRED difficulty
        const puzzles = await Puzzle.aggregate([
            { 
                $match: { 
                    ageGroup: ageGroup, 
                    difficulty: preferredDifficulty, 
                    isActive: true,
                    _id: { $nin: shownPuzzles.map(id => new mongoose.Types.ObjectId(id)) }
                } 
            },
            { $sample: { size: 1 } }
        ]);

        if (puzzles.length > 0) {
            puzzle = puzzles[0];
            console.log(`[ENGAGEMENT] Found preferred difficulty puzzle: ${puzzle._id}`);
        } else {
            // FALLBACK 1: Try ANY difficulty for this age group that hasn't been seen
            console.log(`[ENGAGEMENT] Preferred difficulty ${preferredDifficulty} exhausted. Trying any difficulty for ${ageGroup}...`);
            const fallbackPuzzles = await Puzzle.aggregate([
                { 
                    $match: { 
                        ageGroup: ageGroup, 
                        isActive: true,
                        _id: { $nin: shownPuzzles.map(id => new mongoose.Types.ObjectId(id)) }
                    } 
                },
                { $sample: { size: 1 } }
            ]);

            if (fallbackPuzzles.length > 0) {
                puzzle = fallbackPuzzles[0];
                console.log(`[ENGAGEMENT] Found fallback difficulty puzzle: ${puzzle._id}`);
            } else {
                // FALLBACK 2: Everything for this age group exhausted - RESET but keep some history
                console.log(`[ENGAGEMENT] Entire age group ${ageGroup} exhausted. Resetting history except last 10.`);
                
                // Clear history for this user for this category (resetting the pool)
                // but keep the most recent ones to prevent immediate repeats
                user.engagementHistory.puzzles = shownPuzzles.slice(-10);
                
                // Now try again from preferred
                const resetPuzzles = await Puzzle.aggregate([
                    { $match: { ageGroup: ageGroup, difficulty: preferredDifficulty, isActive: true } },
                    { $sample: { size: 1 } }
                ]);
                
                if (resetPuzzles.length > 0) {
                    puzzle = resetPuzzles[0];
                    console.log(`[ENGAGEMENT] Reset successful. Found: ${puzzle._id}`);
                } else {
                    // ULTIMATE FALLBACK: Any puzzle at all
                    console.log(`[ENGAGEMENT] Ultimate fallback - returning ANY puzzle.`);
                    puzzle = (await Puzzle.aggregate([
                        { $match: { isActive: true } },
                        { $sample: { size: 1 } }
                    ]))[0];
                }
            }
        }

        if (puzzle) {
            const pId = puzzle._id;
            // Add to shown history if not there
            if (!user.engagementHistory.puzzles.some(id => id.toString() === pId.toString())) {
                user.engagementHistory.puzzles.push(pId);
            }
            if (user.engagementHistory.puzzles.length > 200) user.engagementHistory.puzzles.shift();
            
            await user.save();

            return res.json({
                success: true,
                data: puzzle,
                meta: { waitTime, difficulty: puzzle.difficulty, ageGroup }
            });
        }

        res.status(404).json({ success: false, message: 'No puzzles found' });

    } catch (error) {
        console.error('Error fetching puzzle:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

/**
 * GET RANDOM READING CONTENT
 */
exports.getRandomReading = async (req, res) => {
    try {
        let { ageGroup } = req.query;
        const userId = req.user.userId || req.user._id;

        if (!['kids', 'teens', 'adults', 'seniors'].includes(ageGroup)) {
            ageGroup = 'adults';
        }

        const user = await User.findById(userId);
        if (!user.engagementHistory) {
            user.engagementHistory = { puzzles: [], reading: [] };
        }

        const shownReading = user.engagementHistory.reading || [];
        console.log(`[ENGAGEMENT] Mode: Reading, Age: ${ageGroup}, Seen: ${shownReading.length}`);

        const readings = await EngagementContent.aggregate([
            { 
                $match: { 
                    ageGroup: { $in: [ageGroup, 'all'] }, 
                    isActive: true,
                    _id: { $nin: shownReading.map(id => new mongoose.Types.ObjectId(id)) }
                } 
            },
            { $sample: { size: 1 } }
        ]);

        let content = readings[0];

        if (!content) {
            console.log(`[ENGAGEMENT] Reading pool exhausted. Resetting history except last 10.`);
            user.engagementHistory.reading = shownReading.slice(-10);
            
            content = (await EngagementContent.aggregate([
                { $match: { ageGroup: { $in: [ageGroup, 'all'] }, isActive: true } },
                { $sample: { size: 1 } }
            ]))[0];
            
            if (!content) {
                // Ultimate fallback
                content = (await EngagementContent.aggregate([
                    { $match: { isActive: true } },
                    { $sample: { size: 1 } }
                ]))[0];
            }
        }

        if (content) {
            const cId = content._id;
            if (!user.engagementHistory.reading.some(id => id.toString() === cId.toString())) {
                user.engagementHistory.reading.push(cId);
            }
            if (user.engagementHistory.reading.length > 200) user.engagementHistory.reading.shift();
            
            await user.save();

            return res.json({
                success: true,
                data: content,
                meta: { ageGroup }
            });
        }

        res.status(404).json({ success: false, message: 'No reading content found' });

    } catch (error) {
        console.error('Error fetching reading:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

/**
 * Legacy support for common endpoint
 */
exports.getContent = async (req, res) => {
    if (req.query.type === 'reading') return exports.getRandomReading(req, res);
    return exports.getRandomPuzzle(req, res);
};

exports.addPuzzle = async (req, res) => {
    try {
        const puzzle = new Puzzle(req.body);
        await puzzle.save();
        res.status(201).json({ success: true, data: puzzle });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

exports.addReading = async (req, res) => {
    try {
        const reading = new EngagementContent(req.body);
        await reading.save();
        res.status(201).json({ success: true, data: reading });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};
