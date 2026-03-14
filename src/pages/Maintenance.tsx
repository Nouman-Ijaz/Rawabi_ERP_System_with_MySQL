import { loadJsPDF } from '@/lib/pdf';
import { useEffect, useState, useCallback } from 'react';
import { maintenanceApi, vehiclesApi } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { fmtDate, fmtSAR } from '@/lib/format';
import { inp, sel } from '@/lib/cx';
import FormField from '@/components/FormField';

// ── jsPDF CDN loader ───────────────────────────────────────────────

function buildMaintenancePage(doc: any, r: any, isFirst: boolean) {
  const W = 210, pad = 15;
  if (!isFirst) doc.addPage();

  // Header bar
  doc.setFillColor(37, 99, 235);
  doc.rect(0, 0, W, 26, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(13); doc.setFont('helvetica', 'bold');
  doc.text('MAINTENANCE RECORD', pad, 10);
  doc.setFontSize(8); doc.setFont('helvetica', 'normal');
  doc.text('Rawabi Logistics Co.', pad, 16);
  doc.setFontSize(9); doc.setFont('helvetica', 'bold');
  doc.text(r.vehicle_plate || r.vehicle_code || '—', W - pad, 10, { align: 'right' });
  doc.setFontSize(7); doc.setFont('helvetica', 'normal');
  doc.text(`${r.vehicle_type || ''}`, W - pad, 16, { align: 'right' });

  // Status badge
  const statusColors: Record<string, [number,number,number]> = {
    completed: [5,150,105], in_progress: [245,158,11], scheduled: [37,99,235], cancelled: [100,116,139],
  };
  const sc = statusColors[r.status] || [100,116,139];
  doc.setFillColor(...sc);
  doc.roundedRect(W - pad - 30, 4, 30, 8, 2, 2, 'F');
  doc.setFontSize(7); doc.setFont('helvetica', 'bold');
  doc.text((r.status || '').replace('_',' ').toUpperCase(), W - pad - 15, 9.2, { align: 'center' });

  // Fields
  doc.setTextColor(30, 41, 59);
  const fields: [string, string][] = [
    ['Maintenance Type', (r.maintenance_type || '').replace('_',' ')],
    ['Service Date',     fmtDate(r.service_date)],
    ['Service Provider', r.service_provider || '—'],
    ['Cost',             r.cost ? fmtSAR(r.cost) : '—'],
    ['Completion Date',  r.completion_date ? fmtDate(r.completion_date) : '—'],
    ['Next Service',     r.next_service_date ? fmtDate(r.next_service_date) : '—'],
    ['Next Service KM',  r.next_service_km ? `${r.next_service_km.toLocaleString()} km` : '—'],
    ['Performed By',     r.performed_by_name || '—'],
  ];

  let fx = pad, fy = 34;
  fields.forEach(([label, val], i) => {
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(fx, fy, 85, 16, 2, 2, 'F');
    doc.setFontSize(7); doc.setFont('helvetica', 'normal'); doc.setTextColor(100,116,139);
    doc.text(label.toUpperCase(), fx + 4, fy + 5.5);
    doc.setFontSize(9); doc.setFont('helvetica', 'bold'); doc.setTextColor(30,41,59);
    doc.text(val, fx + 4, fy + 12);
    fx = fx === pad ? pad + 90 : pad;
    if (i % 2 === 1) fy += 20;
  });

  fy += 6;
  if (r.description) {
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(pad, fy, W - pad * 2, 18, 2, 2, 'F');
    doc.setFontSize(7); doc.setFont('helvetica', 'normal'); doc.setTextColor(100,116,139);
    doc.text('DESCRIPTION', pad + 4, fy + 5);
    doc.setFontSize(8); doc.setTextColor(30,41,59);
    const lines = doc.splitTextToSize(r.description, W - pad * 2 - 8);
    doc.text(lines.slice(0, 2), pad + 4, fy + 11);
    fy += 22;
  }
  if (r.parts_replaced) {
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(pad, fy, W - pad * 2, 18, 2, 2, 'F');
    doc.setFontSize(7); doc.setFont('helvetica', 'normal'); doc.setTextColor(100,116,139);
    doc.text('PARTS REPLACED', pad + 4, fy + 5);
    doc.setFontSize(8); doc.setTextColor(30,41,59);
    doc.text(doc.splitTextToSize(r.parts_replaced, W - pad * 2 - 8).slice(0,2), pad + 4, fy + 11);
  }

  const pageH = 297;
  doc.setFillColor(248, 250, 252);
  doc.rect(0, pageH - 14, W, 14, 'F');
  doc.setFontSize(7); doc.setTextColor(148, 163, 184); doc.setFont('helvetica', 'normal');
  doc.text('Rawabi Logistics Co. · Maintenance Record', pad, pageH - 5);
  doc.text(`Generated ${fmtDate(new Date().toISOString())}`, W - pad, pageH - 5, { align: 'right' });
}

import { MAINTENANCE_STATUS, MAINTENANCE_TYPE } from '@/lib/statusStyles';
import StatusBadge from '@/components/StatusBadge';
import Icon from '@/components/Icon';
const TYPES    = ['routine','repair','inspection','tire_change','oil_change','other'];
const STATUSES = ['scheduled','in_progress','completed','cancelled'];

const EMPTY_FORM = {
  vehicleId:'', maintenanceType:'routine', serviceDate:'', description:'',
  serviceProvider:'', cost:'', partsReplaced:'', nextServiceDate:'', nextServiceKm:'',
  notes:'', status:'scheduled', completionDate:'',
};

const Field = FormField;

export default function Maintenance() {
  const { hasPermission } = useAuth();
  const canEdit = hasPermission(['super_admin', 'admin']);

  const [records,    setRecords]    = useState<any[]>([]);
  const [summary,    setSummary]    = useState<any>(null);
  const [upcoming,   setUpcoming]   = useState<any>(null);
  const [vehicles,   setVehicles]   = useState<any[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [statusFilt, setStatusFilt] = useState('');
  const [typeFilt,   setTypeFilt]   = useState('');
  const [showForm,   setShowForm]   = useState(false);
  const [editId,     setEditId]     = useState<number | null>(null);
  const [saving,     setSaving]     = useState(false);
  const [deleteId,   setDeleteId]   = useState<number | null>(null);
  const [form,       setForm]       = useState({ ...EMPTY_FORM });
  const [viewRecord, setViewRecord] = useState<any>(null);
  const [pdfBusy,    setPdfBusy]    = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (statusFilt) params.status = statusFilt;
      if (typeFilt)   params.type   = typeFilt;
      const [recs, sum, up, vehs] = await Promise.all([
        maintenanceApi.getAll(params),
        maintenanceApi.getSummary(),
        maintenanceApi.getUpcoming(),
        vehiclesApi.getAll(),
      ]);
      setRecords(Array.isArray(recs) ? recs : recs.data || []);
      setSummary(sum);
      setUpcoming(up);
      setVehicles(Array.isArray(vehs) ? vehs : vehs.data || []);
    } catch { toast.error('Failed to load maintenance records'); }
    finally { setLoading(false); }
  }, [statusFilt, typeFilt]);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => { setEditId(null); setForm({ ...EMPTY_FORM }); setShowForm(true); };
  const printSinglePdf = async (r: any) => {
    setPdfBusy(true);
    toast.info('Generating record PDF…');
    try {
      const jsPDF = await loadJsPDF();
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      buildMaintenancePage(doc, r, true);
      const safe = (r.vehicle_plate || 'Vehicle').replace(/[^a-zA-Z0-9 _-]/g, '').trim();
      doc.save(`Maintenance-${safe}-${fmtDate(r.service_date)}.pdf`);
      toast.success('PDF downloaded');
    } catch { toast.error('PDF generation failed'); }
    finally { setPdfBusy(false); }
  };

  const downloadAllPdf = async () => {
    if (records.length === 0) { toast.error('No records to export'); return; }
    setPdfBusy(true);
    toast.info(`Building PDF for ${records.length} records…`);
    try {
      const jsPDF = await loadJsPDF();
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      records.forEach((r, i) => buildMaintenancePage(doc, r, i === 0));
      const stamp = new Date().toISOString().slice(0, 10);
      doc.save(`Rawabi-Maintenance-${stamp}.pdf`);
      toast.success(`${records.length} records exported`);
    } catch { toast.error('PDF export failed'); }
    finally { setPdfBusy(false); }
  };

  const openEdit   = (r: any) => {
    setEditId(r.id);
    setForm({
      vehicleId:        String(r.vehicle_id || ''),
      maintenanceType:  r.maintenance_type || 'routine',
      serviceDate:      r.service_date?.slice(0, 10) || '',
      completionDate:   r.completion_date?.slice(0, 10) || '',
      description:      r.description || '',
      serviceProvider:  r.service_provider || '',
      cost:             r.cost || '',
      partsReplaced:    r.parts_replaced || '',
      nextServiceDate:  r.next_service_date?.slice(0, 10) || '',
      nextServiceKm:    r.next_service_km || '',
      notes:            r.notes || '',
      status:           r.status || 'scheduled',
    });
    setShowForm(true);
  };
  const closeForm = () => { setShowForm(false); setEditId(null); };

  const save = async () => {
    if (!form.vehicleId || !form.serviceDate || !form.description) {
      toast.error('Vehicle, service date and description are required');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        vehicleId:       form.vehicleId,
        maintenanceType: form.maintenanceType,
        serviceDate:     form.serviceDate,
        completionDate:  form.completionDate || null,
        description:     form.description,
        serviceProvider: form.serviceProvider || null,
        cost:            form.cost ? Number(form.cost) : null,
        partsReplaced:   form.partsReplaced || null,
        nextServiceDate: form.nextServiceDate || null,
        nextServiceKm:   form.nextServiceKm ? Number(form.nextServiceKm) : null,
        notes:           form.notes || null,
        status:          form.status,
      };
      if (editId) {
        await maintenanceApi.update(editId, payload);
        toast.success('Record updated');
      } else {
        await maintenanceApi.create(payload);
        toast.success('Record created');
      }
      closeForm();
      load();
    } catch (e: any) {
      toast.error(e.message || 'Failed to save record');
    } finally { setSaving(false); }
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    try {
      await maintenanceApi.delete(deleteId);
      toast.success('Record deleted');
      setDeleteId(null);
      load();
    } catch { toast.error('Failed to delete record'); }
  };

  const f = (k: keyof typeof EMPTY_FORM) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(p => ({ ...p, [k]: e.target.value }));

  const totalCost     = records.reduce((s, r) => s + Number(r.cost || 0), 0);
  const activeCount   = records.filter(r => r.status === 'in_progress').length;
  const scheduledCount= records.filter(r => r.status === 'scheduled').length;
  const upcomingCount = (upcoming?.byDate?.length || 0) + (upcoming?.byKm?.length || 0);

  return (
    <div className="space-y-5">

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Maintenance</h1>
          <p className="text-xs text-slate-500 mt-0.5">{loading ? '…' : `${records.length} record${records.length !== 1 ? 's' : ''}`}</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={downloadAllPdf} disabled={pdfBusy || loading || records.length === 0}
            className="flex items-center gap-1.5 px-3 py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white text-xs font-medium rounded-lg transition-colors disabled:opacity-40">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
            {pdfBusy ? 'Generating…' : 'Download All PDF'}
          </button>
          {canEdit && (
            <button onClick={openCreate}
              className="flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium rounded-lg transition-colors">
              <Icon name="plus" className="w-3.5 h-3.5" /> Log Maintenance
            </button>
          )}
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label:'Total Records',  value: records.length,  color:'text-white' },
          { label:'In Progress',    value: activeCount,     color:'text-amber-400' },
          { label:'Scheduled',      value: scheduledCount,  color:'text-blue-400' },
          { label:'Total Cost',     value: fmtSAR(totalCost), color:'text-emerald-400' },
        ].map(k => (
          <div key={k.label} className="bg-[#1a1d27] rounded-xl border border-white/5 p-4">
            <p className="text-[11px] text-slate-500">{k.label}</p>
            <p className={`text-xl font-bold tabular-nums mt-1 ${k.color}`}>{k.value}</p>
          </div>
        ))}
      </div>

      {/* Upcoming alert */}
      {upcomingCount > 0 && (
        <div className="flex items-start gap-3 bg-amber-500/10 border border-amber-500/20 rounded-xl p-4">
          <Icon name="alert" className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-semibold text-amber-400">{upcomingCount} vehicle{upcomingCount !== 1 ? 's' : ''} due for maintenance</p>
            <p className="text-[11px] text-slate-500 mt-0.5">
              {upcoming?.byDate?.length > 0 && `${upcoming.byDate.length} due by date`}
              {upcoming?.byDate?.length > 0 && upcoming?.byKm?.length > 0 && ' · '}
              {upcoming?.byKm?.length > 0 && `${upcoming.byKm.length} due by mileage`}
            </p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <select value={statusFilt} onChange={e => setStatusFilt(e.target.value)}
          className="bg-[#1a1d27] border border-white/5 rounded-lg px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-blue-500/40">
          <option value="">All Statuses</option>
          {STATUSES.map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
        </select>
        <select value={typeFilt} onChange={e => setTypeFilt(e.target.value)}
          className="bg-[#1a1d27] border border-white/5 rounded-lg px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-blue-500/40">
          <option value="">All Types</option>
          {TYPES.map(t => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="bg-[#1a1d27] rounded-xl border border-white/5 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-slate-600 text-xs">Loading maintenance records…</div>
        ) : records.length === 0 ? (
          <div className="p-12 text-center">
            <Icon name="wrench" className="w-10 h-10 text-slate-700 mx-auto mb-3" />
            <p className="text-sm text-slate-500">No maintenance records found</p>
            {canEdit && <button onClick={openCreate} className="mt-3 text-xs text-blue-400 hover:text-blue-300">Log first record</button>}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-white/5">
                  {['Vehicle','Type','Service Date','Description','Provider','Cost','Status','Actions'].map(h => (
                    <th key={h} className="py-3 px-4 text-left text-[11px] font-medium text-slate-500 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {records.map((r: any) => (
                  <tr key={r.id} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors group">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-blue-500/10 flex items-center justify-center flex-shrink-0">
                          <Icon name="truck" className="w-3.5 h-3.5 text-blue-400" />
                        </div>
                        <div>
                          <p className="font-semibold text-white font-mono text-[11px]">{r.vehicle_plate}</p>
                          <p className="text-[10px] text-slate-500 capitalize">{r.vehicle_type}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium capitalize ${MAINTENANCE_TYPE[r.maintenance_type] || 'bg-slate-500/15 text-slate-400'}`}>
                        {(r.maintenance_type || '').replace('_', ' ')}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-400 whitespace-nowrap">{fmtDate(r.service_date)}</td>
                    <td className="py-3 px-4 text-slate-300 max-w-[200px] truncate">{r.description}</td>
                    <td className="py-3 px-4 text-slate-400">{r.service_provider || '—'}</td>
                    <td className="py-3 px-4 text-slate-300 tabular-nums">{r.cost ? fmtSAR(r.cost) : '—'}</td>
                    <td className="py-3 px-4">
                      <StatusBadge value={r.status} map={MAINTENANCE_STATUS} />
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => setViewRecord(r)}
                          className="p-1.5 rounded-md hover:bg-blue-500/15 text-slate-500 hover:text-blue-400 transition-colors" title="View details">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
                        </button>
                        {canEdit && (
                          <>
                            <button onClick={() => openEdit(r)}
                              className="p-1.5 rounded-md hover:bg-blue-500/15 text-slate-500 hover:text-blue-400 transition-colors">
                              <Icon name="edit" className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={() => setDeleteId(r.id)}
                              className="p-1.5 rounded-md hover:bg-red-500/15 text-slate-500 hover:text-red-400 transition-colors">
                              <Icon name="trash" className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Form Drawer */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex">
          <div className="flex-1 bg-black/50 backdrop-blur-sm" onClick={closeForm} />
          <div className="w-full max-w-lg bg-[#0d0f14] border-l border-white/5 flex flex-col h-full overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
              <h2 className="text-sm font-semibold text-white">{editId ? 'Edit Record' : 'Log Maintenance'}</h2>
              <button onClick={closeForm} className="p-1.5 rounded-md hover:bg-white/5 text-slate-400 hover:text-white transition-colors">
                <Icon name="x" className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Vehicle" required>
                  <select value={form.vehicleId} onChange={f('vehicleId')} className={sel}>
                    <option value="">Select vehicle…</option>
                    {vehicles.map((v: any) => (
                      <option key={v.id} value={v.id}>{v.plate_number} — {v.vehicle_type}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Type" required>
                  <select value={form.maintenanceType} onChange={f('maintenanceType')} className={sel}>
                    {TYPES.map(t => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}
                  </select>
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Service Date" required><input type="date" value={form.serviceDate} onChange={f('serviceDate')} className={inp} style={{ colorScheme: 'dark' }} /></Field>
                <Field label="Completion Date"><input type="date" value={form.completionDate} onChange={f('completionDate')} className={inp} style={{ colorScheme: 'dark' }} /></Field>
              </div>
              <Field label="Description" required>
                <textarea value={form.description} onChange={f('description')} rows={3}
                  className={inp + ' resize-none'} placeholder="Describe the work performed…" />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Service Provider"><input value={form.serviceProvider} onChange={f('serviceProvider')} className={inp} placeholder="Garage / workshop name" /></Field>
                <Field label="Cost (SAR)"><input type="number" value={form.cost} onChange={f('cost')} className={inp} placeholder="0.00" /></Field>
              </div>
              <Field label="Parts Replaced">
                <textarea value={form.partsReplaced} onChange={f('partsReplaced')} rows={2}
                  className={inp + ' resize-none'} placeholder="List parts replaced (optional)…" />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Next Service Date"><input type="date" value={form.nextServiceDate} onChange={f('nextServiceDate')} className={inp} style={{ colorScheme: 'dark' }} /></Field>
                <Field label="Next Service KM"><input type="number" value={form.nextServiceKm} onChange={f('nextServiceKm')} className={inp} placeholder="e.g. 150000" /></Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Status">
                  <select value={form.status} onChange={f('status')} className={sel}>
                    {STATUSES.map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
                  </select>
                </Field>
              </div>
              <Field label="Notes">
                <textarea value={form.notes} onChange={f('notes')} rows={2}
                  className={inp + ' resize-none'} placeholder="Additional notes…" />
              </Field>
            </div>
            <div className="px-6 py-4 border-t border-white/5 flex gap-3">
              <button onClick={closeForm} className="flex-1 py-2 text-xs font-medium text-slate-400 hover:text-white border border-white/10 hover:border-white/20 rounded-lg transition-colors">Cancel</button>
              <button onClick={save} disabled={saving}
                className="flex-1 py-2 text-xs font-medium bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-lg transition-colors">
                {saving ? 'Saving…' : editId ? 'Save Changes' : 'Create Record'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-[#1a1d27] rounded-xl border border-white/10 p-6 w-full max-w-sm shadow-2xl">
            <h3 className="text-sm font-semibold text-white mb-2">Delete Record</h3>
            <p className="text-xs text-slate-400 mb-5">This maintenance record will be permanently deleted.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteId(null)} className="flex-1 py-2 text-xs border border-white/10 rounded-lg text-slate-400 hover:text-white transition-colors">Cancel</button>
              <button onClick={confirmDelete} className="flex-1 py-2 text-xs bg-red-600 hover:bg-red-500 text-white rounded-lg transition-colors">Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* ── RECORD DETAIL MODAL ── */}
      {viewRecord && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-[#1a1d27] rounded-2xl border border-white/10 shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
              <div>
                <h2 className="text-sm font-bold text-white font-mono">{viewRecord.vehicle_plate}</h2>
                <p className="text-[11px] text-slate-500 mt-0.5 capitalize">{(viewRecord.maintenance_type || '').replace('_',' ')} · {fmtDate(viewRecord.service_date)}</p>
              </div>
              <div className="flex items-center gap-2">
                <StatusBadge value={viewRecord.status} map={MAINTENANCE_STATUS} />
                <button onClick={() => setViewRecord(null)} className="p-1 text-slate-400 hover:text-white ml-1">
                  <Icon name="x" className="w-4 h-4" />
                </button>
              </div>
            </div>
            {viewRecord.cost && (
              <div className="px-6 py-4 bg-blue-500/5 border-b border-white/5">
                <p className="text-[10px] text-slate-500 uppercase tracking-wide mb-1">Total Cost</p>
                <p className="text-2xl font-bold text-blue-400 tabular-nums">{fmtSAR(viewRecord.cost)}</p>
              </div>
            )}
            <div className="p-6 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                {([
                  ['Service Provider', viewRecord.service_provider || '—'],
                  ['Service Date',     fmtDate(viewRecord.service_date)],
                  ['Completion Date',  viewRecord.completion_date ? fmtDate(viewRecord.completion_date) : '—'],
                  ['Next Service',     viewRecord.next_service_date ? fmtDate(viewRecord.next_service_date) : '—'],
                  ['Next Service KM',  viewRecord.next_service_km ? `${Number(viewRecord.next_service_km).toLocaleString()} km` : '—'],
                  ['Performed By',     viewRecord.performed_by_name || '—'],
                ] as [string,string][]).map(([label, val]) => (
                  <div key={label} className="bg-[#0f1117] rounded-lg p-3">
                    <div className="text-[10px] text-slate-500 uppercase tracking-wide mb-1">{label}</div>
                    <div className="text-xs text-white font-medium">{val}</div>
                  </div>
                ))}
              </div>
              {viewRecord.description && (
                <div className="bg-[#0f1117] rounded-lg p-3">
                  <div className="text-[10px] text-slate-500 uppercase tracking-wide mb-1">Description</div>
                  <div className="text-xs text-slate-300 whitespace-pre-wrap">{viewRecord.description}</div>
                </div>
              )}
              {viewRecord.parts_replaced && (
                <div className="bg-[#0f1117] rounded-lg p-3">
                  <div className="text-[10px] text-slate-500 uppercase tracking-wide mb-1">Parts Replaced</div>
                  <div className="text-xs text-slate-300 whitespace-pre-wrap">{viewRecord.parts_replaced}</div>
                </div>
              )}
              {viewRecord.notes && (
                <div className="bg-[#0f1117] rounded-lg p-3">
                  <div className="text-[10px] text-slate-500 uppercase tracking-wide mb-1">Notes</div>
                  <div className="text-xs text-slate-300 whitespace-pre-wrap">{viewRecord.notes}</div>
                </div>
              )}
            </div>
            <div className="flex items-center justify-between px-6 py-4 border-t border-white/5">
              <button onClick={() => printSinglePdf(viewRecord)} disabled={pdfBusy}
                className="flex items-center gap-1.5 px-4 py-2 bg-blue-600/15 hover:bg-blue-600/30 text-blue-400 text-xs font-medium rounded-lg transition-colors disabled:opacity-40">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"/></svg>
                {pdfBusy ? 'Generating…' : 'Print Record PDF'}
              </button>
              <button onClick={() => setViewRecord(null)} className="px-4 py-2 text-xs text-slate-400 hover:text-white transition-colors">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
