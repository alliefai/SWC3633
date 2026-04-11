// ================================================
// EventHub - Events Routes (Full CRUD)
// GET    /api/events      - List all events
// GET    /api/events/:id  - Get event by ID
// POST   /api/events      - Create event (admin)
// PUT    /api/events/:id  - Update event (admin)
// DELETE /api/events/:id  - Delete event (admin)
// ================================================
const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { authenticateToken, requireAdmin, optionalAuth } = require('../middleware/auth');
const { validateEvent } = require('../middleware/validator');

// ---- GET /api/events ----
// Public - supports filtering, search, sorting, pagination
router.get('/', optionalAuth, async (req, res) => {
    try {
        const { category, search, sort, order, page, limit } = req.query;
        let query = `
            SELECT e.*, v.name as venue_name, v.city as venue_city 
            FROM events e 
            JOIN venues v ON e.venue_id = v.id
        `;
        const params = [];
        const conditions = [];

        // Filter by category
        if (category) {
            conditions.push('e.category = ?');
            params.push(category);
        }

        // Search by title or description
        if (search) {
            conditions.push('(e.title LIKE ? OR e.description LIKE ?)');
            params.push(`%${search}%`, `%${search}%`);
        }

        if (conditions.length > 0) {
            query += ' WHERE ' + conditions.join(' AND ');
        }

        // Sorting
        const validSorts = ['event_date', 'price', 'title', 'created_at'];
        const sortField = validSorts.includes(sort) ? sort : 'event_date';
        const sortOrder = order === 'desc' ? 'DESC' : 'ASC';
        query += ` ORDER BY e.${sortField} ${sortOrder}`;

        // Pagination
        const pageNum = parseInt(page) || 1;
        const limitNum = Math.min(parseInt(limit) || 20, 50);
        const offset = (pageNum - 1) * limitNum;
        query += ` LIMIT ? OFFSET ?`;
        params.push(limitNum, offset);

        const [events] = await pool.execute(query, params);

        // Get total count for pagination info
        let countQuery = 'SELECT COUNT(*) as total FROM events e';
        const countParams = [];
        if (conditions.length > 0) {
            countQuery += ' WHERE ' + conditions.join(' AND ');
            // Copy filter params (exclude limit and offset)
            for (let i = 0; i < params.length - 2; i++) {
                countParams.push(params[i]);
            }
        }
        const [countResult] = await pool.execute(countQuery, countParams);

        res.json({
            data: events,
            pagination: {
                page: pageNum,
                limit: limitNum,
                total: countResult[0].total,
                totalPages: Math.ceil(countResult[0].total / limitNum)
            }
        });
    } catch (err) {
        console.error('Get events error:', err);
        res.status(500).json({ error: 'Failed to fetch events', message: err.message });
    }
});

// ---- GET /api/events/:id ----
// Public - get single event with venue details
router.get('/:id', async (req, res) => {
    try {
        const [events] = await pool.execute(
            `SELECT e.*, v.name as venue_name, v.city as venue_city, v.address as venue_address, 
             v.capacity as venue_capacity, v.latitude, v.longitude
             FROM events e 
             JOIN venues v ON e.venue_id = v.id 
             WHERE e.id = ?`,
            [req.params.id]
        );

        if (events.length === 0) {
            return res.status(404).json({ error: 'Event not found' });
        }

        res.json({ data: events[0] });
    } catch (err) {
        console.error('Get event error:', err);
        res.status(500).json({ error: 'Failed to fetch event', message: err.message });
    }
});

// ---- POST /api/events ----
// Admin only - create new event
router.post('/', authenticateToken, requireAdmin, validateEvent, async (req, res) => {
    try {
        const { title, description, venue_id, event_date, start_time, end_time, price, category, image_url, is_outdoor, available_tickets } = req.body;

        // Verify venue exists
        const [venue] = await pool.execute('SELECT id FROM venues WHERE id = ?', [venue_id]);
        if (venue.length === 0) {
            return res.status(400).json({ error: 'Venue not found with the given ID' });
        }

        const [result] = await pool.execute(
            `INSERT INTO events (title, description, venue_id, event_date, start_time, end_time, price, category, image_url, is_outdoor, available_tickets) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [title, description || null, venue_id, event_date, start_time, end_time || null, price || 0, category || 'other', image_url || null, is_outdoor || false, available_tickets || 0]
        );

        const [newEvent] = await pool.execute(
            'SELECT e.*, v.name as venue_name FROM events e JOIN venues v ON e.venue_id = v.id WHERE e.id = ?',
            [result.insertId]
        );

        res.status(201).json({ message: 'Event created successfully', data: newEvent[0] });
    } catch (err) {
        console.error('Create event error:', err);
        res.status(500).json({ error: 'Failed to create event', message: err.message });
    }
});

// ---- PUT /api/events/:id ----
// Admin only - update existing event
router.put('/:id', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { title, description, venue_id, event_date, start_time, end_time, price, category, image_url, is_outdoor, available_tickets } = req.body;

        // Check if event exists
        const [existing] = await pool.execute('SELECT id FROM events WHERE id = ?', [req.params.id]);
        if (existing.length === 0) {
            return res.status(404).json({ error: 'Event not found' });
        }

        await pool.execute(
            `UPDATE events SET 
             title = COALESCE(?, title), description = COALESCE(?, description), 
             venue_id = COALESCE(?, venue_id), event_date = COALESCE(?, event_date), 
             start_time = COALESCE(?, start_time), end_time = COALESCE(?, end_time),
             price = COALESCE(?, price), category = COALESCE(?, category), 
             image_url = COALESCE(?, image_url), is_outdoor = COALESCE(?, is_outdoor),
             available_tickets = COALESCE(?, available_tickets)
             WHERE id = ?`,
            [title, description, venue_id, event_date, start_time, end_time, price, category, image_url, is_outdoor, available_tickets, req.params.id]
        );

        const [updated] = await pool.execute(
            'SELECT e.*, v.name as venue_name FROM events e JOIN venues v ON e.venue_id = v.id WHERE e.id = ?',
            [req.params.id]
        );

        res.json({ message: 'Event updated successfully', data: updated[0] });
    } catch (err) {
        console.error('Update event error:', err);
        res.status(500).json({ error: 'Failed to update event', message: err.message });
    }
});

// ---- DELETE /api/events/:id ----
// Admin only - delete event
router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const [existing] = await pool.execute('SELECT id, title FROM events WHERE id = ?', [req.params.id]);
        if (existing.length === 0) {
            return res.status(404).json({ error: 'Event not found' });
        }

        await pool.execute('DELETE FROM events WHERE id = ?', [req.params.id]);

        res.json({ message: `Event "${existing[0].title}" deleted successfully` });
    } catch (err) {
        console.error('Delete event error:', err);
        res.status(500).json({ error: 'Failed to delete event', message: err.message });
    }
});

module.exports = router;
