// ─────────────────────────────────────────────────────────────────
// src/lib/cx.ts
// Canonical Tailwind class strings for form controls.
// Import from here — never define inp / sel locally in a page file.
//
// Usage:
//   import { inp, sel, fSel, textarea } from '@/lib/cx';
//   <input className={inp} ... />
//   <select className={sel} ... />
// ─────────────────────────────────────────────────────────────────

/** Dark-themed text input / textarea */
export const inp =
  'w-full bg-[#0c0e13] border border-white/10 rounded-lg px-3 py-2 text-xs ' +
  'text-white placeholder-slate-600 focus:outline-none focus:border-blue-500/50 ' +
  'focus:ring-1 focus:ring-blue-500/20 transition-colors';

/** Dark-themed <select> — adds appearance-none + cursor + color-scheme */
export const sel =
  inp + ' appearance-none cursor-pointer [color-scheme:dark]';

/** Filter-bar <select> — lighter background, used outside modals */
export const fSel =
  'px-3 py-2 text-xs bg-[#1a1d27] border border-white/5 rounded-lg text-white ' +
  'focus:outline-none focus:border-blue-500/40 cursor-pointer [color-scheme:dark]';

/** Filter-bar text input (search boxes in page headers) */
export const fInp =
  'bg-[#1a1d27] border border-white/5 rounded-lg pl-9 pr-3 py-2 text-xs ' +
  'text-white placeholder-slate-600 focus:outline-none focus:border-blue-500/40';
