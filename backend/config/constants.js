// ─────────────────────────────────────────────────────────────────
// backend/config/constants.js
// All magic numbers and configuration values in one place.
// When GOSI rates change, you change ONE number here.
// ─────────────────────────────────────────────────────────────────

// ── GOSI (General Organization for Social Insurance) ──────────────
// Saudi nationals only. Rates as of 2024 per GOSI regulations.
// Contributions are calculated on: basic_salary + housing_allowance
export const GOSI = {
    EMPLOYEE_RATE: 0.0975,  // 9.75% — deducted from employee gross
    EMPLOYER_RATE: 0.1175,  // 11.75% — paid by company on top
};

// ── Payroll defaults ───────────────────────────────────────────────
export const PAYROLL = {
    // Default overtime multiplier (Saudi Labour Law: 1.5x for hours beyond 8/day)
    OVERTIME_MULTIPLIER: 1.5,
    // Default working days used to calculate daily rate from monthly salary
    WORKING_DAYS_PER_MONTH: 26,
    // Working hours per day (used in overtime calculation)
    WORKING_HOURS_PER_DAY: 8,
};

// ── Notification thresholds ────────────────────────────────────────
// How many days before expiry to start alerting
export const ALERT_DAYS = {
    LICENSE_EXPIRY:    30,   // driver license, vehicle registration
    DOCUMENT_EXPIRY:   30,   // employee visa, passport, work permit
    INSURANCE_EXPIRY:  30,   // vehicle insurance
    CUSTOMS_STUCK:      3,   // days before a shipment in customs triggers alert
    UNRESOLVED_ALERT:   7,   // days before a medium alert escalates to high
};

// ── Pagination ─────────────────────────────────────────────────────
export const PAGINATION = {
    DEFAULT_LIMIT: 50,
    MAX_LIMIT:    200,
};

// ── JWT ────────────────────────────────────────────────────────────
export const JWT_EXPIRY = '24h';

// ── Role groups (backend) ──────────────────────────────────────────
// These mirror the ROLES object in src/lib/roles.ts.
// Used by controllers that need role checks without importing routes.
export const ROLE_GROUPS = {
    SUPER_ADMIN:  ['super_admin'],
    ADMIN_UP:     ['super_admin', 'admin'],
    MANAGEMENT:   ['super_admin', 'admin', 'office_admin'],
    FINANCE:      ['super_admin', 'admin', 'accountant'],
    OPERATIONS:   ['super_admin', 'admin', 'dispatcher'],
    FLEET_VIEW:   ['super_admin', 'admin', 'office_admin', 'dispatcher'],
};
