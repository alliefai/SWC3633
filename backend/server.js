// ================================================
// MediDeliver - Main Express Server
// RESTful API for Online Pharmacy Delivery
// Course: SWC3633 Web API Development
// ================================================
const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const { logger } = require('./middleware/logger');
const { apiLimiter } = require('./middleware/rateLimiter');

const authRoutes     = require('./routes/auth');
const medicineRoutes = require('./routes/medicines');
const orderRoutes    = require('./routes/orders');
const userRoutes     = require('./routes/users');
const weatherRoutes  = require('./routes/weather');

const app = express();
const PORT = process.env.PORT || 3000;

// ---- Global Middleware ----
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(logger);

// Serve each student's frontend
// Student 1 (Customer Portal) is the default
app.use(express.static(path.join(__dirname, '..', 'frontend-customer')));

// Rate limiting on all API routes
app.use('/api', apiLimiter);

// ---- API Routes ----
app.use('/api/auth',      authRoutes);
app.use('/api/medicines', medicineRoutes);
app.use('/api/orders',    orderRoutes);
app.use('/api/users',     userRoutes);
app.use('/api/weather',   weatherRoutes);

// ---- Health Check ----
app.get('/api/health', (req, res) => {
    res.json({
        status: 'OK',
        app: 'MediDeliver — Online Pharmacy Delivery API',
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        endpoints: {
            auth:      'POST /api/auth/register | POST /api/auth/login | GET /api/auth/me',
            medicines: 'GET /api/medicines | GET /api/medicines/:id | POST | PUT | DELETE',
            orders:    'GET /api/orders | GET /api/orders/:id | POST | PUT | DELETE',
            users:     'GET /api/users | GET /api/users/:id | PUT | DELETE',
            weather:   'GET /api/weather/:city'
        }
    });
});

// ---- 404 for unknown API routes ----
app.use('/api/*', (req, res) => {
    res.status(404).json({ error: 'Endpoint not found', hint: 'Visit /api/health' });
});

// ---- Serve frontend SPA ----
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'frontend-customer', 'index.html'));
});

// ---- Global Error Handler ----
app.use((err, req, res, next) => {
    console.error('❌ Unhandled error:', err.stack);
    res.status(500).json({ error: 'Internal server error', message: err.message });
});

app.listen(PORT, () => {
    console.log('');
    console.log('╔══════════════════════════════════════════════════╗');
    console.log('║     💊 MediDeliver API Server (SWC3633)         ║');
    console.log('╠══════════════════════════════════════════════════╣');
    console.log(`║  🌐 API:      http://localhost:${PORT}/api          ║`);
    console.log(`║  💻 Customer: http://localhost:${PORT}              ║`);
    console.log('║  ❤️  Health:   /api/health                        ║');
    console.log('╚══════════════════════════════════════════════════╝');
    console.log('');
});

module.exports = app;
