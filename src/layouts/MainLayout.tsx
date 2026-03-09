import { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate, Outlet } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import { notificationsApi, authApi } from '@/lib/api';
import { ROLES } from '@/lib/roles';

const NAV = [
  { name: 'Dashboard',      href: '/dashboard',   icon: 'dashboard',   roles: [] },
  { name: 'Shipments',      href: '/shipments',   icon: 'package',     roles: [] },
  { name: 'Fleet',          href: '/fleet',       icon: 'truck',       roles: ROLES.FLEET_VIEW },
  { name: 'Employees',      href: '/employees',   icon: 'usergroup',   roles: ROLES.MANAGEMENT },
  { name: 'Customers',      href: '/customers',   icon: 'building',    roles: ROLES.CUSTOMER_VIEW },
  { name: 'Invoices',       href: '/invoices',    icon: 'filetext',    roles: ROLES.FINANCE },
  { name: 'Payments',       href: '/payments',    icon: 'creditcard',  roles: ROLES.FINANCE },
  { name: 'Expenses',       href: '/expenses',    icon: 'receipt',     roles: [...ROLES.FINANCE, 'dispatcher'] as any },
  { name: 'Maintenance',    href: '/maintenance', icon: 'wrench',      roles: ROLES.OPERATIONS },
  { name: 'Reports',        href: '/reports',     icon: 'barchart',    roles: ROLES.REPORTS },
  { name: 'Payroll',        href: '/payroll',     icon: 'payroll',     roles: ROLES.PAY_VIEW },
  { name: 'My Salary Slips',href: '/payroll',     icon: 'payroll',     roles: ['office_admin','dispatcher','driver'] as any },
  { name: 'Users',          href: '/users',       icon: 'usercog',     roles: ROLES.ADMIN_UP },
  { name: 'Settings',       href: '/settings',    icon: 'settings',    roles: ROLES.ADMIN_UP },
];

const ROLE_COLORS: Record<string, string> = {
  super_admin:  'bg-red-500/20 text-red-300',
  admin:        'bg-blue-500/20 text-blue-300',
  accountant:   'bg-emerald-500/20 text-emerald-300',
  office_admin: 'bg-purple-500/20 text-purple-300',
  dispatcher:   'bg-amber-500/20 text-amber-300',
  driver:       'bg-cyan-500/20 text-cyan-300',
};

const PRIORITY_STYLE: Record<string, { dot: string; badge: string }> = {
  high:   { dot: 'bg-red-500',   badge: 'bg-red-500/15 text-red-400 border-red-500/25' },
  medium: { dot: 'bg-amber-500', badge: 'bg-amber-500/15 text-amber-400 border-amber-500/25' },
  low:    { dot: 'bg-blue-500',  badge: 'bg-blue-500/15 text-blue-400 border-blue-500/25' },
};

function Icon({ name, className }: { name: string; className?: string }) {
  const p = { className: className || 'w-5 h-5', fill: 'none', stroke: 'currentColor', viewBox: '0 0 24 24' };
  const icons: Record<string, JSX.Element> = {
    dashboard: <svg {...p}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"/></svg>,
    package:   <svg {...p}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/></svg>,
    truck:     <svg {...p}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0"/></svg>,
    users:     <svg {...p}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"/></svg>,
    usergroup: <svg {...p}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"/></svg>,
    building:  <svg {...p}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/></svg>,
    filetext:  <svg {...p}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>,
    creditcard:<svg {...p}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"/></svg>,
    receipt:   <svg {...p}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z"/></svg>,
    wrench:    <svg {...p}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/></svg>,
    barchart:  <svg {...p}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg>,
    payroll:   <svg {...p}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"/></svg>,
    usercog:   <svg {...p}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>,
    settings:  <svg {...p}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/></svg>,
    bell:      <svg {...p}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/></svg>,
    logout:    <svg {...p}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/></svg>,
    key:       <svg {...p}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"/></svg>,
    user:      <svg {...p}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>,
    menu:      <svg {...p}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 12h16M4 18h16"/></svg>,
    x:         <svg {...p}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12"/></svg>,
    bolt:      <svg {...p}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>,
  };
  return icons[name] || icons['dashboard'];
}

