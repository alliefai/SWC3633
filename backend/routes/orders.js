// ================================================
// MediDeliver - Orders Routes (Full CRUD)
// GET    /api/orders           - Get orders (own for customer, all for admin/rider)
// GET    /api/orders/:id       - Get order detail
// POST   /api/orders           - Place new order (customer)
// PUT    /api/orders/:id       - Update order status (admin/rider)
// DELETE /api/orders/:id       - Cancel order
// ================================================
const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

// ---- GET /api/orders ---- 
// Customer: own orders | Admin: all orders | Rider: assigned orders
router.get('/', authenticateToken, async (req, res) => {
    try {
        const { status, date, rider_id } = req.query;
        let query, params = [];

        const baseSelect = `
            SELECT o.*, 
                   u.name as customer_name, u.email as customer_email, u.phone as customer_phone,
                   r.name as rider_name, r.phone as rider_phone
            FROM orders o
            JOIN users u ON o.customer_id = u.id
            LEFT JOIN users r ON o.rider_id = r.id
        `;

        const conditions = [];

        if (req.user.role === 'customer') {
            conditions.push('o.customer_id = ?');
            params.push(req.user.id);
        } else if (req.user.role === 'rider') {
            // Riders see unassigned pending orders + their own assigned orders
            conditions.push('(o.rider_id = ? OR (o.rider_id IS NULL AND o.status = "confirmed"))');
            params.push(req.user.id);
        }
        // Admins see all orders

        if (status) { conditions.push('o.status = ?'); params.push(status); }
        if (date) { conditions.push('DATE(o.created_at) = ?'); params.push(date); }

        query = baseSelect + (conditions.length ? ' WHERE ' + conditions.join(' AND ') : '') +
                ' ORDER BY o.created_at DESC';

        const [orders] = await pool.execute(query, params);

        // Attach items to each order
        for (const order of orders) {
            const [items] = await pool.execute(
                `SELECT oi.*, m.name as medicine_name, m.image_url, m.unit
                 FROM order_items oi JOIN medicines m ON oi.medicine_id = m.id
                 WHERE oi.order_id = ?`,
                [order.id]
            );
            order.items = items;
        }

        res.json({ data: orders, total: orders.length });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch orders', message: err.message });
    }
});

// ---- GET /api/orders/:id ----
router.get('/:id', authenticateToken, async (req, res) => {
    try {
        const [orders] = await pool.execute(
            `SELECT o.*, u.name as customer_name, u.email as customer_email, u.phone as customer_phone, u.address as customer_address,
                    r.name as rider_name, r.phone as rider_phone
             FROM orders o
             JOIN users u ON o.customer_id = u.id
             LEFT JOIN users r ON o.rider_id = r.id
             WHERE o.id = ?`,
            [req.params.id]
        );

        if (orders.length === 0) return res.status(404).json({ error: 'Order not found' });

        const order = orders[0];

        // Access control
        if (req.user.role === 'customer' && order.customer_id !== req.user.id) {
            return res.status(403).json({ error: 'Access denied' });
        }

        const [items] = await pool.execute(
            `SELECT oi.*, m.name as medicine_name, m.image_url, m.unit, m.category
             FROM order_items oi JOIN medicines m ON oi.medicine_id = m.id
             WHERE oi.order_id = ?`,
            [req.params.id]
        );
        order.items = items;

        res.json({ data: order });
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch order', message: err.message });
    }
});

// ---- POST /api/orders ---- (Customer places order)
router.post('/', authenticateToken, async (req, res) => {
    if (req.user.role !== 'customer') {
        return res.status(403).json({ error: 'Only customers can place orders' });
    }

    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        const { items, delivery_address, payment_method, notes } = req.body;

        if (!items || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ error: 'Order must contain at least one item' });
        }
        if (!delivery_address) {
            return res.status(400).json({ error: 'Delivery address is required' });
        }

        let total_price = 0;
        const validatedItems = [];

        // Validate all medicines and check stock
        for (const item of items) {
            if (!item.medicine_id || item.quantity <= 0) {
                await connection.rollback();
                return res.status(400).json({ error: 'Each item needs medicine_id and quantity > 0' });
            }

            const [meds] = await connection.execute(
                'SELECT * FROM medicines WHERE id = ? AND is_available = 1 FOR UPDATE',
                [item.medicine_id]
            );

            if (meds.length === 0) {
                await connection.rollback();
                return res.status(400).json({ error: `Medicine ID ${item.medicine_id} not found or unavailable` });
            }

            const med = meds[0];
            if (med.stock < item.quantity) {
                await connection.rollback();
                return res.status(400).json({ error: `Insufficient stock for ${med.name}. Only ${med.stock} left.` });
            }

            const subtotal = med.price * item.quantity;
            total_price += subtotal;
            validatedItems.push({ medicine: med, quantity: item.quantity, unit_price: med.price, subtotal });
        }

        const delivery_fee = 5.00;
        const grand_total = total_price + delivery_fee;

        // Create the order
        const [orderResult] = await connection.execute(
            `INSERT INTO orders (customer_id, delivery_address, total_price, delivery_fee, payment_method, notes, status)
             VALUES (?, ?, ?, ?, ?, ?, 'pending')`,
            [req.user.id, delivery_address, grand_total, delivery_fee, payment_method || 'cash_on_delivery', notes || null]
        );

        const orderId = orderResult.insertId;

        // Insert order items and reduce stock
        for (const item of validatedItems) {
            await connection.execute(
                'INSERT INTO order_items (order_id, medicine_id, quantity, unit_price, subtotal) VALUES (?, ?, ?, ?, ?)',
                [orderId, item.medicine.id, item.quantity, item.unit_price, item.subtotal]
            );

            await connection.execute(
                'UPDATE medicines SET stock = stock - ? WHERE id = ?',
                [item.quantity, item.medicine.id]
            );
        }

        await connection.commit();

        const [newOrder] = await pool.execute('SELECT * FROM orders WHERE id = ?', [orderId]);
        const [orderItems] = await pool.execute(
            `SELECT oi.*, m.name as medicine_name FROM order_items oi JOIN medicines m ON oi.medicine_id = m.id WHERE oi.order_id = ?`,
            [orderId]
        );
        newOrder[0].items = orderItems;

        res.status(201).json({ message: 'Order placed successfully! 🎉', data: newOrder[0] });
    } catch (err) {
        await connection.rollback();
        console.error('Create order error:', err);
        res.status(500).json({ error: 'Failed to place order', message: err.message });
    } finally {
        connection.release();
    }
});

