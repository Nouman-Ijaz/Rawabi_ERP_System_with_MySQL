// ─────────────────────────────────────────────────────────────────
// src/lib/statusStyles.ts
// Canonical Tailwind class maps for every status badge in the app.
// Use these instead of re-defining STATUS_STYLE in each page file.
//
// Usage:
//   import { SHIPMENT_STATUS, EMPLOYEE_STATUS } from '@/lib/statusStyles';
//   <span className={`... ${SHIPMENT_STATUS[s.status] || SHIPMENT_STATUS._default}`}>
// ─────────────────────────────────────────────────────────────────

/** Common fallback used when a status key is not in the map */
export const STATUS_DEFAULT = 'bg-slate-500/15 text-slate-400 border-slate-500/20';

// ── Shipments ──────────────────────────────────────────────────
export const SHIPMENT_STATUS: Record<string, string> = {
  pending:    'bg-yellow-500/15 text-yellow-400 border-yellow-500/20',
  confirmed:  'bg-blue-500/15 text-blue-400 border-blue-500/20',
  picked_up:  'bg-purple-500/15 text-purple-400 border-purple-500/20',
  in_transit: 'bg-indigo-500/15 text-indigo-400 border-indigo-500/20',
  customs:    'bg-orange-500/15 text-orange-400 border-orange-500/20',
  delivered:  'bg-emerald-500/15 text-emerald-400 border-emerald-500/20',
  cancelled:  'bg-red-500/15 text-red-400 border-red-500/20',
  returned:   'bg-slate-500/15 text-slate-400 border-slate-500/20',
};

export const APPROVAL_STATUS: Record<string, string> = {
  draft:            'bg-slate-500/15 text-slate-400 border-slate-500/20',
  pending_approval: 'bg-amber-500/15 text-amber-400 border-amber-500/20',
  approved:         'bg-emerald-500/15 text-emerald-400 border-emerald-500/20',
  rejected:         'bg-red-500/15 text-red-400 border-red-500/20',
};

// ── Employees ──────────────────────────────────────────────────
export const EMPLOYEE_STATUS: Record<string, string> = {
  active:     'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  inactive:   'bg-slate-500/15 text-slate-400 border-slate-500/30',
  on_leave:   'bg-amber-500/15 text-amber-400 border-amber-500/30',
  terminated: 'bg-red-500/15 text-red-400 border-red-500/30',
};

// ── Payroll periods ────────────────────────────────────────────
export const PAYROLL_STATUS: Record<string, string> = {
  draft:     'bg-slate-500/15 text-slate-400 border-slate-500/30',
  approved:  'bg-amber-500/15 text-amber-400 border-amber-500/30',
  paid:      'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  cancelled: 'bg-red-500/15 text-red-400 border-red-500/30',
};

// ── Invoices ───────────────────────────────────────────────────
/** Returns a { bg, text, dot } object — Invoices page uses all three */
export const INVOICE_STATUS: Record<string, { bg: string; text: string; dot: string }> = {
  draft:     { bg: 'bg-slate-500/15',   text: 'text-slate-400',   dot: 'bg-slate-500' },
  sent:      { bg: 'bg-blue-500/15',    text: 'text-blue-400',    dot: 'bg-blue-500' },
  paid:      { bg: 'bg-emerald-500/15', text: 'text-emerald-400', dot: 'bg-emerald-500' },
  partial:   { bg: 'bg-amber-500/15',   text: 'text-amber-400',   dot: 'bg-amber-500' },
  overdue:   { bg: 'bg-red-500/15',     text: 'text-red-400',     dot: 'bg-red-500' },
  cancelled: { bg: 'bg-slate-500/10',   text: 'text-slate-500',   dot: 'bg-slate-600' },
};

// ── Expenses ───────────────────────────────────────────────────
/** Returns a { bg, text } object — Expenses page uses both */
export const EXPENSE_STATUS: Record<string, { bg: string; text: string }> = {
  pending:  { bg: 'bg-amber-500/15',   text: 'text-amber-400' },
  approved: { bg: 'bg-emerald-500/15', text: 'text-emerald-400' },
  rejected: { bg: 'bg-red-500/15',     text: 'text-red-400' },
  paid:     { bg: 'bg-blue-500/15',    text: 'text-blue-400' },
};

