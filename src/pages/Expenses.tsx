import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { financeApi } from '@/lib/api';
import { toast } from 'sonner';

const fmtSAR = (n: number | string) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'SAR', minimumFractionDigits: 2 }).format(Number(n) || 0);

const fmtDate = (d: string) =>
  d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

const today = () => new Date().toISOString().split('T')[0];

const STATUS_STYLE: Record<string, { bg: string; text: string }> = {
  pending:  { bg: 'bg-amber-500/15',   text: 'text-amber-400' },
  approved: { bg: 'bg-emerald-500/15', text: 'text-emerald-400' },
  rejected: { bg: 'bg-red-500/15',     text: 'text-red-400' },
  paid:     { bg: 'bg-blue-500/15',    text: 'text-blue-400' },
};

const CATEGORY_COLORS: Record<string, string> = {
  fuel:          'bg-orange-500/20 text-orange-400',
  maintenance:   'bg-blue-500/20 text-blue-400',
  tolls:         'bg-purple-500/20 text-purple-400',
  insurance:     'bg-cyan-500/20 text-cyan-400',
  salaries:      'bg-emerald-500/20 text-emerald-400',
  office:        'bg-slate-500/20 text-slate-400',
  customs:       'bg-amber-500/20 text-amber-400',
  accommodation: 'bg-indigo-500/20 text-indigo-400',
  other:         'bg-rose-500/20 text-rose-400',
};

const CATEGORIES = ['fuel','maintenance','tolls','insurance','salaries','office','customs','accommodation','other'];

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

