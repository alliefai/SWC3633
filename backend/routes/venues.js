// ================================================
// EventHub - Venues Routes (Full CRUD)
// GET    /api/venues      - List all venues
// GET    /api/venues/:id  - Get venue by ID
// POST   /api/venues      - Create venue (admin)
// PUT    /api/venues/:id  - Update venue (admin)
// DELETE /api/venues/:id  - Delete venue (admin)
// ================================================
const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { validateVenue } = require('../middleware/validator');

// ---- GET /api/venues ----
router.get('/', async (req, res) => {
    try {
        const { city, search } = req.query;
        let query = 'SELECT * FROM venues';
        const params = [];
        const conditions = [];

        if (city) {
            conditions.push('city = ?');
            params.push(city);
        }
        if (search) {
            conditions.push('(name LIKE ? OR description LIKE ? OR city LIKE ?)');
            params.push(`%${search}%`, `%${search}%`, `%${search}%`);
        }

        if (conditions.length > 0) {
            query += ' WHERE ' + conditions.join(' AND ');
        }
        query += ' ORDER BY name ASC';

        const [venues] = await pool.execute(query, params);

        // Get event count for each venue
        for (let venue of venues) {
            const [count] = await pool.execute(
                'SELECT COUNT(*) as event_count FROM events WHERE venue_id = ?',
                [venue.id]
            );
            venue.event_count = count[0].event_count;
        }

        res.json({ data: venues });
    } catch (err) {
        console.error('Get venues error:', err);
        res.status(500).json({ error: 'Failed to fetch venues', message: err.message });
    }
});

// ---- GET /api/venues/:id ----
router.get('/:id', async (req, res) => {
    try {
        const [venues] = await pool.execute('SELECT * FROM venues WHERE id = ?', [req.params.id]);

        if (venues.length === 0) {
            return res.status(404).json({ error: 'Venue not found' });
        }

        // Include upcoming events at this venue
        const [events] = await pool.execute(
            'SELECT id, title, event_date, start_time, price, category FROM events WHERE venue_id = ? AND event_date >= CURDATE() ORDER BY event_date ASC',
            [req.params.id]
        );

        res.json({ data: { ...venues[0], upcoming_events: events } });
    } catch (err) {
        console.error('Get venue error:', err);
        res.status(500).json({ error: 'Failed to fetch venue', message: err.message });
    }
});

// ---- POST /api/venues ----
router.post('/', authenticateToken, requireAdmin, validateVenue, async (req, res) => {
    try {
        const { name, address, city, capacity, description, image_url, latitude, longitude } = req.body;

        const [result] = await pool.execute(
            'INSERT INTO venues (name, address, city, capacity, description, image_url, latitude, longitude) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [name, address, city, capacity, description || null, image_url || null, latitude || null, longitude || null]
        );

        const [newVenue] = await pool.execute('SELECT * FROM venues WHERE id = ?', [result.insertId]);

        res.status(201).json({ message: 'Venue created successfully', data: newVenue[0] });
    } catch (err) {
        console.error('Create venue error:', err);
        res.status(500).json({ error: 'Failed to create venue', message: err.message });
    }
});

// ---- PUT /api/venues/:id ----
router.put('/:id', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { name, address, city, capacity, description, image_url, latitude, longitude } = req.body;

        const [existing] = await pool.execute('SELECT id FROM venues WHERE id = ?', [req.params.id]);
        if (existing.length === 0) {
            return res.status(404).json({ error: 'Venue not found' });
        }

        await pool.execute(
            `UPDATE venues SET 
             name = COALESCE(?, name), address = COALESCE(?, address), 
             city = COALESCE(?, city), capacity = COALESCE(?, capacity),
             description = COALESCE(?, description), image_url = COALESCE(?, image_url),
             latitude = COALESCE(?, latitude), longitude = COALESCE(?, longitude)
             WHERE id = ?`,
            [name, address, city, capacity, description, image_url, latitude, longitude, req.params.id]
        );

        const [updated] = await pool.execute('SELECT * FROM venues WHERE id = ?', [req.params.id]);

        res.json({ message: 'Venue updated successfully', data: updated[0] });
    } catch (err) {
        console.error('Update venue error:', err);
        res.status(500).json({ error: 'Failed to update venue', message: err.message });
    }
});

// ---- DELETE /api/venues/:id ----
router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const [existing] = await pool.execute('SELECT id, name FROM venues WHERE id = ?', [req.params.id]);
        if (existing.length === 0) {
            return res.status(404).json({ error: 'Venue not found' });
        }

        // Check if venue has events
        const [events] = await pool.execute('SELECT COUNT(*) as count FROM events WHERE venue_id = ?', [req.params.id]);
        if (events[0].count > 0) {
            return res.status(400).json({ 
                error: 'Cannot delete venue with existing events',
                message: `This venue has ${events[0].count} event(s). Delete or reassign them first.`
            });
        }

        await pool.execute('DELETE FROM venues WHERE id = ?', [req.params.id]);

        res.json({ message: `Venue "${existing[0].name}" deleted successfully` });
    } catch (err) {
        console.error('Delete venue error:', err);
        res.status(500).json({ error: 'Failed to delete venue', message: err.message });
    }
});

module.exports = router;