export default function MainLayout() {
  const { user, logout, hasPermission } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const bellRef  = useRef<HTMLDivElement>(null);

  const [sidebarOpen, setSidebarOpen]     = useState(false);
  const [notifOpen, setNotifOpen]         = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [showChangePw, setShowChangePw]   = useState(false);
  const [changePwForm, setChangePwForm]   = useState({ current: '', next: '', show: false });
  const [changePwSaving, setChangePwSaving] = useState(false);
  const [notifLoading, setNotifLoading]   = useState(false);

  const loadNotifications = async () => {
    setNotifLoading(true);
    try {
      const data = await notificationsApi.get();
      setNotifications(data?.notifications || []);
    } catch { setNotifications([]); }
    finally { setNotifLoading(false); }
  };

  useEffect(() => {
    loadNotifications();
    const t = setInterval(loadNotifications, 60000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const fn = (e: MouseEvent) => {
      if (bellRef.current && !bellRef.current.contains(e.target as Node)) setNotifOpen(false);
    };
    document.addEventListener('mousedown', fn);
    return () => document.removeEventListener('mousedown', fn);
  }, []);

  const filteredNav = NAV.filter(i => i.roles.length === 0 || hasPermission(i.roles as any));
  const totalCount  = notifications.length;
  const urgentCount = notifications.filter(n => n.priority === 'high').length;
  const badgeColor  = urgentCount > 0 ? 'bg-red-500' : 'bg-blue-500';

  return (
  <>
    <div className="min-h-screen bg-[#0f1117] text-white flex">
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/60 z-40 lg:hidden backdrop-blur-sm"
          onClick={() => setSidebarOpen(false)} />
      )}

      {/* ── SIDEBAR ──────────────────────────────────── */}
      <aside className={`
        fixed top-0 left-0 z-50 h-full w-[220px] flex flex-col
        bg-[#0d0f14] border-r border-white/5
        transition-transform duration-300 ease-in-out
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>

        {/* Logo */}
        <div className="flex items-center gap-3 px-5 py-5 border-b border-white/5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center shadow-lg shadow-blue-900/30 flex-shrink-0">
            <Icon name="bolt" className="w-5 h-5 text-white" />
          </div>
          <div className="min-w-0">
            <p className="font-bold text-sm text-white leading-none">Rawabi</p>
            <p className="text-[11px] text-slate-500 mt-0.5">Logistics ERP</p>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="lg:hidden ml-auto p-1 text-slate-500 hover:text-white">
            <Icon name="x" className="w-4 h-4" />
          </button>
        </div>

        {/* User chip */}
        <div className="px-4 py-3 border-b border-white/5">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-xs font-bold text-white flex-shrink-0">
              {user?.firstName?.[0]}{user?.lastName?.[0]}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-white truncate">{user?.firstName} {user?.lastName}</p>
              <span className={`inline-block text-[10px] px-1.5 py-0.5 rounded-full font-medium mt-0.5 ${ROLE_COLORS[user?.role || ''] || 'bg-slate-700 text-slate-300'}`}>
                {user?.role?.replace('_', ' ')}
              </span>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
          {filteredNav.map(item => {
            const active = location.pathname === item.href || location.pathname.startsWith(item.href + '/');
            return (
              <Link key={item.name} to={item.href} onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-all duration-150 group border
                  ${active
                    ? 'bg-blue-600/20 text-blue-400 border-blue-500/20'
                    : 'text-slate-400 hover:bg-white/5 hover:text-slate-200 border-transparent'
                  }`}>
                <Icon name={item.icon} className={`w-4 h-4 flex-shrink-0 ${active ? 'text-blue-400' : 'text-slate-500 group-hover:text-slate-300'}`} />
                <span>{item.name}</span>
                {active && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-blue-400" />}
              </Link>
            );
          })}
        </nav>

        {/* Nav bottom spacer */}
        <div className="h-3" />
      </aside>

      {/* ── MAIN ─────────────────────────────────────── */}
      <div className="lg:ml-[220px] flex-1 flex flex-col min-h-screen">

        {/* Header */}
        <header className="sticky top-0 z-30 bg-[#0f1117]/90 backdrop-blur-md border-b border-white/5 px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => setSidebarOpen(true)} className="lg:hidden p-2 text-slate-400 hover:text-white">
              <Icon name="menu" className="w-5 h-5" />
            </button>
            <div className="hidden sm:flex items-center gap-1.5 text-xs text-slate-500">
              <span>Rawabi ERP</span>
              <span>/</span>
              <span className="text-slate-300 capitalize">{location.pathname.split('/')[1] || 'dashboard'}</span>
            </div>
          </div>

          <div className="flex items-center gap-2">

            {/* Bell + count pill */}
            <div ref={bellRef} className="relative">
              <button
                onClick={() => { setNotifOpen(o => !o); if (!notifOpen) loadNotifications(); }}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg transition-colors border ${
                  totalCount > 0
                    ? 'bg-white/5 border-white/10 text-white hover:bg-white/10'
                    : 'border-transparent text-slate-400 hover:text-white hover:bg-white/5'
                }`}>
                <Icon name="bell" className="w-[17px] h-[17px]" />
                {totalCount > 0 && (
                  <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded-full text-white leading-none ${badgeColor}`}>
                    {totalCount > 99 ? '99+' : totalCount}
                  </span>
                )}
              </button>

              {/* Notifications panel */}
              {notifOpen && (
                <div className="absolute right-0 top-full mt-2 w-[340px] rounded-xl border border-white/10 bg-[#1a1d27] shadow-2xl z-50 overflow-hidden">

                  <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-bold text-white">Notifications</p>
                      {urgentCount > 0 && (
                        <span className="text-[10px] px-1.5 py-0.5 bg-red-500/15 text-red-400 border border-red-500/25 rounded-full font-medium">
                          {urgentCount} urgent
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {notifLoading && <div className="w-3 h-3 border border-blue-400/40 border-t-blue-400 rounded-full animate-spin" />}
                      <button onClick={() => setNotifOpen(false)} className="p-1 rounded text-slate-400 hover:text-white hover:bg-white/5">
                        <Icon name="x" className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="max-h-[360px] overflow-y-auto">
                    {notifications.length === 0 ? (
                      <div className="text-center py-12">
                        <p className="text-xs text-slate-500">{notifLoading ? 'Loading...' : 'All caught up'}</p>
                      </div>
                    ) : (
                      notifications.map(n => {
                        const ps = PRIORITY_STYLE[n.priority] || PRIORITY_STYLE.low;
                        return (
                          <Link key={n.id} to={n.link || '#'}
                            onClick={() => setNotifOpen(false)}
                            className="flex items-start gap-3 px-4 py-3.5 hover:bg-white/5 transition-colors border-b border-white/5 last:border-0">
                            <div className={`w-2 h-2 rounded-full flex-shrink-0 mt-1.5 ${ps.dot}`} />
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-semibold text-white leading-snug">{n.title}</p>
                              <p className="text-[11px] text-slate-400 mt-0.5 truncate">{n.message}</p>
                            </div>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded border font-medium flex-shrink-0 ${ps.badge}`}>
                              {n.priority}
                            </span>
                          </Link>
                        );
                      })
                    )}
                  </div>

                  <div className="px-4 py-2.5 border-t border-white/5">
                    <button onClick={loadNotifications}
                      className="text-[11px] font-medium text-blue-400 hover:text-blue-300 transition-colors">
                      Refresh notifications
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* User dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-lg transition-colors border border-transparent hover:bg-white/5 hover:border-white/10">
                  <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-[11px] font-bold text-white">
                    {user?.firstName?.[0]}{user?.lastName?.[0]}
                  </div>
                  <span className="hidden sm:block text-xs font-medium text-slate-300">{user?.firstName}</span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52 bg-[#1a1d27] border-white/10 text-slate-200">
                <DropdownMenuLabel className="text-xs text-slate-400">{user?.firstName} {user?.lastName}</DropdownMenuLabel>
                <DropdownMenuSeparator className="bg-white/10" />
                <DropdownMenuItem onClick={() => navigate('/profile')} className="hover:bg-white/5 cursor-pointer text-xs">
                  <Icon name="user" className="w-3.5 h-3.5 mr-2" /> My Profile
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setShowChangePw(true)} className="hover:bg-white/5 cursor-pointer text-xs">
                  <Icon name="key" className="w-3.5 h-3.5 mr-2" /> Change Password
                </DropdownMenuItem>
                {hasPermission(ROLES.ADMIN_UP) && (
                  <DropdownMenuItem onClick={() => navigate('/settings')} className="hover:bg-white/5 cursor-pointer text-xs">
                    <Icon name="settings" className="w-3.5 h-3.5 mr-2" /> Settings
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator className="bg-white/10" />
                <DropdownMenuItem onClick={() => { logout(); toast.success('Logged out'); }} className="text-red-400 hover:bg-red-500/10 cursor-pointer text-xs">
                  <Icon name="logout" className="w-3.5 h-3.5 mr-2" /> Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 p-4 sm:p-6 bg-[#0f1117]">
          <Outlet />
        </main>
      </div>
    </div>

    {/* ── CHANGE PASSWORD MODAL (all users) ──────────────── */}
    {showChangePw && (
      <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => { setShowChangePw(false); setChangePwForm({ current:'', next:'', show:false }); }}/>
        <div className="relative w-full max-w-sm bg-[#0d0f14] rounded-2xl border border-white/10 shadow-2xl p-6">
          <h2 className="text-sm font-semibold text-white mb-1">Change Password</h2>
          <p className="text-[11px] text-slate-500 mb-5">Enter your current password to set a new one.</p>
          <div className="space-y-3">
            <div>
              <label className="block text-[11px] font-medium text-slate-400 mb-1">Current Password</label>
              <input type={changePwForm.show ? 'text' : 'password'}
                value={changePwForm.current}
                onChange={e => setChangePwForm(p => ({ ...p, current: e.target.value }))}
                className="w-full bg-[#0c0e13] border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-blue-500/50 transition-colors"
                placeholder="Your current password"
                autoComplete="current-password"/>
            </div>
            <div>
              <label className="block text-[11px] font-medium text-slate-400 mb-1">New Password</label>
              <input type={changePwForm.show ? 'text' : 'password'}
                value={changePwForm.next}
                onChange={e => setChangePwForm(p => ({ ...p, next: e.target.value }))}
                className="w-full bg-[#0c0e13] border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-blue-500/50 transition-colors"
                placeholder="Min 6 characters"
                autoComplete="new-password"/>
            </div>
            <button type="button" onClick={() => setChangePwForm(p => ({ ...p, show: !p.show }))}
              className="text-[11px] text-slate-500 hover:text-slate-300 transition-colors">
              {changePwForm.show ? 'Hide passwords' : 'Show passwords'}
            </button>
          </div>
          {changePwForm.next.length > 0 && changePwForm.next.length < 6 && (
            <p className="text-[11px] text-red-400 mt-2">New password must be at least 6 characters</p>
          )}
          <div className="flex gap-3 mt-5">
            <button onClick={() => { setShowChangePw(false); setChangePwForm({ current:'', next:'', show:false }); }}
              className="flex-1 py-2 text-xs border border-white/10 rounded-lg text-slate-400 hover:text-white transition-colors">
              Cancel
            </button>
            <button
              disabled={changePwSaving || !changePwForm.current || changePwForm.next.length < 6}
              onClick={async () => {
                setChangePwSaving(true);
                try {
                  await authApi.changePassword(changePwForm.current, changePwForm.next);
                  toast.success('Password changed successfully');
                  setShowChangePw(false);
                  setChangePwForm({ current:'', next:'', show:false });
                } catch (e: any) {
                  toast.error(e.message || 'Failed to change password');
                } finally { setChangePwSaving(false); }
              }}
              className="flex-1 py-2 text-xs font-medium bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-lg transition-colors">
              {changePwSaving ? 'Saving…' : 'Change Password'}
            </button>
          </div>
        </div>
      </div>
    )}
  </>
  );
}
