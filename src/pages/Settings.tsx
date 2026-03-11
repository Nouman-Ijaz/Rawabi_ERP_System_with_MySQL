import { useEffect, useState } from 'react';
import { settingsApi } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { inp, sel } from '@/lib/cx';

function Icon({name,className}:{name:string;className?:string}){
  const c=className||'w-4 h-4';
  const M:Record<string,any>={
    save:<svg className={c} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"/></svg>,
    check:<svg className={c} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/></svg>,
    building:<svg className={c} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/></svg>,
    receipt:<svg className={c} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z"/></svg>,
    clock:<svg className={c} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>,
    cog:<svg className={c} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/></svg>,
    info:<svg className={c} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>,
    lock:<svg className={c} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/></svg>,
  };
  return M[name]||<span/>;
}

function Section({icon,title,subtitle,children}:{icon:string;title:string;subtitle:string;children:React.ReactNode}){
  return(
    <div className="bg-[#1a1d27] rounded-xl border border-white/5 overflow-hidden">
      <div className="px-6 py-4 border-b border-white/5 flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center flex-shrink-0">
          <Icon name={icon} className="w-4 h-4 text-blue-400"/>
        </div>
        <div>
          <p className="text-sm font-semibold text-white">{title}</p>
          <p className="text-[11px] text-slate-500">{subtitle}</p>
        </div>
      </div>
      <div className="divide-y divide-white/5">{children}</div>
    </div>
  );
}

function Row({label,hint,children}:{label:string;hint?:string;children:React.ReactNode}){
  return(
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-start px-6 py-4">
      <div className="sm:pt-2">
        <p className="text-xs font-medium text-slate-300">{label}</p>
        {hint&&<p className="text-[11px] text-slate-600 mt-0.5 leading-relaxed">{hint}</p>}
      </div>
      <div className="sm:col-span-2">{children}</div>
    </div>
  );
}


