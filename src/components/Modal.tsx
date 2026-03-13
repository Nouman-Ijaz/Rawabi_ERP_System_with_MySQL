// ─────────────────────────────────────────────────────────────────
// src/components/Modal.tsx
//
// Three variants:
//   centered — centered on all screens (small/medium forms, confirms)
//   sheet    — bottom-sheet mobile, centered desktop
//   page     — large modal, full-width mobile, page-level scrolling
//
// Usage:
//   import Modal, { ModalFooter, ConfirmModal } from '@/components/Modal';
//
//   <Modal
//     open={showCreate}
//     onClose={() => setShowCreate(false)}
//     title="New Customer"
//     variant="sheet"
//     maxWidth="max-w-lg"
//     footer={
//       <ModalFooter
//         onClose={() => setShowCreate(false)}
//         onSave={handleSave}
//         saving={saving}
//         saveLabel="Create Customer"
//       />
//     }
//   >
//     <div className="p-4 sm:p-6 space-y-4">
//       ... form fields ...
//     </div>
//   </Modal>
//
//   <ConfirmModal
//     open={!!deleteId}
//     onClose={() => setDeleteId(null)}
//     title="Delete Customer"
//     message="This cannot be undone."
//     confirmLabel="Delete"
//     variant="danger"
//     onConfirm={handleDelete}
//   />
// ─────────────────────────────────────────────────────────────────
import React from 'react';

type ModalVariant = 'centered' | 'sheet' | 'page';

// ── Variant layout maps ──────────────────────────────────────────
const BACKDROP: Record<ModalVariant, string> = {
  // Standard centered overlay
  centered:
    'fixed inset-0 z-50 flex items-center justify-center p-4',
  // Bottom-sheet on mobile, centered on sm+
  sheet:
    'fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4',
  // Large modal — backdrop IS the scroll container, no click-outside-close
  page:
    'fixed inset-0 z-50 bg-black/70 backdrop-blur-sm overflow-y-auto px-0 sm:px-4 pt-0 sm:pt-6 pb-10',
};

const PANEL: Record<ModalVariant, string> = {
  centered:
    'relative w-full bg-[#1a1d27] rounded-2xl border border-white/10 shadow-2xl flex flex-col max-h-[90vh] overflow-hidden',
  sheet:
    'relative w-full bg-[#1a1d27] rounded-t-2xl sm:rounded-2xl border border-white/10 shadow-2xl flex flex-col max-h-[95vh] overflow-hidden',
  page:
    'relative w-full bg-[#1a1d27] sm:rounded-2xl border-0 sm:border border-white/10 shadow-2xl mx-auto sm:my-4 flex flex-col min-h-screen sm:min-h-0',
};

// ── Props ────────────────────────────────────────────────────────
interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  /** Tailwind max-width class — defaults to 'max-w-md' */
  maxWidth?: string;
  variant?: ModalVariant;
  /**
   * Rendered in the header row to the right of the title,
   * before the close button. Use for action buttons, status
   * selects, etc.
   */
  headerActions?: React.ReactNode;
  /**
   * Rendered OUTSIDE the scrollable content area, pinned to the
   * bottom of the panel. Pass a <ModalFooter> here.
   */
  footer?: React.ReactNode;
  children: React.ReactNode;
}

export default function Modal({
  open, onClose, title, subtitle,
  maxWidth = 'max-w-md',
  variant = 'centered',
  headerActions,
  footer,
  children,
}: ModalProps) {
  if (!open) return null;

  const panelCls = `${PANEL[variant]} ${maxWidth}`;

  // Page variant: backdrop IS the scroll container.
  // No click-outside-close — prevents accidental dismissal of large forms.
  if (variant === 'page') {
    return (
      <div className={BACKDROP.page}>
        <div className={panelCls}>
          <ModalHeader
            title={title}
            subtitle={subtitle}
            onClose={onClose}
            actions={headerActions}
          />
          <div className="flex-1">
            {children}
          </div>
          {footer}
        </div>
      </div>
    );
  }

  // Centered / sheet: standard overlay backdrop with click-outside-close
  return (
    <div className={BACKDROP[variant]}>
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className={panelCls}>
        <ModalHeader
          title={title}
          subtitle={subtitle}
          onClose={onClose}
          actions={headerActions}
        />
        <div className="flex-1 overflow-y-auto">
          {children}
        </div>
        {footer}
      </div>
    </div>
  );
}

