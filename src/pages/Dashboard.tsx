import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { authApi } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';

// ── helpers ──────────────────────────────────────────────────────
const fmt = (n: number) =>
  new Intl.NumberFormat('en-SA', { style: 'currency', currency: 'SAR', maximumFractionDigits: 0 }).format(n || 0);

const fmtShort = (n: number) => {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(0)}K`;
  return String(n || 0);
};

const STATUS_COLORS: Record<string, string> = {
  pending:    '#f59e0b',
  confirmed:  '#3b82f6',
  picked_up:  '#8b5cf6',
  in_transit: '#6366f1',
  customs:    '#f97316',
  delivered:  '#10b981',
  cancelled:  '#ef4444',
  returned:   '#64748b',
};

const DRIVER_STATUS_COLORS: Record<string, string> = {
  available:  '#10b981',
  on_trip:    '#3b82f6',
  on_leave:   '#f59e0b',
  suspended:  '#ef4444',
  off_duty:   '#64748b',
};

const EXPIRY_COLORS: Record<string, { bg: string; text: string; bar: string }> = {
  critical: { bg: 'bg-red-500/10',    text: 'text-red-400',    bar: 'bg-red-500' },
  warning:  { bg: 'bg-amber-500/10',  text: 'text-amber-400',  bar: 'bg-amber-500' },
  ok:       { bg: 'bg-blue-500/10',   text: 'text-blue-400',   bar: 'bg-blue-500' },
};

function getExpiryLevel(days: number) {
  if (days <= 7)  return 'critical';
  if (days <= 30) return 'warning';
  return 'ok';
}

// ── sub-components ────────────────────────────────────────────────
function StatCard({ label, value, sub, color, icon }: {
  label: string; value: string | number; sub?: string;
  color: string; icon: string;
}) {
  const ICONS: Record<string, JSX.Element> = {
    customers: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/></svg>,
    drivers:   <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"/></svg>,
    vehicles:  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0"/></svg>,
    shipments: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/></svg>,
    revenue:   <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"/></svg>,
    invoice:   <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z"/></svg>,
    approval:  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"/></svg>,
    employees: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"/></svg>,
  };

  const COLOR_MAP: Record<string, { ring: string; bg: string; text: string }> = {
    blue:    { ring: 'ring-blue-500/20',    bg: 'bg-blue-500/10',    text: 'text-blue-400' },
    emerald: { ring: 'ring-emerald-500/20', bg: 'bg-emerald-500/10', text: 'text-emerald-400' },
    purple:  { ring: 'ring-purple-500/20',  bg: 'bg-purple-500/10',  text: 'text-purple-400' },
    amber:   { ring: 'ring-amber-500/20',   bg: 'bg-amber-500/10',   text: 'text-amber-400' },
    rose:    { ring: 'ring-rose-500/20',    bg: 'bg-rose-500/10',    text: 'text-rose-400' },
    cyan:    { ring: 'ring-cyan-500/20',    bg: 'bg-cyan-500/10',    text: 'text-cyan-400' },
    indigo:  { ring: 'ring-indigo-500/20',  bg: 'bg-indigo-500/10',  text: 'text-indigo-400' },
  };

  const c = COLOR_MAP[color] || COLOR_MAP.blue;
  return (
    <div className={`bg-[#1a1d27] rounded-xl p-4 border border-white/5 ring-1 ${c.ring} hover:opacity-90 transition-all`}>
      <div className="flex items-start justify-between mb-3">
        <div className={`w-9 h-9 rounded-lg ${c.bg} flex items-center justify-center ${c.text}`}>
          {ICONS[icon] || ICONS.shipments}
        </div>
        {sub && <span className="text-[11px] text-slate-500 bg-white/5 px-2 py-0.5 rounded-full">{sub}</span>}
      </div>
      <p className="text-2xl font-bold text-white tabular-nums">{value}</p>
      <p className="text-xs text-slate-500 mt-1">{label}</p>
    </div>
  );
}

function SectionTitle({ title, action }: { title: string; action?: JSX.Element }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <h2 className="text-sm font-semibold text-slate-200">{title}</h2>
      {action}
    </div>
  );
}

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-[#1a1d27] rounded-xl border border-white/5 p-4 ${className}`}>
      {children}
    </div>
  );
}

// Custom tooltip for charts
const ChartTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#1a1d27] border border-white/10 rounded-lg px-3 py-2 shadow-xl text-xs">
      <p className="text-slate-400 mb-1">{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ color: p.color }} className="font-medium">
          {p.name}: {typeof p.value === 'number' && p.value > 1000 ? fmtShort(p.value) : p.value}
        </p>
      ))}
    </div>
  );
};

