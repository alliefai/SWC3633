// ================================================
// EventHub - Bookings Routes (Full CRUD)
// GET    /api/bookings      - Get user's bookings
// GET    /api/bookings/:id  - Get booking by ID
// POST   /api/bookings      - Create booking
// PUT    /api/bookings/:id  - Update booking
// DELETE /api/bookings/:id  - Cancel booking
// ================================================
const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { validateBooking } = require('../middleware/validator');

// ---- GET /api/bookings ----
// Users see their own bookings; admins see all
router.get('/', authenticateToken, async (req, res) => {
    try {
        let query, params;

        if (req.user.role === 'admin') {
            query = `
                SELECT b.*, e.title as event_title, e.event_date, e.start_time, e.image_url as event_image,
                       v.name as venue_name, u.username as user_name, u.email as user_email
                FROM bookings b
                JOIN events e ON b.event_id = e.id
                JOIN venues v ON e.venue_id = v.id
                JOIN users u ON b.user_id = u.id
                ORDER BY b.created_at DESC
            `;
            params = [];
        } else {
            query = `
                SELECT b.*, e.title as event_title, e.event_date, e.start_time, e.image_url as event_image,
                       v.name as venue_name
                FROM bookings b
                JOIN events e ON b.event_id = e.id
                JOIN venues v ON e.venue_id = v.id
                WHERE b.user_id = ?
                ORDER BY b.created_at DESC
            `;
            params = [req.user.id];
        }

        const [bookings] = await pool.execute(query, params);

        res.json({ data: bookings });
    } catch (err) {
        console.error('Get bookings error:', err);
        res.status(500).json({ error: 'Failed to fetch bookings', message: err.message });
    }
});

// ---- GET /api/bookings/:id ----
router.get('/:id', authenticateToken, async (req, res) => {
    try {
        const [bookings] = await pool.execute(
            `SELECT b.*, e.title as event_title, e.event_date, e.start_time, e.price as unit_price,
                    e.image_url as event_image, v.name as venue_name, v.address as venue_address,
                    u.username as user_name
             FROM bookings b
             JOIN events e ON b.event_id = e.id
             JOIN venues v ON e.venue_id = v.id
             JOIN users u ON b.user_id = u.id
             WHERE b.id = ?`,
            [req.params.id]
        );

        if (bookings.length === 0) {
            return res.status(404).json({ error: 'Booking not found' });
        }

        // Users can only view their own bookings
        if (req.user.role !== 'admin' && bookings[0].user_id !== req.user.id) {
            return res.status(403).json({ error: 'Access denied' });
        }

        res.json({ data: bookings[0] });
    } catch (err) {
        console.error('Get booking error:', err);
        res.status(500).json({ error: 'Failed to fetch booking', message: err.message });
    }
});

// ---- POST /api/bookings ----
// Authenticated users can create bookings
router.post('/', authenticateToken, validateBooking, async (req, res) => {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        const { event_id, num_tickets, payment_method } = req.body;

        // Check event exists and has enough tickets
        const [events] = await connection.execute(
            'SELECT * FROM events WHERE id = ? FOR UPDATE',
            [event_id]
        );

        if (events.length === 0) {
            await connection.rollback();
            return res.status(404).json({ error: 'Event not found' });
        }

        const event = events[0];

        if (event.available_tickets < num_tickets) {
            await connection.rollback();
            return res.status(400).json({ 
                error: 'Not enough tickets available',
                available: event.available_tickets
            });
        }

        // Calculate total price
        const total_price = event.price * num_tickets;

        // Create booking
        const [result] = await connection.execute(
            'INSERT INTO bookings (user_id, event_id, num_tickets, total_price, status, payment_method) VALUES (?, ?, ?, ?, ?, ?)',
            [req.user.id, event_id, num_tickets, total_price, 'confirmed', payment_method || 'credit_card']
        );

        // Reduce available tickets
        await connection.execute(
            'UPDATE events SET available_tickets = available_tickets - ? WHERE id = ?',
            [num_tickets, event_id]
        );

        await connection.commit();

        // Fetch the created booking with details
        const [newBooking] = await pool.execute(
            `SELECT b.*, e.title as event_title, e.event_date, v.name as venue_name
             FROM bookings b
             JOIN events e ON b.event_id = e.id
             JOIN venues v ON e.venue_id = v.id
             WHERE b.id = ?`,
            [result.insertId]
        );

        res.status(201).json({ message: 'Booking created successfully', data: newBooking[0] });
    } catch (err) {
        await connection.rollback();
        console.error('Create booking error:', err);
        res.status(500).json({ error: 'Failed to create booking', message: err.message });
    } finally {
        connection.release();
    }
});

// ---- PUT /api/bookings/:id ----
// Update booking status or details
router.put('/:id', authenticateToken, async (req, res) => {
    try {
        const { status, num_tickets, payment_method } = req.body;

        const [existing] = await pool.execute('SELECT * FROM bookings WHERE id = ?', [req.params.id]);
        if (existing.length === 0) {
            return res.status(404).json({ error: 'Booking not found' });
        }

        // Users can only update their own bookings
        if (req.user.role !== 'admin' && existing[0].user_id !== req.user.id) {
            return res.status(403).json({ error: 'Access denied' });
        }

        await pool.execute(
            `UPDATE bookings SET 
             status = COALESCE(?, status),
             num_tickets = COALESCE(?, num_tickets),
             payment_method = COALESCE(?, payment_method)
             WHERE id = ?`,
            [status, num_tickets, payment_method, req.params.id]
        );

        const [updated] = await pool.execute(
            `SELECT b.*, e.title as event_title, e.event_date, v.name as venue_name
             FROM bookings b
             JOIN events e ON b.event_id = e.id
             JOIN venues v ON e.venue_id = v.id
             WHERE b.id = ?`,
            [req.params.id]
        );

        res.json({ message: 'Booking updated successfully', data: updated[0] });
    } catch (err) {
        console.error('Update booking error:', err);
        res.status(500).json({ error: 'Failed to update booking', message: err.message });
    }
});

// ---- DELETE /api/bookings/:id ----
// Cancel a booking and restore tickets
router.delete('/:id', authenticateToken, async (req, res) => {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        const [existing] = await connection.execute('SELECT * FROM bookings WHERE id = ?', [req.params.id]);
        if (existing.length === 0) {
            await connection.rollback();
            return res.status(404).json({ error: 'Booking not found' });
        }

        // Users can only cancel their own bookings
        if (req.user.role !== 'admin' && existing[0].user_id !== req.user.id) {
            await connection.rollback();
            return res.status(403).json({ error: 'Access denied' });
        }

        const booking = existing[0];

        // Restore tickets if booking was confirmed
        if (booking.status === 'confirmed') {
            await connection.execute(
                'UPDATE events SET available_tickets = available_tickets + ? WHERE id = ?',
                [booking.num_tickets, booking.event_id]
            );
        }

        // Delete the booking
        await connection.execute('DELETE FROM bookings WHERE id = ?', [req.params.id]);

        await connection.commit();

        res.json({ message: 'Booking cancelled and deleted successfully' });
    } catch (err) {
        await connection.rollback();
        console.error('Delete booking error:', err);
        res.status(500).json({ error: 'Failed to cancel booking', message: err.message });
    } finally {
        connection.release();
    }
});

module.exports = router;
