// ================================================
// EventHub - Request Logger Middleware
// Logs all API requests with timing to console & file
// ================================================
const fs = require('fs');
const path = require('path');

// Create logs directory if it doesn't exist
const logDir = path.join(__dirname, '..', 'logs');
if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
}

/**
 * Middleware that logs every request with:
 * - Timestamp
 * - HTTP Method
 * - URL path
 * - Response status code
 * - Response time in milliseconds
 * - Client IP address
 */
const logger = (req, res, next) => {
    const start = Date.now();
    const timestamp = new Date().toISOString();

    // Log after response is finished
    res.on('finish', () => {
        const duration = Date.now() - start;
        const logEntry = `[${timestamp}] ${req.method} ${req.originalUrl} - ${res.statusCode} - ${duration}ms - IP: ${req.ip}`;

        // Console output with color coding
        const statusColor = res.statusCode >= 500 ? '\x1b[31m' : // Red for 5xx
                           res.statusCode >= 400 ? '\x1b[33m' : // Yellow for 4xx
                           res.statusCode >= 300 ? '\x1b[36m' : // Cyan for 3xx
                           '\x1b[32m'; // Green for 2xx
        console.log(`${statusColor}${logEntry}\x1b[0m`);

        // Write to daily log file
        const logFile = path.join(logDir, `${new Date().toISOString().split('T')[0]}.log`);
        fs.appendFile(logFile, logEntry + '\n', (err) => {
            if (err) console.error('Failed to write log:', err.message);
        });
    });

    next();
};

module.exports = { logger };
