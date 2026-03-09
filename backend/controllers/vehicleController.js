import { asyncHandler } from '../middleware/asyncHandler.js';
import { query, get, run } from '../database/db.js';
import { getPublicUrl } from '../config/multer.js';

// Generate vehicle code
function generateVehicleCode() {
    return 'VEH-' + Date.now().toString(36).toUpperCase().slice(-6);
}

// Get all vehicles with optional filters
export const getAllVehicles = asyncHandler(async (req, res) => {
        const { status, type, search, fuelType, driverAssignment, expiryAlert, sort = 'created_at', page = 1, limit = 50 } = req.query;
        
        let sql = `
            SELECT 
                v.*, 
                d.id as driver_id, d.license_number, d.status as driver_status, d.photo_url as driver_photo_url,
                CONCAT(e.first_name, ' ', e.last_name) as driver_name
            FROM vehicles v
            LEFT JOIN vehicle_assignments va ON va.vehicle_id = v.id AND va.unassigned_date IS NULL
            LEFT JOIN drivers d ON d.id = va.driver_id
            LEFT JOIN employees e ON e.id = d.employee_id
            WHERE 1=1
        `;
        const params = [];

        if (status) {
            sql += ' AND v.status = ?';
            params.push(status);
        }

        if (type) {
            sql += ' AND v.vehicle_type = ?';
            params.push(type);
        }

        if (search) {
            sql += ` AND (
                v.plate_number LIKE ? OR 
                v.vehicle_code LIKE ? OR 
                v.brand LIKE ? OR 
                v.model LIKE ? OR
                v.trailer_type LIKE ?
            )`;
            const searchTerm = `%${search}%`;
            params.push(searchTerm, searchTerm, searchTerm, searchTerm, searchTerm);
        }

        if (fuelType) {
            sql += ' AND v.fuel_type = ?';
            params.push(fuelType);
        }

        if (driverAssignment === 'assigned')   sql += ' AND e.id IS NOT NULL';
        if (driverAssignment === 'unassigned') sql += ' AND e.id IS NULL';

        if (expiryAlert === 'expiring') {
            sql += ` AND (
                (v.registration_expiry IS NOT NULL AND DATEDIFF(v.registration_expiry, CURDATE()) BETWEEN 0 AND 30)
                OR (v.insurance_expiry IS NOT NULL AND DATEDIFF(v.insurance_expiry, CURDATE()) BETWEEN 0 AND 30)
            )`;
        } else if (expiryAlert === 'expired') {
            sql += ` AND (
                (v.registration_expiry IS NOT NULL AND v.registration_expiry < CURDATE())
                OR (v.insurance_expiry IS NOT NULL AND v.insurance_expiry < CURDATE())
            )`;
        }

        const sortMap = {
            created_at:           'v.created_at DESC',
            plate_asc:            'v.plate_number ASC',
            year_desc:            'v.year DESC',
            year_asc:             'v.year ASC',
            capacity_desc:        'v.capacity_kg DESC',
            registration_expiry:  'v.registration_expiry ASC',
            insurance_expiry:     'v.insurance_expiry ASC',
        };
        sql += ` ORDER BY ${sortMap[sort] || 'v.created_at DESC'}`;

        
        // Add pagination
        const offset = (parseInt(page) - 1) * parseInt(limit);
        sql += ` LIMIT ${parseInt(limit)} OFFSET ${offset}`;

        const vehicles = await query(sql, params);
        
        // Get total count
        let countSql = 'SELECT COUNT(*) as total FROM vehicles WHERE 1=1';
        const countParams = [];
        if (status) {
            countSql += ' AND status = ?';
            countParams.push(status);
        }
        if (type) {
            countSql += ' AND vehicle_type = ?';
            countParams.push(type);
        }
        if (search) {
            countSql += ` AND (plate_number LIKE ? OR vehicle_code LIKE ? OR brand LIKE ?)`;
            countParams.push(`%${search}%`, `%${search}%`, `%${search}%`);
        }
        const countResult = await get(countSql, countParams);

        res.json({
            data: vehicles,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: countResult.total,
                totalPages: Math.ceil(countResult.total / parseInt(limit))
            }
        });
});

