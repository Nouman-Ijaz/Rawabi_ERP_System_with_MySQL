import { useEffect, useState, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { vehiclesApi, driversApi } from '@/lib/api';
import { toast } from 'sonner';

const fmtDate = (d: string) => d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
const isExpiringSoon = (d: string) => {
  if (!d) return false;
  const days = Math.ceil((new Date(d).getTime() - Date.now()) / 86400000);
  return days >= 0 && days <= 30;
};
const isExpired = (d: string) => d && new Date(d) < new Date();

const VEHICLE_STATUS: Record<string, string> = {
  active:      'bg-emerald-500/15 text-emerald-400',
  maintenance: 'bg-amber-500/15 text-amber-400',
  retired:     'bg-slate-500/15 text-slate-400',
  sold:        'bg-blue-500/15 text-blue-400',
  accident:    'bg-red-500/15 text-red-400',
};
const DRIVER_STATUS: Record<string, string> = {
  available: 'bg-emerald-500/15 text-emerald-400',
  on_trip:   'bg-blue-500/15 text-blue-400',
  on_leave:  'bg-amber-500/15 text-amber-400',
  suspended: 'bg-red-500/15 text-red-400',
  off_duty:  'bg-slate-500/15 text-slate-400',
};

function FIn({ label, required, ...props }: any) {
  return (
    <div>
      <label className="block text-[11px] text-slate-500 mb-1">{label}{required && <span className="text-red-400 ml-0.5">*</span>}</label>
      <input {...props} className="w-full px-3 py-2 text-xs bg-[#0f1117] border border-white/10 rounded-lg text-white placeholder-slate-600 focus:outline-none focus:border-blue-500/50" />
    </div>
  );
}
function FDate({ label, ...props }: any) {
  return (
    <div>
      <label className="block text-[11px] text-slate-500 mb-1">{label}</label>
      <input type="date" {...props} style={{ colorScheme: 'dark' }}
        className="w-full px-3 py-2 text-xs bg-[#0f1117] border border-white/10 rounded-lg text-white focus:outline-none focus:border-blue-500/50 [&::-webkit-calendar-picker-indicator]:opacity-80" />
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

const EMPTY_VEHICLE = {
  plateNumber: '', vehicleType: 'truck_7ton', brand: '', model: '', year: '',
  capacityKg: '', capacityCbm: '', fuelType: 'diesel', trailerType: '',
  purchaseDate: '', purchasePrice: '', registrationExpiry: '', insuranceExpiry: '', notes: '',
};

const EMPTY_DRIVER = {
  firstName: '', lastName: '', email: '', phone: '', nationality: 'Saudi',
  idNumber: '', dateOfBirth: '', address: '', hireDate: '',
  emergencyContactName: '', emergencyContactPhone: '',
  licenseNumber: '', licenseType: 'heavy', licenseExpiry: '',
  medicalCertificateExpiry: '', yearsOfExperience: '0',
};

// ── Stars rating display ──
function Stars({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1,2,3,4,5].map(i => (
        <svg key={i} className={`w-3 h-3 ${i <= Math.round(rating) ? 'text-amber-400' : 'text-slate-700'}`} fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/></svg>
      ))}
      <span className="text-[10px] text-slate-500 ml-1">{Number(rating).toFixed(1)}</span>
    </div>
  );
}

export default function Fleet() {
  const { hasPermission } = useAuth();
  const canEdit = hasPermission(['super_admin', 'admin']);
  const location = useLocation();

  const [tab, setTab] = useState<'vehicles' | 'drivers'>(
    location.pathname.startsWith('/drivers') ? 'drivers' : 'vehicles'
  );

  // Vehicles state
  const [vehicles, setVehicles]         = useState<any[]>([]);
  const [vLoading, setVLoading]         = useState(true);
  const [vSearch, setVSearch]           = useState('');
  const [vStatus, setVStatus]           = useState('');
  const [showVForm, setShowVForm]       = useState(false);
  const [editVId, setEditVId]           = useState<number | null>(null);
  const [vForm, setVForm]               = useState({ ...EMPTY_VEHICLE });
  const [vSaving, setVSaving]           = useState(false);

  // Drivers state
  const [drivers, setDrivers]           = useState<any[]>([]);
  const [dLoading, setDLoading]         = useState(true);
  const [dSearch, setDSearch]           = useState('');
  const [dStatus, setDStatus]           = useState('');
  const [showDForm, setShowDForm]       = useState(false);
  const [editDId, setEditDId]           = useState<number | null>(null);
  const [dForm, setDForm]               = useState({ ...EMPTY_DRIVER });
  const [dSaving, setDSaving]           = useState(false);

  const loadVehicles = useCallback(async () => {
    setVLoading(true);
    try {
      const params: Record<string, string> = {};
      if (vSearch) params.search = vSearch;
      if (vStatus) params.status = vStatus;
      const res = await vehiclesApi.getAll(params);
      setVehicles(res.data || res);
    } catch { toast.error('Failed to load vehicles'); }
    finally { setVLoading(false); }
  }, [vSearch, vStatus]);

  const loadDrivers = useCallback(async () => {
    setDLoading(true);
    try {
      const params: Record<string, string> = {};
      if (dSearch) params.search = dSearch;
      if (dStatus) params.status = dStatus;
      const res = await driversApi.getAll(params);
      setDrivers(res.data || res);
    } catch { toast.error('Failed to load drivers'); }
    finally { setDLoading(false); }
  }, [dSearch, dStatus]);

  useEffect(() => { loadVehicles(); }, [loadVehicles]);
  useEffect(() => { loadDrivers(); }, [loadDrivers]);

  // Vehicle CRUD
  const openVCreate = () => { setVForm({ ...EMPTY_VEHICLE }); setEditVId(null); setShowVForm(true); };
  const openVEdit   = (v: any) => {
    setVForm({
      plateNumber: v.plate_number || '', vehicleType: v.vehicle_type || 'truck_7ton',
      brand: v.brand || '', model: v.model || '', year: v.year || '',
      capacityKg: v.capacity_kg || '', capacityCbm: v.capacity_cbm || '',
      fuelType: v.fuel_type || 'diesel', trailerType: v.trailer_type || '',
      purchaseDate: v.purchase_date?.split('T')[0] || '',
      purchasePrice: v.purchase_price || '',
      registrationExpiry: v.registration_expiry?.split('T')[0] || '',
      insuranceExpiry: v.insurance_expiry?.split('T')[0] || '',
      notes: v.notes || '',
    });
    setEditVId(v.id);
    setShowVForm(true);
  };
  const handleVSave = async () => {
    if (!vForm.plateNumber) return toast.error('Plate number is required');
    setVSaving(true);
    try {
      if (editVId) {
        await vehiclesApi.update(editVId, vForm);
        toast.success('Vehicle updated');
      } else {
        const res = await vehiclesApi.create(vForm);
        toast.success(`Vehicle ${res.vehicleCode || ''} created`);
      }
      setShowVForm(false);
      loadVehicles();
    } catch (e: any) { toast.error(e.message || 'Failed to save vehicle'); }
    finally { setVSaving(false); }
  };
  const handleVDelete = async (id: number) => {
    if (!confirm('Delete this vehicle?')) return;
    try { await vehiclesApi.delete(id); toast.success('Vehicle deleted'); loadVehicles(); }
    catch { toast.error('Cannot delete — vehicle may have active shipments'); }
  };

  // Driver CRUD
  const openDCreate = () => { setDForm({ ...EMPTY_DRIVER }); setEditDId(null); setShowDForm(true); };
  const openDEdit   = (d: any) => {
    setDForm({
      firstName: d.first_name || '', lastName: d.last_name || '',
      email: d.email || '', phone: d.phone || '', nationality: d.nationality || 'Saudi',
      idNumber: d.id_number || '', dateOfBirth: d.date_of_birth?.split('T')[0] || '',
      address: d.address || '', hireDate: d.hire_date?.split('T')[0] || '',
      emergencyContactName: d.emergency_contact_name || '',
      emergencyContactPhone: d.emergency_contact_phone || '',
      licenseNumber: d.license_number || '', licenseType: d.license_type || 'heavy',
      licenseExpiry: d.license_expiry?.split('T')[0] || '',
      medicalCertificateExpiry: d.medical_certificate_expiry?.split('T')[0] || '',
      yearsOfExperience: d.years_of_experience || '0',
    });
    setEditDId(d.id);
    setShowDForm(true);
  };
  const handleDSave = async () => {
    if (!dForm.firstName || !dForm.lastName) return toast.error('First and last name are required');
    if (!dForm.licenseNumber || !dForm.licenseExpiry) return toast.error('License number and expiry are required');
    setDSaving(true);
    try {
      if (editDId) {
        await driversApi.update(editDId, dForm);
        toast.success('Driver updated');
      } else {
        const res = await driversApi.create(dForm);
        toast.success(`Driver created`);
      }
      setShowDForm(false);
      loadDrivers();
    } catch (e: any) { toast.error(e.message || 'Failed to save driver'); }
    finally { setDSaving(false); }
  };
  const handleDDelete = async (id: number) => {
    if (!confirm('Delete this driver?')) return;
    try { await driversApi.delete(id); toast.success('Driver deleted'); loadDrivers(); }
    catch { toast.error('Cannot delete — driver may have active assignments'); }
  };

  const vf = (k: string, v: any) => setVForm(prev => ({ ...prev, [k]: v }));
  const df = (k: string, v: any) => setDForm(prev => ({ ...prev, [k]: v }));

  // Counts for tab badges
  const expiringVehicles = vehicles.filter(v => isExpiringSoon(v.registration_expiry) || isExpiringSoon(v.insurance_expiry)).length;
  const expiringDrivers  = drivers.filter(d => isExpiringSoon(d.license_expiry) || isExpired(d.license_expiry)).length;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Fleet</h1>
          <p className="text-xs text-slate-500 mt-0.5">{vehicles.length} vehicles · {drivers.length} drivers</p>
        </div>
        {canEdit && (
          <button onClick={tab === 'vehicles' ? openVCreate : openDCreate}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-lg transition-colors">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/></svg>
            {tab === 'vehicles' ? 'Add Vehicle' : 'Add Driver'}
          </button>
        )}
      </div>

      {/* Tab switcher */}
      <div className="flex gap-2">
        {(['vehicles','drivers'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg transition-colors capitalize ${
              tab === t ? 'bg-blue-600 text-white' : 'bg-[#1a1d27] text-slate-400 hover:text-white border border-white/5'
            }`}>
            {t}
            {t === 'vehicles' && expiringVehicles > 0 && <span className="bg-amber-500 text-black text-[10px] font-bold px-1.5 py-0.5 rounded-full">{expiringVehicles}</span>}
            {t === 'drivers'  && expiringDrivers  > 0 && <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">{expiringDrivers}</span>}
          </button>
        ))}
      </div>

      {/* ── VEHICLES TAB ── */}
      {tab === 'vehicles' && (
        <>
          <div className="flex items-center gap-3">
            <div className="relative flex-1 max-w-xs">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0"/></svg>
              <input value={vSearch} onChange={e => setVSearch(e.target.value)} placeholder="Search plate, brand, model..."
                className="w-full pl-9 pr-4 py-2 text-xs bg-[#1a1d27] border border-white/5 rounded-lg text-white placeholder-slate-600 focus:outline-none focus:border-blue-500/40" />
            </div>
            <select value={vStatus} onChange={e => setVStatus(e.target.value)}
              className="px-3 py-2 text-xs bg-[#1a1d27] border border-white/5 rounded-lg text-white focus:outline-none">
              <option value="">All statuses</option>
              {['active','maintenance','retired','sold','accident'].map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase()+s.slice(1)}</option>)}
            </select>
          </div>

          <div className="bg-[#1a1d27] rounded-xl border border-white/5 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-white/5">
                    {['Code','Plate','Type','Brand / Model','Year','Capacity','Driver','Reg. Expiry','Ins. Expiry','Status',''].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-[11px] font-medium text-slate-500 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {vLoading ? (
                    <tr><td colSpan={11} className="px-4 py-12 text-center text-slate-500">Loading...</td></tr>
                  ) : vehicles.length === 0 ? (
                    <tr><td colSpan={11} className="px-4 py-12 text-center text-slate-500">No vehicles found</td></tr>
                  ) : vehicles.map(v => {
                    const regWarn = isExpired(v.registration_expiry) ? 'text-red-400' : isExpiringSoon(v.registration_expiry) ? 'text-amber-400' : 'text-slate-400';
                    const insWarn = isExpired(v.insurance_expiry)    ? 'text-red-400' : isExpiringSoon(v.insurance_expiry)    ? 'text-amber-400' : 'text-slate-400';
                    return (
                      <tr key={v.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                        <td className="px-4 py-3 font-mono text-slate-400 text-[11px]">{v.vehicle_code}</td>
                        <td className="px-4 py-3 font-bold text-white">{v.plate_number}</td>
                        <td className="px-4 py-3 text-slate-400">{v.vehicle_type?.replace('_', ' ')}</td>
                        <td className="px-4 py-3 text-slate-300">{v.brand} {v.model}</td>
                        <td className="px-4 py-3 text-slate-400">{v.year || '—'}</td>
                        <td className="px-4 py-3 text-slate-400">{v.capacity_kg ? `${Number(v.capacity_kg).toLocaleString()} kg` : '—'}</td>
                        <td className="px-4 py-3 text-slate-300">{v.driver_name || <span className="text-slate-600">Unassigned</span>}</td>
                        <td className={`px-4 py-3 ${regWarn} whitespace-nowrap`}>{fmtDate(v.registration_expiry)}</td>
                        <td className={`px-4 py-3 ${insWarn} whitespace-nowrap`}>{fmtDate(v.insurance_expiry)}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${VEHICLE_STATUS[v.status] || ''}`}>{v.status}</span>
                        </td>
                        <td className="px-4 py-3">
                          {canEdit && (
                            <div className="flex items-center gap-2">
                              <button onClick={() => openVEdit(v)} className="text-[11px] text-slate-400 hover:text-white transition-colors">Edit</button>
                              <button onClick={() => handleVDelete(v.id)} className="text-[11px] text-red-400/60 hover:text-red-400 transition-colors">Del</button>
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
        </>
      )}

      {/* ── DRIVERS TAB ── */}
      {tab === 'drivers' && (
        <>
          <div className="flex items-center gap-3">
            <div className="relative flex-1 max-w-xs">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0"/></svg>
              <input value={dSearch} onChange={e => setDSearch(e.target.value)} placeholder="Search name, license..."
                className="w-full pl-9 pr-4 py-2 text-xs bg-[#1a1d27] border border-white/5 rounded-lg text-white placeholder-slate-600 focus:outline-none focus:border-blue-500/40" />
            </div>
            <select value={dStatus} onChange={e => setDStatus(e.target.value)}
              className="px-3 py-2 text-xs bg-[#1a1d27] border border-white/5 rounded-lg text-white focus:outline-none">
              <option value="">All statuses</option>
              {['available','on_trip','on_leave','suspended','off_duty'].map(s => <option key={s} value={s}>{s.replace('_',' ')}</option>)}
            </select>
          </div>

          <div className="bg-[#1a1d27] rounded-xl border border-white/5 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-white/5">
                    {['Name','License #','Type','Expiry','Medical Exp.','Experience','Trips','Rating','Vehicle','Status',''].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-[11px] font-medium text-slate-500 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {dLoading ? (
                    <tr><td colSpan={11} className="px-4 py-12 text-center text-slate-500">Loading...</td></tr>
                  ) : drivers.length === 0 ? (
                    <tr><td colSpan={11} className="px-4 py-12 text-center text-slate-500">No drivers found</td></tr>
                  ) : drivers.map(d => {
                    const licWarn = isExpired(d.license_expiry) ? 'text-red-400' : isExpiringSoon(d.license_expiry) ? 'text-amber-400' : 'text-slate-400';
                    const medWarn = isExpired(d.medical_certificate_expiry) ? 'text-red-400' : isExpiringSoon(d.medical_certificate_expiry) ? 'text-amber-400' : 'text-slate-400';
                    return (
                      <tr key={d.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                        <td className="px-4 py-3 font-semibold text-white whitespace-nowrap">{d.first_name} {d.last_name}</td>
                        <td className="px-4 py-3 font-mono text-slate-400">{d.license_number}</td>
                        <td className="px-4 py-3 text-slate-400 capitalize">{d.license_type}</td>
                        <td className={`px-4 py-3 whitespace-nowrap ${licWarn}`}>{fmtDate(d.license_expiry)}</td>
                        <td className={`px-4 py-3 whitespace-nowrap ${medWarn}`}>{fmtDate(d.medical_certificate_expiry)}</td>
                        <td className="px-4 py-3 text-slate-400">{d.years_of_experience || 0} yrs</td>
                        <td className="px-4 py-3 text-white">{d.total_trips || 0}</td>
                        <td className="px-4 py-3"><Stars rating={d.rating || 5} /></td>
                        <td className="px-4 py-3 text-slate-300">{d.assigned_vehicle_plate || <span className="text-slate-600">None</span>}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${DRIVER_STATUS[d.driver_status] || ''}`}>{d.driver_status?.replace('_',' ')}</span>
                        </td>
                        <td className="px-4 py-3">
                          {canEdit && (
                            <div className="flex items-center gap-2">
                              <button onClick={() => openDEdit(d)} className="text-[11px] text-slate-400 hover:text-white transition-colors">Edit</button>
                              <button onClick={() => handleDDelete(d.id)} className="text-[11px] text-red-400/60 hover:text-red-400 transition-colors">Del</button>
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
        </>
      )}

      {/* ── VEHICLE FORM MODAL ── */}
      {showVForm && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-start justify-center pt-6 pb-4 px-4 overflow-y-auto">
          <div className="w-full max-w-2xl bg-[#1a1d27] rounded-2xl border border-white/10 shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
              <h2 className="text-sm font-bold text-white">{editVId ? 'Edit Vehicle' : 'Add Vehicle'}</h2>
              <button onClick={() => setShowVForm(false)} className="p-1 text-slate-400 hover:text-white">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <FIn label="Plate Number" required value={vForm.plateNumber} onChange={(e: any) => vf('plateNumber', e.target.value)} placeholder="e.g. KSA-1234" />
                <FSel label="Vehicle Type" value={vForm.vehicleType} onChange={(e: any) => vf('vehicleType', e.target.value)}>
                  {['truck_3ton','truck_7ton','truck_10ton','truck_20ton','trailer','van','pickup'].map(t => <option key={t} value={t}>{t.replace('_',' ')}</option>)}
                </FSel>
                <FIn label="Brand" value={vForm.brand} onChange={(e: any) => vf('brand', e.target.value)} placeholder="e.g. Mercedes" />
                <FIn label="Model" value={vForm.model} onChange={(e: any) => vf('model', e.target.value)} placeholder="e.g. Actros 1845" />
                <FIn label="Year" type="number" value={vForm.year} onChange={(e: any) => vf('year', e.target.value)} placeholder="e.g. 2023" />
                <FSel label="Fuel Type" value={vForm.fuelType} onChange={(e: any) => vf('fuelType', e.target.value)}>
                  {['diesel','petrol','hybrid','electric'].map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase()+t.slice(1)}</option>)}
                </FSel>
                <FIn label="Capacity (kg)" type="number" value={vForm.capacityKg} onChange={(e: any) => vf('capacityKg', e.target.value)} placeholder="e.g. 7000" />
                <FIn label="Capacity (CBM)" type="number" value={vForm.capacityCbm} onChange={(e: any) => vf('capacityCbm', e.target.value)} placeholder="e.g. 35" />
                <FIn label="Trailer Type" value={vForm.trailerType} onChange={(e: any) => vf('trailerType', e.target.value)} placeholder="e.g. flatbed, curtainside" />
                <FIn label="Purchase Price (SAR)" type="number" value={vForm.purchasePrice} onChange={(e: any) => vf('purchasePrice', e.target.value)} />
                <FDate label="Purchase Date" value={vForm.purchaseDate} onChange={(e: any) => vf('purchaseDate', e.target.value)} />
                <FDate label="Registration Expiry" value={vForm.registrationExpiry} onChange={(e: any) => vf('registrationExpiry', e.target.value)} />
                <FDate label="Insurance Expiry" value={vForm.insuranceExpiry} onChange={(e: any) => vf('insuranceExpiry', e.target.value)} />
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-white/5">
              <button onClick={() => setShowVForm(false)} className="px-4 py-2 text-xs text-slate-400 hover:text-white transition-colors">Cancel</button>
              <button onClick={handleVSave} disabled={vSaving}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-semibold rounded-lg transition-colors">
                {vSaving ? 'Saving...' : editVId ? 'Save Changes' : 'Add Vehicle'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── DRIVER FORM MODAL ── */}
      {showDForm && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-start justify-center pt-6 pb-4 px-4 overflow-y-auto">
          <div className="w-full max-w-2xl bg-[#1a1d27] rounded-2xl border border-white/10 shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
              <h2 className="text-sm font-bold text-white">{editDId ? 'Edit Driver' : 'Add Driver'}</h2>
              <button onClick={() => setShowDForm(false)} className="p-1 text-slate-400 hover:text-white">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
              </button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Personal Details</p>
              <div className="grid grid-cols-2 gap-3">
                <FIn label="First Name" required value={dForm.firstName} onChange={(e: any) => df('firstName', e.target.value)} />
                <FIn label="Last Name" required value={dForm.lastName} onChange={(e: any) => df('lastName', e.target.value)} />
                <FIn label="Email" type="email" value={dForm.email} onChange={(e: any) => df('email', e.target.value)} />
                <FIn label="Phone" value={dForm.phone} onChange={(e: any) => df('phone', e.target.value)} />
                <FIn label="Nationality" value={dForm.nationality} onChange={(e: any) => df('nationality', e.target.value)} />
                <FIn label="ID / Iqama Number" value={dForm.idNumber} onChange={(e: any) => df('idNumber', e.target.value)} />
                <FDate label="Date of Birth" value={dForm.dateOfBirth} onChange={(e: any) => df('dateOfBirth', e.target.value)} />
                <FDate label="Hire Date" value={dForm.hireDate} onChange={(e: any) => df('hireDate', e.target.value)} />
                <div className="col-span-2"><FIn label="Address" value={dForm.address} onChange={(e: any) => df('address', e.target.value)} /></div>
                <FIn label="Emergency Contact Name" value={dForm.emergencyContactName} onChange={(e: any) => df('emergencyContactName', e.target.value)} />
                <FIn label="Emergency Contact Phone" value={dForm.emergencyContactPhone} onChange={(e: any) => df('emergencyContactPhone', e.target.value)} />
              </div>
              <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mt-2">License Details</p>
              <div className="grid grid-cols-2 gap-3">
                <FIn label="License Number" required value={dForm.licenseNumber} onChange={(e: any) => df('licenseNumber', e.target.value)} />
                <FSel label="License Type" value={dForm.licenseType} onChange={(e: any) => df('licenseType', e.target.value)}>
                  {['light','heavy','trailer','motorcycle'].map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase()+t.slice(1)}</option>)}
                </FSel>
                <FDate label="License Expiry" value={dForm.licenseExpiry} onChange={(e: any) => df('licenseExpiry', e.target.value)} />
                <FDate label="Medical Certificate Expiry" value={dForm.medicalCertificateExpiry} onChange={(e: any) => df('medicalCertificateExpiry', e.target.value)} />
                <FIn label="Years of Experience" type="number" min="0" value={dForm.yearsOfExperience} onChange={(e: any) => df('yearsOfExperience', e.target.value)} />
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-white/5">
              <button onClick={() => setShowDForm(false)} className="px-4 py-2 text-xs text-slate-400 hover:text-white transition-colors">Cancel</button>
              <button onClick={handleDSave} disabled={dSaving}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-semibold rounded-lg transition-colors">
                {dSaving ? 'Saving...' : editDId ? 'Save Changes' : 'Add Driver'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
