import express from 'express';
import { authenticateToken, authorize, resolveDriverId } from '../middleware/auth.js';
import { uploadEmployee, uploadDriver, uploadDocument } from '../config/multer.js';

// Controllers
import * as authController        from '../controllers/authController.js';
import * as userController        from '../controllers/userController.js';
import * as vehicleController     from '../controllers/vehicleController.js';
import * as driverController      from '../controllers/driverController.js';
import * as employeeController    from '../controllers/employeeController.js';
import * as shipmentController    from '../controllers/shipmentController.js';
import * as customerController    from '../controllers/customerController.js';
import * as financeController     from '../controllers/financeController.js';
import * as maintenanceController from '../controllers/maintenanceController.js';
import * as reportsController     from '../controllers/reportsController.js';

const router = express.Router();

// ============================================
// ROLE CONSTANTS — use these everywhere below.
// Never write a raw role array in a route again.
// ============================================
const SUPER_ADMIN  = ['super_admin'];
const ADMIN_UP     = ['super_admin', 'admin'];
const FINANCE      = ['super_admin', 'admin', 'accountant'];
const OPERATIONS   = ['super_admin', 'admin', 'dispatcher'];
const MANAGEMENT   = ['super_admin', 'admin', 'office_admin'];
const FLEET_VIEW   = ['super_admin', 'admin', 'office_admin', 'dispatcher'];
const PAY_VIEW     = ['super_admin', 'admin', 'accountant'];
const PAY_EDIT     = ['super_admin', 'admin'];
const REPORT_ROLES = ['super_admin', 'admin', 'accountant', 'dispatcher'];
const SHIPMENTS_ALL   = ['super_admin', 'admin', 'office_admin', 'dispatcher', 'accountant', 'driver'];
const CUSTOMER_VIEW   = ['super_admin', 'admin', 'office_admin', 'dispatcher', 'accountant'];

// ============================================
// PUBLIC ROUTES
// ============================================
router.post('/auth/login', authController.login);
router.get('/shipments/track/:trackingNumber', shipmentController.trackShipment);

// All routes below require a valid JWT
router.use(authenticateToken);
router.use(resolveDriverId);   // attaches req.driverId for driver role

// ============================================
// DASHBOARD
// Drivers get a stripped-down personal view
// ============================================
router.get('/dashboard/stats', authController.getDashboardStats);

// ============================================
// PROFILE  (all roles)
// ============================================
router.get('/profile',                  authController.getProfile);
router.get('/profile/employee',         authController.getMyEmployeeProfile);
router.put('/profile',                  authController.updateProfile);
router.put('/profile/change-password',  authController.changePassword);

// ============================================
// USERS  (super_admin only for write, admin can read)
// ============================================
router.get('/users',                authorize(ADMIN_UP),       userController.getAllUsers);
router.get('/users/stats',          authorize(ADMIN_UP),       userController.getUserStats);
router.get('/users/:id',            authorize(ADMIN_UP),       userController.getUserById);
router.post('/users',               authorize(SUPER_ADMIN),    userController.createUser);
router.put('/users/:id',            authorize(SUPER_ADMIN),    userController.updateUser);
router.delete('/users/:id',         authorize(SUPER_ADMIN),                userController.deleteUser);
// Super admin resets any user's password; any user changes their own via /me/change-password
router.put('/users/:id/reset-password', authorize(SUPER_ADMIN),           userController.resetPassword);
router.put('/me/change-password',   authorize([]),                            userController.changeOwnPassword);

