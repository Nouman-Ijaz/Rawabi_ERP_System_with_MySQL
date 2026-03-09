import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { employeesApi } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

import { fmtDate, fmtSAR } from '@/lib/format';
const initials = (f: string, l: string) => `${f?.[0]||''}${l?.[0]||''}`.toUpperCase();
const docSt    = (d: number|null): 'expired'|'soon'|'ok'|'none' => {
  if (d===null||d===undefined) return 'none';
  if (d < 0)   return 'expired';
  if (d <= 30) return 'soon';
  return 'ok';
};

import { EMPLOYEE_STATUS } from '@/lib/statusStyles';
const DEPT_CLS: Record<string,string> = {
  operations:'bg-blue-500/15 text-blue-400',  logistics:'bg-cyan-500/15 text-cyan-400',
  finance:'bg-emerald-500/15 text-emerald-400', hr:'bg-purple-500/15 text-purple-400',
  it:'bg-amber-500/15 text-amber-400', management:'bg-red-500/15 text-red-400',
  maintenance:'bg-orange-500/15 text-orange-400', dispatch:'bg-indigo-500/15 text-indigo-400',
  admin:'bg-violet-500/15 text-violet-400', sales:'bg-pink-500/15 text-pink-400',
};
const AVC = ['from-blue-500 to-blue-700','from-emerald-500 to-emerald-700','from-purple-500 to-purple-700',
             'from-amber-500 to-amber-700','from-cyan-500 to-cyan-700','from-rose-500 to-rose-700',
             'from-indigo-500 to-indigo-700','from-teal-500 to-teal-700'];
const av = (id: number) => AVC[id % AVC.length];

const DEPTS = ['Operations','Logistics','Finance','HR','IT','Management','Maintenance','Dispatch','Admin','Sales'];
const STATUSES = ['active','inactive','on_leave','terminated'];
const EMP_TYPES = ['full_time','part_time','contract','intern'];
const CONTRACT_TYPES = ['permanent','fixed_term','probation'];
const SHIFTS = ['morning','afternoon','night','flexible'];
const GENDERS = ['male','female','other'];
const MARITAL = ['single','married','divorced','widowed'];
const SORT_OPTS = [
  {v:'created_at:DESC',l:'Newest first'},{v:'created_at:ASC',l:'Oldest first'},
  {v:'first_name:ASC',l:'Name A–Z'},{v:'first_name:DESC',l:'Name Z–A'},
  {v:'hire_date:ASC',l:'Hire date ↑'},{v:'hire_date:DESC',l:'Hire date ↓'},
  {v:'salary:DESC',l:'Salary high–low'},{v:'salary:ASC',l:'Salary low–high'},
  {v:'performance_rating:DESC',l:'Rating high–low'},
];

const EMPTY: Record<string,string> = {
  firstName:'',lastName:'',email:'',phone:'',gender:'',maritalStatus:'',
  dateOfBirth:'',nationality:'',address:'',
  department:'Operations',position:'',hireDate:'',salary:'',
  employmentType:'full_time',contractType:'permanent',probationEndDate:'',
  workLocation:'',workShift:'morning',managerId:'',status:'active',annualLeaveEntitlement:'21',
  idNumber:'',idExpiry:'',passportNumber:'',passportExpiry:'',
  visaNumber:'',visaExpiry:'',workPermitNumber:'',workPermitExpiry:'',
  gosiNumber:'',medicalInsuranceNumber:'',medicalInsuranceExpiry:'',
  bankName:'',bankIban:'',performanceRating:'',lastAppraisalDate:'',
  terminationDate:'',terminationReason:'',
  emergencyContactName:'',emergencyContactPhone:'',notes:'',
};
const TABS = ['Personal','Employment','Documents','Finance','Emergency'];

