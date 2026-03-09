import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { employeesApi } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

import { fmtDate, fmtSAR } from '@/lib/format';
const initials= (f:string,l:string)=>`${f?.[0]||''}${l?.[0]||''}`.toUpperCase();

const AVC=['from-blue-500 to-blue-700','from-emerald-500 to-emerald-700','from-purple-500 to-purple-700',
           'from-amber-500 to-amber-700','from-cyan-500 to-cyan-700','from-rose-500 to-rose-700'];
const av=(id:number)=>AVC[id%AVC.length];

import { EMPLOYEE_STATUS } from '@/lib/statusStyles';

const daysUntil=(d:string)=>d?Math.ceil((new Date(d).getTime()-Date.now())/86400000):null;
const docStatus=(d:string)=>{
  const n=daysUntil(d);
  if(n===null) return 'none';
  if(n<0) return 'expired';
  if(n<=30) return 'soon';
  return 'ok';
};
const docBadge=(d:string)=>{
  const s=docStatus(d);
  if(s==='none') return null;
  const n=daysUntil(d)!;
  if(s==='expired') return <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-red-500/15 text-red-400 border border-red-500/20">Expired {Math.abs(n)}d ago</span>;
  if(s==='soon')    return <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400 border border-amber-500/20">Expires in {n}d</span>;
  return null;
};

