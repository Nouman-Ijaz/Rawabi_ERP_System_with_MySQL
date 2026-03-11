import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { financeApi } from '@/lib/api';
import { toast } from 'sonner';

import { loadJsPDF } from '@/lib/pdf';
import { fmtSAR, fmtDate, today } from '@/lib/format';

// ── jsPDF CDN loader ───────────────────────────────────────────────

// ── Build a single payment page in an existing doc ────────────────
function buildPaymentPage(doc: any, p: any, isFirstPage: boolean) {
  const W = 210, pad = 15;
  if (!isFirstPage) doc.addPage();

  // Header bar
  doc.setFillColor(5, 150, 105);
  doc.rect(0, 0, W, 26, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(13); doc.setFont('helvetica', 'bold');
  doc.text('PAYMENT RECEIPT', pad, 10);
  doc.setFontSize(8); doc.setFont('helvetica', 'normal');
  doc.text('Rawabi Logistics Co.', pad, 16);
  doc.text(p.payment_number, W - pad, 10, { align: 'right' });
  doc.setFontSize(7);
  doc.text(fmtDate(p.payment_date), W - pad, 16, { align: 'right' });

  // Method badge
  const methodColors: Record<string, [number, number, number]> = {
    cash: [5, 150, 105], bank_transfer: [37, 99, 235], check: [124, 58, 237],
    credit_card: [245, 158, 11], online: [6, 182, 212],
  };
  const mc = methodColors[p.payment_method] || [100, 116, 139];
  doc.setFillColor(...mc);
  doc.roundedRect(W - pad - 28, 5, 28, 8, 2, 2, 'F');
  doc.setFontSize(7); doc.setFont('helvetica', 'bold');
  doc.text((p.payment_method || '').replace('_', ' ').toUpperCase(), W - pad - 14, 10.2, { align: 'center' });

  // Customer + amount block
  doc.setTextColor(30, 41, 59);
  doc.setFontSize(9); doc.setFont('helvetica', 'bold');
  doc.text(p.customer_name || '—', pad, 36);
  doc.setFontSize(8); doc.setFont('helvetica', 'normal'); doc.setTextColor(100, 116, 139);
  doc.text('Customer', pad, 41);

  doc.setFontSize(16); doc.setFont('helvetica', 'bold'); doc.setTextColor(5, 150, 105);
  doc.text(fmtSAR(p.amount), W - pad, 38, { align: 'right' });
  doc.setFontSize(7); doc.setFont('helvetica', 'normal'); doc.setTextColor(100, 116, 139);
  doc.text('Amount Paid', W - pad, 43, { align: 'right' });

  // Divider
  doc.setDrawColor(226, 232, 240); doc.setLineWidth(0.2);
  doc.line(pad, 47, W - pad, 47);

  // Detail fields grid
  const fields: [string, string][] = [
    ['Invoice',     p.invoice_number || '—'],
    ['Payment Date',fmtDate(p.payment_date)],
    ['Method',      (p.payment_method || '').replace('_', ' ')],
    ['Reference',   p.reference_number || '—'],
    ['Bank',        p.bank_name || '—'],
    ['Received By', p.received_by_name || '—'],
  ];
  let fx = pad, fy = 55;
  fields.forEach(([label, val], i) => {
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(fx, fy, 85, 16, 2, 2, 'F');
    doc.setFontSize(7); doc.setFont('helvetica', 'normal'); doc.setTextColor(100, 116, 139);
    doc.text(label.toUpperCase(), fx + 4, fy + 5.5);
    doc.setFontSize(9); doc.setFont('helvetica', 'bold'); doc.setTextColor(30, 41, 59);
    doc.text(val, fx + 4, fy + 12);
    fx = fx === pad ? pad + 90 : pad;
    if (i % 2 === 1) fy += 20;
  });

  // Notes
  if (p.notes) {
    fy += 4;
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(pad, fy, W - pad * 2, 14, 2, 2, 'F');
    doc.setFontSize(7); doc.setFont('helvetica', 'normal'); doc.setTextColor(100, 116, 139);
    doc.text('NOTES', pad + 4, fy + 5);
    doc.setFontSize(8); doc.setTextColor(30, 41, 59);
    doc.text(doc.splitTextToSize(p.notes, W - pad * 2 - 8), pad + 4, fy + 10);
  }

  // Footer
  const pageH = 297;
  doc.setFillColor(248, 250, 252);
  doc.rect(0, pageH - 14, W, 14, 'F');
  doc.setFontSize(7); doc.setTextColor(148, 163, 184); doc.setFont('helvetica', 'normal');
  doc.text('Rawabi Logistics Co. · Payment Receipt', pad, pageH - 5);
  doc.text(`Generated ${fmtDate(new Date().toISOString())}`, W - pad, pageH - 5, { align: 'right' });
}

const METHOD_STYLE: Record<string, string> = {
  cash:          'bg-emerald-500/15 text-emerald-400',
  bank_transfer: 'bg-blue-500/15 text-blue-400',
  check:         'bg-purple-500/15 text-purple-400',
  credit_card:   'bg-amber-500/15 text-amber-400',
  online:        'bg-cyan-500/15 text-cyan-400',
};

function DIn({ label, ...props }: any) {
  return (
    <div>
      {label && <label className="block text-[11px] text-slate-500 mb-1">{label}</label>}
      <input {...props}
        className="w-full px-3 py-2 text-xs bg-[#0f1117] border border-white/10 rounded-lg text-white placeholder-slate-600 focus:outline-none focus:border-blue-500/50" />
    </div>
  );
}
function DSel({ label, children, ...props }: any) {
  return (
    <div>
      {label && <label className="block text-[11px] text-slate-500 mb-1">{label}</label>}
      <select {...props}
        className="w-full px-3 py-2 text-xs bg-[#0f1117] border border-white/10 rounded-lg text-white focus:outline-none focus:border-blue-500/50">
        {children}
      </select>
    </div>
  );
}
function DTA({ label, ...props }: any) {
  return (
    <div>
      {label && <label className="block text-[11px] text-slate-500 mb-1">{label}</label>}
      <textarea {...props}
        className="w-full px-3 py-2 text-xs bg-[#0f1117] border border-white/10 rounded-lg text-white placeholder-slate-600 focus:outline-none focus:border-blue-500/50 resize-none" />
    </div>
  );
}

export default function Payments() {
  const { hasPermission } = useAuth();
  const canEdit = hasPermission(['super_admin', 'admin', 'accountant']);

  const [payments, setPayments]         = useState<any[]>([]);
  const [loading, setLoading]           = useState(true);
  const [showCreate, setShowCreate]     = useState(false);
  const [openInvoices, setOpenInvoices] = useState<any[]>([]);
  const [saving, setSaving]             = useState(false);
  const [viewPayment, setViewPayment]   = useState<any>(null);
  const [pdfBusy, setPdfBusy]           = useState(false);

  // Totals
  const [totalCollected, setTotalCollected] = useState(0);

  // Form
  const [invoiceId, setInvoiceId]           = useState('');
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null);
  const [paymentDate, setPaymentDate]       = useState(today());
  const [amount, setAmount]                 = useState('');
  const [paymentMethod, setPaymentMethod]   = useState('bank_transfer');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [bankName, setBankName]             = useState('');
  const [notes, setNotes]                   = useState('');

  // Filters
  const [from, setFrom] = useState('');
  const [to, setTo]     = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (from) params.from = from;
      if (to)   params.to   = to;
      const data = await financeApi.getAllPayments(params);
      setPayments(data);
      setTotalCollected(data.reduce((s: number, p: any) => s + Number(p.amount), 0));
    } catch { toast.error('Failed to load payments'); }
    finally { setLoading(false); }
  }, [from, to]);

  useEffect(() => { load(); }, [load]);

  // Load open invoices when modal opens
  useEffect(() => {
    if (!showCreate) return;
    financeApi.getAllInvoices({ status: 'sent' })
      .then(data => setOpenInvoices(data))
      .catch(() => {});
    // Also get partial invoices
    financeApi.getAllInvoices({ status: 'partial' })
      .then(data => setOpenInvoices(prev => {
        const ids = new Set(prev.map((i: any) => i.id));
        return [...prev, ...data.filter((i: any) => !ids.has(i.id))];
      }))
      .catch(() => {});
  }, [showCreate]);

  const handleInvoicePick = (id: string) => {
    setInvoiceId(id);
    const inv = openInvoices.find(i => String(i.id) === id);
    setSelectedInvoice(inv || null);
    if (inv) setAmount(String(Number(inv.balance_due).toFixed(2)));
  };

  const resetForm = () => {
    setInvoiceId(''); setSelectedInvoice(null);
    setPaymentDate(today()); setAmount('');
    setPaymentMethod('bank_transfer'); setReferenceNumber('');
    setBankName(''); setNotes('');
  };

  const handleCreate = async () => {
    if (!invoiceId)      return toast.error('Select an invoice');
    if (!amount || Number(amount) <= 0) return toast.error('Enter a valid amount');
    if (!paymentMethod)  return toast.error('Select a payment method');
    setSaving(true);
    try {
      const inv = openInvoices.find(i => String(i.id) === invoiceId);
      const res = await financeApi.createPayment({
        invoiceId:  parseInt(invoiceId),
        customerId: inv?.customer_id,
        paymentDate, amount: parseFloat(amount),
        paymentMethod, referenceNumber, bankName, notes,
      });
      toast.success(`Payment ${res.paymentNumber} recorded`);
      setShowCreate(false);
      resetForm();
      load();
    } catch (e: any) {
      toast.error(e.message || 'Failed to record payment');
    } finally { setSaving(false); }
  };

  // ── PDF: single receipt ─────────────────────────────────────────
  const printSinglePdf = async (p: any) => {
    setPdfBusy(true);
    toast.info('Generating receipt…');
    try {
      const jsPDF = await loadJsPDF();
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      buildPaymentPage(doc, p, true);
      const safe = (p.customer_name || 'Payment').replace(/[^a-zA-Z0-9 _-]/g, '').trim();
      doc.save(`${p.payment_number} - ${safe}.pdf`);
      toast.success('Receipt downloaded');
    } catch { toast.error('PDF generation failed'); }
    finally { setPdfBusy(false); }
  };

  // ── PDF: bulk — all visible payments ───────────────────────────
  const downloadAllPdf = async () => {
    if (payments.length === 0) { toast.error('No payments to export'); return; }
    setPdfBusy(true);
    toast.info(`Building PDF for ${payments.length} payments…`);
    try {
      const jsPDF = await loadJsPDF();
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      payments.forEach((p, i) => buildPaymentPage(doc, p, i === 0));
      const stamp = new Date().toISOString().slice(0, 10);
      doc.save(`Rawabi-Payments-${stamp}.pdf`);
      toast.success(`${payments.length} payments exported`);
    } catch { toast.error('PDF export failed'); }
    finally { setPdfBusy(false); }
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Payments</h1>
          <p className="text-xs text-slate-500 mt-0.5">{payments.length} recorded · Total collected {fmtSAR(totalCollected)}</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={downloadAllPdf} disabled={pdfBusy || loading || payments.length === 0}
            className="flex items-center gap-1.5 px-3 py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white text-xs font-medium rounded-lg transition-colors disabled:opacity-40">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
            {pdfBusy ? 'Generating…' : 'Download All PDF'}
          </button>
          {canEdit && (
            <button onClick={() => { resetForm(); setShowCreate(true); }}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg transition-colors">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/></svg>
              Record Payment
            </button>
          )}
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Total Collected', value: fmtSAR(totalCollected), color: 'text-emerald-400', icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z' },
          { label: 'This Month', value: fmtSAR(payments.filter(p => p.payment_date?.startsWith(new Date().toISOString().slice(0,7))).reduce((s,p) => s + Number(p.amount), 0)), color: 'text-blue-400', icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z' },
          { label: 'Transactions', value: payments.length.toString(), color: 'text-purple-400', icon: 'M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z' },
        ].map(c => (
          <div key={c.label} className="bg-[#1a1d27] rounded-xl p-4 border border-white/5">
            <div className="flex items-center gap-2 mb-2">
              <svg className={`w-4 h-4 ${c.color}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={c.icon}/></svg>
              <span className="text-[11px] text-slate-500">{c.label}</span>
            </div>
            <p className={`text-xl font-bold ${c.color} tabular-nums`}>{c.value}</p>
          </div>
        ))}
      </div>

      {/* Date filters */}
      <div className="flex items-center gap-3">
        <input type="date" value={from} onChange={e => setFrom(e.target.value)}
          style={{ colorScheme: 'dark' }}
          className="px-3 py-2 text-xs bg-[#1a1d27] border border-white/10 rounded-lg text-white focus:outline-none focus:border-blue-500/40 [&::-webkit-calendar-picker-indicator]:opacity-80" />
        <span className="text-slate-500 text-xs">to</span>
        <input type="date" value={to} onChange={e => setTo(e.target.value)}
          style={{ colorScheme: 'dark' }}
          className="px-3 py-2 text-xs bg-[#1a1d27] border border-white/10 rounded-lg text-white focus:outline-none focus:border-blue-500/40 [&::-webkit-calendar-picker-indicator]:opacity-80" />
        {(from || to) && (
          <button onClick={() => { setFrom(''); setTo(''); }} className="text-[11px] text-slate-400 hover:text-white">Clear</button>
        )}
      </div>

      {/* Table */}
      <div className="bg-[#1a1d27] rounded-xl border border-white/5 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-white/5">
                {['Payment #','Invoice','Customer','Date','Amount','Method','Actions'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-[11px] font-medium text-slate-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="px-4 py-12 text-center text-slate-500">Loading...</td></tr>
              ) : payments.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-12 text-center text-slate-500">No payments recorded</td></tr>
              ) : payments.map(p => (
                <tr key={p.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                  <td className="px-4 py-3 font-mono text-emerald-400 font-medium">{p.payment_number}</td>
                  <td className="px-4 py-3 text-blue-400">{p.invoice_number || '—'}</td>
                  <td className="px-4 py-3 text-white font-medium max-w-[140px] truncate">{p.customer_name}</td>
                  <td className="px-4 py-3 text-slate-400">{fmtDate(p.payment_date)}</td>
                  <td className="px-4 py-3 text-emerald-400 font-bold tabular-nums">{fmtSAR(p.amount)}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${METHOD_STYLE[p.payment_method] || 'bg-slate-500/15 text-slate-400'}`}>
                      {p.payment_method?.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <button onClick={() => setViewPayment(p)}
                      className="px-2.5 py-1 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 rounded text-[10px] font-medium transition-colors">
                      View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── CREATE MODAL ── */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-[#1a1d27] rounded-2xl border border-white/10 shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
              <h2 className="text-sm font-bold text-white">Record Payment</h2>
              <button onClick={() => setShowCreate(false)} className="p-1 text-slate-400 hover:text-white">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
              </button>
            </div>
            <div className="p-6 space-y-4">

              {/* Invoice selection */}
              <DSel label="Invoice" value={invoiceId} onChange={(e: any) => handleInvoicePick(e.target.value)}>
                <option value="">— Select invoice —</option>
                {openInvoices.map(inv => (
                  <option key={inv.id} value={inv.id}>
                    {inv.invoice_number} · {inv.customer_name} · Balance: SAR {Number(inv.balance_due).toFixed(2)}
                  </option>
                ))}
              </DSel>

              {selectedInvoice && (
                <div className="bg-[#0f1117] rounded-lg p-3 border border-white/5 text-xs grid grid-cols-3 gap-2">
                  <div><p className="text-slate-500">Invoice Total</p><p className="text-white font-semibold">{fmtSAR(selectedInvoice.total_amount)}</p></div>
                  <div><p className="text-slate-500">Already Paid</p><p className="text-emerald-400 font-semibold">{fmtSAR(selectedInvoice.paid_amount)}</p></div>
                  <div><p className="text-slate-500">Balance Due</p><p className="text-red-400 font-bold">{fmtSAR(selectedInvoice.balance_due)}</p></div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] text-slate-500 mb-1">Payment Date</label>
                  <input type="date" value={paymentDate} onChange={e => setPaymentDate(e.target.value)}
                    style={{ colorScheme: 'dark' }}
                    className="w-full px-3 py-2 text-xs bg-[#0f1117] border border-white/10 rounded-lg text-white focus:outline-none focus:border-blue-500/50 [&::-webkit-calendar-picker-indicator]:opacity-80" />
                </div>
                <DIn label="Amount (SAR)" type="number" min="0.01" step="0.01" value={amount} onChange={(e: any) => setAmount(e.target.value)} placeholder="0.00" />
              </div>

              <DSel label="Payment Method" value={paymentMethod} onChange={(e: any) => setPaymentMethod(e.target.value)}>
                <option value="bank_transfer">Bank Transfer</option>
                <option value="cash">Cash</option>
                <option value="check">Check</option>
                <option value="credit_card">Credit Card</option>
                <option value="online">Online</option>
              </DSel>

              <div className="grid grid-cols-2 gap-3">
                <DIn label="Reference / Transaction No." value={referenceNumber} onChange={(e: any) => setReferenceNumber(e.target.value)} placeholder="e.g. TXN-001" />
                <DIn label="Bank Name" value={bankName} onChange={(e: any) => setBankName(e.target.value)} placeholder="e.g. Al Rajhi Bank" />
              </div>

              <DTA label="Notes" value={notes} onChange={(e: any) => setNotes(e.target.value)} rows={2} placeholder="Optional notes..." />
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-white/5">
              <button onClick={() => setShowCreate(false)} className="px-4 py-2 text-xs text-slate-400 hover:text-white transition-colors">Cancel</button>
              <button onClick={handleCreate} disabled={saving || !invoiceId || !amount}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-semibold rounded-lg transition-colors">
                {saving ? 'Saving...' : `Record SAR ${Number(amount || 0).toFixed(2)}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── PAYMENT DETAIL MODAL ── */}
      {viewPayment && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-[#1a1d27] rounded-2xl border border-white/10 shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
              <div>
                <h2 className="text-sm font-bold text-white font-mono">{viewPayment.payment_number}</h2>
                <p className="text-[11px] text-slate-500 mt-0.5">{viewPayment.customer_name}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${METHOD_STYLE[viewPayment.payment_method] || 'bg-slate-500/15 text-slate-400'}`}>
                  {(viewPayment.payment_method || '').replace('_', ' ')}
                </span>
                <button onClick={() => setViewPayment(null)} className="p-1 text-slate-400 hover:text-white ml-1">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
                </button>
              </div>
            </div>
            {/* Amount hero */}
            <div className="px-6 py-4 bg-emerald-500/5 border-b border-white/5">
              <p className="text-[10px] text-slate-500 uppercase tracking-wide mb-1">Amount Paid</p>
              <p className="text-2xl font-bold text-emerald-400 tabular-nums">{fmtSAR(viewPayment.amount)}</p>
            </div>
            <div className="p-6 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                {([
                  ['Payment Date',  fmtDate(viewPayment.payment_date)],
                  ['Invoice',       viewPayment.invoice_number || '—'],
                  ['Reference No.', viewPayment.reference_number || '—'],
                  ['Bank',          viewPayment.bank_name || '—'],
                  ['Received By',   viewPayment.received_by_name || '—'],
                  ['Customer',      viewPayment.customer_name || '—'],
                ] as [string,string][]).map(([label, val]) => (
                  <div key={label} className="bg-[#0f1117] rounded-lg p-3">
                    <div className="text-[10px] text-slate-500 uppercase tracking-wide mb-1">{label}</div>
                    <div className="text-xs text-white font-medium">{val}</div>
                  </div>
                ))}
              </div>
              {viewPayment.notes && (
                <div className="bg-[#0f1117] rounded-lg p-3">
                  <div className="text-[10px] text-slate-500 uppercase tracking-wide mb-1">Notes</div>
                  <div className="text-xs text-slate-300 whitespace-pre-wrap">{viewPayment.notes}</div>
                </div>
              )}
            </div>
            <div className="flex items-center justify-between px-6 py-4 border-t border-white/5">
              <button onClick={() => printSinglePdf(viewPayment)} disabled={pdfBusy}
                className="flex items-center gap-1.5 px-4 py-2 bg-blue-600/15 hover:bg-blue-600/30 text-blue-400 text-xs font-medium rounded-lg transition-colors disabled:opacity-40">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"/></svg>
                {pdfBusy ? 'Generating…' : 'Print Receipt PDF'}
              </button>
              <button onClick={() => setViewPayment(null)} className="px-4 py-2 text-xs text-slate-400 hover:text-white transition-colors">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
