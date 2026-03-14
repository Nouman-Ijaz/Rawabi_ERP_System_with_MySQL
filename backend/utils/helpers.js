// ─────────────────────────────────────────────────────────────────
// backend/utils/helpers.js
// Shared backend utilities. Import from here — never define these
// inline in a controller again.
// ─────────────────────────────────────────────────────────────────
import { run, get } from '../database/db.js';

// ── Null-safe binding ──────────────────────────────────────────────
/**
 * Coerce undefined / '' / null → SQL NULL.
 * Use on every bind parameter in INSERT/UPDATE statements.
 *
 *   await run('INSERT INTO t (col) VALUES (?)', [n(req.body.col)]);
 */
export const n = (v) =>
    (v !== undefined && v !== '' && v !== null) ? v : null;

// ── Code generators ────────────────────────────────────────────────
/**
 * Generate a short unique code with a given prefix.
 * generateCode('EMP') → 'EMP-X9K2TZ'
 * generateCode('INV') → 'INV-Y3M1QP'
 *
 * Uses the last 6 chars of base-36 Date.now() — collision risk is
 * acceptable for internal ERP IDs (not crypto-grade).
 */
export const generateCode = (prefix) =>
    `${prefix}-${Date.now().toString(36).toUpperCase().slice(-6)}`;

// ── Activity log ───────────────────────────────────────────────────
/**
 * Write one row to activity_logs.
 * Fire-and-forget — errors are swallowed so they never break the
 * main request.  Pass null for oldValues / newValues when unused.
 *
 * @param {number}  userId
 * @param {string}  action      e.g. 'CREATE', 'UPDATE', 'DELETE'
 * @param {string}  entityType  e.g. 'shipment', 'employee'
 * @param {number}  entityId
 * @param {any}     [newValues] object or null
 * @param {any}     [oldValues] object or null
 */
export async function logActivity(userId, action, entityType, entityId, newValues = null, oldValues = null) {
    try {
        if (oldValues !== null) {
            await run(
                'INSERT INTO activity_logs (user_id, action, entity_type, entity_id, old_values, new_values) VALUES (?,?,?,?,?,?)',
                [userId, action, entityType, entityId,
                 oldValues  ? JSON.stringify(oldValues)  : null,
                 newValues  ? JSON.stringify(newValues)  : null]
            );
        } else {
            await run(
                'INSERT INTO activity_logs (user_id, action, entity_type, entity_id, new_values) VALUES (?,?,?,?,?)',
                [userId, action, entityType, entityId,
                 newValues ? JSON.stringify(newValues) : null]
            );
        }
    } catch (e) {
        // Non-fatal — log to console but don't surface to client
        console.warn('[logActivity] failed:', e.message);
    }
}

// ── Pagination ─────────────────────────────────────────────────────
/**
 * Parse page/limit from query params and return SQL LIMIT+OFFSET
 * plus a helper to build the standard paginated response envelope.
 *
 * Usage:
 *   const { limit, offset, respond } = paginate(req.query);
 *   sql += ` LIMIT ${limit} OFFSET ${offset}`;
 *   const rows  = await query(sql, params);
 *   const total = (await get(countSql, params)).total;
 *   res.json(respond(rows, total));
 *
 * @param {{ page?: string|number, limit?: string|number }} q
 * @param {number} [defaultLimit=50]
 * @returns {{ page: number, limit: number, offset: number, respond: Function }}
 */
export function paginate(q, defaultLimit = 50) {
    const page  = Math.max(1, parseInt(q.page  || 1));
    const limit = Math.min(200, Math.max(1, parseInt(q.limit || defaultLimit)));
    const offset = (page - 1) * limit;

    const respond = (data, total) => ({
        data,
        pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
        },
    });

    return { page, limit, offset, respond };
}

// ── Token invalidation ─────────────────────────────────────────────
/**
 * Write a token blacklist entry.
 *
 * For individual token invalidation (logout, password_changed, role_changed):
 *   await invalidateToken(jti, userId, expiresAt, 'logout');
 *
 * For account deactivation (invalidates ALL tokens for a user):
 *   await invalidateUserTokens(userId);
 *
 * @param {string} jti        - JWT ID from the token payload
 * @param {number} userId
 * @param {Date|number} expiresAt  - token exp (unix timestamp or Date)
 * @param {string} reason     - 'logout'|'deactivated'|'password_changed'|'role_changed'
 */
export async function invalidateToken(jti, userId, expiresAt, reason) {
    try {
        // Convert unix timestamp to Date if needed
        const exp = expiresAt instanceof Date
            ? expiresAt
            : new Date(expiresAt * 1000);

        await run(
            `INSERT IGNORE INTO token_blacklist (jti, user_id, expires_at, reason)
             VALUES (?, ?, ?, ?)`,
            [jti, userId, exp, reason]
        );
    } catch (e) {
        // Non-fatal — log but don't surface to client
        console.warn('[invalidateToken] failed:', e.message);
    }
}

/**
 * Invalidate ALL active tokens for a user.
 * Used when deactivating an account — we have no session store so we
 * write a sentinel row. The authenticate middleware checks for any
 * 'deactivated:<userId>:%' entry with invalidated_at after the token's iat.
 *
 * @param {number} userId
 */
export async function invalidateUserTokens(userId) {
    try {
        const sentinel = `deactivated:${userId}:${Date.now()}`;
        // expires_at = 24h from now (matches max token lifetime)
        const exp = new Date(Date.now() + 24 * 60 * 60 * 1000);
        await run(
            `INSERT IGNORE INTO token_blacklist (jti, user_id, expires_at, reason)
             VALUES (?, ?, ?, 'deactivated')`,
            [sentinel, userId, exp]
        );
    } catch (e) {
        console.warn('[invalidateUserTokens] failed:', e.message);
    }
}