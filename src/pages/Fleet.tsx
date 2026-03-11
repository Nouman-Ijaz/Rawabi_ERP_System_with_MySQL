import { useEffect, useState, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { vehiclesApi, driversApi } from '@/lib/api';
import { toast } from 'sonner';
import { ROLES } from '@/lib/roles';

import { fmtDate } from '@/lib/format';
const isExpiringSoon = (d: string) => {
  if (!d) return false;
  const n = Math.ceil((new Date(d).getTime() - Date.now()) / 86400000);
  return n >= 0 && n <= 30;
};
const isExpired = (d: string) => !!d && new Date(d) < new Date();

import { VEHICLE_STATUS, DRIVER_STATUS } from '@/lib/statusStyles';

import { fSel } from '@/lib/cx';

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
        className="w-full px-3 py-2 text-xs bg-[#0f1117] border border-white/10 rounded-lg text-white focus:outline-none focus:border-blue-500/50" />
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

function StarPicker({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [hover, setHover] = useState(0);
  return (
    <div className="flex items-center gap-1">
      {[1,2,3,4,5].map(i => (
        <button key={i} type="button"
          onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(0)} onClick={() => onChange(i)}
          className="transition-transform hover:scale-110">
          <svg className={`w-7 h-7 ${i <= (hover || value) ? 'text-amber-400' : 'text-slate-700'}`} fill="currentColor" viewBox="0 0 20 20">
            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/>
          </svg>
        </button>
      ))}
      <span className="text-sm font-bold text-white ml-2">{value}.0</span>
    </div>
  );
}

function Stars({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1,2,3,4,5].map(i => (
        <svg key={i} className={`w-3 h-3 ${i <= Math.round(rating) ? 'text-amber-400' : 'text-slate-700'}`} fill="currentColor" viewBox="0 0 20 20">
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/>
        </svg>
      ))}
      <span className="text-[10px] text-slate-500 ml-1">{Number(rating).toFixed(1)}</span>
    </div>
  );
}

const EMPTY_VEHICLE = {
  plateNumber:'',vehicleType:'truck_7ton',brand:'',model:'',year:'',
  capacityKg:'',capacityCbm:'',fuelType:'diesel',trailerType:'',
  purchaseDate:'',purchasePrice:'',registrationExpiry:'',insuranceExpiry:'',notes:'',
  status:'active',
};
const EMPTY_DRIVER = {
  firstName:'',lastName:'',email:'',phone:'',nationality:'Saudi',
  idNumber:'',dateOfBirth:'',address:'',hireDate:'',
  emergencyContactName:'',emergencyContactPhone:'',
  licenseNumber:'',licenseType:'heavy',licenseExpiry:'',
  medicalCertificateExpiry:'',yearsOfExperience:'0',
  status:'available',
};