// Get vehicle by ID
export const getVehicleById = asyncHandler(async (req, res) => {
        const { id } = req.params;
        
        const vehicle = await get(
            `SELECT v.*, 
                    d.id as driver_id, d.license_number, d.status as driver_status, d.photo_url as driver_photo_url,
                    CONCAT(e.first_name, ' ', e.last_name) as driver_name
             FROM vehicles v
             LEFT JOIN vehicle_assignments va ON va.vehicle_id = v.id AND va.unassigned_date IS NULL
             LEFT JOIN drivers d ON d.id = va.driver_id
             LEFT JOIN employees e ON e.id = d.employee_id
             WHERE v.id = ?`,
            [id]
        );

        if (!vehicle) {
            return res.status(404).json({ error: 'Vehicle not found' });
        }

        // Get maintenance history
        const maintenance = await query(
            `SELECT m.*, CONCAT(u.first_name, ' ', u.last_name) as performed_by_name
             FROM maintenance_records m
             LEFT JOIN users u ON u.id = m.performed_by
             WHERE m.vehicle_id = ? 
             ORDER BY m.service_date DESC`,
            [id]
        );

        // Get fuel records
        const fuelRecords = await query(
            `SELECT f.*, CONCAT(e.first_name, ' ', e.last_name) as driver_name 
             FROM fuel_records f 
             LEFT JOIN drivers d ON d.id = f.driver_id 
             LEFT JOIN employees e ON e.id = d.employee_id 
             WHERE f.vehicle_id = ? 
             ORDER BY f.fuel_date DESC LIMIT 20`,
            [id]
        );

        // Get assignment history
        const assignments = await query(
            `SELECT va.*, CONCAT(e.first_name, ' ', e.last_name) as driver_name
             FROM vehicle_assignments va
             LEFT JOIN drivers d ON d.id = va.driver_id
             LEFT JOIN employees e ON e.id = d.employee_id
             WHERE va.vehicle_id = ?
             ORDER BY va.assigned_date DESC`,
            [id]
        );

        res.json({
            ...vehicle,
            maintenance,
            fuelRecords,
            assignments
        });
});

