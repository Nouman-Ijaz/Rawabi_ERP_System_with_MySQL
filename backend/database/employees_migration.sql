-- ============================================================
-- Rawabi ERP — Employees Table Migration
-- Run ONCE. MySQL 8.0 supports IF NOT EXISTS on ADD COLUMN.
-- If on MySQL 5.7, remove IF NOT EXISTS and ignore dup-column warnings.
-- ============================================================

ALTER TABLE employees
  ADD COLUMN IF NOT EXISTS gender                   ENUM('male','female','other')                         NULL,
  ADD COLUMN IF NOT EXISTS marital_status           ENUM('single','married','divorced','widowed')         NULL,
  ADD COLUMN IF NOT EXISTS employment_type          ENUM('full_time','part_time','contract','intern') DEFAULT 'full_time',
  ADD COLUMN IF NOT EXISTS contract_type            ENUM('permanent','fixed_term','probation')       DEFAULT 'permanent',
  ADD COLUMN IF NOT EXISTS probation_end_date       DATE                                                  NULL,
  ADD COLUMN IF NOT EXISTS work_location            VARCHAR(100)                                          NULL,
  ADD COLUMN IF NOT EXISTS work_shift               ENUM('morning','afternoon','night','flexible')   DEFAULT 'morning',
  ADD COLUMN IF NOT EXISTS manager_id               INT                                                   NULL,
  ADD COLUMN IF NOT EXISTS id_expiry                DATE                                                  NULL,
  ADD COLUMN IF NOT EXISTS passport_number          VARCHAR(50)                                           NULL,
  ADD COLUMN IF NOT EXISTS passport_expiry          DATE                                                  NULL,
  ADD COLUMN IF NOT EXISTS visa_number              VARCHAR(50)                                           NULL,
  ADD COLUMN IF NOT EXISTS visa_expiry              DATE                                                  NULL,
  ADD COLUMN IF NOT EXISTS work_permit_number       VARCHAR(50)                                           NULL,
  ADD COLUMN IF NOT EXISTS work_permit_expiry       DATE                                                  NULL,
  ADD COLUMN IF NOT EXISTS gosi_number              VARCHAR(50)                                           NULL,
  ADD COLUMN IF NOT EXISTS medical_insurance_number VARCHAR(50)                                           NULL,
  ADD COLUMN IF NOT EXISTS medical_insurance_expiry DATE                                                  NULL,
  ADD COLUMN IF NOT EXISTS bank_name                VARCHAR(100)                                          NULL,
  ADD COLUMN IF NOT EXISTS bank_iban                VARCHAR(50)                                           NULL,
  ADD COLUMN IF NOT EXISTS performance_rating       DECIMAL(2,1)                                         NULL,
  ADD COLUMN IF NOT EXISTS last_appraisal_date      DATE                                                  NULL,
  ADD COLUMN IF NOT EXISTS annual_leave_entitlement INT                                              DEFAULT 21,
  ADD COLUMN IF NOT EXISTS termination_date         DATE                                                  NULL,
  ADD COLUMN IF NOT EXISTS termination_reason       TEXT                                                  NULL,
  ADD COLUMN IF NOT EXISTS notes                    TEXT                                                  NULL;

-- Foreign key — ignore if already exists
ALTER TABLE employees
  ADD CONSTRAINT fk_emp_manager
  FOREIGN KEY (manager_id) REFERENCES employees(id) ON DELETE SET NULL;
