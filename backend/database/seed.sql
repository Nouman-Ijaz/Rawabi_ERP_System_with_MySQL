-- ============================================
-- Rawabi Logistics ERP - Seed Data
-- MySQL 8.x Compatible
-- Run after schema.sql
-- ============================================

-- ============================================
-- SETTINGS
-- ============================================
INSERT IGNORE INTO settings (setting_key, setting_value, setting_group, description) VALUES
('company_name',    'Rawabi Al Hamsal Logistics',    'company',  'Company name'),
('company_address', 'Dammam, Kingdom of Saudi Arabia','company', 'Company address'),
('company_phone',   '+966 591 028747',                'company', 'Company phone'),
('company_email',   'info@rawabilogistics.com',       'company', 'Company email'),
('company_tax_number', '310012345600003',             'company', 'VAT registration number'),
('currency',        'SAR',                            'finance', 'Default currency'),
('tax_rate',        '15',                             'finance', 'VAT rate percentage'),
('fuel_price',      '2.18',                           'operations', 'Average diesel price per litre'),
('invoice_prefix',  'INV',                            'finance', 'Invoice number prefix'),
('shipment_prefix', 'RAW',                            'operations', 'Shipment number prefix');

-- ============================================
-- USER ACCOUNTS (passwords are bcrypt of shown value)
-- All test passwords: Rawabi@2024!
-- Hash: $2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi
-- ============================================
INSERT IGNORE INTO users (id, email, password, first_name, last_name, role, department, phone, is_active) VALUES
(1, 'superadmin@rawabilogistics.com', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'System',   'Administrator', 'super_admin',  'IT',         '+966 591 028 000', 1),
(2, 'admin@rawabilogistics.com',      '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'Omar',     'Al-Zahrani',    'admin',        'Management', '+966 591 028 001', 1),
(3, 'finance@rawabilogistics.com',    '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'Fatima',   'Al-Rashidi',    'accountant',   'Finance',    '+966 591 028 002', 1),
(4, 'hr@rawabilogistics.com',         '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'Sara',     'Al-Otaibi',     'office_admin', 'HR',         '+966 591 028 003', 1),
(5, 'dispatch@rawabilogistics.com',   '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'Khalid',   'Al-Ghamdi',     'dispatcher',   'Operations', '+966 591 028 004', 1),
(6, 'driver1@rawabilogistics.com',    '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'Ahmed',    'Al-Rashid',     'driver',       'Operations', '+966 501 234 567', 1),
(7, 'driver2@rawabilogistics.com',    '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'Mohammed', 'Khan',          'driver',       'Operations', '+966 502 345 678', 1),
(8, 'driver3@rawabilogistics.com',    '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'Fatima',   'Al-Zahrani',    'driver',       'Operations', '+966 503 456 789', 1);

-- ============================================
-- EMPLOYEES
-- ============================================
INSERT IGNORE INTO employees (id, employee_code, user_id, first_name, last_name, email, phone, department, position, hire_date, salary, nationality, status) VALUES
(1, 'EMP-001', 6, 'Ahmed',    'Al-Rashid',  'ahmed@rawabi.com',    '+966 501 234 567', 'Operations', 'Senior Driver',      '2020-01-15', 8500.00,  'Saudi',      'active'),
(2, 'EMP-002', 7, 'Mohammed', 'Khan',        'mohammed@rawabi.com', '+966 502 345 678', 'Operations', 'Driver',             '2021-03-10', 7000.00,  'Pakistani',  'active'),
(3, 'EMP-003', 8, 'Fatima',   'Al-Zahrani', 'fatima@rawabi.com',   '+966 503 456 789', 'Operations', 'Senior Driver',      '2019-06-20', 9000.00,  'Saudi',      'active'),
(4, 'EMP-004', 2, 'Omar',     'Al-Zahrani', 'omar@rawabi.com',     '+966 504 567 890', 'Management', 'Operations Manager', '2018-05-01', 18000.00, 'Saudi',      'active'),
(5, 'EMP-005', 3, 'Fatima',   'Al-Rashidi', 'fatimahr@rawabi.com', '+966 505 678 901', 'Finance',    'Senior Accountant',  '2019-08-15', 12000.00, 'Saudi',      'active'),
(6, 'EMP-006', 4, 'Sara',     'Al-Otaibi',  'sara@rawabi.com',     '+966 506 789 012', 'HR',         'HR Manager',         '2020-02-01', 10000.00, 'Saudi',      'active'),
(7, 'EMP-007', 5, 'Khalid',   'Al-Ghamdi',  'khalid@rawabi.com',   '+966 507 890 123', 'Operations', 'Senior Dispatcher',  '2021-06-01', 9500.00,  'Saudi',      'active'),
(8, 'EMP-008', NULL, 'Noura',  'Al-Shehri',  'noura@rawabi.com',    '+966 508 901 234', 'Finance',    'Junior Accountant',  '2022-09-01', 7500.00,  'Saudi',      'active'),
(9, 'EMP-009', NULL, 'Tariq',  'Al-Harbi',   'tariq@rawabi.com',    '+966 509 012 345', 'Operations', 'Warehouse Supervisor','2021-11-15',8000.00,  'Saudi',      'active');

-- ============================================
-- DRIVERS
-- ============================================
INSERT IGNORE INTO drivers (id, employee_id, license_number, license_type, license_expiry, medical_certificate_expiry, years_of_experience, rating, total_trips, status) VALUES
(1, 1, 'SA-123456789', 'heavy',    '2026-12-31', '2026-04-30', 8,  5.0, 1250, 'available'),
(2, 2, 'SA-987654321', 'heavy',    '2027-03-15', '2025-09-15', 5,  4.5,  890, 'available'),
(3, 3, 'SA-456789123', 'trailer',  '2026-08-20', '2025-12-20', 12, 4.9, 2100, 'on_trip'),
(4, 9, 'SA-321654987', 'light',    '2025-06-30', '2025-06-30', 3,  3.8,  320, 'available');

-- ============================================
-- VEHICLES
-- ============================================
INSERT IGNORE INTO vehicles (id, vehicle_code, plate_number, vehicle_type, brand, model, year, capacity_kg, trailer_type, fuel_type, registration_expiry, insurance_expiry, status, total_km, fuel_efficiency) VALUES
(1, 'VEH-001', 'KSA-1234', 'truck_7ton',  'Mercedes', 'Actros 1845', 2022, 7000,  'flatbed',     'diesel', '2026-12-31', '2026-12-31', 'active',      45000, 3.2),
(2, 'VEH-002', 'KSA-5678', 'truck_7ton',  'Volvo',    'FH16 750',    2021, 7000,  'curtainside', 'diesel', '2025-10-15', '2025-10-15', 'active',      78000, 3.0),
(3, 'VEH-003', 'KSA-9012', 'trailer',     'Scania',   'R500',        2023, 25000, 'lowbed',      'diesel', '2026-03-20', '2026-03-20', 'active',      12000, 2.6),
(4, 'VEH-004', 'KSA-3456', 'truck_3ton',  'Isuzu',    'FVR 34',      2020, 3000,  'sidewall',    'diesel', '2025-08-10', '2025-08-10', 'maintenance', 95000, 4.1),
(5, 'VEH-005', 'KSA-7890', 'truck_10ton', 'MAN',      'TGX 26.540',  2022, 10000, 'refrigerated','diesel', '2026-06-15', '2026-06-15', 'active',      32000, 2.9),
(6, 'VEH-006', 'KSA-2345', 'van',         'Toyota',   'Hiace',       2023, 1500,  NULL,          'petrol', '2026-09-30', '2026-09-30', 'active',       8000, 6.5);

-- ============================================
-- VEHICLE-DRIVER ASSIGNMENTS
-- ============================================
INSERT IGNORE INTO vehicle_assignments (id, vehicle_id, driver_id, assigned_date, is_primary) VALUES
(1, 2, 1, '2024-01-15', 1),
(2, 3, 3, '2024-03-01', 1),
(3, 5, 2, '2024-06-01', 1);

-- ============================================
-- CUSTOMERS
-- ============================================
INSERT IGNORE INTO customers (id, customer_code, company_name, contact_person, email, phone, mobile, address, city, country, tax_number, cr_number, credit_limit, payment_terms, customer_type, status, created_by) VALUES
(1, 'CUST-001', 'Saudi Aramco',          'Khalid Al-Farsi',   'procurement@aramco.com',        '+966 13 872 0000', '+966 501 111 222', 'Dhahran Industrial Area',      'Dhahran', 'Saudi Arabia', '300123456700003', '1010123456', 500000, 30,  'corporate',  'active', 1),
(2, 'CUST-002', 'Alfanar Group',          'Abdullah Al-Mutairi','logistics@alfanar.com',         '+966 11 454 8888', '+966 502 333 444', 'Riyadh Industrial City',       'Riyadh',  'Saudi Arabia', '300987654300003', '1010654321', 200000, 45,  'corporate',  'active', 1),
(3, 'CUST-003', 'Binladin Group',         'Omar Binladin',      'transport@binladin.com.sa',     '+966 12 657 0000', '+966 503 555 666', 'Jeddah Islamic Port Area',     'Jeddah',  'Saudi Arabia', '300456789000003', '1010789012', 350000, 60,  'government', 'active', 1),
(4, 'CUST-004', 'Almarai Company',        'Fahad Al-Marri',     'supply@almarai.com',            '+966 11 470 0000', '+966 504 777 888', 'Al Kharj Dairy Complex',       'Riyadh',  'Saudi Arabia', '300789012300003', '1010901234', 150000, 30,  'vip',        'active', 1),
(5, 'CUST-005', 'SABIC Industries',       'Nasser Al-Shehri',   'logistics@sabic.com',           '+966 13 660 0000', '+966 505 888 999', 'Jubail Industrial City',       'Jubail',  'Saudi Arabia', '300111222300003', '1010234567', 400000, 30,  'corporate',  'active', 1),
(6, 'CUST-006', 'Al Rajhi Cement',        'Saleh Al-Qahtani',   'transport@alrajhicement.com',   '+966 16 542 0000', '+966 506 999 000', 'Buraydah Industrial Area',     'Buraydah','Saudi Arabia', '300222333400003', '1010345678', 100000, 45,  'regular',    'active', 1),
(7, 'CUST-007', 'National Guard Housing', 'Majed Al-Dosari',    'contracts@nghc.gov.sa',         '+966 11 250 0000', '+966 507 111 333', 'Riyadh',                       'Riyadh',  'Saudi Arabia', '300333444500003', '1010456789', 750000, 60,  'government', 'active', 1);

-- ============================================
-- SHIPMENTS (with approval workflow fields)
-- ============================================
INSERT IGNORE INTO shipments (id, shipment_number, customer_id, order_date, requested_pickup_date, requested_delivery_date, actual_pickup_date, actual_delivery_date, origin_address, origin_city, destination_address, destination_city, cargo_type, cargo_description, weight_kg, volume_cbm, pieces, transport_mode, service_type, vehicle_id, driver_id, status, approval_status, approved_by, tracking_number, quoted_amount, final_amount, created_by) VALUES
(1, 'RAW-2503-1001', 1, '2025-03-01', '2025-03-02', '2025-03-04', '2025-03-02 08:00:00', '2025-03-04 15:30:00', 'Dhahran Industrial Area', 'Dhahran', 'Jubail Industrial City', 'Jubail',   'Industrial Equipment', 'Heavy machinery parts for oil refinery',      5000, 25, 5,   'road', 'standard', 1, 1, 'delivered',  'approved', 2, 'TRK-20250301-001', 8500.00,  8500.00,  5),
(2, 'RAW-2503-1002', 2, '2025-03-03', '2025-03-04', '2025-03-06', '2025-03-04 09:00:00', NULL,                  'Riyadh Industrial City',  'Riyadh',  'Dammam Port',            'Dammam',   'Electrical Materials', 'Cables and transformers',                     3500, 18, 12,  'road', 'express',  2, 2, 'in_transit', 'approved', 2, 'TRK-20250303-002', 6200.00,  NULL,     5),
(3, 'RAW-2503-1003', 3, '2025-03-04', '2025-03-05', '2025-03-09', '2025-03-05 07:30:00', NULL,                  'Jeddah Islamic Port',     'Jeddah',  'King Abdullah Eco City', 'KAEC',     'Construction Materials','Steel beams and concrete panels',             12000,45, 20,  'road', 'standard', 3, 3, 'picked_up',  'approved', 2, 'TRK-20250304-003', 18500.00, NULL,     5),
(4, 'RAW-2503-1004', 4, '2025-03-05', '2025-03-06', '2025-03-08', NULL,                  NULL,                  'Al Kharj Dairy Farm',     'Al Kharj','Riyadh Distribution',    'Riyadh',   'Dairy Products',       'Refrigerated milk and yogurt',                2500, 12, 150, 'road', 'express',  NULL,NULL,'confirmed',  'approved', 2, 'TRK-20250305-004', 4500.00,  NULL,     5),
(5, 'RAW-2503-1005', 1, '2025-03-06', '2025-03-07', '2025-03-11', NULL,                  NULL,                  'Ras Tanura Port',         'Ras Tanura','Yanbu Industrial City', 'Yanbu',   'Petrochemicals',       'Raw materials for processing',                8000, 30, 8,   'road', 'standard', NULL,NULL,'pending',    'pending_approval', NULL, 'TRK-20250306-005', 12000.00, NULL,     5),
(6, 'RAW-2503-1006', 5, '2025-03-07', '2025-03-08', '2025-03-10', NULL,                  NULL,                  'Jubail Chemical Complex',  'Jubail',  'Riyadh Warehouse',       'Riyadh',   'Chemicals',            'Industrial solvents - hazardous',             6500, 22, 15,  'road', 'standard', NULL,NULL,'pending',    'draft',    NULL,    'TRK-20250307-006', 9500.00,  NULL,     5),
(7, 'RAW-2503-1007', 6, '2025-03-08', '2025-03-09', '2025-03-12', NULL,                  NULL,                  'Buraydah Cement Plant',    'Buraydah','Riyadh Construction',    'Riyadh',   'Construction Materials','Cement bags and additives',                   8000, 35, 200, 'road', 'economy',  NULL,NULL,'pending',    'pending_approval', NULL, 'TRK-20250308-007', 7200.00,  NULL,     5),
(8, 'RAW-2503-1008', 7, '2025-03-09', '2025-03-10', '2025-03-14', NULL,                  NULL,                  'Riyadh Government Complex','Riyadh',  'Eastern Province HQ',    'Dammam',   'Office Equipment',     'Furniture and electronics',                   3000, 20, 85,  'road', 'standard', NULL,NULL,'pending',    'approved', 2,    'TRK-20250309-008', 5500.00,  NULL,     5);

-- ============================================
-- SHIPMENT TRACKING
-- ============================================
INSERT IGNORE INTO shipment_tracking (shipment_id, event_type, event_description, location, event_time, recorded_by) VALUES
(1, 'CREATED',   'Shipment order created',                        'Dammam Office',    '2025-03-01 09:00:00', 5),
(1, 'CONFIRMED', 'Shipment confirmed and approved',               'Dammam Office',    '2025-03-01 11:00:00', 2),
(1, 'PICKED_UP', 'Cargo collected from origin',                   'Dhahran',          '2025-03-02 08:15:00', 5),
(1, 'IN_TRANSIT','Vehicle departed towards destination',          'Dhahran-Jubail Rd','2025-03-02 09:00:00', 5),
(1, 'DELIVERED', 'Cargo delivered and confirmed by recipient',    'Jubail',           '2025-03-04 15:30:00', 5),
(2, 'CREATED',   'Shipment order created',                        'Dammam Office',    '2025-03-03 10:00:00', 5),
(2, 'CONFIRMED', 'Shipment confirmed and approved',               'Dammam Office',    '2025-03-03 12:00:00', 2),
(2, 'PICKED_UP', 'Cargo collected from origin',                   'Riyadh',           '2025-03-04 09:00:00', 5),
(2, 'IN_TRANSIT','En route to Dammam Port',                       'Riyadh-Dammam Rd', '2025-03-04 10:30:00', 5),
(3, 'CREATED',   'Shipment order created',                        'Dammam Office',    '2025-03-04 08:00:00', 5),
(3, 'CONFIRMED', 'Shipment confirmed and approved',               'Dammam Office',    '2025-03-04 10:00:00', 2),
(3, 'PICKED_UP', 'Oversized cargo collected, escort arranged',    'Jeddah',           '2025-03-05 07:30:00', 5);

-- ============================================
-- INVOICES
-- ============================================
INSERT IGNORE INTO invoices (id, invoice_number, shipment_id, customer_id, invoice_date, due_date, subtotal, tax_amount, total_amount, paid_amount, balance_due, status, payment_terms, notes, created_by) VALUES
(1, 'INV-2503-001', 1, 1, '2025-03-04', '2025-04-03', 8500.00,  1275.00, 9775.00,  9775.00, 0.00,     'paid',    30, 'Paid via bank transfer on 2025-03-20', 3),
(2, 'INV-2503-002', 2, 2, '2025-03-05', '2025-04-19', 6200.00,  930.00,  7130.00,  0.00,    7130.00,  'sent',    45, 'Net 45 payment terms apply',           3),
(3, 'INV-2503-003', 3, 3, '2025-03-05', '2025-05-04', 18500.00, 2775.00, 21275.00, 0.00,    21275.00, 'draft',   60, 'Pending final delivery confirmation',   3),
(4, 'INV-2503-004', 4, 4, '2025-03-06', '2025-04-05', 4500.00,  675.00,  5175.00,  2500.00, 2675.00,  'partial', 30, 'Partial payment received',             3),
(5, 'INV-2503-005', 1, 1, '2025-02-15', '2025-03-17', 12000.00, 1800.00, 13800.00, 0.00,    13800.00, 'overdue', 30, 'Follow up required',                   3);

-- ============================================
-- INVOICE ITEMS
-- ============================================
INSERT IGNORE INTO invoice_items (invoice_id, description, quantity, unit, unit_price, total_price) VALUES
(1, 'Road freight - Dhahran to Jubail (5000 kg)',  1,    'trip', 7500.00, 7500.00),
(1, 'Fuel surcharge',                              1,    'lump', 800.00,  800.00),
(1, 'Handling fee',                                1,    'lump', 200.00,  200.00),
(2, 'Express road freight - Riyadh to Dammam',    1,    'trip', 5500.00, 5500.00),
(2, 'Express surcharge (30%)',                     1,    'lump', 700.00,  700.00),
(3, 'Road freight - Jeddah to KAEC (12000 kg)',   1,    'trip',16000.00,16000.00),
(3, 'Oversized load permit',                       1,    'lump', 1500.00, 1500.00),
(3, 'Escort vehicle cost',                         1,    'lump', 1000.00, 1000.00),
(4, 'Express freight - Al Kharj to Riyadh',       1,    'trip', 4000.00, 4000.00),
(4, 'Cold chain handling',                         1,    'lump',  500.00,  500.00);

-- ============================================
-- PAYMENTS
-- ============================================
INSERT IGNORE INTO payments (id, payment_number, invoice_id, customer_id, payment_date, amount, payment_method, reference_number, bank_name, notes, received_by) VALUES
(1, 'PAY-2503-001', 1, 1, '2025-03-20', 9775.00, 'bank_transfer', 'TRF-SAR-20250320', 'Al Rajhi Bank',   'Full payment for INV-2503-001', 3),
(2, 'PAY-2503-002', 4, 4, '2025-03-15', 2500.00, 'bank_transfer', 'TRF-SAR-20250315', 'Saudi National Bank', 'Partial payment for INV-2503-004', 3);

-- ============================================
-- EXPENSES
-- ============================================
INSERT IGNORE INTO expenses (id, expense_number, expense_date, category, description, amount, vehicle_id, driver_id, vendor_name, receipt_number, payment_method, status, created_by) VALUES
(1, 'EXP-2503-001', '2025-03-01', 'maintenance', 'Brake system overhaul - KSA-3456',      3500.00, 4,    NULL, 'Al-Jazirah Auto Workshop', 'WS-INV-0123', 'bank_transfer', 'paid',     5),
(2, 'EXP-2503-002', '2025-03-02', 'fuel',        'Diesel fill-up fleet - weekly',          2289.00, NULL, NULL, 'SASCO Stations',           'FLT-W09-001', 'company_card', 'paid',     5),
(3, 'EXP-2503-003', '2025-03-03', 'toll',        'Highway tolls - Dammam to Riyadh route', 125.00,  NULL, 2,    'Saudi Toll Roads',          'TOLL-456',    'cash',         'approved', 5),
(4, 'EXP-2503-004', '2025-03-05', 'fuel',        'Diesel - KSA-1234 trip to Jubail',       610.40,  1,    1,    'SASCO Dammam',             'RCP-001',     'company_card', 'paid',     5),
(5, 'EXP-2503-005', '2025-03-06', 'maintenance', 'Tire replacement - KSA-5678',            2400.00, 2,    NULL, 'Volvo Service Center',     'VSC-2025-055','bank_transfer', 'approved', 5),
(6, 'EXP-2503-006', '2025-03-07', 'other',       'Driver accommodation - overnight Jeddah', 450.00, NULL, 3,    'Golden Tulip Hotel',       'HTL-2025-112','cash',         'pending',  5),
(7, 'EXP-2503-007', '2025-03-08', 'fuel',        'Diesel - KSA-9012 Jeddah to KAEC',       981.00,  3,    3,    'Al-Drees Jeddah',          'RCP-003',     'company_card', 'paid',     5);

-- ============================================
-- MAINTENANCE RECORDS
-- ============================================
INSERT IGNORE INTO maintenance_records (id, vehicle_id, maintenance_type, service_date, completion_date, description, service_provider, cost, parts_replaced, next_service_date, next_service_km, status, performed_by) VALUES
(1, 4, 'repair',     '2025-03-01', '2025-03-03', 'Brake system overhaul and full replacement',         'Al-Jazirah Auto Workshop', 3500.00, 'Brake pads, discs, hydraulic fluid',      '2025-09-01', 105000, 'completed', 2),
(2, 1, 'routine',    '2025-03-05', '2025-03-05', 'Regular oil change, filter, and safety inspection',  'Mercedes Authorized Service', 850.00, 'Engine oil 15W-40, oil filter, air filter', '2025-06-05', 50000,  'completed', 2),
(3, 2, 'tire_change','2025-02-28', '2025-02-28', 'Full set tire replacement with new Michelin X Works','Volvo Service Center',      4800.00, '6x Michelin X Works XD 315/80 R22.5',    '2025-08-28', 85000,  'completed', 2),
(4, 3, 'inspection', '2025-03-10', NULL,          'Annual roadworthy inspection and certification',      'Saudi Transport Authority', 650.00,  NULL,                                      '2026-03-10', NULL,   'scheduled', 2),
(5, 5, 'oil_change', '2025-03-08', '2025-03-08', 'Engine oil change and lubrication service',          'MAN Service Center Riyadh', 780.00,  'MAN approved engine oil 10W-40',          '2025-06-08', 38000,  'completed', 2);

-- ============================================
-- FUEL RECORDS
-- ============================================
INSERT IGNORE INTO fuel_records (vehicle_id, driver_id, fuel_date, fuel_station, fuel_type, quantity_liters, price_per_liter, total_cost, odometer_reading, receipt_number) VALUES
(1, 1, '2025-03-05', 'SASCO Dammam',        'diesel', 280, 2.18, 610.40, 45280, 'RCP-2503-001'),
(2, 2, '2025-03-04', 'Petromin Riyadh',      'diesel', 320, 2.18, 697.60, 78320, 'RCP-2503-002'),
(3, 3, '2025-03-05', 'Al-Drees Jeddah',      'diesel', 450, 2.18, 981.00, 12450, 'RCP-2503-003'),
(5, 2, '2025-03-07', 'Total Energies Jubail','diesel', 300, 2.18, 654.00, 32300, 'RCP-2503-004'),
(1, 1, '2025-03-10', 'SASCO Ras Tanura',     'diesel', 260, 2.18, 566.80, 45680, 'RCP-2503-005'),
(2, 3, '2025-03-09', 'Petromin Dammam',      'diesel', 290, 2.18, 632.20, 78610, 'RCP-2503-006');