// Create vehicle
export const createVehicle = asyncHandler(async (req, res) => {
        const {
            plateNumber, vehicleType, brand, model, year, capacityKg, capacityCbm,
            fuelType, trailerType, purchaseDate, purchasePrice, registrationExpiry,
            insuranceExpiry, notes
        } = req.body;

        // Check if plate number exists
        const existing = await get('SELECT id FROM vehicles WHERE plate_number = ?', [plateNumber]);
        if (existing) {
            return res.status(400).json({ error: 'Plate number already exists' });
        }

        const vehicleCode = generateVehicleCode();

        const result = await run(
            `INSERT INTO vehicles (
                vehicle_code, plate_number, vehicle_type, brand, model, year,
                capacity_kg, capacity_cbm, fuel_type, trailer_type, purchase_date,
                purchase_price, registration_expiry, insurance_expiry, notes
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [vehicleCode, plateNumber, vehicleType, brand, model, year, capacityKg, capacityCbm,
             fuelType, trailerType, purchaseDate, purchasePrice, registrationExpiry,
             insuranceExpiry, notes]
        );

        // Log activity
        await run(
            'INSERT INTO activity_logs (user_id, action, entity_type, entity_id, new_values) VALUES (?, ?, ?, ?, ?)',
            [req.user.id, 'CREATE_VEHICLE', 'vehicle', result.id, JSON.stringify({ plateNumber, vehicleType, brand })]
        );

        res.status(201).json({
            id: result.id,
            vehicleCode,
            message: 'Vehicle created successfully'
        });
});

// Update vehicle
export const updateVehicle = asyncHandler(async (req, res) => {
        const { id } = req.params;
        const updates = req.body;

        const vehicle = await get('SELECT * FROM vehicles WHERE id = ?', [id]);
        if (!vehicle) {
            return res.status(404).json({ error: 'Vehicle not found' });
        }

        await run(
            `UPDATE vehicles SET
                plate_number = COALESCE(?, plate_number),
                vehicle_type = COALESCE(?, vehicle_type),
                brand = COALESCE(?, brand),
                model = COALESCE(?, model),
                year = COALESCE(?, year),
                capacity_kg = COALESCE(?, capacity_kg),
                capacity_cbm = COALESCE(?, capacity_cbm),
                fuel_type = COALESCE(?, fuel_type),
                trailer_type = COALESCE(?, trailer_type),
                registration_expiry = COALESCE(?, registration_expiry),
                insurance_expiry = COALESCE(?, insurance_expiry),
                status = COALESCE(?, status),
                current_location = COALESCE(?, current_location),
                total_km = COALESCE(?, total_km),
                notes = COALESCE(?, notes)
             WHERE id = ?`,
            [
                updates.plateNumber, updates.vehicleType, updates.brand, updates.model,
                updates.year, updates.capacityKg, updates.capacityCbm, updates.fuelType,
                updates.trailerType, updates.registrationExpiry, updates.insuranceExpiry,
                updates.status, updates.currentLocation, updates.totalKm, updates.notes, id
            ]
        );

        // Log activity
        await run(
            'INSERT INTO activity_logs (user_id, action, entity_type, entity_id, old_values, new_values) VALUES (?, ?, ?, ?, ?, ?)',
            [req.user.id, 'UPDATE_VEHICLE', 'vehicle', id, JSON.stringify(vehicle), JSON.stringify(updates)]
        );

        res.json({ message: 'Vehicle updated successfully' });
});

// Delete vehicle
export const deleteVehicle = asyncHandler(async (req, res) => {
        const { id } = req.params;

        const vehicle = await get('SELECT * FROM vehicles WHERE id = ?', [id]);
        if (!vehicle) {
            return res.status(404).json({ error: 'Vehicle not found' });
        }

        // Check for active assignments or shipments
        const activeShipment = await get(
            'SELECT COUNT(*) as count FROM shipments WHERE vehicle_id = ? AND status IN ("confirmed", "picked_up", "in_transit")',
            [id]
        );
        if (activeShipment.count > 0) {
            return res.status(400).json({ error: 'Cannot delete vehicle with active shipments' });
        }

        await run('DELETE FROM vehicles WHERE id = ?', [id]);

        // Log activity
        await run(
            'INSERT INTO activity_logs (user_id, action, entity_type, entity_id, old_values) VALUES (?, ?, ?, ?, ?)',
            [req.user.id, 'DELETE_VEHICLE', 'vehicle', id, JSON.stringify(vehicle)]
        );

        res.json({ message: 'Vehicle deleted successfully' });
});

// Assign driver to vehicle
export const assignDriver = asyncHandler(async (req, res) => {
        const { id } = req.params;
        const { driverId, isPrimary = true, notes } = req.body;

        // Unassign current driver if primary
        if (isPrimary) {
            await run(
                'UPDATE vehicle_assignments SET unassigned_date = date("now") WHERE vehicle_id = ? AND unassigned_date IS NULL',
                [id]
            );
        }

        // Create new assignment
        await run(
            'INSERT INTO vehicle_assignments (vehicle_id, driver_id, assigned_date, is_primary, notes) VALUES (?, ?, date("now"), ?, ?)',
            [id, driverId, isPrimary, notes]
        );

        // Update driver status
        await run('UPDATE drivers SET status = "on_trip" WHERE id = ?', [driverId]);

        // Log activity
        await run(
            'INSERT INTO activity_logs (user_id, action, entity_type, entity_id, new_values) VALUES (?, ?, ?, ?, ?)',
            [req.user.id, 'ASSIGN_DRIVER', 'vehicle', id, JSON.stringify({ driverId, isPrimary })]
        );

        res.json({ message: 'Driver assigned successfully' });
});

// Unassign driver
export const unassignDriver = asyncHandler(async (req, res) => {
        const { id } = req.params;
        const { driverId } = req.body;

        await run(
            'UPDATE vehicle_assignments SET unassigned_date = date("now") WHERE vehicle_id = ? AND driver_id = ? AND unassigned_date IS NULL',
            [id, driverId]
        );

        // Update driver status
        await run('UPDATE drivers SET status = "available" WHERE id = ?', [driverId]);

        // Log activity
        await run(
            'INSERT INTO activity_logs (user_id, action, entity_type, entity_id, new_values) VALUES (?, ?, ?, ?, ?)',
            [req.user.id, 'UNASSIGN_DRIVER', 'vehicle', id, JSON.stringify({ driverId })]
        );

        res.json({ message: 'Driver unassigned successfully' });
});

// Add fuel record
export const addFuelRecord = asyncHandler(async (req, res) => {
        const { id } = req.params;
        const { driverId, fuelDate, fuelStation, fuelType, quantityLiters, pricePerLiter, totalCost, odometerReading, receiptNumber, notes } = req.body;

        await run(
            `INSERT INTO fuel_records (vehicle_id, driver_id, fuel_date, fuel_station, fuel_type, 
             quantity_liters, price_per_liter, total_cost, odometer_reading, receipt_number, notes)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [id, driverId, fuelDate, fuelStation, fuelType, quantityLiters, pricePerLiter, totalCost, odometerReading, receiptNumber, notes]
        );

        // Update vehicle total km if provided
        if (odometerReading) {
            await run(
                'UPDATE vehicles SET total_km = ? WHERE id = ?',
                [odometerReading, id]
            );
        }

        res.status(201).json({ message: 'Fuel record added successfully' });
});

// Get vehicle types summary
export const getVehicleSummary = asyncHandler(async (req, res) => {
        const byType = await query('SELECT vehicle_type, COUNT(*) as count FROM vehicles GROUP BY vehicle_type');
        const byStatus = await query('SELECT status, COUNT(*) as count FROM vehicles GROUP BY status');
        const byTrailerType = await query('SELECT trailer_type, COUNT(*) as count FROM vehicles WHERE trailer_type IS NOT NULL GROUP BY trailer_type');

        res.json({
            byType,
            byStatus,
            byTrailerType
        });
});
