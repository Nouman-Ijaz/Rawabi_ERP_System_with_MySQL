// ============================================================
// backend/controllers/auditController.js
// Audit Log — read-only view of activity_logs table
// Accessible only to super_admin and admin
// ============================================================
import { query, get } from '../database/db.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { paginate } from '../utils/helpers.js';

// ── GET /audit-logs ──────────────────────────────────────────
// Filters: userId, action, entityType, dateFrom, dateTo, search
export const getAuditLogs = asyncHandler(async (req, res) => {
    const { userId, action, entityType, dateFrom, dateTo, search } = req.query;
    const { limit, offset, respond } = paginate(req.query, 50);

    let sql = `
        SELECT
            al.id,
            al.action,
            al.entity_type,
            al.entity_id,
            al.old_values,
            al.new_values,
            al.ip_address,
            al.created_at,
            u.id          AS user_id,
            u.first_name,
            u.last_name,
            u.email,
            u.role
        FROM activity_logs al
        LEFT JOIN users u ON u.id = al.user_id
        WHERE 1=1
    `;
    const params = [];

    if (userId) {
        sql += ' AND al.user_id = ?';
        params.push(parseInt(userId));
    }
    if (action) {
        sql += ' AND al.action = ?';
        params.push(action);
    }
    if (entityType) {
        sql += ' AND al.entity_type = ?';
        params.push(entityType);
    }
    if (dateFrom) {
        sql += ' AND al.created_at >= ?';
        params.push(dateFrom + ' 00:00:00');
    }
    if (dateTo) {
        sql += ' AND al.created_at <= ?';
        params.push(dateTo + ' 23:59:59');
    }
    if (search) {
        sql += ` AND (
            u.first_name LIKE ? OR
            u.last_name  LIKE ? OR
            u.email      LIKE ? OR
            al.action    LIKE ? OR
            al.entity_type LIKE ?
        )`;
        const s = `%${search}%`;
        params.push(s, s, s, s, s);
    }

    // Count query (same WHERE, no LIMIT)
    const countSql = `SELECT COUNT(*) AS total FROM activity_logs al LEFT JOIN users u ON u.id = al.user_id WHERE 1=1${
        sql.split('WHERE 1=1')[1]
    }`;

    sql += ` ORDER BY al.created_at DESC LIMIT ${limit} OFFSET ${offset}`;

    const [rows, countRow] = await Promise.all([
        query(sql, params),
        get(countSql, params),
    ]);

    res.json(respond(rows, countRow.total));
});

// ── GET /audit-logs/filters ──────────────────────────────────
// Returns distinct action types and entity types for filter dropdowns
export const getAuditFilters = asyncHandler(async (req, res) => {
    const [actions, entities, users] = await Promise.all([
        query(`SELECT DISTINCT action FROM activity_logs ORDER BY action`),
        query(`SELECT DISTINCT entity_type FROM activity_logs WHERE entity_type IS NOT NULL ORDER BY entity_type`),
        query(`
            SELECT DISTINCT u.id, u.first_name, u.last_name, u.role
            FROM activity_logs al
            JOIN users u ON u.id = al.user_id
            ORDER BY u.first_name
        `),
    ]);

    res.json({
        actions:    actions.map(r => r.action),
        entities:   entities.map(r => r.entity_type),
        users:      users,
    });
});
