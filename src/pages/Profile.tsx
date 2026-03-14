import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { authApi } from '@/lib/api';
import { toast } from 'sonner';
import { fmtDate } from '@/lib/format';
import Icon from '@/components/Icon';
const dash = (v: any) => (v !== null && v !== undefined && v !== '') ? String(v) : '—';

function Section({ icon, title, children }: { icon: string; title: string; children: React.ReactNode }) {
  return (
    <div className="bg-[#1a1d27] rounded-xl border border-white/5 overflow-hidden">
      <div className="px-5 py-3.5 border-b border-white/5 flex items-center gap-2.5">
        <div className="w-7 h-7 rounded-lg bg-blue-500/10 flex items-center justify-center flex-shrink-0">
          <Icon name={icon} className="w-3.5 h-3.5 text-blue-400" />
        </div>
        <p className="text-sm font-semibold text-white">{title}</p>
      </div>
      <div className="divide-y divide-white/5">{children}</div>
    </div>
  );
}

function Row({ label, value, highlight }: { label: string; value: string; highlight?: string }) {
  return (
    <div className="flex items-center justify-between px-5 py-3 gap-4">
      <span className="text-xs text-slate-500 flex-shrink-0 w-48">{label}</span>
      <span className={`text-xs text-right font-medium ${highlight || 'text-slate-200'}`}>{value}</span>
    </div>
  );
}

function ExpiryRow({ label, date }: { label: string; date: string }) {
  if (!date) return <Row label={label} value="—" />;
  const daysLeft = Math.floor((new Date(date).getTime() - Date.now()) / 86400000);
  const color = daysLeft < 0 ? 'text-red-400' : daysLeft < 30 ? 'text-amber-400' : 'text-emerald-400';
  const note  = daysLeft < 0 ? ` · expired ${Math.abs(daysLeft)}d ago` : daysLeft < 30 ? ` · ${daysLeft}d left` : '';
  return <Row label={label} value={`${fmtDate(date)}${note}`} highlight={color} />;
}

const ROLE_LABEL: Record<string, string> = {
  super_admin: 'Super Admin', admin: 'Admin', accountant: 'Accountant',
  office_admin: 'Office Admin', dispatcher: 'Dispatcher', driver: 'Driver',
};
const ROLE_STYLE: Record<string, string> = {
  super_admin: 'bg-red-500/20 text-red-300 border-red-500/20',
  admin:       'bg-blue-500/20 text-blue-300 border-blue-500/20',
  accountant:  'bg-emerald-500/20 text-emerald-300 border-emerald-500/20',
  office_admin:'bg-purple-500/20 text-purple-300 border-purple-500/20',
  dispatcher:  'bg-amber-500/20 text-amber-300 border-amber-500/20',
  driver:      'bg-cyan-500/20 text-cyan-300 border-cyan-500/20',
};

