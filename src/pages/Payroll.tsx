import { useEffect, useState, useCallback } from 'react';
import { payrollApi, employeesApi } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

// ── Helpers ─────────────────────────────────────────────────────────────
const fmtSAR = (n: any) => n != null ? `SAR ${Number(n).toLocaleString('en-SA',{minimumFractionDigits:2,maximumFractionDigits:2})}` : '—';
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const fmtPeriod = (m: number, y: number) => `${MONTHS[m-1]} ${y}`;

const STATUS_STYLE: Record<string,string> = {
  draft:      'bg-slate-500/15 text-slate-400 border-slate-500/30',
  processing: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  approved:   'bg-amber-500/15 text-amber-400 border-amber-500/30',
  paid:       'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  cancelled:  'bg-red-500/15 text-red-400 border-red-500/30',
};

function KPI({label,value,sub,color='text-white'}:{label:string;value:string;sub?:string;color?:string}){
  return(
    <div className="bg-[#1a1d27] rounded-xl border border-white/5 p-4">
      <p className="text-[11px] text-slate-500 uppercase tracking-wider mb-1">{label}</p>
      <p className={`text-xl font-bold ${color}`}>{value}</p>
      {sub&&<p className="text-[11px] text-slate-500 mt-0.5">{sub}</p>}
    </div>
  );
}

const inp = 'w-full px-3 py-2 text-xs bg-[#0c0e13] border border-white/10 rounded-lg text-white placeholder-slate-600 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 transition-colors';
const sel = inp+' appearance-none cursor-pointer';
const dInp = inp+' [color-scheme:dark]';

function Field({label,required,children}:{label:string;required?:boolean;children:React.ReactNode}){
  return(
    <div>
      <label className="block text-[11px] text-slate-500 mb-1">{label}{required&&<span className="text-red-400 ml-0.5">*</span>}</label>
      {children}
    </div>
  );
}

