import { query, get, run } from '../database/db.js';

function generateInvoiceNumber() {
    const d = new Date();
    return `INV-${d.getFullYear().toString().slice(-2)}${String(d.getMonth()+1).padStart(2,'0')}-${Math.floor(10000+Math.random()*90000)}`;
}
function generatePaymentNumber() {
    const d = new Date();
    return `PAY-${d.getFullYear().toString().slice(-2)}${String(d.getMonth()+1).padStart(2,'0')}-${Math.floor(1000+Math.random()*9000)}`;
}
function generateExpenseNumber() {
    const d = new Date();
    return `EXP-${d.getFullYear().toString().slice(-2)}${String(d.getMonth()+1).padStart(2,'0')}-${Math.floor(1000+Math.random()*9000)}`;
}

// ============================================
// INVOICES
// ============================================
export async function getAllInvoices(req, res) {
    try {
        const { status, customer, from, to, search } = req.query;
        let sql = `
            SELECT i.*, c.company_name as customer_name, s.shipment_number
            FROM invoices i
            JOIN customers c ON c.id = i.customer_id
            LEFT JOIN shipments s ON s.id = i.shipment_id
            WHERE 1=1
        `;
        const params = [];

        if (status)   { sql += ' AND i.status = ?';                       params.push(status); }
        if (customer) { sql += ' AND i.customer_id = ?';                  params.push(customer); }
        if (from)     { sql += ' AND DATE(i.invoice_date) >= ?';          params.push(from); }
        if (to)       { sql += ' AND DATE(i.invoice_date) <= ?';          params.push(to); }
        if (search) {
            sql += ' AND (i.invoice_number LIKE ? OR c.company_name LIKE ?)';
            params.push(`%${search}%`, `%${search}%`);
        }

        sql += ' GROUP BY i.id ORDER BY i.created_at DESC';

        const invoices = await query(sql, params);
        res.json(invoices);
    } catch (error) {
        console.error('Get invoices error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}

export async function getInvoiceById(req, res) {
    try {
        const { id } = req.params;

        const invoice = await get(
            `SELECT i.*, c.company_name as customer_name, c.address as customer_address,
                    c.tax_number as customer_tax_number, s.shipment_number
             FROM invoices i
             JOIN customers c ON c.id = i.customer_id
             LEFT JOIN shipments s ON s.id = i.shipment_id
             WHERE i.id = ?`,
            [id]
        );

        if (!invoice) return res.status(404).json({ error: 'Invoice not found' });

        const items = await query('SELECT * FROM invoice_items WHERE invoice_id = ?', [id]);

        const payments = await query(
            `SELECT p.*, CONCAT(u.first_name, ' ', u.last_name) as received_by_name
             FROM payments p
             LEFT JOIN users u ON u.id = p.received_by
             WHERE p.invoice_id = ?
             ORDER BY p.payment_date DESC`,
            [id]
        );

        res.json({ ...invoice, items, payments });
    } catch (error) {
        console.error('Get invoice error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}

export async function createInvoice(req, res) {
    try {
        const { customerId, shipmentId, invoiceDate, dueDate, items, notes, paymentTerms } = req.body;

        let subtotal = 0;
        items.forEach(item => { subtotal += item.quantity * item.unitPrice; });

        const taxSetting = await get("SELECT setting_value FROM settings WHERE setting_key = 'tax_rate'");
        const taxRate    = parseFloat(taxSetting?.setting_value || 15);
        const taxAmount  = subtotal * (taxRate / 100);
        const total      = subtotal + taxAmount;
        const invoiceNumber = generateInvoiceNumber();

        const result = await run(
            `INSERT INTO invoices (
                invoice_number, shipment_id, customer_id, invoice_date, due_date,
                subtotal, tax_amount, total_amount, balance_due, payment_terms, notes, created_by
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [invoiceNumber, shipmentId, customerId, invoiceDate, dueDate,
             subtotal, taxAmount, total, total, paymentTerms || 30, notes, req.user.id]
        );

        for (const item of items) {
            await run(
                'INSERT INTO invoice_items (invoice_id, description, quantity, unit, unit_price, total_price) VALUES (?, ?, ?, ?, ?, ?)',
                [result.id, item.description, item.quantity, item.unit, item.unitPrice, item.quantity * item.unitPrice]
            );
        }

        await run(
            'INSERT INTO activity_logs (user_id, action, entity_type, entity_id, new_values) VALUES (?, ?, ?, ?, ?)',
            [req.user.id, 'CREATE_INVOICE', 'invoice', result.id, JSON.stringify({ invoiceNumber, customerId, total })]
        );

        res.status(201).json({ id: result.id, invoiceNumber, message: 'Invoice created successfully' });
    } catch (error) {
        console.error('Create invoice error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}

export async function updateInvoiceStatus(req, res) {
    try {
        const { id }     = req.params;
        const { status } = req.body;
        await run('UPDATE invoices SET status = ? WHERE id = ?', [status, id]);
        res.json({ message: 'Invoice status updated successfully' });
    } catch (error) {
        console.error('Update invoice status error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}

// ============================================
// PAYMENTS
// ============================================
export async function getAllPayments(req, res) {
    try {
        const { customer, from, to } = req.query;
        let sql = `
            SELECT p.*, c.company_name as customer_name, i.invoice_number
            FROM payments p
            JOIN customers c ON c.id = p.customer_id
            LEFT JOIN invoices i ON i.id = p.invoice_id
            WHERE 1=1
        `;
        const params = [];

        if (customer) { sql += ' AND p.customer_id = ?';          params.push(customer); }
        if (from)     { sql += ' AND DATE(p.payment_date) >= ?';  params.push(from); }
        if (to)       { sql += ' AND DATE(p.payment_date) <= ?';  params.push(to); }

        sql += ' ORDER BY p.created_at DESC';
        const payments = await query(sql, params);
        res.json(payments);
    } catch (error) {
        console.error('Get payments error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}

export async function createPayment(req, res) {
    try {
        const { invoiceId, customerId, paymentDate, amount, paymentMethod, referenceNumber, bankName, notes } = req.body;
        const paymentNumber = generatePaymentNumber();

        const result = await run(
            `INSERT INTO payments (
                payment_number, invoice_id, customer_id, payment_date, amount,
                payment_method, reference_number, bank_name, notes, received_by
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [paymentNumber, invoiceId, customerId, paymentDate, amount,
             paymentMethod, referenceNumber, bankName, notes, req.user.id]
        );

        if (invoiceId) {
            const invoice   = await get('SELECT * FROM invoices WHERE id = ?', [invoiceId]);
            if (invoice) {
                const totalPaid = await get('SELECT SUM(amount) as total FROM payments WHERE invoice_id = ?', [invoiceId]);
                const paid      = totalPaid?.total || 0;
                const balance   = Math.max(0, invoice.total_amount - paid);
                const newStatus = balance <= 0 ? 'paid' : 'partial';
                await run(
                    'UPDATE invoices SET paid_amount = ?, balance_due = ?, status = ? WHERE id = ?',
                    [paid, balance, newStatus, invoiceId]
                );
            }
        }

        await run(
            'INSERT INTO activity_logs (user_id, action, entity_type, entity_id, new_values) VALUES (?, ?, ?, ?, ?)',
            [req.user.id, 'CREATE_PAYMENT', 'payment', result.id, JSON.stringify({ paymentNumber, amount, paymentMethod })]
        );

        res.status(201).json({ id: result.id, paymentNumber, message: 'Payment recorded successfully' });
    } catch (error) {
        console.error('Create payment error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}

// ============================================
// EXPENSES
// ============================================
export async function getAllExpenses(req, res) {
    try {
        const { status, category, vehicle, driver, from, to } = req.query;
        let sql = `
            SELECT e.*,
                   v.plate_number as vehicle_plate,
                   CONCAT(emp.first_name, ' ', emp.last_name) as driver_name,
                   CONCAT(u.first_name,   ' ', u.last_name)   as created_by_name
            FROM expenses e
            LEFT JOIN vehicles  v   ON v.id   = e.vehicle_id
            LEFT JOIN drivers   d   ON d.id   = e.driver_id
            LEFT JOIN employees emp ON emp.id = d.employee_id
            LEFT JOIN users     u   ON u.id   = e.created_by
            WHERE 1=1
        `;
        const params = [];

        if (status)   { sql += ' AND e.status = ?';                   params.push(status); }
        if (category) { sql += ' AND e.category = ?';                 params.push(category); }
        if (vehicle)  { sql += ' AND e.vehicle_id = ?';               params.push(vehicle); }
        if (driver)   { sql += ' AND e.driver_id = ?';                params.push(driver); }
        if (from)     { sql += ' AND DATE(e.expense_date) >= ?';      params.push(from); }
        if (to)       { sql += ' AND DATE(e.expense_date) <= ?';      params.push(to); }

        sql += ' ORDER BY e.created_at DESC';
        const expenses = await query(sql, params);
        res.json(expenses);
    } catch (error) {
        console.error('Get expenses error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}

export async function createExpense(req, res) {
    try {
        const { expenseDate, category, description, amount, vehicleId, driverId, shipmentId, vendorName, receiptNumber, paymentMethod } = req.body;
        const expenseNumber = generateExpenseNumber();

        // MySQL2 rejects undefined — coerce optional fields to null
        const result = await run(
            `INSERT INTO expenses (
                expense_number, expense_date, category, description, amount,
                vehicle_id, driver_id, shipment_id, vendor_name, receipt_number,
                payment_method, created_by
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [expenseNumber, expenseDate, category, description, amount,
             vehicleId ?? null, driverId ?? null, shipmentId ?? null,
             vendorName ?? null, receiptNumber ?? null, paymentMethod ?? null, req.user.id]
        );

        await run(
            'INSERT INTO activity_logs (user_id, action, entity_type, entity_id, new_values) VALUES (?, ?, ?, ?, ?)',
            [req.user.id, 'CREATE_EXPENSE', 'expense', result.id, JSON.stringify({ expenseNumber, category, amount })]
        );

        res.status(201).json({ id: result.id, expenseNumber, message: 'Expense created successfully' });
    } catch (error) {
        console.error('Create expense error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}

export async function approveExpense(req, res) {
    try {
        const { id }     = req.params;
        const { status } = req.body;
        await run('UPDATE expenses SET status = ?, approved_by = ? WHERE id = ?', [status, req.user.id, id]);
        res.json({ message: 'Expense status updated successfully' });
    } catch (error) {
        console.error('Approve expense error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}

// ============================================
// FINANCIAL SUMMARY
// ============================================
export async function getFinancialSummary(req, res) {
    try {
        const { period = 'month' } = req.query;

        let invFilter = '';
        let expFilter = '';
        if (period === 'month') {
            invFilter = "DATE_FORMAT(invoice_date, '%Y-%m') = DATE_FORMAT(NOW(), '%Y-%m')";
            expFilter = "DATE_FORMAT(expense_date, '%Y-%m') = DATE_FORMAT(NOW(), '%Y-%m')";
        } else if (period === 'quarter') {
            invFilter = "QUARTER(invoice_date) = QUARTER(NOW()) AND YEAR(invoice_date) = YEAR(NOW())";
            expFilter = "QUARTER(expense_date) = QUARTER(NOW()) AND YEAR(expense_date) = YEAR(NOW())";
        } else if (period === 'year') {
            invFilter = "YEAR(invoice_date) = YEAR(NOW())";
            expFilter = "YEAR(expense_date) = YEAR(NOW())";
        } else {
            invFilter = '1=1';
            expFilter = '1=1';
        }

        const [revenue, expensesByCategory, outstandingInvoices, agedReceivables, monthlyData] = await Promise.all([
            get(`SELECT
                    SUM(total_amount)  as total_invoiced,
                    SUM(paid_amount)   as total_collected,
                    SUM(balance_due)   as total_outstanding
                 FROM invoices WHERE ${invFilter}`),
            query(`SELECT category, SUM(amount) as total_expenses, COUNT(*) as count
                   FROM expenses WHERE status = 'approved' AND ${expFilter}
                   GROUP BY category`),
            query(`SELECT i.*, c.company_name as customer_name
                   FROM invoices i
                   JOIN customers c ON c.id = i.customer_id
                   WHERE i.status IN ('sent','partial','overdue')
                   ORDER BY i.due_date ASC LIMIT 10`),
            query(`SELECT
                    CASE
                        WHEN DATEDIFF(CURDATE(), due_date) <= 0  THEN 'Current'
                        WHEN DATEDIFF(CURDATE(), due_date) <= 30 THEN '1-30 days'
                        WHEN DATEDIFF(CURDATE(), due_date) <= 60 THEN '31-60 days'
                        WHEN DATEDIFF(CURDATE(), due_date) <= 90 THEN '61-90 days'
                        ELSE '90+ days'
                    END as aging_bucket,
                    SUM(balance_due) as amount,
                    COUNT(*) as invoice_count
                   FROM invoices
                   WHERE status IN ('sent','partial','overdue')
                   GROUP BY aging_bucket
                   ORDER BY MIN(DATEDIFF(CURDATE(), due_date))`),
            query(`SELECT
                    inv.month,
                    inv.revenue,
                    COALESCE(exp.expenses, 0) as expenses
                   FROM (
                     SELECT DATE_FORMAT(invoice_date, '%Y-%m') as month,
                            SUM(total_amount) as revenue
                     FROM invoices
                     GROUP BY DATE_FORMAT(invoice_date, '%Y-%m')
                   ) inv
                   LEFT JOIN (
                     SELECT DATE_FORMAT(expense_date, '%Y-%m') as month,
                            SUM(amount) as expenses
                     FROM expenses
                     WHERE status = 'approved'
                     GROUP BY DATE_FORMAT(expense_date, '%Y-%m')
                   ) exp ON exp.month = inv.month
                   ORDER BY inv.month DESC LIMIT 12`),
        ]);

        res.json({ revenue, expensesByCategory, outstandingInvoices, agedReceivables, monthlyData });
    } catch (error) {
        console.error('Get financial summary error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}

// ============================================
// DELIVERABLE SHIPMENTS (for invoice creation)
// ============================================
export async function getDeliverableShipments(req, res) {
    try {
        const shipments = await query(
            `SELECT s.id, s.shipment_number, s.final_amount, s.quoted_amount,
                    s.origin_city, s.destination_city, s.cargo_type,
                    s.actual_delivery_date, s.transport_mode,
                    c.id as customer_id, c.company_name as customer_name
             FROM shipments s
             JOIN customers c ON c.id = s.customer_id
             WHERE s.status = 'delivered'
               AND s.id NOT IN (SELECT shipment_id FROM invoices WHERE shipment_id IS NOT NULL)
             ORDER BY s.actual_delivery_date DESC`
        );
        res.json(shipments);
    } catch (error) {
        console.error('Get deliverable shipments error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}

// ============================================
// COMPANY SETTINGS (for PDF invoice header)
// ============================================
export async function getCompanySettings(req, res) {
    try {
        const rows = await query(
            "SELECT setting_key, setting_value FROM settings WHERE setting_group IN ('company','finance')"
        );
        const settings = {};
        rows.forEach(r => { settings[r.setting_key] = r.setting_value; });
        res.json(settings);
    } catch (error) {
        console.error('Get company settings error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}
