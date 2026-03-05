import bcrypt from 'bcryptjs';
import { query, get, run } from '../database/db.js';

// Get all users
export async function getAllUsers(req, res) {
    try {
        const { role, search, status, page = 1, limit = 50 } = req.query;
        
        let sql = `
            SELECT u.id, u.email, u.first_name, u.last_name, u.role, 
                   u.department, u.phone, u.is_active, u.last_login, u.created_at,
                   e.employee_code
            FROM users u
            LEFT JOIN employees e ON e.user_id = u.id
            WHERE 1=1
        `;
        const params = [];

        if (role) {
            sql += ' AND u.role = ?';
            params.push(role);
        }

        if (status !== undefined) {
            sql += ' AND u.is_active = ?';
            params.push(status);
        }

        if (search) {
            sql += ` AND (u.first_name LIKE ? OR u.last_name LIKE ? OR u.email LIKE ?)`;
            const searchTerm = `%${search}%`;
            params.push(searchTerm, searchTerm, searchTerm);
        }

        sql += ' ORDER BY u.created_at DESC';
        
        // Add pagination
        const offset = (parseInt(page) - 1) * parseInt(limit);
        sql += ` LIMIT ${parseInt(limit)} OFFSET ${offset}`;

        const users = await query(sql, params);
        
        // Get total count
        let countSql = 'SELECT COUNT(*) as total FROM users WHERE 1=1';
        const countParams = [];
        if (role) {
            countSql += ' AND role = ?';
            countParams.push(role);
        }
        if (search) {
            countSql += ` AND (first_name LIKE ? OR last_name LIKE ? OR email LIKE ?)`;
            countParams.push(`%${search}%`, `%${search}%`, `%${search}%`);
        }
        const countResult = await get(countSql, countParams);

        res.json({
            data: users,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: countResult.total,
                totalPages: Math.ceil(countResult.total / parseInt(limit))
            }
        });
    } catch (error) {
        console.error('Get users error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}

// Get user by ID
export async function getUserById(req, res) {
    try {
        const { id } = req.params;
        const user = await get(
            `SELECT u.*, e.employee_code, e.position, e.hire_date, e.salary
             FROM users u
             LEFT JOIN employees e ON e.user_id = u.id
             WHERE u.id = ?`,
            [id]
        );

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        delete user.password;
        res.json(user);
    } catch (error) {
        console.error('Get user error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}

// Create user
export async function createUser(req, res) {
    try {
        const { email, password, firstName, lastName, role, department, phone } = req.body;

        // Check if email exists
        const existingUser = await get('SELECT id FROM users WHERE email = ?', [email.toLowerCase()]);
        if (existingUser) {
            return res.status(400).json({ error: 'Email already exists' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const result = await run(
            `INSERT INTO users (email, password, first_name, last_name, role, department, phone)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [email.toLowerCase(), hashedPassword, firstName, lastName, role, department, phone]
        );

        // Log activity
        await run(
            'INSERT INTO activity_logs (user_id, action, entity_type, entity_id, new_values) VALUES (?, ?, ?, ?, ?)',
            [req.user.id, 'CREATE_USER', 'user', result.id, JSON.stringify({ email, firstName, lastName, role })]
        );

        res.status(201).json({
            id: result.id,
            message: 'User created successfully'
        });
    } catch (error) {
        console.error('Create user error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}

// Update user
export async function updateUser(req, res) {
    try {
        const { id } = req.params;
        const { firstName, lastName, role, department, phone, isActive } = req.body;

        const user = await get('SELECT * FROM users WHERE id = ?', [id]);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        await run(
            `UPDATE users SET
                first_name = COALESCE(?, first_name),
                last_name = COALESCE(?, last_name),
                role = COALESCE(?, role),
                department = COALESCE(?, department),
                phone = COALESCE(?, phone),
                is_active = COALESCE(?, is_active),
                updated_at = CURRENT_TIMESTAMP
             WHERE id = ?`,
            [firstName, lastName, role, department, phone, isActive, id]
        );

        // Log activity
        await run(
            'INSERT INTO activity_logs (user_id, action, entity_type, entity_id, old_values, new_values) VALUES (?, ?, ?, ?, ?, ?)',
            [req.user.id, 'UPDATE_USER', 'user', id, JSON.stringify(user), JSON.stringify({ firstName, lastName, role, isActive })]
        );

        res.json({ message: 'User updated successfully' });
    } catch (error) {
        console.error('Update user error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}

// Delete user
export async function deleteUser(req, res) {
    try {
        const { id } = req.params;

        const user = await get('SELECT * FROM users WHERE id = ?', [id]);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        await run('DELETE FROM users WHERE id = ?', [id]);

        // Log activity
        await run(
            'INSERT INTO activity_logs (user_id, action, entity_type, entity_id, old_values) VALUES (?, ?, ?, ?, ?)',
            [req.user.id, 'DELETE_USER', 'user', id, JSON.stringify(user)]
        );

        res.json({ message: 'User deleted successfully' });
    } catch (error) {
        console.error('Delete user error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}

// Reset user password
export async function resetPassword(req, res) {
    try {
        const { id } = req.params;
        const { newPassword } = req.body;

        const hashedPassword = await bcrypt.hash(newPassword, 10);

        await run(
            'UPDATE users SET password = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [hashedPassword, id]
        );

        // Log activity
        await run(
            'INSERT INTO activity_logs (user_id, action, entity_type, entity_id) VALUES (?, ?, ?, ?)',
            [req.user.id, 'RESET_PASSWORD', 'user', id]
        );

        res.json({ message: 'Password reset successfully' });
    } catch (error) {
        console.error('Reset password error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}
