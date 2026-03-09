import { asyncHandler } from '../middleware/asyncHandler.js';
import { query, get, run } from '../database/db.js';
import { getPublicUrl } from '../config/multer.js';

// n() — converts undefined or empty string to null so MySQL2 never receives undefined
const n = (v) => (v !== undefined && v !== '' && v !== null) ? v : null;

function generateEmployeeCode() {
    return 'EMP-' + Date.now().toString(36).toUpperCase().slice(-6);
}

// ── GET ALL ────────────────────────────────────────────────────────────
export const getAllEmployees = asyncHandler(async (req, res) => {
        const {
            status, department, search, employment_type,
            sort = 'created_at', dir = 'DESC',
            page = 1, limit = 50
        } = req.query;

        const allowedSorts = {
            created_at: 'e.created_at',
            hire_date: 'e.hire_date',
            first_name: 'e.first_name',
            salary: 'e.salary',
            performance_rating: 'e.performance_rating',
        };
        const sortCol = allowedSorts[sort] || 'e.created_at';
        const sortDir = dir === 'ASC' ? 'ASC' : 'DESC';

        let sql = `
            SELECT
                e.*,
                TIMESTAMPDIFF(YEAR, e.hire_date, CURDATE())             AS years_of_service,
                TIMESTAMPDIFF(YEAR, e.date_of_birth, CURDATE())         AS age,
                CONCAT(COALESCE(m.first_name,''), ' ', COALESCE(m.last_name,'')) AS manager_name,
                u.email                                                 AS user_email,
                DATEDIFF(e.id_expiry,              CURDATE())           AS id_days_left,
                DATEDIFF(e.visa_expiry,            CURDATE())           AS visa_days_left,
                DATEDIFF(e.passport_expiry,        CURDATE())           AS passport_days_left,
                DATEDIFF(e.work_permit_expiry,     CURDATE())           AS permit_days_left,
                DATEDIFF(e.medical_insurance_expiry, CURDATE())         AS insurance_days_left
            FROM employees e
            LEFT JOIN employees m ON m.id = e.manager_id
            LEFT JOIN users u     ON u.id = e.user_id
            WHERE 1=1
        `;
        const params = [];

        if (status)           { sql += ' AND e.status = ?';           params.push(status); }
        if (department)       { sql += ' AND LOWER(e.department) = LOWER(?)'; params.push(department); }
        if (employment_type)  { sql += ' AND e.employment_type = ?';  params.push(employment_type); }
        if (search) {
            sql += ` AND (
                e.first_name LIKE ? OR e.last_name LIKE ? OR e.employee_code LIKE ?
                OR e.email LIKE ? OR e.position LIKE ? OR e.nationality LIKE ?
                OR e.id_number LIKE ? OR e.phone LIKE ?
            )`;
            const s = `%${search}%`;
            params.push(s, s, s, s, s, s, s, s);
        }

        sql += ` ORDER BY ${sortCol} ${sortDir}`;

        const offset = (parseInt(page) - 1) * parseInt(limit);
        sql += ` LIMIT ${parseInt(limit)} OFFSET ${offset}`;

        const employees = await query(sql, params);

        let cSql = 'SELECT COUNT(*) as total FROM employees e WHERE 1=1';
        const cp = [];
        if (status)          { cSql += ' AND e.status = ?';           cp.push(status); }
        if (department)      { cSql += ' AND LOWER(e.department) = LOWER(?)'; cp.push(department); }
        if (employment_type) { cSql += ' AND e.employment_type = ?';  cp.push(employment_type); }
        if (search) {
            cSql += ` AND (e.first_name LIKE ? OR e.last_name LIKE ? OR e.employee_code LIKE ?)`;
            cp.push(`%${search}%`, `%${search}%`, `%${search}%`);
        }
        const countResult = await get(cSql, cp);

        res.json({
            data: employees,
            pagination: {
                page: parseInt(page), limit: parseInt(limit),
                total: countResult.total,
                totalPages: Math.ceil(countResult.total / parseInt(limit))
            }
        });
});