function Row({label,value,highlight}:{label:string;value?:any;highlight?:boolean}){
  return(
    <div className={`flex flex-col gap-0.5 ${highlight?'print:bg-yellow-50':''}`}>
      <span className="text-[10px] text-slate-500 uppercase tracking-wider print:text-gray-500">{label}</span>
      <span className="text-xs text-white font-medium print:text-gray-900">{value||'—'}</span>
    </div>
  );
}
function Section({title,icon,children}:{title:string;icon:string;children:React.ReactNode}){
  return(
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

export default function EmployeeDetail(){
  const {id}=useParams<{id:string}>();
  const navigate=useNavigate();
  const {hasPermission}=useAuth();
  const canEdit=hasPermission(['super_admin','admin','office_admin']);
  const [emp,setEmp]=useState<any>(null);
  const [loading,setLoading]=useState(true);

  useEffect(()=>{
    if(!id) return;
    employeesApi.getById(parseInt(id))
      .then(setEmp)
      .catch(()=>toast.error('Failed to load employee'))
      .finally(()=>setLoading(false));
  },[id]);

  if(loading) return(
    <div className="flex items-center justify-center py-32 text-slate-500 text-sm">Loading…</div>
  );
  if(!emp) return(
    <div className="flex flex-col items-center justify-center py-32 text-center">
      <p className="text-slate-400 text-sm">Employee not found</p>
      <button onClick={()=>navigate('/employees')} className="mt-3 text-xs text-blue-400 hover:text-blue-300">← Back to Employees</button>
    </div>
  );

  const hasDriverInfo=emp.driverInfo;

  return(
    <div className="space-y-5 max-w-5xl">

      {/* Print styles */}
      <style>{`
        @media print {
          body { background: white !important; color: black !important; }
          .no-print { display: none !important; }
          .print-header { display: block !important; }
        }
        @media screen { .print-header { display: none; } }
      `}</style>

      {/* Hidden print header */}
      <div className="print-header text-center pb-4 border-b border-gray-200 mb-6">
        <h1 className="text-xl font-bold text-gray-900">Employee Profile</h1>
        <p className="text-sm text-gray-500">Rawabi Logistics · Printed {new Date().toLocaleDateString('en-GB',{day:'2-digit',month:'long',year:'numeric'})}</p>
      </div>

      {/* Header bar */}
      <div className="no-print flex items-center justify-between">
        <button onClick={()=>navigate('/employees')} className="flex items-center gap-2 text-xs text-slate-400 hover:text-white transition-colors">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/></svg>
          All Employees
        </button>
        <div className="flex items-center gap-2">
          <button onClick={()=>window.print()}
            className="flex items-center gap-2 px-3 py-2 text-xs border border-white/10 rounded-lg text-slate-400 hover:text-white hover:border-white/20 transition-colors">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"/></svg>
            Print
          </button>
          {canEdit&&(
            <button onClick={()=>navigate('/employees')}
              className="flex items-center gap-2 px-3 py-2 text-xs bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
              Edit
            </button>
          )}
        </div>
      </div>

      {/* Profile card */}
      <div className="bg-[#1a1d27] rounded-xl border border-white/5 p-6 print:bg-white print:border print:border-gray-200">
        <div className="flex items-start gap-5">
          <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${av(emp.id)} flex items-center justify-center text-xl font-bold text-white flex-shrink-0 print:hidden`}>
            {initials(emp.first_name,emp.last_name)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <h2 className="text-xl font-bold text-white print:text-gray-900">{emp.first_name} {emp.last_name}</h2>
                <p className="text-sm text-slate-400 print:text-gray-600">{emp.position} · {emp.department}</p>
                <p className="text-xs text-slate-500 font-mono mt-0.5 print:text-gray-500">{emp.employee_code}</p>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`px-2 py-1 rounded-lg text-xs font-medium border capitalize ${EMPLOYEE_STATUS[emp.status]||'bg-slate-500/15 text-slate-400 border-slate-500/30'}`}>
                  {(emp.status||'').replace('_',' ')}
                </span>
                <span className="px-2 py-1 rounded-lg text-xs font-medium bg-slate-500/10 text-slate-400 border border-white/5 capitalize">
                  {(emp.employment_type||'').replace('_',' ')}
                </span>
              </div>
            </div>
            <div className="flex flex-wrap gap-6 mt-4">
              {[
                {l:'Tenure', v:`${emp.years_of_service??0} year${emp.years_of_service!==1?'s':''}`},
                {l:'Age',    v:emp.age?`${emp.age} years`:'—'},
                {l:'Salary', v:fmtSAR(emp.salary)},
                {l:'Joined', v:fmtDate(emp.hire_date)},
                {l:'Manager',v:emp.manager_name?.trim()||'—'},
                {l:'Rating', v:emp.performance_rating?`${Number(emp.performance_rating).toFixed(1)} / 5`:'—'},
              ].map(({l,v})=>(
                <div key={l}>
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider print:text-gray-500">{l}</p>
                  <p className="text-xs font-semibold text-white mt-0.5 print:text-gray-900">{v}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Contact */}
      <Section title="Contact & Personal" icon="👤">
        <Row label="Email"           value={emp.email}/>
        <Row label="Phone"           value={emp.phone}/>
        <Row label="Date of Birth"   value={fmtDate(emp.date_of_birth)}/>
        <Row label="Gender"          value={emp.gender}/>
        <Row label="Marital Status"  value={emp.marital_status}/>
        <Row label="Nationality"     value={emp.nationality}/>
        <div className="col-span-2 sm:col-span-3"><Row label="Address" value={emp.address}/></div>
      </Section>

      {/* Employment */}
      <Section title="Employment Details" icon="💼">
        <Row label="Department"      value={emp.department}/>
        <Row label="Position"        value={emp.position}/>
        <Row label="Employment Type" value={(emp.employment_type||'').replace('_',' ')}/>
        <Row label="Contract Type"   value={(emp.contract_type||'').replace('_',' ')}/>
        <Row label="Work Location"   value={emp.work_location}/>
        <Row label="Work Shift"      value={emp.work_shift}/>
        <Row label="Hire Date"       value={fmtDate(emp.hire_date)}/>
        <Row label="Probation End"   value={emp.probation_end_date?fmtDate(emp.probation_end_date):'—'}/>
        <Row label="Annual Leave"    value={emp.annual_leave_entitlement?`${emp.annual_leave_entitlement} days`:'—'}/>
        {emp.termination_date&&<Row label="Termination Date" value={fmtDate(emp.termination_date)}/>}
        {emp.termination_reason&&<div className="col-span-2"><Row label="Termination Reason" value={emp.termination_reason}/></div>}
      </Section>

      {/* Documents */}
      <div className="bg-[#1a1d27] rounded-xl border border-white/5 p-5 print:bg-white print:border print:border-gray-200">
        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2 print:text-gray-600">
          📄 Documents & Compliance
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[
            {label:'National ID',        num:emp.id_number,         expiry:emp.id_expiry},
            {label:'Passport',           num:emp.passport_number,   expiry:emp.passport_expiry},
            {label:'Visa',               num:emp.visa_number,       expiry:emp.visa_expiry},
            {label:'Work Permit',        num:emp.work_permit_number,expiry:emp.work_permit_expiry},
            {label:'GOSI',               num:emp.gosi_number,       expiry:null},
            {label:'Medical Insurance',  num:emp.medical_insurance_number, expiry:emp.medical_insurance_expiry},
          ].map(({label,num,expiry})=>(
            <div key={label} className="bg-[#0f1117] rounded-lg p-3 border border-white/5 print:bg-gray-50 print:border-gray-200">
              <p className="text-[10px] text-slate-500 uppercase tracking-wider print:text-gray-500">{label}</p>
              <p className="text-xs font-mono text-white mt-1 print:text-gray-900">{num||<span className="text-slate-600 font-sans">Not provided</span>}</p>
              {expiry&&(
                <div className="flex items-center mt-1">
                  <span className="text-[11px] text-slate-500 print:text-gray-500">Expires: {fmtDate(expiry)}</span>
                  {docBadge(expiry)}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Finance */}
      <Section title="Finance & Banking" icon="🏦">
        <Row label="Basic Salary"     value={fmtSAR(emp.salary)}/>
        <Row label="Bank Name"        value={emp.bank_name}/>
        <Row label="IBAN"             value={emp.bank_iban}/>
        <Row label="GOSI Number"      value={emp.gosi_number}/>
      </Section>

      {/* Emergency Contact */}
      <Section title="Emergency Contact" icon="🚨">
        <Row label="Name"  value={emp.emergency_contact_name}/>
        <Row label="Phone" value={emp.emergency_contact_phone}/>
      </Section>

      {/* Performance */}
      <Section title="Performance" icon="⭐">
        <Row label="Performance Rating"  value={emp.performance_rating?`${Number(emp.performance_rating).toFixed(1)} / 5.0`:'—'}/>
        <Row label="Last Appraisal"      value={emp.last_appraisal_date?fmtDate(emp.last_appraisal_date):'—'}/>
      </Section>

      {/* Driver info if applicable */}
      {hasDriverInfo&&(
        <div className="bg-[#1a1d27] rounded-xl border border-amber-500/20 p-5 print:bg-yellow-50 print:border print:border-yellow-200">
          <h3 className="text-xs font-semibold text-amber-400 uppercase tracking-wider mb-4 print:text-yellow-700">🚛 Driver Information</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-4">
            <Row label="License #"       value={hasDriverInfo.license_number}/>
            <Row label="License Type"    value={hasDriverInfo.license_type}/>
            <Row label="License Expiry"  value={fmtDate(hasDriverInfo.license_expiry)}/>
            <Row label="Driver Status"   value={(hasDriverInfo.status||'').replace('_',' ')}/>
            <Row label="Total Trips"     value={hasDriverInfo.total_trips}/>
            <Row label="Completed Trips" value={hasDriverInfo.completed_trips}/>
            <Row label="Rating"          value={hasDriverInfo.rating?`${Number(hasDriverInfo.rating).toFixed(1)} / 5`:'—'}/>
          </div>
        </div>
      )}

      {/* Notes */}
      {emp.notes&&(
        <div className="bg-[#1a1d27] rounded-xl border border-white/5 p-5 print:bg-white print:border print:border-gray-200">
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 print:text-gray-600">📝 Notes</h3>
          <p className="text-xs text-slate-300 whitespace-pre-wrap leading-relaxed print:text-gray-700">{emp.notes}</p>
        </div>
      )}

      {/* Print footer */}
      <div className="hidden print:block text-center text-[10px] text-gray-400 border-t border-gray-200 pt-4 mt-6">
        Rawabi Logistics ERP · Confidential · {new Date().toLocaleString('en-GB')}
      </div>
    </div>
  );
}
