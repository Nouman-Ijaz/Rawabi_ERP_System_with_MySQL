import { asyncHandler, httpError } from '../middleware/asyncHandler.js';
import { query, get, run } from '../database/db.js';
import { generateCode, logActivity } from '../utils/helpers.js';

// Get all customers with optional filters
export const getAllCustomers = asyncHandler(async (req, res) => {
        const { status, type, search, page = 1, limit = 50 } = req.query;
        
        let sql = `
            SELECT c.*, 
                   COUNT(DISTINCT s.id) as total_shipments,
                   SUM(CASE WHEN s.status = 'delivered' THEN 1 ELSE 0 END) as completed_shipments,
                   SUM(s.final_amount) as total_revenue
            FROM customers c
            LEFT JOIN shipments s ON s.customer_id = c.id
            WHERE 1=1
        `;
        const params = [];

        if (status) {
            sql += ' AND c.status = ?';
            params.push(status);
        }

        if (type) {
            sql += ' AND c.customer_type = ?';
            params.push(type);
        }

        if (search) {
            sql += ` AND (
                c.company_name LIKE ? OR 
                c.contact_person LIKE ? OR 
                c.email LIKE ? OR 
                c.customer_code LIKE ? OR
                c.city LIKE ?
            )`;
            const searchTerm = `%${search}%`;
            params.push(searchTerm, searchTerm, searchTerm, searchTerm, searchTerm);
        }

        sql += ' GROUP BY c.id ORDER BY c.created_at DESC';
        
        // Add pagination
        const offset = (parseInt(page) - 1) * parseInt(limit);
        sql += ` LIMIT ${parseInt(limit)} OFFSET ${offset}`;

        const customers = await query(sql, params);
        
        // Get total count
        let countSql = 'SELECT COUNT(*) as total FROM customers WHERE 1=1';
        const countParams = [];
        if (status) {
            countSql += ' AND status = ?';
            countParams.push(status);
        }
        if (type) {
            countSql += ' AND customer_type = ?';
            countParams.push(type);
        }
        if (search) {
            countSql += ` AND (company_name LIKE ? OR contact_person LIKE ? OR email LIKE ?)`;
            countParams.push(`%${search}%`, `%${search}%`, `%${search}%`);
        }
        const countResult = await get(countSql, countParams);

        res.json({
            data: customers,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: countResult.total,
                totalPages: Math.ceil(countResult.total / parseInt(limit))
            }
        });
});

// Get customer by ID
export const getCustomerById = asyncHandler(async (req, res) => {
        const { id } = req.params;
        
        const customer = await get(
            'SELECT * FROM customers WHERE id = ?',
            [id]
        );

        if (!customer) {
            return res.status(404).json({ error: 'Customer not found' });
        }

        // Get contacts
        const contacts = await query(
            'SELECT * FROM customer_contacts WHERE customer_id = ?',
            [id]
        );

        // Get shipment history
        const shipments = await query(
            `SELECT s.*, 
                    d.id as driver_id, CONCAT(e.first_name, ' ', e.last_name) as driver_name,
                    v.plate_number as vehicle_plate
             FROM shipments s
             LEFT JOIN drivers d ON d.id = s.driver_id
             LEFT JOIN employees e ON e.id = d.employee_id
             LEFT JOIN vehicles v ON v.id = s.vehicle_id
             WHERE s.customer_id = ?
             ORDER BY s.created_at DESC LIMIT 20`,
            [id]
        );

        // Get invoices
        const invoices = await query(
            `SELECT i.*, 
                    SUM(p.amount) as paid_amount
             FROM invoices i
             LEFT JOIN payments p ON p.invoice_id = i.id
             WHERE i.customer_id = ?
             GROUP BY i.id
             ORDER BY i.invoice_date DESC LIMIT 20`,
            [id]
        );

        // Get statistics
        const stats = await get(
            `SELECT 
                COUNT(*) as total_shipments,
                SUM(CASE WHEN status = 'delivered' THEN 1 ELSE 0 END) as completed_shipments,
                SUM(final_amount) as total_revenue,
                AVG(CASE WHEN actual_delivery_date IS NOT NULL 
                    THEN DATEDIFF(actual_delivery_date, requested_delivery_date) 
                    END) as avg_delivery_performance
             FROM shipments
             WHERE customer_id = ?`,
            [id]
        );

        res.json({
            ...customer,
            contacts,
            shipments,
            invoices,
            stats
        });
});

