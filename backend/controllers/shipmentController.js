import { asyncHandler, httpError } from '../middleware/asyncHandler.js';
import { query, get, run } from '../database/db.js';
import { logActivity } from '../utils/helpers.js';

// Shipment/tracking numbers use date-stamped format so we keep local generators.
function generateShipmentNumber() {
    const d = new Date();
    const yy = d.getFullYear().toString().slice(-2);
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const rand = Math.floor(1000 + Math.random() * 9000);
    return `RAW-${yy}${mm}-${rand}`;
}

function generateTrackingNumber() {
    return 'TRK' + Date.now().toString(36).toUpperCase();
}

// ============================================
// GET ALL SHIPMENTS
// Drivers automatically scoped to own records.
// ============================================
export const getAllShipments = asyncHandler(async (req, res) => {
        const { status, customer, driver, vehicle, from, to, search, approval_status, page = 1, limit = 50 } = req.query;

        let sql = `
            SELECT s.*,
                   c.company_name as customer_name, c.contact_person as customer_contact,
                   CONCAT(e.first_name, ' ', e.last_name) as driver_name,
                   v.plate_number as vehicle_plate
            FROM shipments s
            JOIN customers c ON c.id = s.customer_id
            LEFT JOIN drivers d ON d.id = s.driver_id
            LEFT JOIN employees e ON e.id = d.employee_id
            LEFT JOIN vehicles v ON v.id = s.vehicle_id
            WHERE 1=1
        `;
        const params = [];

        // Driver sees only their own shipments
        if (req.user.role === 'driver' && req.driverId) {
            sql += ' AND s.driver_id = ?';
            params.push(req.driverId);
        }

        if (status) { sql += ' AND s.status = ?'; params.push(status); }
        if (approval_status) { sql += ' AND s.approval_status = ?'; params.push(approval_status); }
        if (customer) { sql += ' AND s.customer_id = ?'; params.push(customer); }
        if (driver && req.user.role !== 'driver') { sql += ' AND s.driver_id = ?'; params.push(driver); }
        if (vehicle)  { sql += ' AND s.vehicle_id = ?'; params.push(vehicle); }
        if (from)     { sql += ' AND DATE(s.order_date) >= ?'; params.push(from); }
        if (to)       { sql += ' AND DATE(s.order_date) <= ?'; params.push(to); }

        if (search) {
            sql += ` AND (
                s.shipment_number LIKE ? OR
                c.company_name    LIKE ? OR
                s.origin_city     LIKE ? OR
                s.destination_city LIKE ? OR
                s.cargo_type      LIKE ?
            )`;
            const s = `%${search}%`;
            params.push(s, s, s, s, s);
        }

        sql += ' ORDER BY s.created_at DESC';

        const offset = (parseInt(page) - 1) * parseInt(limit);
        sql += ` LIMIT ${parseInt(limit)} OFFSET ${offset}`;

        const shipments = await query(sql, params);

        // Count without pagination
        let countSql = `SELECT COUNT(*) as total FROM shipments s JOIN customers c ON c.id = s.customer_id WHERE 1=1`;
        const countParams = [];
        if (req.user.role === 'driver' && req.driverId) { countSql += ' AND s.driver_id = ?'; countParams.push(req.driverId); }
        if (status)  { countSql += ' AND s.status = ?'; countParams.push(status); }
        if (search)  { countSql += ' AND (s.shipment_number LIKE ? OR c.company_name LIKE ?)'; countParams.push(`%${search}%`, `%${search}%`); }
        const countResult = await get(countSql, countParams);

        res.json({
            data: shipments,
            pagination: {
                page:       parseInt(page),
                limit:      parseInt(limit),
                total:      countResult.total,
                totalPages: Math.ceil(countResult.total / parseInt(limit)),
            },
        });
});

