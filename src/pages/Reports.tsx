import { useEffect, useState, useCallback, useRef } from 'react';
import { financeApi, reportsApi } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend, PieChart, Pie, Cell,
} from 'recharts';

import { fmtSAR, fmtSARk, fmtDate } from '@/lib/format';

const CHART_COLORS = ['#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6','#06b6d4','#f97316','#ec4899'];
const AGING_COLORS: Record<string, string> = {
  'Current':    '#34d399',
  '1-30 days':  '#fbbf24',
  '31-60 days': '#f97316',
  '61-90 days': '#ef4444',
  '90+ days':   '#7f1d1d',
};

type Period = 'month' | 'quarter' | 'year';

function SectionCard({ title, subtitle, children, action, alert }: {
  title: string; subtitle?: string; children: React.ReactNode;
  action?: React.ReactNode; alert?: number;
}) {
  return (
    <div className="bg-[#1a1d27] rounded-xl border border-white/5 p-5">
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-slate-200">{title}</h3>
            {alert != null && alert > 0 && (
              <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-red-500/20 text-red-400">{alert}</span>
            )}
          </div>
          {subtitle && <p className="text-[11px] text-slate-500 mt-0.5">{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

function KPI({ label, value, sub, color = 'text-white', delta, deltaLabel }: {
  label: string; value: string; sub?: string; color?: string; delta?: number; deltaLabel?: string;
}) {
  const hasD = delta != null;
  const up   = hasD && delta > 0;
  const down = hasD && delta < 0;
  return (
    <div className="bg-[#0f1117] rounded-lg p-4 border border-white/5">
      <p className="text-[11px] text-slate-500">{label}</p>
      <p className={`text-xl font-bold tabular-nums mt-1 ${color}`}>{value}</p>
      {hasD && (
        <p className={`text-[11px] mt-1 ${up ? 'text-emerald-400' : down ? 'text-red-400' : 'text-slate-500'}`}>
          {up ? '▲' : down ? '▼' : '—'} {Math.abs(delta)} {deltaLabel || 'vs prev period'}
        </p>
      )}
      {sub && !hasD && <p className="text-[11px] text-slate-500 mt-0.5">{sub}</p>}
    </div>
  );
}

function Empty({ msg = 'No data for this period' }: { msg?: string }) {
  return <p className="text-slate-600 text-xs text-center py-8">{msg}</p>;
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#1a1d27] border border-white/10 rounded-lg p-3 text-xs shadow-xl">
      <p className="text-slate-400 mb-1.5">{label}</p>
      {payload.map((p: any) => (
        <div key={p.name} className="flex items-center gap-2 mt-0.5">
          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: p.color }} />
          <span className="text-slate-400">{p.name}:</span>
          <span className="text-white font-semibold">
            {typeof p.value === 'number' && p.value > 999 ? fmtSAR(p.value) : p.value}
          </span>
        </div>
      ))}
    </div>
  );
};

function AlertBadge({ days }: { days: number | null }) {
  if (days == null) return <span className="text-slate-600">—</span>;
  if (days < 0)   return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-500/20 text-red-400">Expired</span>;
  if (days <= 14) return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-500/20 text-red-400">{days}d left</span>;
  if (days <= 30) return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-orange-500/20 text-orange-400">{days}d left</span>;
  return <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-500/15 text-amber-400">{days}d left</span>;
}

// ── jsPDF loader (CDN) ────────────────────────────────────────────────
async function loadReportJsPDF(): Promise<any> {
  if ((window as any).jspdf?.jsPDF) return (window as any).jspdf.jsPDF;
  const load = (src: string) => new Promise<void>((res, rej) => {
    const s = document.createElement('script');
    s.src = src; s.onload = () => res(); s.onerror = () => rej(new Error('Failed: ' + src));
    document.head.appendChild(s);
  });
  await load('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js');
  await load('https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.3/jspdf.plugin.autotable.min.js');
  return (window as any).jspdf.jsPDF;
}

async function exportToPDF(
  period: string,
  data: {
    finData: any; shipKPIs: any; revByCustomer: any[];
    routePerf: any[]; driverPerf: any[]; cashFlow: any; fleetAlerts: any;
  }
) {
  const fS  = (n: any) => `SAR ${Number(n || 0).toLocaleString('en-SA', { minimumFractionDigits: 0 })}`;
  const pct = (n: any) => n != null ? `${Number(n).toFixed(1)}%` : '—';
  const now = new Date().toLocaleString('en-GB', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' });
  const rev   = data.finData?.revenue || {};
  const monthly = (data.finData?.monthlyData || []).slice().reverse();

  let JsPDF: any;
  try { JsPDF = await loadReportJsPDF(); }
  catch { alert('Could not load PDF library. Please check your internet connection.'); return; }

  const doc = new JsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();

  let y = 14;
  const periodLabel = period.charAt(0).toUpperCase() + period.slice(1);

  // ── Cover header ────────────────────────────────────────────────────
  doc.setFillColor(30, 58, 95);
  doc.rect(10, y, W - 20, 20, 'F');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(14); doc.setTextColor(255, 255, 255);
  doc.text('Rawabi Logistics — Reports & Analytics', 15, y + 9);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
  doc.text(`Period: ${periodLabel}`, 15, y + 16);
  doc.text(`Generated: ${now}`, W - 15, y + 16, { align: 'right' });
  y += 26;

  // ── Financial Summary ────────────────────────────────────────────────
  if (data.finData) {
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(30, 58, 95);
    doc.text('Financial Summary', 10, y); y += 3;
    (doc as any).autoTable({
      startY: y, margin: { left: 10, right: 10 },
      styles: { fontSize: 8, cellPadding: 2.5 },
      headStyles: { fillColor: [30, 58, 95], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
      head: [['Metric', 'All Time', `This ${periodLabel}`]],
      body: [
        ['Total Invoiced',   fS(rev.total_invoiced),   fS(rev.period_invoiced)],
        ['Collected',        fS(rev.total_collected),  fS(rev.period_collected)],
        ['Outstanding',      fS(rev.outstanding),      '—'],
        ['Collection Rate',  pct((rev.total_collected / (rev.total_invoiced || 1)) * 100), '—'],
        ['Total Expenses',   fS(data.finData.expenses?.total_expenses), fS(data.finData.expenses?.period_expenses)],
      ],
    });
    y = (doc as any).lastAutoTable.finalY + 6;
  }

  // ── Shipment KPIs ────────────────────────────────────────────────────
  if (data.shipKPIs) {
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(30, 58, 95);
    doc.text('Shipment KPIs', 10, y); y += 3;
    (doc as any).autoTable({
      startY: y, margin: { left: 10, right: 10 },
      styles: { fontSize: 8, cellPadding: 2.5 },
      headStyles: { fillColor: [30, 58, 95], textColor: [255, 255, 255], fontStyle: 'bold' },
      head: [['Total', 'Delivered', 'In Transit', 'Pending', 'On-Time Rate', 'Avg Transit Days']],
      body: [[
        data.shipKPIs.total || 0,
        data.shipKPIs.delivered || 0,
        data.shipKPIs.in_transit || 0,
        data.shipKPIs.pending || 0,
        pct(data.shipKPIs.on_time_rate),
        data.shipKPIs.avg_transit_days ? `${Number(data.shipKPIs.avg_transit_days).toFixed(1)} days` : '—',
      ]],
    });
    y = (doc as any).lastAutoTable.finalY + 6;
  }

  // ── Revenue by Customer ──────────────────────────────────────────────
  if ((data.revByCustomer || []).length > 0) {
    if (y > 230) { doc.addPage(); y = 14; }
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(30, 58, 95);
    doc.text('Revenue by Customer', 10, y); y += 3;
    (doc as any).autoTable({
      startY: y, margin: { left: 10, right: 10 },
      styles: { fontSize: 8, cellPadding: 2.5 },
      headStyles: { fillColor: [30, 58, 95], textColor: [255, 255, 255], fontStyle: 'bold' },
      head: [['Customer', 'Invoices', 'Revenue', 'Collected', 'Outstanding']],
      body: data.revByCustomer.slice(0, 15).map((c: any) => [
        c.customer_name || '—',
        c.invoice_count || 0,
        fS(c.total_revenue),
        fS(c.total_collected),
        fS(c.outstanding),
      ]),
    });
    y = (doc as any).lastAutoTable.finalY + 6;
  }

  // ── Route Performance ────────────────────────────────────────────────
  if ((data.routePerf || []).length > 0) {
    if (y > 230) { doc.addPage(); y = 14; }
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(30, 58, 95);
    doc.text('Route Performance', 10, y); y += 3;
    (doc as any).autoTable({
      startY: y, margin: { left: 10, right: 10 },
      styles: { fontSize: 8, cellPadding: 2.5 },
      headStyles: { fillColor: [30, 58, 95], textColor: [255, 255, 255], fontStyle: 'bold' },
      head: [['Route', 'Shipments', 'On-Time %', 'Avg Transit', 'Revenue']],
      body: data.routePerf.slice(0, 10).map((r: any) => [
        `${r.origin||'—'} → ${r.destination||'—'}`,
        r.shipment_count || 0,
        pct(r.on_time_rate),
        r.avg_transit_days ? `${Number(r.avg_transit_days).toFixed(1)}d` : '—',
        fS(r.total_revenue),
      ]),
    });
    y = (doc as any).lastAutoTable.finalY + 6;
  }

  // ── Driver Performance ───────────────────────────────────────────────
  if ((data.driverPerf || []).length > 0) {
    if (y > 220) { doc.addPage(); y = 14; }
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(30, 58, 95);
    doc.text('Driver Performance', 10, y); y += 3;
    (doc as any).autoTable({
      startY: y, margin: { left: 10, right: 10 },
      styles: { fontSize: 8, cellPadding: 2.5 },
      headStyles: { fillColor: [30, 58, 95], textColor: [255, 255, 255], fontStyle: 'bold' },
      head: [['#', 'Driver', 'Trips', 'On-Time %', 'Rating', 'Status']],
      body: data.driverPerf.slice(0, 10).map((d: any, i: number) => [
        i + 1,
        `${d.first_name||''} ${d.last_name||''}`.trim() || '—',
        d.total_trips || 0,
        pct(d.on_time_rate),
        d.rating ? `${Number(d.rating).toFixed(1)}/5` : '—',
        d.status || '—',
      ]),
    });
    y = (doc as any).lastAutoTable.finalY + 6;
  }

  // ── Cash Flow ────────────────────────────────────────────────────────
  if (data.cashFlow) {
    if (y > 240) { doc.addPage(); y = 14; }
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(30, 58, 95);
    doc.text('Cash Flow Summary', 10, y); y += 3;
    (doc as any).autoTable({
      startY: y, margin: { left: 10, right: 10 },
      styles: { fontSize: 8, cellPadding: 2.5 },
      headStyles: { fillColor: [30, 58, 95], textColor: [255, 255, 255], fontStyle: 'bold' },
      head: [['Metric', 'Amount', 'Count']],
      body: [
        ['Overdue',        fS(data.cashFlow.overdue?.amount),        `${data.cashFlow.overdue?.count || 0} invoices`],
        ['Due This Week',  fS(data.cashFlow.expected?.this_week_amount),  ''],
        ['Due This Month', fS(data.cashFlow.expected?.this_month_amount), ''],
      ],
    });
    y = (doc as any).lastAutoTable.finalY + 6;
  }

  // ── Fleet Alerts ─────────────────────────────────────────────────────
  if (data.fleetAlerts) {
    if (y > 240) { doc.addPage(); y = 14; }
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(30, 58, 95);
    doc.text('Fleet Alerts', 10, y); y += 3;
    (doc as any).autoTable({
      startY: y, margin: { left: 10, right: 10 },
      styles: { fontSize: 8, cellPadding: 2.5 },
      headStyles: { fillColor: [127, 29, 29], textColor: [255, 255, 255], fontStyle: 'bold' },
      head: [['Alert Type', 'Count']],
      body: [
        ['Total Alerts',            data.fleetAlerts.total_alerts || 0],
        ['License Expiring (30d)',   data.fleetAlerts.license_expiring || 0],
        ['Medical Expiring (30d)',   data.fleetAlerts.medical_expiring || 0],
        ['Reg. Expiring (30d)',      data.fleetAlerts.registration_expiring || 0],
        ['Insurance Expiring (30d)', data.fleetAlerts.insurance_expiring || 0],
        ['Overdue Maintenance',      data.fleetAlerts.overdue_maintenance || 0],
      ],
    });
    y = (doc as any).lastAutoTable.finalY + 6;
  }

  // ── Monthly trend table ──────────────────────────────────────────────
  if (monthly.length > 0) {
    if (y > 220) { doc.addPage(); y = 14; }
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(30, 58, 95);
    doc.text('Monthly Revenue vs Expenses', 10, y); y += 3;
    (doc as any).autoTable({
      startY: y, margin: { left: 10, right: 10 },
      styles: { fontSize: 8, cellPadding: 2.5 },
      headStyles: { fillColor: [30, 58, 95], textColor: [255, 255, 255], fontStyle: 'bold' },
      head: [['Month', 'Revenue', 'Expenses', 'Profit']],
      body: monthly.slice(0, 12).map((m: any) => [
        m.month || '—',
        fS(m.revenue),
        fS(m.expenses),
        fS((m.revenue || 0) - (m.expenses || 0)),
      ]),
    });
    y = (doc as any).lastAutoTable.finalY + 6;
  }

  // ── Footer ───────────────────────────────────────────────────────────
  const pageCount = (doc.internal as any).getNumberOfPages();
  for (let p = 1; p <= pageCount; p++) {
    doc.setPage(p);
    doc.setTextColor(180, 180, 180); doc.setFontSize(7); doc.setFont('helvetica', 'normal');
    doc.text(
      `Rawabi Logistics ERP · Confidential · Page ${p} of ${pageCount}`,
      W / 2,
      doc.internal.pageSize.getHeight() - 8,
      { align: 'center' }
    );
  }

  doc.save(`Rawabi_Report_${periodLabel}_${new Date().toISOString().slice(0,10)}.pdf`);
}



// ── Chart helpers — pure inline SVG, no library needed ─────────────────────

function svgLineChart(data: any[], keys: {key:string; color:string; label:string}[], W=680, H=160): string {
  if (!data.length) return `<svg width="${W}" height="${H}"><text x="${W/2}" y="${H/2}" text-anchor="middle" fill="#94a3b8" font-size="12">No data</text></svg>`;
  const pad = { t:20, r:10, b:36, l:60 };
  const cw = W - pad.l - pad.r;
  const ch = H - pad.t - pad.b;
  const allVals = data.flatMap(d => keys.map(k => Number(d[k.key]||0)));
  const maxV = Math.max(...allVals, 1);
  const minV = 0;
  const scaleX = (i: number) => pad.l + (i / (data.length - 1 || 1)) * cw;
  const scaleY = (v: number) => pad.t + ch - ((v - minV) / (maxV - minV)) * ch;
  // Y gridlines + labels
  const ticks = 4;
  let grid = '';
  for (let t = 0; t <= ticks; t++) {
    const v = minV + (maxV - minV) * (t / ticks);
    const y = scaleY(v);
    const label = v >= 1000 ? `${(v/1000).toFixed(0)}k` : v.toFixed(0);
    grid += `<line x1="${pad.l}" y1="${y.toFixed(1)}" x2="${W-pad.r}" y2="${y.toFixed(1)}" stroke="#e2e8f0" stroke-width="1"/>`;
    grid += `<text x="${pad.l-6}" y="${(y+4).toFixed(1)}" text-anchor="end" fill="#94a3b8" font-size="9">${label}</text>`;
  }
  // X labels
  let xLabels = '';
  data.forEach((d,i) => {
    const x = scaleX(i);
    const skip = data.length > 8 ? Math.ceil(data.length / 8) : 1;
    if (i % skip === 0)
      xLabels += `<text x="${x.toFixed(1)}" y="${(H-pad.b+14).toFixed(1)}" text-anchor="middle" fill="#94a3b8" font-size="9">${(d.month||'').slice(0,7)}</text>`;
  });
  // Lines + areas
  let paths = '';
  keys.forEach(k => {
    const pts = data.map((d,i) => `${scaleX(i).toFixed(1)},${scaleY(Number(d[k.key]||0)).toFixed(1)}`).join(' ');
    const areaBottom = `${scaleX(data.length-1).toFixed(1)},${(pad.t+ch).toFixed(1)} ${pad.l.toFixed(1)},${(pad.t+ch).toFixed(1)}`;
    paths += `<polygon points="${pts} ${areaBottom}" fill="${k.color}" opacity="0.08"/>`;
    paths += `<polyline points="${pts}" fill="none" stroke="${k.color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`;
    // Dots for small datasets
    if (data.length <= 12) {
      data.forEach((d,i) => {
        paths += `<circle cx="${scaleX(i).toFixed(1)}" cy="${scaleY(Number(d[k.key]||0)).toFixed(1)}" r="3" fill="${k.color}"/>`;
      });
    }
  });
  // Legend
  let legend = '';
  keys.forEach((k,i) => {
    const lx = pad.l + i * 120;
    legend += `<rect x="${lx}" y="${H-11}" width="10" height="3" rx="1.5" fill="${k.color}"/>`;
    legend += `<text x="${lx+14}" y="${H-7}" fill="#555" font-size="9">${k.label}</text>`;
  });
  return `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">${grid}${xLabels}${paths}${legend}</svg>`;
}

function svgBarChart(data: any[], key: string, labelKey: string, color: string, W=680, H=200): string {
  if (!data.length) return `<svg width="${W}" height="${H}"><text x="${W/2}" y="${H/2}" text-anchor="middle" fill="#94a3b8" font-size="12">No data</text></svg>`;
  const pad = { t:10, r:80, b:10, l:140 };
  const cw = W - pad.l - pad.r;
  const ch = H - pad.t - pad.b;
  const maxV = Math.max(...data.map(d => Number(d[key]||0)), 1);
  const barH = Math.max(12, Math.floor((ch / data.length) * 0.65));
  const gap = Math.floor(ch / data.length) - barH;
  let bars = '';
  data.forEach((d, i) => {
    const v = Number(d[key]||0);
    const bw = (v / maxV) * cw;
    const y = pad.t + i * (barH + gap);
    const label = (d[labelKey]||'').toString().slice(0, 20);
    const valLabel = v >= 1000 ? `SAR ${(v/1000).toFixed(1)}k` : `SAR ${v.toFixed(0)}`;
    bars += `<rect x="${pad.l}" y="${y}" width="${bw.toFixed(1)}" height="${barH}" rx="2" fill="${color}" opacity="0.85"/>`;
    bars += `<text x="${pad.l-6}" y="${(y+barH*0.75).toFixed(1)}" text-anchor="end" fill="#444" font-size="9">${label}</text>`;
    bars += `<text x="${(pad.l+bw+5).toFixed(1)}" y="${(y+barH*0.75).toFixed(1)}" fill="#444" font-size="9">${valLabel}</text>`;
  });
  return `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">${bars}</svg>`;
}

function svgDonut(data: any[], W=200, H=200): string {
  if (!data.length) return `<svg width="${W}" height="${H}"><text x="${W/2}" y="${H/2}" text-anchor="middle" fill="#94a3b8" font-size="12">No data</text></svg>`;
  const COLORS = ['#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6','#06b6d4','#f97316','#84cc16'];
  const cx = W/2, cy = H/2, r = Math.min(W,H)*0.38, ir = r*0.55;
  const total = data.reduce((s,d)=>s+Number(d.value||0),0)||1;
  let angle = -Math.PI/2;
  let slices = '';
  data.forEach((d,i) => {
    const pct = Number(d.value||0)/total;
    const a1 = angle, a2 = angle + pct*2*Math.PI;
    const x1o=cx+r*Math.cos(a1), y1o=cy+r*Math.sin(a1);
    const x2o=cx+r*Math.cos(a2), y2o=cy+r*Math.sin(a2);
    const x1i=cx+ir*Math.cos(a2), y1i=cy+ir*Math.sin(a2);
    const x2i=cx+ir*Math.cos(a1), y2i=cy+ir*Math.sin(a1);
    const lg = pct>0.5?1:0;
    slices += `<path d="M${x1o.toFixed(1)},${y1o.toFixed(1)} A${r},${r} 0 ${lg} 1 ${x2o.toFixed(1)},${y2o.toFixed(1)} L${x1i.toFixed(1)},${y1i.toFixed(1)} A${ir},${ir} 0 ${lg} 0 ${x2i.toFixed(1)},${y2i.toFixed(1)} Z" fill="${COLORS[i%COLORS.length]}"/>`;
    angle = a2;
  });
  // Center text
  const totalLabel = total >= 1000 ? `${(total/1000).toFixed(1)}k` : total.toFixed(0);
  slices += `<text x="${cx}" y="${cy-4}" text-anchor="middle" fill="#1e3a5f" font-size="11" font-weight="bold">SAR</text>`;
  slices += `<text x="${cx}" y="${cy+12}" text-anchor="middle" fill="#1e3a5f" font-size="10">${totalLabel}</text>`;
  return `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">${slices}</svg>`;
}

function svgGaugeBar(pct: number, label: string, color: string, W=240): string {
  const h = 28;
  const fill = Math.min(100, Math.max(0, pct));
  return `<svg width="${W}" height="${h}" xmlns="http://www.w3.org/2000/svg">
    <rect x="0" y="8" width="${W}" height="12" rx="6" fill="#f1f5f9"/>
    <rect x="0" y="8" width="${(fill/100*W).toFixed(1)}" height="12" rx="6" fill="${color}"/>
    <text x="0" y="6" fill="#555" font-size="9">${label}</text>
    <text x="${W}" y="6" text-anchor="end" fill="${color}" font-size="9" font-weight="bold">${fill.toFixed(1)}%</text>
  </svg>`;
}

// ── Main chart-report builder ───────────────────────────────────────────────
function exportWithCharts(
  period: string,
  data: {
    rev: any; monthlyData: any[]; expByCategory: any[]; custChartData: any[];
    cashHistory: any[]; agedReceivables: any[]; outstandingInvoices: any[];
    shipKPIs: any; revByCustomer: any; routePerf: any[];
    driverPerf: any[]; fleetAlerts: any; cashFlow: any; collectionRate: string|null;
  }
) {
  const fS = (n: any) => `SAR ${Number(n||0).toLocaleString('en-SA',{minimumFractionDigits:2,maximumFractionDigits:2})}`;
  const fSk = (n: any) => { const v=Number(n||0); return v>=1000000?`SAR ${(v/1000000).toFixed(2)}M`:v>=1000?`SAR ${(v/1000).toFixed(1)}k`:`SAR ${v.toFixed(0)}`; };
  const pct = (n: any) => n!=null ? `${Number(n).toFixed(1)}%` : '—';
  const now = new Date().toLocaleString('en-GB',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'});
  const periodLabel = period.charAt(0).toUpperCase()+period.slice(1);
  const rev = data.rev || {};

  // ── Sections ──
  const sectionHtml = (title: string, subtitle: string, body: string) => `
    <div class="section">
      <div class="section-header"><span class="section-title">${title}</span><span class="section-sub">${subtitle}</span></div>
      <div class="section-body">${body}</div>
    </div>`;

  const kpiGrid = (items: {label:string;value:string;sub?:string;color?:string}[]) =>
    `<div class="kpi-grid">${items.map(k=>`
      <div class="kpi-card">
        <div class="kpi-label">${k.label}</div>
        <div class="kpi-value" style="color:${k.color||'#1e3a5f'}">${k.value}</div>
        ${k.sub?`<div class="kpi-sub">${k.sub}</div>`:''}
      </div>`).join('')}</div>`;

  const tableHtml = (headers: string[], rows: string[][]) => `
    <table><thead><tr>${headers.map(h=>`<th>${h}</th>`).join('')}</tr></thead>
    <tbody>${rows.map(r=>`<tr>${r.map(c=>`<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table>`;

  // ── Page 1: Financial Overview ──
  const finSection = sectionHtml('Financial Overview','All-time · revenue, collection, expenses',
    kpiGrid([
      {label:'Total Invoiced',  value:fSk(rev.total_invoiced),   sub:'All time'},
      {label:'Collected',       value:fSk(rev.total_collected),  sub:'All time', color:'#059669'},
      {label:'Outstanding',     value:fSk(rev.outstanding||rev.total_outstanding), sub:'Balance due', color:Number(rev.outstanding||0)>0?'#d97706':'#059669'},
      {label:'Collection Rate', value:data.collectionRate?`${data.collectionRate}%`:'—', sub:'All time',
        color:data.collectionRate&&Number(data.collectionRate)>=90?'#059669':Number(data.collectionRate||0)>=70?'#d97706':'#dc2626'},
    ])
  );

  // ── Monthly chart ──
  const monthlySection = sectionHtml('Revenue vs Expenses','Monthly trend · all history',
    `<div class="chart-wrap">${svgLineChart(data.monthlyData,
      [{key:'Revenue',color:'#3b82f6',label:'Revenue'},{key:'Expenses',color:'#ef4444',label:'Expenses'},{key:'Profit',color:'#10b981',label:'Profit'}]
    )}</div>`
  );

  // ── Shipment KPIs ──
  const shipSection = data.shipKPIs ? sectionHtml(`Shipment KPIs`,`${periodLabel} · delivery performance`,
    kpiGrid([
      {label:'Total',         value:String(data.shipKPIs.total||0)},
      {label:'Delivered',     value:String(data.shipKPIs.delivered||0),  color:'#059669'},
      {label:'In Transit',    value:String(data.shipKPIs.in_transit||0), color:'#3b82f6'},
      {label:'Pending',       value:String(data.shipKPIs.pending||0),    color:'#d97706'},
      {label:'On-Time Rate',  value:pct(data.shipKPIs.on_time_rate),     color:'#059669'},
      {label:'Avg Transit',   value:data.shipKPIs.avg_transit_days?`${Number(data.shipKPIs.avg_transit_days).toFixed(1)} days`:'—'},
    ])
  ) : '';

  // ── Expense donut ──
  const COLORS_EXP = ['#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6','#06b6d4'];
  const expLegend = data.expByCategory.map((e:any,i:number)=>
    `<div style="display:flex;align-items:center;gap:6px;margin-bottom:4px">
      <div style="width:10px;height:10px;border-radius:2px;background:${COLORS_EXP[i%COLORS_EXP.length]};flex-shrink:0"></div>
      <span style="font-size:10px;color:#555">${e.name}</span>
      <span style="font-size:10px;font-weight:600;color:#1e3a5f;margin-left:auto">${fS(e.value)}</span>
    </div>`).join('');
  const expSection = data.expByCategory.length ? sectionHtml('Expenses by Category','All time · approved & paid',
    `<div style="display:flex;align-items:flex-start;gap:24px">
      <div style="flex-shrink:0">${svgDonut(data.expByCategory,180,180)}</div>
      <div style="flex:1;padding-top:12px">${expLegend}</div>
    </div>`
  ) : '';

  // ── Revenue by Customer chart + table ──
  const custSection = data.custChartData.length ? sectionHtml('Revenue by Customer',`Top customers · ${periodLabel}`,
    `<div class="chart-wrap" style="margin-bottom:12px">${svgBarChart(data.custChartData.slice(0,8),'Revenue','name','#3b82f6',680,Math.max(80, data.custChartData.slice(0,8).length*28+20))}</div>
    ${tableHtml(['Customer','Shipments','Revenue','Collected','Outstanding'],
      (data.revByCustomer?.customers||[]).slice(0,10).map((c:any)=>[
        c.company_name||'—', c.shipment_count||0, fS(c.revenue), fS(c.collected), fS(c.outstanding)
      ])
    )}`
  ) : '';

  // ── Route Performance ──
  const routeSection = data.routePerf.length ? sectionHtml('Route Performance',`Top lanes · ${periodLabel}`,
    tableHtml(['Route','Shipments','Total Revenue','Avg/Shipment','Avg Transit','On-Time %'],
      data.routePerf.slice(0,10).map((r:any)=>[
        r.route||'—', r.shipment_count||0, fS(r.total_revenue), fS(r.avg_revenue),
        r.avg_transit_days!=null?`${r.avg_transit_days}d`:'—',
        r.on_time_pct!=null?`<span style="color:${Number(r.on_time_pct)>=90?'#059669':Number(r.on_time_pct)>=75?'#d97706':'#dc2626'};font-weight:600">${r.on_time_pct}%</span>`:'—'
      ])
    )
  ) : '';

  // ── Driver Performance ──
  const driverSection = data.driverPerf.length ? sectionHtml('Driver Performance',`${periodLabel} · ranked by trips`,
    tableHtml(['#','Driver','License','Trips','vs Prev','Revenue','On-Time','Rating','Status'],
      data.driverPerf.slice(0,10).map((d:any,i:number)=>[
        `<span style="background:#eff6ff;color:#3b82f6;border-radius:50%;width:18px;height:18px;display:inline-flex;align-items:center;justify-content:center;font-size:9px;font-weight:700">${i+1}</span>`,
        d.name||'—', d.license_type||'—', d.current_trips||0,
        d.trips_delta>0?`<span style="color:#059669;font-weight:600">▲${d.trips_delta}</span>`:d.trips_delta<0?`<span style="color:#dc2626;font-weight:600">▼${Math.abs(d.trips_delta)}</span>`:'—',
        fS(d.current_revenue), d.on_time_pct!=null?pct(d.on_time_pct):'—',
        d.rating?`★ ${d.rating}`:'—',
        `<span style="padding:2px 7px;border-radius:10px;font-size:9px;font-weight:600;background:${d.driver_status==='available'?'#ecfdf5':d.driver_status==='on_trip'?'#eff6ff':'#f8fafc'};color:${d.driver_status==='available'?'#059669':d.driver_status==='on_trip'?'#3b82f6':'#64748b'}">${(d.driver_status||'—').replace('_',' ')}</span>`,
      ])
    )
  ) : '';

  // ── Cash Flow + Collected history chart ──
  const cashSection = data.cashFlow ? sectionHtml('Cash Flow','Forecast & collections',
    `${kpiGrid([
      {label:'Overdue',       value:fSk(data.cashFlow.overdue?.amount), sub:`${data.cashFlow.overdue?.count||0} invoices`, color:'#dc2626'},
      {label:'Due This Week', value:fSk(data.cashFlow.expected?.this_week_amount)},
      {label:'Due This Month',value:fSk(data.cashFlow.expected?.this_month_amount)},
    ])}
    ${data.cashHistory.length?`<div class="chart-wrap" style="margin-top:12px">${svgLineChart(data.cashHistory,[{key:'Collected',color:'#10b981',label:'Collected'}],680,120)}</div>`:''}
    `
  ) : '';

  // ── Fleet Alerts ──
  const alertItems = data.fleetAlerts ? [
    {label:'License Expiring (30d)',   v:data.fleetAlerts.license_expiring||0},
    {label:'Medical Expiring (30d)',   v:data.fleetAlerts.medical_expiring||0},
    {label:'Reg. Expiring (30d)',      v:data.fleetAlerts.registration_expiring||0},
    {label:'Insurance Expiring (30d)', v:data.fleetAlerts.insurance_expiring||0},
    {label:'Overdue Maintenance',      v:data.fleetAlerts.overdue_maintenance||0},
  ] : [];
  const fleetSection = data.fleetAlerts ? sectionHtml('Fleet Alerts','Vehicles & drivers requiring attention',
    `<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px 24px">
    ${alertItems.map(a=>`<div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid #f1f5f9">
      <span style="font-size:10px;color:#555">${a.label}</span>
      <span style="font-size:13px;font-weight:700;color:${a.v>0?'#dc2626':'#059669'}">${a.v}</span>
    </div>`).join('')}
    </div>`
  ) : '';

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Rawabi Logistics — ${periodLabel} Report</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, Helvetica, sans-serif; font-size: 11px; background: #fff; color: #1e293b; }
    .page { max-width: 860px; margin: 0 auto; padding: 28px 32px; }

    /* Cover */
    .cover {
      background: linear-gradient(135deg, #1e3a5f 0%, #2d5f8a 100%);
      color: white; padding: 20px 24px; border-radius: 8px; margin-bottom: 22px;
      display: flex; justify-content: space-between; align-items: center;
    }
    .cover-title { font-size: 15px; font-weight: 700; letter-spacing: -0.02em; }
    .cover-sub   { font-size: 9px; margin-top: 4px; opacity: 0.75; }
    .cover-badge { font-size: 9px; font-weight: 700; letter-spacing: 0.1em; background: rgba(255,255,255,0.15); padding: 4px 8px; border-radius: 4px; }

    /* Section */
    .section { background: #fff; border: 1px solid #e8ecf0; border-radius: 8px; margin-bottom: 18px; overflow: hidden; page-break-inside: avoid; }
    .section-header { padding: 10px 16px; border-bottom: 1px solid #f1f5f9; display: flex; align-items: baseline; gap: 10px; background: #fafbfc; }
    .section-title  { font-size: 11px; font-weight: 700; color: #1e3a5f; }
    .section-sub    { font-size: 9px; color: #94a3b8; }
    .section-body   { padding: 14px 16px; }

    /* KPI grid */
    .kpi-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 10px; }
    .kpi-card { background: #f8fafc; border: 1px solid #e8ecf0; border-radius: 6px; padding: 10px 12px; }
    .kpi-label { font-size: 9px; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 4px; }
    .kpi-value { font-size: 15px; font-weight: 700; line-height: 1.1; }
    .kpi-sub   { font-size: 9px; color: #94a3b8; margin-top: 3px; }

    /* Table */
    table { border-collapse: collapse; width: 100%; font-size: 10px; }
    thead tr { background: #f8fafc; }
    th { padding: 7px 8px; text-align: left; font-weight: 600; color: #475569; border-bottom: 2px solid #e2e8f0; white-space: nowrap; font-size: 9px; text-transform: uppercase; letter-spacing: 0.05em; }
    td { padding: 6px 8px; border-bottom: 1px solid #f1f5f9; color: #334155; vertical-align: middle; }
    tbody tr:last-child td { border-bottom: none; }
    tbody tr:hover td { background: #f8fafc; }

    /* Chart wrap */
    .chart-wrap { width: 100%; overflow: hidden; }
    .chart-wrap svg { width: 100%; height: auto; display: block; }

    /* Footer */
    .footer { margin-top: 24px; padding-top: 12px; border-top: 1px solid #e8ecf0; display: flex; justify-content: space-between; align-items: center; }
    .footer-left  { font-size: 9px; color: #94a3b8; }
    .footer-right { font-size: 9px; color: #94a3b8; }

    @page { margin: 15mm; }
    @media print {
      body { font-size: 10px; }
      .page { padding: 0; max-width: 100%; }
      .section { page-break-inside: avoid; margin-bottom: 14px; }
      .cover { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .kpi-card { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
  </style>
</head>
<body>
<div class="page">
  <div class="cover">
    <div>
      <div class="cover-title">Rawabi Logistics — Reports &amp; Analytics</div>
      <div class="cover-sub">Period: ${periodLabel} &nbsp;·&nbsp; Generated: ${now}</div>
    </div>
    <div class="cover-badge">CONFIDENTIAL</div>
  </div>

  ${finSection}
  ${monthlySection}
  ${shipSection}
  ${expSection}
  ${custSection}
  ${routeSection}
  ${driverSection}
  ${cashSection}
  ${fleetSection}

  <div class="footer">
    <div class="footer-left">Rawabi Logistics ERP &middot; Confidential Document</div>
    <div class="footer-right">${now} &middot; ${periodLabel} Report</div>
  </div>
</div>
<script>
  window.onload = function() { setTimeout(function(){ window.print(); }, 350); };
<\/script>
</body>
</html>`;

  const win = window.open('', '_blank', 'width=1000,height=800');
  if (!win) { alert('Pop-up blocked. Please allow pop-ups for this site.'); return; }
  win.document.write(html);
  win.document.close();
}


export default function Reports() {
  const { hasPermission } = useAuth();
  const canSeeFinance = hasPermission(['super_admin','admin','accountant']);
  const canSeeFleet   = hasPermission(['super_admin','admin','dispatcher']);
  const reportRef = useRef<HTMLDivElement>(null); // kept for future use

  const [period, setPeriod] = useState<Period>('month');

  const [finData,       setFinData]       = useState<any>(null);
  const [shipKPIs,      setShipKPIs]      = useState<any>(null);
  const [revByCustomer, setRevByCustomer] = useState<any>(null);
  const [routePerf,     setRoutePerf]     = useState<any[]>([]);
  const [fleetAlerts,   setFleetAlerts]   = useState<any>(null);
  const [cashFlow,      setCashFlow]      = useState<any>(null);
  const [driverPerf,    setDriverPerf]    = useState<any[]>([]);

  const [loadingFin,    setLoadingFin]    = useState(true);
  const [loadingShip,   setLoadingShip]   = useState(true);
  const [loadingDriver, setLoadingDriver] = useState(true);
  const [loadingOther,  setLoadingOther]  = useState(true);

  const loadPeriodData = useCallback(async (p: Period) => {
    setLoadingFin(true); setLoadingShip(true); setLoadingDriver(true);
    try {
      const [fin, ship, revCust, routes, drivers] = await Promise.all([
        financeApi.getFinancialSummary(p),
        reportsApi.getShipmentKPIs(p),
        reportsApi.getRevenueByCustomer(p),
        reportsApi.getRoutePerformance(p),
        reportsApi.getDriverPerformance(p),
      ]);
      setFinData(fin);
      setShipKPIs(ship);
      setRevByCustomer(revCust);
      setRoutePerf(routes || []);
      setDriverPerf(drivers || []);
    } catch { toast.error('Failed to load report data'); }
    finally { setLoadingFin(false); setLoadingShip(false); setLoadingDriver(false); }
  }, []);

  const loadStaticData = useCallback(async () => {
    setLoadingOther(true);
    // Call these separately — fleet-alerts is not available to accountant role,
    // so we must not let one failure abort the other.
    const [alertsResult, cfResult] = await Promise.allSettled([
      canSeeFleet ? reportsApi.getFleetAlerts() : Promise.resolve(null),
      reportsApi.getCashFlowForecast(),
    ]);
    if (alertsResult.status === 'fulfilled') setFleetAlerts(alertsResult.value);
    if (cfResult.status === 'fulfilled') setCashFlow(cfResult.value);
    setLoadingOther(false);
  }, [canSeeFleet]);

  useEffect(() => { loadPeriodData(period); }, [period, loadPeriodData]);
  useEffect(() => { loadStaticData(); }, [loadStaticData]);

  const rev = finData?.revenue || {};

  const monthlyData = (finData?.monthlyData || [])
    .slice().reverse()
    .map((m: any) => ({
      month:    m.month,
      Revenue:  Number(m.revenue  || 0),
      Expenses: Number(m.expenses || 0),
      Profit:   Number(m.revenue  || 0) - Number(m.expenses || 0),
    }))
    .filter((_: any, i: number, arr: any[]) =>
      arr.slice(i).some((r: any) => r.Revenue > 0 || r.Expenses > 0)
    );

  const expByCategory = (finData?.expensesByCategory || []).map((e: any) => ({
    name:  ((e.category || 'Other').charAt(0).toUpperCase() + (e.category || 'other').slice(1)),
    value: Number(e.total_expenses),
    count: e.count,
  }));

  const agedReceivables     = finData?.agedReceivables    || [];
  const outstandingInvoices = finData?.outstandingInvoices || [];
  const totalAged = agedReceivables.reduce((s: number, b: any) => s + Number(b.amount), 0);

  const custChartData = (revByCustomer?.customers || []).map((c: any) => ({
    name:    c.company_name.length > 16 ? c.company_name.slice(0,14)+'…' : c.company_name,
    fullName: c.company_name,
    Revenue: c.revenue,
  }));

  const totalAlerts = fleetAlerts?.total_alerts || 0;
  const cashHistory = (cashFlow?.collected_history || []).map((h: any) => ({
    month: h.month, Collected: Number(h.collected || 0),
  }));

  const collectionRate = rev.total_invoiced > 0
    ? ((rev.total_collected / rev.total_invoiced) * 100).toFixed(1) : null;

  const criticalInvoices = outstandingInvoices.filter((i: any) =>
    Math.ceil((Date.now() - new Date(i.due_date).getTime()) / 86400000) > 90
  ).length;

  const PL: Record<Period, string> = { month: 'This Month', quarter: 'This Quarter', year: 'This Year' };

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Reports & Analytics</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            {PL[period]} · period filter applies to: shipments, routes, drivers, customers
            {totalAlerts > 0 && <span className="ml-2 text-red-400 font-semibold">· {totalAlerts} fleet alert{totalAlerts > 1 ? 's' : ''}</span>}
            {criticalInvoices > 0 && <span className="ml-2 text-amber-400 font-semibold">· {criticalInvoices} invoice{criticalInvoices > 1 ? 's' : ''} critical overdue</span>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex gap-1 bg-[#1a1d27] rounded-lg p-1 border border-white/5">
            {(['month','quarter','year'] as Period[]).map(p => (
              <button key={p} onClick={() => setPeriod(p)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors capitalize ${
                  period === p ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}>{p}</button>
            ))}
          </div>
          <button onClick={() => exportToPDF(period, { finData, shipKPIs, revByCustomer, routePerf, driverPerf, cashFlow, fleetAlerts })}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-[#1a1d27] border border-white/10 text-slate-400 hover:text-white rounded-lg transition-colors">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
            Export PDF
          </button>
          <button onClick={() => exportWithCharts(period, { rev, monthlyData, expByCategory, custChartData, cashHistory, agedReceivables, outstandingInvoices, shipKPIs, revByCustomer, routePerf, driverPerf, fleetAlerts, cashFlow, collectionRate })}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-emerald-600/15 border border-emerald-500/25 text-emerald-400 hover:bg-emerald-600/25 rounded-lg transition-colors">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
            Print with Charts
          </button>
        </div>
      </div>

      <div id="reports-content" ref={reportRef} className="space-y-5">

        {/* ── Fin KPIs — all-time, not period-filtered ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <KPI label="Total Invoiced"  value={loadingFin ? '…' : fmtSAR(rev.total_invoiced)}  sub="All time" />
          <KPI label="Collected"       value={loadingFin ? '…' : fmtSAR(rev.total_collected)} color="text-emerald-400" sub="All time" />
          <KPI label="Outstanding"     value={loadingFin ? '…' : fmtSAR(rev.total_outstanding)}
            color={Number(rev.total_outstanding) > 0 ? 'text-amber-400' : 'text-emerald-400'} sub="Balance due" />
          <KPI label="Collection Rate" value={loadingFin ? '…' : (collectionRate ? `${collectionRate}%` : '—')}
            color={collectionRate && Number(collectionRate) >= 90 ? 'text-emerald-400' : collectionRate && Number(collectionRate) >= 70 ? 'text-amber-400' : 'text-red-400'}
            sub="All time" />
        </div>

        {/* ── Shipment KPIs ── */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          {loadingShip
            ? Array.from({ length: 5 }).map((_, i) => <div key={i} className="bg-[#0f1117] rounded-lg p-4 border border-white/5 h-20 animate-pulse" />)
            : ([
                { label:'Total Shipments',  value: String(shipKPIs?.total ?? 0),     color:'text-white' },
                { label:'Delivered',        value: String(shipKPIs?.delivered ?? 0), color:'text-emerald-400', delta: shipKPIs?.delivered_delta },
                { label:'In Transit',       value: String(shipKPIs?.in_transit ?? 0),color:'text-blue-400' },
                { label:'Avg Transit Days', value: shipKPIs?.avg_transit_days != null ? `${shipKPIs.avg_transit_days}d` : '—', color:'text-slate-300' },
                { label:'On-Time Delivery', value: shipKPIs?.on_time_pct != null ? `${shipKPIs.on_time_pct}%` : '—',
                  color: shipKPIs?.on_time_pct >= 90 ? 'text-emerald-400' : shipKPIs?.on_time_pct >= 75 ? 'text-amber-400' : 'text-red-400' },
              ] as any[]).map((k: any) => (
                <KPI key={k.label} label={k.label} value={k.value} color={k.color}
                  delta={k.delta} deltaLabel="vs prev period" />
              ))}
        </div>

        {/* ── Revenue vs Expenses ── */}
        <SectionCard title="Revenue vs Expenses" subtitle="Full history by invoice month · not period-filtered">
          {loadingFin ? <div className="h-52 animate-pulse bg-white/5 rounded-lg" /> :
           monthlyData.length === 0 ? <Empty /> : (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={monthlyData} margin={{ top:5, right:10, bottom:5, left:0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="month" tick={{ fontSize:10, fill:'#64748b' }} />
                <YAxis tick={{ fontSize:10, fill:'#64748b' }} tickFormatter={fmtSARk} width={45} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize:11, color:'#94a3b8' }} />
                <Line type="monotone" dataKey="Revenue"  stroke="#3b82f6" strokeWidth={2} dot={{ r:3, fill:'#3b82f6' }} />
                <Line type="monotone" dataKey="Expenses" stroke="#ef4444" strokeWidth={2} dot={{ r:3, fill:'#ef4444' }} />
                <Line type="monotone" dataKey="Profit"   stroke="#10b981" strokeWidth={2} dot={false} strokeDasharray="5 3" />
              </LineChart>
            </ResponsiveContainer>
          )}
        </SectionCard>

        {/* ── Expenses + Aged Receivables ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <SectionCard title="Expenses by Category" subtitle="All time · approved & paid">
            {loadingFin ? <div className="h-40 animate-pulse bg-white/5 rounded-lg" /> :
             expByCategory.length === 0 ? <Empty msg="No approved expenses this period" /> : (
              <div className="flex items-center gap-5">
                <div className="flex-shrink-0">
                  <ResponsiveContainer width={130} height={130}>
                    <PieChart>
                      <Pie data={expByCategory} dataKey="value" cx="50%" cy="50%" innerRadius={32} outerRadius={58}>
                        {expByCategory.map((_: any, i: number) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex-1 space-y-2">
                  {expByCategory.map((e: any, i: number) => (
                    <div key={e.name} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} />
                        <span className="text-xs text-slate-400">{e.name}</span>
                        <span className="text-[10px] text-slate-600">×{e.count}</span>
                      </div>
                      <span className="text-xs text-white font-semibold tabular-nums">{fmtSAR(e.value)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </SectionCard>

          <SectionCard title="Aged Receivables" subtitle="All outstanding — bucketed by overdue days">
            {loadingFin ? <div className="h-40 animate-pulse bg-white/5 rounded-lg" /> :
             agedReceivables.length === 0 ? <Empty msg="No outstanding receivables" /> : (
              <div className="space-y-2.5">
                {agedReceivables.map((bucket: any) => {
                  const color = AGING_COLORS[bucket.aging_bucket] || '#94a3b8';
                  const pct   = totalAged > 0 ? (Number(bucket.amount) / totalAged) * 100 : 0;
                  return (
                    <div key={bucket.aging_bucket}>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full" style={{ background: color }} />
                          <span className="text-slate-400 font-medium">{bucket.aging_bucket}</span>
                          <span className="text-slate-600">{bucket.invoice_count} inv.</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-slate-500">{pct.toFixed(1)}%</span>
                          <span className="text-white font-bold tabular-nums">{fmtSAR(bucket.amount)}</span>
                        </div>
                      </div>
                      <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                        <div className="h-full rounded-full" style={{ width:`${pct}%`, background: color }} />
                      </div>
                    </div>
                  );
                })}
                <div className="pt-2 border-t border-white/5 flex justify-between text-xs">
                  <span className="text-slate-500">Total Outstanding</span>
                  <span className="text-white font-bold tabular-nums">{fmtSAR(totalAged)}</span>
                </div>
              </div>
            )}
          </SectionCard>
        </div>

        {/* ── Collections Action List ── */}
        {outstandingInvoices.length > 0 && (
          <SectionCard title="Collections — Action Required"
            subtitle="Sorted by urgency · critical rows highlighted"
            alert={criticalInvoices}>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-white/5">
                    {['Invoice #','Customer','Due Date','Total','Balance','Inv. Status','Urgency'].map(h => (
                      <th key={h} className="py-2 pr-3 text-left text-[11px] font-medium text-slate-500 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {outstandingInvoices.map((inv: any) => {
                    const days = Math.ceil((Date.now() - new Date(inv.due_date).getTime()) / 86400000);
                    const urgClass = days > 90  ? 'bg-red-500/15 text-red-400 border border-red-500/20'
                                   : days > 30  ? 'bg-orange-500/15 text-orange-400 border border-orange-500/20'
                                   : days > 0   ? 'bg-amber-500/15 text-amber-400 border border-amber-500/20'
                                   :              'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20';
                    const urgText  = days > 90 ? 'Critical' : days > 30 ? 'High' : days > 0 ? 'Medium' : 'Current';
                    return (
                      <tr key={inv.id} className={`border-b border-white/5 ${days > 90 ? 'bg-red-500/5' : ''}`}>
                        <td className="py-2.5 pr-3 font-mono text-blue-400">{inv.invoice_number}</td>
                        <td className="py-2.5 pr-3 text-white font-semibold max-w-[140px] truncate">{inv.customer_name}</td>
                        <td className="py-2.5 pr-3 text-slate-400 whitespace-nowrap">{fmtDate(inv.due_date)}</td>
                        <td className="py-2.5 pr-3 text-slate-300 tabular-nums">{fmtSAR(inv.total_amount)}</td>
                        <td className="py-2.5 pr-3 text-red-400 font-bold tabular-nums">{fmtSAR(inv.balance_due)}</td>
                        <td className="py-2.5 pr-3">
                          <span className="px-2 py-0.5 rounded-full text-[10px] bg-white/5 text-slate-300 capitalize">{inv.status}</span>
                        </td>
                        <td className="py-2.5 pr-3">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${urgClass}`}>
                            {urgText}{days > 0 ? ` · ${days}d` : ''}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <div className="mt-3 pt-3 border-t border-white/5 flex items-center justify-between text-xs">
                <span className="text-slate-500">{outstandingInvoices.length} outstanding invoice{outstandingInvoices.length > 1 ? 's' : ''}</span>
                <span className="text-red-400 font-bold">{fmtSAR(outstandingInvoices.reduce((s: number, i: any) => s + Number(i.balance_due), 0))} total at risk</span>
              </div>
            </div>
          </SectionCard>
        )}

        {/* ── Revenue by Customer ── */}
        <SectionCard title="Revenue by Customer" subtitle={`Top 8 · by invoiced amount · ${period === 'year' ? 'All time' : PL[period]}`}>
          {loadingShip ? <div className="h-52 animate-pulse bg-white/5 rounded-lg" /> :
           custChartData.length === 0 ? <Empty /> : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={custChartData} layout="vertical" margin={{ top:0, right:20, bottom:0, left:0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize:10, fill:'#64748b' }} tickFormatter={fmtSARk} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize:10, fill:'#94a3b8' }} width={90} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="Revenue" radius={[0,4,4,0]}>
                    {custChartData.map((_: any, i: number) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <div className="space-y-2">
                {(revByCustomer?.customers || []).map((c: any, i: number) => (
                  <div key={c.id} className="flex items-center justify-between bg-[#0f1117] rounded-lg px-3 py-2 border border-white/5">
                    <div className="flex items-center gap-2.5">
                      <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0"
                        style={{ background: CHART_COLORS[i % CHART_COLORS.length] + '25', color: CHART_COLORS[i % CHART_COLORS.length] }}>
                        {i + 1}
                      </span>
                      <div>
                        <p className="text-xs font-semibold text-white">{c.company_name}</p>
                        <p className="text-[10px] text-slate-500 capitalize">{c.customer_type} · {c.shipment_count} shipment{c.shipment_count !== 1 ? 's' : ''}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-bold text-white tabular-nums">{fmtSAR(c.revenue)}</p>
                      <p className="text-[10px] text-slate-500">{c.pct}% of total</p>
                    </div>
                  </div>
                ))}
                {revByCustomer?.total_revenue > 0 && (
                  <div className="flex justify-between pt-1 text-xs border-t border-white/5">
                    <span className="text-slate-500">Period Total</span>
                    <span className="text-emerald-400 font-bold">{fmtSAR(revByCustomer.total_revenue)}</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </SectionCard>

        {/* ── Route Performance ── */}
        <SectionCard title="Route Performance" subtitle={`Top 8 lanes · ${PL[period]}`}>
          {loadingShip ? <div className="h-40 animate-pulse bg-white/5 rounded-lg" /> :
           routePerf.length === 0 ? <Empty /> : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-white/5">
                    {['Route','Shipments','Total Revenue','Avg per Shipment','Avg Transit','On-Time %'].map(h => (
                      <th key={h} className="py-2 pr-4 text-left text-[11px] font-medium text-slate-500 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {routePerf.map((r: any, i: number) => (
                    <tr key={i} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                      <td className="py-2.5 pr-4 font-semibold text-white">{r.route}</td>
                      <td className="py-2.5 pr-4 font-bold text-white tabular-nums">{r.shipment_count}</td>
                      <td className="py-2.5 pr-4 text-emerald-400 font-semibold tabular-nums">{fmtSAR(r.total_revenue)}</td>
                      <td className="py-2.5 pr-4 text-slate-400 tabular-nums">{fmtSAR(r.avg_revenue)}</td>
                      <td className="py-2.5 pr-4 text-slate-400">{r.avg_transit_days != null ? `${r.avg_transit_days}d` : '—'}</td>
                      <td className="py-2.5 pr-4">
                        {r.on_time_pct != null
                          ? <span className={`font-semibold ${Number(r.on_time_pct) >= 90 ? 'text-emerald-400' : Number(r.on_time_pct) >= 75 ? 'text-amber-400' : 'text-red-400'}`}>{r.on_time_pct}%</span>
                          : <span className="text-slate-600">—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </SectionCard>

        {/* ── Driver Performance (period-aware) ── */}
        <SectionCard title="Driver Performance" subtitle={`${PL[period]} vs previous period · ranked by trips`}>
          {loadingDriver ? <div className="h-40 animate-pulse bg-white/5 rounded-lg" /> :
           driverPerf.length === 0 ? <Empty msg="No driver trip data for this period" /> : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-white/5">
                    {['#','Driver','License','Trips','vs Prev','Revenue','On-Time','Rating','Vehicle','Status'].map(h => (
                      <th key={h} className="py-2 pr-3 text-left text-[11px] font-medium text-slate-500 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {driverPerf.map((d: any, i: number) => (
                    <tr key={d.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                      <td className="py-2.5 pr-3">
                        <span className="w-5 h-5 rounded-full bg-blue-500/20 flex items-center justify-center text-[10px] text-blue-400 font-bold">{i+1}</span>
                      </td>
                      <td className="py-2.5 pr-3 font-semibold text-white whitespace-nowrap">{d.name}</td>
                      <td className="py-2.5 pr-3 text-slate-400 capitalize">{d.license_type}</td>
                      <td className="py-2.5 pr-3 text-white font-bold">{d.current_trips}</td>
                      <td className="py-2.5 pr-3">
                        {d.trips_delta > 0 ? <span className="text-emerald-400 font-semibold">▲{d.trips_delta}</span>
                         : d.trips_delta < 0 ? <span className="text-red-400 font-semibold">▼{Math.abs(d.trips_delta)}</span>
                         : <span className="text-slate-600">—</span>}
                      </td>
                      <td className="py-2.5 pr-3 text-emerald-400 font-semibold tabular-nums">{fmtSAR(d.current_revenue)}</td>
                      <td className="py-2.5 pr-3">
                        {d.on_time_pct != null
                          ? <span className={Number(d.on_time_pct) >= 90 ? 'text-emerald-400' : Number(d.on_time_pct) >= 75 ? 'text-amber-400' : 'text-red-400'}>{d.on_time_pct}%</span>
                          : <span className="text-slate-600">—</span>}
                      </td>
                      <td className="py-2.5 pr-3">
                        <div className="flex items-center gap-1">
                          <svg className="w-3 h-3 text-amber-400" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/></svg>
                          <span className="text-slate-300">{d.rating}</span>
                        </div>
                      </td>
                      <td className="py-2.5 pr-3 text-slate-400">{d.assigned_vehicle || '—'}</td>
                      <td className="py-2.5 pr-3">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                          d.driver_status === 'available' ? 'bg-emerald-500/15 text-emerald-400' :
                          d.driver_status === 'on_trip'   ? 'bg-blue-500/15 text-blue-400' :
                          'bg-slate-500/15 text-slate-400'}`}>
                          {d.driver_status?.replace('_',' ')}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </SectionCard>

        {/* ── Cash Flow ── */}
        {canSeeFinance && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <SectionCard title="Collection History" subtitle="Actual cash received · last 6 months">
              {loadingOther ? <div className="h-44 animate-pulse bg-white/5 rounded-lg" /> :
               cashHistory.length === 0 ? <Empty msg="No payment history" /> : (
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={cashHistory} margin={{ top:5, right:10, bottom:5, left:0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="month" tick={{ fontSize:10, fill:'#64748b' }} />
                    <YAxis tick={{ fontSize:10, fill:'#64748b' }} tickFormatter={fmtSARk} width={45} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="Collected" fill="#10b981" radius={[4,4,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </SectionCard>

            <SectionCard title="Expected Collections" subtitle="Invoices due in next 90 days + overdue">
              {loadingOther ? <div className="h-44 animate-pulse bg-white/5 rounded-lg" /> :
               !cashFlow ? <Empty /> : (
                <div className="space-y-3">
                  {Number(cashFlow.overdue?.amount) > 0 && (
                    <div className="flex items-center justify-between bg-red-500/10 border border-red-500/20 rounded-lg p-3">
                      <div>
                        <p className="text-xs font-bold text-red-400">Already Overdue</p>
                        <p className="text-[11px] text-slate-500 mt-0.5">{cashFlow.overdue.count} invoice{cashFlow.overdue.count !== 1 ? 's' : ''} past due</p>
                      </div>
                      <p className="text-sm font-bold text-red-400 tabular-nums">{fmtSAR(cashFlow.overdue.amount)}</p>
                    </div>
                  )}
                  {([
                    { label:'Due in 1–30 days',  k:'next_30',    ck:'next_30_count',    c:'text-amber-400',  bg:'bg-amber-500/10', bd:'border-amber-500/20' },
                    { label:'Due in 31–60 days', k:'next_31_60', ck:'next_31_60_count', c:'text-blue-400',   bg:'bg-blue-500/10',  bd:'border-blue-500/20' },
                    { label:'Due in 61–90 days', k:'next_61_90', ck:'next_61_90_count', c:'text-slate-300',  bg:'bg-white/5',      bd:'border-white/10' },
                  ] as any[]).map((b: any) => (
                    <div key={b.k} className={`flex items-center justify-between rounded-lg p-3 border ${b.bg} ${b.bd}`}>
                      <div>
                        <p className={`text-xs font-semibold ${b.c}`}>{b.label}</p>
                        <p className="text-[11px] text-slate-500 mt-0.5">{cashFlow.expected?.[b.ck] || 0} invoice{cashFlow.expected?.[b.ck] !== 1 ? 's' : ''}</p>
                      </div>
                      <p className={`text-sm font-bold tabular-nums ${b.c}`}>{fmtSAR(cashFlow.expected?.[b.k] || 0)}</p>
                    </div>
                  ))}
                </div>
              )}
            </SectionCard>
          </div>
        )}

        {/* ── Fleet Alerts ── */}
        {canSeeFleet && (
          <SectionCard title="Fleet Alerts" subtitle="Expiring within 60 days · action required" alert={totalAlerts}>
            {loadingOther ? <div className="h-32 animate-pulse bg-white/5 rounded-lg" /> :
             totalAlerts === 0 ? (
              <div className="flex items-center gap-3 py-3">
                <span className="w-8 h-8 rounded-full bg-emerald-500/15 flex items-center justify-center flex-shrink-0">
                  <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/></svg>
                </span>
                <p className="text-xs text-slate-400">All vehicles and drivers have valid documents for the next 60 days.</p>
              </div>
             ) : (
              <div className="space-y-5">
                {(fleetAlerts?.vehicle_alerts || []).length > 0 && (
                  <div>
                    <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Vehicles</p>
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-white/5">
                          {['Vehicle','Plate','Status','Reg. Expiry','Ins. Expiry'].map(h => (
                            <th key={h} className="py-2 pr-4 text-left text-[11px] font-medium text-slate-500">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {(fleetAlerts.vehicle_alerts || []).map((v: any, i: number) => (
                          <tr key={i} className="border-b border-white/5">
                            <td className="py-2.5 pr-4 text-white font-semibold">{v.vehicle_name || '—'}</td>
                            <td className="py-2.5 pr-4 font-mono text-slate-300">{v.plate_number}</td>
                            <td className="py-2.5 pr-4">
                              <span className="px-2 py-0.5 rounded-full text-[10px] bg-white/5 text-slate-400 capitalize">{v.status}</span>
                            </td>
                            <td className="py-2.5 pr-4">
                              <div className="flex items-center gap-2">
                                <span className="text-slate-400">{fmtDate(v.registration_expiry)}</span>
                                {v.registration_expiry && <AlertBadge days={v.reg_days_left} />}
                              </div>
                            </td>
                            <td className="py-2.5 pr-4">
                              <div className="flex items-center gap-2">
                                <span className="text-slate-400">{fmtDate(v.insurance_expiry)}</span>
                                {v.insurance_expiry && <AlertBadge days={v.ins_days_left} />}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                {(fleetAlerts?.driver_alerts || []).length > 0 && (
                  <div>
                    <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Drivers</p>
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-white/5">
                          {['Driver','License #','Type','License Expiry','Medical Expiry'].map(h => (
                            <th key={h} className="py-2 pr-4 text-left text-[11px] font-medium text-slate-500">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {(fleetAlerts.driver_alerts || []).map((d: any, i: number) => (
                          <tr key={i} className="border-b border-white/5">
                            <td className="py-2.5 pr-4 font-semibold text-white">{d.first_name} {d.last_name}</td>
                            <td className="py-2.5 pr-4 font-mono text-slate-300">{d.license_number}</td>
                            <td className="py-2.5 pr-4 text-slate-400 capitalize">{d.license_type}</td>
                            <td className="py-2.5 pr-4">
                              <div className="flex items-center gap-2">
                                <span className="text-slate-400">{fmtDate(d.license_expiry)}</span>
                                {d.license_expiry && <AlertBadge days={d.license_days_left} />}
                              </div>
                            </td>
                            <td className="py-2.5 pr-4">
                              <div className="flex items-center gap-2">
                                <span className="text-slate-400">{fmtDate(d.medical_certificate_expiry)}</span>
                                {d.medical_certificate_expiry && <AlertBadge days={d.medical_days_left} />}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
             )}
          </SectionCard>
        )}

      </div>
    </div>
  );
}