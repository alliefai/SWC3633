// ================================================
// MediDeliver - Database Seed Script
// Run: node seed.js
// ================================================
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function seed() {
    console.log('🌱 Seeding MediDeliver database...\n');

    const root = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        port: process.env.DB_PORT || 3306,
        multipleStatements: true
    });

    try {
        const schema = fs.readFileSync(path.join(__dirname, 'database', 'schema.sql'), 'utf8');
        await root.query(schema);
        console.log('✅ Schema + medicines seeded\n');
    } catch (err) {
        console.error('❌', err.message);
    }
    await root.end();

    const pool = mysql.createPool({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'medideliver',
        port: process.env.DB_PORT || 3306
    });

    try {
        await pool.execute('DELETE FROM order_items');
        await pool.execute('DELETE FROM orders');
        await pool.execute('DELETE FROM users');

        const adminPw   = await bcrypt.hash('admin123', 10);
        const custPw    = await bcrypt.hash('user123', 10);
        const riderPw   = await bcrypt.hash('rider123', 10);

        const adminKey = 'md_' + crypto.randomBytes(24).toString('hex');
        const custKey  = 'md_' + crypto.randomBytes(24).toString('hex');
        const riderKey = 'md_' + crypto.randomBytes(24).toString('hex');

        const [adminR] = await pool.execute(
            'INSERT INTO users (name, email, password, phone, role, address, api_key) VALUES (?,?,?,?,?,?,?)',
            ['Admin Pharmacist', 'admin@medideliver.com', adminPw, '011-1234567', 'admin', 'MediDeliver HQ, KL', adminKey]
        );
        const [custR] = await pool.execute(
            'INSERT INTO users (name, email, password, phone, role, address, api_key) VALUES (?,?,?,?,?,?,?)',
            ['Ahmad Zulkifli', 'ahmad@email.com', custPw, '012-3456789', 'customer', 'No. 5 Jalan Bukit Bintang, KL', custKey]
        );
        const [riderR] = await pool.execute(
            'INSERT INTO users (name, email, password, phone, role, address, api_key) VALUES (?,?,?,?,?,?,?)',
            ['Rahman Rider', 'rider@medideliver.com', riderPw, '013-9876543', 'rider', 'Chow Kit, KL', riderKey]
        );

        console.log('👤 Users created:');
        console.log('   Admin:  admin@medideliver.com / admin123');
        console.log('   Customer: ahmad@email.com / user123');
        console.log('   Rider:  rider@medideliver.com / rider123\n');

        // Sample orders
        const [order1] = await pool.execute(
            `INSERT INTO orders (customer_id, rider_id, status, delivery_address, total_price, delivery_fee, payment_method)
             VALUES (?, ?, 'out_for_delivery', 'No. 5 Jalan Bukit Bintang, KL 55100', 38.80, 5.00, 'e_wallet')`,
            [custR.insertId, riderR.insertId]
        );
        await pool.execute(
            'INSERT INTO order_items (order_id, medicine_id, quantity, unit_price, subtotal) VALUES (?, 1, 2, 8.90, 17.80), (?, 3, 1, 22.50, 22.50)',
            [order1.insertId, order1.insertId]
        );

        const [order2] = await pool.execute(
            `INSERT INTO orders (customer_id, status, delivery_address, total_price, delivery_fee, payment_method)
             VALUES (?, 'pending', 'No. 5 Jalan Bukit Bintang, KL 55100', 60.00, 5.00, 'cash_on_delivery')`,
            [custR.insertId]
        );
        await pool.execute(
            'INSERT INTO order_items (order_id, medicine_id, quantity, unit_price, subtotal) VALUES (?, 7, 1, 55.00, 55.00)',
            [order2.insertId]
        );

        console.log('🛒 Sample orders created\n');
        console.log('════════════════════════════════════');
        console.log('🎉 Database seeded! Run: node server.js');
        console.log('════════════════════════════════════\n');
    } catch (err) {
        console.error('❌ Seed error:', err.message);
    } finally {
        await pool.end();
    }
}

seed();