// ── Main Component ────────────────────────────────────────────────
export default function Dashboard() {
  const { user, hasPermission } = useAuth();
  const [stats, setStats]       = useState<any>(null);
  const [loading, setLoading]   = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const data = await authApi.getDashboardStats();
      setStats(data);
      if (isRefresh) toast.success('Dashboard refreshed');
    } catch {
      toast.error('Failed to load dashboard');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-80">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
          <p className="text-xs text-slate-500">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  // ── DRIVER VIEW ───────────────────────────────────────
  if (user?.role === 'driver') {
    const d = stats?.myDriver;
    const s = stats?.myStats;
    return (
      <div className="space-y-5 max-w-4xl">
        <div>
          <h1 className="text-xl font-bold text-white">My Dashboard</h1>
          <p className="text-xs text-slate-500 mt-0.5">Welcome back, {user.firstName}</p>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard label="Total Trips"    value={s?.total_trips || 0}   color="blue"    icon="shipments" />
          <StatCard label="Completed"      value={s?.completed || 0}     color="emerald" icon="shipments" />
          <StatCard label="Active"         value={s?.active || 0}        color="amber"   icon="shipments" />
          <StatCard label="Rating"         value={`${d?.rating || 0} ★`} color="purple"  icon="drivers" />
        </div>
        {d?.vehicle_plate && (
          <Card>
            <p className="text-xs text-slate-500 mb-1">Assigned Vehicle</p>
            <p className="text-white font-semibold">{d.vehicle_plate} — {d.vehicle_type}</p>
            <span className={`inline-block mt-2 text-[11px] px-2 py-0.5 rounded-full font-medium ${d.driver_status === 'available' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-blue-500/20 text-blue-400'}`}>
              {d.driver_status}
            </span>
          </Card>
        )}
        <Card>
          <SectionTitle title="My Recent Shipments" />
          <div className="space-y-2">
            {stats?.myShipments?.length ? stats.myShipments.map((s: any) => (
              <Link key={s.id} to={`/shipments/${s.id}`}
                className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-white/5 transition-colors border border-transparent hover:border-white/5">
                <div>
                  <p className="text-xs font-medium text-white">{s.shipment_number}</p>
                  <p className="text-[11px] text-slate-500">{s.origin_city} → {s.destination_city}</p>
                </div>
                <span className="text-[11px] px-2 py-0.5 rounded-full" style={{ background: `${STATUS_COLORS[s.status]}20`, color: STATUS_COLORS[s.status] }}>
                  {s.status.replace(/_/g, ' ')}
                </span>
              </Link>
            )) : <p className="text-xs text-slate-500 text-center py-4">No shipments assigned</p>}
          </div>
        </Card>
      </div>
    );
  }

  // ── FULL DASHBOARD ────────────────────────────────────
  const counts     = stats?.counts     || {};
  const financials = stats?.financials || {};
  const expiryAlerts     = stats?.expiryAlerts     || [];
  const overdueShipments = stats?.overdueShipments || [];
  const topDrivers       = stats?.topDrivers       || [];
  const shipmentStatus   = stats?.shipmentStatus   || [];
  const driverStatus     = stats?.driverStatusBreakdown || [];
  const revenueChart     = stats?.monthlyRevenueChart   || [];
  const todayShipments   = stats?.todayShipments   || [];
  const activities       = stats?.activities       || [];

  // Prepare pie data
  const shipmentPie = shipmentStatus.map((s: any) => ({
    name: s.status.replace(/_/g, ' '), value: parseInt(s.count),
    color: STATUS_COLORS[s.status] || '#64748b',
  }));

  const driverPie = driverStatus.map((s: any) => ({
    name: s.status, value: parseInt(s.count),
    color: DRIVER_STATUS_COLORS[s.status] || '#64748b',
  }));

  // Revenue chart formatting
  const revenueData = revenueChart.map((r: any) => ({
    month: r.month?.slice(5) || r.month,
    revenue: parseFloat(r.revenue) || 0,
    invoices: parseInt(r.invoice_count) || 0,
  }));

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Operations Dashboard</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            {new Date().toLocaleDateString('en-SA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <button onClick={() => load(true)} disabled={refreshing}
          className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 px-3 py-1.5 rounded-lg border border-white/5 transition-colors disabled:opacity-50">
          {refreshing
            ? <div className="w-3.5 h-3.5 border border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
            : <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
          }
          {refreshing ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {/* ── ROW 1: KPI cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard label="Active Customers"   value={counts.customers || 0}        color="blue"    icon="customers" />
        <StatCard label="Available Drivers"  value={counts.availableDrivers || 0} color="emerald" icon="drivers" />
        <StatCard label="Active Vehicles"    value={counts.activeVehicles || 0}   color="purple"  icon="vehicles" />
        <StatCard label="Active Shipments"   value={counts.activeShipments || 0}  color="amber"   icon="shipments" />
        {hasPermission(['super_admin','admin','accountant']) && (
          <StatCard label="Monthly Revenue"    value={fmtShort(financials.monthlyRevenue || 0)} sub="SAR" color="cyan"    icon="revenue" />
        )}
        {hasPermission(['super_admin','admin','accountant']) && (
          <StatCard label="Pending Invoices"   value={fmtShort(financials.pendingInvoices || 0)} sub="SAR" color="rose"    icon="invoice" />
        )}
        {hasPermission(['super_admin','admin']) && counts.pendingApprovals > 0 && (
          <StatCard label="Pending Approvals"  value={counts.pendingApprovals || 0}              color="indigo"  icon="approval" sub="action needed" />
        )}
      </div>

      {/* ── ROW 2: Revenue chart + Shipment status pie ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {hasPermission(['super_admin','admin','accountant']) && revenueData.length > 0 && (
          <Card className="lg:col-span-2">
            <SectionTitle title="Revenue Trend — Last 12 Months" />
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={revenueData} margin={{ top: 5, right: 10, bottom: 0, left: 0 }}>
                  <defs>
                    <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#3b82f6" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" />
                  <XAxis dataKey="month" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tickFormatter={fmtShort} tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip content={<ChartTooltip />} />
                  <Area type="monotone" dataKey="revenue" name="Revenue (SAR)" stroke="#3b82f6" strokeWidth={2} fill="url(#revGrad)" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Card>
        )}

        {shipmentPie.length > 0 && (
          <Card>
            <SectionTitle title="Shipment Status" />
            <div className="h-[160px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={shipmentPie} cx="50%" cy="50%" innerRadius={42} outerRadius={62} paddingAngle={2} dataKey="value">
                    {shipmentPie.map((entry: any, i: number) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip content={<ChartTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-1.5 mt-1">
              {shipmentPie.map((s: any) => (
                <div key={s.name} className="flex items-center justify-between text-xs px-1 py-0.5 rounded hover:bg-white/5">
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: s.color }} />
                    <span className="text-slate-400 capitalize">{s.name}</span>
                  </div>
                  <span className="font-semibold tabular-nums" style={{ color: s.color }}>{s.value}</span>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>

      {/* ── ROW 3: Driver status bar + Top drivers + Today's shipments ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Driver status */}
        {hasPermission(['super_admin','admin','dispatcher']) && driverPie.length > 0 && (
          <Card>
            <SectionTitle title="Driver Status" />
            <div className="h-36">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={driverPie} margin={{ top: 5, right: 5, bottom: 5, left: -20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" />
                  <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} />
                  <Tooltip content={<ChartTooltip />} />
                  <Bar dataKey="value" name="Drivers" radius={[3, 3, 0, 0]}>
                    {driverPie.map((entry: any, i: number) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        )}

        {/* Top drivers */}
        {hasPermission(['super_admin','admin','dispatcher']) && topDrivers.length > 0 && (
          <Card>
            <SectionTitle title="Top Drivers" action={<Link to="/drivers" className="text-[11px] text-blue-400 hover:text-blue-300">View all</Link>} />
            <div className="space-y-2.5">
              {topDrivers.slice(0, 5).map((d: any, i: number) => (
                <div key={i} className="flex items-center gap-2.5">
                  <div className="w-6 h-6 rounded-full bg-gradient-to-br from-slate-600 to-slate-700 flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0">
                    {d.first_name?.[0]}{d.last_name?.[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-white truncate">{d.first_name} {d.last_name}</p>
                    <div className="flex items-center gap-1 mt-0.5">
                      <div className="flex-1 h-1 bg-white/5 rounded-full overflow-hidden">
                        <div className="h-full bg-amber-400 rounded-full" style={{ width: `${(d.rating / 5) * 100}%` }} />
                      </div>
                      <span className="text-[10px] text-amber-400 flex-shrink-0">{d.rating}★</span>
                    </div>
                  </div>
                  <span className="text-[10px] text-slate-500 flex-shrink-0">{d.total_trips} trips</span>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Today's shipments */}
        <Card>
          <SectionTitle title="Today's Shipments" action={<Link to="/shipments" className="text-[11px] text-blue-400 hover:text-blue-300">View all</Link>} />
          <div className="space-y-2">
            {todayShipments.length ? todayShipments.map((s: any) => (
              <Link key={s.id} to={`/shipments/${s.id}`}
                className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-white/5 transition-colors">
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-white truncate">{s.shipment_number}</p>
                  <p className="text-[11px] text-slate-500 truncate">{s.origin_city} → {s.destination_city}</p>
                </div>
                <span className="ml-2 flex-shrink-0 text-[10px] px-1.5 py-0.5 rounded-full font-medium"
                  style={{ background: `${STATUS_COLORS[s.status] || '#64748b'}20`, color: STATUS_COLORS[s.status] || '#64748b' }}>
                  {s.status.replace(/_/g, ' ')}
                </span>
              </Link>
            )) : (
              <div className="text-center py-6">
                <p className="text-xs text-slate-500">No shipments today</p>
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* ── ROW 4: Expiry alerts + Overdue shipments ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Expiry alerts */}
        {hasPermission(['super_admin','admin','dispatcher']) && (
          <Card>
            <SectionTitle title={`Expiry Alerts${expiryAlerts.length ? ` (${expiryAlerts.length})` : ''}`} />
            {expiryAlerts.length ? (
              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                {expiryAlerts.map((a: any, i: number) => {
                  const level = getExpiryLevel(a.days_remaining);
                  const c = EXPIRY_COLORS[level];
                  return (
                    <div key={i} className={`flex items-center gap-3 p-2.5 rounded-lg ${c.bg} border border-white/5`}>
                      <div className={`w-1.5 h-8 rounded-full flex-shrink-0 ${c.bar}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-white truncate">{a.name}</p>
                        <p className="text-[11px] text-slate-400 capitalize mt-0.5">{a.type.replace(/_/g, ' ')}</p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className={`text-xs font-bold ${c.text}`}>{a.days_remaining}d</p>
                        <p className="text-[10px] text-slate-500">{new Date(a.expiry_date).toLocaleDateString('en-SA')}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8">
                <div className="w-10 h-10 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto mb-2">
                  <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                  </svg>
                </div>
                <p className="text-xs text-slate-500">No upcoming expirations</p>
              </div>
            )}
          </Card>
        )}

        {/* Overdue shipments */}
        {hasPermission(['super_admin','admin','dispatcher']) && (
          <Card>
            <SectionTitle title={`Overdue Shipments${overdueShipments.length ? ` (${overdueShipments.length})` : ''}`} />
            {overdueShipments.length ? (
              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                {overdueShipments.map((s: any, i: number) => (
                  <Link key={i} to={`/shipments/${s.id}`}
                    className="flex items-center gap-3 p-2.5 rounded-lg bg-red-500/5 border border-red-500/10 hover:bg-red-500/10 transition-colors">
                    <div className="w-1.5 h-8 rounded-full bg-red-500 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-white truncate">{s.shipment_number}</p>
                      <p className="text-[11px] text-slate-400 truncate">{s.customer_name}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-xs text-red-400 font-medium">{s.origin_city}→{s.destination_city}</p>
                      <p className="text-[10px] text-slate-500">{new Date(s.requested_delivery_date).toLocaleDateString('en-SA')}</p>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <div className="w-10 h-10 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto mb-2">
                  <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                  </svg>
                </div>
                <p className="text-xs text-slate-500">No overdue shipments</p>
              </div>
            )}
          </Card>
        )}
      </div>

      {/* ── ROW 5: Pending approvals + Recent activity ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Pending approvals */}
        {hasPermission(['super_admin','admin']) && (
          <Card>
            <SectionTitle title="Pending Approvals"
              action={<Link to="/shipments?approval_status=pending_approval" className="text-[11px] text-blue-400 hover:text-blue-300">View all</Link>} />
            {counts.pendingApprovals > 0 ? (
              <div className="space-y-2">
                <div className="flex items-center gap-3 p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-lg">
                  <div className="w-9 h-9 bg-indigo-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
                    <svg className="w-5 h-5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"/>
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-bold text-white">{counts.pendingApprovals}</p>
                    <p className="text-xs text-slate-400">shipment{counts.pendingApprovals !== 1 ? 's' : ''} awaiting your approval</p>
                  </div>
                  <Link to="/shipments?approval_status=pending_approval"
                    className="ml-auto text-xs bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 px-3 py-1.5 rounded-lg transition-colors font-medium">
                    Review
                  </Link>
                </div>
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-xs text-slate-500">No pending approvals</p>
              </div>
            )}
          </Card>
        )}

        {/* Recent activity */}
        <Card>
          <SectionTitle title="Recent Activity" />
          <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
            {activities.length ? activities.slice(0, 10).map((a: any) => (
              <div key={a.id} className="flex items-start gap-2.5">
                <div className="w-6 h-6 rounded-full bg-slate-700 flex items-center justify-center text-[9px] font-bold text-slate-300 flex-shrink-0 mt-0.5">
                  {a.first_name?.[0]}{a.last_name?.[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-slate-300 leading-snug">{a.action.replace(/_/g, ' ').toLowerCase()}</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">{a.first_name} {a.last_name}</p>
                </div>
                <span className="text-[10px] text-slate-600 flex-shrink-0">
                  {new Date(a.created_at).toLocaleTimeString('en-SA', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            )) : <p className="text-xs text-slate-500 text-center py-4">No recent activity</p>}
          </div>
        </Card>
      </div>
    </div>
  );
}
