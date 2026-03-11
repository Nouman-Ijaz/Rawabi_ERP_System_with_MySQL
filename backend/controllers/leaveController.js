// ============================================================
// backend/controllers/leaveController.js
// Leave Management — requests, balances, types
// ============================================================
import { query, get, run } from '../database/db.js';
import { asyncHandler, httpError } from '../middleware/asyncHandler.js';
import { ROLE_GROUPS } from '../config/constants.js';

const MGMT  = ROLE_GROUPS.MANAGEMENT;
const ADMIN = ROLE_GROUPS.ADMIN_UP;

// ── Helper: generate request number LVR-YYMM-NNN ────────────────
async function nextRequestNumber() {
    const ym = new Date().toISOString().slice(2, 7).replace('-', '');
    const prefix = `LVR-${ym}-`;
    const last = await get(
        `SELECT request_number FROM leave_requests
         WHERE request_number LIKE ? ORDER BY id DESC LIMIT 1`,
        [prefix + '%']
    );
    const seq = last ? parseInt(last.request_number.slice(-3), 10) + 1 : 1;
    return prefix + String(seq).padStart(3, '0');
}

// ── Helper: calendar days count (Saudi Labor Law — Art. 109 counts calendar days) ──
function calendarDays(startStr, endStr) {
    const start = new Date(startStr);
    const end   = new Date(endStr);
    const diff  = Math.round((end - start) / (1000 * 60 * 60 * 24)) + 1;
    return Math.max(0, diff);
}

// ── Leave Types ──────────────────────────────────────────────────
export const getLeaveTypes = asyncHandler(async (req, res) => {
    const types = await query(`SELECT * FROM leave_types WHERE is_active = 1 ORDER BY name`);
    res.json(types);
});

// ── Leave Balances ───────────────────────────────────────────────
export const getBalances = asyncHandler(async (req, res) => {
    const { employeeId } = req.params;
    const year = req.query.year || new Date().getFullYear();

    // Ensure balances exist for this employee/year by seeding from types
    const types = await query(`SELECT * FROM leave_types WHERE is_active = 1`);
    for (const t of types) {
        await run(
            `INSERT IGNORE INTO leave_balances
             (employee_id, leave_type_id, year, entitled_days, used_days, pending_days, carried_days)
             VALUES (?, ?, ?, ?, 0, 0, 0)`,
            [employeeId, t.id, year, t.days_per_year]
        );
    }

    const balances = await query(
        `SELECT lb.*, lt.name, lt.code, lt.color, lt.is_paid, lt.days_per_year,
                (lb.entitled_days + lb.carried_days - lb.used_days - lb.pending_days) AS remaining_days
         FROM leave_balances lb
         JOIN leave_types lt ON lt.id = lb.leave_type_id
         WHERE lb.employee_id = ? AND lb.year = ?
         ORDER BY lt.name`,
        [employeeId, year]
    );
    res.json(balances);
});

// ── My own balances (resolves employee via user_id, no client-side employeeId needed) ──
export const getMyBalances = asyncHandler(async (req, res) => {
    const year = req.query.year || new Date().getFullYear();

    // Resolve employee record for the logged-in user
    const emp = await get('SELECT id FROM employees WHERE user_id = ?', [req.user.id]);
    if (!emp) {
        // Return empty array — cleaner than a 404 so the UI can show an empty state
        return res.json([]);
    }
    const employeeId = emp.id;

    // Seed balances for all active leave types if not yet seeded
    const types = await query(`SELECT * FROM leave_types WHERE is_active = 1`);
    for (const t of types) {
        await run(
            `INSERT IGNORE INTO leave_balances
             (employee_id, leave_type_id, year, entitled_days, used_days, pending_days, carried_days)
             VALUES (?, ?, ?, ?, 0, 0, 0)`,
            [employeeId, t.id, year, t.days_per_year]
        );
    }

    const balances = await query(
        `SELECT lb.*, lt.name, lt.code, lt.color, lt.is_paid, lt.days_per_year,
                (lb.entitled_days + lb.carried_days - lb.used_days - lb.pending_days) AS remaining_days
         FROM leave_balances lb
         JOIN leave_types lt ON lt.id = lb.leave_type_id
         WHERE lb.employee_id = ? AND lb.year = ?
         ORDER BY lt.name`,
        [employeeId, year]
    );
    res.json(balances);
});

