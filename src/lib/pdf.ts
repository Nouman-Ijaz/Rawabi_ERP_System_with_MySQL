// ─────────────────────────────────────────────────────────────────
// src/lib/pdf.ts
// CDN-based jsPDF loader.  Import from here — never define
// loadJsPDF() in a page file again.
//
// Usage:
//   import { loadJsPDF } from '@/lib/pdf';
//   const jsPDF = await loadJsPDF();
//   const doc   = new jsPDF();
// ─────────────────────────────────────────────────────────────────

const JSPDF_CDN      = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
const AUTOTABLE_CDN  = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.3/jspdf.plugin.autotable.min.js';

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing) { resolve(); return; }
    const s = document.createElement('script');
    s.src     = src;
    s.onload  = () => resolve();
    s.onerror = () => reject(new Error(`CDN load failed: ${src}`));
    document.head.appendChild(s);
  });
}

/**
 * Lazily loads jsPDF + autotable from CDN (cached after first load).
 * Returns the jsPDF constructor.
 */
export async function loadJsPDF(): Promise<any> {
  if ((window as any).jspdf?.jsPDF) return (window as any).jspdf.jsPDF;
  await loadScript(JSPDF_CDN);
  await loadScript(AUTOTABLE_CDN);
  return (window as any).jspdf.jsPDF;
}
