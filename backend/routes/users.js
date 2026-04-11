// ================================================
// MediDeliver - Users Route (Admin)
// GET    /api/users       - List all users
// GET    /api/users/:id   - Get user
// PUT    /api/users/:id   - Update user
// DELETE /api/users/:id   - Delete user
// ================================================
const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const bcrypt = require('bcryptjs');

router.get('/', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { role } = req.query;
        let query = 'SELECT id, name, email, phone, address, role, is_active, api_key, created_at FROM users';
        const params = [];
        if (role) { query += ' WHERE role = ?'; params.push(role); }
        query += ' ORDER BY created_at DESC';
        const [users] = await pool.execute(query, params);

        // booking count for each user
        for (const u of users) {
            const [r] = await pool.execute('SELECT COUNT(*) as cnt FROM orders WHERE customer_id = ?', [u.id]);
            u.order_count = r[0].cnt;
        }
        res.json({ data: users });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/:id', authenticateToken, async (req, res) => {
    try {
        if (req.user.role !== 'admin' && req.user.id !== parseInt(req.params.id)) {
            return res.status(403).json({ error: 'Access denied' });
        }
        const [rows] = await pool.execute(
            'SELECT id, name, email, phone, address, role, is_active, api_key, created_at FROM users WHERE id = ?',
            [req.params.id]
        );
        if (rows.length === 0) return res.status(404).json({ error: 'User not found' });
        res.json({ data: rows[0] });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.put('/:id', authenticateToken, async (req, res) => {
    try {
        if (req.user.role !== 'admin' && req.user.id !== parseInt(req.params.id)) {
            return res.status(403).json({ error: 'Access denied' });
        }
        const { name, email, phone, address, password, role, is_active } = req.body;
        let hashed = undefined;
        if (password) hashed = await bcrypt.hash(password, 10);

        await pool.execute(
            `UPDATE users SET
             name = COALESCE(?, name), email = COALESCE(?, email),
             phone = COALESCE(?, phone), address = COALESCE(?, address),
             password = COALESCE(?, password),
             role = COALESCE(?, role),
             is_active = COALESCE(?, is_active)
             WHERE id = ?`,
            [name, email, phone, address, hashed,
             req.user.role === 'admin' ? role : undefined,
             req.user.role === 'admin' ? (is_active !== undefined ? (is_active ? 1 : 0) : null) : null,
             req.params.id]
        );

        const [updated] = await pool.execute(
            'SELECT id, name, email, phone, address, role, is_active, created_at FROM users WHERE id = ?',
            [req.params.id]
        );
        res.json({ message: 'User updated', data: updated[0] });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
    try {
        if (req.user.id === parseInt(req.params.id)) return res.status(400).json({ error: 'Cannot delete your own account' });
        const [rows] = await pool.execute('SELECT id, name FROM users WHERE id = ?', [req.params.id]);
        if (rows.length === 0) return res.status(404).json({ error: 'User not found' });
        await pool.execute('DELETE FROM users WHERE id = ?', [req.params.id]);
        res.json({ message: `User "${rows[0].name}" deleted` });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
