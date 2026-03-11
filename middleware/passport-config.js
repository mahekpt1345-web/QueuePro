const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const User = require('../models/User');

module.exports = (passport) => {
  // ========================================
  // SERIALIZE & DESERIALIZE USER
  // ========================================
  passport.serializeUser((user, done) => {
    done(null, user.id);
  });

  passport.deserializeUser(async (id, done) => {
    try {
      const user = await User.findById(id);
      done(null, user);
    } catch (error) {
      done(error, null);
    }
  });

  const allowOverride = String(process.env.ALLOW_OAUTH_REGISTRATION).toLowerCase() === 'true';

  // Helper to decide if required envs exist
  const missingEnv = (keys) => keys.filter((k) => !process.env[k]);

  // ========================================
  // GOOGLE OAUTH 2.0 STRATEGY (conditional)
  // ========================================
  (function registerGoogle() {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const callbackURL = process.env.GOOGLE_CALLBACK_URL;

    // Check if credentials are missing, empty, or just placeholders
    const isMissingOrPlaceholder = (val) => !val || val.trim() === '' || val.includes('your-google-client');

    if (isMissingOrPlaceholder(clientId) || isMissingOrPlaceholder(clientSecret) || !callbackURL) {
      console.warn('⚠️ Google OAuth disabled: Missing or placeholder credentials in .env');
      return;
    }

    try {
      passport.use(
        'google',
        new GoogleStrategy(
          {
            clientID: clientId,
            clientSecret: clientSecret,
            callbackURL: callbackURL
          },
          async (accessToken, refreshToken, profile, done) => {
            try {
              const email = profile.emails && profile.emails[0] ? profile.emails[0].value : null;
              const name = profile.displayName || profile.name?.givenName || 'User';

              if (!email) {
                return done(null, false, { message: 'No email provided by Google' });
              }

              // Check if user exists with this Google ID
              let user = await User.findOne({ googleId: profile.id });

              if (user) {
                user.lastLogin = new Date();
                await user.save();
                return done(null, user);
              }

              // Check if email already exists (manual registration)
              const existingEmail = await User.findOne({ email });
              if (existingEmail) {
                return done(null, false, { message: 'Email already registered. Please login with your password or reset it.' });
              }

              // Generate unique username from name
              let username = profile.emails[0].value.split('@')[0];
              let counter = 1;
              while (await User.findOne({ username })) {
                username = username + counter;
                counter++;
              }

              // Create new user with Google OAuth
              user = new User({
                googleId: profile.id,
                email,
                name,
                username,
                password: 'oauth-' + profile.id,
                role: 'citizen',
                oauthProvider: 'google',
                phoneVerified: false,
                createdAt: new Date(),
                lastLogin: new Date(),
                isActive: true
              });

              await user.save();
              done(null, user);
            } catch (error) {
              console.error('Error in Google Strategy callback:', error);
              done(error, null);
            }
          }
        )
      );
    } catch (err) {
      console.error('⚠️ Failed to initialize GoogleStrategy:', err.message || err);
    }
  })();

  // ========================================
};
