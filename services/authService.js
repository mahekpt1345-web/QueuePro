const User = require('../models/User');
const jwt = require('jsonwebtoken');
const config = require('../config');

/**
 * AUTH SERVICE
 * Handles business logic for user authentication and tokens.
 */
class AuthService {
    /**
     * Login user and generate token
     */
    async login(username, password) {
        // Business logic for user login
        const user = await User.findOne({ username });
        if (!user) throw new Error('Invalid credentials');

        const isMatch = await user.comparePassword(password);
        if (!isMatch) throw new Error('Invalid credentials');

        const token = jwt.sign(
            { userId: user._id, username: user.username, role: user.role, name: user.name },
            config.auth.jwtSecret,
            { expiresIn: config.auth.tokenExpiry }
        );

        return { token, user: { id: user._id, username: user.username, role: user.role, name: user.name, email: user.email } };
    }

    /**
     * Register new citizen
     */
    async register(userData) {
        const { fullName, email, username, password, phone } = userData;

        const existing = await User.findOne({ $or: [{ username }, { email }] });
        if (existing) throw new Error('Username or email already exists');

        const newUser = new User({
            name: fullName,
            email,
            username,
            password,
            phone,
            role: 'citizen'
        });

        await newUser.save();
        return newUser;
    }
    /**
     * Admin login (hardcoded and DB support)
     */
    async adminLogin(username, password) {
        // Hardcoded admin check
        const hardcodedAdmin = { _id: 'admin_001', username: 'mahek', password: 'mahek2013', name: 'System Admin', email: 'admin@queuepro.local', role: 'admin' };
        
        if (username === hardcodedAdmin.username && password === hardcodedAdmin.password) {
            const token = jwt.sign(
                { userId: hardcodedAdmin._id, username: hardcodedAdmin.username, role: 'admin', name: hardcodedAdmin.name },
                config.auth.jwtSecret,
                { expiresIn: config.auth.tokenExpiry }
            );
            return { token, user: hardcodedAdmin };
        }

        // DB admin check
        const user = await User.findOne({ username, role: 'admin' });
        if (!user) throw new Error('Invalid admin credentials');

        const isMatch = await user.comparePassword(password);
        if (!isMatch) throw new Error('Invalid admin credentials');

        const token = jwt.sign(
            { userId: user._id, username: user.username, role: user.role, name: user.name },
            config.auth.jwtSecret,
            { expiresIn: config.auth.tokenExpiry }
        );

        return { token, user: { id: user._id, username: user.username, role: user.role, name: user.name } };
    }
}

module.exports = new AuthService();
