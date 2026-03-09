// ============================================================
// backend/services/expiryAlerts.js
// Cron job — scans for expiring/expired documents and
// pushes records into an alerts table. Runs every 24 hours.
// ============================================================
import { query, run } from '../database/db.js';

// ── Bootstrap the alerts table on first run ──────────────────
export async function bootstrapAlertsTable() {
    await run(`
        CREATE TABLE IF NOT EXISTS expiry_alerts (
            id              INT AUTO_INCREMENT PRIMARY KEY,
            alert_key       VARCHAR(120) NOT NULL UNIQUE, -- prevents duplicate rows
            entity_type     ENUM('driver','vehicle','employee') NOT NULL,
            entity_id       INT NOT NULL,
            entity_name     VARCHAR(200),
            doc_type        VARCHAR(80) NOT NULL,
            expiry_date     DATE,
            days_until      INT,              -- negative = already expired
            severity        ENUM('critical','warning','info') DEFAULT 'warning',
            is_dismissed    TINYINT(1) DEFAULT 0,
            dismissed_by    INT NULL,
            dismissed_at    TIMESTAMP NULL,
            first_detected  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            last_checked    TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )
    `);
}

// ── Days thresholds ───────────────────────────────────────────
const THRESHOLDS = {
    critical: 7,   // ≤ 7 days or expired
    warning:  30,  // ≤ 30 days
    info:     60,  // ≤ 60 days
};

function severity(days) {
    if (days <= THRESHOLDS.critical) return 'critical';
    if (days <= THRESHOLDS.warning)  return 'warning';
    return 'info';
}

// ── Upsert a single alert row ─────────────────────────────────
async function upsertAlert({ key, entity_type, entity_id, entity_name, doc_type, expiry_date, days }) {
    const sev = severity(days);
    await run(`
        INSERT INTO expiry_alerts
            (alert_key, entity_type, entity_id, entity_name, doc_type, expiry_date, days_until, severity, is_dismissed)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)
        ON DUPLICATE KEY UPDATE
            days_until   = VALUES(days_until),
            severity     = VALUES(severity),
            entity_name  = VALUES(entity_name),
            expiry_date  = VALUES(expiry_date),
            is_dismissed = IF(VALUES(days_until) > 60, 0, is_dismissed),
            last_checked = NOW()
    `, [key, entity_type, entity_id, entity_name, doc_type, expiry_date, days, sev]);
}

// ── Remove resolved alerts (doc renewed, now > 60 days out) ──
async function pruneResolved() {
    await run(`DELETE FROM expiry_alerts WHERE days_until > 60 AND days_until IS NOT NULL`);
}

// ── Scan: Driver documents ────────────────────────────────────
async function scanDriverDocs() {
    const rows = await query(`
        SELECT d.id,
               CONCAT(e.first_name, ' ', e.last_name) AS name,
               d.license_expiry,
               d.medical_certificate_expiry,
               DATEDIFF(d.license_expiry,              CURDATE()) AS lic_days,
               DATEDIFF(d.medical_certificate_expiry,  CURDATE()) AS med_days
        FROM drivers d
        JOIN employees e ON e.id = d.employee_id
        WHERE d.license_expiry IS NOT NULL OR d.medical_certificate_expiry IS NOT NULL
    `);

    for (const r of rows) {
        if (r.license_expiry && r.lic_days <= 60) {
            await upsertAlert({
                key:         `driver-${r.id}-license`,
                entity_type: 'driver',
                entity_id:   r.id,
                entity_name: r.name,
                doc_type:    'Driver License',
                expiry_date: r.license_expiry,
                days:        r.lic_days,
            });
        }
        if (r.medical_certificate_expiry && r.med_days <= 60) {
            await upsertAlert({
                key:         `driver-${r.id}-medical`,
                entity_type: 'driver',
                entity_id:   r.id,
                entity_name: r.name,
                doc_type:    'Medical Certificate',
                expiry_date: r.medical_certificate_expiry,
                days:        r.med_days,
            });
        }
    }
}

