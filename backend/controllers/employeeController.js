import { query, get, run, beginTransaction, commit, rollback } from '../database/db.js';
import { getPublicUrl } from '../config/multer.js';
import path from 'path';

// Generate employee code
function generateEmployeeCode() {
    return 'EMP-' + Date.now().toString(36).toUpperCase().slice(-6);
}

// Get all employees with optional filters
export async function getAllEmployees(req, res) {
    try {
        const { status, department, search, page = 1, limit = 50 } = req.query;
        
        let sql = `
            SELECT 
                e.*,
                u.email as user_email,
                CASE 
                    WHEN e.photo_url IS NOT NULL THEN e.photo_url
                    ELSE NULL
                END as photo_url
            FROM employees e
            LEFT JOIN users u ON u.id = e.user_id
            WHERE 1=1
        `;
        const params = [];

        if (status) {
            sql += ' AND e.status = ?';
            params.push(status);
        }

        if (department) {
            sql += ' AND e.department = ?';
            params.push(department);
        }

        if (search) {
            sql += ` AND (
                e.first_name LIKE ? OR 
                e.last_name LIKE ? OR 
                e.employee_code LIKE ? OR 
                e.email LIKE ? OR
                e.position LIKE ?
            )`;
            const searchTerm = `%${search}%`;
            params.push(searchTerm, searchTerm, searchTerm, searchTerm, searchTerm);
        }

        sql += ' ORDER BY e.created_at DESC';
        
        // Add pagination
        const offset = (parseInt(page) - 1) * parseInt(limit);
        sql += ` LIMIT ${parseInt(limit)} OFFSET ${offset}`;

        const employees = await query(sql, params);
        
        // Get total count for pagination
        let countSql = 'SELECT COUNT(*) as total FROM employees e WHERE 1=1';
        const countParams = [];
        if (status) {
            countSql += ' AND e.status = ?';
            countParams.push(status);
        }
        if (department) {
            countSql += ' AND e.department = ?';
            countParams.push(department);
        }
        if (search) {
            countSql += ` AND (e.first_name LIKE ? OR e.last_name LIKE ? OR e.employee_code LIKE ?)`;
            countParams.push(`%${search}%`, `%${search}%`, `%${search}%`);
        }
        const countResult = await get(countSql, countParams);

        res.json({
            data: employees,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: countResult.total,
                totalPages: Math.ceil(countResult.total / parseInt(limit))
            }
        });
    } catch (error) {
        console.error('Get employees error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}

// Get employee by ID
export async function getEmployeeById(req, res) {
    try {
        const { id } = req.params;
        
        const employee = await get(
            `SELECT e.*, u.email as user_email
             FROM employees e
             LEFT JOIN users u ON u.id = e.user_id
             WHERE e.id = ?`,
            [id]
        );

        if (!employee) {
            return res.status(404).json({ error: 'Employee not found' });
        }

        // Get associated driver info if exists
        const driverInfo = await get(
            `SELECT d.*, 
                (SELECT COUNT(*) FROM shipments WHERE driver_id = d.id AND status = 'delivered') as completed_trips
             FROM drivers d 
             WHERE d.employee_id = ?`,
            [id]
        );

        res.json({
            ...employee,
            driverInfo
        });
    } catch (error) {
        console.error('Get employee error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}

// Create new employee
export async function createEmployee(req, res) {
    try {
        const {
            firstName, lastName, email, phone, department, position,
            hireDate, salary, nationality, idNumber, dateOfBirth,
            address, emergencyContactName, emergencyContactPhone, status = 'active'
        } = req.body;

        const employeeCode = generateEmployeeCode();
        const photoUrl = req.file ? getPublicUrl(req.file.filename, 'employees') : null;

        const result = await run(
            `INSERT INTO employees (
                employee_code, first_name, last_name, email, phone, department, position,
                hire_date, salary, nationality, id_number, date_of_birth, address,
                emergency_contact_name, emergency_contact_phone, photo_url, status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                employeeCode, firstName, lastName, email, phone, department, position,
                hireDate, salary, nationality, idNumber, dateOfBirth, address,
                emergencyContactName, emergencyContactPhone, photoUrl, status
            ]
        );

        // Log activity
        await run(
            'INSERT INTO activity_logs (user_id, action, entity_type, entity_id, new_values) VALUES (?, ?, ?, ?, ?)',
            [req.user.id, 'CREATE_EMPLOYEE', 'employee', result.id, JSON.stringify({ firstName, lastName, department, position })]
        );

        res.status(201).json({
            id: result.id,
            employeeCode,
            photoUrl,
            message: 'Employee created successfully'
        });
    } catch (error) {
        console.error('Create employee error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}

// Update employee
export async function updateEmployee(req, res) {
    try {
        const { id } = req.params;
        const updates = req.body;

        const employee = await get('SELECT * FROM employees WHERE id = ?', [id]);
        if (!employee) {
            return res.status(404).json({ error: 'Employee not found' });
        }

        // Handle photo upload
        let photoUrl = employee.photo_url;
        if (req.file) {
            photoUrl = getPublicUrl(req.file.filename, 'employees');
        }

        await run(
            `UPDATE employees SET
                first_name = COALESCE(?, first_name),
                last_name = COALESCE(?, last_name),
                email = COALESCE(?, email),
                phone = COALESCE(?, phone),
                department = COALESCE(?, department),
                position = COALESCE(?, position),
                hire_date = COALESCE(?, hire_date),
                salary = COALESCE(?, salary),
                nationality = COALESCE(?, nationality),
                id_number = COALESCE(?, id_number),
                date_of_birth = COALESCE(?, date_of_birth),
                address = COALESCE(?, address),
                emergency_contact_name = COALESCE(?, emergency_contact_name),
                emergency_contact_phone = COALESCE(?, emergency_contact_phone),
                photo_url = COALESCE(?, photo_url),
                status = COALESCE(?, status)
             WHERE id = ?`,
            [
                updates.firstName, updates.lastName, updates.email, updates.phone,
                updates.department, updates.position, updates.hireDate, updates.salary,
                updates.nationality, updates.idNumber, updates.dateOfBirth, updates.address,
                updates.emergencyContactName, updates.emergencyContactPhone, photoUrl,
                updates.status, id
            ]
        );

        // Log activity
        await run(
            'INSERT INTO activity_logs (user_id, action, entity_type, entity_id, old_values, new_values) VALUES (?, ?, ?, ?, ?, ?)',
            [req.user.id, 'UPDATE_EMPLOYEE', 'employee', id, JSON.stringify(employee), JSON.stringify(updates)]
        );

        res.json({ message: 'Employee updated successfully', photoUrl });
    } catch (error) {
        console.error('Update employee error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}

// Delete employee
export async function deleteEmployee(req, res) {
    try {
        const { id } = req.params;

        const employee = await get('SELECT * FROM employees WHERE id = ?', [id]);
        if (!employee) {
            return res.status(404).json({ error: 'Employee not found' });
        }

        // Check if employee has associated driver record with trips
        const driver = await get('SELECT * FROM drivers WHERE employee_id = ?', [id]);
        if (driver) {
            const activeTrips = await get(
                'SELECT COUNT(*) as count FROM shipments WHERE driver_id = ? AND status IN ("picked_up", "in_transit")',
                [driver.id]
            );
            if (activeTrips.count > 0) {
                return res.status(400).json({ error: 'Cannot delete employee with active shipments' });
            }
        }

        await run('DELETE FROM employees WHERE id = ?', [id]);

        // Log activity
        await run(
            'INSERT INTO activity_logs (user_id, action, entity_type, entity_id, old_values) VALUES (?, ?, ?, ?, ?)',
            [req.user.id, 'DELETE_EMPLOYEE', 'employee', id, JSON.stringify(employee)]
        );

        res.json({ message: 'Employee deleted successfully' });
    } catch (error) {
        console.error('Delete employee error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}

// Get departments list
export async function getDepartments(req, res) {
    try {
        const departments = await query(
            'SELECT DISTINCT department FROM employees WHERE department IS NOT NULL ORDER BY department'
        );
        res.json(departments.map(d => d.department));
    } catch (error) {
        console.error('Get departments error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}

// Get employee statistics
export async function getEmployeeStats(req, res) {
    try {
        const byStatus = await query(
            'SELECT status, COUNT(*) as count FROM employees GROUP BY status'
        );
        const byDepartment = await query(
            'SELECT department, COUNT(*) as count FROM employees GROUP BY department'
        );
        const totalCount = await get('SELECT COUNT(*) as total FROM employees');
        
        res.json({
            total: totalCount.total,
            byStatus,
            byDepartment
        });
    } catch (error) {
        console.error('Get employee stats error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}
