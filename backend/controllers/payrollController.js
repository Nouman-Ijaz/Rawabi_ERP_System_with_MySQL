import { asyncHandler, httpError } from '../middleware/asyncHandler.js';
import { query, get, run } from '../database/db.js';
import { GOSI, PAYROLL } from '../config/constants.js';
import { n, logActivity } from '../utils/helpers.js';

// ── GET ALL PERIODS ──────────────────────────────────────────────────
export const getAllPeriods = asyncHandler(async (req, res) => {
        const { status, year } = req.query;
        let sql = `SELECT pp.*,
                          CONCAT(u.first_name,' ',u.last_name) AS created_by_name,
                          CONCAT(a.first_name,' ',a.last_name) AS approved_by_name
                   FROM payroll_periods pp
                   LEFT JOIN users u ON u.id = pp.created_by
                   LEFT JOIN users a ON a.id = pp.approved_by
                   WHERE 1=1`;
        const params = [];
        if (status) { sql += ' AND pp.status = ?'; params.push(status); }
        if (year)   { sql += ' AND pp.period_year = ?'; params.push(parseInt(year)); }
        sql += ' ORDER BY pp.period_year DESC, pp.period_month DESC';
        const periods = await query(sql, params);
        res.json(periods);
});

// ── CREATE PERIOD ────────────────────────────────────────────────────
export const createPeriod = asyncHandler(async (req, res) => {
        const { month, year, paymentDate, notes } = req.body;
        if (!month || !year) return res.status(400).json({ error: 'Month and year are required' });
        const m = parseInt(month), y = parseInt(year);
        if (m < 1 || m > 12) return res.status(400).json({ error: 'Invalid month' });

        const existing = await get('SELECT id FROM payroll_periods WHERE period_month=? AND period_year=?', [m,y]);
        if (existing) return res.status(409).json({ error: 'Payroll period already exists for this month' });

        const result = await run(
            'INSERT INTO payroll_periods (period_month,period_year,status,payment_date,notes,created_by) VALUES (?,?,?,?,?,?)',
            [m, y, 'draft', paymentDate||null, notes||null, req.user.id]
        );
        const period = await get('SELECT * FROM payroll_periods WHERE id=?', [result.id]);
        res.status(201).json(period);
});

// ── GET PERIOD BY ID + SLIPS ─────────────────────────────────────────
export const getPeriodById = asyncHandler(async (req, res) => {
        const { id } = req.params;
        const period = await get(
            `SELECT pp.*,
                    CONCAT(u.first_name,' ',u.last_name) AS created_by_name,
                    CONCAT(a.first_name,' ',a.last_name) AS approved_by_name
             FROM payroll_periods pp
             LEFT JOIN users u ON u.id = pp.created_by
             LEFT JOIN users a ON a.id = pp.approved_by
             WHERE pp.id=?`, [id]
        );
        if (!period) return res.status(404).json({ error: 'Period not found' });

        const slips = await query(
            `SELECT ps.*,
                    e.first_name, e.last_name, e.employee_code,
                    e.department, e.position, e.nationality
             FROM payroll_slips ps
             JOIN employees e ON e.id = ps.employee_id
             WHERE ps.payroll_period_id=?
             ORDER BY e.department, e.first_name`, [id]
        );
        res.json({ ...period, slips });
});

