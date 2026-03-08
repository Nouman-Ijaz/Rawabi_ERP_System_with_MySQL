-- ============================================================
-- RAWABI LOGISTICS ERP — PAYROLL MODULE MIGRATION
-- Run once in MySQL Workbench against rawabi_erp database
-- ============================================================

-- ── Salary structures ─────────────────────────────────────
-- Per-employee salary components (housing, transport, etc.)
CREATE TABLE IF NOT EXISTS salary_structures (
    id                          INT AUTO_INCREMENT PRIMARY KEY,
    employee_id                 INT NOT NULL,
    effective_from              DATE NOT NULL,
    basic_salary                DECIMAL(12,2) NOT NULL DEFAULT 0,
    housing_allowance           DECIMAL(12,2) NOT NULL DEFAULT 0,
    transport_allowance         DECIMAL(12,2) NOT NULL DEFAULT 0,
    food_allowance              DECIMAL(12,2) NOT NULL DEFAULT 0,
    phone_allowance             DECIMAL(12,2) NOT NULL DEFAULT 0,
    other_allowance             DECIMAL(12,2) NOT NULL DEFAULT 0,
    other_allowance_label       VARCHAR(100),
    gosi_employee_pct           DECIMAL(5,2) NOT NULL DEFAULT 9.75,   -- 9.75% for Saudi nationals
    gosi_employer_pct           DECIMAL(5,2) NOT NULL DEFAULT 11.75,  -- 11.75% for Saudi nationals
    is_active                   BOOLEAN NOT NULL DEFAULT TRUE,
    notes                       TEXT,
    created_by                  INT,
    created_at                  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at                  TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (employee_id)   REFERENCES employees(id) ON DELETE CASCADE,
    INDEX idx_ss_employee       (employee_id),
    INDEX idx_ss_effective      (effective_from)
);

-- ── Payroll periods ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS payroll_periods (
    id                          INT AUTO_INCREMENT PRIMARY KEY,
    period_month                TINYINT NOT NULL,              -- 1–12
    period_year                 SMALLINT NOT NULL,
    status                      ENUM('draft','processing','approved','paid','cancelled') NOT NULL DEFAULT 'draft',
    payment_date                DATE,
    approved_by                 INT,
    approved_at                 TIMESTAMP NULL,
    total_gross                 DECIMAL(14,2) DEFAULT 0,
    total_deductions            DECIMAL(14,2) DEFAULT 0,
    total_net                   DECIMAL(14,2) DEFAULT 0,
    employee_count              INT DEFAULT 0,
    notes                       TEXT,
    created_by                  INT NOT NULL,
    created_at                  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at                  TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_period        (period_month, period_year),
    INDEX idx_pp_status         (status)
);

-- ── Payroll slips (one per employee per period) ────────────
CREATE TABLE IF NOT EXISTS payroll_slips (
    id                          INT AUTO_INCREMENT PRIMARY KEY,
    payroll_period_id           INT NOT NULL,
    employee_id                 INT NOT NULL,

    -- Earnings
    basic_salary                DECIMAL(12,2) NOT NULL DEFAULT 0,
    housing_allowance           DECIMAL(12,2) NOT NULL DEFAULT 0,
    transport_allowance         DECIMAL(12,2) NOT NULL DEFAULT 0,
    food_allowance              DECIMAL(12,2) NOT NULL DEFAULT 0,
    phone_allowance             DECIMAL(12,2) NOT NULL DEFAULT 0,
    other_allowance             DECIMAL(12,2) NOT NULL DEFAULT 0,
    overtime_hours              DECIMAL(6,2)  NOT NULL DEFAULT 0,
    overtime_amount             DECIMAL(12,2) NOT NULL DEFAULT 0,
    bonus_amount                DECIMAL(12,2) NOT NULL DEFAULT 0,
    bonus_note                  VARCHAR(200),
    gross_salary                DECIMAL(12,2) NOT NULL DEFAULT 0,

    -- Deductions
    gosi_employee               DECIMAL(12,2) NOT NULL DEFAULT 0,   -- Employee share
    gosi_employer               DECIMAL(12,2) NOT NULL DEFAULT 0,   -- Employer share (cost only)
    income_tax                  DECIMAL(12,2) NOT NULL DEFAULT 0,
    loan_deduction              DECIMAL(12,2) NOT NULL DEFAULT 0,
    absence_deduction           DECIMAL(12,2) NOT NULL DEFAULT 0,
    other_deduction             DECIMAL(12,2) NOT NULL DEFAULT 0,
    other_deduction_note        VARCHAR(200),
    total_deductions            DECIMAL(12,2) NOT NULL DEFAULT 0,

    -- Net
    net_salary                  DECIMAL(12,2) NOT NULL DEFAULT 0,

    -- Status & payment
    working_days                TINYINT NOT NULL DEFAULT 30,
    days_absent                 TINYINT NOT NULL DEFAULT 0,
    days_present                TINYINT NOT NULL DEFAULT 30,
    payment_method              ENUM('bank_transfer','cash','cheque') DEFAULT 'bank_transfer',
    bank_name                   VARCHAR(100),
    bank_iban                   VARCHAR(34),
    payment_reference           VARCHAR(100),
    paid_at                     TIMESTAMP NULL,
    status                      ENUM('draft','approved','paid','cancelled') NOT NULL DEFAULT 'draft',
    notes                       TEXT,
    created_at                  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at                  TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    FOREIGN KEY (payroll_period_id) REFERENCES payroll_periods(id) ON DELETE CASCADE,
    FOREIGN KEY (employee_id)       REFERENCES employees(id) ON DELETE RESTRICT,
    UNIQUE KEY uq_slip              (payroll_period_id, employee_id),
    INDEX idx_ps_period             (payroll_period_id),
    INDEX idx_ps_employee           (employee_id),
    INDEX idx_ps_status             (status)
);

-- ── Employee loans ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS employee_loans (
    id                          INT AUTO_INCREMENT PRIMARY KEY,
    employee_id                 INT NOT NULL,
    loan_amount                 DECIMAL(12,2) NOT NULL,
    monthly_deduction           DECIMAL(12,2) NOT NULL,
    disbursed_date              DATE NOT NULL,
    reason                      VARCHAR(255),
    total_paid                  DECIMAL(12,2) NOT NULL DEFAULT 0,
    remaining_balance           DECIMAL(12,2) NOT NULL,
    status                      ENUM('active','completed','cancelled') NOT NULL DEFAULT 'active',
    notes                       TEXT,
    approved_by                 INT,
    created_by                  INT,
    created_at                  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at                  TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (employee_id)   REFERENCES employees(id) ON DELETE CASCADE,
    INDEX idx_el_employee       (employee_id),
    INDEX idx_el_status         (status)
);

-- ── Payroll indexes ────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_payroll_period_status ON payroll_periods(status, period_year, period_month);
