// ─────────────────────────────────────────────────────────────────
// backend/middleware/auth.js
// ─────────────────────────────────────────────────────────────────
import jwt            from 'jsonwebtoken';
import { randomUUID } from 'crypto';
import { get }        from '../database/db.js';

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
    console.error('FATAL: JWT_SECRET environment variable is not set. Server cannot start.');
    process.exit(1);
}

// ============================================
// ROLE HIERARCHY
// Higher index = more privilege
// ============================================
export const ROLES = {
    driver:       0,
    dispatcher:   1,
    office_admin: 2,
    accountant:   2,
    admin:        3,
    super_admin:  4,
};

// ============================================
// GENERATE JWT
// Every token gets a unique jti (JWT ID) so it
// can be individually blacklisted.
// ============================================
export function generateToken(user) {
    return jwt.sign(
        {
            id:        user.id,
            email:     user.email,
            role:      user.role,
            firstName: user.first_name,
            lastName:  user.last_name,
            jti:       randomUUID(),
        },
        JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
    );
}

// ============================================
// AUTHENTICATE TOKEN
// Checks: signature → blacklist → active status
// ============================================
export async function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token      = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Access token required' });
    }

    let decoded;
    try {
        decoded = jwt.verify(token, JWT_SECRET);
    } catch {
        return res.status(403).json({ error: 'Invalid or expired token' });
    }

    try {
        // ── Blacklist check ────────────────────────────────────────
        // Check direct jti blacklist (logout, password change, role change)
        if (decoded.jti) {
            const blacklisted = await get(
                'SELECT id FROM token_blacklist WHERE jti = ?',
                [decoded.jti]
            );
            if (blacklisted) {
                return res.status(401).json({ error: 'Session invalidated. Please log in again.' });
            }
        }

        // ── Deactivation sweep check ───────────────────────────────
        // When a user is deactivated we write a sentinel row with
        // jti = 'deactivated:<userId>:<timestamp>'. If any such row
        // exists with invalidated_at AFTER the token's iat, the
        // token predates the deactivation and must be rejected.
        if (decoded.iat) {
            const deactivated = await get(
                `SELECT id FROM token_blacklist
                 WHERE jti LIKE ?
                   AND reason = 'deactivated'
                   AND invalidated_at > FROM_UNIXTIME(?)
                 LIMIT 1`,
                [`deactivated:${decoded.id}:%`, decoded.iat]
            );
            if (deactivated) {
                return res.status(401).json({ error: 'Account deactivated. Contact your administrator.' });
            }
        }

        // ── Active status check ────────────────────────────────────
        const user = await get(
            'SELECT id, email, role, first_name, last_name, is_active FROM users WHERE id = ?',
            [decoded.id]
        );

        if (!user) {
            return res.status(401).json({ error: 'User not found' });
        }
        if (!user.is_active) {
            return res.status(401).json({ error: 'Account deactivated. Contact your administrator.' });
        }

        req.user    = user;
        req.tokenJti = decoded.jti || null;
        req.tokenIat = decoded.iat || null;
        req.tokenExp = decoded.exp || null;
        next();
    } catch (err) {
        console.error('[authenticateToken] DB error:', err.message);
        return res.status(500).json({ error: 'Internal server error' });
    }
}

// ============================================
// ROLE-BASED AUTHORISATION
// Pass an array of allowed roles.
// ============================================
export function authorize(roles = []) {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ error: 'Authentication required' });
        }
        if (roles.length && !roles.includes(req.user.role)) {
            return res.status(403).json({ error: 'Insufficient permissions' });
        }
        next();
    };
}

// ============================================
// DRIVER SELF-ACCESS GUARD
// Resolves the driver_id for the logged-in
// driver user and attaches it to req.driverId.
// Call after authenticateToken.
// ============================================
export async function resolveDriverId(req, res, next) {
    if (req.user.role !== 'driver') {
        return next();
    }

    try {
        const employee = await get(
            'SELECT id FROM employees WHERE user_id = ?',
            [req.user.id]
        );
        if (!employee) {
            return res.status(404).json({ error: 'Driver employee record not found' });
        }

        const driver = await get(
            'SELECT id FROM drivers WHERE employee_id = ?',
            [employee.id]
        );
        if (!driver) {
            return res.status(404).json({ error: 'Driver record not found' });
        }

        req.driverId = driver.id;
        next();
    } catch (error) {
        console.error('resolveDriverId error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}

export { JWT_SECRET };
