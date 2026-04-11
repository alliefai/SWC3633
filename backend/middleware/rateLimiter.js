// ================================================
// EventHub - Rate Limiting Middleware
// Restricts excessive API requests per IP
// ================================================
const rateLimit = require('express-rate-limit');

/**
 * General API rate limiter
 * Allows 100 requests per 15-minute window per IP
 */
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100,
    message: {
        error: 'Too many requests',
        message: 'You have exceeded the rate limit of 100 requests per 15 minutes. Please try again later.',
        retryAfter: '15 minutes'
    },
    standardHeaders: true,
    legacyHeaders: false,
});

/**
 * Stricter rate limiter for authentication endpoints
 * Allows 20 requests per 15-minute window per IP
 */
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 20,
    message: {
        error: 'Too many authentication attempts',
        message: 'Please try again after 15 minutes.'
    },
    standardHeaders: true,
    legacyHeaders: false,
});

module.exports = { apiLimiter, authLimiter };
