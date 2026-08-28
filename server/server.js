require('dotenv').config();
/**
 * LiveMail Classifier - Main Server
 * Real-time email categorization with Gmail API and NLP
 */

const express = require('express');
const http = require('http');

// Global error handlers to prevent server crashes from unhandled promise rejections (like MongoDB timeouts)
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
});

const { Server } = require('socket.io');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const connectDB = require('./config/database');
const { loadClassifier, isTrained } = require('./services/classifier');
const { pollAllUsers } = require('./services/gmailService');
const emailRoutes = require('./routes/emailRoutes');
const authRoutes = require('./routes/authRoutes');
const passport = require('./config/passport');
const session = require('express-session');
const MongoStore = require('connect-mongo').default;

// Initialize Express app
const app = express();
const server = http.createServer(app);

// Socket.io setup with CORS
const io = new Server(server, {
    cors: {
        origin: ['http://localhost:3000', 'http://127.0.0.1:3000'],
        methods: ['GET', 'POST'],
        credentials: true
    },
    transports: ['polling', 'websocket'] // Allow polling fallback first
});

// Store io in app for access in routes
app.set('io', io);

// Configuration
const PORT = process.env.PORT || 5000;
const POLL_INTERVAL = parseInt(process.env.GMAIL_POLL_INTERVAL) || 60000; // 60 seconds default

// Middleware
app.use(cors({
    origin: ['http://localhost:3000', 'http://127.0.0.1:3000'],
    credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Sessions
app.use(session({
    secret: process.env.SESSION_SECRET || 'livemail_dev_session_secret_key',
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({ mongoUrl: process.env.MONGO_URI }),
    cookie: {
        secure: false, // Must be false for local HTTP development
        httpOnly: true,
        sameSite: 'lax',
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
}));

// Passport middleware
app.use(passport.initialize());
app.use(passport.session());

// Request logging middleware
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
    next();
});

// Apply rate limiting to all API routes
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per window
    standardHeaders: true,
    legacyHeaders: false,
    message: 'Too many requests from this IP, please try again after 15 minutes'
});

app.use('/api', apiLimiter);

// Routes
app.use('/auth', authRoutes);
app.use('/api/auth', authRoutes);
app.use('/', authRoutes); // Handles root /oauth2callback, /user, /logout
app.use('/api/emails', emailRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        service: 'LiveMail Classifier',
        version: '1.0.0'
    });
});

// Root endpoint
app.get('/', (req, res) => {
    res.json({
        message: 'LiveMail Classifier API',
        endpoints: {
            health: '/api/health',
            emails: '/api/emails',
            stats: '/api/emails/stats',
            test: '/api/emails/test-broadcast'
        }
    });
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Server error:', err);
    res.status(500).json({
        success: false,
        error: 'Internal server error'
    });
});

// Socket.io connection handling
io.on('connection', (socket) => {
    console.log(`Client connected: ${socket.id}`);

    // Join a private room based on user email
    socket.on('join-room', (userEmail) => {
        if (userEmail) {
            socket.join(`user:${userEmail}`);
            console.log(`Socket ${socket.id} joined room: user:${userEmail}`);
        }
    });

    socket.on('disconnect', () => {
        console.log(`Client disconnected: ${socket.id}`);
    });
});

// Broadcast new email to all connected clients
const broadcastNewEmail = (email) => {
    io.emit('new-email', {
        id: email._id,
        gmailId: email.gmailId,
        from: email.from,
        subject: email.subject,
        content: email.content,
        snippet: email.snippet,
        category: email.category,
        confidence: email.confidence,
        timestamp: email.receivedAt
    });
    console.log(`Broadcasted email to ${io.engine.clientsCount} clients: ${email.subject}`);
};

// Email polling system
let pollingInterval = null;

const startPolling = () => {
    console.log(`Starting email polling (interval: ${POLL_INTERVAL}ms)`);

    // Initial poll
    performPoll();

    // Set up recurring poll
    pollingInterval = setInterval(performPoll, POLL_INTERVAL);
};

const performPoll = async () => {
    const mongoose = require('mongoose');
    if (mongoose.connection.readyState !== 1) {
        // Database not ready yet, skip this polling tick safely
        return;
    }

    try {
        await pollAllUsers(io);
    } catch (error) {
        console.error('Error during polling:', error);
    }
};

const stopPolling = () => {
    if (pollingInterval) {
        clearInterval(pollingInterval);
        pollingInterval = null;
        console.log('Email polling stopped');
    }
};

// Initialize application
const initializeApp = async () => {
    // Start HTTP server immediately
    server.listen(PORT, () => {
        console.log(`Server listening on port ${PORT}`);
        console.log(`
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║   📧 LiveMail Classifier Server                          ║
║                                                           ║
║   Server running on: http://localhost:${PORT}              ║
║   Socket.io: http://localhost:${PORT}                      ║
║   Environment: ${process.env.NODE_ENV || 'development'}                             ║
║                                                           ║
║   Endpoints:                                              ║
║   - GET /api/health                                       ║
║   - GET /api/emails                                       ║
║   - GET /api/emails/stats                                 ║
║                                                           ║
║   Polling interval: ${POLL_INTERVAL / 1000} seconds                            ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
        `);
    });

    try {
        // Connect to MongoDB
        try {
            await connectDB();
            console.log('Database connected successfully.');
            // Start email polling only after DB is up
            startPolling();
        } catch (dbError) {
            console.error('MongoDB Connection Failed:', dbError.message);
            console.error('Server is running on port 5000, but database features are disabled.');
        }

        // Initialize NVIDIA NIM classifier
        try {
            await loadClassifier();
        } catch (classifierErr) {
            console.error('Classifier initialization error:', classifierErr.message);
        }

        // Graceful shutdown
        process.on('SIGTERM', () => {
            console.log('SIGTERM received. Shutting down gracefully...');
            stopPolling();
            server.close(() => {
                console.log('Server closed');
                process.exit(0);
            });
        });

        process.on('SIGINT', () => {
            console.log('SIGINT received. Shutting down gracefully...');
            stopPolling();
            server.close(() => {
                console.log('Server closed');
                process.exit(0);
            });
        });

    } catch (error) {
        console.error('Failed to initialize application modules:', error);
    }
};

// Start the application
initializeApp();

// Export for testing
module.exports = { app, server, io };