function Icon({name,className}:{name:string;className?:string}){
  const c=className||'w-4 h-4';
  const M:Record<string,any>={
    search:<svg className={c} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>,
    plus:<svg className={c} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4"/></svg>,
    edit:<svg className={c} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>,
    trash:<svg className={c} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>,
    x:<svg className={c} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12"/></svg>,
    alert:<svg className={c} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>,
    users:<svg className={c} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/></svg>,
    doc:<svg className={c} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>,
    star:<svg className={c} fill="currentColor" viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>,
    eye:<svg className={c} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>,
  };
  return M[name]||<span/>;
}

const inp = "w-full bg-[#0c0e13] border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 transition-colors";
const sel = inp+" appearance-none cursor-pointer";

function Fld({label,req,span,children}:{label:string;req?:boolean;span?:string;children:React.ReactNode}){
  return(
    <div className={span}>
      <label className="block text-[11px] font-medium text-slate-400 mb-1">{label}{req&&<span className="text-red-400 ml-0.5">*</span>}</label>
      {children}
    </div>
  );
}

function Stars({rating}:{rating:number|null}){
  if(!rating)return<span className="text-slate-600 text-[10px]">—</span>;
  return(
    <div className="flex items-center gap-0.5">
      {[1,2,3,4,5].map(i=><Icon key={i} name="star" className={`w-2.5 h-2.5 ${i<=Math.round(rating)?'text-amber-400':'text-slate-700'}`}/>)}
      <span className="ml-1 text-[10px] text-slate-400">{Number(rating).toFixed(1)}</span>
    </div>
  );
}

