import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import dotenv from 'dotenv';

import routes from './routes/index.js';
import { initializeDatabase, closePool } from './database/db.js';
import { initializeUploadDirs } from './config/multer.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

const app  = express();
const PORT = process.env.PORT || 3001;

// ============================================
// UPLOAD DIRECTORIES
// ============================================
// Ensure all upload directories exist before static middleware
const uploadsDir = path.join(__dirname, 'public', 'uploads');
['', 'employees', 'drivers', 'vehicles', 'shipment_documents'].forEach(sub => {
    const d = path.join(uploadsDir, sub);
    if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
});
initializeUploadDirs();

// ============================================
// MIDDLEWARE
// ============================================
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ============================================
// STATIC FILES
// ============================================
app.use('/uploads', express.static(path.join(__dirname, 'public', 'uploads')));

const distPath = path.join(__dirname, '..', 'dist');
if (fs.existsSync(distPath)) {
    app.use(express.static(distPath));
}

// ============================================
// API ROUTES
// ============================================
app.use('/api', routes);

// ============================================
// HEALTH CHECK
// ============================================
app.get('/health', (req, res) => {
    res.json({
        status:    'OK',
        timestamp: new Date().toISOString(),
        version:   '2.0.0',
        database:  'MySQL',
    });
});

// ============================================
// FRONTEND (Production)
// ============================================
if (fs.existsSync(distPath)) {
    app.get('/{*splat}', (req, res) => {
        res.sendFile(path.join(distPath, 'index.html'));
    });
}

// ============================================
// ERROR HANDLING
// ============================================
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    if (err.name === 'MulterError') {
        return res.status(400).json({ error: 'File upload error', message: err.message });
    }
    res.status(500).json({
        error:   'Internal server error',
        message: process.env.NODE_ENV === 'development' ? err.message : undefined,
    });
});

app.use((req, res) => {
    // Return plain 404 for static asset requests so browser doesn't show JSON error
    if (req.path.startsWith('/uploads/')) {
        return res.status(404).send('File not found');
    }
    res.status(404).json({ error: 'Route not found' });
});

// ============================================
// STARTUP
// ============================================
async function startServer() {
    try {
        await initializeDatabase();

        app.listen(PORT, () => {
            console.log(`
╔══════════════════════════════════════════════════╗
║   Rawabi Logistics ERP  –  v2.0.0               ║
║   Database  : MySQL 8.x                         ║
║   Server    : http://localhost:${PORT}              ║
║   API Base  : http://localhost:${PORT}/api          ║
║   Health    : http://localhost:${PORT}/health        ║
╚══════════════════════════════════════════════════╝`
            );
        });
    } catch (error) {
        console.error('❌  Failed to start server:', error.message);
        process.exit(1);
    }
}

// ============================================
// GRACEFUL SHUTDOWN
// ============================================
async function shutdown(signal) {
    console.log(`\n${signal} received — shutting down gracefully...`);
    await closePool();
    process.exit(0);
}

process.on('SIGINT',  () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

startServer();

export default app;
