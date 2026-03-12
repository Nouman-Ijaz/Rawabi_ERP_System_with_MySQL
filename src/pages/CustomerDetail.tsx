import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { customersApi } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { fmtDate, fmtSAR } from '@/lib/format';
import { CUSTOMER_STATUS, SHIPMENT_STATUS, INVOICE_STATUS } from '@/lib/statusStyles';

// ── Helpers ───────────────────────────────────────────────────────────────────

const AVC = [
  'from-blue-500 to-blue-700', 'from-emerald-500 to-emerald-700',
  'from-purple-500 to-purple-700', 'from-amber-500 to-amber-700',
  'from-cyan-500 to-cyan-700', 'from-rose-500 to-rose-700',
];
const av = (id: number) => AVC[id % AVC.length];
const initials = (name: string) =>
  name?.split(' ').map((w: string) => w[0]).slice(0, 2).join('').toUpperCase() || '?';

const TYPE_STYLE: Record<string, string> = {
  corporate:  'bg-blue-500/15 text-blue-400 border-blue-500/20',
  vip:        'bg-amber-500/15 text-amber-400 border-amber-500/20',
  government: 'bg-purple-500/15 text-purple-400 border-purple-500/20',
  regular:    'bg-slate-500/15 text-slate-400 border-slate-500/20',
};

const calcOutstanding = (invoices: any[]) =>
  (invoices || []).reduce((sum: number, inv: any) => {
    if (inv.status === 'paid' || inv.status === 'cancelled') return sum;
    const paid = parseFloat(inv.paid_amount) || 0;
    const total = parseFloat(inv.total_amount) || 0;
    return sum + Math.max(0, total - paid);
  }, 0);

// ── Sub-components ─────────────────────────────────────────────────────────────

function Row({ label, value }: { label: string; value?: any }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] text-slate-500 uppercase tracking-wider print:text-gray-500">{label}</span>
      <span className="text-xs text-white font-medium print:text-gray-900">{value || '—'}</span>
    </div>
  );
}

