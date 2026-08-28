const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const mongoose = require('mongoose');

global.activeTokens = global.activeTokens || new Map();

passport.serializeUser((user, done) => {
  done(null, user._id || user.googleId);
});

passport.deserializeUser(async (id, done) => {
  try {
    let user = null;
    if (mongoose.Types.ObjectId.isValid(id) && id.length === 24) {
      const User = require('../models/User');
      user = await User.findById(id).catch(() => null);
    }
    if (!user && global.activeTokens.has(id)) {
      user = global.activeTokens.get(id);
    }
    done(null, user || { _id: id, googleId: id });
  } catch (err) {
    done(null, { _id: id, googleId: id });
  }
});

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: process.env.GOOGLE_CALLBACK_URL || 'http://localhost:5000/oauth2callback',
    },
    async (accessToken, refreshToken, profile, done) => {
      const userPayload = {
        _id: profile.id,
        googleId: profile.id,
        name: profile.displayName,
        email: profile.emails?.[0]?.value || 'user@example.com',
        picture: profile.photos?.[0]?.value,
        accessToken,
        refreshToken,
      };

      global.activeTokens.set(profile.id, userPayload);
      if (userPayload.email) global.activeTokens.set(userPayload.email, userPayload);

      try {
        const User = require('../models/User');
        let user = await User.findOneAndUpdate(
          { googleId: profile.id },
          userPayload,
          { upsert: true, new: true }
        );
        return done(null, user || userPayload);
      } catch (err) {
        console.warn('Using in-memory user fallback:', err.message);
        return done(null, userPayload);
      }
    }
  )
);

module.exports = passport;
