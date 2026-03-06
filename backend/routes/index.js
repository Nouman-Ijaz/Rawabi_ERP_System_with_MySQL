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


const router = express.Router();

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
router.put('/profile',                  authController.updateProfile);
router.put('/profile/change-password',  authController.changePassword);

// ============================================
// USERS  (super_admin only for write, admin can read)
// ============================================
router.get('/users',                authorize(['super_admin', 'admin']),       userController.getAllUsers);
router.get('/users/:id',            authorize(['super_admin', 'admin']),       userController.getUserById);
router.post('/users',               authorize(['super_admin']),                userController.createUser);
router.put('/users/:id',            authorize(['super_admin']),                userController.updateUser);
router.delete('/users/:id',         authorize(['super_admin']),                userController.deleteUser);
router.put('/users/:id/reset-password', authorize(['super_admin']),           userController.resetPassword);

// ============================================
// EMPLOYEES  (super_admin, admin, office_admin)
// ============================================
router.get('/employees',             authorize(['super_admin','admin','office_admin']),                     employeeController.getAllEmployees);
router.get('/employees/departments', authorize(['super_admin','admin','office_admin']),                     employeeController.getDepartments);
router.get('/employees/stats',       authorize(['super_admin','admin','office_admin']),                     employeeController.getEmployeeStats);
router.get('/employees/:id',         authorize(['super_admin','admin','office_admin']),                     employeeController.getEmployeeById);
router.post('/employees',            authorize(['super_admin','admin','office_admin']), uploadEmployee.single('photo'), employeeController.createEmployee);
router.put('/employees/:id',         authorize(['super_admin','admin','office_admin']), uploadEmployee.single('photo'), employeeController.updateEmployee);
router.delete('/employees/:id',      authorize(['super_admin','admin']),                                    employeeController.deleteEmployee);

// ============================================
// VEHICLES  (drivers can read their own)
// ============================================
router.get('/vehicles',              authorize(['super_admin','admin','office_admin','dispatcher','accountant']), vehicleController.getAllVehicles);
router.get('/vehicles/summary',      authorize(['super_admin','admin','dispatcher','accountant']),               vehicleController.getVehicleSummary);
router.get('/vehicles/:id',          authorize(['super_admin','admin','office_admin','dispatcher','accountant']), vehicleController.getVehicleById);
router.post('/vehicles',             authorize(['super_admin','admin']),                                         vehicleController.createVehicle);
router.put('/vehicles/:id',          authorize(['super_admin','admin']),                                         vehicleController.updateVehicle);
router.delete('/vehicles/:id',       authorize(['super_admin','admin']),                                         vehicleController.deleteVehicle);
router.post('/vehicles/:id/assign-driver',   authorize(['super_admin','admin','dispatcher']), vehicleController.assignDriver);
router.post('/vehicles/:id/unassign-driver', authorize(['super_admin','admin','dispatcher']), vehicleController.unassignDriver);
router.post('/vehicles/:id/fuel',    authorize(['super_admin','admin','accountant']),                            vehicleController.addFuelRecord);

// ============================================
// DRIVERS
// Drivers can read their own profile only.
// ============================================
router.get('/drivers/available',     authorize(['super_admin','admin','dispatcher']),                            driverController.getAvailableDrivers);
router.get('/drivers',               authorize(['super_admin','admin','office_admin','dispatcher']),             driverController.getAllDrivers);
router.get('/drivers/:id',           authorize(['super_admin','admin','office_admin','dispatcher','driver']),    driverController.getDriverById);
router.get('/drivers/:id/performance', authorize(['super_admin','admin','dispatcher','driver']),                 driverController.getDriverPerformance);
router.post('/drivers',              authorize(['super_admin','admin']), uploadDriver.single('photo'),           driverController.createDriver);
router.put('/drivers/:id',           authorize(['super_admin','admin']), uploadDriver.single('photo'),           driverController.updateDriver);
router.delete('/drivers/:id',        authorize(['super_admin','admin']),                                         driverController.deleteDriver);

// ============================================
// SHIPMENTS
// Drivers can only see their own shipments.
// ============================================
router.get('/shipments',             authorize(['super_admin','admin','office_admin','dispatcher','accountant','driver']), shipmentController.getAllShipments);
router.get('/shipments/stats',       authorize(['super_admin','admin','dispatcher','accountant']),                         shipmentController.getShipmentStats);
router.get('/shipments/:id',         authorize(['super_admin','admin','office_admin','dispatcher','accountant','driver']), shipmentController.getShipmentById);
router.post('/shipments',            authorize(['super_admin','admin','dispatcher']),                                      shipmentController.createShipment);
router.put('/shipments/:id',         authorize(['super_admin','admin','dispatcher']),                                      shipmentController.updateShipment);
router.put('/shipments/:id/status',  authorize(['super_admin','admin','dispatcher','driver']),                             shipmentController.updateStatus);
router.post('/shipments/:id/assign', authorize(['super_admin','admin','dispatcher']),                                      shipmentController.assignVehicleAndDriver);
router.delete('/shipments/:id',      authorize(['super_admin','admin']),                                                   shipmentController.deleteShipment);