export const updateBalance = asyncHandler(async (req, res) => {
    if (!ADMIN.includes(req.user.role)) throw httpError(403, 'Admin only');
    const { id } = req.params;
    const { entitled_days, carried_days } = req.body;
    const n = v => (v !== undefined && v !== null && v !== '') ? v : null;
    await run(
        `UPDATE leave_balances SET
         entitled_days = COALESCE(?, entitled_days),
         carried_days  = COALESCE(?, carried_days)
         WHERE id = ?`,
        [n(entitled_days), n(carried_days), id]
    );
    res.json({ message: 'Balance updated' });
});

// ── Leave Requests — list ────────────────────────────────────────
export const getRequests = asyncHandler(async (req, res) => {
    const { status, employeeId, year, month } = req.query;
    const role = req.user.role;
    const params = [];
    let where = 'WHERE 1=1';

    // Non-management roles can only see their own requests.
    // req.user doesn't carry employee_id (auth middleware only loads basic user cols),
    // so we resolve it from the employees table.
    if (!MGMT.includes(role)) {
        const emp = await get('SELECT id FROM employees WHERE user_id = ?', [req.user.id]);
        where += ' AND lr.employee_id = ?';
        params.push(emp?.id || 0);
    } else if (employeeId) {
        where += ' AND lr.employee_id = ?';
        params.push(employeeId);
    }

    if (status)     { where += ' AND lr.status = ?';             params.push(status); }
    if (year)       { where += ' AND YEAR(lr.start_date) = ?';   params.push(year); }
    if (month)      { where += ' AND MONTH(lr.start_date) = ?';  params.push(month); }

    const rows = await query(
        `SELECT lr.*,
                e.first_name, e.last_name, e.employee_code,
                lt.name AS leave_type_name, lt.code AS leave_type_code, lt.color, lt.is_paid,
                CONCAT(u.first_name,' ',u.last_name) AS reviewed_by_name
         FROM leave_requests lr
         JOIN employees e  ON e.id  = lr.employee_id
         JOIN leave_types lt ON lt.id = lr.leave_type_id
         LEFT JOIN users u ON u.id = lr.reviewed_by
         ${where}
         ORDER BY lr.applied_at DESC
         LIMIT 200`,
        params
    );
    res.json(rows);
});

export const getRequestById = asyncHandler(async (req, res) => {
    const row = await get(
        `SELECT lr.*,
                e.first_name, e.last_name, e.employee_code, e.department, e.position,
                lt.name AS leave_type_name, lt.code AS leave_type_code, lt.color, lt.is_paid,
                CONCAT(u.first_name,' ',u.last_name) AS reviewed_by_name
         FROM leave_requests lr
         JOIN employees e  ON e.id  = lr.employee_id
         JOIN leave_types lt ON lt.id = lr.leave_type_id
         LEFT JOIN users u ON u.id = lr.reviewed_by
         WHERE lr.id = ?`,
        [req.params.id]
    );
    if (!row) throw httpError(404, 'Leave request not found');
    res.json(row);
});