// ── GET BY ID ──────────────────────────────────────────────────────────
export const getEmployeeById = asyncHandler(async (req, res) => {
        const { id } = req.params;
        const employee = await get(
            `SELECT e.*,
                TIMESTAMPDIFF(YEAR, e.hire_date, CURDATE())            AS years_of_service,
                TIMESTAMPDIFF(YEAR, e.date_of_birth, CURDATE())        AS age,
                CONCAT(COALESCE(m.first_name,''), ' ', COALESCE(m.last_name,'')) AS manager_name,
                u.email AS user_email
             FROM employees e
             LEFT JOIN employees m ON m.id = e.manager_id
             LEFT JOIN users u     ON u.id = e.user_id
             WHERE e.id = ?`, [id]
        );
        if (!employee) return res.status(404).json({ error: 'Employee not found' });

        const driverInfo = await get(
            `SELECT d.*,
                (SELECT COUNT(*) FROM shipments WHERE driver_id = d.id AND status = 'delivered') AS completed_trips
             FROM drivers d WHERE d.employee_id = ?`, [id]
        );
        res.json({ ...employee, driverInfo });
});

// ── CREATE ─────────────────────────────────────────────────────────────
export const createEmployee = asyncHandler(async (req, res) => {
        const b = req.body;
        const code = generateEmployeeCode();
        const photoUrl = req.file ? getPublicUrl(req.file.filename, 'employees') : null;

        const result = await run(
            `INSERT INTO employees (
                employee_code, first_name, last_name, email, phone,
                department, position, hire_date, salary, nationality,
                id_number, id_expiry, date_of_birth, gender, marital_status, address,
                emergency_contact_name, emergency_contact_phone,
                employment_type, contract_type, probation_end_date,
                work_location, work_shift, manager_id,
                passport_number, passport_expiry,
                visa_number, visa_expiry,
                work_permit_number, work_permit_expiry,
                gosi_number, medical_insurance_number, medical_insurance_expiry,
                bank_name, bank_iban,
                performance_rating, last_appraisal_date,
                annual_leave_entitlement, termination_date, termination_reason,
                notes, photo_url, status
            ) VALUES (
                ?,?,?,?,?,  ?,?,?,?,?,
                ?,?,?,?,?,?,  ?,?,
                ?,?,?,  ?,?,?,
                ?,?,  ?,?,  ?,?,
                ?,?,?,  ?,?,
                ?,?,  ?,?,?,?,?,?
            )`,
            [
                code, b.firstName, b.lastName, n(b.email), n(b.phone),
                b.department, b.position, b.hireDate, n(b.salary), n(b.nationality),
                n(b.idNumber), n(b.idExpiry), n(b.dateOfBirth), n(b.gender), n(b.maritalStatus), n(b.address),
                n(b.emergencyContactName), n(b.emergencyContactPhone),
                b.employmentType || 'full_time', b.contractType || 'permanent', n(b.probationEndDate),
                n(b.workLocation), b.workShift || 'morning', n(b.managerId) || null,
                n(b.passportNumber), n(b.passportExpiry),
                n(b.visaNumber), n(b.visaExpiry),
                n(b.workPermitNumber), n(b.workPermitExpiry),
                n(b.gosiNumber), n(b.medicalInsuranceNumber), n(b.medicalInsuranceExpiry),
                n(b.bankName), n(b.bankIban),
                n(b.performanceRating), n(b.lastAppraisalDate),
                n(b.annualLeaveEntitlement) || 21,
                n(b.terminationDate), n(b.terminationReason),
                n(b.notes), photoUrl, b.status || 'active'
            ]
        );

        await run(
            'INSERT INTO activity_logs (user_id, action, entity_type, entity_id, new_values) VALUES (?,?,?,?,?)',
            [req.user.id, 'CREATE_EMPLOYEE', 'employee', result.id,
             JSON.stringify({ firstName: b.firstName, lastName: b.lastName, department: b.department })]
        );
        res.status(201).json({ id: result.id, employeeCode: code, message: 'Employee created successfully' });
});

