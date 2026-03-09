-- ============================================================
-- Leave Management Module Migration
-- Run once against the Rawabi Logistics MySQL database
-- ============================================================

-- Leave type definitions (company policy)
CREATE TABLE IF NOT EXISTS leave_types (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    name            VARCHAR(60) NOT NULL,          -- 'Annual', 'Sick', 'Emergency', 'Unpaid', etc.
    code            VARCHAR(20) NOT NULL UNIQUE,   -- 'annual', 'sick', 'emergency', 'unpaid', 'maternity', 'paternity'
    days_per_year   DECIMAL(5,1) NOT NULL DEFAULT 0, -- 0 = unlimited / manually approved
    is_paid         TINYINT(1) NOT NULL DEFAULT 1,
    requires_docs   TINYINT(1) NOT NULL DEFAULT 0, -- sick/emergency may require docs
    carry_over      TINYINT(1) NOT NULL DEFAULT 0, -- can unused days carry to next year
    max_carry_over  INT DEFAULT 0,
    color           VARCHAR(20) DEFAULT '#3b82f6',
    is_active       TINYINT(1) NOT NULL DEFAULT 1,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Seed standard Saudi-law leave types
INSERT IGNORE INTO leave_types (name, code, days_per_year, is_paid, requires_docs, carry_over, max_carry_over, color) VALUES
    ('Annual Leave',     'annual',     21,  1, 0, 1, 5,  '#3b82f6'),
    ('Sick Leave',       'sick',       30,  1, 1, 0, 0,  '#f59e0b'),
    ('Emergency Leave',  'emergency',  3,   1, 0, 0, 0,  '#ef4444'),
    ('Maternity Leave',  'maternity',  70,  1, 1, 0, 0,  '#ec4899'),
    ('Paternity Leave',  'paternity',  3,   1, 0, 0, 0,  '#8b5cf6'),
    ('Hajj Leave',       'hajj',       10,  1, 0, 0, 0,  '#10b981'),
    ('Unpaid Leave',     'unpaid',     0,   0, 0, 0, 0,  '#64748b');

-- Per-employee leave balances for the current year
CREATE TABLE IF NOT EXISTS leave_balances (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    employee_id     INT NOT NULL,
    leave_type_id   INT NOT NULL,
    year            YEAR NOT NULL DEFAULT (YEAR(CURDATE())),
    entitled_days   DECIMAL(5,1) NOT NULL DEFAULT 0,
    used_days       DECIMAL(5,1) NOT NULL DEFAULT 0,
    pending_days    DECIMAL(5,1) NOT NULL DEFAULT 0,
    carried_days    DECIMAL(5,1) NOT NULL DEFAULT 0,
    updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_emp_type_year (employee_id, leave_type_id, year),
    FOREIGN KEY (employee_id)   REFERENCES employees(id) ON DELETE CASCADE,
    FOREIGN KEY (leave_type_id) REFERENCES leave_types(id) ON DELETE CASCADE
);

-- Leave requests
CREATE TABLE IF NOT EXISTS leave_requests (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    request_number  VARCHAR(30) UNIQUE NOT NULL,   -- LVR-YYMM-NNN
    employee_id     INT NOT NULL,
    leave_type_id   INT NOT NULL,
    start_date      DATE NOT NULL,
    end_date        DATE NOT NULL,
    total_days      DECIMAL(5,1) NOT NULL DEFAULT 0,
    reason          TEXT,
    status          ENUM('pending','approved','rejected','cancelled') DEFAULT 'pending',
    applied_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    reviewed_by     INT NULL,                       -- user_id of reviewer
    reviewed_at     TIMESTAMP NULL,
    review_notes    TEXT,
    -- HR tracking
    actual_return   DATE NULL,                      -- actual date employee returned
    is_deducted     TINYINT(1) NOT NULL DEFAULT 0,  -- payroll deducted already?
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (employee_id)   REFERENCES employees(id) ON DELETE CASCADE,
    FOREIGN KEY (leave_type_id) REFERENCES leave_types(id),
    FOREIGN KEY (reviewed_by)   REFERENCES users(id) ON DELETE SET NULL
);

-- Leave attachments (sick notes, etc.)
CREATE TABLE IF NOT EXISTS leave_attachments (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    leave_request_id INT NOT NULL,
    filename        VARCHAR(255) NOT NULL,
    original_name   VARCHAR(255),
    uploaded_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (leave_request_id) REFERENCES leave_requests(id) ON DELETE CASCADE
);

-- Indexes for fast queries
CREATE INDEX IF NOT EXISTS idx_leave_req_employee ON leave_requests(employee_id);
CREATE INDEX IF NOT EXISTS idx_leave_req_status   ON leave_requests(status);
CREATE INDEX IF NOT EXISTS idx_leave_req_dates    ON leave_requests(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_leave_bal_emp_year ON leave_balances(employee_id, year);
