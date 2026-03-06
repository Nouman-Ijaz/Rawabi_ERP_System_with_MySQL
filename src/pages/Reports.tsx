import { useEffect, useState } from 'react';
import { financeApi, driversApi, vehiclesApi } from '@/lib/api';
import { toast } from 'sonner';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend, PieChart, Pie, Cell,
} from 'recharts';

const fmtSAR  = (n: any) => `SAR ${Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
const fmtDate = (d: string) => d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

const AGING_COLORS: Record<string, string> = {
  'Current':    '#34d399',
  '1-30 days':  '#fbbf24',
  '31-60 days': '#f97316',
  '61-90 days': '#ef4444',
  '90+ days':   '#991b1b',
};

const CHART_COLORS = ['#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6','#06b6d4'];

function SectionCard({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="bg-[#1a1d27] rounded-xl border border-white/5 p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-slate-200">{title}</h3>
        {action}
      </div>
      {children}
    </div>
  );
}

function KPI({ label, value, sub, color = 'text-white' }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="bg-[#0f1117] rounded-lg p-4 border border-white/5">
      <p className="text-[11px] text-slate-500">{label}</p>
      <p className={`text-xl font-bold tabular-nums mt-1 ${color}`}>{value}</p>
      {sub && <p className="text-[11px] text-slate-500 mt-0.5">{sub}</p>}
    </div>
  );
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#1a1d27] border border-white/10 rounded-lg p-3 text-xs shadow-xl">
      <p className="text-slate-400 mb-1.5">{label}</p>
      {payload.map((p: any) => (
        <div key={p.name} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span className="text-slate-400">{p.name}:</span>
          <span className="text-white font-semibold">{typeof p.value === 'number' && p.value > 1000 ? fmtSAR(p.value) : p.value}</span>
        </div>
      ))}
    </div>
  );
};

export default function Reports() {
  const [period, setPeriod]               = useState<'month' | 'quarter' | 'year'>('month');
  const [financialData, setFinancialData] = useState<any>(null);
  const [drivers, setDrivers]             = useState<any[]>([]);
  const [vehicleSummary, setVehicleSummary] = useState<any>(null);
  const [loading, setLoading]             = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const [fin, drv, veh] = await Promise.all([
        financeApi.getFinancialSummary(period),
        driversApi.getAll({ limit: '100' }),
        vehiclesApi.getSummary(),
      ]);
      setFinancialData(fin);
      setDrivers(drv.data || drv);
      setVehicleSummary(veh);
    } catch { toast.error('Failed to load report data'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [period]);

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <p className="text-slate-500 text-sm">Loading reports...</p>
    </div>
  );

  const rev = financialData?.revenue || {};
  const monthlyData = (financialData?.monthlyData || []).reverse().map((m: any) => ({
    month: m.month,
    Revenue: Number(m.revenue || 0),
    Expenses: Number(m.expenses || 0),
    Profit: Number(m.revenue || 0) - Number(m.expenses || 0),
  }));

  const expByCategory = (financialData?.expensesByCategory || []).map((e: any) => ({
    name: e.category?.charAt(0).toUpperCase() + e.category?.slice(1),
    value: Number(e.total_expenses),
    count: e.count,
  }));

  const agedReceivables = financialData?.agedReceivables || [];
  const outstandingInvoices = financialData?.outstandingInvoices || [];

  // Driver performance table — top 10 by trips
  const topDrivers = [...drivers]
    .sort((a, b) => (b.total_trips || 0) - (a.total_trips || 0))
    .slice(0, 10);

  // Vehicle status breakdown
  const vehicleByStatus = vehicleSummary?.byStatus || [];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Reports & Analytics</h1>
          <p className="text-xs text-slate-500 mt-0.5">Financial performance, receivables, fleet</p>
        </div>
        <div className="flex gap-1 bg-[#1a1d27] rounded-lg p-1 border border-white/5">
          {(['month','quarter','year'] as const).map(p => (
            <button key={p} onClick={() => setPeriod(p)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors capitalize ${
                period === p ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
              }`}>{p}</button>
          ))}
        </div>
      </div>

      {/* Top KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KPI label="Total Invoiced" value={fmtSAR(rev.total_invoiced)} color="text-white" />
        <KPI label="Collected" value={fmtSAR(rev.total_collected)} color="text-emerald-400" />
        <KPI label="Outstanding" value={fmtSAR(rev.total_outstanding)} color={Number(rev.total_outstanding) > 0 ? 'text-amber-400' : 'text-emerald-400'} />
        <KPI label="Collection Rate"
          value={rev.total_invoiced > 0 ? `${((rev.total_collected / rev.total_invoiced) * 100).toFixed(1)}%` : '—'}
          color="text-blue-400" />
      </div>

      {/* Revenue vs Expenses chart */}
      <SectionCard title="Revenue vs Expenses (Monthly)">
        {monthlyData.length === 0 ? (
          <p className="text-slate-500 text-xs text-center py-8">No data for this period</p>
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={monthlyData} margin={{ top: 5, right: 10, bottom: 5, left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#64748b' }} />
              <YAxis tick={{ fontSize: 10, fill: '#64748b' }} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: 11, color: '#94a3b8' }} />
              <Line type="monotone" dataKey="Revenue"  stroke="#3b82f6" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="Expenses" stroke="#ef4444" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="Profit"   stroke="#10b981" strokeWidth={2} dot={false} strokeDasharray="4 2" />
            </LineChart>
          </ResponsiveContainer>
        )}
      </SectionCard>

      {/* Expenses by category + Aged receivables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* Expenses breakdown */}
        <SectionCard title="Expenses by Category">
          {expByCategory.length === 0 ? (
            <p className="text-slate-500 text-xs text-center py-8">No approved expenses this period</p>
          ) : (
            <div className="flex items-center gap-4">
              <ResponsiveContainer width={140} height={140}>
                <PieChart>
                  <Pie data={expByCategory} dataKey="value" cx="50%" cy="50%" innerRadius={35} outerRadius={60}>
                    {expByCategory.map((_: any, i: number) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="flex-1 space-y-1.5">
                {expByCategory.map((e: any, i: number) => (
                  <div key={e.name} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} />
                      <span className="text-xs text-slate-400">{e.name}</span>
                    </div>
                    <span className="text-xs text-white font-semibold tabular-nums">{fmtSAR(e.value)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </SectionCard>

        {/* Aged receivables */}
        <SectionCard title="Aged Receivables">
          {agedReceivables.length === 0 ? (
            <p className="text-slate-500 text-xs text-center py-8">No outstanding receivables</p>
          ) : (
            <div className="space-y-2">
              {agedReceivables.map((bucket: any) => {
                const color = AGING_COLORS[bucket.aging_bucket] || '#94a3b8';
                const total = agedReceivables.reduce((s: number, b: any) => s + Number(b.amount), 0);
                const pct   = total > 0 ? (Number(bucket.amount) / total) * 100 : 0;
                return (
                  <div key={bucket.aging_bucket}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full" style={{ background: color }} />
                        <span className="text-slate-400">{bucket.aging_bucket}</span>
                        <span className="text-slate-600">({bucket.invoice_count} inv.)</span>
                      </div>
                      <span className="text-white font-semibold tabular-nums">{fmtSAR(bucket.amount)}</span>
                    </div>
                    <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
                    </div>
                  </div>
                );
              })}
              <div className="pt-2 border-t border-white/5 flex justify-between text-xs">
                <span className="text-slate-500">Total Outstanding</span>
                <span className="text-white font-bold">{fmtSAR(agedReceivables.reduce((s: number, b: any) => s + Number(b.amount), 0))}</span>
              </div>
            </div>
          )}
        </SectionCard>
      </div>

      {/* Outstanding invoices table */}
      {outstandingInvoices.length > 0 && (
        <SectionCard title="Top Outstanding Invoices (by due date)">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-white/5">
                  {['Invoice #','Customer','Due Date','Total','Balance','Days Overdue'].map(h => (
                    <th key={h} className="py-2 pr-4 text-left text-[11px] font-medium text-slate-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {outstandingInvoices.map((inv: any) => {
                  const daysOverdue = Math.ceil((Date.now() - new Date(inv.due_date).getTime()) / 86400000);
                  return (
                    <tr key={inv.id} className="border-b border-white/5">
                      <td className="py-2 pr-4 font-mono text-blue-400">{inv.invoice_number}</td>
                      <td className="py-2 pr-4 text-white font-medium max-w-[150px] truncate">{inv.customer_name}</td>
                      <td className="py-2 pr-4 text-slate-400">{fmtDate(inv.due_date)}</td>
                      <td className="py-2 pr-4 text-white">{fmtSAR(inv.total_amount)}</td>
                      <td className="py-2 pr-4 text-red-400 font-bold">{fmtSAR(inv.balance_due)}</td>
                      <td className="py-2 pr-4">
                        {daysOverdue > 0
                          ? <span className="text-red-400 font-semibold">{daysOverdue}d overdue</span>
                          : <span className="text-emerald-400">Current</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </SectionCard>
      )}

      {/* Driver Performance */}
      <SectionCard title="Driver Performance (all time)">
        {topDrivers.length === 0 ? (
          <p className="text-slate-500 text-xs text-center py-8">No driver data</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-white/5">
                  {['Driver','License Type','Experience','Total Trips','Rating','Vehicle','Status'].map(h => (
                    <th key={h} className="py-2 pr-4 text-left text-[11px] font-medium text-slate-500 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {topDrivers.map((d: any, i: number) => (
                  <tr key={d.id} className="border-b border-white/5">
                    <td className="py-2.5 pr-4">
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-blue-500/20 flex items-center justify-center text-[10px] text-blue-400 font-bold">{i+1}</span>
                        <span className="text-white font-semibold">{d.first_name} {d.last_name}</span>
                      </div>
                    </td>
                    <td className="py-2.5 pr-4 text-slate-400 capitalize">{d.license_type}</td>
                    <td className="py-2.5 pr-4 text-slate-400">{d.years_of_experience || 0} yrs</td>
                    <td className="py-2.5 pr-4 text-white font-bold">{d.total_trips || 0}</td>
                    <td className="py-2.5 pr-4">
                      <div className="flex items-center gap-1">
                        <svg className="w-3 h-3 text-amber-400" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/></svg>
                        <span className="text-slate-300">{Number(d.rating || 5).toFixed(1)}</span>
                      </div>
                    </td>
                    <td className="py-2.5 pr-4 text-slate-400">{d.assigned_vehicle_plate || '—'}</td>
                    <td className="py-2.5 pr-4">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                        d.driver_status === 'available' ? 'bg-emerald-500/15 text-emerald-400' :
                        d.driver_status === 'on_trip'   ? 'bg-blue-500/15 text-blue-400' :
                        'bg-slate-500/15 text-slate-400'
                      }`}>{d.driver_status?.replace('_',' ')}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      {/* Vehicle fleet breakdown */}
      {vehicleByStatus.length > 0 && (
        <SectionCard title="Fleet Status Breakdown">
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            {vehicleByStatus.map((v: any) => (
              <div key={v.status} className="bg-[#0f1117] rounded-lg p-3 border border-white/5 text-center">
                <p className="text-2xl font-bold text-white">{v.count}</p>
                <p className="text-[11px] text-slate-500 mt-1 capitalize">{v.status}</p>
              </div>
            ))}
          </div>
        </SectionCard>
      )}
    </div>
  );
}