// ============================================
// EMPLOYEES  (super_admin, admin, office_admin)
// ============================================
router.get('/employees',             authorize(MANAGEMENT), employeeController.getAllEmployees);
router.get('/employees/departments', authorize(MANAGEMENT), employeeController.getDepartments);
router.get('/employees/stats',       authorize(MANAGEMENT), employeeController.getEmployeeStats);
router.get('/employees/:id',         authorize(MANAGEMENT), employeeController.getEmployeeById);
router.post('/employees',            authorize(MANAGEMENT), uploadEmployee.single('photo'), employeeController.createEmployee);
router.put('/employees/:id',         authorize(MANAGEMENT), uploadEmployee.single('photo'), employeeController.updateEmployee);
router.delete('/employees/:id',      authorize(ADMIN_UP),                                    employeeController.deleteEmployee);

// ============================================
// VEHICLES  (drivers can read their own)
// ============================================
router.get('/vehicles',              authorize(FLEET_VIEW), vehicleController.getAllVehicles);
router.get('/vehicles/summary',      authorize(OPERATIONS), vehicleController.getVehicleSummary);
router.get('/vehicles/:id',          authorize(FLEET_VIEW), vehicleController.getVehicleById);
router.post('/vehicles',             authorize(ADMIN_UP),   vehicleController.createVehicle);
router.put('/vehicles/:id',          authorize(ADMIN_UP),   vehicleController.updateVehicle);
router.delete('/vehicles/:id',       authorize(ADMIN_UP),   vehicleController.deleteVehicle);
router.post('/vehicles/:id/assign-driver',   authorize(OPERATIONS), vehicleController.assignDriver);
router.post('/vehicles/:id/unassign-driver', authorize(OPERATIONS), vehicleController.unassignDriver);
router.post('/vehicles/:id/fuel',    authorize(OPERATIONS), vehicleController.addFuelRecord);

// ============================================
// DRIVERS
// Drivers can read their own profile only.
// ============================================
router.get('/drivers/available',     authorize(OPERATIONS),                            driverController.getAvailableDrivers);
router.get('/drivers',               authorize(FLEET_VIEW),             driverController.getAllDrivers);
router.get('/drivers/:id',           authorize([...FLEET_VIEW, 'driver']), driverController.getDriverById);
router.get('/drivers/:id/performance', authorize([...OPERATIONS,'driver']), driverController.getDriverPerformance);
router.post('/drivers',              authorize(ADMIN_UP), uploadDriver.single('photo'),           driverController.createDriver);
router.put('/drivers/:id',           authorize(ADMIN_UP), uploadDriver.single('photo'),           driverController.updateDriver);
router.put('/drivers/:id/rating',    authorize(ADMIN_UP),                                         driverController.updateDriverRating);
router.delete('/drivers/:id',        authorize(ADMIN_UP),                                         driverController.deleteDriver);

// ============================================
// SHIPMENTS
// Drivers can only see their own shipments.
// ============================================
router.get('/shipments',             authorize(SHIPMENTS_ALL), shipmentController.getAllShipments);
router.get('/shipments/stats',       authorize([...OPERATIONS,'accountant']),                         shipmentController.getShipmentStats);
router.get('/shipments/:id',         authorize(SHIPMENTS_ALL), shipmentController.getShipmentById);
router.post('/shipments',            authorize(OPERATIONS),                                      shipmentController.createShipment);
router.put('/shipments/:id',         authorize(OPERATIONS),                                      shipmentController.updateShipment);
router.put('/shipments/:id/status',  authorize([...OPERATIONS,'driver']),                             shipmentController.updateStatus);
router.post('/shipments/:id/assign', authorize(OPERATIONS),                                      shipmentController.assignVehicleAndDriver);
router.delete('/shipments/:id',      authorize(ADMIN_UP),                                                   shipmentController.deleteShipment);

// Shipment approval workflow
router.put('/shipments/:id/submit-approval',  authorize(OPERATIONS),   shipmentController.submitForApproval);
router.put('/shipments/:id/approve',          authorize(ADMIN_UP),                shipmentController.approveShipment);
router.put('/shipments/:id/reject',           authorize(ADMIN_UP),                shipmentController.rejectShipment);