// ---- PUT /api/orders/:id ---- (Admin confirms; Rider updates delivery status)
router.put('/:id', authenticateToken, async (req, res) => {
    try {
        const { status, rider_id, notes, estimated_delivery } = req.body;

        const [existing] = await pool.execute('SELECT * FROM orders WHERE id = ?', [req.params.id]);
        if (existing.length === 0) return res.status(404).json({ error: 'Order not found' });

        const order = existing[0];

        // Customers can only cancel their own pending orders
        if (req.user.role === 'customer') {
            if (order.customer_id !== req.user.id) return res.status(403).json({ error: 'Access denied' });
            if (status !== 'cancelled') return res.status(403).json({ error: 'Customers can only cancel orders' });
            if (!['pending', 'confirmed'].includes(order.status)) {
                return res.status(400).json({ error: 'Order cannot be cancelled at this stage' });
            }
        }

        // Riders can only update status of their assigned orders
        if (req.user.role === 'rider') {
            if (order.rider_id !== req.user.id) return res.status(403).json({ error: 'This order is not assigned to you' });
            const allowedStatuses = ['out_for_delivery', 'delivered'];
            if (!allowedStatuses.includes(status)) {
                return res.status(403).json({ error: 'Riders can only set status to out_for_delivery or delivered' });
            }
        }

        const deliveredAt = status === 'delivered' ? new Date() : null;

        await pool.execute(
            `UPDATE orders SET
             status = COALESCE(?, status),
             rider_id = COALESCE(?, rider_id),
             notes = COALESCE(?, notes),
             estimated_delivery = COALESCE(?, estimated_delivery),
             delivered_at = COALESCE(?, delivered_at)
             WHERE id = ?`,
            [status, rider_id, notes, estimated_delivery || null, deliveredAt, req.params.id]
        );

        // If order cancelled, restore stock
        if (status === 'cancelled' && order.status !== 'cancelled') {
            const [items] = await pool.execute('SELECT * FROM order_items WHERE order_id = ?', [req.params.id]);
            for (const item of items) {
                await pool.execute('UPDATE medicines SET stock = stock + ? WHERE id = ?', [item.quantity, item.medicine_id]);
            }
        }

        const [updated] = await pool.execute('SELECT * FROM orders WHERE id = ?', [req.params.id]);
        res.json({ message: 'Order updated successfully', data: updated[0] });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to update order', message: err.message });
    }
});

// ---- DELETE /api/orders/:id ---- (Admin or customer cancel + delete)
router.delete('/:id', authenticateToken, async (req, res) => {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        const [existing] = await connection.execute('SELECT * FROM orders WHERE id = ?', [req.params.id]);
        if (existing.length === 0) { await connection.rollback(); return res.status(404).json({ error: 'Order not found' }); }

        const order = existing[0];
        if (req.user.role === 'customer' && order.customer_id !== req.user.id) {
            await connection.rollback();
            return res.status(403).json({ error: 'Access denied' });
        }
        if (!['pending', 'cancelled'].includes(order.status) && req.user.role !== 'admin') {
            await connection.rollback();
            return res.status(400).json({ error: 'Can only delete pending or cancelled orders' });
        }

        // Restore stock if not already cancelled
        if (order.status !== 'cancelled') {
            const [items] = await connection.execute('SELECT * FROM order_items WHERE order_id = ?', [req.params.id]);
            for (const item of items) {
                await connection.execute('UPDATE medicines SET stock = stock + ? WHERE id = ?', [item.quantity, item.medicine_id]);
            }
        }

        await connection.execute('DELETE FROM orders WHERE id = ?', [req.params.id]);
        await connection.commit();

        res.json({ message: 'Order deleted successfully' });
    } catch (err) {
        await connection.rollback();
        res.status(500).json({ error: 'Failed to delete order', message: err.message });
    } finally {
        connection.release();
    }
});

module.exports = router;
