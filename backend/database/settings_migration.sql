-- ============================================================
-- Rawabi ERP — Settings Migration
-- Inserts missing settings keys. INSERT IGNORE skips existing rows.
-- ============================================================

INSERT IGNORE INTO settings (setting_key, setting_value, setting_group, description) VALUES
-- Finance
('tax_rate',                 '15',                    'finance',   'VAT rate percentage'),
('invoice_prefix',           'INV',                   'finance',   'Invoice number prefix'),
('invoice_payment_terms',    '30',                    'finance',   'Default payment terms in days'),
('currency',                 'SAR',                   'finance',   'System currency'),
('currency_symbol',          'SAR',                   'finance',   'Currency symbol or code'),
-- Company extended
('company_phone_2',          '',                      'company',   'Secondary phone number'),
('company_fax',              '',                      'company',   'Fax number'),
('company_website',          '',                      'company',   'Company website URL'),
('company_cr_number',        '',                      'company',   'Commercial Registration number'),
('company_logo_url',         '',                      'company',   'Logo URL for invoices'),
-- Operations
('working_days',             'Sun,Mon,Tue,Wed,Thu',   'operations','Working days (comma-separated)'),
('working_hours_start',      '08:00',                 'operations','Shift start time'),
('working_hours_end',        '17:00',                 'operations','Shift end time'),
('fiscal_year_start',        '01-01',                 'operations','Fiscal year start MM-DD'),
('default_annual_leave',     '21',                    'operations','Default annual leave days (Saudi Labor Law minimum)'),
-- System
('timezone',                 'Asia/Riyadh',           'system',    'System timezone'),
('date_format',              'DD/MM/YYYY',            'system',    'Date display format'),
('session_timeout_minutes',  '60',                    'system',    'Session timeout in minutes'),
('password_min_length',      '8',                     'system',    'Minimum password length');