// ── UPDATE ─────────────────────────────────────────────────────────────
export const updateEmployee = asyncHandler(async (req, res) => {
        const { id } = req.params;
        const b = req.body;

        const emp = await get('SELECT * FROM employees WHERE id = ?', [id]);
        if (!emp) return res.status(404).json({ error: 'Employee not found' });

        const photoUrl = req.file ? getPublicUrl(req.file.filename, 'employees') : emp.photo_url;

        // Every value goes through n() — undefined/empty → null
        // COALESCE(null, existing_col) keeps existing value; explicit override uses actual value
        await run(
            `UPDATE employees SET
                first_name               = COALESCE(?, first_name),
                last_name                = COALESCE(?, last_name),
                email                    = COALESCE(?, email),
                phone                    = COALESCE(?, phone),
                department               = COALESCE(?, department),
                position                 = COALESCE(?, position),
                hire_date                = COALESCE(?, hire_date),
                salary                   = COALESCE(?, salary),
                nationality              = COALESCE(?, nationality),
                id_number                = COALESCE(?, id_number),
                id_expiry                = COALESCE(?, id_expiry),
                date_of_birth            = COALESCE(?, date_of_birth),
                gender                   = COALESCE(?, gender),
                marital_status           = COALESCE(?, marital_status),
                address                  = COALESCE(?, address),
                emergency_contact_name   = COALESCE(?, emergency_contact_name),
                emergency_contact_phone  = COALESCE(?, emergency_contact_phone),
                employment_type          = COALESCE(?, employment_type),
                contract_type            = COALESCE(?, contract_type),
                probation_end_date       = COALESCE(?, probation_end_date),
                work_location            = COALESCE(?, work_location),
                work_shift               = COALESCE(?, work_shift),
                manager_id               = COALESCE(?, manager_id),
                passport_number          = COALESCE(?, passport_number),
                passport_expiry          = COALESCE(?, passport_expiry),
                visa_number              = COALESCE(?, visa_number),
                visa_expiry              = COALESCE(?, visa_expiry),
                work_permit_number       = COALESCE(?, work_permit_number),
                work_permit_expiry       = COALESCE(?, work_permit_expiry),
                gosi_number              = COALESCE(?, gosi_number),
                medical_insurance_number = COALESCE(?, medical_insurance_number),
                medical_insurance_expiry = COALESCE(?, medical_insurance_expiry),
                bank_name                = COALESCE(?, bank_name),
                bank_iban                = COALESCE(?, bank_iban),
                performance_rating       = COALESCE(?, performance_rating),
                last_appraisal_date      = COALESCE(?, last_appraisal_date),
                annual_leave_entitlement = COALESCE(?, annual_leave_entitlement),
                termination_date         = COALESCE(?, termination_date),
                termination_reason       = COALESCE(?, termination_reason),
                notes                    = COALESCE(?, notes),
                photo_url                = ?,
                status                   = COALESCE(?, status)
             WHERE id = ?`,
            [
                n(b.firstName), n(b.lastName), n(b.email), n(b.phone),
                n(b.department), n(b.position), n(b.hireDate), n(b.salary),
                n(b.nationality), n(b.idNumber), n(b.idExpiry),
                n(b.dateOfBirth), n(b.gender), n(b.maritalStatus), n(b.address),
                n(b.emergencyContactName), n(b.emergencyContactPhone),
                n(b.employmentType), n(b.contractType), n(b.probationEndDate),
                n(b.workLocation), n(b.workShift),
                n(b.managerId) ? parseInt(b.managerId) : null,
                n(b.passportNumber), n(b.passportExpiry),
                n(b.visaNumber), n(b.visaExpiry),
                n(b.workPermitNumber), n(b.workPermitExpiry),
                n(b.gosiNumber), n(b.medicalInsuranceNumber), n(b.medicalInsuranceExpiry),
                n(b.bankName), n(b.bankIban),
                n(b.performanceRating), n(b.lastAppraisalDate),
                n(b.annualLeaveEntitlement),
                n(b.terminationDate), n(b.terminationReason),
                n(b.notes),
                photoUrl,
                n(b.status),
                id
            ]
        );

        await run(
            'INSERT INTO activity_logs (user_id, action, entity_type, entity_id, old_values, new_values) VALUES (?,?,?,?,?,?)',
            [req.user.id, 'UPDATE_EMPLOYEE', 'employee', id, JSON.stringify(emp), JSON.stringify(b)]
        );

        // ── Driver lock: only lock driver when HR terminates or deactivates.
        // Driver operational status (available/on_trip/on_leave) is managed
        // exclusively by Fleet/dispatch — HR should not override it.
        // Exception: terminated/inactive employees must not be dispatched.
        if (n(b.status) && n(b.status) !== emp.status) {
            const lockStatuses = { terminated: 'suspended', inactive: 'off_duty' };
            const lockTo = lockStatuses[b.status];
            if (lockTo) {
                const driverRecord = await get('SELECT id FROM drivers WHERE employee_id = ?', [id]);
                if (driverRecord) {
                    await run('UPDATE drivers SET status = ? WHERE employee_id = ?', [lockTo, id]);
                }
            }
        }

        res.json({ message: 'Employee updated successfully', photoUrl });
});