// ── Scan: Vehicle documents ───────────────────────────────────
async function scanVehicleDocs() {
    const rows = await query(`
        SELECT v.id,
               CONCAT(v.plate_number, ' (', v.brand, ' ', v.model, ')') AS name,
               v.registration_expiry,
               v.insurance_expiry,
               DATEDIFF(v.registration_expiry, CURDATE()) AS reg_days,
               DATEDIFF(v.insurance_expiry,    CURDATE()) AS ins_days
        FROM vehicles v
        WHERE v.registration_expiry IS NOT NULL OR v.insurance_expiry IS NOT NULL
    `);

    for (const r of rows) {
        if (r.registration_expiry && r.reg_days <= 60) {
            await upsertAlert({
                key:         `vehicle-${r.id}-registration`,
                entity_type: 'vehicle',
                entity_id:   r.id,
                entity_name: r.name,
                doc_type:    'Vehicle Registration',
                expiry_date: r.registration_expiry,
                days:        r.reg_days,
            });
        }
        if (r.insurance_expiry && r.ins_days <= 60) {
            await upsertAlert({
                key:         `vehicle-${r.id}-insurance`,
                entity_type: 'vehicle',
                entity_id:   r.id,
                entity_name: r.name,
                doc_type:    'Insurance',
                expiry_date: r.insurance_expiry,
                days:        r.ins_days,
            });
        }
    }
}

// ── Scan: Employee documents ──────────────────────────────────
async function scanEmployeeDocs() {
    const rows = await query(`
        SELECT e.id,
               CONCAT(e.first_name, ' ', e.last_name) AS name,
               e.id_expiry, e.passport_expiry, e.visa_expiry,
               e.work_permit_expiry, e.medical_insurance_expiry,
               DATEDIFF(e.id_expiry,              CURDATE()) AS id_days,
               DATEDIFF(e.passport_expiry,        CURDATE()) AS pp_days,
               DATEDIFF(e.visa_expiry,             CURDATE()) AS vi_days,
               DATEDIFF(e.work_permit_expiry,     CURDATE()) AS wp_days,
               DATEDIFF(e.medical_insurance_expiry, CURDATE()) AS mi_days
        FROM employees e
        WHERE e.status != 'terminated'
    `);

    const checks = [
        ['id_expiry',               'id_days',  'National ID'],
        ['passport_expiry',         'pp_days',  'Passport'],
        ['visa_expiry',             'vi_days',  'Work Visa'],
        ['work_permit_expiry',      'wp_days',  'Work Permit'],
        ['medical_insurance_expiry','mi_days',  'Medical Insurance'],
    ];

    for (const r of rows) {
        for (const [field, daysField, label] of checks) {
            if (r[field] && r[daysField] !== null && r[daysField] <= 60) {
                await upsertAlert({
                    key:         `employee-${r.id}-${field}`,
                    entity_type: 'employee',
                    entity_id:   r.id,
                    entity_name: r.name,
                    doc_type:    label,
                    expiry_date: r[field],
                    days:        r[daysField],
                });
            }
        }
    }
}

// ── Main scan function ────────────────────────────────────────
export async function runExpiryCheck() {
    try {
        console.log('[ExpiryAlerts] Starting document expiry scan…');
        await bootstrapAlertsTable();
        await scanDriverDocs();
        await scanVehicleDocs();
        await scanEmployeeDocs();
        await pruneResolved();

        // Count what we found
        const { count } = await query(`SELECT COUNT(*) AS count FROM expiry_alerts WHERE is_dismissed = 0`)
            .then(r => r[0] || { count: 0 });
        console.log(`[ExpiryAlerts] Scan complete — ${count} active alert(s)`);
    } catch (err) {
        console.error('[ExpiryAlerts] Scan failed:', err.message);
    }
}

// ── API: get current alerts ───────────────────────────────────
export async function getActiveAlerts({ severity: sev, entity_type } = {}) {
    let where = 'WHERE is_dismissed = 0';
    const params = [];
    if (sev)         { where += ' AND severity = ?';     params.push(sev); }
    if (entity_type) { where += ' AND entity_type = ?';  params.push(entity_type); }
    return query(
        `SELECT * FROM expiry_alerts ${where} ORDER BY days_until ASC`,
        params
    );
}

export async function dismissAlert(id, userId) {
    return run(
        `UPDATE expiry_alerts SET is_dismissed = 1, dismissed_by = ?, dismissed_at = NOW() WHERE id = ?`,
        [userId, id]
    );
}

// ── Scheduler — runs once at startup then every 24h ──────────
let _timer = null;

export function startExpiryScheduler() {
    // Run immediately on startup
    runExpiryCheck();
    // Then every 24 hours
    _timer = setInterval(runExpiryCheck, 24 * 60 * 60 * 1000);
    console.log('[ExpiryAlerts] Scheduler started — checks every 24h');
}

export function stopExpiryScheduler() {
    if (_timer) { clearInterval(_timer); _timer = null; }
}
