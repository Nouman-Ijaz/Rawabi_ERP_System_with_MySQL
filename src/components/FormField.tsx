// ─────────────────────────────────────────────────────────────────
// src/components/FormField.tsx
// Standard label + input slot used in every modal form.
// Replaces the five local `function Field(...)` declarations
// in Customers, Leave, Maintenance, Payroll, and Shipments.
//
// Usage:
//   import FormField from '@/components/FormField';
//
//   <FormField label="First Name" required>
//     <input className={inp} ... />
//   </FormField>
// ─────────────────────────────────────────────────────────────────
import type { ReactNode } from 'react';

interface FormFieldProps {
  label: string;
  required?: boolean;
  hint?: string;
  children: ReactNode;
}

export default function FormField({ label, required, hint, children }: FormFieldProps) {
  return (
    <div>
      <label className="block text-[11px] font-medium text-slate-400 mb-1">
        {label}
        {required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      {children}
      {hint && <p className="text-[10px] text-slate-600 mt-1">{hint}</p>}
    </div>
  );
}
