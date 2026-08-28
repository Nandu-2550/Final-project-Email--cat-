const express = require('express');
const router = express.Router();
const { google } = require('googleapis');
const requireAuth = require('../middleware/auth');
const { classifyEmail } = require('../services/classifier');

// Helper to get authorized Gmail client
const getGmailClient = (user) => {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  );
  oauth2Client.setCredentials({ access_token: user.accessToken });
  return google.gmail({ version: 'v1', auth: oauth2Client });
};

// 1. GET /api/emails - Fetch and classify latest inbox messages
router.get('/', requireAuth, async (req, res) => {
  try {
    const user = req.user;
    if (!user || !user.accessToken) {
      console.warn('No active Google access token found for user.');
      return res.json({ success: true, emails: [] });
    }

    const gmail = getGmailClient(user);
    const response = await gmail.users.messages.list({
      userId: 'me',
      maxResults: 15,
      q: 'in:inbox',
    });

    const messages = response.data.messages || [];
    if (messages.length === 0) {
      return res.json({ success: true, emails: [] });
    }

    const emailList = await Promise.all(
      messages.map(async (msg) => {
        try {
          const detail = await gmail.users.messages.get({ userId: 'me', id: msg.id });
          const headers = detail.data.payload.headers;
          const subject = headers.find((h) => h.name.toLowerCase() === 'subject')?.value || '(No Subject)';
          const from = headers.find((h) => h.name.toLowerCase() === 'from')?.value || 'Unknown Sender';
          const date = headers.find((h) => h.name.toLowerCase() === 'date')?.value || new Date().toISOString();
          const snippet = detail.data.snippet || '';

          // Classify email with NVIDIA NIM
          const category = await classifyEmail(subject, snippet);

          return {
            id: msg.id,
            subject,
            from,
            snippet,
            date,
            category: category || 'Primary',
            isRead: !detail.data.labelIds?.includes('UNREAD'),
          };
        } catch (e) {
          return null;
        }
      })
    );

    return res.json({ success: true, emails: emailList.filter(Boolean) });
  } catch (err) {
    console.error('Error in GET /api/emails:', err.message);
    return res.json({ success: true, emails: [] });
  }
});

// 2. POST /api/emails/send - Send an email via Gmail API
router.post('/send', requireAuth, async (req, res) => {
  try {
    const { to, subject, message } = req.body;
    const user = req.user;

    if (!user || !user.accessToken) {
      return res.status(401).json({ success: false, message: 'Google access token missing' });
    }

    const gmail = getGmailClient(user);

    // Construct raw RFC 2822 email message
    const utf8Subject = `=?utf-8?B?${Buffer.from(subject || '').toString('base64')}?=`;
    const messageParts = [
      `From: <${user.email}>`,
      `To: <${to}>`,
      'Content-Type: text/html; charset=utf-8',
      'MIME-Version: 1.0',
      `Subject: ${utf8Subject}`,
      '',
      message,
    ];
    const rawMessage = messageParts.join('\n');
    const encodedMessage = Buffer.from(rawMessage)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    const sentResult = await gmail.users.messages.send({
      userId: 'me',
      requestBody: {
        raw: encodedMessage,
      },
    });

    return res.json({ success: true, result: sentResult.data });
  } catch (error) {
    console.error('Error in POST /api/emails/send:', error.message);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// 3. GET /api/emails/stats
router.get('/stats', requireAuth, async (req, res) => {
  res.json({
    success: true,
    stats: { total: 0, unread: 0, categories: { Primary: 0, Social: 0, Promotions: 0, Updates: 0, Spam: 0 } },
  });
});

module.exports = router;