import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { customersApi } from '@/lib/api';
import { toast } from 'sonner';

import { fmtSAR, fmtDate } from '@/lib/format';
import Modal, { ModalFooter } from '@/components/Modal';

const TYPE_STYLE: Record<string, string> = {
  corporate:  'bg-blue-500/15 text-blue-400',
  vip:        'bg-amber-500/15 text-amber-400',
  government: 'bg-purple-500/15 text-purple-400',
  regular:    'bg-slate-500/15 text-slate-400',
};
import { CUSTOMER_STATUS } from '@/lib/statusStyles';

function Field({ label, value }: { label: string; value: any }) {
  return (
    <div>
      <p className="text-[11px] text-slate-500">{label}</p>
      <p className="text-xs text-white mt-0.5 break-words">{value || '—'}</p>
    </div>
  );
}

function FIn({ label, required, ...props }: any) {
  return (
    <div>
      <label className="block text-[11px] text-slate-500 mb-1">{label}{required && <span className="text-red-400 ml-0.5">*</span>}</label>
      <input {...props} className="w-full px-3 py-2 text-xs bg-[#0f1117] border border-white/10 rounded-lg text-white placeholder-slate-600 focus:outline-none focus:border-blue-500/50" />
    </div>
  );
}
function FSel({ label, children, ...props }: any) {
  return (
    <div>
      <label className="block text-[11px] text-slate-500 mb-1">{label}</label>
      <select {...props} className="w-full px-3 py-2 text-xs bg-[#0f1117] border border-white/10 rounded-lg text-white focus:outline-none focus:border-blue-500/50">
        {children}
      </select>
    </div>
  );
}

const EMPTY_FORM = {
  companyName: '', contactPerson: '', email: '', phone: '', mobile: '',
  address: '', city: '', country: 'Saudi Arabia', taxNumber: '', crNumber: '',
  creditLimit: '', paymentTerms: '30', customerType: 'regular', status: 'active',
};