// ── Create request ───────────────────────────────────────────────
export const createRequest = asyncHandler(async (req, res) => {
    const { leave_type_id, start_date, end_date, reason } = req.body;
    let { employee_id } = req.body;

    // If employee_id not supplied (non-management submitting their own),
    // look it up from the employees table using the logged-in user_id.
    if (!employee_id) {
        const emp = await get('SELECT id FROM employees WHERE user_id = ?', [req.user.id]);
        if (!emp) throw httpError(400, 'No employee record linked to your account');
        employee_id = emp.id;
    }

    if (!leave_type_id || !start_date || !end_date) {
        throw httpError(400, 'leave_type_id, start_date, end_date are required');
    }
    if (new Date(start_date) > new Date(end_date)) {
        throw httpError(400, 'start_date must be before end_date');
    }

    const total_days = calendarDays(start_date, end_date);
    if (total_days <= 0) throw httpError(400, 'No days in selected range');

    // Check for overlapping approved/pending requests
    const overlap = await get(
        `SELECT id FROM leave_requests
         WHERE employee_id = ? AND status IN ('approved','pending')
           AND NOT (end_date < ? OR start_date > ?)`,
        [employee_id, start_date, end_date]
    );
    if (overlap) throw httpError(409, 'Overlapping leave request already exists');

    const request_number = await nextRequestNumber();
    const result = await run(
        `INSERT INTO leave_requests
         (request_number, employee_id, leave_type_id, start_date, end_date, total_days, reason, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')`,
        [request_number, employee_id, leave_type_id, start_date, end_date, total_days, reason || null]
    );

    // Ensure balance row exists before locking pending days
    const year = new Date(start_date).getFullYear();
    const lt = await get('SELECT days_per_year FROM leave_types WHERE id = ?', [leave_type_id]);
    await run(
        `INSERT IGNORE INTO leave_balances
         (employee_id, leave_type_id, year, entitled_days, used_days, pending_days, carried_days)
         VALUES (?, ?, ?, ?, 0, 0, 0)`,
        [employee_id, leave_type_id, year, lt?.days_per_year || 0]
    );

    // Lock pending days in balance
    await run(
        `UPDATE leave_balances
         SET pending_days = pending_days + ?
         WHERE employee_id = ? AND leave_type_id = ? AND year = ?`,
        [total_days, employee_id, leave_type_id, year]
    );

    res.status(201).json({ id: result.id, request_number, total_days });
});

// ── Review (approve / reject) ────────────────────────────────────
export const reviewRequest = asyncHandler(async (req, res) => {
    if (!MGMT.includes(req.user.role)) throw httpError(403, 'Management only');
    const { id } = req.params;
    const { status, review_notes } = req.body;
    if (!['approved', 'rejected'].includes(status)) throw httpError(400, 'status must be approved or rejected');

    const lr = await get(`SELECT * FROM leave_requests WHERE id = ?`, [id]);
    if (!lr) throw httpError(404, 'Leave request not found');
    if (lr.status !== 'pending') throw httpError(409, `Request is already ${lr.status}`);

    await run(
        `UPDATE leave_requests SET status = ?, reviewed_by = ?, reviewed_at = NOW(), review_notes = ?
         WHERE id = ?`,
        [status, req.user.id, review_notes || null, id]
    );

    const year = new Date(lr.start_date).getFullYear();
    if (status === 'approved') {
        // Move from pending → used
        await run(
            `UPDATE leave_balances
             SET used_days = used_days + ?, pending_days = GREATEST(pending_days - ?, 0)
             WHERE employee_id = ? AND leave_type_id = ? AND year = ?`,
            [lr.total_days, lr.total_days, lr.employee_id, lr.leave_type_id, year]
        );
        // Sync employee status → on_leave
        await run(
            `UPDATE employees SET status = 'on_leave' WHERE id = ?`,
            [lr.employee_id]
        );
    } else {
        // Release pending days back
        await run(
            `UPDATE leave_balances
             SET pending_days = GREATEST(pending_days - ?, 0)
             WHERE employee_id = ? AND leave_type_id = ? AND year = ?`,
            [lr.total_days, lr.employee_id, lr.leave_type_id, year]
        );
    }

    res.json({ message: `Leave request ${status}` });
});