// ── DELETE ─────────────────────────────────────────────────────────────
export const deleteEmployee = asyncHandler(async (req, res) => {
        const { id } = req.params;
        const emp = await get('SELECT * FROM employees WHERE id = ?', [id]);
        if (!emp) return res.status(404).json({ error: 'Employee not found' });

        const driver = await get('SELECT * FROM drivers WHERE employee_id = ?', [id]);
        if (driver) {
            const active = await get(
                'SELECT COUNT(*) as count FROM shipments WHERE driver_id = ? AND status IN ("picked_up","in_transit")',
                [driver.id]
            );
            if (active.count > 0)
                return res.status(400).json({ error: 'Cannot delete — employee has active shipments' });
        }

        await run('DELETE FROM employees WHERE id = ?', [id]);
        await run(
            'INSERT INTO activity_logs (user_id, action, entity_type, entity_id, old_values) VALUES (?,?,?,?,?)',
            [req.user.id, 'DELETE_EMPLOYEE', 'employee', id, JSON.stringify(emp)]
        );
        res.json({ message: 'Employee deleted successfully' });
});

// ── DEPARTMENTS ────────────────────────────────────────────────────────
export const getDepartments = asyncHandler(async (req, res) => {
        const depts = await query(
            'SELECT DISTINCT department FROM employees WHERE department IS NOT NULL ORDER BY department'
        );
        res.json(depts.map(d => d.department));
});

// ── STATS — flat structure ─────────────────────────────────────────────
export const getEmployeeStats = asyncHandler(async (req, res) => {
        const total      = await get('SELECT COUNT(*) AS c FROM employees');
        const active     = await get("SELECT COUNT(*) AS c FROM employees WHERE status = 'active'");
        const on_leave   = await get("SELECT COUNT(*) AS c FROM employees WHERE status = 'on_leave'");
        const inactive   = await get("SELECT COUNT(*) AS c FROM employees WHERE status = 'inactive'");
        const terminated = await get("SELECT COUNT(*) AS c FROM employees WHERE status = 'terminated'");
        const depts      = await get('SELECT COUNT(DISTINCT department) AS c FROM employees');

        // Documents expiring within 60 days (active employees only)
        const expiring = await get(`
            SELECT COUNT(*) AS c FROM employees
            WHERE status NOT IN ('terminated')
              AND (
                (id_expiry               IS NOT NULL AND DATEDIFF(id_expiry,               CURDATE()) BETWEEN 0 AND 60)
             OR (visa_expiry             IS NOT NULL AND DATEDIFF(visa_expiry,             CURDATE()) BETWEEN 0 AND 60)
             OR (passport_expiry         IS NOT NULL AND DATEDIFF(passport_expiry,         CURDATE()) BETWEEN 0 AND 60)
             OR (work_permit_expiry      IS NOT NULL AND DATEDIFF(work_permit_expiry,      CURDATE()) BETWEEN 0 AND 60)
             OR (medical_insurance_expiry IS NOT NULL AND DATEDIFF(medical_insurance_expiry, CURDATE()) BETWEEN 0 AND 60)
              )`);

        const expired = await get(`
            SELECT COUNT(*) AS c FROM employees
            WHERE status NOT IN ('terminated')
              AND (
                (id_expiry               IS NOT NULL AND id_expiry               < CURDATE())
             OR (visa_expiry             IS NOT NULL AND visa_expiry             < CURDATE())
             OR (passport_expiry         IS NOT NULL AND passport_expiry         < CURDATE())
             OR (work_permit_expiry      IS NOT NULL AND work_permit_expiry      < CURDATE())
             OR (medical_insurance_expiry IS NOT NULL AND medical_insurance_expiry < CURDATE())
              )`);

        const byDepartment = await query(
            'SELECT department, COUNT(*) AS count FROM employees GROUP BY department ORDER BY count DESC'
        );

        res.json({
            total:            total.c,
            active_count:     active.c,
            on_leave_count:   on_leave.c,
            inactive_count:   inactive.c,
            terminated_count: terminated.c,
            department_count: depts.c,
            expiring_documents_count: expiring.c,
            expired_documents_count:  expired.c,
            byDepartment,
        });
});