export default function Customers() {
  const { hasPermission } = useAuth();
  const canEdit   = hasPermission(['super_admin', 'admin', 'dispatcher']);
  const canDelete = hasPermission(['super_admin', 'admin']);

  const [customers, setCustomers]     = useState<any[]>([]);
  const [loading, setLoading]         = useState(true);
  const [total, setTotal]             = useState(0);
  const [search, setSearch]           = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterType, setFilterType]   = useState('');
  const [selected, setSelected]       = useState<any | null>(null);
  const [showDetail, setShowDetail]   = useState(false);
  const [showForm, setShowForm]       = useState(false);
  const [editId, setEditId]           = useState<number | null>(null);
  const [form, setForm]               = useState({ ...EMPTY_FORM });
  const [saving, setSaving]           = useState(false);
  const [detailTab, setDetailTab]     = useState<'overview' | 'shipments' | 'invoices' | 'contacts'>('overview');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (search)       params.search = search;
      if (filterStatus) params.status = filterStatus;
      if (filterType)   params.type   = filterType;
      const res = await customersApi.getAll(params);
      setCustomers(res.data || res);
      setTotal(res.pagination?.total || (res.data || res).length);
    } catch { toast.error('Failed to load customers'); }
    finally { setLoading(false); }
  }, [search, filterStatus, filterType]);

  useEffect(() => { load(); }, [load]);

  const openDetail = async (c: any) => {
    try {
      const full = await customersApi.getById(c.id);
      setSelected(full);
      setDetailTab('overview');
      setShowDetail(true);
    } catch { toast.error('Failed to load customer details'); }
  };

  const openCreate = () => {
    setForm({ ...EMPTY_FORM });
    setEditId(null);
    setShowForm(true);
  };

  const openEdit = (c: any) => {
    setForm({
      companyName: c.company_name || '', contactPerson: c.contact_person || '',
      email: c.email || '', phone: c.phone || '', mobile: c.mobile || '',
      address: c.address || '', city: c.city || '', country: c.country || 'Saudi Arabia',
      taxNumber: c.tax_number || '', crNumber: c.cr_number || '',
      creditLimit: c.credit_limit || '', paymentTerms: c.payment_terms || '30',
      customerType: c.customer_type || 'regular', status: c.status || 'active',
    });
    setEditId(c.id);
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.companyName.trim()) return toast.error('Company name is required');
    setSaving(true);
    try {
      if (editId) {
        await customersApi.update(editId, form);
        toast.success('Customer updated');
      } else {
        const res = await customersApi.create(form);
        toast.success(`Customer ${res.customerCode} created`);
      }
      setShowForm(false);
      load();
      if (showDetail && selected) {
        const full = await customersApi.getById(editId || selected.id);
        setSelected(full);
      }
    } catch (e: any) {
      toast.error(e.message || 'Failed to save customer');
    } finally { setSaving(false); }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this customer? This cannot be undone.')) return;
    try {
      await customersApi.delete(id);
      toast.success('Customer deleted');
      setShowDetail(false);
      load();
    } catch { toast.error('Cannot delete — customer may have linked shipments or invoices'); }
  };

  const f = (k: string, v: any) => setForm(prev => ({ ...prev, [k]: v }));

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-white">Customers</h1>
          <p className="text-xs text-slate-500 mt-0.5">{total} total</p>
        </div>
        {canEdit && (
          <button onClick={openCreate}
            className="flex items-center gap-2 px-4 py-2 min-h-[44px] bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-lg transition-colors">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/></svg>
            New Customer
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 max-w-xs">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0"/></svg>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name, email, city..."
            className="w-full pl-9 pr-4 py-2 text-xs bg-[#1a1d27] border border-white/5 rounded-lg text-white placeholder-slate-600 focus:outline-none focus:border-blue-500/40" />
        </div>
        <select value={filterType} onChange={e => setFilterType(e.target.value)}
          className="px-3 py-2 text-xs bg-[#1a1d27] border border-white/5 rounded-lg text-white focus:outline-none">
          <option value="">All types</option>
          {['regular','vip','corporate','government'].map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase()+t.slice(1)}</option>)}
        </select>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
          className="px-3 py-2 text-xs bg-[#1a1d27] border border-white/5 rounded-lg text-white focus:outline-none">
          <option value="">All statuses</option>
          {['active','inactive','suspended'].map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase()+s.slice(1)}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="bg-[#1a1d27] rounded-xl border border-white/5 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-white/5">
                {['Code','Company','Contact','City','Type','Credit Limit','Payment Terms','Shipments','Revenue','Status',''].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-[11px] font-medium text-slate-500 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={11} className="px-4 py-12 text-center text-slate-500">Loading...</td></tr>
              ) : customers.length === 0 ? (
                <tr><td colSpan={11} className="px-4 py-12 text-center text-slate-500">No customers found</td></tr>
              ) : customers.map(c => (
                <tr key={c.id} onClick={() => openDetail(c)}
                  className="border-b border-white/5 hover:bg-white/5 cursor-pointer transition-colors">
                  <td className="px-4 py-3 font-mono text-slate-400 text-[11px]">{c.customer_code}</td>
                  <td className="px-4 py-3 text-white font-semibold max-w-[160px] truncate">{c.company_name}</td>
                  <td className="px-4 py-3 text-slate-400">{c.contact_person || '—'}</td>
                  <td className="px-4 py-3 text-slate-400">{c.city || '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${TYPE_STYLE[c.customer_type] || TYPE_STYLE.regular}`}>{c.customer_type}</span>
                  </td>
                  <td className="px-4 py-3 text-slate-400 tabular-nums">{fmtSAR(c.credit_limit)}</td>
                  <td className="px-4 py-3 text-slate-400">Net {c.payment_terms}d</td>
                  <td className="px-4 py-3 text-white tabular-nums">{c.total_shipments || 0}</td>
                  <td className="px-4 py-3 text-emerald-400 tabular-nums font-semibold">{fmtSAR(c.total_revenue)}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${CUSTOMER_STATUS[c.status] || CUSTOMER_STATUS['active']}`}>{c.status}</span>
                  </td>
                  <td className="px-4 py-3"><svg className="w-4 h-4 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5l7 7-7 7"/></svg></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── DETAIL MODAL ── */}
      <Modal
        open={!!(showDetail && selected)}
        onClose={() => setShowDetail(false)}
        title={selected?.company_name || ''}
        subtitle={selected ? `${selected.customer_code} · ${selected.city}` : undefined}
        variant="page"
        maxWidth="sm:max-w-4xl"
        headerActions={selected ? (
          <div className="flex items-center gap-2">
            {canEdit && (
              <button onClick={() => { setShowDetail(false); openEdit(selected); }}
                className="px-3 py-1.5 min-h-[44px] text-xs bg-white/5 hover:bg-white/10 text-slate-300 rounded-lg border border-white/10 transition-colors">Edit</button>
            )}
            {canDelete && (
              <button onClick={() => handleDelete(selected.id)}
                className="px-3 py-1.5 min-h-[44px] text-xs bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg border border-red-500/20 transition-colors">Delete</button>
            )}
          </div>
        ) : undefined}
        footer={
          <div className="flex justify-end px-4 sm:px-6 py-4 border-t border-white/5 bg-[#1a1d27] flex-shrink-0">
            <button onClick={() => setShowDetail(false)} className="px-4 py-2.5 min-h-[44px] text-xs text-slate-400 hover:text-white transition-colors">Close</button>
          </div>
        }
      >
        {selected && (
          <div>
            {/* Stats row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 px-4 sm:px-6 py-4 border-b border-white/5">
              {[
                { label: 'Total Shipments', value: selected.stats?.total_shipments || 0, color: 'text-white' },
                { label: 'Completed', value: selected.stats?.completed_shipments || 0, color: 'text-emerald-400' },
                { label: 'Total Revenue', value: fmtSAR(selected.stats?.total_revenue), color: 'text-blue-400' },
                { label: 'Avg Delivery', value: selected.stats?.avg_delivery_performance != null ? `${Number(selected.stats.avg_delivery_performance).toFixed(1)} days` : 'N/A', color: 'text-slate-300' },
              ].map(s => (
                <div key={s.label} className="bg-[#0f1117] rounded-lg p-3 border border-white/5">
                  <p className="text-[11px] text-slate-500">{s.label}</p>
                  <p className={`text-sm font-bold mt-1 ${s.color}`}>{s.value}</p>
                </div>
              ))}
            </div>

            {/* Tabs */}
            <div className="flex gap-1 px-4 sm:px-6 pt-4 overflow-x-auto">
              {(['overview','shipments','invoices','contacts'] as const).map(tab => (
                <button key={tab} onClick={() => setDetailTab(tab)}
                  className={`px-3 py-1.5 min-h-[44px] text-xs font-medium rounded-lg transition-colors capitalize whitespace-nowrap ${
                    detailTab === tab ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
                  }`}>{tab}</button>
              ))}
            </div>

            <div className="p-4 sm:p-6 pt-4">

              {/* Overview tab */}
              {detailTab === 'overview' && (
                <div className="grid grid-cols-2 gap-5">
                  <div className="space-y-3">
                    <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Contact Information</p>
                    <div className="bg-[#0f1117] rounded-xl p-4 border border-white/5 grid grid-cols-2 gap-3">
                      <Field label="Contact Person" value={selected.contact_person} />
                      <Field label="Email" value={selected.email} />
                      <Field label="Phone" value={selected.phone} />
                      <Field label="Mobile" value={selected.mobile} />
                      <Field label="City" value={selected.city} />
                      <Field label="Country" value={selected.country} />
                      <Field label="Address" value={selected.address} />
                    </div>
                  </div>
                  <div className="space-y-3">
                    <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Business Details</p>
                    <div className="bg-[#0f1117] rounded-xl p-4 border border-white/5 grid grid-cols-2 gap-3">
                      <Field label="Customer Type" value={selected.customer_type} />
                      <Field label="Status" value={selected.status} />
                      <Field label="VAT Number" value={selected.tax_number} />
                      <Field label="CR Number" value={selected.cr_number} />
                      <Field label="Credit Limit" value={fmtSAR(selected.credit_limit)} />
                      <Field label="Payment Terms" value={`Net ${selected.payment_terms} days`} />
                      <Field label="Member Since" value={fmtDate(selected.created_at)} />
                    </div>
                  </div>
                </div>
              )}

              {/* Shipments tab */}
              {detailTab === 'shipments' && (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-white/5">
                        {['Shipment #','From','To','Status','Date','Amount'].map(h => (
                          <th key={h} className="py-2 pr-4 text-left text-[11px] font-medium text-slate-500">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {(selected.shipments || []).length === 0 ? (
                        <tr><td colSpan={6} className="py-8 text-center text-slate-500">No shipments</td></tr>
                      ) : (selected.shipments || []).map((s: any) => (
                        <tr key={s.id} className="border-b border-white/5">
                          <td className="py-2 pr-4 font-mono text-blue-400">{s.shipment_number}</td>
                          <td className="py-2 pr-4 text-slate-400">{s.origin_city}</td>
                          <td className="py-2 pr-4 text-slate-400">{s.destination_city}</td>
                          <td className="py-2 pr-4"><span className="px-2 py-0.5 rounded-full text-[10px] bg-white/5 text-slate-300">{s.status}</span></td>
                          <td className="py-2 pr-4 text-slate-400">{fmtDate(s.order_date)}</td>
                          <td className="py-2 pr-4 text-emerald-400 font-semibold">{fmtSAR(s.final_amount || s.quoted_amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Invoices tab */}
              {detailTab === 'invoices' && (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-white/5">
                        {['Invoice #','Date','Due','Total','Paid','Balance','Status'].map(h => (
                          <th key={h} className="py-2 pr-4 text-left text-[11px] font-medium text-slate-500">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {(selected.invoices || []).length === 0 ? (
                        <tr><td colSpan={7} className="py-8 text-center text-slate-500">No invoices</td></tr>
                      ) : (selected.invoices || []).map((inv: any) => (
                        <tr key={inv.id} className="border-b border-white/5">
                          <td className="py-2 pr-4 font-mono text-blue-400">{inv.invoice_number}</td>
                          <td className="py-2 pr-4 text-slate-400">{fmtDate(inv.invoice_date)}</td>
                          <td className="py-2 pr-4 text-slate-400">{fmtDate(inv.due_date)}</td>
                          <td className="py-2 pr-4 text-white font-semibold">{fmtSAR(inv.total_amount)}</td>
                          <td className="py-2 pr-4 text-emerald-400">{fmtSAR(inv.paid_amount)}</td>
                          <td className="py-2 pr-4" style={{ color: Number(inv.balance_due) > 0 ? '#f87171' : '#34d399' }}>{fmtSAR(inv.balance_due)}</td>
                          <td className="py-2 pr-4"><span className="px-2 py-0.5 rounded-full text-[10px] bg-white/5 text-slate-300">{inv.status}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Contacts tab */}
              {detailTab === 'contacts' && (
                <div className="space-y-2">
                  {(selected.contacts || []).length === 0 ? (
                    <p className="text-center text-slate-500 py-8 text-xs">No additional contacts</p>
                  ) : (selected.contacts || []).map((ct: any) => (
                    <div key={ct.id} className="flex items-center justify-between bg-[#0f1117] rounded-lg p-3 border border-white/5">
                      <div>
                        <p className="text-xs font-semibold text-white">{ct.name} {ct.is_primary ? <span className="text-[10px] text-amber-400 ml-1">Primary</span> : ''}</p>
                        <p className="text-[11px] text-slate-500 mt-0.5">{ct.position} {ct.email ? `· ${ct.email}` : ''} {ct.phone ? `· ${ct.phone}` : ''}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* ── CREATE / EDIT FORM MODAL ── */}
      <Modal
        open={showForm}
        onClose={() => setShowForm(false)}
        title={editId ? 'Edit Customer' : 'New Customer'}
        variant="page"
        maxWidth="sm:max-w-2xl"
        footer={
          <ModalFooter
            onClose={() => setShowForm(false)}
            onSave={handleSave}
            saving={saving}
            saveLabel={editId ? 'Save Changes' : 'Create Customer'}
          />
        }
      >
        <div className="p-4 sm:p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="col-span-2"><FIn label="Company Name" required value={form.companyName} onChange={(e: any) => f('companyName', e.target.value)} placeholder="e.g. Saudi Aramco" /></div>
        <FIn label="Contact Person" value={form.contactPerson} onChange={(e: any) => f('contactPerson', e.target.value)} placeholder="Primary contact name" />
        <FIn label="Email" type="email" value={form.email} onChange={(e: any) => f('email', e.target.value)} placeholder="contact@company.com" />
        <FIn label="Phone" value={form.phone} onChange={(e: any) => f('phone', e.target.value)} placeholder="+966 13 xxx xxxx" />
        <FIn label="Mobile" value={form.mobile} onChange={(e: any) => f('mobile', e.target.value)} placeholder="+966 5xx xxx xxx" />
        <FIn label="City" value={form.city} onChange={(e: any) => f('city', e.target.value)} placeholder="e.g. Riyadh" />
        <FIn label="Country" value={form.country} onChange={(e: any) => f('country', e.target.value)} />
        <div className="col-span-2"><FIn label="Address" value={form.address} onChange={(e: any) => f('address', e.target.value)} placeholder="Full address" /></div>
        <FIn label="VAT Number" value={form.taxNumber} onChange={(e: any) => f('taxNumber', e.target.value)} placeholder="e.g. 300123456700003" />
        <FIn label="CR Number" value={form.crNumber} onChange={(e: any) => f('crNumber', e.target.value)} placeholder="Commercial registration" />
        <FIn label="Credit Limit (SAR)" type="number" value={form.creditLimit} onChange={(e: any) => f('creditLimit', e.target.value)} placeholder="0" />
        <FSel label="Payment Terms (days)" value={form.paymentTerms} onChange={(e: any) => f('paymentTerms', e.target.value)}>
          {[15,30,45,60,90].map(t => <option key={t} value={t}>Net {t}</option>)}
        </FSel>
        <FSel label="Customer Type" value={form.customerType} onChange={(e: any) => f('customerType', e.target.value)}>
          {['regular','vip','corporate','government'].map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase()+t.slice(1)}</option>)}
        </FSel>
        {editId && (
          <FSel label="Status" value={form.status} onChange={(e: any) => f('status', e.target.value)}>
            {['active','inactive','suspended'].map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase()+s.slice(1)}</option>)}
          </FSel>
        )}
      </div>
    
          </div>
        </div>
      </Modal>
    </div>
  );
}
