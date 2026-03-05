-- ============================================
-- Rawabi Logistics ERP - MySQL 8.x Schema
-- Version 2.0
-- ============================================

-- Users & Authentication
CREATE TABLE IF NOT EXISTS users (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    email       VARCHAR(255) UNIQUE NOT NULL,
    password    VARCHAR(255) NOT NULL,
    first_name  VARCHAR(100) NOT NULL,
    last_name   VARCHAR(100) NOT NULL,
    role        ENUM('super_admin','admin','accountant','office_admin','dispatcher','driver') NOT NULL,
    department  VARCHAR(100),
    phone       VARCHAR(50),
    is_active   TINYINT(1) DEFAULT 1,
    last_login  DATETIME,
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Employees (HR Module)
CREATE TABLE IF NOT EXISTS employees (
    id                      INT AUTO_INCREMENT PRIMARY KEY,
    employee_code           VARCHAR(50) UNIQUE NOT NULL,
    user_id                 INT,
    first_name              VARCHAR(100) NOT NULL,
    last_name               VARCHAR(100) NOT NULL,
    email                   VARCHAR(255),
    phone                   VARCHAR(50),
    department              VARCHAR(100) NOT NULL,
    position                VARCHAR(100) NOT NULL,
    hire_date               DATE NOT NULL,
    salary                  DECIMAL(12,2),
    nationality             VARCHAR(100),
    id_number               VARCHAR(100),
    date_of_birth           DATE,
    address                 TEXT,
    emergency_contact_name  VARCHAR(100),
    emergency_contact_phone VARCHAR(50),
    photo_url               VARCHAR(500),
    status                  ENUM('active','inactive','on_leave','terminated') DEFAULT 'active',
    created_at              DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Drivers (Specialised Employee)
CREATE TABLE IF NOT EXISTS drivers (
    id                          INT AUTO_INCREMENT PRIMARY KEY,
    employee_id                 INT NOT NULL,
    license_number              VARCHAR(100) NOT NULL,
    license_type                ENUM('light','heavy','trailer','motorcycle') NOT NULL,
    license_expiry              DATE NOT NULL,
    medical_certificate_expiry  DATE,
    years_of_experience         INT DEFAULT 0,
    rating                      DECIMAL(2,1) DEFAULT 5.0,
    total_trips                 INT DEFAULT 0,
    status                      ENUM('available','on_trip','on_leave','suspended','off_duty') DEFAULT 'available',
    current_location            VARCHAR(255),
    photo_url                   VARCHAR(500),
    FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE RESTRICT
);

-- Vehicles / Fleet
CREATE TABLE IF NOT EXISTS vehicles (
    id                  INT AUTO_INCREMENT PRIMARY KEY,
    vehicle_code        VARCHAR(50) UNIQUE NOT NULL,
    plate_number        VARCHAR(50) UNIQUE NOT NULL,
    vehicle_type        VARCHAR(100) NOT NULL,
    brand               VARCHAR(100),
    model               VARCHAR(100),
    year                INT,
    capacity_kg         DECIMAL(10,2),
    capacity_cbm        DECIMAL(10,2),
    fuel_type           VARCHAR(50),
    trailer_type        VARCHAR(100),
    purchase_date       DATE,
    purchase_price      DECIMAL(12,2),
    registration_expiry DATE,
    insurance_expiry    DATE,
    status              ENUM('active','maintenance','retired','sold','accident') DEFAULT 'active',
    current_location    VARCHAR(255),
    total_km            DECIMAL(12,2) DEFAULT 0,
    fuel_efficiency     DECIMAL(5,2),
    notes               TEXT,
    created_at          DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Vehicle-Driver Assignments
CREATE TABLE IF NOT EXISTS vehicle_assignments (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    vehicle_id      INT NOT NULL,
    driver_id       INT NOT NULL,
    assigned_date   DATE NOT NULL,
    unassigned_date DATE,
    is_primary      TINYINT(1) DEFAULT 1,
    notes           TEXT,
    FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE RESTRICT,
    FOREIGN KEY (driver_id)  REFERENCES drivers(id)  ON DELETE RESTRICT
);

-- Customers (CRM)
CREATE TABLE IF NOT EXISTS customers (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    customer_code   VARCHAR(50) UNIQUE NOT NULL,
    company_name    VARCHAR(255) NOT NULL,
    contact_person  VARCHAR(100),
    email           VARCHAR(255),
    phone           VARCHAR(50),
    mobile          VARCHAR(50),
    address         TEXT,
    city            VARCHAR(100),
    country         VARCHAR(100) DEFAULT 'Saudi Arabia',
    tax_number      VARCHAR(100),
    cr_number       VARCHAR(100),
    credit_limit    DECIMAL(12,2) DEFAULT 0,
    payment_terms   INT DEFAULT 30,
    customer_type   ENUM('regular','vip','corporate','government') DEFAULT 'regular',
    status          ENUM('active','inactive','suspended') DEFAULT 'active',
    created_by      INT,
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

-- Customer Contacts
CREATE TABLE IF NOT EXISTS customer_contacts (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    customer_id INT NOT NULL,
    name        VARCHAR(100) NOT NULL,
    position    VARCHAR(100),
    email       VARCHAR(255),
    phone       VARCHAR(50),
    is_primary  TINYINT(1) DEFAULT 0,
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
);

-- Shipments / Orders
CREATE TABLE IF NOT EXISTS shipments (
    id                      INT AUTO_INCREMENT PRIMARY KEY,
    shipment_number         VARCHAR(50) UNIQUE NOT NULL,
    customer_id             INT NOT NULL,
    order_date              DATE NOT NULL,
    requested_pickup_date   DATE,
    requested_delivery_date DATE,
    actual_pickup_date      DATETIME,
    actual_delivery_date    DATETIME,
    origin_address          TEXT NOT NULL,
    origin_city             VARCHAR(100) NOT NULL,
    origin_country          VARCHAR(100) DEFAULT 'Saudi Arabia',
    destination_address     TEXT NOT NULL,
    destination_city        VARCHAR(100) NOT NULL,
    destination_country     VARCHAR(100) DEFAULT 'Saudi Arabia',
    cargo_type              VARCHAR(100) NOT NULL,
    cargo_description       TEXT,
    weight_kg               DECIMAL(10,2),
    volume_cbm              DECIMAL(10,2),
    pieces                  INT DEFAULT 1,
    value                   DECIMAL(12,2),
    transport_mode          ENUM('road','sea','air','multimodal') NOT NULL,
    service_type            ENUM('standard','express','economy') DEFAULT 'standard',
    vehicle_id              INT,
    driver_id               INT,
    status                  ENUM('pending','confirmed','picked_up','in_transit','customs','delivered','cancelled','returned') DEFAULT 'pending',
    approval_status         ENUM('draft','pending_approval','approved','rejected') DEFAULT 'draft',
    approved_by             INT,
    approved_at             DATETIME,
    rejection_reason        TEXT,
    tracking_number         VARCHAR(100),
    special_instructions    TEXT,
    quoted_amount           DECIMAL(12,2),
    final_amount            DECIMAL(12,2),
    created_by              INT,
    created_at              DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at              DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE RESTRICT,
    FOREIGN KEY (vehicle_id)  REFERENCES vehicles(id)  ON DELETE SET NULL,
    FOREIGN KEY (driver_id)   REFERENCES drivers(id)   ON DELETE SET NULL,
    FOREIGN KEY (created_by)  REFERENCES users(id)     ON DELETE SET NULL,
    FOREIGN KEY (approved_by) REFERENCES users(id)     ON DELETE SET NULL
);

-- Shipment Tracking Events
CREATE TABLE IF NOT EXISTS shipment_tracking (
    id                  INT AUTO_INCREMENT PRIMARY KEY,
    shipment_id         INT NOT NULL,
    event_type          VARCHAR(100) NOT NULL,
    event_description   TEXT,
    location            VARCHAR(255),
    event_time          DATETIME DEFAULT CURRENT_TIMESTAMP,
    recorded_by         INT,
    notes               TEXT,
    FOREIGN KEY (shipment_id) REFERENCES shipments(id) ON DELETE CASCADE,
    FOREIGN KEY (recorded_by) REFERENCES users(id)     ON DELETE SET NULL
);

-- Shipment Documents
CREATE TABLE IF NOT EXISTS shipment_documents (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    shipment_id     INT NOT NULL,
    document_type   VARCHAR(100) NOT NULL,
    document_name   VARCHAR(255) NOT NULL,
    file_path       VARCHAR(500),
    uploaded_by     INT,
    uploaded_at     DATETIME DEFAULT CURRENT_TIMESTAMP,
    notes           TEXT,
    FOREIGN KEY (shipment_id) REFERENCES shipments(id) ON DELETE CASCADE,
    FOREIGN KEY (uploaded_by) REFERENCES users(id)     ON DELETE SET NULL
);

-- Invoices
CREATE TABLE IF NOT EXISTS invoices (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    invoice_number  VARCHAR(50) UNIQUE NOT NULL,
    shipment_id     INT,
    customer_id     INT NOT NULL,
    invoice_date    DATE NOT NULL,
    due_date        DATE NOT NULL,
    subtotal        DECIMAL(12,2) NOT NULL,
    tax_amount      DECIMAL(12,2) DEFAULT 0,
    discount_amount DECIMAL(12,2) DEFAULT 0,
    total_amount    DECIMAL(12,2) NOT NULL,
    paid_amount     DECIMAL(12,2) DEFAULT 0,
    balance_due     DECIMAL(12,2) NOT NULL,
    status          ENUM('draft','sent','paid','partial','overdue','cancelled') DEFAULT 'draft',
    payment_terms   INT DEFAULT 30,
    notes           TEXT,
    created_by      INT,
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (shipment_id) REFERENCES shipments(id)  ON DELETE SET NULL,
    FOREIGN KEY (customer_id) REFERENCES customers(id)  ON DELETE RESTRICT,
    FOREIGN KEY (created_by)  REFERENCES users(id)      ON DELETE SET NULL
);

-- Invoice Line Items
CREATE TABLE IF NOT EXISTS invoice_items (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    invoice_id  INT NOT NULL,
    description TEXT NOT NULL,
    quantity    DECIMAL(10,2) DEFAULT 1,
    unit        VARCHAR(50),
    unit_price  DECIMAL(12,2) NOT NULL,
    total_price DECIMAL(12,2) NOT NULL,
    FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE
);

-- Payments
CREATE TABLE IF NOT EXISTS payments (
    id               INT AUTO_INCREMENT PRIMARY KEY,
    payment_number   VARCHAR(50) UNIQUE NOT NULL,
    invoice_id       INT,
    customer_id      INT,
    payment_date     DATE NOT NULL,
    amount           DECIMAL(12,2) NOT NULL,
    payment_method   ENUM('cash','bank_transfer','check','credit_card','online') NOT NULL,
    reference_number VARCHAR(100),
    bank_name        VARCHAR(100),
    notes            TEXT,
    received_by      INT,
    created_at       DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (invoice_id)  REFERENCES invoices(id)  ON DELETE SET NULL,
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL,
    FOREIGN KEY (received_by) REFERENCES users(id)     ON DELETE SET NULL
);

-- Expenses
CREATE TABLE IF NOT EXISTS expenses (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    expense_number  VARCHAR(50) UNIQUE NOT NULL,
    expense_date    DATE NOT NULL,
    category        VARCHAR(100) NOT NULL,
    description     TEXT NOT NULL,
    amount          DECIMAL(12,2) NOT NULL,
    vehicle_id      INT,
    driver_id       INT,
    shipment_id     INT,
    vendor_name     VARCHAR(255),
    receipt_number  VARCHAR(100),
    payment_method  VARCHAR(50),
    approved_by     INT,
    status          ENUM('pending','approved','rejected','paid') DEFAULT 'pending',
    created_by      INT,
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (vehicle_id)  REFERENCES vehicles(id)  ON DELETE SET NULL,
    FOREIGN KEY (driver_id)   REFERENCES drivers(id)   ON DELETE SET NULL,
    FOREIGN KEY (shipment_id) REFERENCES shipments(id) ON DELETE SET NULL,
    FOREIGN KEY (approved_by) REFERENCES users(id)     ON DELETE SET NULL,
    FOREIGN KEY (created_by)  REFERENCES users(id)     ON DELETE SET NULL
);

-- Maintenance Records
CREATE TABLE IF NOT EXISTS maintenance_records (
    id                INT AUTO_INCREMENT PRIMARY KEY,
    vehicle_id        INT NOT NULL,
    maintenance_type  ENUM('routine','repair','inspection','tire_change','oil_change','other') NOT NULL,
    service_date      DATE NOT NULL,
    completion_date   DATE,
    description       TEXT NOT NULL,
    service_provider  VARCHAR(255),
    cost              DECIMAL(12,2),
    parts_replaced    TEXT,
    next_service_date DATE,
    next_service_km   DECIMAL(12,2),
    status            ENUM('scheduled','in_progress','completed','cancelled') DEFAULT 'scheduled',
    performed_by      INT,
    notes             TEXT,
    created_at        DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (vehicle_id)   REFERENCES vehicles(id) ON DELETE RESTRICT,
    FOREIGN KEY (performed_by) REFERENCES users(id)    ON DELETE SET NULL
);

-- Fuel Records
CREATE TABLE IF NOT EXISTS fuel_records (
    id                INT AUTO_INCREMENT PRIMARY KEY,
    vehicle_id        INT NOT NULL,
    driver_id         INT,
    fuel_date         DATE NOT NULL,
    fuel_station      VARCHAR(255),
    fuel_type         VARCHAR(50),
    quantity_liters   DECIMAL(10,2) NOT NULL,
    price_per_liter   DECIMAL(8,2),
    total_cost        DECIMAL(12,2) NOT NULL,
    odometer_reading  DECIMAL(12,2),
    receipt_number    VARCHAR(100),
    notes             TEXT,
    FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE RESTRICT,
    FOREIGN KEY (driver_id)  REFERENCES drivers(id)  ON DELETE SET NULL
);

-- System Settings
CREATE TABLE IF NOT EXISTS settings (
    id            INT AUTO_INCREMENT PRIMARY KEY,
    setting_key   VARCHAR(100) UNIQUE NOT NULL,
    setting_value TEXT,
    setting_group VARCHAR(100),
    description   TEXT
);

-- Activity Logs
CREATE TABLE IF NOT EXISTS activity_logs (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    user_id     INT,
    action      VARCHAR(100) NOT NULL,
    entity_type VARCHAR(100),
    entity_id   INT,
    old_values  JSON,
    new_values  JSON,
    ip_address  VARCHAR(45),
    user_agent  TEXT,
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- ============================================
-- INDEXES for query performance
-- ============================================
CREATE INDEX idx_shipments_status        ON shipments(status);
CREATE INDEX idx_shipments_driver        ON shipments(driver_id);
CREATE INDEX idx_shipments_vehicle       ON shipments(vehicle_id);
CREATE INDEX idx_shipments_customer      ON shipments(customer_id);
CREATE INDEX idx_shipments_approval      ON shipments(approval_status);
CREATE INDEX idx_drivers_status          ON drivers(status);
CREATE INDEX idx_vehicles_status         ON vehicles(status);
CREATE INDEX idx_invoices_status         ON invoices(status);
CREATE INDEX idx_invoices_customer       ON invoices(customer_id);
CREATE INDEX idx_activity_logs_entity    ON activity_logs(entity_type, entity_id);
CREATE INDEX idx_employees_user          ON employees(user_id);
