// src/pages/Leave.tsx
// Leave Management — requests, balances, approval workflow
import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { leaveApi, employeesApi } from '@/lib/api';
import { toast } from 'sonner';
import { fmtDate, today } from '@/lib/format';
import { ROLES } from '@/lib/roles';

// ── Constants ──────────────────────────────────────────────────────
const STATUS_STYLE: Record<string, string> = {
  pending:   'bg-amber-500/15 text-amber-400',
  approved:  'bg-emerald-500/15 text-emerald-400',
  rejected:  'bg-red-500/15 text-red-400',
  cancelled: 'bg-slate-500/15 text-slate-400',
};

// ── Sub-components ─────────────────────────────────────────────────
function Icon({ name, className = 'w-4 h-4' }: { name: string; className?: string }) {
  const icons: Record<string, JSX.Element> = {
    calendar: <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>,
    check:    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/></svg>,
    x:        <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>,
    plus:     <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/></svg>,
    eye:      <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>,
    ban:      <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"/></svg>,
    user:     <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>,
  };
  return icons[name] || <span />;
}

const inp = 'w-full px-3 py-2 text-xs bg-[#0f1117] border border-white/10 rounded-lg text-white focus:outline-none focus:border-blue-500/50 placeholder-slate-600';
const sel = 'w-full px-3 py-2 text-xs bg-[#0f1117] border border-white/10 rounded-lg text-white focus:outline-none focus:border-blue-500/50 appearance-none';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[11px] text-slate-500 mb-1">{label}</label>
      {children}
    </div>
  );
}

function KPI({ label, value, sub, color = 'text-white' }: { label: string; value: any; sub?: string; color?: string }) {
  return (
    <div className="bg-[#1a1d27] rounded-xl border border-white/5 p-4">
      <div className="text-[10px] text-slate-500 uppercase tracking-wide mb-1">{label}</div>
      <div className={`text-2xl font-bold tabular-nums ${color}`}>{value}</div>
      {sub && <div className="text-[10px] text-slate-500 mt-1">{sub}</div>}
    </div>
  );
}

type Tab = 'requests' | 'balances' | 'calendar';

