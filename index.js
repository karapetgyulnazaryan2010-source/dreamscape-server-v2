const express = require('express');
const cors = require('cors');
const session = require('express-session');
const cookieParser = require('cookie-parser');
const bcrypt = require('bcryptjs');
const db = require('./database');

const app = express();
const PORT = process.env.PORT || 10000; // Render uses port 10000 by default

// 1. NUCLEAR CORS CONFIGURATION
// This ensures Vercel and Render can talk without any restrictions
app.use(cors({
    origin: true, // Allows any origin (safest for initial setup)
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());
app.use(cookieParser());

// 2. SESSION CONFIGURATION
// Configured specifically for Render (HTTPS/Production)
app.use(session({
    name: 'dreamscape_sid',
    secret: process.env.SESSION_SECRET || 'dreamscape-super-secret-key-2026',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: true, // Required for SameSite: 'none'
        sameSite: 'none', // Required for cross-domain (Vercel -> Render)
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
}));

// --- MIDDLEWARE ---
const authenticate = (req, res, next) => {
    if (!req.session.user) {
        return res.status(401).json({ error: 'Unauthorized. Please log in.' });
    }
    next();
};

// --- API ENDPOINTS ---

// Health Check
app.get('/', (req, res) => {
    res.send('Dreamscape Server v2 is running! 🚀');
});

// SIGNUP
app.post('/api/signup', async (req, res) => {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
        return res.status(400).json({ error: 'Name, email, and password are required.' });
    }

    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        db.run(`INSERT INTO users (name, email, password) VALUES (?, ?, ?)`, [name, email, hashedPassword], function(err) {
            if (err) {
                if (err.message.includes('UNIQUE')) {
                    return res.status(400).json({ error: 'This email is already registered.' });
                }
                return res.status(500).json({ error: 'Database error during signup.' });
            }

            const newUser = { id: this.lastID, name, email, role: 'user' };
            req.session.user = newUser;
            res.status(201).json({ success: true, user: newUser });
        });
    } catch (error) {
        res.status(500).json({ error: 'Internal server error during signup.' });
    }
});

// SIGNIN
app.post('/api/signin', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required.' });
    }

    db.get(`SELECT * FROM users WHERE email = ?`, [email], async (err, user) => {
        if (err || !user) {
            return res.status(401).json({ error: 'Invalid email or password.' });
        }

        const match = await bcrypt.compare(password, user.password);
        if (!match) {
            return res.status(401).json({ error: 'Invalid email or password.' });
        }

        req.session.user = { id: user.id, name: user.name, email: user.email, role: user.role };
        res.json({ success: true, user: req.session.user });
    });
});

// CURRENT USER (ME)
app.get('/api/me', authenticate, (req, res) => {
    res.json(req.session.user);
});

// LOGOUT
app.post('/api/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) return res.status(500).json({ error: 'Could not log out.' });
        res.clearCookie('dreamscape_sid');
        res.json({ success: true });
    });
});

// START SERVER
app.listen(PORT, () => {
    console.log(`Dreamscape Server v2 running on port ${PORT}`);
});