// Shipment approval workflow
router.put('/shipments/:id/submit-approval',  authorize(['super_admin','admin','dispatcher']),   shipmentController.submitForApproval);
router.put('/shipments/:id/approve',          authorize(['super_admin','admin']),                shipmentController.approveShipment);
router.put('/shipments/:id/reject',           authorize(['super_admin','admin']),                shipmentController.rejectShipment);

// Shipment documents (POD)
router.post('/shipments/:id/documents',          authorize(['super_admin','admin','dispatcher','driver']), uploadDocument.single('file'), shipmentController.uploadDocument);
router.delete('/shipments/:id/documents/:docId', authorize(['super_admin','admin','dispatcher','driver']), shipmentController.deleteDocument);

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

        res.json({ notifications: notes, count: notes.length });
    } catch (err) {
        console.error('Notifications error:', err);
        res.json({ notifications: [], count: 0 });
    }
});


// Available vehicles and drivers for assignment (not currently on active shipment)
router.get('/available/vehicles', authorize(['super_admin','admin','dispatcher']), async (req, res) => {
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
router.get('/available/drivers', authorize(['super_admin','admin','dispatcher']), async (req, res) => {
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
router.get('/customers',             authorize(['super_admin','admin','office_admin','dispatcher','accountant']), customerController.getAllCustomers);
router.get('/customers/summary',     authorize(['super_admin','admin','accountant']),                             customerController.getCustomerSummary);
router.get('/customers/:id',         authorize(['super_admin','admin','office_admin','dispatcher','accountant']), customerController.getCustomerById);
router.post('/customers',            authorize(['super_admin','admin','dispatcher']),                             customerController.createCustomer);
router.put('/customers/:id',         authorize(['super_admin','admin','office_admin']),                           customerController.updateCustomer);
router.delete('/customers/:id',      authorize(['super_admin','admin']),                                          customerController.deleteCustomer);
router.post('/customers/:id/contacts',       authorize(['super_admin','admin','office_admin']), customerController.addContact);
router.put('/customers/:id/contacts/:contactId', authorize(['super_admin','admin','office_admin']), customerController.updateContact);
router.delete('/customers/:id/contacts/:contactId', authorize(['super_admin','admin']),         customerController.deleteContact);

// ============================================
// FINANCE — INVOICES  (accountant, admin, super_admin)
// ============================================
router.get('/invoices',              authorize(['super_admin','admin','accountant']),    financeController.getAllInvoices);
router.get('/invoices/:id',          authorize(['super_admin','admin','accountant']),    financeController.getInvoiceById);
router.post('/invoices',             authorize(['super_admin','admin','accountant']),    financeController.createInvoice);
router.put('/invoices/:id/status',   authorize(['super_admin','admin','accountant']),    financeController.updateInvoiceStatus);

// ============================================
// FINANCE — PAYMENTS
// ============================================
router.get('/payments',              authorize(['super_admin','admin','accountant']),    financeController.getAllPayments);
router.post('/payments',             authorize(['super_admin','admin','accountant']),    financeController.createPayment);

// ============================================
// FINANCE — EXPENSES
// ============================================
router.get('/expenses',              authorize(['super_admin','admin','accountant']),    financeController.getAllExpenses);
router.post('/expenses',             authorize(['super_admin','admin','accountant','dispatcher']), financeController.createExpense);
router.put('/expenses/:id/approve',  authorize(['super_admin','admin']),                financeController.approveExpense);

// ============================================
// FINANCE — REPORTS & SUMMARY
// ============================================
router.get('/finance/summary',            authorize(['super_admin','admin','accountant']),   financeController.getFinancialSummary);
router.get('/finance/deliverable-shipments', authorize(['super_admin','admin','accountant']),   financeController.getDeliverableShipments);
router.get('/finance/company-settings',      authorize(['super_admin','admin','accountant']),   financeController.getCompanySettings);

// ============================================
// MAINTENANCE  (drivers cannot access)
// ============================================
router.get('/maintenance',           authorize(['super_admin','admin','dispatcher']),   maintenanceController.getAllMaintenance);
router.get('/maintenance/upcoming',  authorize(['super_admin','admin','dispatcher']),   maintenanceController.getUpcomingMaintenance);
router.get('/maintenance/summary',   authorize(['super_admin','admin','dispatcher']),   maintenanceController.getMaintenanceSummary);
router.get('/maintenance/:id',       authorize(['super_admin','admin','dispatcher']),   maintenanceController.getMaintenanceById);
router.post('/maintenance',          authorize(['super_admin','admin']),                maintenanceController.createMaintenance);
router.put('/maintenance/:id',       authorize(['super_admin','admin']),                maintenanceController.updateMaintenance);
router.delete('/maintenance/:id',    authorize(['super_admin','admin']),                maintenanceController.deleteMaintenance);

export default router;
