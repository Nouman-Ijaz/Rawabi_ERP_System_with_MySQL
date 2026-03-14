// ─────────────────────────────────────────────────────────────────
// backend/controllers/tripsController.js
// Driver "My Trips" portal — all endpoints scoped to the calling
// driver. Driver identity is always resolved from req.user.id via
// the resolveDriverId middleware (attached in routes/index.js).
// Never trust a driver_id from the request body or params.
// ─────────────────────────────────────────────────────────────────
import { asyncHandler, httpError } from '../middleware/asyncHandler.js';
import { query, get, run }         from '../database/db.js';
import { logActivity, paginate, n } from '../utils/helpers.js';

// ── Guard: driver role only ────────────────────────────────────────
// Shared inline check so every handler stays clean.
function requireDriver(req) {
    if (req.user.role !== 'driver') {
        throw httpError(403, 'This endpoint is for drivers only');
    }
    if (!req.driverId) {
        throw httpError(403, 'Driver record not found for your account');
    }
}

// ── Allowed status transitions for drivers ─────────────────────────
// Key = current status, Value = array of statuses the driver may
// transition to. Any other target is a 403.
// NOTE: 'delayed' is a logical status only — the DB ENUM does not
// include it. When a driver reports a delay, the shipment stays
// 'in_transit' in the DB and a DELAYED tracking event is written.
// The API response returns logicalStatus='delayed' so the frontend
// card updates correctly without a full reload.
const ALLOWED_TRANSITIONS = {
    confirmed:  ['picked_up'],
    picked_up:  ['in_transit', 'delayed'],
    in_transit: ['delivered', 'delayed'],
    delayed:    ['in_transit'],
};

// Maps logical status (what driver sends) → DB status (what MySQL stores)
// 'delayed' and 'resumed' are tracking events, not DB enum values.
const DB_STATUS = {
    confirmed:  'confirmed',
    picked_up:  'picked_up',
    in_transit: 'in_transit',
    delivered:  'delivered',
    delayed:    'in_transit',   // stays in_transit in DB
};

// ─────────────────────────────────────────────────────────────────
// GET /my-trips
// Returns all shipments assigned to the calling driver.
// Filterable by status. Paginated.
// ─────────────────────────────────────────────────────────────────
export const getMyTrips = asyncHandler(async (req, res) => {
    requireDriver(req);

    const { status, from, to } = req.query;
    const { limit, offset, respond } = paginate(req.query, 20);

    let sql = `
        SELECT
            s.id,
            s.shipment_number,
            s.tracking_number,
            s.status,
            s.origin_city,
            s.origin_address,
            s.destination_city,
            s.destination_address,
            s.cargo_type,
            s.weight_kg,
            s.pieces,
            s.transport_mode,
            s.requested_pickup_date,
            s.actual_pickup_date,
            s.requested_delivery_date,
            s.actual_delivery_date,
            s.special_instructions,
            s.created_at,
            c.company_name  AS customer_name,
            c.phone         AS customer_phone,
            v.plate_number  AS vehicle_plate,
            v.vehicle_type,
            (
                SELECT COUNT(*)
                FROM shipment_documents sd
                WHERE sd.shipment_id = s.id AND sd.document_type = 'pod'
            ) AS pod_count,
            (
                SELECT COUNT(*)
                FROM shipment_issues si
                WHERE si.shipment_id = s.id AND si.status = 'open'
            ) AS open_issues,
            (
                SELECT event_type
                FROM shipment_tracking
                WHERE shipment_id = s.id
                ORDER BY event_time DESC
                LIMIT 1
            ) AS last_event_type
        FROM shipments s
        JOIN customers c ON c.id = s.customer_id
        LEFT JOIN vehicles v ON v.id = s.vehicle_id
        WHERE s.driver_id = ?
    `;
    const params = [req.driverId];

    if (status) {
        // Support comma-separated list: ?status=picked_up,in_transit
        const statuses = status.split(',').map(s => s.trim()).filter(Boolean);
        if (statuses.length === 1) {
            sql += ' AND s.status = ?';
            params.push(statuses[0]);
        } else {
            sql += ` AND s.status IN (${statuses.map(() => '?').join(',')})`;
            params.push(...statuses);
        }
    }
    if (from) { sql += ' AND DATE(s.requested_pickup_date) >= ?'; params.push(from); }
    if (to)   { sql += ' AND DATE(s.requested_pickup_date) <= ?'; params.push(to); }

    // Count query — written explicitly to avoid regex fragility with subqueries
    let countSql = `
        SELECT COUNT(*) AS total
        FROM shipments s
        JOIN customers c ON c.id = s.customer_id
        WHERE s.driver_id = ?
    `;
    // countParams mirrors the WHERE clauses added to the main query
    const countParams = [req.driverId];
    if (status) {
        const statuses = status.split(',').map(s => s.trim()).filter(Boolean);
        if (statuses.length === 1) {
            countSql += ' AND s.status = ?';
            countParams.push(statuses[0]);
        } else {
            countSql += ` AND s.status IN (${statuses.map(() => '?').join(',')})`;
            countParams.push(...statuses);
        }
    }
    if (from) { countSql += ' AND DATE(s.requested_pickup_date) >= ?'; countParams.push(from); }
    if (to)   { countSql += ' AND DATE(s.requested_pickup_date) <= ?'; countParams.push(to); }

    const countRow = await get(countSql, countParams);
    const total    = countRow?.total ?? 0;

    sql += ` ORDER BY
        CASE
            WHEN (
                SELECT event_type FROM shipment_tracking
                WHERE shipment_id = s.id ORDER BY event_time DESC LIMIT 1
            ) = 'DELAYED' THEN 1
            WHEN s.status = 'in_transit' THEN 2
            WHEN s.status = 'picked_up'  THEN 3
            WHEN s.status = 'confirmed'  THEN 4
            ELSE 5
        END,
        s.requested_delivery_date ASC
        LIMIT ${limit} OFFSET ${offset}`;

    const rows = await query(sql, params);
    res.json(respond(rows, total));
});