// Shipment documents (POD)
router.post('/shipments/:id/documents',          authorize([...OPERATIONS,'driver']), uploadDocument.single('file'), shipmentController.uploadDocument);
router.delete('/shipments/:id/documents/:docId', authorize([...OPERATIONS,'driver']), shipmentController.deleteDocument);

// ── NOTIFICATIONS ─────────────────────────────────────────────────
// Notifications — role-aware, user-specific
router.get('/notifications', authorize(), async (req, res) => {
    try {
        const { query } = await import('../database/db.js');
        const role = req.user.role;
        const notes = [];

        // Admin/super_admin: pending approvals
        if (['super_admin', 'admin'].includes(role)) {
            const pending = await query(
                `SELECT id, shipment_number, created_at FROM shipments
                 WHERE approval_status = 'pending_approval'
                 ORDER BY created_at DESC LIMIT 10`
            );
            pending.forEach(s => notes.push({
                id:      'approval-' + s.id,
                type:    'approval',
                title:   'Shipment pending approval',
                message: s.shipment_number,
                link:    '/shipments/' + s.id,
                priority: 'high',
            }));
        }

        // Driver: their confirmed shipments awaiting pickup
        if (role === 'driver' && req.driverId) {
            const assigned = await query(
                `SELECT s.id, s.shipment_number, s.status, s.requested_pickup_date
                 FROM shipments s
                 WHERE s.driver_id = ? AND s.status = 'confirmed'
                 ORDER BY s.requested_pickup_date ASC LIMIT 5`,
                [req.driverId]
            );
            assigned.forEach(s => notes.push({
                id:       'pickup-' + s.id,
                type:     'pickup',
                title:    'Ready for pickup',
                message:  s.shipment_number + ' — awaiting pickup',
                link:     '/shipments/' + s.id,
                priority: 'high',
            }));
        }

        // Dispatcher/admin: confirmed shipments missing driver or vehicle
        if (['super_admin', 'admin', 'dispatcher'].includes(role)) {
            const unassigned = await query(
                `SELECT id, shipment_number FROM shipments
                 WHERE approval_status = 'approved'
                   AND status = 'confirmed'
                   AND (driver_id IS NULL OR vehicle_id IS NULL)
                 ORDER BY created_at DESC LIMIT 5`
            );
            unassigned.forEach(s => notes.push({
                id:       'assign-' + s.id,
                type:     'assignment',
                title:    'Unassigned shipment',
                message:  s.shipment_number + ' needs driver / vehicle',
                link:     '/shipments/' + s.id,
                priority: 'medium',
            }));
        }

        // Admin/dispatcher: driver licenses expiring within 30 days
        if (['super_admin', 'admin', 'dispatcher'].includes(role)) {
            const expiring = await query(
                `SELECT d.id, e.first_name, e.last_name, d.license_expiry,
                        DATEDIFF(d.license_expiry, CURDATE()) as days_left
                 FROM drivers d JOIN employees e ON e.id = d.employee_id
                 WHERE d.license_expiry BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 30 DAY)
                 ORDER BY d.license_expiry ASC LIMIT 5`
            );
            expiring.forEach(d => notes.push({
                id:       'license-' + d.id,
                type:     'expiry',
                title:    'License expiring soon',
                message:  d.first_name + ' ' + d.last_name + ' — ' + d.days_left + ' days left',
                link:     '/drivers/' + d.id,
                priority: d.days_left <= 7 ? 'high' : 'medium',
            }));
        }

        // Admin: shipments stuck in customs over 3 days
        if (['super_admin', 'admin'].includes(role)) {
            const stuck = await query(
                `SELECT id, shipment_number FROM shipments
                 WHERE status = 'customs'
                   AND updated_at < DATE_SUB(NOW(), INTERVAL 3 DAY)
                 ORDER BY updated_at ASC LIMIT 5`
            );
            stuck.forEach(s => notes.push({
                id:       'customs-' + s.id,
                type:     'customs',
                title:    'Stuck in customs',
                message:  s.shipment_number + ' — over 3 days in customs',
                link:     '/shipments/' + s.id,
                priority: 'high',
            }));
        }

        // Admin/dispatcher: document expiry alerts from cron-maintained table
        if (['super_admin', 'admin', 'dispatcher', 'office_admin'].includes(role)) {
            const expiryAlerts = await query(
                `SELECT * FROM expiry_alerts
                 WHERE is_dismissed = 0 AND severity IN ('critical','warning')
                 ORDER BY days_until ASC LIMIT 10`
            ).catch(() => []);
            expiryAlerts.forEach(a => notes.push({
                id:       'expiry-' + a.id,
                type:     'expiry',
                title:    `${a.doc_type} expiring`,
                message:  `${a.entity_name} — ${a.days_until <= 0 ? 'EXPIRED' : a.days_until + ' days left'}`,
                link:     a.entity_type === 'vehicle' ? '/fleet/vehicles' : a.entity_type === 'driver' ? '/fleet/drivers' : '/employees',
                priority: a.severity === 'critical' ? 'high' : 'medium',
            }));
        }

        // Admin/office_admin: pending leave requests
        if (['super_admin', 'admin', 'office_admin'].includes(role)) {
            const pendingLeave = await query(
                `SELECT lr.id, lr.request_number, e.first_name, e.last_name, lt.name AS leave_type
                 FROM leave_requests lr
                 JOIN employees e ON e.id = lr.employee_id
                 JOIN leave_types lt ON lt.id = lr.leave_type_id
                 WHERE lr.status = 'pending'
                 ORDER BY lr.applied_at DESC LIMIT 5`
            ).catch(() => []);
            pendingLeave.forEach(l => notes.push({
                id:       'leave-' + l.id,
                type:     'leave',
                title:    'Leave request pending',
                message:  `${l.first_name} ${l.last_name} — ${l.leave_type}`,
                link:     '/leave',
                priority: 'medium',
            }));
        }

        res.json({ notifications: notes, count: notes.length });
    } catch (err) {
        console.error('Notifications error:', err);
        res.json({ notifications: [], count: 0 });
    }
});