export default function Profile() {
  const { user } = useAuth();
  const [emp, setEmp]           = useState<any>(null);
  const [loading, setLoading]   = useState(true);
  const [noRecord, setNoRecord] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const token = localStorage.getItem('token');
        const res   = await fetch('/api/profile/employee', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.status === 404) { setNoRecord(true); return; }
        if (!res.ok) throw new Error('Failed');
        setEmp(await res.json());
      } catch {
        toast.error('Could not load your employee profile');
      } finally { setLoading(false); }
    })();
  }, []);

  if (loading) return (
    <div className="max-w-3xl space-y-4">
      {[1,2,3].map(i => <div key={i} className="h-36 bg-[#1a1d27] rounded-xl animate-pulse" />)}
    </div>
  );

  return (
    <div className="max-w-3xl space-y-4">

      {/* Header */}
      <div className="bg-[#1a1d27] rounded-xl border border-white/5 p-6 flex items-center gap-5">
        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-xl font-bold text-white flex-shrink-0">
          {user?.firstName?.[0]}{user?.lastName?.[0]}
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-bold text-white">{user?.firstName} {user?.lastName}</h1>
          <p className="text-xs text-slate-400 mt-0.5">{user?.email}</p>
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${ROLE_STYLE[user?.role || ''] || 'bg-slate-700/50 text-slate-300 border-white/10'}`}>
              {ROLE_LABEL[user?.role || ''] || user?.role}
            </span>
            {emp?.department && (
              <span className="text-[10px] px-2 py-0.5 rounded-full border border-white/10 bg-white/5 text-slate-400">
                {emp.department}
              </span>
            )}
            {emp?.status && (
              <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium capitalize ${
                emp.status === 'active' ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20' : 'bg-slate-500/15 text-slate-400 border-slate-500/20'
              }`}>
                {emp.status}
              </span>
            )}
          </div>
        </div>
        {emp?.employee_code && (
          <div className="text-right flex-shrink-0">
            <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-0.5">Employee Code</p>
            <p className="text-sm font-bold text-white">{emp.employee_code}</p>
          </div>
        )}
      </div>

      {/* No HR record warning */}
      {noRecord && (
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-5 flex items-start gap-3">
          <Icon name="alert" className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-amber-300">No employee record linked</p>
            <p className="text-xs text-amber-400/70 mt-1">Your account is not connected to an HR record. Contact your administrator.</p>
          </div>
        </div>
      )}

      {emp && (
        <>
          <Section icon="user" title="Personal Information">
            <Row label="Full Name"      value={`${emp.first_name} ${emp.last_name}`} />
            <Row label="Date of Birth"  value={fmtDate(emp.date_of_birth)} />
            {emp.age != null && <Row label="Age" value={`${emp.age} years`} />}
            <Row label="Gender"         value={dash(emp.gender)} />
            <Row label="Marital Status" value={dash(emp.marital_status)} />
            <Row label="Nationality"    value={dash(emp.nationality)} />
            <Row label="Address"        value={dash(emp.address)} />
          </Section>

          <Section icon="phone" title="Contact Information">
            <Row label="Work Email" value={dash(emp.email || emp.user_email)} />
            <Row label="Phone"      value={dash(emp.phone)} />
          </Section>

          <Section icon="briefcase" title="Employment Details">
            <Row label="Position"        value={dash(emp.position)} />
            <Row label="Department"      value={dash(emp.department)} />
            <Row label="Employment Type" value={dash(emp.employment_type)?.replace(/_/g,' ')} />
            <Row label="Contract Type"   value={dash(emp.contract_type)?.replace(/_/g,' ')} />
            <Row label="Work Location"   value={dash(emp.work_location)} />
            <Row label="Work Shift"      value={dash(emp.work_shift)?.replace(/_/g,' ')} />
            <Row label="Hire Date"       value={fmtDate(emp.hire_date)} />
            <Row label="Tenure"          value={emp.years_of_service != null ? `${emp.years_of_service} year${emp.years_of_service !== 1 ? 's' : ''}` : '—'} />
            {emp.manager_name?.trim() && <Row label="Direct Manager" value={emp.manager_name.trim()} />}
            {emp.annual_leave_entitlement != null && (
              <Row label="Annual Leave"  value={`${emp.annual_leave_entitlement} days/year`} />
            )}
          </Section>

          <Section icon="id" title="Document Expiry Dates">
            <ExpiryRow label="National ID Expiry"       date={emp.id_expiry} />
            <ExpiryRow label="Passport Expiry"          date={emp.passport_expiry} />
            <ExpiryRow label="Visa Expiry"              date={emp.visa_expiry} />
            <ExpiryRow label="Work Permit Expiry"       date={emp.work_permit_expiry} />
            <ExpiryRow label="Medical Insurance Expiry" date={emp.medical_insurance_expiry} />
          </Section>

          {(emp.emergency_contact_name || emp.emergency_contact_phone) && (
            <Section icon="shield" title="Emergency Contact">
              <Row label="Contact Name"  value={dash(emp.emergency_contact_name)} />
              <Row label="Contact Phone" value={dash(emp.emergency_contact_phone)} />
            </Section>
          )}

          {(emp.bank_name || emp.bank_iban) && (
            <Section icon="bank" title="Bank Details">
              <Row label="Bank Name" value={dash(emp.bank_name)} />
              <Row label="IBAN"      value={emp.bank_iban ? `****${emp.bank_iban.slice(-6)}` : '—'} />
            </Section>
          )}

          <p className="text-center text-[11px] text-slate-600 pb-2">
            Read-only view · Contact HR to update your records
          </p>
        </>
      )}
    </div>
  );
}