// ─────────────────────────────────────────────────────────────────
// GET /my-trips/:id
// Full detail of a single shipment — must belong to caller.
// ─────────────────────────────────────────────────────────────────
export const getMyTripById = asyncHandler(async (req, res) => {
    requireDriver(req);
    const { id } = req.params;

    const shipment = await get(`
        SELECT
            s.*,
            c.company_name  AS customer_name,
            c.phone         AS customer_phone,
            c.email         AS customer_email,
            c.contact_person AS customer_contact,
            v.plate_number  AS vehicle_plate,
            v.vehicle_type,
            v.vehicle_code
        FROM shipments s
        JOIN customers c ON c.id = s.customer_id
        LEFT JOIN vehicles v ON v.id = s.vehicle_id
        WHERE s.id = ? AND s.driver_id = ?
    `, [id, req.driverId]);

    if (!shipment) throw httpError(404, 'Shipment not found or not assigned to you');

    // Tracking timeline
    const tracking = await query(
        `SELECT event_type, event_description, location, notes, event_time
         FROM shipment_tracking
         WHERE shipment_id = ?
         ORDER BY event_time ASC`,
        [id]
    );

    // POD documents
    const documents = await query(
        `SELECT id, document_type, document_name, file_path, notes, created_at
         FROM shipment_documents
         WHERE shipment_id = ?
         ORDER BY created_at DESC`,
        [id]
    );

    // Issues
    const issues = await query(
        `SELECT id, issue_type, description, location, status, reported_at, resolved_at
         FROM shipment_issues
         WHERE shipment_id = ? AND driver_id = ?
         ORDER BY reported_at DESC`,
        [id, req.driverId]
    );

    res.json({ ...shipment, tracking, documents, issues });
});