// Available vehicles and drivers for assignment (not currently on active shipment)
router.get('/available/vehicles', authorize(OPERATIONS), async (req, res) => {
    const { query } = await import('../database/db.js');
    const rows = await query(
        `SELECT v.id, v.plate_number, v.vehicle_type
         FROM vehicles v
         WHERE v.status = 'active'
           AND v.id NOT IN (
               SELECT vehicle_id FROM shipments
               WHERE status IN ('picked_up','in_transit','customs')
               AND vehicle_id IS NOT NULL
               ${req.query.exclude ? 'AND id != ?' : ''}
           )
         ORDER BY v.plate_number`,
        req.query.exclude ? [req.query.exclude] : []
    );
    res.json(rows);
});
router.get('/available/drivers', authorize(OPERATIONS), async (req, res) => {
    const { query } = await import('../database/db.js');
    const rows = await query(
        `SELECT d.id, e.first_name, e.last_name, d.status as driver_status
         FROM drivers d
         JOIN employees e ON e.id = d.employee_id
         WHERE d.status IN ('available','on_trip')
           AND d.id NOT IN (
               SELECT driver_id FROM shipments
               WHERE status IN ('picked_up','in_transit','customs')
               AND driver_id IS NOT NULL
               ${req.query.exclude ? 'AND id != ?' : ''}
           )
         ORDER BY e.first_name`,
        req.query.exclude ? [req.query.exclude] : []
    );
    res.json(rows);
});