// ── Main Component ─────────────────────────────────────────────────
export default function Leave() {
  const { user, hasPermission } = useAuth();
  const isManagement = hasPermission(ROLES.MANAGEMENT);
  const isAdminUp    = hasPermission(ROLES.ADMIN_UP);

  const [tab, setTab]           = useState<Tab>('requests');
  const [summary, setSummary]   = useState<any>(null);
  const [requests, setRequests] = useState<any[]>([]);
  const [types, setTypes]       = useState<any[]>([]);
  const [loading, setLoading]   = useState(true);

  // Filter state
  const [filterStatus, setFilterStatus] = useState('');
  const [filterType,   setFilterType]   = useState('');

  // Create modal
  const [showCreate, setShowCreate] = useState(false);
  const [employees,  setEmployees]  = useState<any[]>([]);
  const [saving, setSaving]         = useState(false);
  const [form, setForm] = useState({
    employee_id: '', leave_type_id: '', start_date: '', end_date: '', reason: '',
  });

  // Detail modal
  const [selected, setSelected]         = useState<any>(null);
  const [reviewing, setReviewing]       = useState(false);
  const [reviewNotes, setReviewNotes]   = useState('');

  // Balances tab
  const [empSearch,   setEmpSearch]   = useState('');
  const [empList,     setEmpList]     = useState<any[]>([]);
  const [selEmpBal,   setSelEmpBal]   = useState<any>(null);
  const [balances,    setBalances]    = useState<any[]>([]);
  const [loadingBal,  setLoadingBal]  = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [req, tp] = await Promise.all([
        leaveApi.getRequests(filterStatus ? { status: filterStatus } : {}),
        leaveApi.getTypes(),
      ]);
      setRequests(Array.isArray(req) ? req : []);
      setTypes(Array.isArray(tp) ? tp : []);
      if (isManagement) {
        const sum = await leaveApi.getSummary();
        setSummary(sum);
      }
    } catch { toast.error('Failed to load leave data'); }
    finally { setLoading(false); }
  }, [filterStatus, isManagement]);

  useEffect(() => { load(); }, [load]);

  // When the create modal opens:
  // - Non-management: auto-set employee_id to their own
  // - Management: load full employee list; default selection is their own employee record
  useEffect(() => {
    if (!showCreate) return;
    if (!isManagement) {
      // Auto-fill own employee_id so the form passes validation
      if (user?.employeeId) {
        setForm(p => ({ ...p, employee_id: String(user.employeeId) }));
      }
    } else {
      // Load employees for the dropdown, then pre-select self if they have an employee record
      employeesApi.getAll()
        .then((data: any) => {
          const list = Array.isArray(data?.data ?? data) ? (data?.data ?? data) : [];
          setEmployees(list);
          // Pre-select own employee record so management can submit for themselves easily
          if (user?.employeeId && !form.employee_id) {
            setForm(p => ({ ...p, employee_id: String(user.employeeId) }));
          }
        })
        .catch(() => {});
    }
  }, [showCreate]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load employees for balances tab
  useEffect(() => {
    if (tab !== 'balances') return;
    employeesApi.getAll()
      .then((data: any) => setEmpList(Array.isArray(data?.data ?? data) ? (data?.data ?? data) : []))
      .catch(() => {});
  }, [tab]);

  const loadBalances = async (emp: any) => {
    setSelEmpBal(emp);
    setLoadingBal(true);
    try {
      const data = await leaveApi.getBalances(emp.id);
      setBalances(Array.isArray(data) ? data : []);
    } catch { toast.error('Failed to load balances'); }
    finally { setLoadingBal(false); }
  };

  const handleCreate = async () => {
    if (isManagement && !form.employee_id) { toast.error('Select an employee'); return; }
    if (!form.leave_type_id) { toast.error('Select a leave type'); return; }
    if (!form.start_date || !form.end_date) { toast.error('Select start and end dates'); return; }
    setSaving(true);
    try {
      const payload: any = {
        leave_type_id: Number(form.leave_type_id),
        start_date:    form.start_date,
        end_date:      form.end_date,
        reason:        form.reason,
      };
      // Management picks an employee from the dropdown.
      // '__self__' means the admin has no employee record yet — let backend resolve/create via user_id.
      // Numeric employee_id means they picked someone from the list.
      if (isManagement && form.employee_id && form.employee_id !== '__self__') {
        payload.employee_id = Number(form.employee_id);
      }
      // If __self__ or non-management: no employee_id sent → backend resolves via req.user.id
      const r = await leaveApi.createRequest(payload);
      toast.success(`Leave request ${r.request_number} submitted (${r.total_days} days)`);
      setShowCreate(false);
      setForm({ employee_id: '', leave_type_id: '', start_date: '', end_date: '', reason: '' });
      load();
    } catch (e: any) {
      toast.error(e?.message || 'Failed to submit request');
    } finally { setSaving(false); }
  };

  const handleReview = async (status: 'approved' | 'rejected') => {
    if (!selected) return;
    setReviewing(true);
    try {
      await leaveApi.reviewRequest(selected.id, status, reviewNotes);
      toast.success(`Request ${status}`);
      setSelected(null);
      setReviewNotes('');
      load();
    } catch (e: any) {
      toast.error(e?.message || 'Failed to review');
    } finally { setReviewing(false); }
  };

  const handleCancel = async (id: number) => {
    if (!confirm('Cancel this leave request?')) return;
    try {
      await leaveApi.cancelRequest(id);
      toast.success('Request cancelled');
      setSelected(null);
      load();
    } catch (e: any) { toast.error(e?.message || 'Failed to cancel'); }
  };

  const filtered = requests.filter(r => {
    if (filterStatus && r.status !== filterStatus) return false;
    if (filterType   && String(r.leave_type_id) !== filterType) return false;
    return true;
  });

  // Calendar — upcoming approved leaves
  const upcoming = requests.filter(r => r.status === 'approved' && new Date(r.end_date) >= new Date());

  // ── RENDER ──────────────────────────────────────────────────────
  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Leave Management</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            {isManagement
              ? `${summary?.pending_count ?? '—'} pending · ${summary?.on_leave_now ?? '—'} on leave now`
              : 'Your leave requests and balances'}
          </p>
        </div>
        <button onClick={() => setShowCreate(true)}
          className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-lg transition-colors">
          <Icon name="plus" className="w-3.5 h-3.5" />
          New Request
        </button>
      </div>

      {/* KPI row — management only */}
      {isManagement && summary && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <KPI label="Pending Approval" value={summary.pending_count}   color="text-amber-400" />
          <KPI label="On Leave Now"     value={summary.on_leave_now}    color="text-blue-400" />
          <KPI label="Total This Year"  value={summary.total_this_year} />
          <KPI label="Approved Today"   value={summary.approved_today}  color="text-emerald-400" />
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-[#1a1d27] rounded-lg p-1 border border-white/5 w-fit">
        {([['requests', 'Requests'], ['balances', 'Balances'], ['calendar', 'Upcoming']] as [Tab, string][]).map(([t, label]) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-1.5 text-xs font-medium rounded-md transition-colors ${tab === t ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}>
            {label}
          </button>
        ))}
      </div>

      {/* ── REQUESTS TAB ── */}
      {tab === 'requests' && (
        <>
          {/* Filters */}
          <div className="flex items-center gap-2">
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
              className="px-3 py-2 text-xs bg-[#1a1d27] border border-white/10 rounded-lg text-white focus:outline-none appearance-none">
              <option value="">All Statuses</option>
              {['pending','approved','rejected','cancelled'].map(s => (
                <option key={s} value={s}>{s.charAt(0).toUpperCase()+s.slice(1)}</option>
              ))}
            </select>
            <select value={filterType} onChange={e => setFilterType(e.target.value)}
              className="px-3 py-2 text-xs bg-[#1a1d27] border border-white/10 rounded-lg text-white focus:outline-none appearance-none">
              <option value="">All Types</option>
              {types.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>

          {/* Table */}
          <div className="bg-[#1a1d27] rounded-xl border border-white/5 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-white/5">
                    {['Request #','Employee','Type','Start','End','Days','Status','Applied','Actions'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-[11px] font-medium text-slate-500 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={9} className="px-4 py-12 text-center text-slate-500">Loading…</td></tr>
                  ) : filtered.length === 0 ? (
                    <tr><td colSpan={9} className="px-4 py-12 text-center text-slate-500">No leave requests</td></tr>
                  ) : filtered.map(r => (
                    <tr key={r.id} className="border-b border-white/5 hover:bg-white/5 transition-colors group">
                      <td className="px-4 py-3 font-mono text-blue-400 font-medium">{r.request_number}</td>
                      <td className="px-4 py-3 text-white font-medium whitespace-nowrap">
                        {r.first_name} {r.last_name}
                        <div className="text-[10px] text-slate-500">{r.employee_code}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: r.color }}></span>
                          <span className="text-slate-300">{r.leave_type_name}</span>
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-400 whitespace-nowrap">{fmtDate(r.start_date)}</td>
                      <td className="px-4 py-3 text-slate-400 whitespace-nowrap">{fmtDate(r.end_date)}</td>
                      <td className="px-4 py-3 text-white font-bold">{r.total_days}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${STATUS_STYLE[r.status] || 'bg-slate-500/15 text-slate-400'}`}>
                          {r.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{fmtDate(r.applied_at)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => { setSelected(r); setReviewNotes(''); }}
                            className="p-1.5 rounded-md hover:bg-blue-500/15 text-slate-500 hover:text-blue-400 transition-colors" title="View">
                            <Icon name="eye" className="w-3.5 h-3.5" />
                          </button>
                          {isManagement && r.status === 'pending' && (
                            <>
                              <button onClick={() => { setSelected(r); setReviewNotes(''); }}
                                className="p-1.5 rounded-md hover:bg-emerald-500/15 text-slate-500 hover:text-emerald-400 transition-colors" title="Approve">
                                <Icon name="check" className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                          {r.status === 'pending' && (isManagement || r.employee_id === user?.employeeId) && (
                            <button onClick={() => handleCancel(r.id)}
                              className="p-1.5 rounded-md hover:bg-red-500/15 text-slate-500 hover:text-red-400 transition-colors" title="Cancel request">
                              <Icon name="ban" className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* ── BALANCES TAB ── */}
      {tab === 'balances' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Employee picker */}
          {isManagement && (
            <div className="bg-[#1a1d27] rounded-xl border border-white/5 p-4 space-y-3">
              <h3 className="text-xs font-semibold text-white">Select Employee</h3>
              <input value={empSearch} onChange={e => setEmpSearch(e.target.value)}
                className={inp} placeholder="Search name..." />
              <div className="space-y-1 max-h-80 overflow-y-auto">
                {empList
                  .filter(e => !empSearch || `${e.first_name} ${e.last_name}`.toLowerCase().includes(empSearch.toLowerCase()))
                  .map(e => (
                  <button key={e.id} onClick={() => loadBalances(e)}
                    className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left transition-colors ${selEmpBal?.id === e.id ? 'bg-blue-600/20 border border-blue-500/30' : 'hover:bg-white/5'}`}>
                    <div className="w-7 h-7 rounded-full bg-blue-600/20 flex items-center justify-center text-[10px] font-bold text-blue-400 flex-shrink-0">
                      {(e.first_name?.[0] || '') + (e.last_name?.[0] || '')}
                    </div>
                    <div>
                      <div className="text-xs text-white font-medium">{e.first_name} {e.last_name}</div>
                      <div className="text-[10px] text-slate-500">{e.employee_code}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Balances display */}
          <div className={`${isManagement ? 'lg:col-span-2' : 'lg:col-span-3'} space-y-3`}>
            {!selEmpBal && isManagement && (
              <>
                {/* Management: show own balances by default, with option to pick another employee */}
                <div className="text-[11px] text-slate-500 mb-2">Your own balances · {new Date().getFullYear()}</div>
                <OwnBalances />
                <div className="mt-3 text-[11px] text-slate-500 border-t border-white/5 pt-3">
                  Select an employee on the left to view their balances
                </div>
              </>
            )}
            {!isManagement && (
              // Non-management always see their own balances
              <OwnBalances />
            )}
            {selEmpBal && (
              <>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-blue-600/20 flex items-center justify-center text-xs font-bold text-blue-400">
                    {(selEmpBal.first_name?.[0] || '') + (selEmpBal.last_name?.[0] || '')}
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-white">{selEmpBal.first_name} {selEmpBal.last_name}</div>
                    <div className="text-[11px] text-slate-500">{selEmpBal.employee_code} · {new Date().getFullYear()} balances</div>
                  </div>
                </div>
                {loadingBal ? (
                  <div className="h-24 animate-pulse bg-white/5 rounded-xl" />
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {balances.map((b: any) => {
                      const remaining = Number(b.remaining_days || 0);
                      const total     = Number(b.entitled_days || 0) + Number(b.carried_days || 0);
                      const usedPct   = total > 0 ? Math.min(100, ((total - remaining) / total) * 100) : 0;
                      return (
                        <div key={b.id} className="bg-[#1a1d27] rounded-xl border border-white/5 p-4">
                          <div className="flex items-center justify-between mb-2">
                            <span className="flex items-center gap-1.5">
                              <span className="w-2.5 h-2.5 rounded-full" style={{ background: b.color }}></span>
                              <span className="text-xs font-medium text-white">{b.name}</span>
                            </span>
                            <span className={`text-xs font-bold ${remaining > 0 ? 'text-emerald-400' : 'text-red-400'}`}>{remaining} left</span>
                          </div>
                          {/* Progress bar */}
                          <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden mb-2">
                            <div className="h-full rounded-full transition-all" style={{ width: `${usedPct}%`, background: b.color }} />
                          </div>
                          <div className="grid grid-cols-3 gap-2 text-center">
                            <div><div className="text-[10px] text-slate-500">Entitled</div><div className="text-xs text-white font-medium">{b.entitled_days}</div></div>
                            <div><div className="text-[10px] text-slate-500">Used</div><div className="text-xs text-amber-400 font-medium">{b.used_days}</div></div>
                            <div><div className="text-[10px] text-slate-500">Pending</div><div className="text-xs text-blue-400 font-medium">{b.pending_days}</div></div>
                          </div>
                          {Number(b.carried_days) > 0 && (
                            <div className="mt-2 text-[10px] text-slate-500 text-right">+{b.carried_days} carried over</div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* ── CALENDAR / UPCOMING TAB ── */}
      {tab === 'calendar' && (
        <div className="bg-[#1a1d27] rounded-xl border border-white/5 overflow-hidden">
          <div className="px-5 py-4 border-b border-white/5">
            <h3 className="text-sm font-semibold text-white">Upcoming Approved Leaves</h3>
            <p className="text-[11px] text-slate-500 mt-0.5">Active and future approved leave periods</p>
          </div>
          {upcoming.length === 0 ? (
            <div className="px-5 py-12 text-center text-slate-500 text-xs">No upcoming approved leaves</div>
          ) : (
            <div className="divide-y divide-white/5">
              {upcoming.slice(0, 30).map(r => {
                const isActive = new Date(r.start_date) <= new Date() && new Date(r.end_date) >= new Date();
                return (
                  <div key={r.id} className="flex items-center gap-4 px-5 py-3 hover:bg-white/5 transition-colors">
                    <div className="w-1 self-stretch rounded-full flex-shrink-0" style={{ background: r.color }}></div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-white">{r.first_name} {r.last_name}</span>
                        {isActive && <span className="px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 text-[9px] font-bold">ON LEAVE</span>}
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5">{r.leave_type_name} · {r.total_days} days</div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="text-xs text-slate-300">{fmtDate(r.start_date)}</div>
                      <div className="text-[10px] text-slate-500">to {fmtDate(r.end_date)}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── CREATE MODAL ── */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-[#1a1d27] rounded-2xl border border-white/10 shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
              <h2 className="text-sm font-bold text-white">New Leave Request</h2>
              <button onClick={() => setShowCreate(false)} className="p-1 text-slate-400 hover:text-white">
                <Icon name="x" className="w-4 h-4" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              {/* Employee field — management sees dropdown (can submit for anyone or self);
                  super_admin is exempt from their own leave (top of hierarchy);
                  non-management see their own name read-only */}
              {isManagement ? (
                <Field label="Employee *">
                  <select value={form.employee_id} onChange={e => setForm(p => ({ ...p, employee_id: e.target.value }))} className={sel}>
                    <option value="">— Select employee —</option>
                    {/* For admin users: add a "Myself" option at the top if they're not in the
                        employee list yet. The backend auto-creates their employee record on first submit. */}
                    {user?.role === 'admin' && !employees.some(e => e.id === user?.employeeId) && (
                      <option value="__self__">
                        {user.firstName} {user.lastName} — You (first-time request)
                      </option>
                    )}
                    {employees
                      .filter(e => {
                        // super_admin cannot submit leave for themselves — they are exempt
                        if (user?.role === 'super_admin' && e.id === user?.employeeId) return false;
                        return true;
                      })
                      .map(e => (
                        <option key={e.id} value={e.id}>
                          {e.first_name} {e.last_name} ({e.employee_code})
                          {e.id === user?.employeeId ? ' — You' : ''}
                        </option>
                      ))}
                  </select>
                  {/* Approval chain notes */}
                  {user?.role === 'admin' && (form.employee_id === String(user?.employeeId) || form.employee_id === '__self__') && (
                    <p className="text-[10px] text-amber-400/80 mt-1">Your request will require super admin approval.</p>
                  )}
                  {user?.role === 'super_admin' && (
                    <p className="text-[10px] text-blue-400/80 mt-1">As super admin you are exempt from leave requests. Use this form to submit on behalf of other employees only.</p>
                  )}
                </Field>
              ) : (
                <div className="bg-[#0f1117] rounded-lg px-3 py-2.5 flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-blue-600/20 flex items-center justify-center text-[10px] font-bold text-blue-400 flex-shrink-0">
                    {user?.firstName?.[0]}{user?.lastName?.[0]}
                  </div>
                  <div>
                    <div className="text-xs text-white font-medium">{user?.firstName} {user?.lastName}</div>
                    <div className="text-[10px] text-slate-500">Submitting for yourself</div>
                  </div>
                </div>
              )}
              <Field label="Leave Type *">
                <select value={form.leave_type_id} onChange={e => setForm(p => ({ ...p, leave_type_id: e.target.value }))} className={sel}>
                  <option value="">— Select type —</option>
                  {types.map(t => <option key={t.id} value={t.id}>{t.name} {t.days_per_year > 0 ? `(${t.days_per_year} days/yr)` : ''}</option>)}
                </select>
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Start Date *">
                  <input type="date" value={form.start_date} onChange={e => setForm(p => ({ ...p, start_date: e.target.value }))}
                    style={{ colorScheme: 'dark' }} className={inp} />
                </Field>
                <Field label="End Date *">
                  <input type="date" value={form.end_date} onChange={e => setForm(p => ({ ...p, end_date: e.target.value }))}
                    min={form.start_date} style={{ colorScheme: 'dark' }} className={inp} />
                </Field>
              </div>
              {form.start_date && form.end_date && form.start_date <= form.end_date && (
                <div className="text-[11px] text-blue-400 bg-blue-500/10 rounded-lg px-3 py-2">
                  <Icon name="calendar" className="w-3.5 h-3.5 inline mr-1" />
                  {Math.max(1, Math.round((new Date(form.end_date).getTime() - new Date(form.start_date).getTime()) / 86400000 + 1))} calendar days selected
                </div>
              )}
              <Field label="Reason (optional)">
                <textarea value={form.reason} onChange={e => setForm(p => ({ ...p, reason: e.target.value }))}
                  rows={2} className={inp + ' resize-none'} placeholder="Brief description..." />
              </Field>
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-white/5">
              <button onClick={() => setShowCreate(false)} className="px-4 py-2 text-xs text-slate-400 hover:text-white transition-colors">Cancel</button>
              <button onClick={handleCreate} disabled={saving}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-semibold rounded-lg transition-colors">
                {saving ? 'Submitting…' : 'Submit Request'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── DETAIL / REVIEW MODAL ── */}
      {selected && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-[#1a1d27] rounded-2xl border border-white/10 shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
              <div>
                <h2 className="text-sm font-bold text-white font-mono">{selected.request_number}</h2>
                <p className="text-[11px] text-slate-500 mt-0.5">{selected.first_name} {selected.last_name} · {selected.employee_code}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${STATUS_STYLE[selected.status]}`}>{selected.status}</span>
                <button onClick={() => setSelected(null)} className="p-1 text-slate-400 hover:text-white"><Icon name="x" className="w-4 h-4" /></button>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                {([
                  ['Leave Type',  selected.leave_type_name],
                  ['Duration',    `${selected.total_days} working days`],
                  ['Start Date',  fmtDate(selected.start_date)],
                  ['End Date',    fmtDate(selected.end_date)],
                  ['Applied',     fmtDate(selected.applied_at)],
                  ['Paid Leave',  selected.is_paid ? 'Yes' : 'No'],
                ] as [string,string][]).map(([label, val]) => (
                  <div key={label} className="bg-[#0f1117] rounded-lg p-3">
                    <div className="text-[10px] text-slate-500 uppercase tracking-wide mb-1">{label}</div>
                    <div className="text-xs text-white font-medium">{val}</div>
                  </div>
                ))}
              </div>
              {selected.reason && (
                <div className="bg-[#0f1117] rounded-lg p-3">
                  <div className="text-[10px] text-slate-500 uppercase tracking-wide mb-1">Reason</div>
                  <div className="text-xs text-slate-300">{selected.reason}</div>
                </div>
              )}
              {selected.review_notes && (
                <div className="bg-[#0f1117] rounded-lg p-3">
                  <div className="text-[10px] text-slate-500 uppercase tracking-wide mb-1">Review Notes</div>
                  <div className="text-xs text-slate-300">{selected.review_notes}</div>
                </div>
              )}
              {isManagement && selected.status === 'pending' && (
                <>
                  <div>
                    <label className="block text-[11px] text-slate-500 mb-1">Review Notes (optional)</label>
                    <textarea value={reviewNotes} onChange={e => setReviewNotes(e.target.value)}
                      rows={2} className={inp + ' resize-none'} placeholder="Optional note to employee..." />
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => handleReview('approved')} disabled={reviewing}
                      className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-semibold rounded-lg transition-colors flex items-center justify-center gap-1.5">
                      <Icon name="check" className="w-3.5 h-3.5" /> Approve
                    </button>
                    <button onClick={() => handleReview('rejected')} disabled={reviewing}
                      className="flex-1 py-2.5 bg-red-600/20 hover:bg-red-600/40 text-red-400 text-xs font-semibold rounded-lg transition-colors flex items-center justify-center gap-1.5">
                      <Icon name="x" className="w-3.5 h-3.5" /> Reject
                    </button>
                  </div>
                </>
              )}
            </div>
            <div className="flex justify-end px-6 py-4 border-t border-white/5">
              <button onClick={() => setSelected(null)} className="px-4 py-2 text-xs text-slate-400 hover:text-white transition-colors">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Own balances — resolves employee server-side via user_id ─────
function OwnBalances() {
  const [balances, setBalances] = useState<any[]>([]);
  const [loading, setLoading]   = useState(true);
  const [empty, setEmpty]       = useState(false);

  useEffect(() => {
    leaveApi.getMyBalances()
      .then(d => {
        const list = Array.isArray(d) ? d : [];
        setBalances(list);
        setEmpty(list.length === 0);
      })
      .catch(() => setEmpty(true))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="h-24 animate-pulse bg-white/5 rounded-xl" />;
  if (empty) return (
    <div className="bg-[#1a1d27] rounded-xl border border-white/5 p-6 text-center">
      <p className="text-xs text-slate-500">No leave balance data found.</p>
      <p className="text-[10px] text-slate-600 mt-1">Your user account may not be linked to an employee record yet.</p>
    </div>
  );

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {balances.map((b: any) => {
        const remaining = Number(b.remaining_days || 0);
        const total     = Number(b.entitled_days || 0) + Number(b.carried_days || 0);
        const usedPct   = total > 0 ? Math.min(100, ((total - remaining) / total) * 100) : 0;
        return (
          <div key={b.id} className="bg-[#1a1d27] rounded-xl border border-white/5 p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full" style={{ background: b.color }}></span>
                <span className="text-xs font-medium text-white">{b.name}</span>
              </span>
              <span className={`text-xs font-bold ${remaining > 0 ? 'text-emerald-400' : 'text-red-400'}`}>{remaining} left</span>
            </div>
            <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden mb-2">
              <div className="h-full rounded-full" style={{ width: `${usedPct}%`, background: b.color }} />
            </div>
            <div className="grid grid-cols-3 gap-1 text-center">
              <div><div className="text-[10px] text-slate-500">Entitled</div><div className="text-xs text-white font-medium">{b.entitled_days}</div></div>
              <div><div className="text-[10px] text-slate-500">Used</div><div className="text-xs text-amber-400 font-medium">{b.used_days}</div></div>
              <div><div className="text-[10px] text-slate-500">Pending</div><div className="text-xs text-blue-400 font-medium">{b.pending_days}</div></div>
            </div>
            {Number(b.carried_days) > 0 && (
              <div className="mt-2 text-[10px] text-slate-500 text-right">+{b.carried_days} carried over</div>
            )}
          </div>
        );
      })}
    </div>
  );
}
