// ================================================
// MediDeliver - Medicines Routes (Full CRUD)
// GET    /api/medicines         - List all medicines (public)
// GET    /api/medicines/:id     - Get medicine detail (public)
// POST   /api/medicines         - Add new medicine (admin)
// PUT    /api/medicines/:id     - Update medicine (admin)
// DELETE /api/medicines/:id     - Delete/remove medicine (admin)
// ================================================
const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

// ---- GET /api/medicines ---- (Public — used by Customer Portal)
router.get('/', async (req, res) => {
    try {
        const { category, search, sort, order, available, page, limit } = req.query;
        let query = 'SELECT * FROM medicines';
        const params = [];
        const conditions = [];

        if (category) { conditions.push('category = ?'); params.push(category); }
        if (available !== 'all') { conditions.push('is_available = 1'); }
        if (search) {
            conditions.push('(name LIKE ? OR description LIKE ? OR manufacturer LIKE ?)');
            params.push(`%${search}%`, `%${search}%`, `%${search}%`);
        }

        if (conditions.length > 0) query += ' WHERE ' + conditions.join(' AND ');

        const validSorts = ['name', 'price', 'stock', 'created_at'];
        const sortField = validSorts.includes(sort) ? sort : 'name';
        const sortOrder = order === 'desc' ? 'DESC' : 'ASC';
        query += ` ORDER BY ${sortField} ${sortOrder}`;

        const pageNum = parseInt(page) || 1;
        const limitNum = Math.min(parseInt(limit) || 20, 100);
        query += ' LIMIT ? OFFSET ?';
        params.push(limitNum, (pageNum - 1) * limitNum);

        const [medicines] = await pool.execute(query, params);

        // Count for pagination
        let countQ = 'SELECT COUNT(*) as total FROM medicines';
        const countP = [];
        if (conditions.length > 0) {
            countQ += ' WHERE ' + conditions.join(' AND ');
            params.slice(0, -2).forEach(p => countP.push(p));
        }
        const [countR] = await pool.execute(countQ, countP);

        res.json({ data: medicines, pagination: { page: pageNum, limit: limitNum, total: countR[0].total } });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch medicines', message: err.message });
    }
});

// ---- GET /api/medicines/:id ---- (Public)
router.get('/:id', async (req, res) => {
    try {
        const [rows] = await pool.execute('SELECT * FROM medicines WHERE id = ?', [req.params.id]);
        if (rows.length === 0) return res.status(404).json({ error: 'Medicine not found' });
        res.json({ data: rows[0] });
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch medicine', message: err.message });
    }
});

// ---- POST /api/medicines ---- (Admin only — Student 2 uses this)
router.post('/', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { name, description, category, price, stock, unit, dosage, manufacturer, expiry_date, image_url, requires_prescription } = req.body;

        if (!name || price === undefined || stock === undefined) {
            return res.status(400).json({ error: 'Name, price and stock are required' });
        }
        if (price < 0) return res.status(400).json({ error: 'Price cannot be negative' });
        if (stock < 0) return res.status(400).json({ error: 'Stock cannot be negative' });

        const [result] = await pool.execute(
            `INSERT INTO medicines (name, description, category, price, stock, unit, dosage, manufacturer, expiry_date, image_url, requires_prescription)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [name, description || null, category || 'general', price, stock, unit || 'tablet',
             dosage || null, manufacturer || null, expiry_date || null, image_url || null, requires_prescription ? 1 : 0]
        );

        const [newMed] = await pool.execute('SELECT * FROM medicines WHERE id = ?', [result.insertId]);
        res.status(201).json({ message: 'Medicine added successfully', data: newMed[0] });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to add medicine', message: err.message });
    }
});

// ---- PUT /api/medicines/:id ---- (Admin only — Student 2 updates stock/price)
router.put('/:id', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const [existing] = await pool.execute('SELECT id FROM medicines WHERE id = ?', [req.params.id]);
        if (existing.length === 0) return res.status(404).json({ error: 'Medicine not found' });

        const { name, description, category, price, stock, unit, dosage, manufacturer, expiry_date, image_url, requires_prescription, is_available } = req.body;

        await pool.execute(
            `UPDATE medicines SET
             name = COALESCE(?, name), description = COALESCE(?, description),
             category = COALESCE(?, category), price = COALESCE(?, price),
             stock = COALESCE(?, stock), unit = COALESCE(?, unit),
             dosage = COALESCE(?, dosage), manufacturer = COALESCE(?, manufacturer),
             expiry_date = COALESCE(?, expiry_date), image_url = COALESCE(?, image_url),
             requires_prescription = COALESCE(?, requires_prescription),
             is_available = COALESCE(?, is_available)
             WHERE id = ?`,
            [name, description, category, price, stock, unit, dosage, manufacturer,
             expiry_date, image_url,
             requires_prescription !== undefined ? (requires_prescription ? 1 : 0) : null,
             is_available !== undefined ? (is_available ? 1 : 0) : null,
             req.params.id]
        );

        const [updated] = await pool.execute('SELECT * FROM medicines WHERE id = ?', [req.params.id]);
        res.json({ message: 'Medicine updated successfully', data: updated[0] });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to update medicine', message: err.message });
    }
});

// ---- DELETE /api/medicines/:id ---- (Admin only — remove expired medicines)
router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const [existing] = await pool.execute('SELECT id, name FROM medicines WHERE id = ?', [req.params.id]);
        if (existing.length === 0) return res.status(404).json({ error: 'Medicine not found' });

        // Check if medicine is in any active order
        const [activeOrders] = await pool.execute(
            `SELECT COUNT(*) as cnt FROM order_items oi
             JOIN orders o ON oi.order_id = o.id
             WHERE oi.medicine_id = ? AND o.status NOT IN ('delivered','cancelled')`,
            [req.params.id]
        );
        if (activeOrders[0].cnt > 0) {
            return res.status(400).json({ error: 'Cannot delete medicine with active orders. Mark it unavailable instead.' });
        }

        await pool.execute('DELETE FROM medicines WHERE id = ?', [req.params.id]);
        res.json({ message: `Medicine "${existing[0].name}" deleted successfully` });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to delete medicine', message: err.message });
    }
});

module.exports = router;