// ── GENERATE SLIPS FOR ALL ACTIVE EMPLOYEES ──────────────────────────
export const generateSlips = asyncHandler(async (req, res) => {
        const { id } = req.params;
        const period = await get('SELECT * FROM payroll_periods WHERE id=?', [id]);
        if (!period) return res.status(404).json({ error: 'Period not found' });
        if (!['draft'].includes(period.status)) return res.status(400).json({ error: 'Can only generate slips for draft periods' });

        // Get active employees with their salary structures
        const employees = await query(
            `SELECT e.id, e.first_name, e.last_name, e.salary, e.bank_name, e.bank_iban,
                    e.gosi_number, e.nationality,
                    ss.basic_salary, ss.housing_allowance, ss.transport_allowance,
                    ss.food_allowance, ss.phone_allowance, ss.other_allowance,
                    ss.gosi_employee_pct, ss.gosi_employer_pct
             FROM employees e
             LEFT JOIN (
                SELECT employee_id,
                       basic_salary, housing_allowance, transport_allowance,
                       food_allowance, phone_allowance, other_allowance,
                       gosi_employee_pct, gosi_employer_pct
                FROM salary_structures
                WHERE is_active = 1
             ) ss ON ss.employee_id = e.id
             WHERE e.status = 'active'`
        );

        let created = 0;
        let skipped = 0;
        for (const emp of employees) {
            const existing = await get('SELECT id FROM payroll_slips WHERE payroll_period_id=? AND employee_id=?', [id, emp.id]);
            if (existing) { skipped++; continue; }

            // Use salary structure if available, fall back to employees.salary
            const basic    = parseFloat(emp.basic_salary || emp.salary || 0);
            const housing  = parseFloat(emp.housing_allowance || 0);
            const transport= parseFloat(emp.transport_allowance || 0);
            const food     = parseFloat(emp.food_allowance || 0);
            const phone    = parseFloat(emp.phone_allowance || 0);
            const other    = parseFloat(emp.other_allowance || 0);
            const gross    = basic + housing + transport + food + phone + other;
            const gosiEmpPct  = parseFloat(emp.gosi_employee_pct || GOSI.EMPLOYEE_RATE * 100);
            const gosiEmprPct = parseFloat(emp.gosi_employer_pct || GOSI.EMPLOYER_RATE * 100);

            // GOSI applies to basic + housing only (Saudi Labor Law)
            const gosiBase   = basic + housing;
            const gosiEmp    = emp.nationality?.toLowerCase().includes('saudi') ? (gosiBase * gosiEmpPct / 100) : 0;
            const gosiEmpr   = emp.nationality?.toLowerCase().includes('saudi') ? (gosiBase * gosiEmprPct / 100) : 0;

            // Get active loan deductions
            const loanDeduction = await get(
                `SELECT SUM(monthly_deduction) as total FROM employee_loans WHERE employee_id=? AND status='active'`, [emp.id]
            );
            const loanAmt = parseFloat(loanDeduction?.total || 0);
            const totalDed = gosiEmp + loanAmt;
            const net = gross - totalDed;

            await run(
                `INSERT INTO payroll_slips
                 (payroll_period_id,employee_id,basic_salary,housing_allowance,transport_allowance,
                  food_allowance,phone_allowance,other_allowance,gross_salary,
                  gosi_employee,gosi_employer,loan_deduction,total_deductions,net_salary,
                  bank_name,bank_iban,status)
                 VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'draft')`,
                [id, emp.id, basic, housing, transport, food, phone, other, gross,
                 gosiEmp, gosiEmpr, loanAmt, totalDed, net,
                 emp.bank_name||null, emp.bank_iban||null]
            );
            created++;
        }

        // Update period totals
        await updatePeriodTotals(id);
        res.json({ message: `Generated ${created} slips (${skipped} already existed)`, created, skipped });
});

// ── UPDATE SINGLE SLIP ───────────────────────────────────────────────
export const updateSlip = asyncHandler(async (req, res) => {
        const { id } = req.params; // slip id
        const slip = await get('SELECT * FROM payroll_slips WHERE id=?', [id]);
        if (!slip) return res.status(404).json({ error: 'Slip not found' });
        if (slip.status === 'paid') return res.status(400).json({ error: 'Cannot edit a paid slip' });

        const {
            basicSalary, housingAllowance, transportAllowance, foodAllowance,
            phoneAllowance, otherAllowance, overtimeHours, overtimeAmount,
            bonusAmount, bonusNote, gosiEmployee, incomeDeduction,
            loanDeduction, absenceDeduction, otherDeduction, otherDeductionNote,
            daysAbsent, workingDays, notes, paymentMethod
        } = req.body;

        const toNum = (v, fallback = 0) => parseFloat(v ?? fallback) || 0;
        const basic     = toNum(basicSalary,     slip.basic_salary);
        const housing = toNum(housingAllowance, slip.housing_allowance);
        const transport = toNum(transportAllowance, slip.transport_allowance);
        const food = toNum(foodAllowance, slip.food_allowance);
        const phone = toNum(phoneAllowance, slip.phone_allowance);
        const otherAllw = toNum(otherAllowance, slip.other_allowance);
        const overtime = toNum(overtimeAmount, slip.overtime_amount);
        const bonus = toNum(bonusAmount, slip.bonus_amount);
        const gross     = basic + housing + transport + food + phone + otherAllw + overtime + bonus;
        const gosiEmp = toNum(gosiEmployee, slip.gosi_employee);
        const loan = toNum(loanDeduction, slip.loan_deduction);
        const absence = toNum(absenceDeduction, slip.absence_deduction);
        const otherDed = toNum(otherDeduction, slip.other_deduction);
        const totalDed  = gosiEmp + loan + absence + otherDed;
        const net       = gross - totalDed;
        const wd        = parseInt(workingDays ?? slip.working_days);
        const absent    = parseInt(daysAbsent  ?? slip.days_absent);

        await run(
            `UPDATE payroll_slips SET
             basic_salary=?,housing_allowance=?,transport_allowance=?,food_allowance=?,
             phone_allowance=?,other_allowance=?,overtime_hours=?,overtime_amount=?,
             bonus_amount=?,bonus_note=?,gross_salary=?,gosi_employee=?,
             loan_deduction=?,absence_deduction=?,other_deduction=?,other_deduction_note=?,
             total_deductions=?,net_salary=?,working_days=?,days_absent=?,days_present=?,
             payment_method=?,notes=?
             WHERE id=?`,
            [basic, housing, transport, food, phone, otherAllw,
             n(overtimeHours), overtime, bonus, bonusNote||null,
             gross, gosiEmp, loan, absence, otherDed, otherDeductionNote||null,
             totalDed, net, wd, absent, wd - absent,
             paymentMethod||'bank_transfer', notes||null, id]
        );
        await updatePeriodTotals(slip.payroll_period_id);
        const updated = await get(`
            SELECT ps.*, e.first_name, e.last_name, e.employee_code, e.department
            FROM payroll_slips ps JOIN employees e ON e.id=ps.employee_id WHERE ps.id=?`, [id]);
        res.json(updated);
});

