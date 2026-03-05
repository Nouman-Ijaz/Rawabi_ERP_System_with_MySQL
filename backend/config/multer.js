import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Base uploads directory
const UPLOADS_BASE = path.join(__dirname, '..', 'public', 'uploads');

const ensureDirectory = (dir) => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
};

// Static directories for profile/entity photos
const EMPLOYEES_DIR = path.join(UPLOADS_BASE, 'employees');
const DRIVERS_DIR   = path.join(UPLOADS_BASE, 'drivers');
const VEHICLES_DIR  = path.join(UPLOADS_BASE, 'vehicles');

// Shipment documents: uploads/shipment_documents/{shipmentId}/{docType}/
const SHIPMENT_DOCS_BASE = path.join(UPLOADS_BASE, 'shipment_documents');

export function initializeUploadDirs() {
    ensureDirectory(UPLOADS_BASE);
    ensureDirectory(EMPLOYEES_DIR);
    ensureDirectory(DRIVERS_DIR);
    ensureDirectory(VEHICLES_DIR);
    ensureDirectory(SHIPMENT_DOCS_BASE);
    console.log('Upload directories initialized:', UPLOADS_BASE);
}

// ── Storage factory for employee/driver/vehicle photos ──────────
function createStorage(uploadDir) {
    return multer.diskStorage({
        destination: (req, file, cb) => {
            ensureDirectory(uploadDir);
            cb(null, uploadDir);
        },
        filename: (req, file, cb) => {
            const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
            const ext = path.extname(file.originalname);
            const prefix = req.params.id ? `update-${req.params.id}-` : 'new-';
            cb(null, prefix + uniqueSuffix + ext);
        }
    });
}

// ── Storage factory for shipment documents ───────────────────────
// Saves to: uploads/shipment_documents/{shipmentId}/{docType}/{timestamp}-{originalname}
export const shipmentDocStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        const shipmentId = req.params.id || 'unknown';
        const docType    = (req.body.documentType || 'other').replace(/[^a-z0-9_]/gi, '_');
        const dir = path.join(SHIPMENT_DOCS_BASE, String(shipmentId), docType);
        ensureDirectory(dir);
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        const ts  = Date.now();
        const ext = path.extname(file.originalname);
        const base = path.basename(file.originalname, ext)
            .replace(/[^a-z0-9_\-]/gi, '_')
            .slice(0, 60);
        cb(null, `${ts}-${base}${ext}`);
    }
});

// ── File filters ────────────────────────────────────────────────
const imageFileFilter = (req, file, cb) => {
    const ok = /jpeg|jpg|png|gif|webp/.test(path.extname(file.originalname).toLowerCase());
    ok ? cb(null, true) : cb(new Error('Only image files allowed'));
};

const documentFileFilter = (req, file, cb) => {
    const ok = /jpeg|jpg|png|pdf|doc|docx|xls|xlsx/.test(path.extname(file.originalname).toLowerCase());
    ok ? cb(null, true) : cb(new Error('Allowed: PDF, JPG, PNG, Word, Excel'));
};

// ── Multer instances ─────────────────────────────────────────────
export const uploadEmployee = multer({ storage: createStorage(EMPLOYEES_DIR), limits: { fileSize: 5 * 1024 * 1024 }, fileFilter: imageFileFilter });
export const uploadDriver   = multer({ storage: createStorage(DRIVERS_DIR),   limits: { fileSize: 5 * 1024 * 1024 }, fileFilter: imageFileFilter });
export const uploadVehicle  = multer({ storage: createStorage(VEHICLES_DIR),  limits: { fileSize: 5 * 1024 * 1024 }, fileFilter: imageFileFilter });

export const uploadDocument = multer({
    storage: shipmentDocStorage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
    fileFilter: documentFileFilter,
});

// ── Path helpers ─────────────────────────────────────────────────
export const UPLOAD_PATHS = {
    base:             UPLOADS_BASE,
    employees:        EMPLOYEES_DIR,
    drivers:          DRIVERS_DIR,
    vehicles:         VEHICLES_DIR,
    shipmentDocBase:  SHIPMENT_DOCS_BASE,
};

// Reconstruct the public URL from stored relative path
// file_path in DB stores: "{shipmentId}/{docType}/{filename}"
export function getDocumentUrl(filePath) {
    if (!filePath) return null;
    return `/uploads/shipment_documents/${filePath}`;
}

export function getPublicUrl(filename, type) {
    if (!filename) return null;
    return `/uploads/${type}/${filename}`;
}