// ── Cancel own request ───────────────────────────────────────────
export const cancelRequest = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const lr = await get(`SELECT * FROM leave_requests WHERE id = ?`, [id]);
    if (!lr) throw httpError(404, 'Not found');

    // Resolve the caller's employee_id from DB (req.user doesn't carry it)
    const emp = await get('SELECT id FROM employees WHERE user_id = ?', [req.user.id]);
    const callerEmpId = emp?.id;

    // Only own request OR management can cancel
    if (!MGMT.includes(req.user.role) && lr.employee_id !== callerEmpId) {
        throw httpError(403, 'Cannot cancel someone else\'s request');
    }
    if (!['pending', 'approved'].includes(lr.status)) {
        throw httpError(409, `Cannot cancel a ${lr.status} request`);
    }

    await run(`UPDATE leave_requests SET status = 'cancelled' WHERE id = ?`, [id]);

    const year = new Date(lr.start_date).getFullYear();
    if (lr.status === 'pending') {
        await run(
            `UPDATE leave_balances SET pending_days = GREATEST(pending_days - ?, 0)
             WHERE employee_id = ? AND leave_type_id = ? AND year = ?`,
            [lr.total_days, lr.employee_id, lr.leave_type_id, year]
        );
    } else if (lr.status === 'approved') {
        await run(
            `UPDATE leave_balances SET used_days = GREATEST(used_days - ?, 0)
             WHERE employee_id = ? AND leave_type_id = ? AND year = ?`,
            [lr.total_days, lr.employee_id, lr.leave_type_id, year]
        );
        // Check if any other active leaves exist, if not restore to active
        const otherActive = await get(
            `SELECT id FROM leave_requests
             WHERE employee_id = ? AND status = 'approved'
               AND end_date >= CURDATE() AND id != ?`,
            [lr.employee_id, id]
        );
        if (!otherActive) {
            await run(`UPDATE employees SET status = 'active' WHERE id = ?`, [lr.employee_id]);
        }
    }

    res.json({ message: 'Leave request cancelled' });
});

// ── Dashboard summary ─────────────────────────────────────────────
export const getLeaveSummary = asyncHandler(async (req, res) => {
    const year = new Date().getFullYear();
    const [pending, approvedToday, onLeaveNow, totalThisYear] = await Promise.all([
        get(`SELECT COUNT(*) AS c FROM leave_requests WHERE status = 'pending'`),
        get(`SELECT COUNT(*) AS c FROM leave_requests WHERE status = 'approved' AND reviewed_at >= CURDATE()`),
        get(`SELECT COUNT(*) AS c FROM leave_requests WHERE status = 'approved' AND start_date <= CURDATE() AND end_date >= CURDATE()`),
        get(`SELECT COUNT(*) AS c FROM leave_requests WHERE YEAR(start_date) = ?`, [year]),
    ]);

    const byType = await query(
        `SELECT lt.name, lt.color, COUNT(*) AS count, SUM(lr.total_days) AS total_days
         FROM leave_requests lr
         JOIN leave_types lt ON lt.id = lr.leave_type_id
         WHERE YEAR(lr.start_date) = ? AND lr.status = 'approved'
         GROUP BY lt.id ORDER BY total_days DESC`,
        [year]
    );

    const upcoming = await query(
        `SELECT lr.*, e.first_name, e.last_name, lt.name AS leave_type_name, lt.color
         FROM leave_requests lr
         JOIN employees e ON e.id = lr.employee_id
         JOIN leave_types lt ON lt.id = lr.leave_type_id
         WHERE lr.status = 'approved' AND lr.start_date >= CURDATE()
         ORDER BY lr.start_date ASC LIMIT 10`
    );

    res.json({
        pending_count:  pending?.c || 0,
        approved_today: approvedToday?.c || 0,
        on_leave_now:   onLeaveNow?.c || 0,
        total_this_year: totalThisYear?.c || 0,
        by_type: byType,
        upcoming,
    });
});
