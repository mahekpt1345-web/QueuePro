const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const AppleStrategy = require('passport-apple').Strategy;
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
    const required = ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GOOGLE_CALLBACK_URL'];
    const missing = missingEnv(required);
    if (missing.length && !allowOverride) {
      console.warn(
        `Google OAuth not registered. Missing env: ${missing.join(', ')}. Set these or set ALLOW_OAUTH_REGISTRATION=true to force registration.`
      );
      return;
    }

    try {
      passport.use(
        'google',
        new GoogleStrategy(
          {
            clientID: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
            callbackURL: process.env.GOOGLE_CALLBACK_URL
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
              done(error, null);
            }
          }
        )
      );
    } catch (err) {
      console.error('Failed to initialize GoogleStrategy:', err.message || err);
    }
  })();

  // ========================================
  // APPLE OAUTH STRATEGY (conditional)
  // ========================================
  (function registerApple() {
    const required = ['APPLE_SERVICE_ID', 'APPLE_TEAM_ID', 'APPLE_KEY_ID', 'APPLE_PRIVATE_KEY', 'APPLE_CALLBACK_URL'];
    const missing = missingEnv(required);
    if (missing.length && !allowOverride) {
      console.warn(
        `Apple OAuth not registered. Missing env: ${missing.join(', ')}. Add these or set ALLOW_OAUTH_REGISTRATION=true to force registration.`
      );
      return;
    }

    try {
      passport.use(
        'apple',
        new AppleStrategy(
          {
            clientID: process.env.APPLE_SERVICE_ID,
            teamID: process.env.APPLE_TEAM_ID,
            keyID: process.env.APPLE_KEY_ID,
            privateKeyString: process.env.APPLE_PRIVATE_KEY,
            callbackURL: process.env.APPLE_CALLBACK_URL
          },
          async (accessToken, refreshToken, idToken, user, done) => {
            try {
              const email = user?.email;
              const name = user?.name?.firstName && user?.name?.lastName
                ? `${user.name.firstName} ${user.name.lastName}`
                : user?.name?.firstName || 'Apple User';

              if (!email) {
                return done(null, false, { message: 'No email provided by Apple' });
              }

              // Check if user exists with this Apple ID
              let existingUser = await User.findOne({ appleId: user.sub });

              if (existingUser) {
                existingUser.lastLogin = new Date();
                await existingUser.save();
                return done(null, existingUser);
              }

              // Check if email already exists
              const existingEmail = await User.findOne({ email });
              if (existingEmail) {
                return done(null, false, { message: 'Email already registered. Please login with your password or reset it.' });
              }

              // Generate unique username from email
              let username = email.split('@')[0];
              let counter = 1;
              while (await User.findOne({ username })) {
                username = username + counter;
                counter++;
              }

              // Create new user with Apple OAuth
              existingUser = new User({
                appleId: user.sub,
                email,
                name,
                username,
                password: 'oauth-' + user.sub,
                role: 'citizen',
                oauthProvider: 'apple',
                phoneVerified: false,
                createdAt: new Date(),
                lastLogin: new Date(),
                isActive: true
              });

              await existingUser.save();
              done(null, existingUser);
            } catch (error) {
              done(error, null);
            }
          }
        )
      );
    } catch (err) {
      console.error('Failed to initialize AppleStrategy:', err.message || err);
    }
  })();
};
