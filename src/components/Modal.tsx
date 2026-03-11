// ─────────────────────────────────────────────────────────────────
// src/components/Modal.tsx
// Standard dark-theme modal shell.
// Replaces the repeated boilerplate in every page file.
//
// Usage:
//   import Modal from '@/components/Modal';
//
//   <Modal open={showCreate} onClose={() => setShowCreate(false)} title="New User">
//     <div className="p-6 space-y-4">
//       ... form content ...
//     </div>
//     <ModalFooter onClose={...} onSave={handleCreate} saving={saving} />
//   </Modal>
// ─────────────────────────────────────────────────────────────────
import React from 'react';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  /** Max width Tailwind class — defaults to 'max-w-md' */
  maxWidth?: string;
  children: React.ReactNode;
}

export default function Modal({ open, onClose, title, subtitle, maxWidth = 'max-w-md', children }: ModalProps) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className={`relative w-full ${maxWidth} bg-[#0d0f14] rounded-2xl border border-white/10 shadow-2xl flex flex-col max-h-[90vh] overflow-hidden`}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 flex-shrink-0">
          <div>
            <h2 className="text-sm font-semibold text-white">{title}</h2>
            {subtitle && <p className="text-[11px] text-slate-500 mt-0.5">{subtitle}</p>}
          </div>
          <button onClick={onClose} className="p-1.5 rounded-md hover:bg-white/5 text-slate-400 hover:text-white transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>
        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto">
          {children}
        </div>
      </div>
    </div>
  );
}

// ── ModalFooter ──────────────────────────────────────────────────
// Standard Save / Cancel button row.
interface ModalFooterProps {
  onClose: () => void;
  onSave: () => void;
  saving?: boolean;
  saveLabel?: string;
  cancelLabel?: string;
  saveDisabled?: boolean;
  /** 'danger' renders the save button in red (e.g. for delete confirms) */
  variant?: 'primary' | 'danger';
}

export function ModalFooter({
  onClose, onSave, saving = false,
  saveLabel = 'Save', cancelLabel = 'Cancel',
  saveDisabled = false,
  variant = 'primary',
}: ModalFooterProps) {
  const saveCls = variant === 'danger'
    ? 'bg-red-600 hover:bg-red-500'
    : 'bg-blue-600 hover:bg-blue-500';

  return (
    <div className="flex gap-3 px-6 py-4 border-t border-white/5 flex-shrink-0">
      <button
        onClick={onClose}
        className="flex-1 py-2 text-xs border border-white/10 rounded-lg text-slate-400 hover:text-white transition-colors">
        {cancelLabel}
      </button>
      <button
        onClick={onSave}
        disabled={saving || saveDisabled}
        className={`flex-1 py-2 text-xs font-medium text-white rounded-lg transition-colors disabled:opacity-50 ${saveCls}`}>
        {saving ? 'Saving…' : saveLabel}
      </button>
    </div>
  );
}