function Section({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) {
  return (
    <div className="bg-[#1a1d27] rounded-xl border border-white/5 p-5 print:bg-white print:border print:border-gray-200 print:rounded-none print:mb-4">
      <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2 print:text-gray-600">
        <span>{icon}</span>{title}
      </h3>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-4">
        {children}
      </div>
    </div>
  );
}

function StatCard({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: string }) {
  return (
    <div className="bg-[#0f1117] rounded-xl border border-white/5 p-4 print:bg-gray-50 print:border print:border-gray-200">
      <p className="text-[10px] text-slate-500 uppercase tracking-wider">{label}</p>
      <p className={`text-lg font-bold mt-1 ${accent || 'text-white'} print:text-gray-900`}>{value}</p>
      {sub && <p className="text-[11px] text-slate-500 mt-0.5">{sub}</p>}
    </div>
  );
}

type Tab = 'overview' | 'shipments' | 'invoices' | 'contacts';

// ── Main component ─────────────────────────────────────────────────────────────

export default function CustomerDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { hasPermission } = useAuth();
  const canEdit = hasPermission(['super_admin', 'admin', 'dispatcher']);

  const [cust, setCust] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('overview');

  useEffect(() => {
    if (!id) return;
    customersApi.getById(parseInt(id))
      .then(setCust)
      .catch(() => toast.error('Failed to load customer'))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return (
    <div className="flex items-center justify-center py-32 text-slate-500 text-sm">Loading…</div>
  );
  if (!cust) return (
    <div className="flex flex-col items-center justify-center py-32 text-center">
      <p className="text-slate-400 text-sm">Customer not found</p>
      <button onClick={() => navigate('/customers')} className="mt-3 text-xs text-blue-400 hover:text-blue-300">
        ← Back to Customers
      </button>
    </div>
  );

  const stats     = cust.stats || {};
  const shipments: any[] = cust.shipments || [];
  const invoices:  any[] = cust.invoices  || [];
  const contacts:  any[] = cust.contacts  || [];
  const outstanding = calcOutstanding(invoices);
  const overdue     = invoices.filter((i: any) => i.status === 'overdue').length;

  const TABS: { id: Tab; label: string; count?: number }[] = [
    { id: 'overview',  label: 'Overview' },
    { id: 'shipments', label: 'Shipments', count: shipments.length },
    { id: 'invoices',  label: 'Invoices',  count: invoices.length },
    { id: 'contacts',  label: 'Contacts',  count: contacts.length },
  ];

  return (
    <div className="space-y-5 max-w-5xl">

      {/* Print styles */}
      <style>{`
        @media print {
          body { background: white !important; color: black !important; }
          .no-print { display: none !important; }
          .print-header { display: block !important; }
          table { font-size: 11px; }
        }
        @media screen { .print-header { display: none; } }
      `}</style>

      {/* Hidden print header */}
      <div className="print-header text-center pb-4 border-b border-gray-200 mb-6">
        <h1 className="text-xl font-bold text-gray-900">Customer Profile</h1>
        <p className="text-sm text-gray-500">
          Rawabi Logistics · Printed {new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })}
        </p>
      </div>

      {/* Header bar */}
      <div className="no-print flex items-center justify-between">
        <button
          onClick={() => navigate('/customers')}
          className="flex items-center gap-2 text-xs text-slate-400 hover:text-white transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          All Customers
        </button>
        <div className="flex items-center gap-2">
          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 px-3 py-2 text-xs border border-white/10 rounded-lg text-slate-400 hover:text-white hover:border-white/20 transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
            Print
          </button>
          {canEdit && (
            <button
              onClick={() => navigate('/customers')}
              className="flex items-center gap-2 px-3 py-2 text-xs bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              Edit
            </button>
          )}
        </div>
      </div>

      {/* Profile card */}
      <div className="bg-[#1a1d27] rounded-xl border border-white/5 p-6 print:bg-white print:border print:border-gray-200">
        <div className="flex items-start gap-5">
          <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${av(cust.id)} flex items-center justify-center text-xl font-bold text-white flex-shrink-0 print:hidden`}>
            {initials(cust.company_name)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <h2 className="text-xl font-bold text-white print:text-gray-900">{cust.company_name}</h2>
                <p className="text-sm text-slate-400 print:text-gray-600">{cust.contact_person}</p>
                <p className="text-xs text-slate-500 font-mono mt-0.5 print:text-gray-500">{cust.customer_code}</p>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`px-2 py-1 rounded-lg text-xs font-medium border capitalize ${CUSTOMER_STATUS[cust.status] || 'bg-slate-500/15 text-slate-400 border-slate-500/20'}`}>
                  {cust.status}
                </span>
                <span className={`px-2 py-1 rounded-lg text-xs font-medium border capitalize ${TYPE_STYLE[cust.customer_type] || TYPE_STYLE.regular}`}>
                  {cust.customer_type}
                </span>
              </div>
            </div>
            <div className="flex flex-wrap gap-6 mt-4">
              {[
                { l: 'Total Shipments', v: String(stats.total_shipments ?? 0) },
                { l: 'Completed',       v: String(stats.completed_shipments ?? 0) },
                { l: 'Total Revenue',   v: fmtSAR(stats.total_revenue) },
                { l: 'Outstanding',     v: fmtSAR(outstanding) },
                { l: 'Payment Terms',   v: cust.payment_terms ? `Net ${cust.payment_terms}` : '—' },
                { l: 'Credit Limit',    v: cust.credit_limit  ? fmtSAR(cust.credit_limit)  : '—' },
              ].map(({ l, v }) => (
                <div key={l}>
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider print:text-gray-500">{l}</p>
                  <p className="text-xs font-semibold text-white mt-0.5 print:text-gray-900">{v}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 no-print">
        <StatCard
          label="Total Revenue"
          value={fmtSAR(stats.total_revenue)}
          sub={`${stats.total_shipments ?? 0} shipments`}
        />
        <StatCard
          label="Outstanding Balance"
          value={fmtSAR(outstanding)}
          sub={overdue > 0 ? `${overdue} overdue invoice${overdue > 1 ? 's' : ''}` : 'No overdue'}
          accent={outstanding > 0 ? 'text-amber-400' : 'text-emerald-400'}
        />
        <StatCard
          label="Completion Rate"
          value={stats.total_shipments
            ? `${Math.round((stats.completed_shipments / stats.total_shipments) * 100)}%`
            : '—'}
          sub="Delivered vs total"
        />
        <StatCard
          label="Avg Delivery Diff"
          value={stats.avg_delivery_performance != null
            ? `${Number(stats.avg_delivery_performance).toFixed(1)}d`
            : '—'}
          sub="vs requested date"
          accent={
            stats.avg_delivery_performance > 0 ? 'text-red-400' :
            stats.avg_delivery_performance < 0 ? 'text-emerald-400' :
            'text-white'
          }
        />
      </div>

      {/* Tabs */}
      <div className="no-print flex gap-1 border-b border-white/5">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2 text-xs font-medium rounded-t-lg border-b-2 transition-colors flex items-center gap-1.5 -mb-px ${
              tab === t.id
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-slate-500 hover:text-slate-300'
            }`}
          >
            {t.label}
            {t.count !== undefined && (
              <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono ${tab === t.id ? 'bg-blue-500/20 text-blue-300' : 'bg-white/5 text-slate-600'}`}>
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── TAB: Overview ── */}
      {tab === 'overview' && (
        <div className="space-y-5">
          <Section title="Company Details" icon="🏢">
            <Row label="Company Name"   value={cust.company_name} />
            <Row label="Contact Person" value={cust.contact_person} />
            <Row label="Email"          value={cust.email} />
            <Row label="Phone"          value={cust.phone} />
            <Row label="Mobile"         value={cust.mobile} />
            <Row label="City"           value={cust.city} />
            <Row label="Country"        value={cust.country} />
            <div className="col-span-2 sm:col-span-3">
              <Row label="Address"      value={cust.address} />
            </div>
          </Section>

          <Section title="Business & Finance" icon="💼">
            <Row label="Customer Type" value={cust.customer_type} />
            <Row label="Status"        value={cust.status} />
            <Row label="Payment Terms" value={cust.payment_terms ? `Net ${cust.payment_terms} days` : '—'} />
            <Row label="Credit Limit"  value={cust.credit_limit ? fmtSAR(cust.credit_limit) : '—'} />
            <Row label="Tax Number"    value={cust.tax_number} />
            <Row label="CR Number"     value={cust.cr_number} />
          </Section>

          {cust.notes && (
            <div className="bg-[#1a1d27] rounded-xl border border-white/5 p-5 print:bg-white print:border print:border-gray-200">
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 print:text-gray-600">📝 Notes</h3>
              <p className="text-xs text-slate-300 whitespace-pre-wrap leading-relaxed print:text-gray-700">{cust.notes}</p>
            </div>
          )}

          <div className="bg-[#1a1d27] rounded-xl border border-white/5 p-5 print:bg-white print:border print:border-gray-200">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 print:text-gray-600">📅 Record</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-4">
              <Row label="Customer Since" value={fmtDate(cust.created_at)} />
              <Row label="Customer Code"  value={cust.customer_code} />
            </div>
          </div>
        </div>
      )}

      {/* ── TAB: Shipments ── */}
      {tab === 'shipments' && (
        <div className="bg-[#1a1d27] rounded-xl border border-white/5 overflow-hidden">
          {shipments.length === 0 ? (
            <div className="flex items-center justify-center py-16 text-slate-500 text-sm">No shipments found</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-white/5">
                    {['Tracking #', 'Route', 'Driver', 'Status', 'Amount', 'Date'].map(h => (
                      <th key={h} className={`px-4 py-3 text-[10px] text-slate-500 uppercase tracking-wider font-medium ${h === 'Amount' ? 'text-right' : 'text-left'}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {shipments.map((s: any) => (
                    <tr
                      key={s.id}
                      onClick={() => navigate(`/shipments/${s.id}`)}
                      className="hover:bg-white/[0.02] cursor-pointer transition-colors"
                    >
                      <td className="px-4 py-3 font-mono text-blue-400">{s.tracking_number}</td>
                      <td className="px-4 py-3 text-slate-300">
                        <span className="text-slate-400">{s.origin}</span>
                        <span className="text-slate-600 mx-1">→</span>
                        <span>{s.destination}</span>
                      </td>
                      <td className="px-4 py-3 text-slate-400">{s.driver_name || '—'}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-medium border capitalize ${SHIPMENT_STATUS[s.status] || 'bg-slate-500/15 text-slate-400 border-slate-500/20'}`}>
                          {(s.status || '').replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-slate-300 font-medium">{s.final_amount ? fmtSAR(s.final_amount) : '—'}</td>
                      <td className="px-4 py-3 text-slate-500">{fmtDate(s.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {shipments.length > 0 && (
            <div className="px-4 py-2.5 border-t border-white/5 text-[10px] text-slate-600">
              Showing last {shipments.length} shipments
            </div>
          )}
        </div>
      )}

      {/* ── TAB: Invoices ── */}
      {tab === 'invoices' && (
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Total Billed', value: fmtSAR(invoices.reduce((s: number, i: any) => s + (parseFloat(i.total_amount) || 0), 0)) },
              { label: 'Total Paid',   value: fmtSAR(invoices.reduce((s: number, i: any) => s + (parseFloat(i.paid_amount)  || 0), 0)) },
              { label: 'Outstanding',  value: fmtSAR(outstanding), accent: outstanding > 0 ? 'text-amber-400' : 'text-emerald-400' },
            ].map(({ label, value, accent }) => (
              <div key={label} className="bg-[#1a1d27] rounded-xl border border-white/5 p-4">
                <p className="text-[10px] text-slate-500 uppercase tracking-wider">{label}</p>
                <p className={`text-base font-bold mt-1 ${accent || 'text-white'}`}>{value}</p>
              </div>
            ))}
          </div>

          <div className="bg-[#1a1d27] rounded-xl border border-white/5 overflow-hidden">
            {invoices.length === 0 ? (
              <div className="flex items-center justify-center py-16 text-slate-500 text-sm">No invoices found</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-white/5">
                      {['Invoice #', 'Date', 'Due', 'Status', 'Total', 'Paid', 'Balance'].map(h => (
                        <th key={h} className={`px-4 py-3 text-[10px] text-slate-500 uppercase tracking-wider font-medium ${['Total','Paid','Balance'].includes(h) ? 'text-right' : 'text-left'}`}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {invoices.map((inv: any) => {
                      const paid  = parseFloat(inv.paid_amount)  || 0;
                      const total = parseFloat(inv.total_amount) || 0;
                      const bal   = Math.max(0, total - paid);
                      const iStyle = INVOICE_STATUS[inv.status] || INVOICE_STATUS.draft;
                      return (
                        <tr key={inv.id} className="hover:bg-white/[0.02] transition-colors">
                          <td className="px-4 py-3 font-mono text-blue-400">{inv.invoice_number}</td>
                          <td className="px-4 py-3 text-slate-400">{fmtDate(inv.invoice_date)}</td>
                          <td className="px-4 py-3 text-slate-400">{fmtDate(inv.due_date)}</td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-0.5 rounded-md text-[10px] font-medium capitalize border border-white/5 ${iStyle.bg} ${iStyle.text}`}>
                              {inv.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right text-slate-300 font-medium">{fmtSAR(total)}</td>
                          <td className="px-4 py-3 text-right text-emerald-400">{fmtSAR(paid)}</td>
                          <td className={`px-4 py-3 text-right font-semibold ${bal > 0 ? 'text-amber-400' : 'text-slate-600'}`}>
                            {bal > 0 ? fmtSAR(bal) : '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            {invoices.length > 0 && (
              <div className="px-4 py-2.5 border-t border-white/5 text-[10px] text-slate-600">
                Showing last {invoices.length} invoices
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── TAB: Contacts ── */}
      {tab === 'contacts' && (
        <div className="space-y-3">
          {contacts.length === 0 ? (
            <div className="bg-[#1a1d27] rounded-xl border border-white/5 flex items-center justify-center py-16 text-slate-500 text-sm">
              No contacts on file
            </div>
          ) : contacts.map((c: any) => (
            <div
              key={c.id}
              className="bg-[#1a1d27] rounded-xl border border-white/5 p-5 flex items-start gap-4 print:bg-white print:border print:border-gray-200"
            >
              <div className="w-10 h-10 rounded-xl bg-slate-700 flex items-center justify-center text-sm font-bold text-slate-300 flex-shrink-0">
                {initials(c.name)}
              </div>
              <div className="flex-1 grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-3">
                <div>
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider">Name</p>
                  <p className="text-xs text-white font-medium mt-0.5 flex items-center gap-1.5">
                    {c.name}
                    {c.is_primary ? (
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-400 border border-blue-500/20">Primary</span>
                    ) : null}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider">Position</p>
                  <p className="text-xs text-white mt-0.5">{c.position || '—'}</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider">Email</p>
                  <p className="text-xs text-slate-300 mt-0.5 break-all">{c.email || '—'}</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider">Phone</p>
                  <p className="text-xs text-slate-300 mt-0.5">{c.phone || '—'}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Print footer */}
      <div className="hidden print:block text-center text-[10px] text-gray-400 border-t border-gray-200 pt-4 mt-6">
        Rawabi Logistics ERP · Confidential · {new Date().toLocaleString('en-GB')}
      </div>
    </div>
  );
}
