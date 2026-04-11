// One-time script to create admin account
require('dotenv').config();
const bcrypt = require('bcryptjs');
const pool = require('./config/database');

async function createAdmin() {
    const email    = 'admin@medideliver.com';
    const password = 'admin123';
    const name     = 'Admin';

    const hash = await bcrypt.hash(password, 10);

    // Delete existing admin with this email first
    await pool.execute('DELETE FROM users WHERE email = ?', [email]);

    await pool.execute(
        'INSERT INTO users (name, email, password, phone, role, is_active) VALUES (?, ?, ?, ?, ?, ?)',
        [name, email, hash, '0123456789', 'admin', 1]
    );

    console.log('✅ Admin account created!');
    console.log('   Email:    admin@medideliver.com');
    console.log('   Password: admin123');
    console.log('   Role:     admin');
    process.exit(0);
}

createAdmin().catch(err => { console.error('❌ Error:', err.message); process.exit(1); });