// ============================================
// GET SHIPMENT BY ID
// ============================================
export const getShipmentById = asyncHandler(async (req, res) => {
        const { id } = req.params;

        const shipment = await get(
            `SELECT s.*,
                    c.company_name as customer_name, c.contact_person as customer_contact,
                    c.phone as customer_phone, c.email as customer_email,
                    CONCAT(e.first_name, ' ', e.last_name) as driver_name,
                    d.license_number, d.photo_url as driver_photo_url,
                    v.plate_number as vehicle_plate, v.vehicle_type, v.vehicle_code,
                    CONCAT(ab.first_name, ' ', ab.last_name) as approved_by_name,
                    CONCAT(cb.first_name, ' ', cb.last_name) as created_by_name
             FROM shipments s
             JOIN customers c ON c.id = s.customer_id
             LEFT JOIN drivers d ON d.id = s.driver_id
             LEFT JOIN employees e ON e.id = d.employee_id
             LEFT JOIN vehicles v ON v.id = s.vehicle_id
             LEFT JOIN users ab ON ab.id = s.approved_by
             LEFT JOIN users cb ON cb.id = s.created_by
             WHERE s.id = ?`,
            [id]
        );

        if (!shipment) return res.status(404).json({ error: 'Shipment not found' });

        // Driver can only see their own shipment
        if (req.user.role === 'driver' && req.driverId && shipment.driver_id !== req.driverId) {
            return res.status(403).json({ error: 'Access denied' });
        }

        const tracking = await query(
            `SELECT st.*, CONCAT(u.first_name, ' ', u.last_name) as recorded_by_name
             FROM shipment_tracking st
             LEFT JOIN users u ON u.id = st.recorded_by
             WHERE st.shipment_id = ?
             ORDER BY st.event_time DESC`,
            [id]
        );

        const documents = await query(
            `SELECT sd.*, CONCAT(u.first_name, ' ', u.last_name) as uploaded_by_name
             FROM shipment_documents sd
             LEFT JOIN users u ON u.id = sd.uploaded_by
             WHERE sd.shipment_id = ?
             ORDER BY sd.uploaded_at DESC`,
            [id]
        );

        const invoice = await get('SELECT * FROM invoices WHERE shipment_id = ?', [id]);

        res.json({ ...shipment, tracking, documents, invoice });
});

