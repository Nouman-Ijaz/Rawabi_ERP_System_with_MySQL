// ─────────────────────────────────────────────────────────────────
// src/lib/format.ts
// Single source of truth for currency and date formatting.
// Import from here — never define fmtSAR / fmtDate in a page file.
// ─────────────────────────────────────────────────────────────────

/**
 * Format a number as Saudi Riyal.
 * Default: 2 decimal places.
 * Pass decimals=0 for whole-number display (e.g. report charts).
 *
 * fmtSAR(1234.5)     → "SAR 1,234.50"
 * fmtSAR(1234.5, 0)  → "SAR 1,235"
 * fmtSAR(null)       → "SAR 0.00"
 * fmtSAR(0, 0)       → "SAR 0"
 */
export const fmtSAR = (n: any, decimals = 2): string => {
  const num = parseFloat(n ?? 0) || 0;
  return `SAR ${num.toLocaleString('en-SA', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}`;
};

/**
 * Compact SAR for chart axes: values ≥ 1000 → "1.2k", else plain number string.
 * fmtSARk(1234)  → "1k"
 * fmtSARk(500)   → "500"
 */
export const fmtSARk = (v: number): string =>
  v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v);

/**
 * Format a date string as "12 Jan 2025".
 * Returns fallback (default "—") when value is null / undefined / empty.
 *
 * fmtDate('2025-01-12')         → "12 Jan 2025"
 * fmtDate(null)                 → "—"
 * fmtDate(undefined, 'Never')   → "Never"
 */
export const fmtDate = (d: string | null | undefined, fallback = '—'): string =>
  d
    ? new Date(d).toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      })
    : fallback;

/**
 * Format a datetime string as "12 Jan 2025, 14:30".
 * fmtDateTime('2025-01-12T14:30:00') → "12 Jan 2025, 14:30"
 */
export const fmtDateTime = (d: string | null | undefined, fallback = '—'): string =>
  d
    ? new Date(d).toLocaleString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : fallback;

/**
 * Today's date as an ISO string "YYYY-MM-DD".
 * Replaces inline `new Date().toISOString().split('T')[0]` throughout.
 */
export const today = (): string => new Date().toISOString().split('T')[0];
