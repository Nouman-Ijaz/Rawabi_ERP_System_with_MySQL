// ─────────────────────────────────────────────────────────────────
// src/lib/roles.ts
// Canonical role groupings for hasPermission() calls.
// Use these instead of repeating literal arrays in every component.
//
// Usage:
//   import { ROLES } from '@/lib/roles';
//   const canEdit = hasPermission(ROLES.ADMIN_UP);
// ─────────────────────────────────────────────────────────────────

import type { UserRole } from '@/contexts/AuthContext';

export const ROLES: Record<string, UserRole[]> = {
  /** Only super_admin */
  SUPER_ADMIN:   ['super_admin'],

  /** super_admin and admin — write access to most admin functions */
  ADMIN_UP:      ['super_admin', 'admin'],

  /** super_admin, admin, accountant — finance & payroll view */
  FINANCE:       ['super_admin', 'admin', 'accountant'],

  /** super_admin, admin, dispatcher — operations */
  OPERATIONS:    ['super_admin', 'admin', 'dispatcher'],

  /** super_admin, admin, office_admin — HR-adjacent */
  MANAGEMENT:    ['super_admin', 'admin', 'office_admin'],

  /** Fleet visibility — no accountant */
  FLEET_VIEW:    ['super_admin', 'admin', 'office_admin', 'dispatcher'],

  /** Payroll write */
  PAY_EDIT:      ['super_admin', 'admin'],

  /** Payroll read */
  PAY_VIEW:      ['super_admin', 'admin', 'accountant'],

  /** Reports access */
  REPORTS:       ['super_admin', 'admin', 'accountant', 'dispatcher'],

  /** Full shipment read — includes drivers */
  SHIPMENTS_ALL: ['super_admin', 'admin', 'office_admin', 'dispatcher', 'accountant', 'driver'],

  /** Shipment stats / analytics */
  SHIPMENTS_STATS: ['super_admin', 'admin', 'dispatcher', 'accountant'],

  /** Everyone except driver for customer access */
  CUSTOMER_VIEW: ['super_admin', 'admin', 'office_admin', 'dispatcher', 'accountant'],
} as const;
