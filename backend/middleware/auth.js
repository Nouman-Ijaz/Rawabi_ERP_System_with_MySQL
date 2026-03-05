import jwt from 'jsonwebtoken';
import { get } from '../database/db.js';

const JWT_SECRET = process.env.JWT_SECRET || 'rawabi-logistics-erp-secret-key-2024-CHANGE-IN-PRODUCTION';

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
// ============================================
export function generateToken(user) {
    return jwt.sign(
        {
            id:        user.id,
            email:     user.email,
            role:      user.role,
            firstName: user.first_name,
            lastName:  user.last_name,
        },
        JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
    );
}

// ============================================
// AUTHENTICATE TOKEN
// ============================================
export async function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token      = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Access token required' });
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);

        const user = await get(
            'SELECT id, email, role, first_name, last_name, is_active FROM users WHERE id = ?',
            [decoded.id]
        );

        if (!user)            return res.status(401).json({ error: 'User not found' });
        if (!user.is_active)  return res.status(401).json({ error: 'Account is deactivated' });

        req.user = user;
        next();
    } catch {
        return res.status(403).json({ error: 'Invalid or expired token' });
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
        return next(); // non-driver roles skip this
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
