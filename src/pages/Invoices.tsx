import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { financeApi } from '@/lib/api';
import { toast } from 'sonner';

// ── helpers ──────────────────────────────────────────────────────
import { fmtSAR, fmtDate, today } from '@/lib/format';
const addDays = (d: string, n: number) => {
  const dt = new Date(d); dt.setDate(dt.getDate() + n);
  return dt.toISOString().split('T')[0];
};

import { loadJsPDF } from '@/lib/pdf';
import { INVOICE_STATUS } from '@/lib/statusStyles';

// ── sub-components ────────────────────────────────────────────────
function DIn({ label, ...props }: any) {
  return (
    <div>
      {label && <label className="block text-[11px] text-slate-500 mb-1">{label}</label>}
      <input {...props}
        className="w-full px-3 py-2 text-xs bg-[#0f1117] border border-white/10 rounded-lg text-white placeholder-slate-600 focus:outline-none focus:border-blue-500/50" />
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


interface LineItem { description: string; quantity: number; unit: string; unitPrice: number; }
function emptyLine(): LineItem { return { description: '', quantity: 1, unit: '', unitPrice: 0 }; }

// ── Main component ────────────────────────────────────────────────
export default function Invoices() {
  const { hasPermission } = useAuth();
  const canEdit = hasPermission(['super_admin', 'admin', 'accountant']);

  const [invoices, setInvoices]           = useState<any[]>([]);
  const [loading, setLoading]             = useState(true);
  const [selected, setSelected]           = useState<any | null>(null);
  const [showCreate, setShowCreate]       = useState(false);
  const [showDetail, setShowDetail]       = useState(false);
  const [company, setCompany]             = useState<any>({});
  const [deliverables, setDeliverables]   = useState<any[]>([]);
  const [filterStatus, setFilterStatus]   = useState('');
  const [search, setSearch]               = useState('');

  // Create form state
  const [shipmentId, setShipmentId]       = useState('');
  const [customerId, setCustomerId]       = useState('');
  const [invoiceDate, setInvoiceDate]     = useState(today());
  const [paymentTerms, setPaymentTerms]   = useState(30);
  const [dueDate, setDueDate]             = useState(addDays(today(), 30));
  const [notes, setNotes]                 = useState('');
  const [lines, setLines]                 = useState<LineItem[]>([emptyLine()]);
  const [saving, setSaving]               = useState(false);
  const [confirmStatus, setConfirmStatus]   = useState<{id:number;status:string}|null>(null);
  const [lastChangedId, setLastChangedId]   = useState<number|null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (filterStatus) params.status = filterStatus;
      if (search)       params.search  = search;
      const data = await financeApi.getAllInvoices(params);
      setInvoices(data);
    } catch { toast.error('Failed to load invoices'); }
    finally { setLoading(false); }
  }, [filterStatus, search]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    financeApi.getCompanySettings().then(setCompany).catch(() => {});
    if (canEdit) financeApi.getDeliverableShipments().then(setDeliverables).catch(() => {});
  }, []);

  // When shipment selected in create form — auto-populate
  const handleShipmentPick = (sid: string) => {
    setShipmentId(sid);
    const s = deliverables.find(d => String(d.id) === sid);
    if (!s) return;
    setCustomerId(String(s.customer_id));
    const amount = parseFloat(s.final_amount || s.quoted_amount || 0);
    setLines([{
      description: `Freight Services — ${s.origin_city} to ${s.destination_city} (${s.shipment_number})`,
      quantity: 1,
      unit: 'shipment',
      unitPrice: amount,
    }]);
  };

  const handleTermsChange = (t: number) => {
    setPaymentTerms(t);
    setDueDate(addDays(invoiceDate, t));
  };
  const handleDateChange = (d: string) => {
    setInvoiceDate(d);
    setDueDate(addDays(d, paymentTerms));
  };

  const subtotal  = lines.reduce((s, l) => s + l.quantity * l.unitPrice, 0);
  const vatRate   = parseFloat(company?.tax_rate || 15);
  const taxAmount = subtotal * (vatRate / 100);
  const total     = subtotal + taxAmount;

  const updateLine = (i: number, field: keyof LineItem, val: any) => {
    setLines(prev => prev.map((l, idx) => idx === i ? { ...l, [field]: field === 'description' || field === 'unit' ? val : Number(val) } : l));
  };
  const addLine    = () => setLines(prev => [...prev, emptyLine()]);
  const removeLine = (i: number) => setLines(prev => prev.filter((_, idx) => idx !== i));

  const handleCreate = async () => {
    if (!customerId) return toast.error('Select a shipment or customer');
    if (lines.some(l => !l.description)) return toast.error('All line items need a description');
    setSaving(true);
    try {
      const payload = {
        customerId:   parseInt(customerId),
        shipmentId:   shipmentId ? parseInt(shipmentId) : null,
        invoiceDate, dueDate, paymentTerms, notes,
        items: lines.map(l => ({ description: l.description, quantity: l.quantity, unit: l.unit, unitPrice: l.unitPrice })),
      };
      const res = await financeApi.createInvoice(payload);
      toast.success(`Invoice ${res.invoiceNumber} created`);
      setShowCreate(false);
      resetForm();
      load();
      financeApi.getDeliverableShipments().then(setDeliverables).catch(() => {});
    } catch (e: any) {
      toast.error(e.message || 'Failed to create invoice');
    } finally { setSaving(false); }
  };

  const resetForm = () => {
    setShipmentId(''); setCustomerId(''); setInvoiceDate(today());
    setPaymentTerms(30); setDueDate(addDays(today(), 30));
    setNotes(''); setLines([emptyLine()]);
  };

  const openDetail = async (inv: any) => {
    try {
      const full = await financeApi.getInvoiceById(inv.id);
      setSelected(full);
      setShowDetail(true);
    } catch { toast.error('Failed to load invoice'); }
  };

  const handleStatusChange = async (id: number, status: string) => {
    try {
      await financeApi.updateInvoiceStatus(id, status);
      toast.success('Status updated');
      setLastChangedId(id);
      setConfirmStatus(null);
      setShowDetail(false);
      load();
    } catch { toast.error('Failed to update status'); }
  };

  // Shared: builds the invoice HTML string
  const buildInvoiceHtml = () => {
    const vatRate = parseFloat(company?.tax_rate || 15);
    const itemRows = (selected.items || []).map((item: any, i: number) => `
      <tr style="border-bottom:1px solid #e2e8f0;background:${i%2===0?'white':'#f8fafc'}">
        <td style="padding:7px 10px;color:#64748b">${i+1}</td>
        <td style="padding:7px 10px">${item.description}</td>
        <td style="padding:7px 10px;text-align:center">${item.quantity} ${item.unit||''}</td>
        <td style="padding:7px 10px;text-align:right">${Number(item.unit_price).toFixed(2)}</td>
        <td style="padding:7px 10px;text-align:right;font-weight:600">${Number(item.total_price).toFixed(2)}</td>
      </tr>`).join('');
    const paidRow = Number(selected.paid_amount) > 0 ? `
      <div style="display:flex;justify-content:space-between;padding:5px 0">
        <span style="color:#16a34a">Amount Paid</span>
        <span style="font-weight:600;color:#16a34a">- SAR ${Number(selected.paid_amount).toFixed(2)}</span>
      </div>
      <div style="display:flex;justify-content:space-between;padding:6px 10px;background:#fef2f2;border-radius:6px;border:1px solid #fecaca">
        <span style="font-weight:700;color:#dc2626">Balance Due</span>
        <span style="font-weight:800;color:#dc2626">SAR ${Number(selected.balance_due).toFixed(2)}</span>
      </div>` : '';
    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>${selected.invoice_number} - ${(selected.customer_name || "").replace(/[^a-zA-Z0-9 _-]/g, "").trim()}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, sans-serif; color: #1a1a2e; background: white; padding: 30px; font-size: 12px; }
    @page { size: A4; margin: 15mm; }
    @media print { body { padding: 0; } }
  </style>
</head>
<body>
  <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:28px;border-bottom:3px solid #1e40af;padding-bottom:18px">
    <div>
      <div style="font-size:22px;font-weight:800;color:#1e40af">${company?.company_name||'Rawabi Al Hamsal Logistics'}</div>
      <div style="font-size:11px;color:#64748b;margin-top:4px;line-height:1.7">
        ${company?.company_address||'Dammam, Kingdom of Saudi Arabia'}<br/>
        ${company?.company_phone?'Tel: '+company.company_phone:''}<br/>
        ${company?.company_email?'Email: '+company.company_email:''}<br/>
        ${company?.company_tax_number?'VAT No: '+company.company_tax_number:''}
      </div>
    </div>
    <div style="text-align:right">
      <div style="font-size:26px;font-weight:900;color:#1e40af">TAX INVOICE</div>
      <div style="margin-top:10px;font-size:11px;color:#64748b;line-height:1.8">
        <strong style="color:#1a1a2e">Invoice No:</strong> ${selected.invoice_number}<br/>
        <strong style="color:#1a1a2e">Date:</strong> ${new Date(selected.invoice_date).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'})}<br/>
        <strong style="color:#1a1a2e">Due Date:</strong> ${new Date(selected.due_date).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'})}
      </div>
    </div>
  </div>
  <div style="display:flex;gap:40px;margin-bottom:24px">
    <div style="flex:1">
      <div style="font-size:10px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:1px;margin-bottom:5px">Bill To</div>
      <div style="font-size:13px;font-weight:700">${selected.customer_name}</div>
      ${selected.customer_address?`<div style="font-size:11px;color:#64748b;margin-top:2px">${selected.customer_address}</div>`:''}
      ${selected.customer_tax_number?`<div style="font-size:11px;color:#64748b">VAT No: ${selected.customer_tax_number}</div>`:''}
    </div>
    ${selected.shipment_number?`<div style="flex:1"><div style="font-size:10px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:1px;margin-bottom:5px">Shipment Reference</div><div style="font-size:13px;font-weight:700;color:#1e40af">${selected.shipment_number}</div></div>`:''}
  </div>
  <table style="width:100%;border-collapse:collapse;margin-bottom:20px;font-size:11px">
    <thead>
      <tr style="background:#1e40af;color:white">
        <th style="padding:8px 10px;text-align:left">#</th>
        <th style="padding:8px 10px;text-align:left">Description</th>
        <th style="padding:8px 10px;text-align:center">Qty</th>
        <th style="padding:8px 10px;text-align:right">Unit Price</th>
        <th style="padding:8px 10px;text-align:right">Amount (SAR)</th>
      </tr>
    </thead>
    <tbody>${itemRows}</tbody>
  </table>
  <div style="display:flex;justify-content:flex-end;margin-bottom:24px">
    <div style="width:280px;font-size:11px">
      <div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid #e2e8f0">
        <span style="color:#64748b">Subtotal</span><span style="font-weight:600">SAR ${Number(selected.subtotal).toFixed(2)}</span>
      </div>
      <div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid #e2e8f0">
        <span style="color:#64748b">VAT (${vatRate}%)</span><span style="font-weight:600">SAR ${Number(selected.tax_amount).toFixed(2)}</span>
      </div>
      <div style="display:flex;justify-content:space-between;padding:8px 10px;background:#1e40af;color:white;border-radius:6px;margin-top:4px">
        <span style="font-weight:700;font-size:12px">Total Due</span><span style="font-weight:800;font-size:13px">SAR ${Number(selected.total_amount).toFixed(2)}</span>
      </div>
      ${paidRow}
    </div>
  </div>
  ${selected.notes?`<div style="padding:10px 14px;background:#f8fafc;border-left:3px solid #1e40af;border-radius:4px;margin-bottom:16px;font-size:11px"><strong>Notes:</strong> ${selected.notes}</div>`:''}
  <div style="margin-top:36px;padding-top:14px;border-top:2px solid #e2e8f0;display:flex;justify-content:space-between;font-size:10px;color:#94a3b8">
    <div>This is a computer-generated tax invoice.</div>
    <div>Payment Terms: Net ${selected.payment_terms||30} days</div>
  </div>
</body>
</html>`;
    return html;
  };

  const handlePrint = () => {
    if (!selected) return;
    const html = buildInvoiceHtml();
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const blobUrl = URL.createObjectURL(blob);
    const w = window.open(blobUrl, '_blank', 'width=960,height=750');
    if (!w) { toast.error('Allow pop-ups to print invoices'); return; }
    w.onload = () => { w.focus(); w.print(); setTimeout(() => URL.revokeObjectURL(blobUrl), 300000); };
  };

  const handleDownloadPdf = async () => {
    if (!selected) return;
    toast.info('Generating PDF…');
    try {
      // Load jsPDF from CDN if not already loaded
      if (!(window as any).jspdf?.jsPDF) {
        const load = (src: string) => new Promise<void>((res, rej) => {
          const s = document.createElement('script');
          s.src = src; s.onload = () => res(); s.onerror = () => rej(new Error('CDN load failed'));
          document.head.appendChild(s);
        });
        await load('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js');
        await load('https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.3/jspdf.plugin.autotable.min.js');
      }
      const jsPDF = (window as any).jspdf.jsPDF;
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const inv = selected;
      const cust = inv.customer_name || 'Customer';
      const W = 210, pad = 15;

      // Header bar
      doc.setFillColor(30, 58, 95);
      doc.rect(0, 0, W, 28, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(14); doc.setFont('helvetica', 'bold');
      doc.text('INVOICE', pad, 11);
      doc.setFontSize(9); doc.setFont('helvetica', 'normal');
      doc.text('Rawabi Logistics Co.', pad, 17);
      doc.text(`${inv.invoice_number}`, W - pad, 11, { align: 'right' });
      const statusColor: Record<string, [number,number,number]> = {
        paid:      [5, 150, 105],
        overdue:   [220, 38, 38],
        sent:      [37, 99, 235],
        draft:     [100, 116, 139],
        cancelled: [100, 116, 139],
      };
      const sc = statusColor[inv.status] || [100, 116, 139];
      doc.setFillColor(...sc);
      doc.roundedRect(W - pad - 20, 6, 20, 8, 2, 2, 'F');
      doc.setFontSize(7); doc.setFont('helvetica', 'bold');
      doc.text((inv.status || '').toUpperCase(), W - pad - 10, 11.5, { align: 'center' });

      // Bill To
      doc.setTextColor(30, 41, 59);
      doc.setFontSize(8); doc.setFont('helvetica', 'bold');
      doc.text('BILL TO', pad, 38);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.text(cust, pad, 44);
      if (inv.customer_address) { doc.setFontSize(8); doc.setTextColor(100, 116, 139); doc.text(inv.customer_address, pad, 49); }

      // Dates box
      const dates: [string,string][] = [
        ['Invoice Date', fmtDate(inv.invoice_date)],
        ['Due Date',     fmtDate(inv.due_date)],
        ['Payment Terms', `Net ${inv.payment_terms || 30} days`],
      ];
      let dy = 38;
      dates.forEach(([label, val]) => {
        doc.setFontSize(7); doc.setTextColor(100, 116, 139); doc.setFont('helvetica', 'normal');
        doc.text(label, 130, dy);
        doc.setFontSize(9); doc.setTextColor(30, 41, 59); doc.setFont('helvetica', 'bold');
        doc.text(val, 195, dy, { align: 'right' });
        dy += 7;
      });

      // Line items table
      const lines = (inv.line_items || []).map((l: any) => [
        l.description || '—',
        l.unit || '—',
        Number(l.quantity || 0).toString(),
        fmtSAR(l.unit_price),
        fmtSAR((l.quantity || 0) * (l.unit_price || 0)),
      ]);
      (doc as any).autoTable({
        startY: 58,
        head: [['Description', 'Unit', 'Qty', 'Unit Price', 'Total']],
        body: lines,
        theme: 'striped',
        headStyles: { fillColor: [30, 58, 95], textColor: 255, fontSize: 8, fontStyle: 'bold' },
        bodyStyles: { fontSize: 8, textColor: [30, 41, 59] },
        columnStyles: { 0: { cellWidth: 70 }, 4: { halign: 'right' } },
        margin: { left: pad, right: pad },
      });

      const finalY = (doc as any).lastAutoTable.finalY + 5;
      // Totals
      const totals: [string, string][] = [
        ['Subtotal', fmtSAR(inv.subtotal)],
        [`VAT (${inv.vat_rate || 14}%)`, fmtSAR(inv.vat_amount)],
      ];
      let ty = finalY;
      totals.forEach(([label, val]) => {
        doc.setFontSize(8); doc.setTextColor(100, 116, 139); doc.setFont('helvetica', 'normal');
        doc.text(label, 150, ty);
        doc.setTextColor(30, 41, 59);
        doc.text(val, 195, ty, { align: 'right' });
        ty += 6;
      });
      doc.setDrawColor(30, 58, 95); doc.setLineWidth(0.3);
      doc.line(130, ty - 1, 195, ty - 1);
      doc.setFontSize(11); doc.setFont('helvetica', 'bold'); doc.setTextColor(30, 58, 95);
      doc.text('Total', 150, ty + 5);
      doc.text(fmtSAR(inv.total_amount), 195, ty + 5, { align: 'right' });

      // Payment history
      if ((inv.payments || []).length > 0) {
        const ph = inv.payments.map((p: any) => [
          p.payment_number, fmtDate(p.payment_date),
          p.payment_method?.replace('_', ' ') || '—', fmtSAR(p.amount),
        ]);
        (doc as any).autoTable({
          startY: ty + 14,
          head: [['Payment #', 'Date', 'Method', 'Amount']],
          body: ph,
          theme: 'plain',
          headStyles: { fillColor: [241, 245, 249], textColor: [30, 41, 59], fontSize: 7 },
          bodyStyles: { fontSize: 7, textColor: [100, 116, 139] },
          margin: { left: pad, right: pad },
          tableLineColor: [226, 232, 240], tableLineWidth: 0.1,
        });
      }

      // Footer
      const pageH = 297;
      doc.setFillColor(248, 250, 252);
      doc.rect(0, pageH - 16, W, 16, 'F');
      doc.setFontSize(7); doc.setTextColor(148, 163, 184); doc.setFont('helvetica', 'normal');
      doc.text('Rawabi Logistics Co. · Confidential', pad, pageH - 7);
      doc.text(`Generated ${fmtDate(new Date().toISOString())}`, W - pad, pageH - 7, { align: 'right' });

      const safeName = (cust).replace(/[^a-zA-Z0-9 _-]/g, '').trim();
      doc.save(`${inv.invoice_number} - ${safeName}.pdf`);
      toast.success('PDF downloaded');
    } catch (err) {
      console.error('PDF error:', err);
      toast.error('PDF generation failed — using print fallback');
      handlePrint();
    }
  };

  const filtered = invoices.filter(inv =>
    !search || inv.invoice_number?.toLowerCase().includes(search.toLowerCase()) ||
    inv.customer_name?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-white">Invoices</h1>
          <p className="text-xs text-slate-500 mt-0.5">{invoices.length} total — {invoices.filter(i => i.status === 'overdue').length} overdue</p>
        </div>
        {canEdit && (
          <button onClick={() => { resetForm(); setShowCreate(true); }}
            className="flex items-center gap-2 px-4 py-2 min-h-[44px] bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-lg transition-colors">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/></svg>
            New Invoice
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0"/></svg>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search invoice or customer..."
            className="w-full pl-9 pr-4 py-2 text-xs bg-[#1a1d27] border border-white/5 rounded-lg text-white placeholder-slate-600 focus:outline-none focus:border-blue-500/40" />
        </div>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
          className="px-3 py-2 text-xs bg-[#1a1d27] border border-white/5 rounded-lg text-white focus:outline-none focus:border-blue-500/40">
          <option value="">All statuses</option>
          {['draft','sent','paid','partial','overdue','cancelled'].map(s => (
            <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="bg-[#1a1d27] rounded-xl border border-white/5 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-white/5">
                {['Invoice #','Customer','Shipment','Date','Due Date','Total','Paid','Balance','Status',''].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-[11px] font-medium text-slate-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={10} className="px-4 py-12 text-center text-slate-500">Loading...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={10} className="px-4 py-12 text-center text-slate-500">No invoices found</td></tr>
              ) : filtered.map(inv => {
                const st = INVOICE_STATUS[inv.status] || STATUS_STYLE.draft;
                return (
                  <tr key={inv.id} onClick={() => openDetail(inv)}
                    className={`border-b border-white/5 hover:bg-white/5 cursor-pointer transition-all duration-500 ${
                      lastChangedId === inv.id ? 'bg-blue-500/10 ring-1 ring-inset ring-blue-500/30' : ''
                    }`}>
                    <td className="px-4 py-3 font-mono text-blue-400 font-medium">{inv.invoice_number}</td>
                    <td className="px-4 py-3 text-white font-medium max-w-[160px] truncate">{inv.customer_name}</td>
                    <td className="px-4 py-3 text-slate-400">{inv.shipment_number || '—'}</td>
                    <td className="px-4 py-3 text-slate-400">{fmtDate(inv.invoice_date)}</td>
                    <td className="px-4 py-3 text-slate-400">{fmtDate(inv.due_date)}</td>
                    <td className="px-4 py-3 text-white font-semibold tabular-nums">{fmtSAR(inv.total_amount)}</td>
                    <td className="px-4 py-3 text-emerald-400 tabular-nums">{fmtSAR(inv.paid_amount)}</td>
                    <td className="px-4 py-3 font-semibold tabular-nums" style={{ color: Number(inv.balance_due) > 0 ? '#f87171' : '#34d399' }}>{fmtSAR(inv.balance_due)}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium ${st.bg} ${st.text}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`} />
                        {inv.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <svg className="w-4 h-4 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5l7 7-7 7"/></svg>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── CREATE MODAL ── */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-end sm:items-start justify-center sm:pt-8 pb-0 sm:pb-4 px-0 sm:px-4 overflow-y-auto">
          <div className="w-full sm:max-w-3xl bg-[#1a1d27] rounded-t-2xl sm:rounded-2xl border border-white/10 shadow-2xl max-h-[95vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
              <h2 className="text-sm font-bold text-white">Create Invoice</h2>
              <button onClick={() => setShowCreate(false)} className="p-1 text-slate-400 hover:text-white">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">

              {/* Step 1: Pick shipment */}
              <div>
                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-3">1 — Select Delivered Shipment</p>
                <DSel value={shipmentId} onChange={(e: any) => handleShipmentPick(e.target.value)}>
                  <option value="">— Choose shipment (or skip for manual) —</option>
                  {deliverables.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.shipment_number} · {s.customer_name} · {s.origin_city} → {s.destination_city} · SAR {Number(s.final_amount || s.quoted_amount || 0).toFixed(2)}
                    </option>
                  ))}
                </DSel>
                {deliverables.length === 0 && (
                  <p className="text-[11px] text-amber-400 mt-1.5">No uninvoiced delivered shipments found.</p>
                )}
              </div>

              {/* Step 2: Invoice header */}
              <div>
                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-3">2 — Invoice Details</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] text-slate-500 mb-1">Invoice Date</label>
                    <input type="date" value={invoiceDate} onChange={e => handleDateChange(e.target.value)}
                      style={{ colorScheme: 'dark' }}
                      className="w-full px-3 py-2 text-xs bg-[#0f1117] border border-white/10 rounded-lg text-white focus:outline-none focus:border-blue-500/50" />
                  </div>
                  <DSel label="Payment Terms (days)" value={paymentTerms} onChange={(e: any) => handleTermsChange(Number(e.target.value))}>
                    {[15, 30, 45, 60, 90].map(t => <option key={t} value={t}>Net {t}</option>)}
                  </DSel>
                  <div>
                    <label className="block text-[11px] text-slate-500 mb-1">Due Date</label>
                    <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)}
                      style={{ colorScheme: 'dark' }}
                      className="w-full px-3 py-2 text-xs bg-[#0f1117] border border-white/10 rounded-lg text-white focus:outline-none focus:border-blue-500/50" />
                  </div>
                </div>
              </div>

              {/* Step 3: Line items */}
              <div>
                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-3">3 — Line Items</p>
                <div className="space-y-2">
                  <div className="grid grid-cols-12 gap-2 text-[10px] text-slate-500 px-1">
                    <div className="col-span-5">Description</div>
                    <div className="col-span-2">Qty</div>
                    <div className="col-span-1">Unit</div>
                    <div className="col-span-3">Unit Price (SAR)</div>
                    <div className="col-span-1"></div>
                  </div>
                  {lines.map((line, i) => (
                    <div key={i} className="grid grid-cols-12 gap-2 items-center">
                      <div className="col-span-5">
                        <input value={line.description} onChange={e => updateLine(i, 'description', e.target.value)}
                          placeholder="Description"
                          className="w-full px-2.5 py-1.5 text-xs bg-[#0f1117] border border-white/10 rounded-lg text-white placeholder-slate-600 focus:outline-none focus:border-blue-500/50" />
                      </div>
                      <div className="col-span-2">
                        <input type="number" min="0.01" step="0.01" value={line.quantity} onChange={e => updateLine(i, 'quantity', e.target.value)}
                          className="w-full px-2.5 py-1.5 text-xs bg-[#0f1117] border border-white/10 rounded-lg text-white focus:outline-none focus:border-blue-500/50" />
                      </div>
                      <div className="col-span-1">
                        <input value={line.unit} onChange={e => updateLine(i, 'unit', e.target.value)}
                          placeholder="pcs"
                          className="w-full px-2.5 py-1.5 text-xs bg-[#0f1117] border border-white/10 rounded-lg text-white placeholder-slate-600 focus:outline-none focus:border-blue-500/50" />
                      </div>
                      <div className="col-span-3">
                        <input type="number" min="0" step="0.01" value={line.unitPrice} onChange={e => updateLine(i, 'unitPrice', e.target.value)}
                          className="w-full px-2.5 py-1.5 text-xs bg-[#0f1117] border border-white/10 rounded-lg text-white focus:outline-none focus:border-blue-500/50" />
                      </div>
                      <div className="col-span-1 flex items-center justify-between">
                        <span className="text-[10px] text-slate-500 tabular-nums">{(line.quantity * line.unitPrice).toFixed(0)}</span>
                        {lines.length > 1 && (
                          <button onClick={() => removeLine(i)} className="p-1 text-slate-600 hover:text-red-400">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                  <button onClick={addLine} className="text-[11px] text-blue-400 hover:text-blue-300 flex items-center gap-1 mt-1">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/></svg>
                    Add line item
                  </button>
                </div>

                {/* Totals preview */}
                <div className="mt-4 flex justify-end">
                  <div className="w-56 space-y-1.5 text-xs">
                    <div className="flex justify-between text-slate-400">
                      <span>Subtotal</span><span className="tabular-nums">SAR {subtotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-slate-400">
                      <span>VAT ({vatRate}%)</span><span className="tabular-nums">SAR {taxAmount.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between font-bold text-white border-t border-white/10 pt-1.5">
                      <span>Total</span><span className="tabular-nums">SAR {total.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Notes */}
              <DTA label="Notes (optional)" value={notes} onChange={(e: any) => setNotes(e.target.value)} rows={2} placeholder="Payment instructions, thank-you note, etc." />
            </div>

            <div className="flex items-center justify-end gap-3 px-4 sm:px-6 py-4 border-t border-white/5 bg-[#1a1d27] sticky bottom-0">
              <button onClick={() => setShowCreate(false)} className="px-4 py-2 min-h-[44px] text-xs text-slate-400 hover:text-white transition-colors">Cancel</button>
              <button onClick={handleCreate} disabled={saving || !customerId}
                className="px-5 py-2 min-h-[44px] bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-semibold rounded-lg transition-colors">
                {saving ? 'Creating...' : `Create Invoice — SAR ${total.toFixed(2)}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── DETAIL MODAL ── */}
      {showDetail && selected && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-end sm:items-start justify-center sm:pt-8 sm:pb-4 sm:px-4 overflow-y-auto">
          <div className="w-full sm:max-w-3xl bg-[#1a1d27] rounded-t-2xl sm:rounded-2xl border border-white/10 shadow-2xl max-h-[95vh] flex flex-col overflow-hidden">
            <div className="flex items-start justify-between px-4 sm:px-6 py-4 border-b border-white/5 flex-shrink-0">
              <div>
                <h2 className="text-sm font-bold text-white">{selected.invoice_number}</h2>
                <p className="text-[11px] text-slate-500 mt-0.5">{selected.customer_name}</p>
              </div>
              <div className="flex items-center gap-2 flex-wrap justify-end">
                <button onClick={handlePrint}
                  className="flex items-center gap-1.5 px-3 py-1.5 min-h-[44px] bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-medium rounded-lg border border-white/10 transition-colors">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"/></svg>
                  Print
                </button>
                <button onClick={handleDownloadPdf}
                  className="flex items-center gap-1.5 px-3 py-1.5 min-h-[44px] bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-lg transition-colors">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
                  Save PDF
                </button>
                {canEdit && selected.status !== 'paid' && selected.status !== 'cancelled' && (
                  <select
                    defaultValue=""
                    onChange={e => { if (e.target.value) setConfirmStatus({ id: selected.id, status: e.target.value }); }}
                    className="px-3 py-1.5 min-h-[44px] text-xs bg-[#0f1117] border border-white/10 rounded-lg text-white focus:outline-none">
                    <option value="" disabled>Change status...</option>
                    {['draft','sent','partial','overdue','cancelled']
                      .filter(s => s !== selected.status)
                      .map(s => (
                        <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                    ))}
                  </select>
                )}
                <button onClick={() => setShowDetail(false)} className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-400 hover:text-white">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
              {/* Summary cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: 'Total', value: fmtSAR(selected.total_amount), color: 'text-white' },
                  { label: 'Paid', value: fmtSAR(selected.paid_amount), color: 'text-emerald-400' },
                  { label: 'Balance', value: fmtSAR(selected.balance_due), color: Number(selected.balance_due) > 0 ? 'text-red-400' : 'text-emerald-400' },
                  { label: 'Status', value: selected.status, color: INVOICE_STATUS[selected.status]?.text || 'text-slate-400' },
                ].map(c => (
                  <div key={c.label} className="bg-[#0f1117] rounded-lg p-3 border border-white/5">
                    <p className="text-[11px] text-slate-500">{c.label}</p>
                    <p className={`text-sm font-bold mt-1 ${c.color} capitalize`}>{c.value}</p>
                  </div>
                ))}
              </div>

              {/* Info row */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                <div><span className="text-slate-500">Invoice Date</span><p className="text-white mt-0.5">{fmtDate(selected.invoice_date)}</p></div>
                <div><span className="text-slate-500">Due Date</span><p className="text-white mt-0.5">{fmtDate(selected.due_date)}</p></div>
                <div><span className="text-slate-500">Shipment</span><p className="text-blue-400 mt-0.5">{selected.shipment_number || '—'}</p></div>
              </div>

              {/* Line items */}
              <div>
                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Line Items</p>
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-white/5">
                      <th className="py-2 text-left text-slate-500 font-medium">Description</th>
                      <th className="py-2 text-center text-slate-500 font-medium w-16">Qty</th>
                      <th className="py-2 text-right text-slate-500 font-medium w-28">Unit Price</th>
                      <th className="py-2 text-right text-slate-500 font-medium w-28">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(selected.items || []).map((item: any, i: number) => (
                      <tr key={i} className="border-b border-white/5">
                        <td className="py-2 text-white">{item.description}</td>
                        <td className="py-2 text-center text-slate-400">{item.quantity} {item.unit}</td>
                        <td className="py-2 text-right text-slate-400 tabular-nums">{fmtSAR(item.unit_price)}</td>
                        <td className="py-2 text-right text-white font-semibold tabular-nums">{fmtSAR(item.total_price)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="flex justify-end mt-3">
                  <div className="w-48 space-y-1 text-xs">
                    <div className="flex justify-between text-slate-400"><span>Subtotal</span><span className="tabular-nums">{fmtSAR(selected.subtotal)}</span></div>
                    <div className="flex justify-between text-slate-400"><span>VAT ({vatRate}%)</span><span className="tabular-nums">{fmtSAR(selected.tax_amount)}</span></div>
                    <div className="flex justify-between text-white font-bold border-t border-white/10 pt-1"><span>Total</span><span className="tabular-nums">{fmtSAR(selected.total_amount)}</span></div>
                  </div>
                </div>
              </div>

              {/* Payment history */}
              {selected.payments?.length > 0 && (
                <div>
                  <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Payment History</p>
                  <div className="space-y-1.5">
                    {selected.payments.map((p: any) => (
                      <div key={p.id} className="flex items-center justify-between py-2 px-3 bg-[#0f1117] rounded-lg border border-white/5">
                        <div>
                          <p className="text-xs font-medium text-white">{p.payment_number}</p>
                          <p className="text-[11px] text-slate-500">{fmtDate(p.payment_date)} · {p.payment_method?.replace('_',' ')} {p.reference_number ? `· Ref: ${p.reference_number}` : ''}</p>
                        </div>
                        <p className="text-sm font-bold text-emerald-400 tabular-nums">{fmtSAR(p.amount)}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {selected.notes && (
                <div className="bg-[#0f1117] rounded-lg p-3 border border-white/5">
                  <p className="text-[11px] text-slate-500 mb-1">Notes</p>
                  <p className="text-xs text-slate-300">{selected.notes}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── STATUS CONFIRM DIALOG ── */}
      {confirmStatus && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-[#1a1d27] rounded-2xl border border-white/10 shadow-2xl p-6">
            <div className="w-10 h-10 rounded-full bg-amber-500/15 flex items-center justify-center mb-4">
              <svg className="w-5 h-5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/></svg>
            </div>
            <h3 className="text-sm font-bold text-white mb-1">Confirm Status Change</h3>
            <p className="text-xs text-slate-400 mb-5">
              Change invoice status to{' '}
              <span className="font-semibold text-white capitalize">{confirmStatus.status}</span>?
              This will be recorded in the activity log.
            </p>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setConfirmStatus(null)}
                className="flex-1 px-4 py-2 text-xs text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 rounded-lg transition-colors">
                Cancel
              </button>
              <button
                onClick={() => handleStatusChange(confirmStatus.id, confirmStatus.status)}
                className="flex-1 px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-lg transition-colors">
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
