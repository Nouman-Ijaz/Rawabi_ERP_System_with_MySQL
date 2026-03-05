import { query, get, run } from '../database/db.js';

// Get all maintenance records
async function getAllMaintenance(req, res) {
    try {
        const { status, vehicle, type, from, to } = req.query;
        let sql = `
            SELECT m.*, 
                   v.plate_number as vehicle_plate, v.vehicle_type, v.vehicle_code,
                   CONCAT(u.first_name, ' ', u.last_name) as performed_by_name
            FROM maintenance_records m
            JOIN vehicles v ON v.id = m.vehicle_id
            LEFT JOIN users u ON u.id = m.performed_by
            WHERE 1=1
        `;
        const params = [];

        if (status) {
            sql += ' AND m.status = ?';
            params.push(status);
        }

        if (vehicle) {
            sql += ' AND m.vehicle_id = ?';
            params.push(vehicle);
        }

        if (type) {
            sql += ' AND m.maintenance_type = ?';
            params.push(type);
        }

        if (from) {
            sql += ' AND date(m.service_date) >= ?';
            params.push(from);
        }

        if (to) {
            sql += ' AND date(m.service_date) <= ?';
            params.push(to);
        }

        sql += ' ORDER BY m.service_date DESC';

        const records = await query(sql, params);
        res.json(records);
    } catch (error) {
        console.error('Get maintenance records error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}

// Get maintenance by ID
async function getMaintenanceById(req, res) {
    try {
        const { id } = req.params;
        
        const record = await get(
            `SELECT m.*, 
                    v.plate_number as vehicle_plate, v.vehicle_type, v.vehicle_code, v.total_km,
                    CONCAT(u.first_name, ' ', u.last_name) as performed_by_name
             FROM maintenance_records m
             JOIN vehicles v ON v.id = m.vehicle_id
             LEFT JOIN users u ON u.id = m.performed_by
             WHERE m.id = ?`,
            [id]
        );

        if (!record) {
            return res.status(404).json({ error: 'Maintenance record not found' });
        }

        res.json(record);
    } catch (error) {
        console.error('Get maintenance error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}

// Create maintenance record
async function createMaintenance(req, res) {
    try {
        const {
            vehicleId, maintenanceType, serviceDate, description, serviceProvider,
            cost, partsReplaced, nextServiceDate, nextServiceKm, notes
        } = req.body;

        const result = await run(
            `INSERT INTO maintenance_records (
                vehicle_id, maintenance_type, service_date, description, service_provider,
                cost, parts_replaced, next_service_date, next_service_km, notes, performed_by
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                vehicleId, maintenanceType, serviceDate, description, serviceProvider,
                cost, partsReplaced, nextServiceDate, nextServiceKm, notes, req.user.id
            ]
        );

        // Update vehicle status to maintenance
        await run(
            'UPDATE vehicles SET status = "maintenance" WHERE id = ?',
            [vehicleId]
        );

        // Log activity
        await run(
            'INSERT INTO activity_logs (user_id, action, entity_type, entity_id, new_values) VALUES (?, ?, ?, ?, ?)',
            [req.user.id, 'CREATE_MAINTENANCE', 'maintenance', result.id, JSON.stringify({ vehicleId, maintenanceType, serviceDate })]
        );

        res.status(201).json({
            id: result.id,
            message: 'Maintenance record created successfully'
        });
    } catch (error) {
        console.error('Create maintenance error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}

// Update maintenance record
async function updateMaintenance(req, res) {
    try {
        const { id } = req.params;
        const updates = req.body;

        const record = await get('SELECT * FROM maintenance_records WHERE id = ?', [id]);
        if (!record) {
            return res.status(404).json({ error: 'Maintenance record not found' });
        }

        await run(
            `UPDATE maintenance_records SET
                maintenance_type = COALESCE(?, maintenance_type),
                service_date = COALESCE(?, service_date),
                completion_date = COALESCE(?, completion_date),
                description = COALESCE(?, description),
                service_provider = COALESCE(?, service_provider),
                cost = COALESCE(?, cost),
                parts_replaced = COALESCE(?, parts_replaced),
                next_service_date = COALESCE(?, next_service_date),
                next_service_km = COALESCE(?, next_service_km),
                status = COALESCE(?, status),
                notes = COALESCE(?, notes)
             WHERE id = ?`,
            [
                updates.maintenanceType, updates.serviceDate, updates.completionDate,
                updates.description, updates.serviceProvider, updates.cost,
                updates.partsReplaced, updates.nextServiceDate, updates.nextServiceKm,
                updates.status, updates.notes, id
            ]
        );

        // If completed, update vehicle status back to active
        if (updates.status === 'completed') {
            await run(
                'UPDATE vehicles SET status = "active" WHERE id = ?',
                [record.vehicle_id]
            );
        }

        // Log activity
        await run(
            'INSERT INTO activity_logs (user_id, action, entity_type, entity_id, old_values, new_values) VALUES (?, ?, ?, ?, ?, ?)',
            [req.user.id, 'UPDATE_MAINTENANCE', 'maintenance', id, JSON.stringify(record), JSON.stringify(updates)]
        );

        res.json({ message: 'Maintenance record updated successfully' });
    } catch (error) {
        console.error('Update maintenance error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}

// Delete maintenance record
async function deleteMaintenance(req, res) {
    try {
        const { id } = req.params;

        const record = await get('SELECT * FROM maintenance_records WHERE id = ?', [id]);
        if (!record) {
            return res.status(404).json({ error: 'Maintenance record not found' });
        }

        await run('DELETE FROM maintenance_records WHERE id = ?', [id]);

        // Log activity
        await run(
            'INSERT INTO activity_logs (user_id, action, entity_type, entity_id, old_values) VALUES (?, ?, ?, ?, ?)',
            [req.user.id, 'DELETE_MAINTENANCE', 'maintenance', id, JSON.stringify(record)]
        );

        res.json({ message: 'Maintenance record deleted successfully' });
    } catch (error) {
        console.error('Delete maintenance error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}

// Get upcoming maintenance
async function getUpcomingMaintenance(req, res) {
    try {
        // Get vehicles due for maintenance
        const byDate = await query(
            `SELECT m.*, v.plate_number, v.vehicle_type, v.total_km
             FROM maintenance_records m
             JOIN vehicles v ON v.id = m.vehicle_id
             WHERE m.next_service_date IS NOT NULL
             AND m.next_service_date <= date('now', '+30 days')
             AND m.status = 'completed'
             ORDER BY m.next_service_date ASC`
        );

        const byKm = await query(
            `SELECT m.*, v.plate_number, v.vehicle_type, v.total_km
             FROM maintenance_records m
             JOIN vehicles v ON v.id = m.vehicle_id
             WHERE m.next_service_km IS NOT NULL
             AND v.total_km >= m.next_service_km - 1000
             AND m.status = 'completed'
             ORDER BY (v.total_km - m.next_service_km) DESC`
        );

        res.json({
            byDate,
            byKm
        });
    } catch (error) {
        console.error('Get upcoming maintenance error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}

// Get maintenance summary
async function getMaintenanceSummary(req, res) {
    try {
        const { period = 'month' } = req.query;

        let dateFilter = '';
        if (period === 'month') {
            dateFilter = "DATE_FORMAT(service_date, '%Y-%m') = DATE_FORMAT(NOW(), '%Y-%m')";
        } else if (period === 'quarter') {
            dateFilter = "QUARTER(service_date) = QUARTER(NOW()) AND YEAR(service_date) = YEAR(NOW())";
        } else if (period === 'year') {
            dateFilter = "YEAR(service_date) = YEAR(NOW())";
        }

        // By type
        const byType = await query(
            `SELECT maintenance_type, COUNT(*) as count, SUM(cost) as total_cost
             FROM maintenance_records
             WHERE ${dateFilter}
             GROUP BY maintenance_type`
        );

        // By vehicle
        const byVehicle = await query(
            `SELECT v.plate_number, v.vehicle_type, COUNT(*) as count, SUM(m.cost) as total_cost
             FROM maintenance_records m
             JOIN vehicles v ON v.id = m.vehicle_id
             WHERE ${dateFilter}
             GROUP BY v.id
             ORDER BY total_cost DESC
             LIMIT 10`
        );

        // Monthly trend
        const monthlyTrend = await query(
            `SELECT 
                DATE_FORMAT(service_date, '%Y-%m') as month,
                COUNT(*) as count,
                SUM(cost) as total_cost
             FROM maintenance_records
             GROUP BY DATE_FORMAT(service_date, '%Y-%m')
             ORDER BY month DESC LIMIT 12`
        );

        res.json({
            byType,
            byVehicle,
            monthlyTrend
        });
    } catch (error) {
        console.error('Get maintenance summary error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}

export {
    getAllMaintenance,
    getMaintenanceById,
    createMaintenance,
    updateMaintenance,
    deleteMaintenance,
    getUpcomingMaintenance,
    getMaintenanceSummary
};
