import bcrypt from 'bcryptjs';
import { query, get, run } from '../database/db.js';
import { generateToken } from '../middleware/auth.js';

// ============================================
// LOGIN
// ============================================
export async function login(req, res) {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }

        const user = await get('SELECT * FROM users WHERE email = ?', [email.toLowerCase()]);

        if (!user) return res.status(401).json({ error: 'Invalid credentials' });

        let isValidPassword = false;
        if (user.password.startsWith('$2a$') || user.password.startsWith('$2b$')) {
            isValidPassword = await bcrypt.compare(password, user.password);
        } else {
            isValidPassword = password === user.password;
        }

        if (!isValidPassword) return res.status(401).json({ error: 'Invalid credentials' });

        await run('UPDATE users SET last_login = NOW() WHERE id = ?', [user.id]);

        await run(
            'INSERT INTO activity_logs (user_id, action, entity_type, ip_address) VALUES (?, ?, ?, ?)',
            [user.id, 'LOGIN', 'user', req.ip]
        );

        const token = generateToken(user);

        res.json({
            token,
            user: {
                id:         user.id,
                email:      user.email,
                firstName:  user.first_name,
                lastName:   user.last_name,
                role:       user.role,
                department: user.department,
            },
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}

// ============================================
// GET PROFILE
// ============================================
export async function getProfile(req, res) {
    try {
        const user = await get(
            `SELECT u.*, e.employee_code, e.position, e.hire_date, e.photo_url
             FROM users u
             LEFT JOIN employees e ON e.user_id = u.id
             WHERE u.id = ?`,
            [req.user.id]
        );

        if (!user) return res.status(404).json({ error: 'User not found' });

        delete user.password;
        res.json(user);
    } catch (error) {
        console.error('Get profile error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}

// ============================================
// UPDATE PROFILE
// ============================================
export async function updateProfile(req, res) {
    try {
        const { firstName, lastName, phone, department } = req.body;

        await run(
            `UPDATE users SET
                first_name = COALESCE(?, first_name),
                last_name  = COALESCE(?, last_name),
                phone      = COALESCE(?, phone),
                department = COALESCE(?, department)
             WHERE id = ?`,
            [firstName, lastName, phone, department, req.user.id]
        );

        res.json({ message: 'Profile updated successfully' });
    } catch (error) {
        console.error('Update profile error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}

// ============================================
// CHANGE PASSWORD
// ============================================
export async function changePassword(req, res) {
    try {
        const { currentPassword, newPassword } = req.body;
        const user = await get('SELECT password FROM users WHERE id = ?', [req.user.id]);

        let isValid = false;
        if (user.password.startsWith('$2a$') || user.password.startsWith('$2b$')) {
            isValid = await bcrypt.compare(currentPassword, user.password);
        } else {
            isValid = currentPassword === user.password;
        }

        if (!isValid) return res.status(400).json({ error: 'Current password is incorrect' });

        const hashed = await bcrypt.hash(newPassword, 10);
        await run('UPDATE users SET password = ? WHERE id = ?', [hashed, req.user.id]);

        res.json({ message: 'Password changed successfully' });
    } catch (error) {
        console.error('Change password error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}

// ============================================
// DASHBOARD STATS
// Drivers receive a personal summary only.
// All other roles receive the full dashboard.
// ============================================
export async function getDashboardStats(req, res) {
    try {
        // ── DRIVER: personal view ──────────────────────
        if (req.user.role === 'driver' && req.driverId) {
            const driverId = req.driverId;

            const myShipments = await query(
                `SELECT s.shipment_number, s.status, s.origin_city, s.destination_city,
                        s.requested_delivery_date, c.company_name as customer_name
                 FROM shipments s
                 JOIN customers c ON c.id = s.customer_id
                 WHERE s.driver_id = ?
                 ORDER BY s.created_at DESC LIMIT 10`,
                [driverId]
            );

            const myStats = await get(
                `SELECT
                    COUNT(*) as total_trips,
                    SUM(CASE WHEN status = 'delivered' THEN 1 ELSE 0 END) as completed,
                    SUM(CASE WHEN status IN ('picked_up','in_transit') THEN 1 ELSE 0 END) as active
                 FROM shipments WHERE driver_id = ?`,
                [driverId]
            );

            const myDriver = await get(
                `SELECT d.rating, d.total_trips, d.status as driver_status,
                        v.plate_number as vehicle_plate, v.vehicle_type
                 FROM drivers d
                 LEFT JOIN vehicle_assignments va ON va.driver_id = d.id AND va.unassigned_date IS NULL
                 LEFT JOIN vehicles v ON v.id = va.vehicle_id
                 WHERE d.id = ?`,
                [driverId]
            );

            return res.json({ role: 'driver', myStats, myShipments, myDriver });
        }

        // ── FULL DASHBOARD ─────────────────────────────
        const [
            customersCount,
            driversCount,
            vehiclesCount,
            employeesCount,
            shipmentsCount,
            pendingApprovals,
            pendingInvoices,
            monthlyRevenue,
            todayShipments,
            activities,
            shipmentStatus,
            driverStatusBreakdown,
            topDrivers,
            overdueShipments,
            expiryAlerts,
            monthlyRevenueChart,
        ] = await Promise.all([
            get(`SELECT COUNT(*) as count FROM customers WHERE status = 'active'`),
            get(`SELECT COUNT(*) as count FROM drivers WHERE status = 'available'`),
            get(`SELECT COUNT(*) as count FROM vehicles WHERE status = 'active'`),
            get(`SELECT COUNT(*) as count FROM employees WHERE status = 'active'`),
            get(`SELECT COUNT(*) as count FROM shipments WHERE status IN ('pending','confirmed','picked_up','in_transit')`),
            get(`SELECT COUNT(*) as count FROM shipments WHERE approval_status = 'pending_approval'`),
            get(`SELECT SUM(balance_due) as total FROM invoices WHERE status IN ('sent','partial','overdue')`),
            get(`SELECT SUM(total_amount) as total FROM invoices WHERE status = 'paid' AND DATE_FORMAT(invoice_date, '%Y-%m') = DATE_FORMAT(NOW(), '%Y-%m')`),
            query(`SELECT s.*, c.company_name as customer_name
                   FROM shipments s
                   JOIN customers c ON s.customer_id = c.id
                   WHERE DATE(s.created_at) = CURDATE()
                   ORDER BY s.created_at DESC LIMIT 5`),
            query(`SELECT al.*, u.first_name, u.last_name
                   FROM activity_logs al
                   LEFT JOIN users u ON al.user_id = u.id
                   ORDER BY al.created_at DESC LIMIT 10`),
            query(`SELECT status, COUNT(*) as count FROM shipments GROUP BY status`),
            query(`SELECT status, COUNT(*) as count FROM drivers GROUP BY status`),
            query(`SELECT e.first_name, e.last_name, d.rating, d.total_trips, d.status as driver_status
                   FROM drivers d
                   JOIN employees e ON e.id = d.employee_id
                   ORDER BY d.rating DESC, d.total_trips DESC LIMIT 5`),
            query(`SELECT s.id, s.shipment_number, s.requested_delivery_date, c.company_name as customer_name,
                          s.origin_city, s.destination_city, s.status
                   FROM shipments s
                   JOIN customers c ON c.id = s.customer_id
                   WHERE s.requested_delivery_date < CURDATE()
                   AND s.status NOT IN ('delivered','cancelled','returned')
                   ORDER BY s.requested_delivery_date ASC LIMIT 10`),
            query(`SELECT 'driver_license' as type,
                          CONCAT(e.first_name, ' ', e.last_name) as name,
                          d.license_expiry as expiry_date,
                          DATEDIFF(d.license_expiry, CURDATE()) as days_remaining
                   FROM drivers d JOIN employees e ON e.id = d.employee_id
                   WHERE d.license_expiry IS NOT NULL
                     AND d.license_expiry <= DATE_ADD(CURDATE(), INTERVAL 60 DAY)
                     AND d.license_expiry >= CURDATE()
                   UNION ALL
                   SELECT 'medical_certificate' as type,
                          CONCAT(e.first_name, ' ', e.last_name) as name,
                          d.medical_certificate_expiry as expiry_date,
                          DATEDIFF(d.medical_certificate_expiry, CURDATE()) as days_remaining
                   FROM drivers d JOIN employees e ON e.id = d.employee_id
                   WHERE d.medical_certificate_expiry IS NOT NULL
                     AND d.medical_certificate_expiry <= DATE_ADD(CURDATE(), INTERVAL 60 DAY)
                     AND d.medical_certificate_expiry >= CURDATE()
                   UNION ALL
                   SELECT 'vehicle_registration' as type,
                          plate_number as name,
                          registration_expiry as expiry_date,
                          DATEDIFF(registration_expiry, CURDATE()) as days_remaining
                   FROM vehicles
                   WHERE registration_expiry IS NOT NULL
                     AND registration_expiry <= DATE_ADD(CURDATE(), INTERVAL 60 DAY)
                     AND registration_expiry >= CURDATE()
                   UNION ALL
                   SELECT 'vehicle_insurance' as type,
                          plate_number as name,
                          insurance_expiry as expiry_date,
                          DATEDIFF(insurance_expiry, CURDATE()) as days_remaining
                   FROM vehicles
                   WHERE insurance_expiry IS NOT NULL
                     AND insurance_expiry <= DATE_ADD(CURDATE(), INTERVAL 60 DAY)
                     AND insurance_expiry >= CURDATE()
                   ORDER BY expiry_date ASC`),
            query(`SELECT DATE_FORMAT(invoice_date, '%Y-%m') as month,
                          SUM(total_amount) as revenue,
                          COUNT(*) as invoice_count
                   FROM invoices
                   WHERE status = 'paid'
                     AND invoice_date >= DATE_SUB(CURDATE(), INTERVAL 12 MONTH)
                   GROUP BY DATE_FORMAT(invoice_date, '%Y-%m')
                   ORDER BY month ASC`),
        ]);

        res.json({
            counts: {
                customers:       customersCount?.count       || 0,
                availableDrivers:driversCount?.count         || 0,
                activeVehicles:  vehiclesCount?.count        || 0,
                employees:       employeesCount?.count       || 0,
                activeShipments: shipmentsCount?.count       || 0,
                pendingApprovals:pendingApprovals?.count     || 0,
            },
            financials: {
                pendingInvoices: pendingInvoices?.total || 0,
                monthlyRevenue:  monthlyRevenue?.total  || 0,
            },
            todayShipments,
            activities,
            shipmentStatus,
            driverStatusBreakdown,
            topDrivers,
            overdueShipments,
            expiryAlerts,
            monthlyRevenueChart,
        });
    } catch (error) {
        console.error('Dashboard stats error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}