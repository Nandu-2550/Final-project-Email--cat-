const express = require('express');
const router = express.Router();
const passport = require('passport');
const requireAuth = require('../middleware/auth');

router.get(
  '/google',
  passport.authenticate('google', {
    scope: [
      'profile',
      'email',
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/gmail.send',
    ],
    accessType: 'offline',
    prompt: 'consent',
  })
);

router.get('/oauth2callback', (req, res, next) => {
  passport.authenticate('google', { session: true }, (err, user) => {
    if (err || !user) {
      console.error('OAuth Callback Failed:', err);
      return res.redirect('http://localhost:3000/?error=auth_failed');
    }

    req.logIn(user, (loginErr) => {
      const token = user.googleId || user._id?.toString();
      const userPayload = encodeURIComponent(
        JSON.stringify({
          id: token,
          name: user.name,
          email: user.email,
          picture: user.picture || user.avatar,
        })
      );

      return res.redirect(`http://localhost:3000/dashboard?auth_success=true&token=${token}&user=${userPayload}`);
    });
  })(req, res, next);
});

router.get('/user', requireAuth, (req, res) => {
  res.json({ success: true, user: req.user });
});

router.get('/logout', (req, res) => {
  req.logout((err) => {
    req.session?.destroy(() => {
      res.clearCookie('connect.sid');
      res.json({ success: true });
    });
  });
});

module.exports = router;
