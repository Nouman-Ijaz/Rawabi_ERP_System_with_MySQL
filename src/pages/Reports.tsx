import { useEffect, useState, useCallback } from 'react';
import { financeApi, reportsApi } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend, PieChart, Pie, Cell,
} from 'recharts';

const fmtSAR  = (n: any) => `SAR ${Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
const fmtSARk = (v: number) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v);
const fmtDate = (d: string) => d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

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

function exportToPDF(period: string) {
  const el = document.getElementById('reports-content');
  if (!el) return;
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
    <title>Rawabi Logistics - Reports (${period})</title>
    <style>
      * { box-sizing: border-box; }
      body { font-family: -apple-system, sans-serif; background:#0f1117; color:#e2e8f0; margin:0; padding:24px; font-size:12px; -webkit-print-color-adjust:exact; }
      h1 { font-size:18px; margin-bottom:4px; color:#fff; }
      table { width:100%; border-collapse:collapse; margin-top:8px; }
      th { text-align:left; color:#64748b; font-size:11px; padding:6px 8px; border-bottom:1px solid rgba(255,255,255,0.1); }
      td { padding:6px 8px; border-bottom:1px solid rgba(255,255,255,0.05); color:#cbd5e1; }
      .section { background:#1a1d27; border-radius:10px; padding:16px; margin-bottom:16px; border:1px solid rgba(255,255,255,0.05); }
    </style></head><body>
    <h1>Rawabi Logistics — Reports & Analytics</h1>
    <p style="color:#64748b;margin-bottom:20px">Period: ${period} · ${new Date().toLocaleString('en-GB')}</p>
    ${el.innerHTML}
  </body></html>`;
  const blob = new Blob([html], { type: 'text/html' });
  const url  = URL.createObjectURL(blob);
  const win  = window.open(url, '_blank');
  if (win) win.onload = () => setTimeout(() => { win.print(); URL.revokeObjectURL(url); }, 600);
}

export default function Reports() {
  const { hasPermission } = useAuth();
  const canSeeFinance = hasPermission(['super_admin','admin','accountant']);
  const canSeeFleet   = hasPermission(['super_admin','admin','dispatcher']);

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
    try {
      const [alerts, cf] = await Promise.all([
        reportsApi.getFleetAlerts(),
        reportsApi.getCashFlowForecast(),
      ]);
      setFleetAlerts(alerts);
      setCashFlow(cf);
    } catch { toast.error('Failed to load fleet/cash flow data'); }
    finally { setLoadingOther(false); }
  }, []);

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
            {PL[period]}
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
          <button onClick={() => exportToPDF(period)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-[#1a1d27] border border-white/10 text-slate-400 hover:text-white rounded-lg transition-colors">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
            Export PDF
          </button>
        </div>
      </div>

      <div id="reports-content" className="space-y-5">

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
        <SectionCard title="Revenue vs Expenses" subtitle="Monthly trend · trailing 12 months">
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
        <SectionCard title="Revenue by Customer" subtitle={`Top 8 · by invoiced amount · ${PL[period]}`}>
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