// ── APPROVE PERIOD ───────────────────────────────────────────────────
export const approvePeriod = asyncHandler(async (req, res) => {
        const { id } = req.params;
        const period = await get('SELECT * FROM payroll_periods WHERE id=?', [id]);
        if (!period) return res.status(404).json({ error: 'Period not found' });
        if (period.status !== 'draft') return res.status(400).json({ error: 'Only draft periods can be approved' });
        const slipCount = await get('SELECT COUNT(*) as c FROM payroll_slips WHERE payroll_period_id=?', [id]);
        if (!slipCount?.c) return res.status(400).json({ error: 'No slips generated. Generate slips first.' });

        await run('UPDATE payroll_periods SET status=?,approved_by=?,approved_at=NOW() WHERE id=?', ['approved', req.user.id, id]);
        await run('UPDATE payroll_slips SET status=? WHERE payroll_period_id=? AND status=?', ['approved', id, 'draft']);
        await logActivity(req.user.id, 'APPROVE_PAYROLL', 'payroll_period', id);
        res.json({ message: 'Payroll approved' });
});

// ── MARK PERIOD AS PAID ──────────────────────────────────────────────
export const markPaid = asyncHandler(async (req, res) => {
        const { id } = req.params;
        const { paymentDate } = req.body;
        const period = await get('SELECT * FROM payroll_periods WHERE id=?', [id]);
        if (!period) return res.status(404).json({ error: 'Period not found' });
        if (period.status !== 'approved') return res.status(400).json({ error: 'Approve the period first' });

        const pd = paymentDate || new Date().toISOString().slice(0,10);
        await run('UPDATE payroll_periods SET status=?,payment_date=? WHERE id=?', ['paid', pd, id]);
        await run('UPDATE payroll_slips SET status=?,paid_at=NOW() WHERE payroll_period_id=? AND status=?', ['paid', id, 'approved']);

        // Update loan balances
        const slips = await query('SELECT employee_id, loan_deduction FROM payroll_slips WHERE payroll_period_id=?', [id]);
        for (const slip of slips) {
            if (parseFloat(slip.loan_deduction) > 0) {
                await run(`UPDATE employee_loans SET
                               total_paid = total_paid + ?,
                               remaining_balance = GREATEST(0, remaining_balance - ?)
                           WHERE employee_id=? AND status='active'`,
                    [slip.loan_deduction, slip.loan_deduction, slip.employee_id]);
                // Close completed loans
                await run(`UPDATE employee_loans SET status='completed'
                           WHERE employee_id=? AND status='active' AND remaining_balance<=0`, [slip.employee_id]);
            }
        }
        await logActivity(req.user.id, 'MARK_PAYROLL_PAID', 'payroll_period', id);
        res.json({ message: 'Payroll marked as paid' });
});

// ── SALARY STRUCTURES ────────────────────────────────────────────────
export const getSalaryStructure = asyncHandler(async (req, res) => {
        const { employeeId } = req.params;
        const structures = await query(
            `SELECT ss.*, CONCAT(u.first_name,' ',u.last_name) AS created_by_name
             FROM salary_structures ss
             LEFT JOIN users u ON u.id = ss.created_by
             WHERE ss.employee_id=? ORDER BY ss.effective_from DESC`, [employeeId]
        );
        res.json(structures);
});

