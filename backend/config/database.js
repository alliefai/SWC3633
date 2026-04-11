// ================================================
// EventHub - Database Configuration
// MySQL Connection Pool using mysql2
// ================================================
const mysql = require('mysql2/promise');
require('dotenv').config();

const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'eventhub',
    port: process.env.DB_PORT || 3306,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// Test database connection on startup
pool.getConnection()
    .then(conn => {
        console.log('✅ MySQL database connected successfully');
        conn.release();
    })
    .catch(err => {
        console.error('❌ Database connection failed:', err.message);
        console.error('   Make sure XAMPP MySQL is running and the "eventhub" database exists.');
        console.error('   Run the schema.sql file first: mysql -u root < database/schema.sql');
    });

module.exports = pool;