export default function Expenses() {
  const { user, hasPermission } = useAuth();
  const canApprove = hasPermission(['super_admin', 'admin']);
  const canCreate  = hasPermission(['super_admin', 'admin', 'accountant', 'dispatcher']);

  const [expenses, setExpenses]       = useState<any[]>([]);
  const [loading, setLoading]         = useState(true);
  const [showCreate, setShowCreate]   = useState(false);
  const [filterStatus, setFilterStatus] = useState('');
  const [filterCat, setFilterCat]     = useState('');
  const [saving, setSaving]           = useState(false);

  // Category totals
  const [catTotals, setCatTotals]     = useState<Record<string, number>>({});

  // Form
  const [expenseDate, setExpenseDate] = useState(today());
  const [category, setCategory]       = useState('fuel');
  const [description, setDescription] = useState('');
  const [amount, setAmount]           = useState('');
  const [vendorName, setVendorName]   = useState('');
  const [receiptNumber, setReceiptNumber] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('company_card');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (filterStatus) params.status   = filterStatus;
      if (filterCat)    params.category = filterCat;
      const data = await financeApi.getAllExpenses(params);
      setExpenses(data);
      // Build category totals from approved expenses
      const totals: Record<string, number> = {};
      data.filter((e: any) => e.status === 'approved' || e.status === 'paid')
        .forEach((e: any) => {
          totals[e.category] = (totals[e.category] || 0) + Number(e.amount);
        });
      setCatTotals(totals);
    } catch { toast.error('Failed to load expenses'); }
    finally { setLoading(false); }
  }, [filterStatus, filterCat]);

  useEffect(() => { load(); }, [load]);

  const resetForm = () => {
    setExpenseDate(today()); setCategory('fuel'); setDescription('');
    setAmount(''); setVendorName(''); setReceiptNumber(''); setPaymentMethod('company_card');
  };

  const handleCreate = async () => {
    if (!description) return toast.error('Description is required');
    if (!amount || Number(amount) <= 0) return toast.error('Enter a valid amount');
    setSaving(true);
    try {
      const res = await financeApi.createExpense({
        expenseDate, category, description,
        amount: parseFloat(amount),
        vendorName, receiptNumber, paymentMethod,
      });
      toast.success(`Expense ${res.expenseNumber} logged`);
      setShowCreate(false);
      resetForm();
      load();
    } catch (e: any) {
      toast.error(e.message || 'Failed to log expense');
    } finally { setSaving(false); }
  };

  const handleApprove = async (id: number, status: 'approved' | 'rejected') => {
    try {
      await financeApi.approveExpense(id, status);
      toast.success(`Expense ${status}`);
      load();
    } catch { toast.error('Failed to update expense'); }
  };

  const totalApproved = expenses
    .filter(e => e.status === 'approved' || e.status === 'paid')
    .reduce((s, e) => s + Number(e.amount), 0);
  const totalPending = expenses
    .filter(e => e.status === 'pending')
    .reduce((s, e) => s + Number(e.amount), 0);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Expenses</h1>
          <p className="text-xs text-slate-500 mt-0.5">{expenses.length} total · {expenses.filter(e => e.status === 'pending').length} pending approval</p>
        </div>
        {canCreate && (
          <button onClick={() => { resetForm(); setShowCreate(true); }}
            className="flex items-center gap-2 px-4 py-2 bg-orange-600 hover:bg-orange-500 text-white text-xs font-semibold rounded-lg transition-colors">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/></svg>
            Log Expense
          </button>
        )}
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-[#1a1d27] rounded-xl p-4 border border-white/5">
          <p className="text-[11px] text-slate-500">Approved Spend</p>
          <p className="text-xl font-bold text-emerald-400 tabular-nums mt-1">{fmtSAR(totalApproved)}</p>
        </div>
        <div className="bg-[#1a1d27] rounded-xl p-4 border border-white/5">
          <p className="text-[11px] text-slate-500">Pending Approval</p>
          <p className="text-xl font-bold text-amber-400 tabular-nums mt-1">{fmtSAR(totalPending)}</p>
        </div>
        {/* Top two categories */}
        {Object.entries(catTotals).sort((a,b) => b[1]-a[1]).slice(0,2).map(([cat, amt]) => (
          <div key={cat} className="bg-[#1a1d27] rounded-xl p-4 border border-white/5">
            <p className="text-[11px] text-slate-500 capitalize">Top: {cat}</p>
            <p className="text-xl font-bold text-orange-400 tabular-nums mt-1">{fmtSAR(amt)}</p>
          </div>
        ))}
      </div>

      {/* Category breakdown bar */}
      {Object.keys(catTotals).length > 0 && (
        <div className="bg-[#1a1d27] rounded-xl p-4 border border-white/5">
          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-3">Spend by Category (Approved)</p>
          <div className="space-y-2">
            {Object.entries(catTotals).sort((a,b) => b[1]-a[1]).map(([cat, amt]) => {
              const pct = (amt / totalApproved) * 100;
              return (
                <div key={cat} className="flex items-center gap-3 text-xs">
                  <span className="w-24 text-slate-400 capitalize">{cat}</span>
                  <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
                    <div className="h-full bg-orange-500 rounded-full" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="w-24 text-right text-slate-400 tabular-nums">{fmtSAR(amt)}</span>
                  <span className="w-10 text-right text-slate-600 tabular-nums">{pct.toFixed(0)}%</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-3">
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
          className="px-3 py-2 text-xs bg-[#1a1d27] border border-white/5 rounded-lg text-white focus:outline-none focus:border-blue-500/40">
          <option value="">All statuses</option>
          {['pending','approved','rejected','paid'].map(s => (
            <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
          ))}
        </select>
        <select value={filterCat} onChange={e => setFilterCat(e.target.value)}
          className="px-3 py-2 text-xs bg-[#1a1d27] border border-white/5 rounded-lg text-white focus:outline-none focus:border-blue-500/40">
          <option value="">All categories</option>
          {CATEGORIES.map(c => (
            <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="bg-[#1a1d27] rounded-xl border border-white/5 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-white/5">
                {['Expense #','Date','Category','Description','Vendor','Amount','Method','By','Status','Actions'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-[11px] font-medium text-slate-500 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={10} className="px-4 py-12 text-center text-slate-500">Loading...</td></tr>
              ) : expenses.length === 0 ? (
                <tr><td colSpan={10} className="px-4 py-12 text-center text-slate-500">No expenses found</td></tr>
              ) : expenses.map(e => {
                const ss = STATUS_STYLE[e.status] || STATUS_STYLE.pending;
                const cs = CATEGORY_COLORS[e.category] || CATEGORY_COLORS.other;
                return (
                  <tr key={e.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                    <td className="px-4 py-3 font-mono text-orange-400 font-medium">{e.expense_number}</td>
                    <td className="px-4 py-3 text-slate-400 whitespace-nowrap">{fmtDate(e.expense_date)}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${cs}`}>{e.category}</span>
                    </td>
                    <td className="px-4 py-3 text-white max-w-[180px] truncate">{e.description}</td>
                    <td className="px-4 py-3 text-slate-400">{e.vendor_name || '—'}</td>
                    <td className="px-4 py-3 font-bold text-white tabular-nums">{fmtSAR(e.amount)}</td>
                    <td className="px-4 py-3 text-slate-400">{e.payment_method?.replace('_',' ') || '—'}</td>
                    <td className="px-4 py-3 text-slate-400 whitespace-nowrap">{e.created_by_name || '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${ss.bg} ${ss.text}`}>{e.status}</span>
                    </td>
                    <td className="px-4 py-3">
                      {canApprove && e.status === 'pending' && (
                        <div className="flex items-center gap-1.5">
                          <button onClick={() => handleApprove(e.id, 'approved')}
                            className="px-2 py-1 bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-400 rounded text-[10px] font-medium transition-colors">
                            Approve
                          </button>
                          <button onClick={() => handleApprove(e.id, 'rejected')}
                            className="px-2 py-1 bg-red-600/20 hover:bg-red-600/40 text-red-400 rounded text-[10px] font-medium transition-colors">
                            Reject
                          </button>
                        </div>
                      )}
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
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-[#1a1d27] rounded-2xl border border-white/10 shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
              <h2 className="text-sm font-bold text-white">Log Expense</h2>
              <button onClick={() => setShowCreate(false)} className="p-1 text-slate-400 hover:text-white">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] text-slate-500 mb-1">Expense Date</label>
                  <input type="date" value={expenseDate} onChange={e => setExpenseDate(e.target.value)}
                    style={{ colorScheme: 'dark' }}
                    className="w-full px-3 py-2 text-xs bg-[#0f1117] border border-white/10 rounded-lg text-white focus:outline-none focus:border-blue-500/50 [&::-webkit-calendar-picker-indicator]:opacity-80" />
                </div>
                <DSel label="Category" value={category} onChange={(e: any) => setCategory(e.target.value)}>
                  {CATEGORIES.map(c => (
                    <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
                  ))}
                </DSel>
              </div>

              <DTA label="Description *" value={description} onChange={(e: any) => setDescription(e.target.value)} rows={2} placeholder="What was this expense for?" />

              <div className="grid grid-cols-2 gap-3">
                <DIn label="Amount (SAR) *" type="number" min="0.01" step="0.01" value={amount} onChange={(e: any) => setAmount(e.target.value)} placeholder="0.00" />
                <DSel label="Payment Method" value={paymentMethod} onChange={(e: any) => setPaymentMethod(e.target.value)}>
                  <option value="company_card">Company Card</option>
                  <option value="cash">Cash</option>
                  <option value="bank_transfer">Bank Transfer</option>
                  <option value="personal_reimbursement">Personal (Reimbursement)</option>
                </DSel>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <DIn label="Vendor / Supplier" value={vendorName} onChange={(e: any) => setVendorName(e.target.value)} placeholder="e.g. SASCO Stations" />
                <DIn label="Receipt Number" value={receiptNumber} onChange={(e: any) => setReceiptNumber(e.target.value)} placeholder="e.g. RCP-001" />
              </div>

              <div className="bg-[#0f1117] rounded-lg p-3 border border-amber-500/20">
                <p className="text-[11px] text-amber-400">This expense will be submitted for approval. Admins will review it before it's counted in reports.</p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-white/5">
              <button onClick={() => setShowCreate(false)} className="px-4 py-2 text-xs text-slate-400 hover:text-white transition-colors">Cancel</button>
              <button onClick={handleCreate} disabled={saving || !description || !amount}
                className="px-5 py-2 bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-white text-xs font-semibold rounded-lg transition-colors">
                {saving ? 'Submitting...' : `Submit SAR ${Number(amount || 0).toFixed(2)}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
