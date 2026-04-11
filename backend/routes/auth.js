// ================================================
// MediDeliver - Authentication Routes
// POST /api/auth/register
// POST /api/auth/login
// GET  /api/auth/me
// ================================================
const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const pool = require('../config/database');
const { JWT_SECRET } = require('../middleware/auth');
const { authLimiter } = require('../middleware/rateLimiter');

// POST /api/auth/register
router.post('/register', authLimiter, async (req, res) => {
    try {
        const { name, email, password, phone, address, role } = req.body;

        if (!name || !email || !password) {
            return res.status(400).json({ error: 'Name, email and password are required' });
        }
        if (password.length < 6) {
            return res.status(400).json({ error: 'Password must be at least 6 characters' });
        }

        const [existing] = await pool.execute('SELECT id FROM users WHERE email = ?', [email]);
        if (existing.length > 0) {
            return res.status(409).json({ error: 'Email already registered' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const apiKey = 'md_' + crypto.randomBytes(24).toString('hex');

        // Only allow customer self-registration; admin/rider set by admin
        const safeRole = ['customer', 'rider'].includes(role) ? role : 'customer';

        const [result] = await pool.execute(
            'INSERT INTO users (name, email, password, phone, address, role, api_key) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [name, email, hashedPassword, phone || null, address || null, safeRole, apiKey]
        );

        const token = jwt.sign(
            { id: result.insertId, name, email, role: safeRole },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.status(201).json({
            message: 'Registration successful',
            token,
            user: { id: result.insertId, name, email, role: safeRole },
            apiKey
        });
    } catch (err) {
        console.error('Register error:', err);
        res.status(500).json({ error: 'Registration failed', message: err.message });
    }
});

// POST /api/auth/login
router.post('/login', authLimiter, async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password required' });
        }

        const [users] = await pool.execute('SELECT * FROM users WHERE email = ?', [email]);
        if (users.length === 0) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const user = users[0];
        if (!user.is_active) {
            return res.status(403).json({ error: 'Account is deactivated' });
        }

        const valid = await bcrypt.compare(password, user.password);
        if (!valid) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const token = jwt.sign(
            { id: user.id, name: user.name, email: user.email, role: user.role },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.json({
            message: 'Login successful',
            token,
            user: { id: user.id, name: user.name, email: user.email, role: user.role, phone: user.phone, address: user.address }
        });
    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ error: 'Login failed', message: err.message });
    }
});

// GET /api/auth/me — get current user profile
router.get('/me', require('../middleware/auth').authenticateToken, async (req, res) => {
    try {
        const [users] = await pool.execute(
            'SELECT id, name, email, phone, address, role, api_key, created_at FROM users WHERE id = ?',
            [req.user.id]
        );
        if (users.length === 0) return res.status(404).json({ error: 'User not found' });
        res.json({ data: users[0] });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
