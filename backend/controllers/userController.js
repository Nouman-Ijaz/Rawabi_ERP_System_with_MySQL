import { asyncHandler, httpError } from '../middleware/asyncHandler.js';
import bcrypt from 'bcryptjs';
import { query, get, run } from '../database/db.js';
import { n, logActivity, invalidateToken, invalidateUserTokens } from '../utils/helpers.js';

// ── GET ALL ────────────────────────────────────────────────────────────
export const getAllUsers = asyncHandler(async (req, res) => {
        const { role, search, status, page = 1, limit = 50 } = req.query;

        let sql = `
            SELECT u.id, u.email, u.first_name, u.last_name, u.role,
                   u.department, u.phone, u.is_active, u.last_login,
                   u.created_at, u.updated_at, e.employee_code
            FROM users u
            LEFT JOIN employees e ON e.user_id = u.id
            WHERE 1=1
        `;
        const params = [];

        if (role)   { sql += ' AND u.role = ?';      params.push(role); }
        if (status !== undefined && status !== '') {
            sql += ' AND u.is_active = ?';
            params.push(parseInt(status));
        }
        if (search) {
            sql += ` AND (u.first_name LIKE ? OR u.last_name LIKE ? OR u.email LIKE ?)`;
            const s = `%${search}%`;
            params.push(s, s, s);
        }

        sql += ' ORDER BY u.created_at DESC';
        const offset = (parseInt(page) - 1) * parseInt(limit);
        sql += ` LIMIT ${parseInt(limit)} OFFSET ${offset}`;

        const users = await query(sql, params);

        let cSql = 'SELECT COUNT(*) as total FROM users WHERE 1=1';
        const cp = [];
        if (role)   { cSql += ' AND role = ?';     cp.push(role); }
        if (search) {
            cSql += ` AND (first_name LIKE ? OR last_name LIKE ? OR email LIKE ?)`;
            cp.push(`%${search}%`, `%${search}%`, `%${search}%`);
        }
        const countResult = await get(cSql, cp);

        res.json({
            data: users,
            pagination: {
                page: parseInt(page), limit: parseInt(limit),
                total: countResult.total,
                totalPages: Math.ceil(countResult.total / parseInt(limit))
            }
        });
});

// ── STATS — role counts unaffected by filters ──────────────────────────
export const getUserStats = asyncHandler(async (req, res) => {
        const roleCounts = await query(
            `SELECT role, COUNT(*) AS total, SUM(is_active) AS active_count
             FROM users GROUP BY role ORDER BY total DESC`
        );
        const total  = await get('SELECT COUNT(*) AS c FROM users');
        const active = await get('SELECT COUNT(*) AS c FROM users WHERE is_active = 1');
        res.json({ roleCounts, total: total.c, active_count: active.c });
});

// ── GET BY ID ──────────────────────────────────────────────────────────
export const getUserById = asyncHandler(async (req, res) => {
        const { id } = req.params;
        const user = await get(
            `SELECT u.*, e.employee_code, e.position, e.hire_date, e.salary, e.department AS emp_department
             FROM users u LEFT JOIN employees e ON e.user_id = u.id WHERE u.id = ?`, [id]
        );
        if (!user) return res.status(404).json({ error: 'User not found' });
        delete user.password;
        res.json(user);
});