// Create customer
export const createCustomer = asyncHandler(async (req, res) => {
        const {
            companyName, contactPerson, email, phone, mobile, address, city, country,
            taxNumber, crNumber, creditLimit, paymentTerms, customerType, notes
        } = req.body;

        // Check if email exists
        const existing = await get('SELECT id FROM customers WHERE email = ?', [email]);
        if (existing) {
            return res.status(400).json({ error: 'Email already exists' });
        }

        const customerCode = generateCode('CUST');

        const result = await run(
            `INSERT INTO customers (
                customer_code, company_name, contact_person, email, phone, mobile,
                address, city, country, tax_number, cr_number, credit_limit,
                payment_terms, customer_type, created_by
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                customerCode, companyName, contactPerson, email, phone, mobile,
                address, city, COALESCE(country, 'Saudi Arabia'), taxNumber, crNumber,
                creditLimit || 0, paymentTerms || 30, customerType || 'regular', req.user.id
            ]
        );

        await logActivity(req.user.id, 'CREATE_CUSTOMER', 'customer', result.id, { companyName, contactPerson, email });

        res.status(201).json({
            id: result.id,
            customerCode,
            message: 'Customer created successfully'
        });
});

// Update customer
export const updateCustomer = asyncHandler(async (req, res) => {
        const { id } = req.params;
        const updates = req.body;

        const customer = await get('SELECT * FROM customers WHERE id = ?', [id]);
        if (!customer) {
            return res.status(404).json({ error: 'Customer not found' });
        }

        await run(
            `UPDATE customers SET
                company_name = COALESCE(?, company_name),
                contact_person = COALESCE(?, contact_person),
                email = COALESCE(?, email),
                phone = COALESCE(?, phone),
                mobile = COALESCE(?, mobile),
                address = COALESCE(?, address),
                city = COALESCE(?, city),
                country = COALESCE(?, country),
                tax_number = COALESCE(?, tax_number),
                cr_number = COALESCE(?, cr_number),
                credit_limit = COALESCE(?, credit_limit),
                payment_terms = COALESCE(?, payment_terms),
                customer_type = COALESCE(?, customer_type),
                status = COALESCE(?, status)
             WHERE id = ?`,
            [
                updates.companyName, updates.contactPerson, updates.email, updates.phone,
                updates.mobile, updates.address, updates.city, updates.country,
                updates.taxNumber, updates.crNumber, updates.creditLimit, updates.paymentTerms,
                updates.customerType, updates.status, id
            ]
        );

        await logActivity(req.user.id, 'UPDATE_CUSTOMER', 'customer', id, updates, customer);

        res.json({ message: 'Customer updated successfully' });
});

// Delete customer
export const deleteCustomer = asyncHandler(async (req, res) => {
        const { id } = req.params;

        const customer = await get('SELECT * FROM customers WHERE id = ?', [id]);
        if (!customer) {
            return res.status(404).json({ error: 'Customer not found' });
        }

        // Check if customer has shipments
        const shipments = await get('SELECT COUNT(*) as count FROM shipments WHERE customer_id = ?', [id]);
        if (shipments.count > 0) {
            return res.status(400).json({ error: 'Cannot delete customer with existing shipments' });
        }

        await run('DELETE FROM customers WHERE id = ?', [id]);

        await logActivity(req.user.id, 'DELETE_CUSTOMER', 'customer', id, null, customer);

        res.json({ message: 'Customer deleted successfully' });
});

// Add contact
export const addContact = asyncHandler(async (req, res) => {
        const { id } = req.params;
        const { name, position, email, phone, isPrimary } = req.body;

        const customer = await get('SELECT id FROM customers WHERE id = ?', [id]);
        if (!customer) {
            return res.status(404).json({ error: 'Customer not found' });
        }

        // If setting as primary, unset other primary contacts
        if (isPrimary) {
            await run(
                'UPDATE customer_contacts SET is_primary = 0 WHERE customer_id = ?',
                [id]
            );
        }

        const result = await run(
            'INSERT INTO customer_contacts (customer_id, name, position, email, phone, is_primary) VALUES (?, ?, ?, ?, ?, ?)',
            [id, name, position, email, phone, isPrimary ? 1 : 0]
        );

        res.status(201).json({
            id: result.id,
            message: 'Contact added successfully'
        });
});

// Update contact
export const updateContact = asyncHandler(async (req, res) => {
        const { id, contactId } = req.params;
        const { name, position, email, phone, isPrimary } = req.body;

        // If setting as primary, unset other primary contacts
        if (isPrimary) {
            await run(
                'UPDATE customer_contacts SET is_primary = 0 WHERE customer_id = ? AND id != ?',
                [id, contactId]
            );
        }

        await run(
            'UPDATE customer_contacts SET name = ?, position = ?, email = ?, phone = ?, is_primary = ? WHERE id = ? AND customer_id = ?',
            [name, position, email, phone, isPrimary ? 1 : 0, contactId, id]
        );

        res.json({ message: 'Contact updated successfully' });
});

// Delete contact
export const deleteContact = asyncHandler(async (req, res) => {
        const { id, contactId } = req.params;

        await run(
            'DELETE FROM customer_contacts WHERE id = ? AND customer_id = ?',
            [contactId, id]
        );

        res.json({ message: 'Contact deleted successfully' });
});

// Get customer summary
export const getCustomerSummary = asyncHandler(async (req, res) => {
        const byType = await query('SELECT customer_type, COUNT(*) as count FROM customers GROUP BY customer_type');
        const byStatus = await query('SELECT status, COUNT(*) as count FROM customers GROUP BY status');
        
        // Top customers by revenue
        const topCustomers = await query(
            `SELECT c.id, c.company_name, c.customer_type, SUM(s.final_amount) as total_revenue
             FROM customers c
             JOIN shipments s ON s.customer_id = c.id
             WHERE s.status = 'delivered'
             GROUP BY c.id
             ORDER BY total_revenue DESC LIMIT 10`
        );

        res.json({
            byType,
            byStatus,
            topCustomers
        });
});
