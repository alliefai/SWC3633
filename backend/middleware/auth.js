// ================================================
// EventHub - Authentication Middleware
// Supports JWT Token and API Key authentication
// ================================================
const jwt = require('jsonwebtoken');
const pool = require('../config/database');

const JWT_SECRET = process.env.JWT_SECRET || 'eventhub_jwt_secret_key_swc3633_2026';

/**
 * Authenticate requests using JWT token or API key
 * - JWT: Authorization: Bearer <token>
 * - API Key: x-api-key: <key>
 */
const authenticateToken = async (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const apiKey = req.headers['x-api-key'];

    // Try API Key authentication first
    if (apiKey) {
        try {
            const [rows] = await pool.execute(
                'SELECT id, username, email, role FROM users WHERE api_key = ?',
                [apiKey]
            );
            if (rows.length === 0) {
                return res.status(401).json({ error: 'Invalid API key' });
            }
            req.user = rows[0];
            return next();
        } catch (err) {
            return res.status(500).json({ error: 'Authentication error' });
        }
    }

    // Try JWT token authentication
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) {
        return res.status(401).json({ 
            error: 'Access denied',
            message: 'No authentication token or API key provided. Include Authorization: Bearer <token> or x-api-key: <key> header.'
        });
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        next();
    } catch (err) {
        return res.status(403).json({ error: 'Invalid or expired token' });
    }
};

/**
 * Require admin role - must be used after authenticateToken
 */
const requireAdmin = (req, res, next) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Admin access required' });
    }
    next();
};

/**
 * Optional authentication - attaches user if token present, continues otherwise
 */
const optionalAuth = async (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token) {
        try {
            const decoded = jwt.verify(token, JWT_SECRET);
            req.user = decoded;
        } catch (err) {
            // Token invalid - continue without user context
        }
    }
    next();
};

module.exports = { authenticateToken, requireAdmin, optionalAuth, JWT_SECRET };