// ── Main ─────────────────────────────────────────────────────────────────
export default function Payroll(){
  const {hasPermission}=useAuth();
  const isSA=hasPermission(['super_admin']);
  const canEdit=hasPermission(['super_admin','admin']);

  type View = 'periods'|'period_detail'|'loans'|'salary_structure';
  const [view,setView]=useState<View>('periods');
  const [stats,setStats]=useState<any>(null);
  const [periods,setPeriods]=useState<any[]>([]);
  const [loading,setLoading]=useState(true);

  // Period detail state
  const [activePeriod,setActivePeriod]=useState<any>(null);
  const [pdLoading,setPdLoading]=useState(false);

  // Slip edit state
  const [editSlip,setEditSlip]=useState<any|null>(null);
  const [slipForm,setSlipForm]=useState<any>({});
  const [slipSaving,setSlipSaving]=useState(false);

  // New period form
  const [showNewPeriod,setShowNewPeriod]=useState(false);
  const [newPeriod,setNewPeriod]=useState({ month: String(new Date().getMonth()+1), year: String(new Date().getFullYear()), paymentDate:'', notes:'' });
  const [creating,setCreating]=useState(false);

  // Loans
  const [loans,setLoans]=useState<any[]>([]);
  const [loansLoading,setLoansLoading]=useState(false);
  const [showLoanForm,setShowLoanForm]=useState(false);
  const [employees,setEmployees]=useState<any[]>([]);
  const [loanForm,setLoanForm]=useState({employeeId:'',loanAmount:'',monthlyDeduction:'',disbursedDate:'',reason:'',notes:''});
  const [loanSaving,setLoanSaving]=useState(false);

  // Salary structure
  const [ssEmployee,setSsEmployee]=useState<any|null>(null);
  const [ssData,setSsData]=useState<any[]>([]);
  const [ssForm,setSsForm]=useState({effectiveFrom:'',basicSalary:'',housingAllowance:'',transportAllowance:'',foodAllowance:'',phoneAllowance:'',otherAllowance:'',otherAllowanceLabel:'',gosiEmployeePct:'9.75',gosiEmployerPct:'11.75',notes:''});
  const [ssSaving,setSsSaving]=useState(false);
  const [ssSearch,setSsSearch]=useState('');
  const [empList,setEmpList]=useState<any[]>([]);

  const loadData = useCallback(async()=>{
    setLoading(true);
    try{
      const [s,p]=await Promise.all([payrollApi.getStats(),payrollApi.getPeriods()]);
      setStats(s); setPeriods(p);
    }catch{ toast.error('Failed to load payroll data'); }
    finally{ setLoading(false); }
  },[]);

  useEffect(()=>{ loadData(); },[loadData]);

  useEffect(()=>{
    if(view==='loans'&&loans.length===0) loadLoans();
    if((view==='loans'||view==='salary_structure')&&employees.length===0) loadEmployees();
  },[view]);

  const loadLoans=async()=>{
    setLoansLoading(true);
    try{ setLoans(await payrollApi.getLoans()); }
    catch{ toast.error('Failed to load loans'); }
    finally{ setLoansLoading(false); }
  };
  const loadEmployees=async()=>{
    try{ const r=await employeesApi.getAll({}); setEmployees(r.data||r); setEmpList(r.data||r); }
    catch{}
  };

  const openPeriod=async(p:any)=>{
    setPdLoading(true);
    setActivePeriod(null);
    setView('period_detail');
    try{
      const detail=await payrollApi.getPeriodById(p.id);
      setActivePeriod(detail);
    }catch{ toast.error('Failed to load period details'); }
    finally{ setPdLoading(false); }
  };

  const doGenerate=async()=>{
    if(!activePeriod) return;
    try{
      const r=await payrollApi.generateSlips(activePeriod.id);
      toast.success(r.message||'Slips generated');
      const detail=await payrollApi.getPeriodById(activePeriod.id);
      setActivePeriod(detail); loadData();
    }catch(e:any){ toast.error(e.message||'Failed to generate slips'); }
  };

  const doApprove=async()=>{
    if(!activePeriod||!confirm('Approve this payroll? This will lock all slips.')) return;
    try{
      await payrollApi.approvePeriod(activePeriod.id);
      toast.success('Payroll approved');
      const detail=await payrollApi.getPeriodById(activePeriod.id);
      setActivePeriod(detail); loadData();
    }catch(e:any){ toast.error(e.message||'Failed to approve'); }
  };

  const doMarkPaid=async()=>{
    if(!activePeriod||!confirm('Mark all slips as PAID? This cannot be undone.')) return;
    try{
      await payrollApi.markPaid(activePeriod.id);
      toast.success('Payroll marked as paid');
      const detail=await payrollApi.getPeriodById(activePeriod.id);
      setActivePeriod(detail); loadData();
    }catch(e:any){ toast.error(e.message||'Failed to mark paid'); }
  };

  const openSlipEdit=(slip:any)=>{
    setEditSlip(slip);
    setSlipForm({
      basicSalary:slip.basic_salary,housingAllowance:slip.housing_allowance,
      transportAllowance:slip.transport_allowance,foodAllowance:slip.food_allowance,
      phoneAllowance:slip.phone_allowance,otherAllowance:slip.other_allowance,
      overtimeHours:slip.overtime_hours,overtimeAmount:slip.overtime_amount,
      bonusAmount:slip.bonus_amount,bonusNote:slip.bonus_note||'',
      gosiEmployee:slip.gosi_employee,loanDeduction:slip.loan_deduction,
      absenceDeduction:slip.absence_deduction,otherDeduction:slip.other_deduction,
      otherDeductionNote:slip.other_deduction_note||'',
      daysAbsent:slip.days_absent,workingDays:slip.working_days,
      paymentMethod:slip.payment_method||'bank_transfer',notes:slip.notes||'',
    });
  };

  const saveSlip=async()=>{
    if(!editSlip) return;
    setSlipSaving(true);
    try{
      await payrollApi.updateSlip(editSlip.id,slipForm);
      toast.success('Slip updated');
      setEditSlip(null);
      const detail=await payrollApi.getPeriodById(activePeriod.id);
      setActivePeriod(detail);
    }catch(e:any){ toast.error(e.message||'Failed to save'); }
    finally{ setSlipSaving(false); }
  };

  const doCreatePeriod=async()=>{
    setCreating(true);
    try{
      await payrollApi.createPeriod({month:newPeriod.month,year:newPeriod.year,paymentDate:newPeriod.paymentDate||undefined,notes:newPeriod.notes||undefined});
      toast.success('Payroll period created');
      setShowNewPeriod(false);
      loadData();
    }catch(e:any){ toast.error(e.message||'Failed to create period'); }
    finally{ setCreating(false); }
  };

  const doCreateLoan=async()=>{
    setLoanSaving(true);
    try{
      await payrollApi.createLoan(loanForm);
      toast.success('Loan recorded');
      setShowLoanForm(false);
      setLoanForm({employeeId:'',loanAmount:'',monthlyDeduction:'',disbursedDate:'',reason:'',notes:''});
      loadLoans();
    }catch(e:any){ toast.error(e.message||'Failed to create loan'); }
    finally{ setLoanSaving(false); }
  };

  const openSalaryStructure=async(emp:any)=>{
    setSsEmployee(emp);
    try{
      const data=await payrollApi.getSalaryStructure(emp.id);
      setSsData(data);
      const active=data.find((s:any)=>s.is_active);
      if(active){
        setSsForm({
          effectiveFrom:active.effective_from?.slice(0,10)||'',
          basicSalary:active.basic_salary,housingAllowance:active.housing_allowance,
          transportAllowance:active.transport_allowance,foodAllowance:active.food_allowance,
          phoneAllowance:active.phone_allowance,otherAllowance:active.other_allowance,
          otherAllowanceLabel:active.other_allowance_label||'',
          gosiEmployeePct:active.gosi_employee_pct,gosiEmployerPct:active.gosi_employer_pct,
          notes:active.notes||'',
        });
      }
    }catch{ toast.error('Failed to load salary structure'); }
  };

  const saveSalaryStructure=async()=>{
    if(!ssEmployee) return;
    setSsSaving(true);
    try{
      await payrollApi.upsertSalaryStructure(ssEmployee.id,ssForm);
      toast.success('Salary structure saved');
      const data=await payrollApi.getSalaryStructure(ssEmployee.id);
      setSsData(data);
    }catch(e:any){ toast.error(e.message||'Failed to save'); }
    finally{ setSsSaving(false); }
  };

  const sf=(k:string)=>(e:any)=>setSlipForm((p:any)=>({...p,[k]:e.target.value}));
  const ssf=(k:string)=>(e:any)=>setSsForm(p=>({...p,[k]:e.target.value}));

  // Computed slip totals for preview
  const slipGross=()=>{
    const n=(v:any)=>parseFloat(v)||0;
    return n(slipForm.basicSalary)+n(slipForm.housingAllowance)+n(slipForm.transportAllowance)+
           n(slipForm.foodAllowance)+n(slipForm.phoneAllowance)+n(slipForm.otherAllowance)+
           n(slipForm.overtimeAmount)+n(slipForm.bonusAmount);
  };
  const slipDeductions=()=>{
    const n=(v:any)=>parseFloat(v)||0;
    return n(slipForm.gosiEmployee)+n(slipForm.loanDeduction)+n(slipForm.absenceDeduction)+n(slipForm.otherDeduction);
  };
  const slipNet=()=>slipGross()-slipDeductions();

  const filteredEmp=empList.filter(e=>{
    if(!ssSearch) return true;
    const q=ssSearch.toLowerCase();
    return `${e.first_name} ${e.last_name}`.toLowerCase().includes(q)||e.department?.toLowerCase().includes(q)||(e.employee_code||'').toLowerCase().includes(q);
  });

  if(loading) return <div className="flex items-center justify-center py-32 text-slate-500 text-sm">Loading payroll…</div>;

  return(
    <div className="space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-white">Payroll</h1>
          <p className="text-xs text-slate-500 mt-0.5">Salary processing · Loans · GOSI compliance</p>
        </div>
        <div className="flex items-center gap-2">
          {(['periods','loans','salary_structure'] as const).map(v=>(
            <button key={v} onClick={()=>{setView(v);if(v==='period_detail')return;}}
              className={`px-3 py-2 text-xs font-medium rounded-lg transition-colors capitalize ${view===v||( v==='periods'&&view==='period_detail')?'bg-blue-600 text-white':'bg-[#1a1d27] text-slate-400 hover:text-white border border-white/5'}`}>
              {v.replace('_',' ')}
            </button>
          ))}
        </div>
      </div>

      {/* KPIs */}
      {(view==='periods'||view==='period_detail')&&stats&&(
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KPI label="Last Period" value={stats.latestPeriod?fmtPeriod(stats.latestPeriod.period_month,stats.latestPeriod.period_year):'—'} sub={stats.latestPeriod?.status}/>
          <KPI label="YTD Gross" value={fmtSAR(stats.ytdCost?.gross)} sub="this year" color="text-blue-400"/>
          <KPI label="YTD Net Paid" value={fmtSAR(stats.ytdCost?.net)} sub="after deductions" color="text-emerald-400"/>
          <KPI label="Active Loans" value={stats.activeLoans?.count||'0'} sub={fmtSAR(stats.activeLoans?.total)+' outstanding'} color="text-amber-400"/>
        </div>
      )}

      {/* ── PERIODS LIST ─────────────────────────────────────────────── */}
      {view==='periods'&&(
        <>
          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-500">{periods.length} payroll period{periods.length!==1?'s':''}</p>
            {canEdit&&(
              <button onClick={()=>setShowNewPeriod(true)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-lg transition-colors">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/></svg>
                New Period
              </button>
            )}
          </div>
          <div className="bg-[#1a1d27] rounded-xl border border-white/5 overflow-hidden">
            <table className="w-full text-xs">
              <thead><tr className="border-b border-white/5">
                {['Period','Employees','Gross Total','Deductions','Net Total','Payment Date','Status',''].map(h=>(
                  <th key={h} className="px-4 py-3 text-left text-[11px] font-medium text-slate-500 whitespace-nowrap">{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {periods.length===0?(
                  <tr><td colSpan={8} className="px-4 py-12 text-center text-slate-500">No payroll periods yet. Create your first one.</td></tr>
                ):periods.map(p=>(
                  <tr key={p.id} onClick={()=>openPeriod(p)} className="border-b border-white/5 hover:bg-white/5 transition-colors cursor-pointer">
                    <td className="px-4 py-3 font-semibold text-white">{fmtPeriod(p.period_month,p.period_year)}</td>
                    <td className="px-4 py-3 text-slate-400">{p.employee_count||0}</td>
                    <td className="px-4 py-3 text-white tabular-nums">{fmtSAR(p.total_gross)}</td>
                    <td className="px-4 py-3 text-red-400 tabular-nums">{fmtSAR(p.total_deductions)}</td>
                    <td className="px-4 py-3 text-emerald-400 font-semibold tabular-nums">{fmtSAR(p.total_net)}</td>
                    <td className="px-4 py-3 text-slate-400">{p.payment_date?new Date(p.payment_date).toLocaleDateString('en-GB'):'—'}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium border capitalize ${STATUS_STYLE[p.status]||''}`}>{p.status}</span>
                    </td>
                    <td className="px-4 py-3 text-blue-400 text-[11px]">View →</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ── PERIOD DETAIL ─────────────────────────────────────────────── */}
      {view==='period_detail'&&(
        <>
          <div className="flex items-center gap-3">
            <button onClick={()=>setView('periods')} className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/></svg>
              All Periods
            </button>
          </div>
          {pdLoading?(
            <div className="py-12 text-center text-slate-500 text-xs">Loading…</div>
          ):activePeriod&&(
            <>
              <div className="bg-[#1a1d27] rounded-xl border border-white/5 p-5">
                <div className="flex items-start justify-between flex-wrap gap-4">
                  <div>
                    <h2 className="text-lg font-bold text-white">{fmtPeriod(activePeriod.period_month,activePeriod.period_year)}</h2>
                    <span className={`mt-1 inline-block px-2 py-0.5 rounded-full text-[10px] font-medium border capitalize ${STATUS_STYLE[activePeriod.status]||''}`}>{activePeriod.status}</span>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    {canEdit&&activePeriod.status==='draft'&&(
                      <button onClick={doGenerate}
                        className="px-3 py-2 text-xs bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors font-medium">
                        {activePeriod.slips?.length>0?'Re-generate Slips':'Generate Slips'}
                      </button>
                    )}
                    {isSA&&activePeriod.status==='draft'&&activePeriod.slips?.length>0&&(
                      <button onClick={doApprove}
                        className="px-3 py-2 text-xs bg-amber-500 hover:bg-amber-400 text-black rounded-lg transition-colors font-medium">
                        Approve Payroll
                      </button>
                    )}
                    {isSA&&activePeriod.status==='approved'&&(
                      <button onClick={doMarkPaid}
                        className="px-3 py-2 text-xs bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-colors font-medium">
                        Mark as Paid
                      </button>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                  <div><p className="text-[10px] text-slate-500 uppercase tracking-wider">Employees</p><p className="text-sm font-bold text-white mt-0.5">{activePeriod.employee_count||0}</p></div>
                  <div><p className="text-[10px] text-slate-500 uppercase tracking-wider">Gross</p><p className="text-sm font-bold text-blue-400 mt-0.5 tabular-nums">{fmtSAR(activePeriod.total_gross)}</p></div>
                  <div><p className="text-[10px] text-slate-500 uppercase tracking-wider">Deductions</p><p className="text-sm font-bold text-red-400 mt-0.5 tabular-nums">{fmtSAR(activePeriod.total_deductions)}</p></div>
                  <div><p className="text-[10px] text-slate-500 uppercase tracking-wider">Net Payable</p><p className="text-sm font-bold text-emerald-400 mt-0.5 tabular-nums">{fmtSAR(activePeriod.total_net)}</p></div>
                </div>
              </div>

              {/* Slips table */}
              {activePeriod.slips?.length>0?(
                <div className="bg-[#1a1d27] rounded-xl border border-white/5 overflow-hidden">
                  <div className="px-5 py-3 border-b border-white/5 flex items-center justify-between">
                    <p className="text-xs font-semibold text-white">{activePeriod.slips.length} Pay Slips</p>
                    {activePeriod.status==='paid'&&(
                      <button onClick={()=>window.print()} className="text-xs text-slate-400 hover:text-white transition-colors flex items-center gap-1.5">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"/></svg>
                        Print All
                      </button>
                    )}
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead><tr className="border-b border-white/5">
                        {['Employee','Dept','Basic','Allowances','Overtime','Bonus','Gross','GOSI','Loans','Deductions','Net','Status',''].map(h=>(
                          <th key={h} className="px-4 py-3 text-left text-[11px] font-medium text-slate-500 whitespace-nowrap">{h}</th>
                        ))}
                      </tr></thead>
                      <tbody>
                        {activePeriod.slips.map((s:any)=>{
                          const allowances=(parseFloat(s.housing_allowance)||0)+(parseFloat(s.transport_allowance)||0)+(parseFloat(s.food_allowance)||0)+(parseFloat(s.phone_allowance)||0)+(parseFloat(s.other_allowance)||0);
                          return(
                            <tr key={s.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                              <td className="px-4 py-3 font-medium text-white whitespace-nowrap">{s.first_name} {s.last_name}</td>
                              <td className="px-4 py-3 text-slate-400">{s.department}</td>
                              <td className="px-4 py-3 text-slate-300 tabular-nums">{fmtSAR(s.basic_salary)}</td>
                              <td className="px-4 py-3 text-slate-300 tabular-nums">{fmtSAR(allowances)}</td>
                              <td className="px-4 py-3 text-slate-300 tabular-nums">{parseFloat(s.overtime_amount)>0?fmtSAR(s.overtime_amount):'—'}</td>
                              <td className="px-4 py-3 text-slate-300 tabular-nums">{parseFloat(s.bonus_amount)>0?fmtSAR(s.bonus_amount):'—'}</td>
                              <td className="px-4 py-3 font-semibold text-blue-400 tabular-nums">{fmtSAR(s.gross_salary)}</td>
                              <td className="px-4 py-3 text-red-400/70 tabular-nums">{parseFloat(s.gosi_employee)>0?fmtSAR(s.gosi_employee):'—'}</td>
                              <td className="px-4 py-3 text-red-400/70 tabular-nums">{parseFloat(s.loan_deduction)>0?fmtSAR(s.loan_deduction):'—'}</td>
                              <td className="px-4 py-3 text-red-400 tabular-nums">{fmtSAR(s.total_deductions)}</td>
                              <td className="px-4 py-3 font-bold text-emerald-400 tabular-nums">{fmtSAR(s.net_salary)}</td>
                              <td className="px-4 py-3">
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium border capitalize ${STATUS_STYLE[s.status]||''}`}>{s.status}</span>
                              </td>
                              <td className="px-4 py-3">
                                {canEdit&&activePeriod.status==='draft'&&(
                                  <button onClick={()=>openSlipEdit(s)} className="text-[11px] text-blue-400 hover:text-blue-300 transition-colors">Edit</button>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              ):(
                <div className="bg-[#1a1d27] rounded-xl border border-white/5 py-12 text-center">
                  <p className="text-slate-500 text-xs">No slips yet.</p>
                  {canEdit&&<button onClick={doGenerate} className="mt-2 text-xs text-blue-400 hover:text-blue-300">Generate slips for all active employees</button>}
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* ── LOANS ─────────────────────────────────────────────────────── */}
      {view==='loans'&&(
        <>
          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-500">{loans.length} loan{loans.length!==1?'s':''}</p>
            {canEdit&&(
              <button onClick={()=>setShowLoanForm(true)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-lg transition-colors">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/></svg>
                New Loan
              </button>
            )}
          </div>
          <div className="bg-[#1a1d27] rounded-xl border border-white/5 overflow-hidden">
            <table className="w-full text-xs">
              <thead><tr className="border-b border-white/5">
                {['Employee','Dept','Loan Amount','Monthly Deduction','Disbursed','Total Paid','Remaining','Status',''].map(h=>(
                  <th key={h} className="px-4 py-3 text-left text-[11px] font-medium text-slate-500 whitespace-nowrap">{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {loansLoading?(
                  <tr><td colSpan={9} className="px-4 py-12 text-center text-slate-500">Loading…</td></tr>
                ):loans.length===0?(
                  <tr><td colSpan={9} className="px-4 py-12 text-center text-slate-500">No loans recorded</td></tr>
                ):loans.map(l=>(
                  <tr key={l.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                    <td className="px-4 py-3 font-medium text-white whitespace-nowrap">{l.first_name} {l.last_name}</td>
                    <td className="px-4 py-3 text-slate-400">{l.department}</td>
                    <td className="px-4 py-3 text-white tabular-nums">{fmtSAR(l.loan_amount)}</td>
                    <td className="px-4 py-3 text-slate-300 tabular-nums">{fmtSAR(l.monthly_deduction)}</td>
                    <td className="px-4 py-3 text-slate-400">{l.disbursed_date?new Date(l.disbursed_date).toLocaleDateString('en-GB'):'—'}</td>
                    <td className="px-4 py-3 text-emerald-400 tabular-nums">{fmtSAR(l.total_paid)}</td>
                    <td className="px-4 py-3 text-amber-400 font-semibold tabular-nums">{fmtSAR(l.remaining_balance)}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium capitalize ${
                        l.status==='active'?'bg-emerald-500/15 text-emerald-400':
                        l.status==='completed'?'bg-slate-500/15 text-slate-400':'bg-red-500/15 text-red-400'}`}>{l.status}</span>
                    </td>
                    <td className="px-4 py-3">
                      {canEdit&&l.status==='active'&&(
                        <button onClick={async()=>{await payrollApi.updateLoanStatus(l.id,'cancelled');toast.success('Loan cancelled');loadLoans();}}
                          className="text-[11px] text-red-400/60 hover:text-red-400 transition-colors">Cancel</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ── SALARY STRUCTURES ─────────────────────────────────────────── */}
      {view==='salary_structure'&&(
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Employee picker */}
            <div className="bg-[#1a1d27] rounded-xl border border-white/5 p-4">
              <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-3">Select Employee</p>
              <input value={ssSearch} onChange={e=>setSsSearch(e.target.value)} placeholder="Search name or department…"
                className="w-full mb-3 px-3 py-2 text-xs bg-[#0c0e13] border border-white/10 rounded-lg text-white placeholder-slate-600 focus:outline-none focus:border-blue-500/50"/>
              <div className="space-y-1 max-h-72 overflow-y-auto">
                {filteredEmp.map(e=>(
                  <button key={e.id} onClick={()=>openSalaryStructure(e)}
                    className={`w-full text-left px-3 py-2 rounded-lg transition-colors text-xs ${ssEmployee?.id===e.id?'bg-blue-600 text-white':'hover:bg-white/5 text-slate-300'}`}>
                    <p className="font-medium">{e.first_name} {e.last_name}</p>
                    <p className="text-[10px] text-slate-500 mt-0.5">{e.department} · {e.employee_code}</p>
                  </button>
                ))}
                {filteredEmp.length===0&&<p className="text-xs text-slate-600 text-center py-4">No employees found</p>}
              </div>
            </div>

            {/* Structure form */}
            <div className="md:col-span-2">
              {ssEmployee?(
                <div className="bg-[#1a1d27] rounded-xl border border-white/5 p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-semibold text-white">{ssEmployee.first_name} {ssEmployee.last_name}</h3>
                      <p className="text-[11px] text-slate-500">{ssEmployee.position} · {ssEmployee.department}</p>
                    </div>
                    {ssData.length>0&&(
                      <span className="text-[10px] text-slate-500">{ssData.length} revision{ssData.length!==1?'s':''}</span>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Effective From" required>
                      <input type="date" value={ssForm.effectiveFrom} onChange={ssf('effectiveFrom')} style={{colorScheme:'dark'}} className={dInp}/>
                    </Field>
                    <Field label="Basic Salary (SAR)" required>
                      <input type="number" min="0" step="0.01" value={ssForm.basicSalary} onChange={ssf('basicSalary')} className={inp} placeholder="0.00"/>
                    </Field>
                    <Field label="Housing Allowance">
                      <input type="number" min="0" value={ssForm.housingAllowance} onChange={ssf('housingAllowance')} className={inp} placeholder="0.00"/>
                    </Field>
                    <Field label="Transport Allowance">
                      <input type="number" min="0" value={ssForm.transportAllowance} onChange={ssf('transportAllowance')} className={inp} placeholder="0.00"/>
                    </Field>
                    <Field label="Food Allowance">
                      <input type="number" min="0" value={ssForm.foodAllowance} onChange={ssf('foodAllowance')} className={inp} placeholder="0.00"/>
                    </Field>
                    <Field label="Phone Allowance">
                      <input type="number" min="0" value={ssForm.phoneAllowance} onChange={ssf('phoneAllowance')} className={inp} placeholder="0.00"/>
                    </Field>
                    <Field label="Other Allowance Label">
                      <input value={ssForm.otherAllowanceLabel} onChange={ssf('otherAllowanceLabel')} className={inp} placeholder="e.g. Shift Allowance"/>
                    </Field>
                    <Field label="Other Allowance Amount">
                      <input type="number" min="0" value={ssForm.otherAllowance} onChange={ssf('otherAllowance')} className={inp} placeholder="0.00"/>
                    </Field>
                    <Field label="GOSI Employee %">
                      <input type="number" min="0" max="20" step="0.01" value={ssForm.gosiEmployeePct} onChange={ssf('gosiEmployeePct')} className={inp}/>
                    </Field>
                    <Field label="GOSI Employer %">
                      <input type="number" min="0" max="20" step="0.01" value={ssForm.gosiEmployerPct} onChange={ssf('gosiEmployerPct')} className={inp}/>
                    </Field>
                  </div>
                  {/* Live total preview */}
                  {ssForm.basicSalary&&(
                    <div className="bg-[#0c0e13] rounded-lg p-3 border border-white/5">
                      <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-2">Salary Preview</p>
                      <div className="grid grid-cols-3 gap-2 text-xs">
                        {[
                          {l:'Basic',v:ssForm.basicSalary},
                          {l:'Housing',v:ssForm.housingAllowance},
                          {l:'Transport',v:ssForm.transportAllowance},
                          {l:'Food',v:ssForm.foodAllowance},
                          {l:'Phone',v:ssForm.phoneAllowance},
                          {l:ssForm.otherAllowanceLabel||'Other',v:ssForm.otherAllowance},
                        ].map(({l,v})=>(
                          <div key={l}><span className="text-slate-500">{l}: </span><span className="text-white tabular-nums">{fmtSAR(v||0)}</span></div>
                        ))}
                      </div>
                      <div className="border-t border-white/5 mt-2 pt-2 flex justify-between">
                        <span className="text-slate-400 text-xs">Total Package</span>
                        <span className="text-blue-400 font-bold tabular-nums text-xs">{fmtSAR(
                          [ssForm.basicSalary,ssForm.housingAllowance,ssForm.transportAllowance,ssForm.foodAllowance,ssForm.phoneAllowance,ssForm.otherAllowance].reduce((a,v)=>a+(parseFloat(v)||0),0)
                        )}</span>
                      </div>
                    </div>
                  )}
                  <Field label="Notes">
                    <textarea value={ssForm.notes} onChange={ssf('notes')} rows={2} className={inp+' resize-none'} placeholder="Reason for revision…"/>
                  </Field>
                  <button onClick={saveSalaryStructure} disabled={ssSaving}
                    className="w-full py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-semibold rounded-lg transition-colors">
                    {ssSaving?'Saving…':'Save Salary Structure'}
                  </button>

                  {/* History */}
                  {ssData.length>0&&(
                    <div>
                      <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-2">Revision History</p>
                      <div className="space-y-1">
                        {ssData.map((s:any)=>(
                          <div key={s.id} className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs ${s.is_active?'bg-blue-500/10 border border-blue-500/20':'bg-white/3 border border-white/5'}`}>
                            <span className="text-slate-300">{new Date(s.effective_from).toLocaleDateString('en-GB')}</span>
                            <span className="text-white tabular-nums">{fmtSAR(s.basic_salary)} basic</span>
                            {s.is_active&&<span className="text-[10px] text-blue-400">Active</span>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ):(
                <div className="bg-[#1a1d27] rounded-xl border border-white/5 flex items-center justify-center h-48">
                  <p className="text-slate-500 text-xs">Select an employee to view or edit their salary structure</p>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* ── SLIP EDIT MODAL ───────────────────────────────────────────── */}
      {editSlip&&(
        <div className="fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={()=>setEditSlip(null)}/>
          <div className="relative ml-auto w-full max-w-lg bg-[#0d0f14] border-l border-white/5 h-full overflow-y-auto flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 sticky top-0 bg-[#0d0f14] z-10">
              <div>
                <h2 className="text-sm font-semibold text-white">Edit Pay Slip</h2>
                <p className="text-[11px] text-slate-500">{editSlip.first_name} {editSlip.last_name}</p>
              </div>
              <button onClick={()=>setEditSlip(null)} className="p-1.5 rounded-md hover:bg-white/5 text-slate-400 hover:text-white">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
              </button>
            </div>
            <div className="flex-1 p-6 space-y-5">

              {/* Attendance */}
              <div>
                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-3">Attendance</p>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Working Days"><input type="number" value={slipForm.workingDays} onChange={sf('workingDays')} className={inp}/></Field>
                  <Field label="Days Absent"><input type="number" value={slipForm.daysAbsent} onChange={sf('daysAbsent')} className={inp}/></Field>
                </div>
              </div>

              {/* Earnings */}
              <div>
                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-3">Earnings</p>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Basic Salary"><input type="number" value={slipForm.basicSalary} onChange={sf('basicSalary')} className={inp}/></Field>
                  <Field label="Housing Allowance"><input type="number" value={slipForm.housingAllowance} onChange={sf('housingAllowance')} className={inp}/></Field>
                  <Field label="Transport Allowance"><input type="number" value={slipForm.transportAllowance} onChange={sf('transportAllowance')} className={inp}/></Field>
                  <Field label="Food Allowance"><input type="number" value={slipForm.foodAllowance} onChange={sf('foodAllowance')} className={inp}/></Field>
                  <Field label="Phone Allowance"><input type="number" value={slipForm.phoneAllowance} onChange={sf('phoneAllowance')} className={inp}/></Field>
                  <Field label="Other Allowance"><input type="number" value={slipForm.otherAllowance} onChange={sf('otherAllowance')} className={inp}/></Field>
                  <Field label="Overtime Hours"><input type="number" step="0.5" value={slipForm.overtimeHours} onChange={sf('overtimeHours')} className={inp}/></Field>
                  <Field label="Overtime Amount"><input type="number" value={slipForm.overtimeAmount} onChange={sf('overtimeAmount')} className={inp}/></Field>
                  <Field label="Bonus Amount"><input type="number" value={slipForm.bonusAmount} onChange={sf('bonusAmount')} className={inp}/></Field>
                  <Field label="Bonus Note"><input value={slipForm.bonusNote} onChange={sf('bonusNote')} className={inp} placeholder="e.g. Annual bonus"/></Field>
                </div>
              </div>

              {/* Deductions */}
              <div>
                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-3">Deductions</p>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="GOSI (Employee)"><input type="number" value={slipForm.gosiEmployee} onChange={sf('gosiEmployee')} className={inp}/></Field>
                  <Field label="Loan Deduction"><input type="number" value={slipForm.loanDeduction} onChange={sf('loanDeduction')} className={inp}/></Field>
                  <Field label="Absence Deduction"><input type="number" value={slipForm.absenceDeduction} onChange={sf('absenceDeduction')} className={inp}/></Field>
                  <Field label="Other Deduction"><input type="number" value={slipForm.otherDeduction} onChange={sf('otherDeduction')} className={inp}/></Field>
                  <div className="col-span-2"><Field label="Other Deduction Note"><input value={slipForm.otherDeductionNote} onChange={sf('otherDeductionNote')} className={inp}/></Field></div>
                </div>
              </div>

              {/* Live summary */}
              <div className="bg-[#0c0e13] rounded-lg p-4 border border-white/5">
                <div className="flex justify-between text-xs mb-1"><span className="text-slate-400">Gross</span><span className="text-blue-400 font-semibold tabular-nums">{fmtSAR(slipGross())}</span></div>
                <div className="flex justify-between text-xs mb-1"><span className="text-slate-400">Deductions</span><span className="text-red-400 tabular-nums">- {fmtSAR(slipDeductions())}</span></div>
                <div className="flex justify-between text-xs font-bold border-t border-white/5 pt-2 mt-2"><span className="text-white">Net Payable</span><span className="text-emerald-400 tabular-nums">{fmtSAR(slipNet())}</span></div>
              </div>

              <Field label="Payment Method">
                <select value={slipForm.paymentMethod} onChange={sf('paymentMethod')} className={sel}>
                  <option value="bank_transfer">Bank Transfer</option>
                  <option value="cash">Cash</option>
                  <option value="cheque">Cheque</option>
                </select>
              </Field>
              <Field label="Notes">
                <textarea value={slipForm.notes} onChange={sf('notes')} rows={2} className={inp+' resize-none'} placeholder="Any notes for this slip…"/>
              </Field>
            </div>
            <div className="px-6 py-4 border-t border-white/5 flex gap-3 sticky bottom-0 bg-[#0d0f14]">
              <button onClick={()=>setEditSlip(null)} className="flex-1 py-2 text-xs border border-white/10 rounded-lg text-slate-400 hover:text-white transition-colors">Cancel</button>
              <button onClick={saveSlip} disabled={slipSaving}
                className="flex-1 py-2 text-xs font-semibold bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-lg transition-colors">
                {slipSaving?'Saving…':'Save Slip'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── NEW PERIOD MODAL ──────────────────────────────────────────── */}
      {showNewPeriod&&(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={()=>setShowNewPeriod(false)}/>
          <div className="relative w-full max-w-sm bg-[#0d0f14] rounded-2xl border border-white/10 shadow-2xl p-6">
            <h2 className="text-sm font-semibold text-white mb-5">New Payroll Period</h2>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Month" required>
                  <select value={newPeriod.month} onChange={e=>setNewPeriod(p=>({...p,month:e.target.value}))} className={sel}>
                    {MONTHS.map((m,i)=><option key={i+1} value={i+1}>{m}</option>)}
                  </select>
                </Field>
                <Field label="Year" required>
                  <input type="number" value={newPeriod.year} onChange={e=>setNewPeriod(p=>({...p,year:e.target.value}))} className={inp} min="2020" max="2030"/>
                </Field>
              </div>
              <Field label="Payment Date">
                <input type="date" value={newPeriod.paymentDate} onChange={e=>setNewPeriod(p=>({...p,paymentDate:e.target.value}))} style={{colorScheme:'dark'}} className={dInp}/>
              </Field>
              <Field label="Notes">
                <textarea value={newPeriod.notes} onChange={e=>setNewPeriod(p=>({...p,notes:e.target.value}))} rows={2} className={inp+' resize-none'} placeholder="Optional notes…"/>
              </Field>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={()=>setShowNewPeriod(false)} className="flex-1 py-2 text-xs border border-white/10 rounded-lg text-slate-400 hover:text-white transition-colors">Cancel</button>
              <button onClick={doCreatePeriod} disabled={creating}
                className="flex-1 py-2 text-xs font-semibold bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-lg transition-colors">
                {creating?'Creating…':'Create Period'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── NEW LOAN MODAL ────────────────────────────────────────────── */}
      {showLoanForm&&(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={()=>setShowLoanForm(false)}/>
          <div className="relative w-full max-w-sm bg-[#0d0f14] rounded-2xl border border-white/10 shadow-2xl p-6">
            <h2 className="text-sm font-semibold text-white mb-5">Record Employee Loan</h2>
            <div className="space-y-3">
              <Field label="Employee" required>
                <select value={loanForm.employeeId} onChange={e=>setLoanForm(p=>({...p,employeeId:e.target.value}))} className={sel}>
                  <option value="">Select employee…</option>
                  {employees.map((e:any)=><option key={e.id} value={e.id}>{e.first_name} {e.last_name} · {e.department}</option>)}
                </select>
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Loan Amount (SAR)" required>
                  <input type="number" min="0" value={loanForm.loanAmount} onChange={e=>setLoanForm(p=>({...p,loanAmount:e.target.value}))} className={inp} placeholder="0.00"/>
                </Field>
                <Field label="Monthly Deduction" required>
                  <input type="number" min="0" value={loanForm.monthlyDeduction} onChange={e=>setLoanForm(p=>({...p,monthlyDeduction:e.target.value}))} className={inp} placeholder="0.00"/>
                </Field>
              </div>
              <Field label="Disbursed Date" required>
                <input type="date" value={loanForm.disbursedDate} onChange={e=>setLoanForm(p=>({...p,disbursedDate:e.target.value}))} style={{colorScheme:'dark'}} className={dInp}/>
              </Field>
              <Field label="Reason">
                <input value={loanForm.reason} onChange={e=>setLoanForm(p=>({...p,reason:e.target.value}))} className={inp} placeholder="e.g. Personal emergency"/>
              </Field>
              {loanForm.loanAmount&&loanForm.monthlyDeduction&&(
                <p className="text-[11px] text-slate-500 text-center">
                  Estimated payoff: ~{Math.ceil(parseFloat(loanForm.loanAmount)/parseFloat(loanForm.monthlyDeduction))} months
                </p>
              )}
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={()=>setShowLoanForm(false)} className="flex-1 py-2 text-xs border border-white/10 rounded-lg text-slate-400 hover:text-white transition-colors">Cancel</button>
              <button onClick={doCreateLoan} disabled={loanSaving}
                className="flex-1 py-2 text-xs font-semibold bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-lg transition-colors">
                {loanSaving?'Saving…':'Record Loan'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
