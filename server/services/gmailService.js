const { google } = require('googleapis');
const { simpleParser } = require('mailparser');
const Email = require('../models/Email');
const User = require('../models/User');
const { classifyEmail } = require('./classifier');

/**
 * Get an authorized Gmail client for a specific user
 * @param {Object} user - User document from DB
 * @returns {Object} - Gmail API instance
 */
const getGmailClient = (user) => {
    const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI } = process.env;

    const oauth2Client = new google.auth.OAuth2(
        GOOGLE_CLIENT_ID,
        GOOGLE_CLIENT_SECRET,
        GOOGLE_REDIRECT_URI || 'http://localhost:5000/oauth2callback'
    );

    oauth2Client.setCredentials({
        access_token: user.accessToken,
        refresh_token: user.refreshToken
    });

    return google.gmail({ version: 'v1', auth: oauth2Client });
};

/**
 * Fetch recent emails from Gmail for a specific client
 */
const fetchEmails = async (gmail, maxResults = 10, afterTimestamp = null) => {
    try {
        let query = '';
        if (afterTimestamp) {
            query = `after:${afterTimestamp}`;
        }

        const response = await gmail.users.messages.list({
            userId: 'me',
            maxResults: maxResults,
            q: query
        });

        const messages = response.data.messages || [];
        const emailPromises = messages.map(msg => fetchMessageDetails(gmail, msg.id));
        const emailDetails = await Promise.all(emailPromises);

        return emailDetails.filter(email => email !== null);
    } catch (error) {
        console.error('Error fetching emails:', error.message);
        return [];
    }
};

/**
 * Fetch full message details and parse content
 */
const fetchMessageDetails = async (gmail, messageId) => {
    try {
        const response = await gmail.users.messages.get({
            userId: 'me',
            id: messageId,
            format: 'raw'
        });

        const rawMessage = response.data.raw;
        const messageBuffer = Buffer.from(rawMessage, 'base64url');
        const parsed = await simpleParser(messageBuffer);

        const emailContent = [
            parsed.subject || '',
            parsed.text || '',
            parsed.from?.text || ''
        ].join(' ').substring(0, 5000);

        const classification = await classifyEmail(parsed.subject || '', parsed.text || '');
        const fromEmail = parsed.from?.value?.[0]?.address || parsed.from?.text || 'Unknown';

        return {
            gmailId: messageId,
            from: fromEmail,
            to: parsed.to?.text || '',
            subject: parsed.subject || 'No Subject',
            content: emailContent,
            snippet: (parsed.text || '').substring(0, 200),
            text: parsed.text || '',
            html: parsed.html || '',
            category: classification.category,
            confidence: classification.confidence,
            receivedAt: parsed.date || new Date(),
            processedAt: new Date(),
            raw: rawMessage,
            labels: response.data.labelIds || [],
            hasAttachments: parsed.attachments && parsed.attachments.length > 0,
            threadId: response.data.threadId || ''
        };
    } catch (error) {
        console.error(`Error processing message ${messageId}:`, error.message);
        return null;
    }
};

/**
 * Process and save emails for a specific user
 */
const processAndSaveEmails = async (userEmail, emails) => {
    const savedEmails = [];
    for (const email of emails) {
        try {
            const existing = await Email.findOne({ userEmail, gmailId: email.gmailId });
            if (existing) continue;

            const saved = await Email.create({ ...email, userEmail });
            savedEmails.push(saved);
        } catch (error) {
            console.error(`Error saving email for ${userEmail}:`, error.message);
        }
    }
    return savedEmails;
};

/**
 * Poll for all users in the database
 */
const pollAllUsers = async (io) => {
    try {
        const users = await User.find({ refreshToken: { $exists: true } });
        console.log(`Polling emails for ${users.length} users...`);

        for (const user of users) {
            try {
                const gmail = getGmailClient(user);
                
                // Get last processed timestamp for this specific user
                const lastEmail = await Email.findOne({ userEmail: user.email }).sort({ receivedAt: -1 });
                let lastTimestamp;
                if (lastEmail) {
                    lastTimestamp = Math.floor(lastEmail.receivedAt.getTime() / 1000);
                } else {
                    const yesterday = new Date();
                    yesterday.setHours(yesterday.getHours() - 24);
                    lastTimestamp = Math.floor(yesterday.getTime() / 1000);
                }

                const newEmails = await fetchEmails(gmail, 10, lastTimestamp);
                const savedEmails = await processAndSaveEmails(user.email, newEmails);

                if (savedEmails.length > 0 && io) {
                    savedEmails.forEach(email => {
                        // Emit to user-specific room
                        io.to(`user:${user.email}`).emit('new-email', email);
                    });
                }
            } catch (userError) {
                console.error(`Error polling for ${user.email}:`, userError.message);
            }
        }
    } catch (error) {
        console.error('Error in pollAllUsers:', error.message);
    }
};

/**
 * Send a new email
 */
const sendEmail = async (user, { to, subject, body }) => {
    try {
        const gmail = getGmailClient(user);
        const utf8Subject = `=?utf-8?B?${Buffer.from(subject).toString('base64')}?=`;
        const messageParts = [
            `From: ${user.displayName} <${user.email}>`,
            `To: ${to}`,
            `Content-Type: text/html; charset=utf-8`,
            'MIME-Version: 1.0',
            `Subject: ${utf8Subject}`,
            '',
            body,
        ];
        const message = messageParts.join('\n');
        const encodedMessage = Buffer.from(message)
            .toString('base64')
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=+$/, '');

        const res = await gmail.users.messages.send({
            userId: 'me',
            requestBody: { raw: encodedMessage }
        });
        return res.data;
    } catch (error) {
        console.error('Error sending email:', error.message);
        throw error;
    }
};

/**
 * Reply to an existing email thread
 */
const replyToEmail = async (user, { to, subject, body, threadId, messageId }) => {
    try {
        const gmail = getGmailClient(user);
        const utf8Subject = `=?utf-8?B?${Buffer.from(subject.startsWith('Re:') ? subject : 'Re: ' + subject).toString('base64')}?=`;
        
        const messageParts = [
            `From: ${user.displayName} <${user.email}>`,
            `To: ${to}`,
            `Subject: ${utf8Subject}`,
            `In-Reply-To: ${messageId}`,
            `References: ${messageId}`,
            `Content-Type: text/html; charset=utf-8`,
            'MIME-Version: 1.0',
            '',
            body,
        ];
        const message = messageParts.join('\n');
        const encodedMessage = Buffer.from(message)
            .toString('base64')
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=+$/, '');

        const res = await gmail.users.messages.send({
            userId: 'me',
            requestBody: {
                raw: encodedMessage,
                threadId: threadId
            }
        });
        return res.data;
    } catch (error) {
        console.error('Error replying to email:', error.message);
        throw error;
    }
};

module.exports = {
    getGmailClient,
    fetchEmails,
    pollAllUsers,
    sendEmail,
    replyToEmail
};