export default function Settings(){
  const {hasPermission}=useAuth();
  const canEdit=hasPermission(['super_admin']);

  const [settings,setSettings]=useState<Record<string,string>>({});
  const [original,setOriginal]=useState<Record<string,string>>({});
  const [loading,  setLoading] =useState(true);
  const [saving,   setSaving]  =useState(false);
  const [saved,    setSaved]   =useState(false);

  useEffect(()=>{
    (async()=>{
      try{
        const data=await settingsApi.getAll();
        setSettings(data||{});
        setOriginal(data||{});
      }catch{toast.error('Failed to load settings');}
      finally{setLoading(false);}
    })();
  },[]);

  const set=(key:string)=>(e:React.ChangeEvent<HTMLInputElement|HTMLTextAreaElement|HTMLSelectElement>)=>
    setSettings(p=>({...p,[key]:e.target.value}));

  const isDirty=JSON.stringify(settings)!==JSON.stringify(original);

  const save=async()=>{
    setSaving(true);
    try{
      const changed:Record<string,string>={};
      Object.keys(settings).forEach(k=>{ if(settings[k]!==original[k])changed[k]=settings[k]; });
      if(!Object.keys(changed).length){ toast('No changes to save'); setSaving(false); return; }
      await settingsApi.update(changed);
      setOriginal({...settings});
      setSaved(true); setTimeout(()=>setSaved(false),3000);
      toast.success('Settings saved');
    }catch{ toast.error('Failed to save settings'); }
    finally{ setSaving(false); }
  };

  if(loading)return(
    <div className="space-y-4 max-w-3xl">
      <div className="h-8 w-40 bg-white/5 rounded-lg animate-pulse"/>
      <div className="h-64 bg-[#1a1d27] rounded-xl animate-pulse"/>
    </div>
  );

  const vatPrev = settings.tax_rate ? Number(settings.tax_rate) : 0;

  return(
    <div className="space-y-5 max-w-3xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Settings</h1>
          <p className="text-xs text-slate-500 mt-0.5">System configuration · changes apply across all modules</p>
        </div>
        {canEdit&&(
          <button onClick={save} disabled={saving||!isDirty}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-medium rounded-lg transition-all ${
              saved?'bg-emerald-600 text-white':isDirty?'bg-blue-600 hover:bg-blue-500 text-white':'bg-white/5 text-slate-500 cursor-not-allowed'
            }`}>
            {saved?<Icon name="check" className="w-3.5 h-3.5"/>:<Icon name="save" className="w-3.5 h-3.5"/>}
            {saving?'Saving…':saved?'Saved':'Save Changes'}
          </button>
        )}
      </div>

      {!canEdit&&(
        <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-3">
          <Icon name="info" className="w-4 h-4 text-amber-400 flex-shrink-0"/>
          <p className="text-xs text-amber-400">Read-only view. Only Super Admins can edit settings.</p>
        </div>
      )}

      {/* ── COMPANY INFORMATION ───────────────────────────── */}
      <Section icon="building" title="Company Information" subtitle="Displayed on invoices, PDFs and reports">
        <Row label="Company Name" hint="Legal registered name">
          <input value={settings.company_name||''} onChange={set('company_name')} className={inp} placeholder="Rawabi Al Hamsal Logistics" disabled={!canEdit}/>
        </Row>
        <Row label="Address" hint="Full registered address">
          <textarea value={settings.company_address||''} onChange={set('company_address')} rows={2}
            className={inp+' resize-none'} placeholder="Dammam, Kingdom of Saudi Arabia" disabled={!canEdit}/>
        </Row>
        <Row label="Primary Phone">
          <input value={settings.company_phone||''} onChange={set('company_phone')} className={inp} placeholder="+966 591 028747" disabled={!canEdit}/>
        </Row>
        <Row label="Secondary Phone">
          <input value={settings.company_phone_2||''} onChange={set('company_phone_2')} className={inp} placeholder="+966 xxx xxx xxxx" disabled={!canEdit}/>
        </Row>
        <Row label="Fax">
          <input value={settings.company_fax||''} onChange={set('company_fax')} className={inp} placeholder="+966 xxx xxx xxxx" disabled={!canEdit}/>
        </Row>
        <Row label="Email">
          <input type="email" value={settings.company_email||''} onChange={set('company_email')} className={inp} placeholder="info@rawabilogistics.com" disabled={!canEdit}/>
        </Row>
        <Row label="Website">
          <input value={settings.company_website||''} onChange={set('company_website')} className={inp} placeholder="https://rawabilogistics.com" disabled={!canEdit}/>
        </Row>
        <Row label="CR Number" hint="Commercial Registration number">
          <input value={settings.company_cr_number||''} onChange={set('company_cr_number')} className={inp} placeholder="1010XXXXXXX" disabled={!canEdit}/>
        </Row>
      </Section>

      {/* ── FINANCE & TAX ─────────────────────────────────── */}
      <Section icon="receipt" title="Finance &amp; Tax" subtitle="VAT registration, invoice settings and payment defaults">
        <Row label="VAT Registration No." hint="15-digit ZATCA number">
          <input value={settings.company_tax_number||''} onChange={set('company_tax_number')} className={inp} placeholder="310012345600003" disabled={!canEdit}/>
        </Row>
        <Row label="VAT Rate (%)" hint="Applied to all taxable invoices">
          <input type="number" step="0.01" min="0" max="100" value={settings.tax_rate||''} onChange={set('tax_rate')} className={inp} placeholder="15" disabled={!canEdit}/>
          {vatPrev>0&&(
            <p className="text-[11px] text-slate-500 mt-2">
              SAR 1,000 invoice → VAT: SAR {(1000*vatPrev/100).toFixed(2)} → Total: SAR {(1000+1000*vatPrev/100).toFixed(2)}
            </p>
          )}
        </Row>
        <Row label="Invoice Prefix" hint="Prefix for invoice numbers">
          <input value={settings.invoice_prefix||''} onChange={set('invoice_prefix')} className={inp} placeholder="INV" disabled={!canEdit}/>
        </Row>
        <Row label="Payment Terms (days)" hint="Default net days on invoices">
          <input type="number" min="0" value={settings.invoice_payment_terms||''} onChange={set('invoice_payment_terms')} className={inp} placeholder="30" disabled={!canEdit}/>
        </Row>
        <Row label="Currency" hint="System-wide currency code">
          <select value={settings.currency||'SAR'} onChange={set('currency')} className={sel} disabled={!canEdit}>
            <option value="SAR">SAR — Saudi Riyal</option>
            <option value="USD">USD — US Dollar</option>
            <option value="AED">AED — UAE Dirham</option>
            <option value="OMR">OMR — Omani Rial</option>
            <option value="KWD">KWD — Kuwaiti Dinar</option>
            <option value="BHD">BHD — Bahraini Dinar</option>
            <option value="QAR">QAR — Qatari Riyal</option>
          </select>
        </Row>
      </Section>

      {/* ── OPERATIONS ────────────────────────────────────── */}
      <Section icon="clock" title="Operations" subtitle="Working hours, leave policy and fiscal year">
        <Row label="Working Days" hint="Saudi standard is Sun–Thu. Click to toggle days on/off.">
          {(() => {
            const ALL_DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
            const active = (settings.working_days||'').split(',').map(d=>d.trim()).filter(Boolean);
            const toggle = (day: string) => {
              if (!canEdit) return;
              const next = active.includes(day)
                ? active.filter(d=>d!==day)
                : [...active, day].sort((a,b)=>ALL_DAYS.indexOf(a)-ALL_DAYS.indexOf(b));
              setSettings(p=>({...p, working_days: next.join(',')}));
            };
            return (
              <div className="flex gap-2 flex-wrap">
                {ALL_DAYS.map(day => {
                  const on = active.includes(day);
                  return (
                    <button key={day} type="button" onClick={()=>toggle(day)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                        on
                          ? 'bg-blue-600 border-blue-500 text-white'
                          : 'bg-[#0c0e13] border-white/10 text-slate-500 hover:text-slate-300 hover:border-white/20'
                      } ${!canEdit ? 'cursor-default opacity-60' : 'cursor-pointer'}`}>
                      {day}
                    </button>
                  );
                })}
              </div>
            );
          })()}
        </Row>
        <Row label="Shift Start Time">
          <input type="time" value={settings.working_hours_start||''} onChange={set('working_hours_start')} className={inp+' [color-scheme:dark]'} disabled={!canEdit}/>
        </Row>
        <Row label="Shift End Time">
          <input type="time" value={settings.working_hours_end||''} onChange={set('working_hours_end')} className={inp+' [color-scheme:dark]'} disabled={!canEdit}/>
        </Row>
        <Row label="Fiscal Year Start" hint="MM-DD format · Saudi default: 01-01">
          <input value={settings.fiscal_year_start||''} onChange={set('fiscal_year_start')} className={inp} placeholder="01-01" disabled={!canEdit}/>
        </Row>
        <Row label="Default Annual Leave" hint="Days per year · Saudi Labor Law minimum is 21">
          <input type="number" min="21" value={settings.default_annual_leave||''} onChange={set('default_annual_leave')} className={inp} placeholder="21" disabled={!canEdit}/>
          <p className="text-[11px] text-slate-600 mt-1.5">Saudi Labor Law Article 109: minimum 21 days for first 5 years, 30 days after.</p>
        </Row>
      </Section>

      {/* ── SYSTEM ────────────────────────────────────────── */}
      <Section icon="cog" title="System" subtitle="Timezone, date format and session settings">
        <Row label="Timezone">
          <select value={settings.timezone||'Asia/Riyadh'} onChange={set('timezone')} className={sel} disabled={!canEdit}>
            {['Asia/Riyadh','Asia/Dubai','Africa/Cairo','Europe/London','America/New_York','Asia/Karachi','Asia/Kolkata'].map(tz=>(
              <option key={tz} value={tz}>{tz}</option>
            ))}
          </select>
        </Row>
        <Row label="Date Format">
          <select value={settings.date_format||'DD/MM/YYYY'} onChange={set('date_format')} className={sel} disabled={!canEdit}>
            <option value="DD/MM/YYYY">DD/MM/YYYY</option>
            <option value="MM/DD/YYYY">MM/DD/YYYY</option>
            <option value="YYYY-MM-DD">YYYY-MM-DD (ISO)</option>
          </select>
        </Row>
        <Row label="Session Timeout" hint="Minutes of inactivity before forced logout">
          <input type="number" min="5" max="1440" value={settings.session_timeout_minutes||''} onChange={set('session_timeout_minutes')} className={inp} placeholder="60" disabled={!canEdit}/>
        </Row>
        <Row label="Min Password Length" hint="Enforced on new passwords and resets">
          <input type="number" min="6" max="32" value={settings.password_min_length||''} onChange={set('password_min_length')} className={inp} placeholder="8" disabled={!canEdit}/>
        </Row>
      </Section>

      {/* ── SECURITY ──────────────────────────────────────── */}
      <Section icon="lock" title="Security" subtitle="Read-only summary of current security configuration">
        <div className="px-6 py-4">
          <div className="grid grid-cols-2 gap-3">
            {[
              {label:'Password Hashing',  value:'bcrypt rounds=12'},
              {label:'Auth Method',       value:'JWT Bearer Token'},
              {label:'RBAC Roles',        value:'super_admin · admin · office_admin · dispatcher · accountant · driver'},
              {label:'Approval Workflow', value:'Shipments require admin approval before dispatch'},
              {label:'Activity Logging',  value:'All create / update / delete operations logged'},
              {label:'SQL Injection',     value:'Parameterized queries throughout'},
            ].map(item=>(
              <div key={item.label} className="bg-[#0c0e13] rounded-lg p-3 border border-white/5">
                <p className="text-[10px] text-slate-500">{item.label}</p>
                <p className="text-[11px] text-slate-300 mt-0.5">{item.value}</p>
              </div>
            ))}
          </div>
        </div>
      </Section>

      {/* ── SYSTEM INFO ───────────────────────────────────── */}
      <div className="bg-[#1a1d27] rounded-xl border border-white/5 px-6 py-5">
        <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-3">System Information</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
          {[
            {label:'Platform',   value:'Rawabi Logistics ERP v2.0'},
            {label:'Database',   value:'MySQL 8.x'},
            {label:'Backend',    value:'Node.js + Express'},
            {label:'Frontend',   value:'React 18 + Vite + Tailwind'},
            {label:'Environment',value:'Production'},
            {label:'Auth',       value:'JWT + bcrypt'},
          ].map(item=>(
            <div key={item.label} className="bg-[#0c0e13] rounded-lg p-3 border border-white/5">
              <p className="text-[10px] text-slate-500">{item.label}</p>
              <p className="text-slate-300 mt-0.5">{item.value}</p>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
