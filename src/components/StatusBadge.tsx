// ─────────────────────────────────────────────────────────────────
// src/components/StatusBadge.tsx
// Single component to render any status badge.
// Eliminates the 29+ repeated <span className={STATUS_MAP[v]}> patterns.
//
// Usage:
//   import StatusBadge from '@/components/StatusBadge';
//   import { SHIPMENT_STATUS } from '@/lib/statusStyles';
//
//   <StatusBadge value={shipment.status} map={SHIPMENT_STATUS} />
//   <StatusBadge value={shipment.status} map={SHIPMENT_STATUS} border />
//   <StatusBadge value={employee.status} map={EMPLOYEE_STATUS} size="sm" />
// ─────────────────────────────────────────────────────────────────

interface StatusBadgeProps {
  /** The raw status value (e.g. 'pending', 'delivered') */
  value: string | null | undefined;
  /** The status→className map from statusStyles.ts */
  map: Record<string, string>;
  /** Show a border (some badges need it, some don't) */
  border?: boolean;
  /** 'sm' = text-[10px], 'md' = text-xs (default: 'sm') */
  size?: 'sm' | 'md';
  /** Additional Tailwind classes */
  className?: string;
}

export default function StatusBadge({
  value,
  map,
  border = false,
  size = 'sm',
  className = '',
}: StatusBadgeProps) {
  if (!value) return null;
  const base = map[value] || 'bg-slate-500/15 text-slate-400 border-slate-500/20';
  const sz   = size === 'sm' ? 'text-[10px]' : 'text-xs';
  const bd   = border ? 'border' : '';
  const label = value.replace(/_/g, ' ');

  return (
    <span className={`inline-block px-2 py-0.5 rounded-full font-medium capitalize ${sz} ${bd} ${base} ${className}`}>
      {label}
    </span>
  );
}