export const upsertSalaryStructure = asyncHandler(async (req, res) => {
        const { employeeId } = req.params;
        const {
            effectiveFrom, basicSalary, housingAllowance, transportAllowance,
            foodAllowance, phoneAllowance, otherAllowance, otherAllowanceLabel,
            gosiEmployeePct, gosiEmployerPct, notes
        } = req.body;

        if (!effectiveFrom || basicSalary === undefined) {
            return res.status(400).json({ error: 'Effective date and basic salary are required' });
        }

        // Deactivate previous structures
        await run('UPDATE salary_structures SET is_active=0 WHERE employee_id=?', [employeeId]);

        await run(
            `INSERT INTO salary_structures
             (employee_id,effective_from,basic_salary,housing_allowance,transport_allowance,
              food_allowance,phone_allowance,other_allowance,other_allowance_label,
              gosi_employee_pct,gosi_employer_pct,notes,is_active,created_by)
             VALUES (?,?,?,?,?,?,?,?,?,?,?,?,1,?)`,
            [employeeId, effectiveFrom,
             parseFloat(basicSalary)||0, parseFloat(housingAllowance||0),
             parseFloat(transportAllowance||0), parseFloat(foodAllowance||0),
             parseFloat(phoneAllowance||0), parseFloat(otherAllowance||0),
             otherAllowanceLabel||null,
             parseFloat(gosiEmployeePct || GOSI.EMPLOYEE_RATE * 100), parseFloat(gosiEmployerPct || GOSI.EMPLOYER_RATE * 100),
             notes||null, req.user.id]
        );

        // Also update employees.salary = basic for consistency
        await run('UPDATE employees SET salary=? WHERE id=?', [parseFloat(basicSalary), employeeId]);

        const latest = await get('SELECT * FROM salary_structures WHERE employee_id=? AND is_active=1', [employeeId]);
        await logActivity(req.user.id, 'UPDATE_SALARY_STRUCTURE', 'employee', employeeId);
        res.json(latest);
});

// ── LOANS ────────────────────────────────────────────────────────────
export const getLoans = asyncHandler(async (req, res) => {
        const { employeeId, status } = req.query;
        let sql = `SELECT el.*, e.first_name, e.last_name, e.employee_code, e.department
                   FROM employee_loans el JOIN employees e ON e.id = el.employee_id WHERE 1=1`;
        const params = [];
        if (employeeId) { sql += ' AND el.employee_id=?'; params.push(employeeId); }
        if (status)     { sql += ' AND el.status=?'; params.push(status); }
        sql += ' ORDER BY el.created_at DESC';
        res.json(await query(sql, params));
});

export const createLoan = asyncHandler(async (req, res) => {
        const { employeeId, loanAmount, monthlyDeduction, disbursedDate, reason, notes } = req.body;
        if (!employeeId || !loanAmount || !monthlyDeduction || !disbursedDate) {
            return res.status(400).json({ error: 'Employee, amount, monthly deduction and date are required' });
        }
        const result = await run(
            `INSERT INTO employee_loans (employee_id,loan_amount,monthly_deduction,disbursed_date,reason,remaining_balance,notes,approved_by,created_by)
             VALUES (?,?,?,?,?,?,?,?,?)`,
            [employeeId, parseFloat(loanAmount), parseFloat(monthlyDeduction),
             disbursedDate, reason||null, parseFloat(loanAmount), notes||null,
             req.user.id, req.user.id]
        );
        const loan = await get('SELECT * FROM employee_loans WHERE id=?', [result.id]);
        res.status(201).json(loan);
});

export const updateLoanStatus = asyncHandler(async (req, res) => {
        const { id } = req.params;
        const { status } = req.body;
        if (!['active','completed','cancelled'].includes(status)) return res.status(400).json({ error: 'Invalid status' });
        await run('UPDATE employee_loans SET status=? WHERE id=?', [status, id]);
        res.json({ message: 'Loan status updated' });
});