export default function Fleet() {
  const { hasPermission } = useAuth();
  const canEdit = hasPermission(ROLES.ADMIN_UP);
  const location = useLocation();
  const navigate = useNavigate();
  const [tab, setTab] = useState<'vehicles'|'drivers'>(location.pathname.endsWith('/drivers') ? 'drivers' : 'vehicles');
  useEffect(() => { setTab(location.pathname.endsWith('/drivers') ? 'drivers' : 'vehicles'); }, [location.pathname]);

  // Vehicle state
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [vLoading, setVLoading] = useState(true);
  const [vSearch, setVSearch] = useState('');
  const [vStatus, setVStatus] = useState('');
  const [vType, setVType] = useState('');
  const [vFuel, setVFuel] = useState('');
  const [vDriver, setVDriver] = useState('');
  const [vExpiry, setVExpiry] = useState('');
  const [vSort, setVSort] = useState('created_at');
  const [showVForm, setShowVForm] = useState(false);
  const [editVId, setEditVId] = useState<number|null>(null);
  const [vForm, setVForm] = useState({...EMPTY_VEHICLE});
  const [vSaving, setVSaving] = useState(false);

  // Driver state
  const [drivers, setDrivers] = useState<any[]>([]);
  const [dLoading, setDLoading] = useState(true);
  const [dSearch, setDSearch] = useState('');
  const [dStatus, setDStatus] = useState('');
  const [dLicType, setDLicType] = useState('');
  const [dAssign, setDAssign] = useState('');
  const [dRating, setDRating] = useState('');
  const [dSort, setDSort] = useState('');
  const [showDForm, setShowDForm] = useState(false);
  const [editDId, setEditDId] = useState<number|null>(null);
  const [dForm, setDForm] = useState({...EMPTY_DRIVER});
  const [dSaving, setDSaving] = useState(false);

  // Rating modal
  const [rateTarget, setRateTarget] = useState<any|null>(null);
  const [rateVal, setRateVal] = useState(5);
  const [rateNotes, setRateNotes] = useState('');
  const [rateSaving, setRateSaving] = useState(false);

  const loadVehicles = useCallback(async () => {
    setVLoading(true);
    try {
      const p: Record<string,string> = {};
      if (vSearch) p.search = vSearch;
      if (vStatus) p.status = vStatus;
      if (vType)   p.type   = vType;
      if (vFuel)   p.fuelType = vFuel;
      if (vDriver) p.driverAssignment = vDriver;
      if (vExpiry) p.expiryAlert = vExpiry;
      if (vSort)   p.sort   = vSort;
      const res = await vehiclesApi.getAll(p);
      setVehicles(res.data || res);
    } catch { toast.error('Failed to load vehicles'); }
    finally { setVLoading(false); }
  }, [vSearch,vStatus,vType,vFuel,vDriver,vExpiry,vSort]);

  const loadDrivers = useCallback(async () => {
    setDLoading(true);
    try {
      const p: Record<string,string> = {};
      if (dSearch)  p.search = dSearch;
      if (dStatus)  p.status = dStatus;
      if (dLicType) p.licenseType = dLicType;
      if (dAssign)  p.vehicleAssignment = dAssign;
      if (dRating)  p.rating = dRating;
      if (dSort === 'trips_desc')     p.sortTrips = 'desc';
      else if (dSort === 'trips_asc') p.sortTrips = 'asc';
      else if (dSort === 'exp_desc')  p.sortExperience = 'desc';
      else if (dSort === 'exp_asc')   p.sortExperience = 'asc';
      const res = await driversApi.getAll(p);
      setDrivers(res.data || res);
    } catch { toast.error('Failed to load drivers'); }
    finally { setDLoading(false); }
  }, [dSearch,dStatus,dLicType,dAssign,dRating,dSort]);

  useEffect(() => { loadVehicles(); }, [loadVehicles]);
  useEffect(() => { loadDrivers(); },  [loadDrivers]);

  const openVCreate = () => { setVForm({...EMPTY_VEHICLE}); setEditVId(null); setShowVForm(true); };
  const openVEdit = (v: any) => {
    setVForm({ plateNumber:v.plate_number||'', vehicleType:v.vehicle_type||'truck_7ton', brand:v.brand||'', model:v.model||'',
      year:v.year||'', capacityKg:v.capacity_kg||'', capacityCbm:v.capacity_cbm||'', fuelType:v.fuel_type||'diesel',
      trailerType:v.trailer_type||'', purchaseDate:v.purchase_date?.split('T')[0]||'', purchasePrice:v.purchase_price||'',
      registrationExpiry:v.registration_expiry?.split('T')[0]||'', insuranceExpiry:v.insurance_expiry?.split('T')[0]||'',
      notes:v.notes||'', status:v.status||'active' });
    setEditVId(v.id); setShowVForm(true);
  };
  const handleVSave = async () => {
    if (!vForm.plateNumber) return toast.error('Plate number is required');
    setVSaving(true);
    try {
      editVId ? await vehiclesApi.update(editVId,vForm) : await vehiclesApi.create(vForm);
      toast.success(editVId ? 'Vehicle updated' : 'Vehicle created');
      setShowVForm(false); loadVehicles();
    } catch (e:any) { toast.error(e.message||'Failed to save vehicle'); }
    finally { setVSaving(false); }
  };
  const handleVDelete = async (id:number) => {
    if (!confirm('Delete this vehicle?')) return;
    try { await vehiclesApi.delete(id); toast.success('Deleted'); loadVehicles(); }
    catch { toast.error('Cannot delete — may have active shipments'); }
  };

  const openDCreate = () => { setDForm({...EMPTY_DRIVER}); setEditDId(null); setShowDForm(true); };
  const openDEdit = (d: any) => {
    setDForm({ firstName:d.first_name||'', lastName:d.last_name||'', email:d.email||'', phone:d.phone||'',
      nationality:d.nationality||'Saudi', idNumber:d.id_number||'', dateOfBirth:d.date_of_birth?.split('T')[0]||'',
      address:d.address||'', hireDate:d.hire_date?.split('T')[0]||'', emergencyContactName:d.emergency_contact_name||'',
      emergencyContactPhone:d.emergency_contact_phone||'', licenseNumber:d.license_number||'', licenseType:d.license_type||'heavy',
      licenseExpiry:d.license_expiry?.split('T')[0]||'', medicalCertificateExpiry:d.medical_certificate_expiry?.split('T')[0]||'',
      yearsOfExperience:d.years_of_experience||'0', status:d.driver_status||'available' });
    setEditDId(d.id); setShowDForm(true);
  };
  const handleDSave = async () => {
    if (!dForm.firstName||!dForm.lastName) return toast.error('First and last name required');
    if (!dForm.licenseNumber||!dForm.licenseExpiry) return toast.error('License number and expiry required');
    setDSaving(true);
    try {
      editDId ? await driversApi.update(editDId,dForm) : await driversApi.create(dForm);
      toast.success(editDId ? 'Driver updated' : 'Driver created');
      setShowDForm(false); loadDrivers();
    } catch (e:any) { toast.error(e.message||'Failed to save driver'); }
    finally { setDSaving(false); }
  };
  const handleDDelete = async (id:number) => {
    if (!confirm('Delete this driver?')) return;
    try { await driversApi.delete(id); toast.success('Deleted'); loadDrivers(); }
    catch { toast.error('Cannot delete — may have active assignments'); }
  };

  const openRating = (d: any) => { setRateTarget(d); setRateVal(Math.round(parseFloat(d.rating)||5)); setRateNotes(''); };
  const saveRating = async () => {
    if (!rateTarget) return;
    setRateSaving(true);
    try {
      await driversApi.updateRating(rateTarget.id, rateVal, rateNotes);
      toast.success('Rating updated');
      setRateTarget(null); loadDrivers();
    } catch (e:any) { toast.error(e.message||'Failed to update rating'); }
    finally { setRateSaving(false); }
  };

  const vf = (k:string,v:any) => setVForm(p=>({...p,[k]:v}));
  const df = (k:string,v:any) => setDForm(p=>({...p,[k]:v}));

  const expiringV = vehicles.filter(v=>isExpiringSoon(v.registration_expiry)||isExpiringSoon(v.insurance_expiry)).length;
  const expiringD = drivers.filter(d=>isExpiringSoon(d.license_expiry)||isExpired(d.license_expiry)).length;
  const vFiltered = !!(vSearch||vStatus||vType||vFuel||vDriver||vExpiry||vSort!=='created_at');
  const dFiltered = !!(dSearch||dStatus||dLicType||dAssign||dRating||dSort);

  const rateLabel = (v:number) => v>=5?'Excellent':v>=4?'Good':v>=3?'Average':v>=2?'Below Average':'Poor';

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Fleet</h1>
          <p className="text-xs text-slate-500 mt-0.5">{vehicles.length} vehicles · {drivers.length} drivers</p>
        </div>
        {canEdit && (
          <button onClick={tab==='vehicles'?openVCreate:openDCreate}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-lg transition-colors">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/></svg>
            {tab==='vehicles'?'Add Vehicle':'Add Driver'}
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        {(['vehicles','drivers'] as const).map(t=>(
          <button key={t} onClick={()=>navigate(`/fleet/${t}`)}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg transition-colors capitalize ${tab===t?'bg-blue-600 text-white':'bg-[#1a1d27] text-slate-400 hover:text-white border border-white/5'}`}>
            {t}
            {t==='vehicles'&&expiringV>0&&<span className="bg-amber-500 text-black text-[10px] font-bold px-1.5 py-0.5 rounded-full">{expiringV}</span>}
            {t==='drivers' &&expiringD>0&&<span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">{expiringD}</span>}
          </button>
        ))}
      </div>

      {/* ── VEHICLES ── */}
      {tab==='vehicles'&&(
        <>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0"/></svg>
              <input value={vSearch} onChange={e=>setVSearch(e.target.value)} placeholder="Plate, brand, model…"
                className="pl-9 pr-4 py-2 w-48 text-xs bg-[#1a1d27] border border-white/5 rounded-lg text-white placeholder-slate-600 focus:outline-none focus:border-blue-500/40"/>
            </div>
            <select value={vStatus} onChange={e=>setVStatus(e.target.value)} className={fSel}>
              <option value="">All Statuses</option>
              {['active','maintenance','retired','sold','accident'].map(s=><option key={s} value={s}>{s.charAt(0).toUpperCase()+s.slice(1)}</option>)}
            </select>
            <select value={vType} onChange={e=>setVType(e.target.value)} className={fSel}>
              <option value="">All Types</option>
              {['truck_3ton','truck_7ton','truck_10ton','truck_20ton','trailer','van','pickup'].map(t=><option key={t} value={t}>{t.replace(/_/g,' ')}</option>)}
            </select>
            <select value={vFuel} onChange={e=>setVFuel(e.target.value)} className={fSel}>
              <option value="">All Fuels</option>
              {['diesel','petrol','hybrid','electric'].map(f=><option key={f} value={f}>{f.charAt(0).toUpperCase()+f.slice(1)}</option>)}
            </select>
            <select value={vDriver} onChange={e=>setVDriver(e.target.value)} className={fSel}>
              <option value="">All Assignments</option>
              <option value="assigned">Has Driver</option>
              <option value="unassigned">No Driver</option>
            </select>
            <select value={vExpiry} onChange={e=>setVExpiry(e.target.value)} className={fSel}>
              <option value="">All Expiry</option>
              <option value="expiring">Expiring ≤ 30 days</option>
              <option value="expired">Already Expired</option>
            </select>
            <select value={vSort} onChange={e=>setVSort(e.target.value)} className={fSel}>
              <option value="created_at">Newest First</option>
              <option value="plate_asc">Plate A→Z</option>
              <option value="year_desc">Year: Newest</option>
              <option value="year_asc">Year: Oldest</option>
              <option value="capacity_desc">Capacity: High→Low</option>
              <option value="registration_expiry">Reg. Expiry Soonest</option>
              <option value="insurance_expiry">Ins. Expiry Soonest</option>
            </select>
            {vFiltered&&<button onClick={()=>{setVSearch('');setVStatus('');setVType('');setVFuel('');setVDriver('');setVExpiry('');setVSort('created_at');}} className="px-3 py-2 text-xs text-slate-400 hover:text-white border border-white/5 rounded-lg bg-[#1a1d27] transition-colors">Clear</button>}
          </div>

          <div className="bg-[#1a1d27] rounded-xl border border-white/5 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead><tr className="border-b border-white/5">
                  {['Code','Plate','Type','Brand / Model','Year','Fuel','Capacity','Driver','Reg. Expiry','Ins. Expiry','Status','Actions'].map(h=>(
                    <th key={h} className="px-4 py-3 text-left text-[11px] font-medium text-slate-500 whitespace-nowrap">{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {vLoading?(<tr><td colSpan={12} className="px-4 py-12 text-center text-slate-500">Loading…</td></tr>)
                  :vehicles.length===0?(<tr><td colSpan={12} className="px-4 py-12 text-center text-slate-500">No vehicles found</td></tr>)
                  :vehicles.map(v=>{
                    const rw=isExpired(v.registration_expiry)?'text-red-400':isExpiringSoon(v.registration_expiry)?'text-amber-400':'text-slate-400';
                    const iw=isExpired(v.insurance_expiry)?'text-red-400':isExpiringSoon(v.insurance_expiry)?'text-amber-400':'text-slate-400';
                    return (
                      <tr key={v.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                        <td className="px-4 py-3 font-mono text-slate-400 text-[11px]">{v.vehicle_code}</td>
                        <td className="px-4 py-3 font-bold text-white">{v.plate_number}</td>
                        <td className="px-4 py-3 text-slate-400 capitalize">{v.vehicle_type?.replace(/_/g,' ')}</td>
                        <td className="px-4 py-3 text-slate-300">{v.brand} {v.model}</td>
                        <td className="px-4 py-3 text-slate-400">{v.year||'—'}</td>
                        <td className="px-4 py-3 text-slate-400 capitalize">{v.fuel_type||'—'}</td>
                        <td className="px-4 py-3 text-slate-400">{v.capacity_kg?`${Number(v.capacity_kg).toLocaleString()} kg`:'—'}</td>
                        <td className="px-4 py-3 text-slate-300">{v.driver_name||<span className="text-slate-600">Unassigned</span>}</td>
                        <td className={`px-4 py-3 ${rw} whitespace-nowrap`}>{fmtDate(v.registration_expiry)}</td>
                        <td className={`px-4 py-3 ${iw} whitespace-nowrap`}>{fmtDate(v.insurance_expiry)}</td>
                        <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${VEHICLE_STATUS[v.status]||''}`}>{v.status}</span></td>
                        <td className="px-4 py-3">{canEdit&&<div className="flex gap-2"><button onClick={()=>openVEdit(v)} className="text-[11px] text-slate-400 hover:text-white transition-colors">Edit</button><button onClick={()=>handleVDelete(v.id)} className="text-[11px] text-red-400/60 hover:text-red-400 transition-colors">Del</button></div>}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* ── DRIVERS ── */}
      {tab==='drivers'&&(
        <>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0"/></svg>
              <input value={dSearch} onChange={e=>setDSearch(e.target.value)} placeholder="Name, license…"
                className="pl-9 pr-4 py-2 w-48 text-xs bg-[#1a1d27] border border-white/5 rounded-lg text-white placeholder-slate-600 focus:outline-none focus:border-blue-500/40"/>
            </div>
            <select value={dStatus} onChange={e=>setDStatus(e.target.value)} className={fSel}>
              <option value="">All Statuses</option>
              {['available','on_trip','on_leave','suspended','off_duty'].map(s=><option key={s} value={s}>{s.replace(/_/g,' ')}</option>)}
            </select>
            <select value={dLicType} onChange={e=>setDLicType(e.target.value)} className={fSel}>
              <option value="">All License Types</option>
              {['light','heavy','trailer','motorcycle'].map(t=><option key={t} value={t}>{t.charAt(0).toUpperCase()+t.slice(1)}</option>)}
            </select>
            <select value={dAssign} onChange={e=>setDAssign(e.target.value)} className={fSel}>
              <option value="">All Assignments</option>
              <option value="assigned">Has Vehicle</option>
              <option value="unassigned">No Vehicle</option>
            </select>
            <select value={dRating} onChange={e=>setDRating(e.target.value)} className={fSel}>
              <option value="">All Ratings</option>
              <option value="elite">⭐ Elite (4.5–5.0)</option>
              <option value="good">Good (3.5–4.4)</option>
              <option value="average">Average (2.5–3.4)</option>
              <option value="poor">Poor (&lt;2.5)</option>
            </select>
            <select value={dSort} onChange={e=>setDSort(e.target.value)} className={fSel}>
              <option value="">Default Sort</option>
              <option value="trips_desc">Most Trips First</option>
              <option value="trips_asc">Fewest Trips First</option>
              <option value="exp_desc">Most Experienced</option>
              <option value="exp_asc">Least Experienced</option>
            </select>
            {dFiltered&&<button onClick={()=>{setDSearch('');setDStatus('');setDLicType('');setDAssign('');setDRating('');setDSort('');}} className="px-3 py-2 text-xs text-slate-400 hover:text-white border border-white/5 rounded-lg bg-[#1a1d27] transition-colors">Clear</button>}
          </div>

          <div className="bg-[#1a1d27] rounded-xl border border-white/5 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead><tr className="border-b border-white/5">
                  {['Name','License #','Type','Lic. Expiry','Medical Exp.','Experience','Trips','Rating','Vehicle','Status','Actions'].map(h=>(
                    <th key={h} className="px-4 py-3 text-left text-[11px] font-medium text-slate-500 whitespace-nowrap">{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {dLoading?(<tr><td colSpan={11} className="px-4 py-12 text-center text-slate-500">Loading…</td></tr>)
                  :drivers.length===0?(<tr><td colSpan={11} className="px-4 py-12 text-center text-slate-500">No drivers found</td></tr>)
                  :drivers.map(d=>{
                    const lw=isExpired(d.license_expiry)?'text-red-400':isExpiringSoon(d.license_expiry)?'text-amber-400':'text-slate-400';
                    const mw=isExpired(d.medical_certificate_expiry)?'text-red-400':isExpiringSoon(d.medical_certificate_expiry)?'text-amber-400':'text-slate-400';
                    return (
                      <tr key={d.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                        <td className="px-4 py-3 font-semibold text-white whitespace-nowrap">{d.first_name} {d.last_name}</td>
                        <td className="px-4 py-3 font-mono text-slate-400">{d.license_number}</td>
                        <td className="px-4 py-3 text-slate-400 capitalize">{d.license_type}</td>
                        <td className={`px-4 py-3 whitespace-nowrap ${lw}`}>{fmtDate(d.license_expiry)}</td>
                        <td className={`px-4 py-3 whitespace-nowrap ${mw}`}>{fmtDate(d.medical_certificate_expiry)}</td>
                        <td className="px-4 py-3 text-slate-400">{d.years_of_experience||0} yrs</td>
                        <td className="px-4 py-3 text-white">{d.total_trips||0}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5">
                            <Stars rating={d.rating||5}/>
                            {canEdit&&(
                              <button onClick={()=>openRating(d)} title="Edit rating"
                                className="p-0.5 text-slate-600 hover:text-amber-400 transition-colors">
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                              </button>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-slate-300">{d.assigned_vehicle_plate||<span className="text-slate-600">None</span>}</td>
                        <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${DRIVER_STATUS[d.driver_status]||''}`}>{d.driver_status?.replace(/_/g,' ')}</span></td>
                        <td className="px-4 py-3">{canEdit&&<div className="flex gap-2"><button onClick={()=>openDEdit(d)} className="text-[11px] text-slate-400 hover:text-white transition-colors">Edit</button><button onClick={()=>handleDDelete(d.id)} className="text-[11px] text-red-400/60 hover:text-red-400 transition-colors">Del</button></div>}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* ── RATING MODAL ── */}
      {rateTarget&&(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={()=>setRateTarget(null)}/>
          <div className="relative w-full max-w-sm bg-[#0d0f14] rounded-2xl border border-white/10 shadow-2xl p-6">
            <h2 className="text-sm font-semibold text-white mb-0.5">Edit Driver Rating</h2>
            <p className="text-[11px] text-slate-500 mb-5">{rateTarget.first_name} {rateTarget.last_name} · Current: {Number(rateTarget.rating||5).toFixed(1)}</p>
            <div className="mb-2">
              <label className="block text-[11px] text-slate-400 mb-3">New Rating</label>
              <StarPicker value={rateVal} onChange={setRateVal}/>
            </div>
            <p className="text-[11px] text-slate-500 mb-4">{rateLabel(rateVal)}</p>
            <div className="mb-5">
              <label className="block text-[11px] text-slate-400 mb-1">Notes (optional)</label>
              <textarea value={rateNotes} onChange={e=>setRateNotes(e.target.value)} rows={2}
                placeholder="Reason for rating change…"
                className="w-full px-3 py-2 text-xs bg-[#0c0e13] border border-white/10 rounded-lg text-white placeholder-slate-600 focus:outline-none focus:border-amber-500/50 resize-none"/>
            </div>
            <div className="flex gap-3">
              <button onClick={()=>setRateTarget(null)} className="flex-1 py-2 text-xs border border-white/10 rounded-lg text-slate-400 hover:text-white transition-colors">Cancel</button>
              <button onClick={saveRating} disabled={rateSaving}
                className="flex-1 py-2 text-xs font-medium bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-black rounded-lg transition-colors">
                {rateSaving?'Saving…':'Save Rating'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── VEHICLE FORM MODAL ── */}
      {showVForm&&(
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-start justify-center pt-6 pb-4 px-4 overflow-y-auto">
          <div className="w-full max-w-2xl bg-[#1a1d27] rounded-2xl border border-white/10 shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
              <h2 className="text-sm font-bold text-white">{editVId?'Edit Vehicle':'Add Vehicle'}</h2>
              <button onClick={()=>setShowVForm(false)} className="p-1 text-slate-400 hover:text-white">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <FIn label="Plate Number" required value={vForm.plateNumber} onChange={(e:any)=>vf('plateNumber',e.target.value)} placeholder="e.g. KSA-1234"/>
                <FSel label="Vehicle Type" value={vForm.vehicleType} onChange={(e:any)=>vf('vehicleType',e.target.value)}>
                  {['truck_3ton','truck_7ton','truck_10ton','truck_20ton','trailer','van','pickup'].map(t=><option key={t} value={t}>{t.replace(/_/g,' ')}</option>)}
                </FSel>
                <FIn label="Brand" value={vForm.brand} onChange={(e:any)=>vf('brand',e.target.value)} placeholder="e.g. Mercedes"/>
                <FIn label="Model" value={vForm.model} onChange={(e:any)=>vf('model',e.target.value)} placeholder="e.g. Actros 1845"/>
                <FIn label="Year" type="number" value={vForm.year} onChange={(e:any)=>vf('year',e.target.value)} placeholder="e.g. 2023"/>
                <FSel label="Fuel Type" value={vForm.fuelType} onChange={(e:any)=>vf('fuelType',e.target.value)}>
                  {['diesel','petrol','hybrid','electric'].map(t=><option key={t} value={t}>{t.charAt(0).toUpperCase()+t.slice(1)}</option>)}
                </FSel>
                <FIn label="Capacity (kg)" type="number" value={vForm.capacityKg} onChange={(e:any)=>vf('capacityKg',e.target.value)} placeholder="e.g. 7000"/>
                <FIn label="Capacity (CBM)" type="number" value={vForm.capacityCbm} onChange={(e:any)=>vf('capacityCbm',e.target.value)} placeholder="e.g. 35"/>
                <FIn label="Trailer Type" value={vForm.trailerType} onChange={(e:any)=>vf('trailerType',e.target.value)} placeholder="e.g. flatbed"/>
                <FIn label="Purchase Price (SAR)" type="number" value={vForm.purchasePrice} onChange={(e:any)=>vf('purchasePrice',e.target.value)}/>
                <FDate label="Purchase Date" value={vForm.purchaseDate} onChange={(e:any)=>vf('purchaseDate',e.target.value)}/>
                <FDate label="Registration Expiry" value={vForm.registrationExpiry} onChange={(e:any)=>vf('registrationExpiry',e.target.value)}/>
                <FDate label="Insurance Expiry" value={vForm.insuranceExpiry} onChange={(e:any)=>vf('insuranceExpiry',e.target.value)}/>
                {editVId && (
                  <FSel label="Status" value={vForm.status} onChange={(e:any)=>vf('status',e.target.value)}>
                    <option value="active">Active</option>
                    <option value="maintenance">Maintenance</option>
                    <option value="retired">Retired</option>
                    <option value="sold">Sold</option>
                    <option value="accident">Accident</option>
                  </FSel>
                )}
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-white/5">
              <button onClick={()=>setShowVForm(false)} className="px-4 py-2 text-xs text-slate-400 hover:text-white transition-colors">Cancel</button>
              <button onClick={handleVSave} disabled={vSaving}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-semibold rounded-lg transition-colors">
                {vSaving?'Saving…':editVId?'Save Changes':'Add Vehicle'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── DRIVER FORM MODAL ── */}
      {showDForm&&(
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-start justify-center pt-6 pb-4 px-4 overflow-y-auto">
          <div className="w-full max-w-2xl bg-[#1a1d27] rounded-2xl border border-white/10 shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
              <h2 className="text-sm font-bold text-white">{editDId?'Edit Driver':'Add Driver'}</h2>
              <button onClick={()=>setShowDForm(false)} className="p-1 text-slate-400 hover:text-white">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
              </button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Personal Details</p>
              <div className="grid grid-cols-2 gap-3">
                <FIn label="First Name" required value={dForm.firstName} onChange={(e:any)=>df('firstName',e.target.value)}/>
                <FIn label="Last Name" required value={dForm.lastName} onChange={(e:any)=>df('lastName',e.target.value)}/>
                <FIn label="Email" type="email" value={dForm.email} onChange={(e:any)=>df('email',e.target.value)}/>
                <FIn label="Phone" value={dForm.phone} onChange={(e:any)=>df('phone',e.target.value)}/>
                <FIn label="Nationality" value={dForm.nationality} onChange={(e:any)=>df('nationality',e.target.value)}/>
                <FIn label="ID / Iqama Number" value={dForm.idNumber} onChange={(e:any)=>df('idNumber',e.target.value)}/>
                <FDate label="Date of Birth" value={dForm.dateOfBirth} onChange={(e:any)=>df('dateOfBirth',e.target.value)}/>
                <FDate label="Hire Date" value={dForm.hireDate} onChange={(e:any)=>df('hireDate',e.target.value)}/>
                <div className="col-span-2"><FIn label="Address" value={dForm.address} onChange={(e:any)=>df('address',e.target.value)}/></div>
                <FIn label="Emergency Contact Name" value={dForm.emergencyContactName} onChange={(e:any)=>df('emergencyContactName',e.target.value)}/>
                <FIn label="Emergency Contact Phone" value={dForm.emergencyContactPhone} onChange={(e:any)=>df('emergencyContactPhone',e.target.value)}/>
              </div>
              <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mt-2">License Details</p>
              <div className="grid grid-cols-2 gap-3">
                <FIn label="License Number" required value={dForm.licenseNumber} onChange={(e:any)=>df('licenseNumber',e.target.value)}/>
                <FSel label="License Type" value={dForm.licenseType} onChange={(e:any)=>df('licenseType',e.target.value)}>
                  {['light','heavy','trailer','motorcycle'].map(t=><option key={t} value={t}>{t.charAt(0).toUpperCase()+t.slice(1)}</option>)}
                </FSel>
                <FDate label="License Expiry" value={dForm.licenseExpiry} onChange={(e:any)=>df('licenseExpiry',e.target.value)}/>
                <FDate label="Medical Certificate Expiry" value={dForm.medicalCertificateExpiry} onChange={(e:any)=>df('medicalCertificateExpiry',e.target.value)}/>
                <FIn label="Years of Experience" type="number" min="0" value={dForm.yearsOfExperience} onChange={(e:any)=>df('yearsOfExperience',e.target.value)}/>
                {editDId && (
                  <FSel label="Status" value={dForm.status} onChange={(e:any)=>df('status',e.target.value)}>
                    <option value="available">Available</option>
                    <option value="on_trip">On Trip</option>
                    <option value="on_leave">On Leave</option>
                    <option value="suspended">Suspended</option>
                    <option value="off_duty">Off Duty</option>
                  </FSel>
                )}
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-white/5">
              <button onClick={()=>setShowDForm(false)} className="px-4 py-2 text-xs text-slate-400 hover:text-white transition-colors">Cancel</button>
              <button onClick={handleDSave} disabled={dSaving}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-semibold rounded-lg transition-colors">
                {dSaving?'Saving…':editDId?'Save Changes':'Add Driver'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