// ── Internal header ──────────────────────────────────────────────
function ModalHeader({
  title, subtitle, onClose, actions,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-white/5 flex-shrink-0">
      <div className="min-w-0 flex-1 mr-3">
        <h2 className="text-sm font-semibold text-white leading-snug">{title}</h2>
        {subtitle && (
          <p className="text-[11px] text-slate-500 mt-0.5">{subtitle}</p>
        )}
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        {actions}
        <button
          onClick={onClose}
          className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-md hover:bg-white/5 text-slate-400 hover:text-white transition-colors"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>
    </div>
  );
}

// ── ModalFooter ──────────────────────────────────────────────────
// Pass as the `footer` prop of Modal, not inside children.
interface ModalFooterProps {
  onClose: () => void;
  onSave: () => void;
  saving?: boolean;
  saveLabel?: string;
  cancelLabel?: string;
  saveDisabled?: boolean;
  /** Controls the save button colour */
  variant?: 'primary' | 'danger' | 'warning';
}

export function ModalFooter({
  onClose,
  onSave,
  saving = false,
  saveLabel = 'Save',
  cancelLabel = 'Cancel',
  saveDisabled = false,
  variant = 'primary',
}: ModalFooterProps) {
  const saveCls =
    variant === 'danger'
      ? 'bg-red-600 hover:bg-red-500'
      : variant === 'warning'
      ? 'bg-amber-600 hover:bg-amber-500'
      : 'bg-blue-600 hover:bg-blue-500';

  return (
    <div className="flex gap-3 px-4 sm:px-6 py-4 border-t border-white/5 flex-shrink-0 bg-[#1a1d27]">
      <button
        onClick={onClose}
        className="flex-1 py-2.5 min-h-[44px] text-xs border border-white/10 rounded-lg text-slate-400 hover:text-white transition-colors"
      >
        {cancelLabel}
      </button>
      <button
        onClick={onSave}
        disabled={saving || saveDisabled}
        className={`flex-1 py-2.5 min-h-[44px] text-xs font-medium text-white rounded-lg transition-colors disabled:opacity-50 ${saveCls}`}
      >
        {saving ? 'Saving…' : saveLabel}
      </button>
    </div>
  );
}

// ── ConfirmModal ─────────────────────────────────────────────────
// Lightweight confirm dialog — no Modal wrapper needed.
// For destructive actions (delete, deactivate) or simple acknowledgements.
interface ConfirmModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  /** Can be a string or any ReactNode (e.g. <p>…</p> with <span> highlights) */
  message: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  busy?: boolean;
  /** Controls the confirm button colour */
  variant?: 'primary' | 'danger' | 'warning';
}

export function ConfirmModal({
  open,
  onClose,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  onConfirm,
  busy = false,
  variant = 'primary',
}: ConfirmModalProps) {
  if (!open) return null;

  const btnCls =
    variant === 'danger'
      ? 'bg-red-600 hover:bg-red-500'
      : variant === 'warning'
      ? 'bg-amber-600 hover:bg-amber-500'
      : 'bg-blue-600 hover:bg-blue-500';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative w-full max-w-sm bg-[#1a1d27] rounded-2xl border border-white/10 shadow-2xl p-6">
        <h3 className="text-sm font-semibold text-white mb-2">{title}</h3>
        <div className="text-xs text-slate-400 mb-5 leading-relaxed">
          {message}
        </div>
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 min-h-[44px] text-xs border border-white/10 rounded-lg text-slate-400 hover:text-white transition-colors"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            disabled={busy}
            className={`flex-1 py-2.5 min-h-[44px] text-xs font-medium text-white rounded-lg transition-colors disabled:opacity-50 ${btnCls}`}
          >
            {busy ? 'Working…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