// ============================================
// CREATE SHIPMENT
// ============================================
export const createShipment = asyncHandler(async (req, res) => {
        const {
            customerId, orderDate, requestedPickupDate, requestedDeliveryDate,
            originAddress, originCity, originCountry, destinationAddress, destinationCity,
            destinationCountry, cargoType, cargoDescription, weightKg, volumeCbm, pieces,
            value, transportMode, serviceType, specialInstructions, quotedAmount,
            vehicleId, driverId,
        } = req.body;

        const shipmentNumber = generateShipmentNumber();
        const trackingNumber = generateTrackingNumber();

        // Admins and super_admins skip the approval queue — they approve their own shipments
        const isAdmin = ['admin', 'super_admin'].includes(req.user.role);
        const approvalStatus = isAdmin ? 'approved' : 'draft';
        const status         = isAdmin ? 'confirmed' : 'pending';

        const resolvedVehicleId = vehicleId && vehicleId !== 'none' ? parseInt(vehicleId) : null;
        const resolvedDriverId  = driverId  && driverId  !== 'none' ? parseInt(driverId)  : null;

        const result = await run(
            `INSERT INTO shipments (
                shipment_number, customer_id, order_date, requested_pickup_date, requested_delivery_date,
                origin_address, origin_city, origin_country, destination_address, destination_city,
                destination_country, cargo_type, cargo_description, weight_kg, volume_cbm, pieces,
                value, transport_mode, service_type, tracking_number, special_instructions,
                quoted_amount, vehicle_id, driver_id, status, approval_status, created_by
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                shipmentNumber,
                customerId             ?? null,
                orderDate              ?? null,
                requestedPickupDate    ?? null,
                requestedDeliveryDate  ?? null,
                originAddress          ?? null,
                originCity             ?? null,
                originCountry          || 'Saudi Arabia',
                destinationAddress     ?? null,
                destinationCity        ?? null,
                destinationCountry     || 'Saudi Arabia',
                cargoType              ?? null,
                cargoDescription       ?? null,
                weightKg               ?? null,
                volumeCbm              ?? null,
                pieces                 ?? 1,
                value                  ?? null,
                transportMode          || 'road',
                serviceType            || 'standard',
                trackingNumber,
                specialInstructions    ?? null,
                quotedAmount           ?? null,
                resolvedVehicleId,
                resolvedDriverId,
                status,
                approvalStatus,
                req.user.id,
            ]
        );

        // If a driver was assigned, mark them on_trip
        if (resolvedDriverId) {
            await run("UPDATE drivers SET status = 'on_trip' WHERE id = ?", [resolvedDriverId]);
        }

        await run(
            'INSERT INTO shipment_tracking (shipment_id, event_type, event_description, recorded_by) VALUES (?, ?, ?, ?)',
            [result.id, 'ORDER_CREATED', 'Shipment order created', req.user.id]
        );

        await logActivity(req.user.id, 'CREATE_SHIPMENT', 'shipment', result.id,
            { shipmentNumber, customerId, cargoType });

        res.status(201).json({
            id: result.id,
            shipmentNumber,
            trackingNumber,
            message: 'Shipment created successfully',
        });
});

// ============================================
// UPDATE SHIPMENT
// ============================================
export const updateShipment = asyncHandler(async (req, res) => {
        const { id } = req.params;
        const updates = req.body;

        const shipment = await get('SELECT * FROM shipments WHERE id = ?', [id]);
        if (!shipment) return res.status(404).json({ error: 'Shipment not found' });

        await run(
            `UPDATE shipments SET
                customer_id             = COALESCE(?, customer_id),
                requested_pickup_date   = COALESCE(?, requested_pickup_date),
                requested_delivery_date = COALESCE(?, requested_delivery_date),
                origin_address          = COALESCE(?, origin_address),
                origin_city             = COALESCE(?, origin_city),
                destination_address     = COALESCE(?, destination_address),
                destination_city        = COALESCE(?, destination_city),
                cargo_type              = COALESCE(?, cargo_type),
                cargo_description       = COALESCE(?, cargo_description),
                weight_kg               = COALESCE(?, weight_kg),
                volume_cbm              = COALESCE(?, volume_cbm),
                pieces                  = COALESCE(?, pieces),
                value                   = COALESCE(?, value),
                transport_mode          = COALESCE(?, transport_mode),
                service_type            = COALESCE(?, service_type),
                special_instructions    = COALESCE(?, special_instructions),
                quoted_amount           = COALESCE(?, quoted_amount),
                final_amount            = COALESCE(?, final_amount)
             WHERE id = ?`,
            [
                updates.customerId            ?? null,
                updates.requestedPickupDate   ?? null,
                updates.requestedDeliveryDate ?? null,
                updates.originAddress         ?? null,
                updates.originCity            ?? null,
                updates.destinationAddress    ?? null,
                updates.destinationCity       ?? null,
                updates.cargoType             ?? null,
                updates.cargoDescription      ?? null,
                updates.weightKg              ?? null,
                updates.volumeCbm             ?? null,
                updates.pieces                ?? null,
                updates.value                 ?? null,
                updates.transportMode         ?? null,
                updates.serviceType           ?? null,
                updates.specialInstructions   ?? null,
                updates.quotedAmount          ?? null,
                updates.finalAmount           ?? null,
                id,
            ]
        );

        await logActivity(req.user.id, 'UPDATE_SHIPMENT', 'shipment', id, updates, shipment);

        res.json({ message: 'Shipment updated successfully' });
});

// ============================================
// UPDATE SHIPMENT STATUS
// Drivers can only update their own shipments.
// ============================================
export const updateStatus = asyncHandler(async (req, res) => {
        const { id } = req.params;
        const { status, location, notes } = req.body;

        const shipment = await get('SELECT * FROM shipments WHERE id = ?', [id]);
        if (!shipment) return res.status(404).json({ error: 'Shipment not found' });

        if (req.user.role === 'driver' && req.driverId && shipment.driver_id !== req.driverId) {
            return res.status(403).json({ error: 'Access denied' });
        }

        let pickupDate = null;
        let deliveryDate = null;
        if (status === 'picked_up') pickupDate = new Date();
        if (status === 'delivered') deliveryDate = new Date();

        await run(
            `UPDATE shipments SET
                status               = ?,
                actual_pickup_date   = COALESCE(?, actual_pickup_date),
                actual_delivery_date = COALESCE(?, actual_delivery_date)
             WHERE id = ?`,
            [status, pickupDate, deliveryDate, id]
        );

        const eventDescriptions = {
            confirmed:  'Shipment confirmed',
            picked_up:  'Cargo picked up from origin',
            in_transit: 'Shipment in transit',
            customs:    'Shipment at customs',
            delivered:  'Shipment delivered successfully',
            cancelled:  'Shipment cancelled',
            returned:   'Shipment returned',
        };

        await run(
            'INSERT INTO shipment_tracking (shipment_id, event_type, event_description, location, notes, recorded_by) VALUES (?, ?, ?, ?, ?, ?)',
            [id, status.toUpperCase(), eventDescriptions[status] || status, location ?? null, notes ?? null, req.user.id]
        );

        if (shipment.driver_id) {
            if (status === 'picked_up') {
                await run("UPDATE drivers SET status = 'on_trip' WHERE id = ?", [shipment.driver_id]);
            } else if (status === 'delivered' || status === 'cancelled') {
                await run("UPDATE drivers SET status = 'available' WHERE id = ?", [shipment.driver_id]);
            }
        }

        await logActivity(req.user.id, 'UPDATE_SHIPMENT_STATUS', 'shipment', id, { status, location });

        res.json({ message: 'Shipment status updated successfully' });
});

// ============================================
// ASSIGN VEHICLE AND DRIVER
// ============================================
export const assignVehicleAndDriver = asyncHandler(async (req, res) => {
        const { id } = req.params;
        const { vehicleId, driverId } = req.body;

        const shipment = await get('SELECT * FROM shipments WHERE id = ?', [id]);
        if (!shipment) return res.status(404).json({ error: 'Shipment not found' });

        // Only super_admin can reassign once shipment is in motion
        const lockedStatuses = ['picked_up', 'in_transit', 'customs', 'delivered'];
        if (lockedStatuses.includes(shipment.status) && req.user.role !== 'super_admin') {
            return res.status(403).json({
                error: `Cannot reassign: shipment is already ${shipment.status.replace(/_/g, ' ')}. Only Super Admin can override.`
            });
        }

        // Validate that selected vehicle is not already on an active shipment
        if (vehicleId) {
            const vehicleConflict = await get(
                `SELECT id FROM shipments WHERE vehicle_id = ? AND id != ? AND status IN ('picked_up','in_transit','customs')`,
                [vehicleId, id]
            );
            if (vehicleConflict) {
                return res.status(400).json({ error: 'This vehicle is already on an active shipment' });
            }
        }

        // Validate that selected driver is not already on an active shipment
        if (driverId) {
            const driverConflict = await get(
                `SELECT id FROM shipments WHERE driver_id = ? AND id != ? AND status IN ('picked_up','in_transit','customs')`,
                [driverId, id]
            );
            if (driverConflict) {
                return res.status(400).json({ error: 'This driver is already on an active shipment' });
            }
        }

        // Free previous driver if being replaced
        if (shipment.driver_id && shipment.driver_id !== driverId) {
            await run("UPDATE drivers SET status = 'available' WHERE id = ?", [shipment.driver_id]);
        }

        const newStatus = (vehicleId && driverId) ? 'confirmed' : shipment.status;

        await run(
            'UPDATE shipments SET vehicle_id = ?, driver_id = ?, status = ? WHERE id = ?',
            [vehicleId ?? null, driverId ?? null, newStatus, id]
        );

        if (driverId) {
            await run("UPDATE drivers SET status = 'on_trip' WHERE id = ?", [driverId]);
        }

        await run(
            'INSERT INTO shipment_tracking (shipment_id, event_type, event_description, recorded_by) VALUES (?, ?, ?, ?)',
            [id, 'VEHICLE_ASSIGNED', 'Vehicle and driver assigned', req.user.id]
        );

        await logActivity(req.user.id, 'ASSIGN_VEHICLE_DRIVER', 'shipment', id, { vehicleId, driverId });

        res.json({ message: 'Vehicle and driver assigned successfully' });
});

// ============================================
// DELETE SHIPMENT
// ============================================
export const deleteShipment = asyncHandler(async (req, res) => {
        const { id } = req.params;

        const shipment = await get('SELECT * FROM shipments WHERE id = ?', [id]);
        if (!shipment) return res.status(404).json({ error: 'Shipment not found' });

        if (shipment.status !== 'pending' && shipment.status !== 'cancelled') {
            return res.status(400).json({ error: 'Cannot delete an active shipment' });
        }

        await run('DELETE FROM shipments WHERE id = ?', [id]);

        await logActivity(req.user.id, 'DELETE_SHIPMENT', 'shipment', id, null, shipment);

        res.json({ message: 'Shipment deleted successfully' });
});

// ============================================
// PUBLIC TRACK BY TRACKING NUMBER
// ============================================
export const trackShipment = asyncHandler(async (req, res) => {
        const { trackingNumber } = req.params;

        // Accept both the short tracking code (TRK...) and the full shipment number (RWB-YYYY-NNN)
        const shipment = await get(
            `SELECT s.*,
                    c.company_name as customer_name,
                    CONCAT(e.first_name, ' ', e.last_name) as driver_name,
                    v.plate_number as vehicle_plate
             FROM shipments s
             JOIN customers c ON c.id = s.customer_id
             LEFT JOIN drivers d ON d.id = s.driver_id
             LEFT JOIN employees e ON e.id = d.employee_id
             LEFT JOIN vehicles v ON v.id = s.vehicle_id
             WHERE s.tracking_number = ? OR s.shipment_number = ?`,
            [trackingNumber, trackingNumber]
        );

        if (!shipment) return res.status(404).json({ error: 'Shipment not found' });

        const tracking = await query(
            `SELECT st.*, CONCAT(u.first_name, ' ', u.last_name) as recorded_by_name
             FROM shipment_tracking st
             LEFT JOIN users u ON u.id = st.recorded_by
             WHERE st.shipment_id = ?
             ORDER BY st.event_time DESC`,
            [shipment.id]
        );

        res.json({
            shipment: {
                shipmentNumber:    shipment.shipment_number,
                trackingNumber:    shipment.tracking_number,
                status:            shipment.status,
                origin:            `${shipment.origin_city}, ${shipment.origin_country}`,
                destination:       `${shipment.destination_city}, ${shipment.destination_country}`,
                cargoType:         shipment.cargo_type,
                estimatedDelivery: shipment.requested_delivery_date,
            },
            tracking,
        });
});

// ============================================
// SHIPMENT STATS
// ============================================
export const getShipmentStats = asyncHandler(async (req, res) => {
        const { period = 'month' } = req.query;

        let dateFilter = '';
        if (period === 'month')   dateFilter = "DATE_FORMAT(created_at, '%Y-%m') = DATE_FORMAT(NOW(), '%Y-%m')";
        else if (period === 'quarter') dateFilter = "QUARTER(created_at) = QUARTER(NOW()) AND YEAR(created_at) = YEAR(NOW())";
        else if (period === 'year')    dateFilter = "YEAR(created_at) = YEAR(NOW())";
        else dateFilter = '1=1';

        const [byStatus, byTransportMode, topRoutes, monthlyTrend] = await Promise.all([
            query(`SELECT status, COUNT(*) as count FROM shipments WHERE ${dateFilter} GROUP BY status`),
            query(`SELECT transport_mode, COUNT(*) as count FROM shipments WHERE ${dateFilter} GROUP BY transport_mode`),
            query(`SELECT CONCAT(origin_city, ' - ', destination_city) as route, COUNT(*) as count
                   FROM shipments WHERE ${dateFilter}
                   GROUP BY origin_city, destination_city
                   ORDER BY count DESC LIMIT 10`),
            query(`SELECT DATE_FORMAT(created_at, '%Y-%m') as month, COUNT(*) as count, SUM(final_amount) as revenue
                   FROM shipments WHERE status = 'delivered'
                   GROUP BY DATE_FORMAT(created_at, '%Y-%m')
                   ORDER BY month DESC LIMIT 12`),
        ]);

        res.json({ byStatus, byTransportMode, topRoutes, monthlyTrend });
});

// ============================================
// APPROVAL WORKFLOW
// ============================================
export const submitForApproval = asyncHandler(async (req, res) => {
        const { id } = req.params;
        const shipment = await get('SELECT * FROM shipments WHERE id = ?', [id]);
        if (!shipment) return res.status(404).json({ error: 'Shipment not found' });

        if (shipment.approval_status !== 'draft' && shipment.approval_status !== 'rejected') {
            return res.status(400).json({ error: 'Shipment is not in a submittable state' });
        }

        await run(
            "UPDATE shipments SET approval_status = 'pending_approval' WHERE id = ?",
            [id]
        );

        await run(
            'INSERT INTO shipment_tracking (shipment_id, event_type, event_description, recorded_by) VALUES (?, ?, ?, ?)',
            [id, 'SUBMITTED_FOR_APPROVAL', 'Shipment submitted for approval', req.user.id]
        );

        res.json({ message: 'Shipment submitted for approval' });
});

export const approveShipment = asyncHandler(async (req, res) => {
        const { id } = req.params;
        const shipment = await get('SELECT * FROM shipments WHERE id = ?', [id]);
        if (!shipment) return res.status(404).json({ error: 'Shipment not found' });

        await run(
            "UPDATE shipments SET approval_status = 'approved', approved_by = ?, approved_at = NOW(), status = 'confirmed' WHERE id = ?",
            [req.user.id, id]
        );

        await run(
            'INSERT INTO shipment_tracking (shipment_id, event_type, event_description, recorded_by) VALUES (?, ?, ?, ?)',
            [id, 'APPROVED', 'Shipment approved and confirmed', req.user.id]
        );

        res.json({ message: 'Shipment approved successfully' });
});

export const rejectShipment = asyncHandler(async (req, res) => {
        const { id } = req.params;
        const reason = req.body.rejection_reason || req.body.reason || null;
        const shipment = await get('SELECT * FROM shipments WHERE id = ?', [id]);
        if (!shipment) return res.status(404).json({ error: 'Shipment not found' });

        await run(
            "UPDATE shipments SET approval_status = 'rejected', rejection_reason = ? WHERE id = ?",
            [reason, id]
        );

        await run(
            'INSERT INTO shipment_tracking (shipment_id, event_type, event_description, recorded_by) VALUES (?, ?, ?, ?)',
            [id, 'REJECTED', `Shipment rejected: ${reason}`, req.user.id]
        );

        res.json({ message: 'Shipment rejected' });
});

// ============================================
// UPLOAD SHIPMENT DOCUMENT (POD etc.)
// Role-based document type permissions:
//   driver     → pod only (on their own shipment)
//   dispatcher → pod, bill_of_lading, packing_list, customs_clearance, other
//   admin/super → all types including invoice, insurance
// ============================================
const DOC_TYPE_PERMISSIONS = {
    pod:               ['super_admin', 'admin', 'dispatcher', 'driver'],
    bill_of_lading:    ['super_admin', 'admin', 'dispatcher'],
    packing_list:      ['super_admin', 'admin', 'dispatcher'],
    customs_clearance: ['super_admin', 'admin', 'dispatcher'],
    invoice:           ['super_admin', 'admin'],
    insurance:         ['super_admin', 'admin'],
    other:             ['super_admin', 'admin', 'dispatcher'],
};

export const uploadDocument = asyncHandler(async (req, res) => {
        const { id } = req.params;
        const { documentType, notes } = req.body;
        const docType = documentType || 'other';

        const shipment = await get('SELECT * FROM shipments WHERE id = ?', [id]);
        if (!shipment) return res.status(404).json({ error: 'Shipment not found' });

        // Driver can only upload on their own shipment
        if (req.user.role === 'driver') {
            if (req.driverId && shipment.driver_id !== req.driverId) {
                return res.status(403).json({ error: 'You can only upload documents for your own shipments' });
            }
            if (docType !== 'pod') {
                return res.status(403).json({ error: 'Drivers can only upload Proof of Delivery' });
            }
        }

        // Check doc type permission
        const allowed = DOC_TYPE_PERMISSIONS[docType] || ['super_admin', 'admin'];
        if (!allowed.includes(req.user.role)) {
            return res.status(403).json({ error: `Your role cannot upload document type: ${docType}` });
        }

        if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

        // Store relative path: {shipmentId}/{docType}/{filename}
        // req.file.path is absolute; derive relative from shipment_documents base
        const relativePath = `${id}/${docType}/${req.file.filename}`;
        const docName = req.file.originalname;

        const result = await run(
            `INSERT INTO shipment_documents
                (shipment_id, document_type, document_name, file_path, uploaded_by, notes)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [id, docType, docName, relativePath, req.user.id, notes ?? null]
        );

        await logActivity(req.user.id, 'UPLOAD_DOCUMENT', 'shipment', id,
            { docType, docName, relativePath });

        res.status(201).json({
            id: result.id,
            documentType: docType,
            documentName: docName,
            filePath: relativePath,
            message: 'Document uploaded successfully',
        });
});

// ============================================
// DELETE SHIPMENT DOCUMENT
// ============================================
export const deleteDocument = asyncHandler(async (req, res) => {
        const { id, docId } = req.params;

        const doc = await get(
            'SELECT * FROM shipment_documents WHERE id = ? AND shipment_id = ?',
            [docId, id]
        );
        if (!doc) return res.status(404).json({ error: 'Document not found' });

        // Drivers CANNOT delete documents — POD is a legal record
        // Only admin/super_admin can delete any document
        if (req.user.role === 'driver') {
            return res.status(403).json({ error: 'Drivers cannot delete documents. Contact admin.' });
        }
        // Dispatcher can delete their own non-POD uploads only
        if (req.user.role === 'dispatcher') {
            if (doc.document_type === 'pod') {
                return res.status(403).json({ error: 'POD documents cannot be deleted by dispatchers' });
            }
            if (doc.uploaded_by !== req.user.id) {
                return res.status(403).json({ error: 'You can only delete your own uploads' });
            }
        }
        // Admin and super_admin can delete anything

        await run('DELETE FROM shipment_documents WHERE id = ?', [docId]);

        res.json({ message: 'Document deleted' });
});
