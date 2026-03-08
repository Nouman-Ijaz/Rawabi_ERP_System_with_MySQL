import { query, get, run, beginTransaction, commit, rollback } from '../database/db.js';
import { getPublicUrl } from '../config/multer.js';

function generateEmployeeCode() {
    return 'EMP-' + Date.now().toString(36).toUpperCase().slice(-6);
}

// ============================================
// GET ALL DRIVERS
// ============================================
export async function getAllDrivers(req, res) {
    try {
        const { status, search, available, rating, vehicleAssignment, sortExperience, sortTrips, page = 1, limit = 50 } = req.query;

        let sql = `
            SELECT
                d.id, d.license_number, d.license_type, d.license_expiry,
                d.medical_certificate_expiry, d.years_of_experience, d.rating,
                d.total_trips, d.status as driver_status, d.photo_url as driver_photo_url,
                e.employee_code, e.first_name, e.last_name, e.email, e.phone,
                e.department, e.nationality, e.hire_date, e.photo_url as employee_photo_url,
                v.plate_number as assigned_vehicle_plate, v.vehicle_type as assigned_vehicle_type
            FROM drivers d
            JOIN employees e ON e.id = d.employee_id
            LEFT JOIN vehicle_assignments va ON va.driver_id = d.id AND va.unassigned_date IS NULL
            LEFT JOIN vehicles v ON v.id = va.vehicle_id
            WHERE 1=1
        `;
        const params = [];

        if (status) {
            sql += ' AND d.status = ?';
            params.push(status);
        }

        if (available === 'true') {
            sql += " AND d.status = 'available'";
        }

        if (search) {
            sql += ` AND (
                e.first_name LIKE ? OR
                e.last_name  LIKE ? OR
                e.employee_code LIKE ? OR
                d.license_number LIKE ?
            )`;
            const s = `%${search}%`;
            params.push(s, s, s, s);
        }

        if (rating) {
            const tierRanges = {
                elite:   [4.5, 5.0],
                good:    [3.5, 4.4],
                average: [2.5, 3.4],
                poor:    [1.0, 2.4],
            };
            const range = tierRanges[rating];
            if (range) {
                sql += ' AND d.rating >= ? AND d.rating <= ?';
                params.push(range[0], range[1]);
            }
        }

        if (vehicleAssignment === 'assigned') {
            sql += ' AND v.id IS NOT NULL';
        } else if (vehicleAssignment === 'unassigned') {
            sql += ' AND v.id IS NULL';
        }

        if (sortTrips === 'desc')            sql += ' ORDER BY d.total_trips DESC';
        else if (sortTrips === 'asc')        sql += ' ORDER BY d.total_trips ASC';
        else if (sortExperience === 'desc')  sql += ' ORDER BY d.years_of_experience DESC';
        else if (sortExperience === 'asc')   sql += ' ORDER BY d.years_of_experience ASC';
        else                                 sql += ' ORDER BY e.first_name, e.last_name';

        const offset = (parseInt(page) - 1) * parseInt(limit);
        sql += ` LIMIT ${parseInt(limit)} OFFSET ${offset}`;

        const drivers = await query(sql, params);
        res.json(drivers);
    } catch (error) {
        console.error('Get drivers error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}

// ============================================
// GET DRIVER BY ID
// Drivers can only access their own record.
// ============================================
export async function getDriverById(req, res) {
    try {
        const { id } = req.params;

        // Driver role: enforce own-data only
        if (req.user.role === 'driver' && req.driverId !== parseInt(id)) {
            return res.status(403).json({ error: 'Access denied' });
        }

        const driver = await get(
            `SELECT d.*,
                    e.employee_code, e.first_name, e.last_name, e.email, e.phone,
                    e.department, e.nationality, e.date_of_birth, e.address, e.hire_date,
                    e.emergency_contact_name, e.emergency_contact_phone,
                    e.status as employee_status, e.photo_url as employee_photo_url,
                    v.id as assigned_vehicle_id, v.plate_number as assigned_vehicle_plate,
                    v.vehicle_type as assigned_vehicle_type
             FROM drivers d
             JOIN employees e ON e.id = d.employee_id
             LEFT JOIN vehicle_assignments va ON va.driver_id = d.id AND va.unassigned_date IS NULL
             LEFT JOIN vehicles v ON v.id = va.vehicle_id
             WHERE d.id = ?`,
            [id]
        );

        if (!driver) return res.status(404).json({ error: 'Driver not found' });

        const trips = await query(
            `SELECT s.*, c.company_name as customer_name
             FROM shipments s
             JOIN customers c ON c.id = s.customer_id
             WHERE s.driver_id = ?
             ORDER BY s.actual_pickup_date DESC LIMIT 20`,
            [id]
        );

        const assignments = await query(
            `SELECT va.*, v.plate_number, v.vehicle_type, v.vehicle_code
             FROM vehicle_assignments va
             JOIN vehicles v ON v.id = va.vehicle_id
             WHERE va.driver_id = ?
             ORDER BY va.assigned_date DESC`,
            [id]
        );

        res.json({ ...driver, trips, assignments });
    } catch (error) {
        console.error('Get driver error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}

// ============================================
// CREATE DRIVER
// ============================================
export async function createDriver(req, res) {
    try {
        const {
            firstName, lastName, email, phone, nationality, idNumber, dateOfBirth,
            address, emergencyContactName, emergencyContactPhone, hireDate,
            licenseNumber, licenseType, licenseExpiry, medicalCertificateExpiry,
            yearsOfExperience, department = 'Operations',
        } = req.body;

        const employeeCode = generateEmployeeCode();
        const photoUrl = req.file ? getPublicUrl(req.file.filename, 'drivers') : null;

        await beginTransaction();

        try {
            const employeeResult = await run(
                `INSERT INTO employees (
                    employee_code, first_name, last_name, email, phone, department, position,
                    hire_date, nationality, id_number, date_of_birth, address,
                    emergency_contact_name, emergency_contact_phone, status
                ) VALUES (?, ?, ?, ?, ?, ?, 'Driver', COALESCE(?, CURDATE()), ?, ?, ?, ?, ?, ?, 'active')`,
                [employeeCode, firstName, lastName, email, phone, department,
                 hireDate, nationality, idNumber, dateOfBirth, address,
                 emergencyContactName, emergencyContactPhone]
            );

            const driverResult = await run(
                `INSERT INTO drivers (
                    employee_id, license_number, license_type, license_expiry,
                    medical_certificate_expiry, years_of_experience, photo_url
                ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [employeeResult.id, licenseNumber, licenseType, licenseExpiry,
                 medicalCertificateExpiry, yearsOfExperience || 0, photoUrl]
            );

            await commit();

            await run(
                'INSERT INTO activity_logs (user_id, action, entity_type, entity_id, new_values) VALUES (?, ?, ?, ?, ?)',
                [req.user.id, 'CREATE_DRIVER', 'driver', driverResult.id,
                 JSON.stringify({ firstName, lastName, licenseNumber })]
            );

            res.status(201).json({
                id: driverResult.id,
                employeeId: employeeResult.id,
                employeeCode,
                photoUrl,
                message: 'Driver created successfully',
            });
        } catch (error) {
            await rollback();
            throw error;
        }
    } catch (error) {
        console.error('Create driver error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}

// ============================================
// UPDATE DRIVER
// ============================================
export async function updateDriver(req, res) {
    try {
        const { id } = req.params;
        const updates = req.body;

        const driver = await get(
            `SELECT d.*, e.id as employee_id
             FROM drivers d JOIN employees e ON e.id = d.employee_id
             WHERE d.id = ?`,
            [id]
        );

        if (!driver) return res.status(404).json({ error: 'Driver not found' });

        let photoUrl = driver.photo_url;
        if (req.file) photoUrl = getPublicUrl(req.file.filename, 'drivers');

        // Always update employee — hire_date included
        await run(
            `UPDATE employees SET
                first_name  = COALESCE(?, first_name),
                last_name   = COALESCE(?, last_name),
                email       = COALESCE(?, email),
                phone       = COALESCE(?, phone),
                address     = COALESCE(?, address),
                nationality = COALESCE(?, nationality),
                hire_date   = COALESCE(?, hire_date)
             WHERE id = ?`,
            [updates.firstName, updates.lastName, updates.email, updates.phone,
             updates.address, updates.nationality, updates.hireDate, driver.employee_id]
        );

        await run(
            `UPDATE drivers SET
                license_number              = COALESCE(?, license_number),
                license_type                = COALESCE(?, license_type),
                license_expiry              = COALESCE(?, license_expiry),
                medical_certificate_expiry  = COALESCE(?, medical_certificate_expiry),
                years_of_experience         = COALESCE(?, years_of_experience),
                status                      = COALESCE(?, status),
                rating                      = COALESCE(?, rating),
                photo_url                   = COALESCE(?, photo_url)
             WHERE id = ?`,
            [updates.licenseNumber, updates.licenseType, updates.licenseExpiry,
             updates.medicalCertificateExpiry, updates.yearsOfExperience,
             updates.status, updates.rating, photoUrl, id]
        );

        await run(
            'INSERT INTO activity_logs (user_id, action, entity_type, entity_id, old_values, new_values) VALUES (?, ?, ?, ?, ?, ?)',
            [req.user.id, 'UPDATE_DRIVER', 'driver', id,
             JSON.stringify(driver), JSON.stringify(updates)]
        );

        res.json({ message: 'Driver updated successfully', photoUrl });
    } catch (error) {
        console.error('Update driver error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}

// ============================================
// DELETE DRIVER
// Cleans up all FK references before deleting.
// ============================================
export async function deleteDriver(req, res) {
    try {
        const { id } = req.params;

        const driver = await get('SELECT * FROM drivers WHERE id = ?', [id]);
        if (!driver) return res.status(404).json({ error: 'Driver not found' });

        const activeShipments = await get(
            `SELECT COUNT(*) as count FROM shipments
             WHERE driver_id = ? AND status IN ('picked_up','in_transit')`,
            [id]
        );

        if (activeShipments.count > 0) {
            return res.status(400).json({ error: 'Cannot delete driver with active shipments' });
        }

        // Clean up FK references (preserve history, just unlink)
        await run('DELETE FROM vehicle_assignments WHERE driver_id = ?', [id]);
        await run('UPDATE shipments   SET driver_id = NULL WHERE driver_id = ?', [id]);
        await run('UPDATE expenses     SET driver_id = NULL WHERE driver_id = ?', [id]);
        await run('UPDATE fuel_records SET driver_id = NULL WHERE driver_id = ?', [id]);

        await run('DELETE FROM drivers   WHERE id = ?', [id]);
        await run('DELETE FROM employees WHERE id = ?', [driver.employee_id]);

        await run(
            'INSERT INTO activity_logs (user_id, action, entity_type, entity_id, old_values) VALUES (?, ?, ?, ?, ?)',
            [req.user.id, 'DELETE_DRIVER', 'driver', id, JSON.stringify(driver)]
        );

        res.json({ message: 'Driver deleted successfully' });
    } catch (error) {
        console.error('Delete driver error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}

// ============================================
// GET DRIVER PERFORMANCE
// ============================================
export async function getDriverPerformance(req, res) {
    try {
        const { id } = req.params;

        // Driver can only view their own performance
        if (req.user.role === 'driver' && req.driverId !== parseInt(id)) {
            return res.status(403).json({ error: 'Access denied' });
        }

        const { period = 'month' } = req.query;

        let dateFilter = '';
        if (period === 'month') {
            dateFilter = "AND DATE_FORMAT(s.actual_delivery_date, '%Y-%m') = DATE_FORMAT(NOW(), '%Y-%m')";
        } else if (period === 'quarter') {
            dateFilter = "AND QUARTER(s.actual_delivery_date) = QUARTER(NOW()) AND YEAR(s.actual_delivery_date) = YEAR(NOW())";
        } else if (period === 'year') {
            dateFilter = "AND YEAR(s.actual_delivery_date) = YEAR(NOW())";
        }

        const stats = await get(
            `SELECT
                COUNT(*) as total_trips,
                SUM(CASE WHEN s.status = 'delivered' THEN 1 ELSE 0 END) as completed_trips,
                SUM(CASE WHEN s.actual_delivery_date <= s.requested_delivery_date THEN 1 ELSE 0 END) as on_time_deliveries,
                SUM(s.final_amount) as total_revenue
             FROM shipments s
             WHERE s.driver_id = ? ${dateFilter}`,
            [id]
        );

        const monthlyTrips = await query(
            `SELECT
                DATE_FORMAT(s.actual_delivery_date, '%Y-%m') as month,
                COUNT(*) as trip_count
             FROM shipments s
             WHERE s.driver_id = ? AND s.status = 'delivered'
             GROUP BY DATE_FORMAT(s.actual_delivery_date, '%Y-%m')
             ORDER BY month DESC LIMIT 12`,
            [id]
        );

        res.json({ stats, monthlyTrips });
    } catch (error) {
        console.error('Get driver performance error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}

// ============================================
// GET AVAILABLE DRIVERS
// ============================================
export async function getAvailableDrivers(req, res) {
    try {
        const drivers = await query(
            `SELECT d.id, e.first_name, e.last_name, d.license_type, d.rating, d.photo_url
             FROM drivers d
             JOIN employees e ON e.id = d.employee_id
             WHERE d.status = 'available'
             ORDER BY e.first_name, e.last_name`
        );
        res.json(drivers);
    } catch (error) {
        console.error('Get available drivers error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}

// ── UPDATE DRIVER RATING (super_admin + admin only) ─────────────────
export async function updateDriverRating(req, res) {
    try {
        const { id } = req.params;
        const { rating, notes } = req.body;

        if (rating === undefined || rating === null) {
            return res.status(400).json({ error: 'Rating is required' });
        }
        const r = parseFloat(rating);
        if (isNaN(r) || r < 1 || r > 5) {
            return res.status(400).json({ error: 'Rating must be between 1.0 and 5.0' });
        }

        const driver = await get('SELECT * FROM drivers WHERE id = ?', [id]);
        if (!driver) return res.status(404).json({ error: 'Driver not found' });

        await run(
            'UPDATE drivers SET rating = ? WHERE id = ?',
            [Math.round(r * 10) / 10, id]
        );

        await run(
            'INSERT INTO activity_logs (user_id, action, entity_type, entity_id, new_values) VALUES (?,?,?,?,?)',
            [req.user.id, 'UPDATE_DRIVER_RATING', 'driver', id, JSON.stringify({ rating: r, notes })]
        );

        res.json({ message: 'Rating updated successfully', rating: r });
    } catch (error) {
        console.error('Update driver rating error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}