// ── CREATE ─────────────────────────────────────────────────────────────
export const createUser = asyncHandler(async (req, res) => {
        const { email, password, firstName, lastName, role, department, phone } = req.body;

        if (!email || !password || !firstName || !lastName || !role) {
            return res.status(400).json({ error: 'Email, password, name and role are required' });
        }
        if (password.length < 6) {
            return res.status(400).json({ error: 'Password must be at least 6 characters' });
        }

        const existing = await get('SELECT id FROM users WHERE email = ?', [email.toLowerCase()]);
        if (existing) return res.status(400).json({ error: 'Email already exists' });

        const hashedPassword = await bcrypt.hash(password, 12);

        const result = await run(
            `INSERT INTO users (email, password, first_name, last_name, role, department, phone)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [email.toLowerCase(), hashedPassword, firstName, lastName, role, n(department), n(phone)]
        );

        await logActivity(req.user.id, 'CREATE_USER', 'user', result.id, { email, firstName, lastName, role });
        res.status(201).json({ id: result.id, message: 'User created successfully' });
});

// ── UPDATE ─────────────────────────────────────────────────────────────
export const updateUser = asyncHandler(async (req, res) => {
        const { id } = req.params;
        const { firstName, lastName, role, department, phone, isActive } = req.body;

        const user = await get('SELECT * FROM users WHERE id = ?', [id]);
        if (!user) return res.status(404).json({ error: 'User not found' });

        // isActive must be explicitly checked — undefined must not reach MySQL2
        const activeValue = isActive !== undefined ? (isActive ? 1 : 0) : null;

        await run(
            `UPDATE users SET
                first_name  = COALESCE(?, first_name),
                last_name   = COALESCE(?, last_name),
                role        = COALESCE(?, role),
                department  = COALESCE(?, department),
                phone       = COALESCE(?, phone),
                is_active   = COALESCE(?, is_active)
             WHERE id = ?`,
            [n(firstName), n(lastName), n(role), n(department), n(phone), activeValue, id]
        );

        // ── Token invalidation triggers ────────────────────────────
        // Deactivation: wipe all tokens for this user immediately.
        // Role change: role is baked into the JWT, so old token has wrong role.
        const isDeactivating = isActive !== undefined && !isActive && user.is_active;
        const isRoleChange   = role && role !== user.role;

        if (isDeactivating) {
            await invalidateUserTokens(parseInt(id));
        } else if (isRoleChange) {
            // Role is baked into the JWT payload — invalidate all sessions
            // for this user so they must re-login with the updated role.
            await invalidateUserTokens(parseInt(id));
        }

        await logActivity(req.user.id, 'UPDATE_USER', 'user', id, { firstName, lastName, role, isActive }, user);
        res.json({ message: 'User updated successfully' });
});

// ── DELETE ─────────────────────────────────────────────────────────────
export const deleteUser = asyncHandler(async (req, res) => {
        const { id } = req.params;
        const user = await get('SELECT * FROM users WHERE id = ?', [id]);
        if (!user) return res.status(404).json({ error: 'User not found' });

        await run('DELETE FROM users WHERE id = ?', [id]);
        await logActivity(req.user.id, 'DELETE_USER', 'user', id, null, user);
        res.json({ message: 'User deleted successfully' });
});

// ── RESET PASSWORD ─────────────────────────────────────────────────────
export const resetPassword = asyncHandler(async (req, res) => {
        const { id } = req.params;
        const { newPassword } = req.body;

        if (!newPassword || newPassword.length < 6) {
            return res.status(400).json({ error: 'Password must be at least 6 characters' });
        }

        const user = await get('SELECT id FROM users WHERE id = ?', [id]);
        if (!user) return res.status(404).json({ error: 'User not found' });

        const hashedPassword = await bcrypt.hash(newPassword, 12);

        await run('UPDATE users SET password = ? WHERE id = ?', [hashedPassword, id]);
        await logActivity(req.user.id, 'RESET_PASSWORD', 'user', id);
        res.json({ message: 'Password reset successfully' });
});

// ── CHANGE OWN PASSWORD (any authenticated user) ───────────────────────
export const changeOwnPassword = asyncHandler(async (req, res) => {
        const { currentPassword, newPassword } = req.body;
        const userId = req.user.id;

        if (!currentPassword || !newPassword) {
            return res.status(400).json({ error: 'Current password and new password are required' });
        }
        if (newPassword.length < 6) {
            return res.status(400).json({ error: 'New password must be at least 6 characters' });
        }

        const user = await get('SELECT * FROM users WHERE id = ?', [userId]);
        if (!user) return res.status(404).json({ error: 'User not found' });

        let isValid = false;
        if (user.password.startsWith('$2a$') || user.password.startsWith('$2b$')) {
            isValid = await bcrypt.compare(currentPassword, user.password);
        } else {
            isValid = currentPassword === user.password;
        }
        if (!isValid) {
            return res.status(400).json({ error: 'Current password is incorrect' });
        }

        const hashed = await bcrypt.hash(newPassword, 12);
        await run('UPDATE users SET password = ? WHERE id = ?', [hashed, userId]);
        await logActivity(userId, 'CHANGE_OWN_PASSWORD', 'user', userId);

        // Blacklist the current token — must re-login with new credentials
        if (req.tokenJti && req.tokenExp) {
            await invalidateToken(req.tokenJti, req.user.id, req.tokenExp, 'password_changed');
        }

        res.json({ message: 'Password changed successfully. Please log in again.' });
});