// ─────────────────────────────────────────────────────────────────
// PUT /my-trips/:id/status
// Driver updates shipment status. Enforces strict transition rules.
// Rejects delivery if no POD has been uploaded.
// ─────────────────────────────────────────────────────────────────
export const updateMyTripStatus = asyncHandler(async (req, res) => {
    requireDriver(req);
    const { id }                    = req.params;
    const { status, reason, location, notes } = req.body;

    if (!status) throw httpError(400, 'status is required');

    // Load and verify ownership
    const shipment = await get(
        'SELECT id, status, driver_id, shipment_number FROM shipments WHERE id = ?',
        [id]
    );
    if (!shipment)                          throw httpError(404, 'Shipment not found');
    if (shipment.driver_id !== req.driverId) throw httpError(403, 'This shipment is not assigned to you');

    // Derive logical current status — 'delayed' is stored as 'in_transit' in DB.
    // Check the last tracking event to distinguish the two.
    const lastEvent = await get(
        `SELECT event_type FROM shipment_tracking
         WHERE shipment_id = ?
         ORDER BY event_time DESC LIMIT 1`,
        [id]
    );
    const isCurrentlyDelayed = lastEvent?.event_type === 'DELAYED';
    const current = isCurrentlyDelayed ? 'delayed' : shipment.status;

    // Validate transition
    const allowed = ALLOWED_TRANSITIONS[current] || [];
    if (!allowed.includes(status)) {
        throw httpError(403,
            `Cannot transition from "${current}" to "${status}". ` +
            `Allowed next statuses: ${allowed.join(', ') || 'none'}`
        );
    }

    // delay requires a reason
    if (status === 'delayed' && !reason?.trim()) {
        throw httpError(400, 'A reason is required when reporting a delay');
    }

    // delivery requires POD
    if (status === 'delivered') {
        const pod = await get(
            `SELECT id FROM shipment_documents
             WHERE shipment_id = ? AND document_type = 'pod'
             LIMIT 1`,
            [id]
        );
        if (!pod) {
            throw httpError(400, 'Upload a Proof of Delivery (POD) before marking delivered');
        }
    }

    // 'delayed' is a logical status only — map to the real DB enum value
    const dbStatus = DB_STATUS[status] ?? status;

    // Timestamps
    const now          = new Date();
    const pickupDate   = status === 'picked_up'  ? now : null;
    const deliveryDate = status === 'delivered'  ? now : null;

    await run(
        `UPDATE shipments SET
            status               = ?,
            actual_pickup_date   = COALESCE(?, actual_pickup_date),
            actual_delivery_date = COALESCE(?, actual_delivery_date),
            updated_at           = NOW()
         WHERE id = ?`,
        [dbStatus, pickupDate, deliveryDate, id]
    );

    // Tracking event — for delay/resume use distinct event types
    // so the frontend and timeline can show the full history
    const EVENT_TYPE = {
        picked_up:  'PICKED_UP',
        in_transit: current === 'delayed' ? 'RESUMED' : 'IN_TRANSIT',
        delivered:  'DELIVERED',
        delayed:    'DELAYED',
    };
    const EVENT_DESCRIPTIONS = {
        picked_up:  'Cargo picked up by driver',
        in_transit: current === 'delayed' ? 'Shipment resumed after delay' : 'Shipment in transit',
        delivered:  'Shipment delivered successfully',
        delayed:    `Shipment delayed${reason ? ': ' + reason : ''}`,
    };
    const eventNotes = status === 'delayed' ? reason : (notes ?? null);

    await run(
        `INSERT INTO shipment_tracking
            (shipment_id, event_type, event_description, location, notes, recorded_by)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
            id,
            EVENT_TYPE[status] || status.toUpperCase(),
            EVENT_DESCRIPTIONS[status] || status,
            n(location),
            n(eventNotes),
            req.user.id,
        ]
    );

    // Keep driver.status in sync
    if (['picked_up', 'in_transit', 'delayed'].includes(status)) {
        await run("UPDATE drivers SET status = 'on_trip' WHERE id = ?", [req.driverId]);
    } else if (status === 'delivered') {
        await run("UPDATE drivers SET status = 'available' WHERE id = ?", [req.driverId]);
    }

    await logActivity(
        req.user.id,
        'DRIVER_STATUS_UPDATE',
        'shipment',
        id,
        { status, dbStatus, location: location || null, reason: reason || null }
    );

    // Return logicalStatus so the frontend card updates correctly.
    // For 'delayed', the DB holds 'in_transit' but we tell the
    // frontend 'delayed' so the card shows the right badge + button.
    res.json({
        message:       `Shipment ${shipment.shipment_number} updated to ${status.replace('_', ' ')}`,
        status:        status,        // logical (what frontend uses)
        dbStatus:      dbStatus,      // actual DB value
    });
});

// ─────────────────────────────────────────────────────────────────
// POST /my-trips/:id/issue
// Driver reports a field issue on a shipment.
// Inserts into shipment_issues and adds to notifications via a
// flag that the notifications endpoint already polls by open issues.
// ─────────────────────────────────────────────────────────────────
export const reportIssue = asyncHandler(async (req, res) => {
    requireDriver(req);
    const { id }                           = req.params;
    const { issue_type, description, location } = req.body;

    if (!issue_type)    throw httpError(400, 'issue_type is required');
    if (!description?.trim()) throw httpError(400, 'description is required');

    const VALID_TYPES = ['breakdown', 'accident', 'customs_hold', 'road_closure', 'other'];
    if (!VALID_TYPES.includes(issue_type)) {
        throw httpError(400, `issue_type must be one of: ${VALID_TYPES.join(', ')}`);
    }

    // Verify shipment belongs to this driver
    const shipment = await get(
        'SELECT id, shipment_number, status FROM shipments WHERE id = ? AND driver_id = ?',
        [id, req.driverId]
    );
    if (!shipment) throw httpError(404, 'Shipment not found or not assigned to you');

    const result = await run(
        `INSERT INTO shipment_issues
            (shipment_id, driver_id, issue_type, description, location)
         VALUES (?, ?, ?, ?, ?)`,
        [id, req.driverId, issue_type, description.trim(), n(location)]
    );

    await logActivity(
        req.user.id,
        'DRIVER_ISSUE_REPORTED',
        'shipment',
        id,
        { issue_type, description: description.trim(), location: location || null }
    );

    res.status(201).json({
        message:   'Issue reported successfully. Dispatchers will see it in their notifications.',
        issue_id:  result.id,
        issue_type,
        shipment_number: shipment.shipment_number,
    });
});

// ─────────────────────────────────────────────────────────────────
// GET /my-trips/:id/issues
// All issues the driver has filed on a specific shipment.
// ─────────────────────────────────────────────────────────────────
export const getTripIssues = asyncHandler(async (req, res) => {
    requireDriver(req);
    const { id } = req.params;

    // Verify ownership
    const shipment = await get(
        'SELECT id FROM shipments WHERE id = ? AND driver_id = ?',
        [id, req.driverId]
    );
    if (!shipment) throw httpError(404, 'Shipment not found or not assigned to you');

    const issues = await query(
        `SELECT
            si.id,
            si.issue_type,
            si.description,
            si.location,
            si.status,
            si.reported_at,
            si.resolved_at,
            CONCAT(u.first_name, ' ', u.last_name) AS resolved_by_name
         FROM shipment_issues si
         LEFT JOIN users u ON u.id = si.resolved_by
         WHERE si.shipment_id = ? AND si.driver_id = ?
         ORDER BY si.reported_at DESC`,
        [id, req.driverId]
    );

    res.json(issues);
});

// ─────────────────────────────────────────────────────────────────
// GET /my-trips/all-issues
// All issues the driver has ever filed — used for Issues tab.
// ─────────────────────────────────────────────────────────────────
export const getAllMyIssues = asyncHandler(async (req, res) => {
    requireDriver(req);

    const issues = await query(
        `SELECT
            si.id,
            si.shipment_id,
            s.shipment_number,
            s.origin_city,
            s.destination_city,
            si.issue_type,
            si.description,
            si.location,
            si.status,
            si.reported_at,
            si.resolved_at
         FROM shipment_issues si
         JOIN shipments s ON s.id = si.shipment_id
         WHERE si.driver_id = ?
         ORDER BY si.reported_at DESC`,
        [req.driverId]
    );

    res.json(issues);
});
