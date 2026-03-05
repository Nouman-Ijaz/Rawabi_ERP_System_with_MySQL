import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

// ============================================
// CONNECTION POOL
// ============================================
export const pool = mysql.createPool({
    host:               process.env.DB_HOST            || 'localhost',
    port:               parseInt(process.env.DB_PORT)  || 3306,
    user:               process.env.DB_USER            || 'root',
    password:           process.env.DB_PASSWORD        || '',
    database:           process.env.DB_NAME            || 'rawabi_erp',
    connectionLimit:    parseInt(process.env.DB_CONNECTION_LIMIT) || 10,
    waitForConnections: true,
    queueLimit:         0,
    timezone:           '+00:00',
    // Return JS Date objects for DATE/DATETIME columns
    dateStrings:        false,
    decimalNumbers:     true,
});

// ============================================
// TRANSACTION MANAGEMENT
// Active transaction connection is stored per
// logical call chain using a simple mutex.
// Safe for internal ERP workloads.
// ============================================
let activeTxConn = null;
let txLocked     = false;
const txQueue    = [];

async function acquireTxLock() {
    if (!txLocked) {
        txLocked = true;
        return;
    }
    return new Promise(resolve => txQueue.push(resolve));
}

function releaseTxLock() {
    if (txQueue.length > 0) {
        txQueue.shift()();
    } else {
        txLocked = false;
    }
}

function getExecutor() {
    return activeTxConn || pool;
}

// ============================================
// CORE HELPERS  (same API as the SQLite version)
// ============================================

/** Run a SELECT that returns multiple rows */
export async function query(sql, params = []) {
    const [rows] = await getExecutor().execute(sql, params);
    return rows;
}

/** Run a SELECT that returns a single row */
export async function get(sql, params = []) {
    const [rows] = await getExecutor().execute(sql, params);
    return rows[0] || null;
}

/** Run INSERT / UPDATE / DELETE */
export async function run(sql, params = []) {
    const [result] = await getExecutor().execute(sql, params);
    return {
        id:      result.insertId,
        changes: result.affectedRows,
    };
}

// ============================================
// TRANSACTION HELPERS
// ============================================
export async function beginTransaction() {
    await acquireTxLock();
    activeTxConn = await pool.getConnection();
    await activeTxConn.beginTransaction();
}

export async function commit() {
    await activeTxConn.commit();
    activeTxConn.release();
    activeTxConn = null;
    releaseTxLock();
}

export async function rollback() {
    try {
        await activeTxConn.rollback();
    } finally {
        activeTxConn.release();
        activeTxConn = null;
        releaseTxLock();
    }
}

// ============================================
// DATABASE INITIALISATION
// Creates the database if it does not exist,
// then runs schema.sql.
// ============================================
export async function initializeDatabase() {
    // Connect without specifying a database so we can CREATE it
    const bootstrap = await mysql.createConnection({
        host:     process.env.DB_HOST     || 'localhost',
        port:     parseInt(process.env.DB_PORT) || 3306,
        user:     process.env.DB_USER     || 'root',
        password: process.env.DB_PASSWORD || '',
    });

    const dbName = process.env.DB_NAME || 'rawabi_erp';
    // Use query() not execute() — DDL statements don't support prepared statement protocol
    await bootstrap.query(
        `CREATE DATABASE IF NOT EXISTS \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
    );
    await bootstrap.query(`USE \`${dbName}\``);

    // Read and execute schema
    const { readFileSync } = await import('fs');
    const { fileURLToPath } = await import('url');
    const { dirname, join } = await import('path');
    const __dirname = dirname(fileURLToPath(import.meta.url));

    const schema = readFileSync(join(__dirname, 'schema.sql'), 'utf8');

    // Split on statement delimiter, skip empty lines and pure comment lines
    const statements = schema
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0 && !s.startsWith('--'));

    for (const stmt of statements) {
        try {
            await bootstrap.query(stmt);
        } catch (err) {
            // Ignore "already exists" and duplicate entry errors
            if (err.code !== 'ER_TABLE_EXISTS_ERROR' &&
                err.code !== 'ER_DUP_ENTRY' &&
                err.code !== 'ER_DUP_KEYNAME') {
                console.warn('Schema warning:', err.message);
            }
        }
    }

    await bootstrap.end();
    console.log('✅  Database initialised:', dbName);
}

// ============================================
// GRACEFUL SHUTDOWN
// ============================================
export async function closePool() {
    await pool.end();
    console.log('Database pool closed.');
}

export default pool;