// ============================================
// CUSTOMERS  (drivers cannot access)
// ============================================
router.get('/customers',             authorize(CUSTOMER_VIEW), customerController.getAllCustomers);
router.get('/customers/summary',     authorize(FINANCE),                             customerController.getCustomerSummary);
router.get('/customers/:id',         authorize(CUSTOMER_VIEW), customerController.getCustomerById);
router.post('/customers',            authorize(OPERATIONS),                             customerController.createCustomer);
router.put('/customers/:id',         authorize(MANAGEMENT),                           customerController.updateCustomer);
router.delete('/customers/:id',      authorize(ADMIN_UP),                                          customerController.deleteCustomer);
router.post('/customers/:id/contacts',       authorize(MANAGEMENT), customerController.addContact);
router.put('/customers/:id/contacts/:contactId', authorize(MANAGEMENT), customerController.updateContact);
router.delete('/customers/:id/contacts/:contactId', authorize(ADMIN_UP),         customerController.deleteContact);

// ============================================
// FINANCE — INVOICES  (accountant, admin, super_admin)
// ============================================
router.get('/invoices',              authorize(FINANCE),    financeController.getAllInvoices);
router.get('/invoices/:id',          authorize(FINANCE),    financeController.getInvoiceById);
router.post('/invoices',             authorize(FINANCE),    financeController.createInvoice);
router.put('/invoices/:id/status',   authorize(FINANCE),    financeController.updateInvoiceStatus);

// ============================================
// FINANCE — PAYMENTS
// ============================================
router.get('/payments',              authorize(FINANCE),    financeController.getAllPayments);
router.post('/payments',             authorize(FINANCE),    financeController.createPayment);

// ============================================
// FINANCE — EXPENSES
// ============================================
router.get('/expenses',              authorize(FINANCE),    financeController.getAllExpenses);
router.post('/expenses',             authorize([...FINANCE,'dispatcher']), financeController.createExpense);
router.put('/expenses/:id/approve',  authorize(ADMIN_UP),                financeController.approveExpense);

// ============================================
// FINANCE — REPORTS & SUMMARY
// ============================================
router.get('/finance/summary',            authorize(['super_admin','admin','accountant']),   financeController.getFinancialSummary);
router.get('/finance/deliverable-shipments', authorize(['super_admin','admin','accountant']),   financeController.getDeliverableShipments);
router.get('/finance/company-settings',      authorize(['super_admin','admin','accountant']),   financeController.getCompanySettings);
router.get('/settings',                      authorize(ADMIN_UP),               financeController.getAllSettings);
router.put('/settings',                      authorize(SUPER_ADMIN),                       financeController.updateSettings);

// ============================================
// MAINTENANCE  (drivers cannot access)
// ============================================
router.get('/maintenance',           authorize(OPERATIONS),   maintenanceController.getAllMaintenance);
router.get('/maintenance/upcoming',  authorize(OPERATIONS),   maintenanceController.getUpcomingMaintenance);
router.get('/maintenance/summary',   authorize(OPERATIONS),   maintenanceController.getMaintenanceSummary);
router.get('/maintenance/:id',       authorize(OPERATIONS),   maintenanceController.getMaintenanceById);
router.post('/maintenance',          authorize(ADMIN_UP),                maintenanceController.createMaintenance);
router.put('/maintenance/:id',       authorize(ADMIN_UP),                maintenanceController.updateMaintenance);
router.delete('/maintenance/:id',    authorize(ADMIN_UP),                maintenanceController.deleteMaintenance);

// ============================================
// REPORTS & ANALYTICS  (6 period-aware endpoints)
// ============================================
router.get('/reports/shipment-kpis',        authorize(REPORT_ROLES), reportsController.getShipmentKPIs);
router.get('/reports/revenue-by-customer',  authorize(REPORT_ROLES), reportsController.getRevenueByCustomer);
router.get('/reports/route-performance',    authorize(REPORT_ROLES), reportsController.getRoutePerformance);
router.get('/reports/fleet-alerts',         authorize(OPERATIONS), reportsController.getFleetAlerts);
router.get('/reports/cash-flow-forecast',   authorize(FINANCE), reportsController.getCashFlowForecast);
router.get('/reports/driver-performance',   authorize(REPORT_ROLES), reportsController.getDriverPeriodPerformance);