// ── PAYROLL STATS ────────────────────────────────────────────────────
export const getPayrollStats = asyncHandler(async (req, res) => {
        const currentYear = new Date().getFullYear();
        const [latestPeriod, ytdCost, activeLoans, pendingApproval] = await Promise.all([
            get(`SELECT * FROM payroll_periods ORDER BY period_year DESC, period_month DESC LIMIT 1`),
            get(`SELECT SUM(total_gross) as gross, SUM(total_net) as net, SUM(total_deductions) as deductions
                 FROM payroll_periods WHERE period_year=? AND status IN ('paid','approved')`, [currentYear]),
            get(`SELECT COUNT(*) as count, SUM(remaining_balance) as total FROM employee_loans WHERE status='active'`),
            get(`SELECT COUNT(*) as count FROM payroll_periods WHERE status='draft'`),
        ]);
        res.json({ latestPeriod, ytdCost, activeLoans, pendingApproval: pendingApproval?.count || 0 });
});

// ── INTERNAL HELPER ──────────────────────────────────────────────────
async function updatePeriodTotals(periodId) {
    const totals = await get(
        `SELECT COUNT(*) as cnt, SUM(gross_salary) as gross, SUM(total_deductions) as deductions, SUM(net_salary) as net
         FROM payroll_slips WHERE payroll_period_id=?`, [periodId]
    );
    await run(
        'UPDATE payroll_periods SET employee_count=?,total_gross=?,total_deductions=?,total_net=? WHERE id=?',
        [totals.cnt||0, totals.gross||0, totals.deductions||0, totals.net||0, periodId]
    );
}

// ── EMPLOYEE: GET OWN SLIPS ──────────────────────────────────────────
export const getMySlips = asyncHandler(async (req, res) => {
        const emp = await get('SELECT id FROM employees WHERE user_id=?', [req.user.id]);
        if (!emp) return res.status(404).json({ error: 'No employee record linked to your account' });

        // Super admin sees all slips including drafts; everyone else only sees approved/paid
        const draftFilter = req.user.role === 'super_admin' ? '' : "AND pp.status IN ('approved','paid')";

        const slips = await query(
            `SELECT ps.*,
                    pp.period_month, pp.period_year, pp.payment_date, pp.status AS period_status,
                    e.first_name, e.last_name, e.employee_code, e.department, e.position,
                    e.bank_name, e.bank_iban, e.nationality
             FROM payroll_slips ps
             JOIN payroll_periods pp ON pp.id = ps.payroll_period_id
             JOIN employees e ON e.id = ps.employee_id
             WHERE ps.employee_id = ? ${draftFilter}
             ORDER BY pp.period_year DESC, pp.period_month DESC`,
            [emp.id]
        );
        res.json(slips);
});

// ── GET SINGLE SLIP FOR PRINT (any admin or the slip's own employee) ─
export const getSlipById = asyncHandler(async (req, res) => {
        const { id } = req.params;
        const slip = await get(
            `SELECT ps.*,
                    pp.period_month, pp.period_year, pp.payment_date, pp.status AS period_status,
                    e.first_name, e.last_name, e.employee_code, e.department, e.position,
                    e.bank_name, e.bank_iban, e.nationality, e.phone, e.email
             FROM payroll_slips ps
             JOIN payroll_periods pp ON pp.id = ps.payroll_period_id
             JOIN employees e ON e.id = ps.employee_id
             WHERE ps.id = ?`, [id]
        );
        if (!slip) return res.status(404).json({ error: 'Slip not found' });

        // Non-admins can only view their own slip
        if (!['super_admin','admin','accountant'].includes(req.user.role)) {
            const emp = await get('SELECT id FROM employees WHERE user_id=?', [req.user.id]);
            if (!emp || emp.id !== slip.employee_id) {
                return res.status(403).json({ error: 'Access denied' });
            }
        }
        res.json(slip);
});

// ── YTD SUMMARY PER EMPLOYEE ─────────────────────────────────────────
export const getEmployeeYTD = asyncHandler(async (req, res) => {
        const { employeeId } = req.params;
        const year = req.query.year || new Date().getFullYear();
        const summary = await get(
            `SELECT
                COUNT(*) AS months_paid,
                SUM(ps.gross_salary) AS ytd_gross,
                SUM(ps.net_salary) AS ytd_net,
                SUM(ps.gosi_employee) AS ytd_gosi,
                SUM(ps.loan_deduction) AS ytd_loan_deductions,
                SUM(ps.bonus_amount) AS ytd_bonus,
                SUM(ps.overtime_amount) AS ytd_overtime,
                SUM(ps.total_deductions) AS ytd_deductions
             FROM payroll_slips ps
             JOIN payroll_periods pp ON pp.id = ps.payroll_period_id
             WHERE ps.employee_id = ? AND pp.period_year = ? AND pp.status IN ('paid','approved')`,
            [employeeId, year]
        );
        res.json(summary);
});