// ── Customers ──────────────────────────────────────────────────
export const CUSTOMER_STATUS: Record<string, string> = {
  active:    'bg-emerald-500/15 text-emerald-400',
  inactive:  'bg-slate-500/15 text-slate-400',
  suspended: 'bg-red-500/15 text-red-400',
};

// ── Maintenance ────────────────────────────────────────────────
export const MAINTENANCE_STATUS: Record<string, string> = {
  scheduled:   'bg-blue-500/15 text-blue-400',
  in_progress: 'bg-amber-500/15 text-amber-400',
  completed:   'bg-emerald-500/15 text-emerald-400',
  cancelled:   'bg-slate-500/15 text-slate-400',
};

export const MAINTENANCE_TYPE: Record<string, string> = {
  routine:     'bg-blue-500/15 text-blue-400',
  repair:      'bg-red-500/15 text-red-400',
  inspection:  'bg-purple-500/15 text-purple-400',
  tire_change: 'bg-amber-500/15 text-amber-400',
  oil_change:  'bg-cyan-500/15 text-cyan-400',
};

// ── Vehicles ───────────────────────────────────────────────────
export const VEHICLE_STATUS: Record<string, string> = {
  active:      'bg-emerald-500/15 text-emerald-400',
  maintenance: 'bg-amber-500/15 text-amber-400',
  retired:     'bg-slate-500/15 text-slate-400',
  sold:        'bg-blue-500/15 text-blue-400',
  accident:    'bg-red-500/15 text-red-400',
};

// ── Drivers ────────────────────────────────────────────────────
export const DRIVER_STATUS: Record<string, string> = {
  available: 'bg-emerald-500/15 text-emerald-400',
  on_trip:   'bg-blue-500/15 text-blue-400',
  on_leave:  'bg-amber-500/15 text-amber-400',
  suspended: 'bg-red-500/15 text-red-400',
  off_duty:  'bg-slate-500/15 text-slate-400',
};

// ── Leave requests ─────────────────────────────────────────────
export const LEAVE_STATUS: Record<string, string> = {
  pending:   'bg-amber-500/15 text-amber-400',
  approved:  'bg-emerald-500/15 text-emerald-400',
  rejected:  'bg-red-500/15 text-red-400',
  cancelled: 'bg-slate-500/15 text-slate-400',
};

// ── Shipment status — hex colours (for Recharts / SVG charts) ──
// Mirrors SHIPMENT_STATUS but as raw hex for chart libraries.
export const SHIPMENT_HEX: Record<string, string> = {
  pending:    '#f59e0b',
  confirmed:  '#3b82f6',
  picked_up:  '#8b5cf6',
  in_transit: '#6366f1',
  customs:    '#f97316',
  delivered:  '#10b981',
  cancelled:  '#ef4444',
  returned:   '#64748b',
};

// ── Driver status — hex colours (for Recharts / SVG charts) ───
export const DRIVER_HEX: Record<string, string> = {
  available:  '#10b981',
  on_trip:    '#3b82f6',
  on_leave:   '#f59e0b',
  suspended:  '#ef4444',
  off_duty:   '#64748b',
};

// ── Expiry severity colours ────────────────────────────────────
export const EXPIRY_COLORS: Record<string, { bg: string; text: string; bar: string }> = {
  critical: { bg: 'bg-red-500/10',   text: 'text-red-400',   bar: 'bg-red-500' },
  warning:  { bg: 'bg-amber-500/10', text: 'text-amber-400', bar: 'bg-amber-500' },
  ok:       { bg: 'bg-blue-500/10',  text: 'text-blue-400',  bar: 'bg-blue-500' },
};

// ── Shipment timeline dot colours (hex, for SVG timeline) ─────
export const TIMELINE_HEX: Record<string, string> = {
  pending:          '#f59e0b',
  confirmed:        '#3b82f6',
  picked_up:        '#8b5cf6',
  in_transit:       '#6366f1',
  customs:          '#f97316',
  delivered:        '#10b981',
  cancelled:        '#ef4444',
  returned:         '#64748b',
  order_created:    '#3b82f6',
  vehicle_assigned: '#6366f1',
  rejected:         '#ef4444',
};