export default function Employees(){
  const {hasPermission}=useAuth();
  const canEdit=hasPermission(['super_admin','admin','office_admin']);
  const navigate=useNavigate();

  const [employees,setEmployees]=useState<any[]>([]);
  const [managers,setManagers]=useState<any[]>([]);
  const [stats,setStats]=useState<any>(null);
  const [loading,setLoading]=useState(true);
  const [search,setSearch]=useState('');
  const [statusF,setStatusF]=useState('');
  const [deptF,setDeptF]=useState('');
  const [typeF,setTypeF]=useState('');
  const [sortV,setSortV]=useState('created_at:DESC');
  const [page,setPage]=useState(1);
  const [pagination,setPagination]=useState<any>({});
  const [showForm,setShowForm]=useState(false);
  const [formTab,setFormTab]=useState(0);
  const [editId,setEditId]=useState<number|null>(null);
  const [saving,setSaving]=useState(false);
  const [deleteId,setDeleteId]=useState<number|null>(null);
  const [form,setForm]=useState({...EMPTY});

  const load=useCallback(async()=>{
    setLoading(true);
    try{
      const [sortBy,sortDir]=sortV.split(':');
      const params:Record<string,string>={page:String(page),limit:'20',sort:sortBy,dir:sortDir};
      if(search)params.search=search;
      if(statusF)params.status=statusF;
      if(deptF)params.department=deptF;
      if(typeF)params.employment_type=typeF;
      const[res,statsRes,mgr]=await Promise.all([
        employeesApi.getAll(params),
        employeesApi.getStats(),
        employeesApi.getAll({limit:'200'}),
      ]);
      setEmployees(res.data||[]);
      setPagination(res.pagination||{});
      setStats(statsRes);
      setManagers(mgr.data||[]);
    }catch{toast.error('Failed to load employees');}
    finally{setLoading(false);}
  },[search,statusF,deptF,typeF,sortV,page]);

  useEffect(()=>{setPage(1);},[search,statusF,deptF,typeF,sortV]);
  useEffect(()=>{load();},[load]);

  const openCreate=()=>{setEditId(null);setForm({...EMPTY});setFormTab(0);setShowForm(true);};
  const openEdit=(e:any)=>{
    setEditId(e.id);
    setForm({
      firstName:e.first_name||'',lastName:e.last_name||'',email:e.email||'',phone:e.phone||'',
      gender:e.gender||'',maritalStatus:e.marital_status||'',
      dateOfBirth:e.date_of_birth?.slice(0,10)||'',nationality:e.nationality||'',address:e.address||'',
      department:e.department||'Operations',position:e.position||'',
      hireDate:e.hire_date?.slice(0,10)||'',salary:e.salary||'',
      employmentType:e.employment_type||'full_time',contractType:e.contract_type||'permanent',
      probationEndDate:e.probation_end_date?.slice(0,10)||'',
      workLocation:e.work_location||'',workShift:e.work_shift||'morning',
      managerId:e.manager_id?String(e.manager_id):'',status:e.status||'active',
      annualLeaveEntitlement:e.annual_leave_entitlement?String(e.annual_leave_entitlement):'21',
      idNumber:e.id_number||'',idExpiry:e.id_expiry?.slice(0,10)||'',
      passportNumber:e.passport_number||'',passportExpiry:e.passport_expiry?.slice(0,10)||'',
      visaNumber:e.visa_number||'',visaExpiry:e.visa_expiry?.slice(0,10)||'',
      workPermitNumber:e.work_permit_number||'',workPermitExpiry:e.work_permit_expiry?.slice(0,10)||'',
      gosiNumber:e.gosi_number||'',medicalInsuranceNumber:e.medical_insurance_number||'',
      medicalInsuranceExpiry:e.medical_insurance_expiry?.slice(0,10)||'',
      bankName:e.bank_name||'',bankIban:e.bank_iban||'',
      performanceRating:e.performance_rating?String(e.performance_rating):'',
      lastAppraisalDate:e.last_appraisal_date?.slice(0,10)||'',
      terminationDate:e.termination_date?.slice(0,10)||'',terminationReason:e.termination_reason||'',
      emergencyContactName:e.emergency_contact_name||'',emergencyContactPhone:e.emergency_contact_phone||'',
      notes:e.notes||'',
    });
    setFormTab(0);setShowForm(true);
  };
  const closeForm=()=>{setShowForm(false);setEditId(null);};

  const save=async()=>{
    if(!form.firstName||!form.lastName||!form.department||!form.position||!form.hireDate){
      toast.error('First name, last name, department, position and hire date are required');
      setFormTab(0);return;
    }
    setSaving(true);
    try{
      const fd=new FormData();
      Object.entries(form).forEach(([k,v])=>fd.append(k,v));
      if(editId){await employeesApi.update(editId,fd);toast.success('Employee updated');}
      else{await employeesApi.create(fd);toast.success('Employee created');}
      closeForm();load();
    }catch(e:any){toast.error(e.message||'Failed to save employee');}
    finally{setSaving(false);}
  };

  const confirmDelete=async()=>{
    if(!deleteId)return;
    try{await employeesApi.delete(deleteId);toast.success('Employee deleted');setDeleteId(null);load();}
    catch{toast.error('Failed to delete employee');}
  };

  const f=(k:keyof typeof EMPTY)=>(e:React.ChangeEvent<HTMLInputElement|HTMLSelectElement|HTMLTextAreaElement>)=>
    setForm(p=>({...p,[k]:e.target.value}));

  const worstDoc=(emp:any)=>{
    const days=[emp.id_days_left,emp.visa_days_left,emp.passport_days_left,emp.permit_days_left,emp.insurance_days_left];
    const v=days.filter((d:any)=>d!==null&&d!==undefined);
    if(v.some((d:number)=>d<0))return'expired';
    if(v.some((d:number)=>d<=30))return'soon';
    return'none';
  };

  return(
    <div className="space-y-4">
      <style>{`input[type="date"]::-webkit-calendar-picker-indicator{filter:invert(1) opacity(0.5);cursor:pointer;}`}</style>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Employees</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            {loading?'…':`${pagination.total||0} total`}{stats&&` · ${stats.active_count} active`}
          </p>
        </div>
        {canEdit&&(
          <button onClick={openCreate} className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium rounded-lg transition-colors">
            <Icon name="plus" className="w-3.5 h-3.5"/>Add Employee
          </button>
        )}
      </div>

      {/* KPIs */}
      {stats&&(
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
          {[
            {label:'Total',value:stats.total,color:'text-white'},
            {label:'Active',value:stats.active_count,color:'text-emerald-400'},
            {label:'On Leave',value:stats.on_leave_count,color:'text-amber-400'},
            {label:'Departments',value:stats.department_count,color:'text-blue-400'},
            {label:'Docs Expiring',value:stats.expiring_documents_count,color:'text-amber-400'},
            {label:'Docs Expired',value:stats.expired_documents_count,color:'text-red-400'},
          ].map(k=>(
            <div key={k.label} className="bg-[#1a1d27] rounded-xl border border-white/5 p-3">
              <p className="text-[10px] text-slate-500">{k.label}</p>
              <p className={`text-lg font-bold tabular-nums mt-0.5 ${k.color}`}>{k.value??0}</p>
            </div>
          ))}
        </div>
      )}

      {/* Alerts */}
      {stats?.expired_documents_count>0&&(
        <div className="flex items-center gap-3 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
          <Icon name="alert" className="w-4 h-4 text-red-400 flex-shrink-0"/>
          <p className="text-xs text-red-400"><span className="font-semibold">{stats.expired_documents_count} employee{stats.expired_documents_count>1?'s':''}</span> have expired documents — Iqama, Visa, Passport, Work Permit or Insurance. Review immediately.</p>
        </div>
      )}
      {stats?.expiring_documents_count>0&&!stats?.expired_documents_count&&(
        <div className="flex items-center gap-3 bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-3">
          <Icon name="alert" className="w-4 h-4 text-amber-400 flex-shrink-0"/>
          <p className="text-xs text-amber-400"><span className="font-semibold">{stats.expiring_documents_count} employee{stats.expiring_documents_count>1?'s':''}</span> have documents expiring within 30 days.</p>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Icon name="search" className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500"/>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search name, code, email, position…" autoComplete="off"
            className="w-full bg-[#1a1d27] border border-white/5 rounded-lg pl-9 pr-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-blue-500/40"/>
        </div>
        {[
          {v:statusF,set:setStatusF,label:'All Statuses',opts:STATUSES.map(s=>({v:s,l:s.replace('_',' ')}))},
          {v:deptF,set:setDeptF,label:'All Departments',opts:DEPTS.map(d=>({v:d,l:d}))},
          {v:typeF,set:setTypeF,label:'All Types',opts:EMP_TYPES.map(t=>({v:t,l:t.replace('_',' ')}))},
        ].map((f,i)=>(
          <select key={i} value={f.v} onChange={e=>f.set(e.target.value)}
            className="bg-[#1a1d27] border border-white/5 rounded-lg px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-blue-500/40 [color-scheme:dark]">
            <option value="">{f.label}</option>
            {f.opts.map(o=><option key={o.v} value={o.v}>{o.l}</option>)}
          </select>
        ))}
        <select value={sortV} onChange={e=>setSortV(e.target.value)}
          className="bg-[#1a1d27] border border-white/5 rounded-lg px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-blue-500/40 [color-scheme:dark]">
          {SORT_OPTS.map(o=><option key={o.v} value={o.v}>{o.l}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="bg-[#1a1d27] rounded-xl border border-white/5 overflow-hidden">
        {loading?(
          <div className="p-10 text-center text-slate-600 text-xs">Loading employees…</div>
        ):employees.length===0?(
          <div className="p-14 text-center">
            <Icon name="users" className="w-10 h-10 text-slate-700 mx-auto mb-3"/>
            <p className="text-sm text-slate-500">No employees found</p>
            {canEdit&&<button onClick={openCreate} className="mt-3 text-xs text-blue-400 hover:text-blue-300">Add first employee</button>}
          </div>
        ):(
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-white/5">
                  {['Employee','Dept / Position','Tenure','Type','Rating','Docs','Salary','Status',''].map(h=>(
                    <th key={h} className="py-3 px-4 text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {employees.map((e:any)=>{
                  const dC=DEPT_CLS[(e.department||'').toLowerCase()]||'bg-slate-500/15 text-slate-400';
                  const wd=worstDoc(e);
                  return(
                    <tr key={e.id} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors group">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${av(e.id)} flex items-center justify-center text-[11px] font-bold text-white flex-shrink-0`}>
                            {initials(e.first_name,e.last_name)}
                          </div>
                          <div>
                            <button onClick={()=>navigate(`/employees/${e.id}`)} className="font-semibold text-white hover:text-blue-400 transition-colors text-left">{e.first_name} {e.last_name}</button>
                            <p className="text-[10px] text-slate-500 font-mono">{e.employee_code}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-medium ${dC}`}>{e.department}</span>
                        <p className="text-slate-400 mt-0.5">{e.position}</p>
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <p className="text-white tabular-nums">{e.years_of_service??0} yr{e.years_of_service!==1?'s':''}</p>
                        <p className="text-[10px] text-slate-500">{fmtDate(e.hire_date)}</p>
                      </td>
                      <td className="py-3 px-4 text-slate-400 capitalize">{(e.employment_type||'').replace('_',' ')}</td>
                      <td className="py-3 px-4"><Stars rating={e.performance_rating}/></td>
                      <td className="py-3 px-4">
                        {wd==='none'?<span className="text-slate-700">—</span>:(
                          <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-medium ${wd==='expired'?'bg-red-500/15 text-red-400':'bg-amber-500/15 text-amber-400'}`}>
                            <Icon name="doc" className="w-2.5 h-2.5"/>
                            {wd==='expired'?'Expired':'Expiring'}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-slate-300 tabular-nums">{fmtSAR(e.salary)}</td>
                      <td className="py-3 px-4">
                        <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-medium capitalize ${EMPLOYEE_STATUS[e.status]||'bg-slate-500/15 text-slate-400'}`}>
                          {(e.status||'').replace('_',' ')}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        {canEdit&&(
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={()=>navigate(`/employees/${e.id}`)} className="p-1.5 rounded-md hover:bg-slate-500/15 text-slate-500 hover:text-slate-300 transition-colors" title="View profile"><Icon name="eye" className="w-3.5 h-3.5"/></button>
                            <button onClick={()=>openEdit(e)} className="p-1.5 rounded-md hover:bg-blue-500/15 text-slate-500 hover:text-blue-400 transition-colors"><Icon name="edit" className="w-3.5 h-3.5"/></button>
                            <button onClick={()=>setDeleteId(e.id)} className="p-1.5 rounded-md hover:bg-red-500/15 text-slate-500 hover:text-red-400 transition-colors"><Icon name="trash" className="w-3.5 h-3.5"/></button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {pagination.totalPages>1&&(
              <div className="flex items-center justify-between px-4 py-3 border-t border-white/5">
                <p className="text-[11px] text-slate-500">{pagination.total} employees · page {page} of {pagination.totalPages}</p>
                <div className="flex gap-2">
                  <button onClick={()=>setPage(p=>Math.max(1,p-1))} disabled={page===1} className="px-3 py-1.5 text-xs rounded-lg border border-white/10 text-slate-400 disabled:opacity-40 hover:bg-white/5 transition-colors">Prev</button>
                  <button onClick={()=>setPage(p=>Math.min(pagination.totalPages,p+1))} disabled={page===pagination.totalPages} className="px-3 py-1.5 text-xs rounded-lg border border-white/10 text-slate-400 disabled:opacity-40 hover:bg-white/5 transition-colors">Next</button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* MODAL FORM */}
      {showForm&&(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={closeForm}/>
          <div className="relative w-full max-w-2xl bg-[#0d0f14] rounded-2xl border border-white/10 shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 flex-shrink-0">
              <h2 className="text-sm font-semibold text-white">{editId?'Edit Employee':'New Employee'}</h2>
              <button onClick={closeForm} className="p-1.5 rounded-md hover:bg-white/5 text-slate-400 hover:text-white transition-colors"><Icon name="x" className="w-4 h-4"/></button>
            </div>
            {/* Tabs */}
            <div className="flex border-b border-white/5 px-4 flex-shrink-0 overflow-x-auto">
              {TABS.map((t,i)=>(
                <button key={t} onClick={()=>setFormTab(i)}
                  className={`py-3 px-4 text-[11px] font-medium border-b-2 whitespace-nowrap transition-colors ${formTab===i?'border-blue-500 text-blue-400':'border-transparent text-slate-500 hover:text-slate-300'}`}>
                  {t}
                </button>
              ))}
            </div>
            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6">
              {/* TAB 0 Personal */}
              {formTab===0&&<div className="grid grid-cols-2 gap-4">
                <Fld label="First Name" req><input value={form.firstName} onChange={f('firstName')} className={inp} placeholder="Ahmed"/></Fld>
                <Fld label="Last Name" req><input value={form.lastName} onChange={f('lastName')} className={inp} placeholder="Al-Rashid"/></Fld>
                <Fld label="Email"><input type="email" value={form.email} onChange={f('email')} className={inp} placeholder="ahmed@rawabi.com" autoComplete="off"/></Fld>
                <Fld label="Phone"><input value={form.phone} onChange={f('phone')} className={inp} placeholder="+966 5xx xxx xxxx"/></Fld>
                <Fld label="Gender"><select value={form.gender} onChange={f('gender')} className={sel}><option value="">Select…</option>{GENDERS.map(g=><option key={g} value={g}>{g.charAt(0).toUpperCase()+g.slice(1)}</option>)}</select></Fld>
                <Fld label="Marital Status"><select value={form.maritalStatus} onChange={f('maritalStatus')} className={sel}><option value="">Select…</option>{MARITAL.map(m=><option key={m} value={m}>{m.charAt(0).toUpperCase()+m.slice(1)}</option>)}</select></Fld>
                <Fld label="Date of Birth"><input type="date" value={form.dateOfBirth} onChange={f('dateOfBirth')} style={{ colorScheme: 'dark' }} className={inp}/></Fld>
                <Fld label="Nationality"><input value={form.nationality} onChange={f('nationality')} className={inp} placeholder="Saudi Arabian"/></Fld>
                <Fld label="Address" span="col-span-2"><textarea value={form.address} onChange={f('address')} rows={2} className={inp+' resize-none'} placeholder="Full address…"/></Fld>
              </div>}

              {/* TAB 1 Employment */}
              {formTab===1&&<div className="grid grid-cols-2 gap-4">
                <Fld label="Department" req><select value={form.department} onChange={f('department')} className={sel}>{DEPTS.map(d=><option key={d} value={d}>{d}</option>)}</select></Fld>
                <Fld label="Position" req><input value={form.position} onChange={f('position')} className={inp} placeholder="Fleet Coordinator"/></Fld>
                <Fld label="Hire Date" req><input type="date" value={form.hireDate} onChange={f('hireDate')} style={{ colorScheme: 'dark' }} className={inp}/></Fld>
                <Fld label="Status"><select value={form.status} onChange={f('status')} className={sel}>{STATUSES.map(s=><option key={s} value={s}>{s.replace('_',' ')}</option>)}</select></Fld>
                <Fld label="Employment Type"><select value={form.employmentType} onChange={f('employmentType')} className={sel}>{EMP_TYPES.map(t=><option key={t} value={t}>{t.replace('_',' ')}</option>)}</select></Fld>
                <Fld label="Contract Type"><select value={form.contractType} onChange={f('contractType')} className={sel}>{CONTRACT_TYPES.map(t=><option key={t} value={t}>{t.replace('_',' ')}</option>)}</select></Fld>
                <Fld label="Probation End Date"><input type="date" value={form.probationEndDate} onChange={f('probationEndDate')} style={{ colorScheme: 'dark' }} className={inp}/></Fld>
                <Fld label="Annual Leave (days)"><input type="number" value={form.annualLeaveEntitlement} onChange={f('annualLeaveEntitlement')} className={inp} placeholder="21"/></Fld>
                <Fld label="Work Location"><input value={form.workLocation} onChange={f('workLocation')} className={inp} placeholder="Dammam Office"/></Fld>
                <Fld label="Work Shift"><select value={form.workShift} onChange={f('workShift')} className={sel}>{SHIFTS.map(s=><option key={s} value={s}>{s.charAt(0).toUpperCase()+s.slice(1)}</option>)}</select></Fld>
                <Fld label="Direct Manager" span="col-span-2"><select value={form.managerId} onChange={f('managerId')} className={sel}>
                  <option value="">None</option>
                  {managers.filter(e=>e.id!==editId).map((e:any)=><option key={e.id} value={e.id}>{e.first_name} {e.last_name} — {e.position}</option>)}
                </select></Fld>
              </div>}

              {/* TAB 2 Documents */}
              {formTab===2&&<div className="space-y-5">
                <div>
                  <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-3">Identity (Iqama / National ID)</p>
                  <div className="grid grid-cols-2 gap-4">
                    <Fld label="ID Number"><input value={form.idNumber} onChange={f('idNumber')} className={inp} placeholder="1234567890"/></Fld>
                    <Fld label="ID Expiry"><input type="date" value={form.idExpiry} onChange={f('idExpiry')} style={{ colorScheme: 'dark' }} className={inp}/></Fld>
                  </div>
                </div>
                <div className="border-t border-white/5"/>
                <div>
                  <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-3">Passport</p>
                  <div className="grid grid-cols-2 gap-4">
                    <Fld label="Passport Number"><input value={form.passportNumber} onChange={f('passportNumber')} className={inp} placeholder="A12345678"/></Fld>
                    <Fld label="Passport Expiry"><input type="date" value={form.passportExpiry} onChange={f('passportExpiry')} style={{ colorScheme: 'dark' }} className={inp}/></Fld>
                  </div>
                </div>
                <div className="border-t border-white/5"/>
                <div>
                  <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-3">Visa &amp; Work Permit</p>
                  <div className="grid grid-cols-2 gap-4">
                    <Fld label="Visa Number"><input value={form.visaNumber} onChange={f('visaNumber')} className={inp}/></Fld>
                    <Fld label="Visa Expiry"><input type="date" value={form.visaExpiry} onChange={f('visaExpiry')} style={{ colorScheme: 'dark' }} className={inp}/></Fld>
                    <Fld label="Work Permit No."><input value={form.workPermitNumber} onChange={f('workPermitNumber')} className={inp}/></Fld>
                    <Fld label="Work Permit Expiry"><input type="date" value={form.workPermitExpiry} onChange={f('workPermitExpiry')} style={{ colorScheme: 'dark' }} className={inp}/></Fld>
                  </div>
                </div>
                <div className="border-t border-white/5"/>
                <div>
                  <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-3">GOSI &amp; Medical Insurance</p>
                  <div className="grid grid-cols-2 gap-4">
                    <Fld label="GOSI Number"><input value={form.gosiNumber} onChange={f('gosiNumber')} className={inp}/></Fld>
                    <Fld label="Medical Insurance No."><input value={form.medicalInsuranceNumber} onChange={f('medicalInsuranceNumber')} className={inp}/></Fld>
                    <Fld label="Insurance Expiry"><input type="date" value={form.medicalInsuranceExpiry} onChange={f('medicalInsuranceExpiry')} style={{ colorScheme: 'dark' }} className={inp}/></Fld>
                  </div>
                </div>
              </div>}

              {/* TAB 3 Finance */}
              {formTab===3&&<div className="grid grid-cols-2 gap-4">
                <Fld label="Monthly Salary (SAR)"><input type="number" value={form.salary} onChange={f('salary')} className={inp} placeholder="0.00"/></Fld>
                <Fld label="Bank Name"><input value={form.bankName} onChange={f('bankName')} className={inp} placeholder="Al Rajhi Bank"/></Fld>
                <Fld label="IBAN" span="col-span-2"><input value={form.bankIban} onChange={f('bankIban')} className={inp} placeholder="SA00 0000 0000 0000 0000 0000"/></Fld>
                <div className="col-span-2 border-t border-white/5 pt-3">
                  <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-3">Performance</p>
                </div>
                <Fld label="Performance Rating (1–5)"><input type="number" min="1" max="5" step="0.1" value={form.performanceRating} onChange={f('performanceRating')} className={inp} placeholder="4.5"/></Fld>
                <Fld label="Last Appraisal Date"><input type="date" value={form.lastAppraisalDate} onChange={f('lastAppraisalDate')} style={{ colorScheme: 'dark' }} className={inp}/></Fld>
                {form.status==='terminated'&&<>
                  <div className="col-span-2 border-t border-white/5 pt-3">
                    <p className="text-[10px] font-semibold text-red-400 uppercase tracking-wider mb-3">Termination</p>
                  </div>
                  <Fld label="Termination Date"><input type="date" value={form.terminationDate} onChange={f('terminationDate')} style={{ colorScheme: 'dark' }} className={inp}/></Fld>
                  <Fld label="Reason" span="col-span-2"><textarea value={form.terminationReason} onChange={f('terminationReason')} rows={2} className={inp+' resize-none'} placeholder="Reason…"/></Fld>
                </>}
              </div>}

              {/* TAB 4 Emergency */}
              {formTab===4&&<div className="grid grid-cols-2 gap-4">
                <Fld label="Emergency Contact Name"><input value={form.emergencyContactName} onChange={f('emergencyContactName')} className={inp}/></Fld>
                <Fld label="Emergency Contact Phone"><input value={form.emergencyContactPhone} onChange={f('emergencyContactPhone')} className={inp}/></Fld>
                <Fld label="Internal Notes" span="col-span-2"><textarea value={form.notes} onChange={f('notes')} rows={5} className={inp+' resize-none'} placeholder="Any internal notes about this employee…"/></Fld>
              </div>}
            </div>
            {/* Footer */}
            <div className="px-6 py-4 border-t border-white/5 flex items-center gap-3 flex-shrink-0">
              <div className="flex gap-2 flex-1">
                {formTab>0&&<button onClick={()=>setFormTab(t=>t-1)} className="px-3 py-2 text-xs text-slate-400 border border-white/10 rounded-lg hover:bg-white/5 transition-colors">← Back</button>}
                {formTab<TABS.length-1&&<button onClick={()=>setFormTab(t=>t+1)} className="px-3 py-2 text-xs text-slate-400 border border-white/10 rounded-lg hover:bg-white/5 transition-colors">Next →</button>}
              </div>
              <button onClick={closeForm} className="px-4 py-2 text-xs font-medium text-slate-400 border border-white/10 rounded-lg hover:text-white hover:border-white/20 transition-colors">Cancel</button>
              <button onClick={save} disabled={saving} className="px-5 py-2 text-xs font-medium bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-lg transition-colors">
                {saving?'Saving…':editId?'Save Changes':'Create Employee'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {deleteId&&(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-[#1a1d27] rounded-xl border border-white/10 p-6 w-full max-w-sm shadow-2xl">
            <h3 className="text-sm font-semibold text-white mb-2">Delete Employee</h3>
            <p className="text-xs text-slate-400 mb-5">This employee record will be permanently deleted.</p>
            <div className="flex gap-3">
              <button onClick={()=>setDeleteId(null)} className="flex-1 py-2 text-xs border border-white/10 rounded-lg text-slate-400 hover:text-white transition-colors">Cancel</button>
              <button onClick={confirmDelete} className="flex-1 py-2 text-xs bg-red-600 hover:bg-red-500 text-white rounded-lg transition-colors">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