// ============================================
// PAYROLL  (super_admin + admin + accountant)
// ============================================
import * as payrollController from '../controllers/payrollController.js';
import * as leaveController   from '../controllers/leaveController.js';
import { getActiveAlerts, dismissAlert, runExpiryCheck } from '../services/expiryAlerts.js';

router.get('/payroll/stats',                     authorize(PAY_VIEW), payrollController.getPayrollStats);
router.get('/payroll/my-slips',                  authorize([]), payrollController.getMySlips);
router.get('/payroll/slips/:id',                 authorize([]), payrollController.getSlipById);
router.get('/payroll/employee/:employeeId/ytd',  authorize(PAY_VIEW), payrollController.getEmployeeYTD);
router.get('/payroll/periods',                   authorize(PAY_VIEW), payrollController.getAllPeriods);
router.post('/payroll/periods',                  authorize(PAY_EDIT), payrollController.createPeriod);
router.get('/payroll/periods/:id',               authorize(PAY_VIEW), payrollController.getPeriodById);
router.post('/payroll/periods/:id/generate',     authorize(PAY_EDIT), payrollController.generateSlips);
router.post('/payroll/periods/:id/approve',      authorize(SUPER_ADMIN), payrollController.approvePeriod);
router.post('/payroll/periods/:id/mark-paid',    authorize(SUPER_ADMIN), payrollController.markPaid);
router.put('/payroll/slips/:id',                 authorize(PAY_EDIT), payrollController.updateSlip);
router.get('/payroll/salary/:employeeId',        authorize(PAY_VIEW), payrollController.getSalaryStructure);
router.post('/payroll/salary/:employeeId',       authorize(PAY_EDIT), payrollController.upsertSalaryStructure);
router.get('/payroll/loans',                     authorize(PAY_VIEW), payrollController.getLoans);
router.post('/payroll/loans',                    authorize(PAY_EDIT), payrollController.createLoan);
router.put('/payroll/loans/:id/status',          authorize(PAY_EDIT), payrollController.updateLoanStatus);

// ============================================
// LEAVE MANAGEMENT
// ============================================
router.get('/leave/summary',                authorize(MANAGEMENT), leaveController.getLeaveSummary);
router.get('/leave/types',                  authorize([]),          leaveController.getLeaveTypes);
router.get('/leave/balances/me',            authorize([]),          leaveController.getMyBalances);
router.get('/leave/balances/:employeeId',   authorize([]),          leaveController.getBalances);
router.put('/leave/balances/:id',           authorize(MANAGEMENT), leaveController.updateBalance);
router.get('/leave/requests',               authorize([]),          leaveController.getRequests);
router.get('/leave/requests/:id',           authorize([]),          leaveController.getRequestById);
router.post('/leave/requests',              authorize([]),          leaveController.createRequest);
router.put('/leave/requests/:id/review',    authorize(MANAGEMENT), leaveController.reviewRequest);
router.put('/leave/requests/:id/cancel',    authorize([]),          leaveController.cancelRequest);

// ============================================
// EXPIRY ALERTS
// ============================================
router.get('/expiry-alerts', authorize(FLEET_VIEW), async (req, res) => {
    try {
        const alerts = await getActiveAlerts({
            severity:    req.query.severity    || undefined,
            entity_type: req.query.entity_type || undefined,
        });
        res.json(alerts);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/expiry-alerts/:id/dismiss', authorize(FLEET_VIEW), async (req, res) => {
    try {
        await dismissAlert(req.params.id, req.user.id);
        res.json({ message: 'Alert dismissed' });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Force a manual re-scan (admin only)
router.post('/expiry-alerts/scan', authorize(ADMIN_UP), async (req, res) => {
    runExpiryCheck(); // fire and forget
    res.json({ message: 'Scan triggered' });
});

export default router;
