import { useEffect, useState, useCallback } from 'react';
import { payrollApi, employeesApi } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { ROLES } from '@/lib/roles';
import { loadJsPDF } from '@/lib/pdf';
import { inp, sel } from '@/lib/cx';
import FormField from '@/components/FormField';
import Modal, { ModalFooter } from '@/components/Modal';
import { PAYROLL_STATUS } from '@/lib/statusStyles';
import { fmtSAR } from '@/lib/format';

// ── Helpers ──────────────────────────────────────────────────────────
const MONTHS  = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const fmtPeriod = (m: number, y: number) => `${MONTHS[m-1]} ${y}`;

// dInp alias — date inputs use inline style={{ colorScheme:'dark' }}
const dInp = inp;
const Field = FormField;

// ── Pay Slip Print Component ─────────────────────────────────────────
// ── Slip HTML builder (used by both print popup and PDF download) ────
function buildSlipHtml(slip: any): string {
  const fS = (n: any) => n != null ? `SAR ${Number(n).toLocaleString('en-SA',{minimumFractionDigits:2,maximumFractionDigits:2})}` : 'SAR 0.00';
  const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const periodLabel = slip.period_month && slip.period_year ? `${MONTHS[slip.period_month-1]} ${slip.period_year}` : '';
  const payDate = slip.payment_date ? new Date(slip.payment_date).toLocaleDateString('en-GB') : '';

  const earnRows = [
    ['Basic Salary', slip.basic_salary], ['Housing Allowance', slip.housing_allowance],
    ['Transport Allowance', slip.transport_allowance], ['Food Allowance', slip.food_allowance],
    ['Phone Allowance', slip.phone_allowance], ['Other Allowance', slip.other_allowance],
    ['Overtime', slip.overtime_amount], ['Bonus', slip.bonus_amount],
  ].filter(([,v]) => parseFloat(v as string) > 0)
   .map(([l,v]) => `<tr><td style="padding:4px 8px;color:#555">${l}</td><td style="padding:4px 8px;text-align:right;font-weight:500">${fS(v)}</td></tr>`)
   .join('');

  const dedRows = [
    ['GOSI (Employee 9.75%)', slip.gosi_employee], ['Loan Repayment', slip.loan_deduction],
    ['Absence Deduction', slip.absence_deduction], ['Other Deduction', slip.other_deduction],
  ].filter(([,v]) => parseFloat(v as string) > 0)
   .map(([l,v]) => `<tr><td style="padding:4px 8px;color:#555">${l}</td><td style="padding:4px 8px;text-align:right;color:#b91c1c;font-weight:500">${fS(v)}</td></tr>`)
   .join('') || '<tr><td colspan="2" style="padding:4px 8px;color:#aaa;font-style:italic">No deductions</td></tr>';

  return `<div class="payslip">
  <div style="display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #1e3a5f;padding-bottom:12px;margin-bottom:16px">
    <div><div style="font-size:18px;font-weight:bold;color:#1e3a5f">Rawabi Logistics</div><div style="color:#666;margin-top:2px">Payroll Department</div></div>
    <div style="text-align:right"><div style="font-size:14px;font-weight:bold;color:#1e3a5f">SALARY SLIP</div><div style="color:#666;margin-top:2px">${periodLabel}</div>${payDate?`<div style="color:#666">Paid: ${payDate}</div>`:''}</div>
  </div>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;background:#f8fafc;padding:12px;border-radius:6px;margin-bottom:16px">
    <table style="border-collapse:collapse;width:100%">
      <tr><td style="padding:3px 8px 3px 0;color:#666;white-space:nowrap">Employee Name:</td><td style="padding:3px 0;font-weight:500">${slip.first_name||''} ${slip.last_name||''}</td></tr>
      <tr><td style="padding:3px 8px 3px 0;color:#666">Code:</td><td style="padding:3px 0;font-weight:500">${slip.employee_code||'—'}</td></tr>
      <tr><td style="padding:3px 8px 3px 0;color:#666">Department:</td><td style="padding:3px 0;font-weight:500">${slip.department||'—'}</td></tr>
      <tr><td style="padding:3px 8px 3px 0;color:#666">Position:</td><td style="padding:3px 0;font-weight:500">${slip.position||'—'}</td></tr>
    </table>
    <table style="border-collapse:collapse;width:100%">
      <tr><td style="padding:3px 8px 3px 0;color:#666">Nationality:</td><td style="padding:3px 0;font-weight:500">${slip.nationality||'—'}</td></tr>
      <tr><td style="padding:3px 8px 3px 0;color:#666">Bank:</td><td style="padding:3px 0;font-weight:500">${slip.bank_name||'—'}</td></tr>
      <tr><td style="padding:3px 8px 3px 0;color:#666">IBAN:</td><td style="padding:3px 0;font-weight:500">${slip.bank_iban||'—'}</td></tr>
      <tr><td style="padding:3px 8px 3px 0;color:#666">Payment:</td><td style="padding:3px 0;font-weight:500">${(slip.payment_method||'bank_transfer').replace('_',' ')}</td></tr>
    </table>
  </div>
  <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:16px">
    <div style="text-align:center;padding:8px;border:1px solid #e2e8f0;border-radius:4px"><div style="font-size:16px;font-weight:bold;color:#1e3a5f">${slip.working_days||30}</div><div style="color:#666;font-size:10px">Working Days</div></div>
    <div style="text-align:center;padding:8px;border:1px solid #e2e8f0;border-radius:4px"><div style="font-size:16px;font-weight:bold;color:#1e3a5f">${slip.days_present||(slip.working_days-slip.days_absent)||30}</div><div style="color:#666;font-size:10px">Days Present</div></div>
    <div style="text-align:center;padding:8px;border:1px solid #e2e8f0;border-radius:4px"><div style="font-size:16px;font-weight:bold;color:#c41">${slip.days_absent||0}</div><div style="color:#666;font-size:10px">Days Absent</div></div>
  </div>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px">
    <div>
      <div style="background:#1e3a5f;color:white;padding:6px 10px;font-weight:bold;border-radius:4px 4px 0 0">EARNINGS</div>
      <table style="width:100%;border-collapse:collapse;border:1px solid #e2e8f0;border-top:none">
        <tbody>${earnRows}<tr style="background:#eff6ff;font-weight:bold"><td style="padding:6px 8px;color:#1e3a5f">GROSS TOTAL</td><td style="padding:6px 8px;text-align:right;color:#1e3a5f">${fS(slip.gross_salary)}</td></tr></tbody>
      </table>
    </div>
    <div>
      <div style="background:#7f1d1d;color:white;padding:6px 10px;font-weight:bold;border-radius:4px 4px 0 0">DEDUCTIONS</div>
      <table style="width:100%;border-collapse:collapse;border:1px solid #e2e8f0;border-top:none">
        <tbody>${dedRows}<tr style="background:#fef2f2;font-weight:bold"><td style="padding:6px 8px;color:#7f1d1d">TOTAL DEDUCTIONS</td><td style="padding:6px 8px;text-align:right;color:#7f1d1d">${fS(slip.total_deductions)}</td></tr></tbody>
      </table>
    </div>
  </div>
  <div style="background:#0f172a;color:white;padding:14px 16px;border-radius:6px;display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
    <div><div style="font-size:10px;color:#94a3b8;letter-spacing:.1em">NET SALARY PAYABLE</div><div style="font-size:20px;font-weight:bold;color:#34d399;margin-top:2px">${fS(slip.net_salary)}</div></div>
    <div style="text-align:right"><div style="font-size:10px;color:#94a3b8">EMPLOYER GOSI</div><div style="font-size:14px;color:#60a5fa;margin-top:2px">${fS(slip.gosi_employer)}</div><div style="font-size:9px;color:#64748b;margin-top:1px">(not deducted)</div></div>
  </div>
  ${slip.notes?`<div style="padding:8px;background:#f0f9ff;border:1px solid #bae6fd;border-radius:4px;margin-bottom:12px"><strong>Note:</strong> ${slip.notes}</div>`:''}
  <div style="border-top:1px solid #e2e8f0;padding-top:10px;display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-top:8px">
    <div style="text-align:center"><div style="border-top:1px solid #999;margin-top:24px;padding-top:4px;color:#666;font-size:10px">Employee Signature</div></div>
    <div style="text-align:center"><div style="border-top:1px solid #999;margin-top:24px;padding-top:4px;color:#666;font-size:10px">HR / Payroll</div></div>
    <div style="text-align:center"><div style="border-top:1px solid #999;margin-top:24px;padding-top:4px;color:#666;font-size:10px">Management</div></div>
  </div>
  <div style="text-align:center;color:#94a3b8;font-size:9px;margin-top:12px">Computer-generated salary slip · Rawabi Logistics · Confidential</div>
</div>`;
}

function slipWindowHtml(slips: any[], autoDownload = false): string {
  const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const label = slips.length === 1
    ? `${slips[0].first_name}_${slips[0].last_name}_${slips[0].period_month?MONTHS[slips[0].period_month-1]:''}${slips[0].period_year||''}`
    : `All_Slips_${slips[0]?.period_month?MONTHS[slips[0].period_month-1]:''}${slips[0]?.period_year||''}`;
  return `<!DOCTYPE html><html><head><meta charset="utf-8">
<title>Salary Slip — ${label}</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family:Arial,sans-serif; font-size:11px; background:white; color:#111; }
  .payslip { padding:32px; max-width:780px; margin:0 auto; page-break-after:always; }
  .payslip:last-child { page-break-after:avoid; }
  @media print { .payslip { padding:20px; } }
</style></head><body>
${slips.map(s => buildSlipHtml(s)).join('')}
<script>window.onload = function(){ window.print(); }<\/script>
</body></html>`;
}

// ── jsPDF loader (from CDN, cached after first load) ─────────────────

// ── Generate real PDF for pay slips ──────────────────────────────────
async function generateSlipPDF(slipsArr: any[], periodData?: any) {
  const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const fS = (n: any) => `SAR ${Number(n || 0).toLocaleString('en-SA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const merged = slipsArr.map(s => ({ ...s, ...(periodData ? {
    period_month: periodData.period_month,
    period_year:  periodData.period_year,
    payment_date: periodData.payment_date,
  } : {}) }));

  let JsPDF: any;
  try { JsPDF = await loadJsPDF(); }
  catch { triggerPrintPopup(merged); return; } // offline fallback

  const doc = new JsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();

  merged.forEach((slip, idx) => {
    if (idx > 0) doc.addPage();
    const period = slip.period_month && slip.period_year
      ? `${MONTHS[slip.period_month - 1]} ${slip.period_year}` : '';
    const payDate = slip.payment_date
      ? new Date(slip.payment_date).toLocaleDateString('en-GB') : '';

    let y = 12;

    // Header bar
    doc.setFillColor(30, 58, 95);
    doc.rect(10, y, W - 20, 18, 'F');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.setTextColor(255, 255, 255);
    doc.text('Rawabi Logistics', 15, y + 8);
    doc.setFontSize(11);
    doc.text('SALARY SLIP', W - 15, y + 7, { align: 'right' });
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8);
    doc.text('Payroll Department', 15, y + 14);
    if (period) doc.text(period, W - 15, y + 12, { align: 'right' });
    if (payDate) doc.text(`Paid: ${payDate}`, W - 15, y + 16.5, { align: 'right' });
    y += 23;

    // Employee info grid
    (doc as any).autoTable({
      startY: y, margin: { left: 10, right: 10 },
      styles: { fontSize: 8, cellPadding: 2.5 },
      columnStyles: {
        0: { cellWidth: 38, textColor: [100, 100, 100] },
        1: { fontStyle: 'bold' },
        2: { cellWidth: 38, textColor: [100, 100, 100] },
        3: { fontStyle: 'bold' },
      },
      body: [
        ['Employee Name', `${slip.first_name||''} ${slip.last_name||''}`, 'Nationality', slip.nationality||'—'],
        ['Employee Code', slip.employee_code||'—',                        'Bank',         slip.bank_name||'—'],
        ['Department',    slip.department||'—',                           'IBAN',         slip.bank_iban ? `****${slip.bank_iban.slice(-6)}` : '—'],
        ['Position',      slip.position||'—',                             'Payment',      (slip.payment_method||'bank_transfer').replace(/_/g,' ')],
      ],
      theme: 'plain',
    });
    y = (doc as any).lastAutoTable.finalY + 3;

    // Attendance bar
    (doc as any).autoTable({
      startY: y, margin: { left: 10, right: 10 },
      styles: { fontSize: 8, halign: 'center', cellPadding: 3 },
      headStyles: { fillColor: [248, 250, 252], textColor: [30, 58, 95], fontStyle: 'bold', fontSize: 8 },
      head: [['Working Days', 'Days Present', 'Days Absent']],
      body: [[
        slip.working_days || 30,
        slip.days_present || ((slip.working_days||30) - (slip.days_absent||0)),
        slip.days_absent || 0,
      ]],
    });
    y = (doc as any).lastAutoTable.finalY + 3;

    // Earnings items
    const earnRows = [
      ['Basic Salary',       slip.basic_salary],
      ['Housing Allowance',  slip.housing_allowance],
      ['Transport Allowance',slip.transport_allowance],
      ['Food Allowance',     slip.food_allowance],
      ['Phone Allowance',    slip.phone_allowance],
      ['Other Allowance',    slip.other_allowance],
      ['Overtime',           slip.overtime_amount],
      ['Bonus',              slip.bonus_amount],
    ].filter(([, v]) => parseFloat(v as string) > 0);

    const dedRows = [
      ['GOSI (Employee 9.75%)', slip.gosi_employee],
      ['Loan Repayment',        slip.loan_deduction],
      ['Absence Deduction',     slip.absence_deduction],
      ['Other Deduction',       slip.other_deduction],
    ].filter(([, v]) => parseFloat(v as string) > 0);

    const halfW = (W - 25) / 2;

    // Earnings table (left)
    (doc as any).autoTable({
      startY: y, margin: { left: 10, right: W / 2 + 2 }, tableWidth: halfW,
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [30, 58, 95], textColor: [255, 255, 255], fontStyle: 'bold' },
      columnStyles: { 1: { halign: 'right' } },
      head: [['EARNINGS', '']],
      body: [
        ...earnRows.map(([l, v]) => [l, fS(v)]),
        [
          { content: 'GROSS TOTAL', styles: { fontStyle: 'bold', fillColor: [239, 246, 255], textColor: [30, 58, 95] } },
          { content: fS(slip.gross_salary), styles: { fontStyle: 'bold', fillColor: [239, 246, 255], textColor: [30, 58, 95], halign: 'right' } },
        ],
      ],
    });
    const earnEndY = (doc as any).lastAutoTable.finalY;

    // Deductions table (right)
    (doc as any).autoTable({
      startY: y, margin: { left: W / 2 + 2, right: 10 }, tableWidth: halfW,
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [127, 29, 29], textColor: [255, 255, 255], fontStyle: 'bold' },
      columnStyles: { 1: { halign: 'right' } },
      head: [['DEDUCTIONS', '']],
      body: [
        ...(dedRows.length ? dedRows.map(([l, v]) => [l, fS(v)]) : [['No deductions', '']]),
        [
          { content: 'TOTAL DEDUCTIONS', styles: { fontStyle: 'bold', fillColor: [254, 242, 242], textColor: [127, 29, 29] } },
          { content: fS(slip.total_deductions), styles: { fontStyle: 'bold', fillColor: [254, 242, 242], textColor: [127, 29, 29], halign: 'right' } },
        ],
      ],
    });
    y = Math.max(earnEndY, (doc as any).lastAutoTable.finalY) + 4;

    // Net pay box
    doc.setFillColor(15, 23, 42);
    doc.roundedRect(10, y, W - 20, 18, 2, 2, 'F');
    doc.setTextColor(148, 163, 184); doc.setFontSize(7.5); doc.setFont('helvetica', 'normal');
    doc.text('NET SALARY PAYABLE', 15, y + 6.5);
    doc.setTextColor(52, 211, 153); doc.setFontSize(13); doc.setFont('helvetica', 'bold');
    doc.text(fS(slip.net_salary), 15, y + 14.5);
    doc.setTextColor(148, 163, 184); doc.setFontSize(7.5); doc.setFont('helvetica', 'normal');
    doc.text('EMPLOYER GOSI (not deducted)', W - 15, y + 6.5, { align: 'right' });
    doc.setTextColor(96, 165, 250); doc.setFontSize(10);
    doc.text(fS(slip.gosi_employer), W - 15, y + 14.5, { align: 'right' });
    y += 23;

    // Notes (if any)
    if (slip.notes) {
      doc.setFillColor(240, 249, 255); doc.setDrawColor(186, 230, 253);
      doc.roundedRect(10, y, W - 20, 8, 1, 1, 'FD');
      doc.setTextColor(30, 64, 175); doc.setFontSize(7.5); doc.setFont('helvetica', 'bold');
      doc.text('Note:', 14, y + 5);
      doc.setFont('helvetica', 'normal'); doc.setTextColor(0, 0, 0);
      doc.text(slip.notes, 25, y + 5);
      y += 12;
    }

    // Signature lines
    doc.setDrawColor(180, 180, 180); doc.setTextColor(150, 150, 150); doc.setFontSize(8);
    const sigW = (W - 20) / 3;
    ['Employee Signature', 'HR / Payroll', 'Management'].forEach((label, i) => {
      const x = 10 + i * sigW;
      doc.line(x + 5, y + 12, x + sigW - 5, y + 12);
      doc.setFont('helvetica', 'normal');
      doc.text(label, x + sigW / 2, y + 17, { align: 'center' });
    });
    y += 22;

    // Footer
    doc.setTextColor(180, 180, 180); doc.setFontSize(7);
    doc.text('Computer-generated salary slip · Rawabi Logistics · Confidential', W / 2, y, { align: 'center' });
  });

  const fname = merged.length === 1
    ? `Salary_Slip_${merged[0].first_name}_${merged[0].last_name}_${merged[0].period_month ? MONTHS[merged[0].period_month - 1] : ''}${merged[0].period_year || ''}.pdf`
    : `Salary_Slips_All_${merged[0]?.period_month ? MONTHS[merged[0].period_month - 1] : ''}${merged[0]?.period_year || ''}.pdf`;
  doc.save(fname);
}

// Opens print dialog in popup window
function triggerPrintPopup(slipsArr: any[], periodData?: any) {
  const merged = slipsArr.map(s => ({ ...s, ...(periodData ? {
    period_month: periodData.period_month,
    period_year:  periodData.period_year,
    payment_date: periodData.payment_date,
  } : {}) }));
  const win = window.open('', '_blank', 'width=920,height=720');
  if (!win) { alert('Pop-up blocked. Allow pop-ups for this site.'); return; }
  win.document.write(slipWindowHtml(merged));
  win.document.close();
}


// ── Main ─────────────────────────────────────────────────────────────
// ── Main ─────────────────────────────────────────────────────────────
export default function Payroll() {
  const { hasPermission, user } = useAuth();
  const isSA     = hasPermission(ROLES.SUPER_ADMIN);
  const canEdit  = hasPermission(ROLES.PAY_EDIT);
  const isPayView= hasPermission(ROLES.PAY_VIEW);

  type View = 'periods' | 'period_detail' | 'loans' | 'salary_structure' | 'my_slips';
  const [view, setView]             = useState<View>(isPayView ? 'periods' : 'my_slips');
  const [stats, setStats]           = useState<any>(null);
  const [periods, setPeriods]       = useState<any[]>([]);
  const [loading, setLoading]       = useState(true);
  const [activePeriod, setActivePeriod] = useState<any>(null);
  const [pdLoading, setPdLoading]   = useState(false);

  // Slip edit
  const [editSlip, setEditSlip]     = useState<any|null>(null);
  const [slipForm, setSlipForm]     = useState<any>({});
  const [slipSaving, setSlipSaving] = useState(false);

  // Print — uses popup window (see triggerPrintPopup/downloadSlipFile above)

  // New period
  const [showNewPeriod, setShowNewPeriod] = useState(false);
  const [newPeriod, setNewPeriod] = useState({ month: String(new Date().getMonth()+1), year: String(new Date().getFullYear()), paymentDate:'', notes:'' });
  const [creating, setCreating]   = useState(false);

  // Loans
  const [loans, setLoans]           = useState<any[]>([]);
  const [loansLoading, setLoansLoading] = useState(false);
  const [showLoanForm, setShowLoanForm] = useState(false);
  const [employees, setEmployees]   = useState<any[]>([]);
  const [loanForm, setLoanForm]     = useState({employeeId:'',loanAmount:'',monthlyDeduction:'',disbursedDate:'',reason:'',notes:''});
  const [loanSaving, setLoanSaving] = useState(false);

  // Salary structure
  const [ssEmployee, setSsEmployee] = useState<any|null>(null);
  const [ssData, setSsData]         = useState<any[]>([]);
  const [ssForm, setSsForm]         = useState({effectiveFrom:'',basicSalary:'',housingAllowance:'',transportAllowance:'',foodAllowance:'',phoneAllowance:'',otherAllowance:'',otherAllowanceLabel:'',gosiEmployeePct:'9.75',gosiEmployerPct:'11.75',notes:''});
  const [ssSaving, setSsSaving]     = useState(false);
  const [ssSearch, setSsSearch]     = useState('');
  const [empList, setEmpList]       = useState<any[]>([]);

  // My slips (for non-admin users)
  const [mySlips, setMySlips]       = useState<any[]>([]);
  const [mySlipsLoading, setMySlipsLoading] = useState(false);

  // YTD modal
  const [ytdData, setYtdData]       = useState<any|null>(null);
  const [ytdName, setYtdName]       = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      if (isPayView) {
        const [s, p] = await Promise.all([payrollApi.getStats(), payrollApi.getPeriods()]);
        setStats(s); setPeriods(p);
      }
    } catch { toast.error('Failed to load payroll data'); }
    finally { setLoading(false); }
  }, [isPayView]);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    if (view === 'loans' && loans.length === 0) loadLoans();
    if ((view === 'loans' || view === 'salary_structure') && employees.length === 0) loadEmployees();
    if (view === 'my_slips' && mySlips.length === 0) loadMySlips();
  }, [view]);

  const loadLoans     = async () => { setLoansLoading(true); try { setLoans(await payrollApi.getLoans()); } catch { toast.error('Failed to load loans'); } finally { setLoansLoading(false); } };
  const loadEmployees = async () => { try { const r = await employeesApi.getAll({}); setEmployees(r.data||r); setEmpList(r.data||r); } catch {} };
  const loadMySlips   = async () => { setMySlipsLoading(true); try { setMySlips(await payrollApi.getMySlips()); } catch { toast.error('Failed to load your slips'); } finally { setMySlipsLoading(false); } };

  const openPeriod = async (p: any) => {
    setPdLoading(true); setActivePeriod(null); setView('period_detail');
    try { setActivePeriod(await payrollApi.getPeriodById(p.id)); }
    catch { toast.error('Failed to load period'); }
    finally { setPdLoading(false); }
  };

  const doGenerate = async () => {
    if (!activePeriod) return;
    try {
      const r = await payrollApi.generateSlips(activePeriod.id);
      toast.success(r.message || 'Slips generated');
      setActivePeriod(await payrollApi.getPeriodById(activePeriod.id));
      loadData();
    } catch (e: any) { toast.error(e.message || 'Failed'); }
  };

  const doApprove = async () => {
    if (!activePeriod || !confirm('Approve payroll? This locks all draft slips.')) return;
    try {
      await payrollApi.approvePeriod(activePeriod.id);
      toast.success('Payroll approved');
      setActivePeriod(await payrollApi.getPeriodById(activePeriod.id)); loadData();
    } catch (e: any) { toast.error(e.message || 'Failed'); }
  };

  const doMarkPaid = async () => {
    if (!activePeriod || !confirm('Mark all slips as PAID? Cannot be undone.')) return;
    try {
      await payrollApi.markPaid(activePeriod.id);
      toast.success('Payroll marked as paid');
      setActivePeriod(await payrollApi.getPeriodById(activePeriod.id)); loadData();
    } catch (e: any) { toast.error(e.message || 'Failed'); }
  };

  // Delegate to module-level helpers
  const triggerPrint   = (s: any[], p?: any) => triggerPrintPopup(s, p);
  const triggerDownload = (s: any[], p?: any) => { generateSlipPDF(s, p); };

  const openSlipEdit = (slip: any) => {
    setEditSlip(slip);
    setSlipForm({
      basicSalary: slip.basic_salary, housingAllowance: slip.housing_allowance,
      transportAllowance: slip.transport_allowance, foodAllowance: slip.food_allowance,
      phoneAllowance: slip.phone_allowance, otherAllowance: slip.other_allowance,
      overtimeHours: slip.overtime_hours, overtimeAmount: slip.overtime_amount,
      bonusAmount: slip.bonus_amount, bonusNote: slip.bonus_note||'',
      gosiEmployee: slip.gosi_employee, loanDeduction: slip.loan_deduction,
      absenceDeduction: slip.absence_deduction, otherDeduction: slip.other_deduction,
      otherDeductionNote: slip.other_deduction_note||'',
      daysAbsent: slip.days_absent, workingDays: slip.working_days,
      paymentMethod: slip.payment_method||'bank_transfer', notes: slip.notes||'',
    });
  };

  const saveSlip = async () => {
    if (!editSlip) return;
    setSlipSaving(true);
    try {
      await payrollApi.updateSlip(editSlip.id, slipForm);
      toast.success('Slip updated');
      setEditSlip(null);
      setActivePeriod(await payrollApi.getPeriodById(activePeriod.id));
    } catch (e: any) { toast.error(e.message || 'Failed'); }
    finally { setSlipSaving(false); }
  };

  const doCreatePeriod = async () => {
    setCreating(true);
    try {
      await payrollApi.createPeriod({ month: newPeriod.month, year: newPeriod.year, paymentDate: newPeriod.paymentDate || undefined, notes: newPeriod.notes || undefined });
      toast.success('Period created'); setShowNewPeriod(false); loadData();
    } catch (e: any) { toast.error(e.message || 'Failed'); }
    finally { setCreating(false); }
  };

  const doCreateLoan = async () => {
    setLoanSaving(true);
    try {
      await payrollApi.createLoan(loanForm);
      toast.success('Loan recorded'); setShowLoanForm(false);
      setLoanForm({employeeId:'',loanAmount:'',monthlyDeduction:'',disbursedDate:'',reason:'',notes:''});
      loadLoans();
    } catch (e: any) { toast.error(e.message || 'Failed'); }
    finally { setLoanSaving(false); }
  };

  const openSalaryStructure = async (emp: any) => {
    setSsEmployee(emp);
    try {
      const data = await payrollApi.getSalaryStructure(emp.id);
      setSsData(data);
      const active = data.find((s: any) => s.is_active);
      if (active) {
        setSsForm({ effectiveFrom: active.effective_from?.slice(0,10)||'', basicSalary: active.basic_salary, housingAllowance: active.housing_allowance, transportAllowance: active.transport_allowance, foodAllowance: active.food_allowance, phoneAllowance: active.phone_allowance, otherAllowance: active.other_allowance, otherAllowanceLabel: active.other_allowance_label||'', gosiEmployeePct: active.gosi_employee_pct, gosiEmployerPct: active.gosi_employer_pct, notes: active.notes||'' });
      } else {
        setSsForm({effectiveFrom:'',basicSalary:'',housingAllowance:'',transportAllowance:'',foodAllowance:'',phoneAllowance:'',otherAllowance:'',otherAllowanceLabel:'',gosiEmployeePct:'9.75',gosiEmployerPct:'11.75',notes:''});
      }
    } catch { toast.error('Failed to load salary structure'); }
  };

  const saveSalaryStructure = async () => {
    if (!ssEmployee) return;
    setSsSaving(true);
    try {
      await payrollApi.upsertSalaryStructure(ssEmployee.id, ssForm);
      toast.success('Salary structure saved');
      setSsData(await payrollApi.getSalaryStructure(ssEmployee.id));
    } catch (e: any) { toast.error(e.message || 'Failed'); }
    finally { setSsSaving(false); }
  };

  const openYTD = async (slip: any) => {
    try {
      const data = await payrollApi.getEmployeeYTD(slip.employee_id);
      setYtdData(data);
      setYtdName(`${slip.first_name} ${slip.last_name}`);
    } catch { toast.error('Failed to load YTD'); }
  };

  const sf  = (k: string) => (e: any) => setSlipForm((p: any) => ({...p, [k]: e.target.value}));
  const ssf = (k: string) => (e: any) => setSsForm(p => ({...p, [k]: e.target.value}));

  const slipGross = () => {
    const n = (v: any) => parseFloat(v)||0;
    return n(slipForm.basicSalary)+n(slipForm.housingAllowance)+n(slipForm.transportAllowance)+n(slipForm.foodAllowance)+n(slipForm.phoneAllowance)+n(slipForm.otherAllowance)+n(slipForm.overtimeAmount)+n(slipForm.bonusAmount);
  };
  const slipDed  = () => { const n=(v:any)=>parseFloat(v)||0; return n(slipForm.gosiEmployee)+n(slipForm.loanDeduction)+n(slipForm.absenceDeduction)+n(slipForm.otherDeduction); };
  const slipNet  = () => slipGross() - slipDed();
  const filteredEmp = empList.filter(e => { if (!ssSearch) return true; const q=ssSearch.toLowerCase(); return `${e.first_name} ${e.last_name}`.toLowerCase().includes(q)||e.department?.toLowerCase().includes(q)||(e.employee_code||'').toLowerCase().includes(q); });

  if (loading && isPayView) return <div className="flex items-center justify-center py-32 text-slate-500 text-sm">Loading payroll…</div>;

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-white">Payroll</h1>
          <p className="text-xs text-slate-500 mt-0.5">Salary processing · Loans · GOSI compliance</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {isPayView && (['periods','loans','salary_structure'] as const).map(v => (
            <button key={v} onClick={() => setView(v)}
              className={`px-3 py-2 min-h-[44px] text-xs font-medium rounded-lg transition-colors capitalize ${view===v||( v==='periods'&&view==='period_detail') ? 'bg-blue-600 text-white' : 'bg-[#1a1d27] text-slate-400 hover:text-white border border-white/5'}`}>
              {v.replace('_',' ')}
            </button>
          ))}
          {/* Every user sees their own slips */}
          <button onClick={() => setView('my_slips')}
            className={`px-3 py-2 min-h-[44px] text-xs font-medium rounded-lg transition-colors ${view==='my_slips' ? 'bg-emerald-600 text-white' : 'bg-[#1a1d27] text-slate-400 hover:text-white border border-white/5'}`}>
            {isPayView ? 'My Slips' : 'My Salary Slips'}
          </button>
        </div>
      </div>

      {/* KPIs */}
      {(view==='periods'||view==='period_detail') && stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-[#1a1d27] rounded-xl border border-white/5 p-4"><p className="text-[11px] text-slate-500 uppercase tracking-wider mb-1">Last Period</p><p className="text-xl font-bold text-white">{stats.latestPeriod ? fmtPeriod(stats.latestPeriod.period_month,stats.latestPeriod.period_year) : '—'}</p><p className="text-[11px] text-slate-500 mt-0.5 capitalize">{stats.latestPeriod?.status||'—'}</p></div>
          <div className="bg-[#1a1d27] rounded-xl border border-white/5 p-4"><p className="text-[11px] text-slate-500 uppercase tracking-wider mb-1">YTD Gross</p><p className="text-xl font-bold text-blue-400 tabular-nums">{fmtSAR(stats.ytdCost?.gross)}</p><p className="text-[11px] text-slate-500 mt-0.5">this year</p></div>
          <div className="bg-[#1a1d27] rounded-xl border border-white/5 p-4"><p className="text-[11px] text-slate-500 uppercase tracking-wider mb-1">YTD Net Paid</p><p className="text-xl font-bold text-emerald-400 tabular-nums">{fmtSAR(stats.ytdCost?.net)}</p><p className="text-[11px] text-slate-500 mt-0.5">after deductions</p></div>
          <div className="bg-[#1a1d27] rounded-xl border border-white/5 p-4"><p className="text-[11px] text-slate-500 uppercase tracking-wider mb-1">Active Loans</p><p className="text-xl font-bold text-amber-400">{stats.activeLoans?.count||'0'}</p><p className="text-[11px] text-slate-500 mt-0.5 tabular-nums">{fmtSAR(stats.activeLoans?.total)} outstanding</p></div>
        </div>
      )}

      {/* ── PERIODS LIST ─────────────────────────────────────────────── */}
      {view === 'periods' && (
        <>
          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-500">{periods.length} period{periods.length!==1?'s':''}</p>
            {canEdit && (
              <button onClick={() => setShowNewPeriod(true)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-lg transition-colors">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/></svg>
                New Period
              </button>
            )}
          </div>
          <div className="bg-[#1a1d27] rounded-xl border border-white/5 overflow-hidden">
            <table className="w-full text-xs">
              <thead><tr className="border-b border-white/5">{['Period','Employees','Gross','Deductions','Net','Payment Date','Status',''].map(h=><th key={h} className="px-4 py-3 text-left text-[11px] font-medium text-slate-500 whitespace-nowrap">{h}</th>)}</tr></thead>
              <tbody>
                {periods.length === 0 ? (
                  <tr><td colSpan={8} className="px-4 py-12 text-center text-slate-500">No periods yet.</td></tr>
                ) : periods.map(p => (
                  <tr key={p.id} onClick={() => openPeriod(p)} className="border-b border-white/5 hover:bg-white/5 transition-colors cursor-pointer">
                    <td className="px-4 py-3 font-semibold text-white">{fmtPeriod(p.period_month,p.period_year)}</td>
                    <td className="px-4 py-3 text-slate-400">{p.employee_count||0}</td>
                    <td className="px-4 py-3 text-white tabular-nums">{fmtSAR(p.total_gross)}</td>
                    <td className="px-4 py-3 text-red-400 tabular-nums">{fmtSAR(p.total_deductions)}</td>
                    <td className="px-4 py-3 text-emerald-400 font-semibold tabular-nums">{fmtSAR(p.total_net)}</td>
                    <td className="px-4 py-3 text-slate-400">{p.payment_date?new Date(p.payment_date).toLocaleDateString('en-GB'):'—'}</td>
                    <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-[10px] font-medium border capitalize ${PAYROLL_STATUS[p.status]||''}`}>{p.status}</span></td>
                    <td className="px-4 py-3 text-blue-400 text-[11px]">View →</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ── PERIOD DETAIL ─────────────────────────────────────────────── */}
      {view === 'period_detail' && (
        <>
          <button onClick={() => setView('periods')} className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/></svg>
            All Periods
          </button>
          {pdLoading ? (
            <div className="py-12 text-center text-slate-500 text-xs">Loading…</div>
          ) : activePeriod && (
            <>
              <div className="bg-[#1a1d27] rounded-xl border border-white/5 p-4 sm:p-5">
                <div className="flex items-start justify-between flex-wrap gap-4">
                  <div>
                    <h2 className="text-lg font-bold text-white">{fmtPeriod(activePeriod.period_month,activePeriod.period_year)}</h2>
                    <span className={`mt-1 inline-block px-2 py-0.5 rounded-full text-[10px] font-medium border capitalize ${PAYROLL_STATUS[activePeriod.status]||''}`}>{activePeriod.status}</span>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto">
                    {activePeriod.slips?.length > 0 && (
                      <>
                        <button onClick={() => triggerPrint(activePeriod.slips, activePeriod)}
                          className="flex items-center gap-1.5 px-3 py-2 min-h-[44px] text-xs border border-white/10 rounded-lg text-slate-400 hover:text-white transition-colors">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"/></svg>
                          Print All ({activePeriod.slips.length})
                        </button>
                        <button onClick={() => triggerDownload(activePeriod.slips, activePeriod)}
                          className="flex items-center gap-1.5 px-3 py-2 min-h-[44px] text-xs bg-emerald-600/20 border border-emerald-500/30 rounded-lg text-emerald-400 hover:bg-emerald-600/30 transition-colors">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 10v6m0 0l-3-3m3 3l3-3M3 17V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z"/></svg>
                          Download PDF
                        </button>
                      </>
                    )}
                    {canEdit && activePeriod.status==='draft' && (
                      <button onClick={doGenerate} className="px-3 py-2 min-h-[44px] text-xs bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors font-medium">
                        {activePeriod.slips?.length > 0 ? 'Re-generate Slips' : 'Generate Slips'}
                      </button>
                    )}
                    {isSA && activePeriod.status==='draft' && activePeriod.slips?.length > 0 && (
                      <button onClick={doApprove} className="px-3 py-2 min-h-[44px] text-xs bg-amber-500 hover:bg-amber-400 text-black rounded-lg transition-colors font-medium">Approve</button>
                    )}
                    {isSA && activePeriod.status==='approved' && (
                      <button onClick={doMarkPaid} className="px-3 py-2 min-h-[44px] text-xs bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-colors font-medium">Mark as Paid</button>
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

              {activePeriod.slips?.length > 0 ? (
                <div className="bg-[#1a1d27] rounded-xl border border-white/5 overflow-hidden">
                  <div className="px-5 py-3 border-b border-white/5">
                    <p className="text-xs font-semibold text-white">{activePeriod.slips.length} Pay Slips</p>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead><tr className="border-b border-white/5">{['Employee','Dept','Basic','Allowances','OT','Bonus','Gross','GOSI','Loan Ded.','Total Ded.','Net','Days','Status','Actions'].map(h=><th key={h} className="px-3 py-3 text-left text-[11px] font-medium text-slate-500 whitespace-nowrap">{h}</th>)}</tr></thead>
                      <tbody>
                        {activePeriod.slips.map((s: any) => {
                          const allowances = (parseFloat(s.housing_allowance)||0)+(parseFloat(s.transport_allowance)||0)+(parseFloat(s.food_allowance)||0)+(parseFloat(s.phone_allowance)||0)+(parseFloat(s.other_allowance)||0);
                          return (
                            <tr key={s.id} className="border-b border-white/5 hover:bg-white/5 transition-colors group">
                              <td className="px-3 py-3 font-medium text-white whitespace-nowrap">{s.first_name} {s.last_name}</td>
                              <td className="px-3 py-3 text-slate-400">{s.department}</td>
                              <td className="px-3 py-3 text-slate-300 tabular-nums">{fmtSAR(s.basic_salary)}</td>
                              <td className="px-3 py-3 text-slate-300 tabular-nums">{allowances>0?fmtSAR(allowances):'—'}</td>
                              <td className="px-3 py-3 text-slate-400 tabular-nums">{parseFloat(s.overtime_amount)>0?fmtSAR(s.overtime_amount):'—'}</td>
                              <td className="px-3 py-3 text-slate-400 tabular-nums">{parseFloat(s.bonus_amount)>0?fmtSAR(s.bonus_amount):'—'}</td>
                              <td className="px-3 py-3 font-semibold text-blue-400 tabular-nums">{fmtSAR(s.gross_salary)}</td>
                              <td className="px-3 py-3 text-red-400/70 tabular-nums">{parseFloat(s.gosi_employee)>0?fmtSAR(s.gosi_employee):'—'}</td>
                              <td className="px-3 py-3 text-red-400/70 tabular-nums">{parseFloat(s.loan_deduction)>0?fmtSAR(s.loan_deduction):'—'}</td>
                              <td className="px-3 py-3 text-red-400 tabular-nums">{fmtSAR(s.total_deductions)}</td>
                              <td className="px-3 py-3 font-bold text-emerald-400 tabular-nums">{fmtSAR(s.net_salary)}</td>
                              <td className="px-3 py-3 text-slate-500 tabular-nums text-[10px]">{s.days_present||0}/{s.working_days||30}</td>
                              <td className="px-3 py-3"><span className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium border capitalize ${PAYROLL_STATUS[s.status]||''}`}>{s.status}</span></td>
                              <td className="px-3 py-3">
                                <div className="flex items-center gap-2">
                                  {/* Individual print */}
                                  <button onClick={() => triggerPrint([s], activePeriod)} title="Print slip"
                                    className="p-1.5 rounded hover:bg-white/10 text-slate-500 hover:text-white transition-colors">
                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"/></svg>
                                  </button>
                                  {/* Individual PDF download */}
                                  <button onClick={() => triggerDownload([s], activePeriod)} title="Download PDF"
                                    className="p-1.5 rounded hover:bg-emerald-500/15 text-slate-500 hover:text-emerald-400 transition-colors">
                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 10v6m0 0l-3-3m3 3l3-3M3 17V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z"/></svg>
                                  </button>
                                  {/* YTD */}
                                  <button onClick={() => openYTD(s)} title="Year-to-date"
                                    className="p-1.5 rounded hover:bg-white/10 text-slate-500 hover:text-blue-400 transition-colors text-[10px] font-bold">
                                    YTD
                                  </button>
                                  {/* Edit (draft only) */}
                                  {canEdit && activePeriod.status === 'draft' && (
                                    <button onClick={() => openSlipEdit(s)} title="Edit slip"
                                      className="p-1.5 rounded hover:bg-blue-500/15 text-slate-500 hover:text-blue-400 transition-colors">
                                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="bg-[#1a1d27] rounded-xl border border-white/5 py-12 text-center">
                  <p className="text-slate-500 text-xs">No slips yet.</p>
                  {canEdit && <button onClick={doGenerate} className="mt-2 text-xs text-blue-400 hover:text-blue-300">Generate slips for all active employees →</button>}
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* ── MY SLIPS ──────────────────────────────────────────────────── */}
      {view === 'my_slips' && (
        <>
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-white">Your Pay Slips</p>
            <p className="text-xs text-slate-500">{user?.firstName} {user?.lastName}</p>
          </div>
          {mySlipsLoading ? (
            <div className="py-12 text-center text-slate-500 text-xs">Loading…</div>
          ) : mySlips.length === 0 ? (
            <div className="bg-[#1a1d27] rounded-xl border border-white/5 py-12 text-center">
              <p className="text-slate-500 text-xs">No pay slips found for your account.</p>
              <p className="text-slate-600 text-[11px] mt-1">Make sure your user account is linked to an employee record.</p>
            </div>
          ) : (
              <div className="space-y-3">
              {mySlips.map((s: any) => (
                <div key={s.id} className="bg-[#1a1d27] rounded-xl border border-white/5 p-4">
                  <div className="flex items-start justify-between flex-wrap gap-3">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center flex-shrink-0">
                        <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-white">{fmtPeriod(s.period_month,s.period_year)}</p>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          {s.payment_date ? `Paid ${new Date(s.payment_date).toLocaleDateString('en-GB')}` : 'Not yet paid'}
                          {' · '}<span className={`capitalize ${PAYROLL_STATUS[s.status]?.split(' ')[1]||'text-slate-400'}`}>{s.status}</span>
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 flex-wrap w-full sm:w-auto">
                      <div className="flex gap-4">
                        <div>
                          <p className="text-[10px] text-slate-500">Gross</p>
                          <p className="text-xs font-semibold text-white tabular-nums">{fmtSAR(s.gross_salary)}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-slate-500">Deductions</p>
                          <p className="text-xs text-red-400 tabular-nums">{fmtSAR(s.total_deductions)}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-slate-500">Net Pay</p>
                          <p className="text-sm font-bold text-emerald-400 tabular-nums">{fmtSAR(s.net_salary)}</p>
                        </div>
                      </div>
                      <div className="flex gap-2 w-full sm:w-auto">
                        <button onClick={() => triggerPrint([s])}
                          className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-2 min-h-[44px] text-xs bg-[#0c0e13] border border-white/10 rounded-lg text-slate-400 hover:text-white hover:border-white/20 transition-colors">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"/></svg>
                          Print
                        </button>
                        <button onClick={() => triggerDownload([s])}
                          className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-2 min-h-[44px] text-xs bg-emerald-600/10 border border-emerald-500/25 rounded-lg text-emerald-400 hover:bg-emerald-600/20 transition-colors">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 10v6m0 0l-3-3m3 3l3-3M3 17V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z"/></svg>
                          PDF
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* ── LOANS ────────────────────────────────────────────────────── */}
      {view === 'loans' && (
        <>
          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-500">{loans.length} loan{loans.length!==1?'s':''}</p>
            {canEdit && (
              <button onClick={() => setShowLoanForm(true)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-lg transition-colors">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/></svg>
                New Loan
              </button>
            )}
          </div>
          <div className="bg-[#1a1d27] rounded-xl border border-white/5 overflow-hidden">
            <table className="w-full text-xs">
              <thead><tr className="border-b border-white/5">{['Employee','Dept','Loan Amount','Monthly Deduction','Disbursed','Total Paid','Remaining','Status',''].map(h=><th key={h} className="px-4 py-3 text-left text-[11px] font-medium text-slate-500 whitespace-nowrap">{h}</th>)}</tr></thead>
              <tbody>
                {loansLoading ? <tr><td colSpan={9} className="px-4 py-12 text-center text-slate-500">Loading…</td></tr>
                : loans.length === 0 ? <tr><td colSpan={9} className="px-4 py-12 text-center text-slate-500">No loans recorded</td></tr>
                : loans.map(l => (
                  <tr key={l.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                    <td className="px-4 py-3 font-medium text-white whitespace-nowrap">{l.first_name} {l.last_name}</td>
                    <td className="px-4 py-3 text-slate-400">{l.department}</td>
                    <td className="px-4 py-3 text-white tabular-nums">{fmtSAR(l.loan_amount)}</td>
                    <td className="px-4 py-3 text-slate-300 tabular-nums">{fmtSAR(l.monthly_deduction)}</td>
                    <td className="px-4 py-3 text-slate-400">{l.disbursed_date?new Date(l.disbursed_date).toLocaleDateString('en-GB'):'—'}</td>
                    <td className="px-4 py-3 text-emerald-400 tabular-nums">{fmtSAR(l.total_paid)}</td>
                    <td className="px-4 py-3 text-amber-400 font-semibold tabular-nums">{fmtSAR(l.remaining_balance)}</td>
                    <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-[10px] font-medium capitalize ${l.status==='active'?'bg-emerald-500/15 text-emerald-400':l.status==='completed'?'bg-slate-500/15 text-slate-400':'bg-red-500/15 text-red-400'}`}>{l.status}</span></td>
                    <td className="px-4 py-3">{canEdit && l.status==='active' && <button onClick={async()=>{await payrollApi.updateLoanStatus(l.id,'cancelled');toast.success('Loan cancelled');loadLoans();}} className="text-[11px] text-red-400/60 hover:text-red-400 transition-colors">Cancel</button>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ── SALARY STRUCTURE ─────────────────────────────────────────── */}
      {view === 'salary_structure' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-[#1a1d27] rounded-xl border border-white/5 p-4">
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-3">Select Employee</p>
            <input value={ssSearch} onChange={e=>setSsSearch(e.target.value)} placeholder="Search…" className="w-full mb-3 px-3 py-2 text-xs bg-[#0c0e13] border border-white/10 rounded-lg text-white placeholder-slate-600 focus:outline-none"/>
            <div className="space-y-1 max-h-72 overflow-y-auto">
              {filteredEmp.map(e=>(
                <button key={e.id} onClick={()=>openSalaryStructure(e)}
                  className={`w-full text-left px-3 py-2 rounded-lg transition-colors text-xs ${ssEmployee?.id===e.id?'bg-blue-600 text-white':'hover:bg-white/5 text-slate-300'}`}>
                  <p className="font-medium">{e.first_name} {e.last_name}</p>
                  <p className="text-[10px] text-slate-500 mt-0.5">{e.department} · {e.employee_code}</p>
                </button>
              ))}
              {filteredEmp.length===0&&<p className="text-xs text-slate-600 text-center py-4">No results</p>}
            </div>
          </div>
          <div className="md:col-span-2">
            {ssEmployee ? (
              <div className="bg-[#1a1d27] rounded-xl border border-white/5 p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div><h3 className="text-sm font-semibold text-white">{ssEmployee.first_name} {ssEmployee.last_name}</h3><p className="text-[11px] text-slate-500">{ssEmployee.position} · {ssEmployee.department}</p></div>
                  {ssData.length>0&&<span className="text-[10px] text-slate-500">{ssData.length} revision{ssData.length!==1?'s':''}</span>}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Effective From" required><input type="date" value={ssForm.effectiveFrom} onChange={ssf('effectiveFrom')} style={{colorScheme:'dark'}} className={dInp}/></Field>
                  <Field label="Basic Salary (SAR)" required><input type="number" min="0" step="0.01" value={ssForm.basicSalary} onChange={ssf('basicSalary')} className={inp} placeholder="0.00"/></Field>
                  <Field label="Housing Allowance"><input type="number" min="0" value={ssForm.housingAllowance} onChange={ssf('housingAllowance')} className={inp} placeholder="0.00"/></Field>
                  <Field label="Transport Allowance"><input type="number" min="0" value={ssForm.transportAllowance} onChange={ssf('transportAllowance')} className={inp} placeholder="0.00"/></Field>
                  <Field label="Food Allowance"><input type="number" min="0" value={ssForm.foodAllowance} onChange={ssf('foodAllowance')} className={inp} placeholder="0.00"/></Field>
                  <Field label="Phone Allowance"><input type="number" min="0" value={ssForm.phoneAllowance} onChange={ssf('phoneAllowance')} className={inp} placeholder="0.00"/></Field>
                  <Field label="Other Allowance Label"><input value={ssForm.otherAllowanceLabel} onChange={ssf('otherAllowanceLabel')} className={inp} placeholder="e.g. Shift Allowance"/></Field>
                  <Field label="Other Allowance"><input type="number" min="0" value={ssForm.otherAllowance} onChange={ssf('otherAllowance')} className={inp} placeholder="0.00"/></Field>
                  <Field label="GOSI Employee %"><input type="number" min="0" max="20" step="0.01" value={ssForm.gosiEmployeePct} onChange={ssf('gosiEmployeePct')} className={inp}/></Field>
                  <Field label="GOSI Employer %"><input type="number" min="0" max="20" step="0.01" value={ssForm.gosiEmployerPct} onChange={ssf('gosiEmployerPct')} className={inp}/></Field>
                </div>
                {ssForm.basicSalary && (
                  <div className="bg-[#0c0e13] rounded-lg p-3 border border-white/5">
                    <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-2">Package Preview</p>
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      {[['Basic',ssForm.basicSalary],['Housing',ssForm.housingAllowance],['Transport',ssForm.transportAllowance],['Food',ssForm.foodAllowance],['Phone',ssForm.phoneAllowance],[ssForm.otherAllowanceLabel||'Other',ssForm.otherAllowance]].map(([l,v])=>(
                        <div key={l as string}><span className="text-slate-500">{l}: </span><span className="text-white tabular-nums">{fmtSAR(v||0)}</span></div>
                      ))}
                    </div>
                    <div className="border-t border-white/5 mt-2 pt-2 flex justify-between text-xs">
                      <span className="text-slate-400">Total Package</span>
                      <span className="text-blue-400 font-bold tabular-nums">{fmtSAR([ssForm.basicSalary,ssForm.housingAllowance,ssForm.transportAllowance,ssForm.foodAllowance,ssForm.phoneAllowance,ssForm.otherAllowance].reduce((a,v)=>a+(parseFloat(v)||0),0))}</span>
                    </div>
                  </div>
                )}
                <Field label="Notes"><textarea value={ssForm.notes} onChange={ssf('notes')} rows={2} className={inp+' resize-none'} placeholder="Reason for revision…"/></Field>
                <button onClick={saveSalaryStructure} disabled={ssSaving} className="w-full py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-semibold rounded-lg transition-colors">{ssSaving?'Saving…':'Save Salary Structure'}</button>
                {ssData.length > 0 && (
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
            ) : (
              <div className="bg-[#1a1d27] rounded-xl border border-white/5 flex items-center justify-center h-48">
                <p className="text-slate-500 text-xs">Select an employee to manage their salary structure</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── SLIP EDIT MODAL ──────────────────────────────────────────── */}
      {editSlip && (
        <div className="fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={()=>setEditSlip(null)}/>
          <div className="relative w-full sm:ml-auto sm:max-w-lg bg-[#0d0f14] sm:border-l border-t sm:border-t-0 border-white/5 h-full overflow-y-auto flex flex-col mt-auto sm:mt-0 max-h-[95vh] sm:max-h-full rounded-t-2xl sm:rounded-none">
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 sticky top-0 bg-[#0d0f14] z-10">
              <div><h2 className="text-sm font-semibold text-white">Edit Pay Slip</h2><p className="text-[11px] text-slate-500">{editSlip.first_name} {editSlip.last_name}</p></div>
              <button onClick={()=>setEditSlip(null)} className="p-1.5 rounded hover:bg-white/5 text-slate-400"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg></button>
            </div>
            <div className="flex-1 p-6 space-y-5">
              <div><p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-3">Attendance</p><div className="grid grid-cols-2 gap-3"><Field label="Working Days"><input type="number" value={slipForm.workingDays} onChange={sf('workingDays')} className={inp}/></Field><Field label="Days Absent"><input type="number" value={slipForm.daysAbsent} onChange={sf('daysAbsent')} className={inp}/></Field></div></div>
              <div><p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-3">Earnings</p>
                <div className="grid grid-cols-2 gap-3">
                  {[['basicSalary','Basic Salary'],['housingAllowance','Housing'],['transportAllowance','Transport'],['foodAllowance','Food'],['phoneAllowance','Phone'],['otherAllowance','Other Allow.'],['overtimeHours','OT Hours'],['overtimeAmount','OT Amount'],['bonusAmount','Bonus'],['bonusNote','Bonus Note']].map(([k,l])=>(
                    <Field key={k} label={l}><input type={k==='bonusNote'?'text':'number'} step={k==='overtimeHours'?'0.5':'0.01'} value={slipForm[k]} onChange={sf(k)} className={inp}/></Field>
                  ))}
                </div>
              </div>
              <div><p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-3">Deductions</p>
                <div className="grid grid-cols-2 gap-3">
                  {[['gosiEmployee','GOSI (Employee)'],['loanDeduction','Loan Deduction'],['absenceDeduction','Absence Deduction'],['otherDeduction','Other Deduction']].map(([k,l])=>(
                    <Field key={k} label={l}><input type="number" value={slipForm[k]} onChange={sf(k)} className={inp}/></Field>
                  ))}
                  <div className="col-span-2"><Field label="Other Deduction Note"><input value={slipForm.otherDeductionNote} onChange={sf('otherDeductionNote')} className={inp}/></Field></div>
                </div>
              </div>
              <div className="bg-[#0c0e13] rounded-lg p-4 border border-white/5">
                <div className="flex justify-between text-xs mb-1"><span className="text-slate-400">Gross</span><span className="text-blue-400 font-semibold tabular-nums">{fmtSAR(slipGross())}</span></div>
                <div className="flex justify-between text-xs mb-1"><span className="text-slate-400">Deductions</span><span className="text-red-400 tabular-nums">- {fmtSAR(slipDed())}</span></div>
                <div className="flex justify-between text-xs font-bold border-t border-white/5 pt-2 mt-2"><span className="text-white">Net Payable</span><span className="text-emerald-400 tabular-nums">{fmtSAR(slipNet())}</span></div>
              </div>
              <Field label="Payment Method"><select value={slipForm.paymentMethod} onChange={sf('paymentMethod')} className={sel}><option value="bank_transfer">Bank Transfer</option><option value="cash">Cash</option><option value="cheque">Cheque</option></select></Field>
              <Field label="Notes"><textarea value={slipForm.notes} onChange={sf('notes')} rows={2} className={inp+' resize-none'}/></Field>
            </div>
            <div className="px-6 py-4 border-t border-white/5 flex gap-3 sticky bottom-0 bg-[#0d0f14]">
              <button onClick={()=>setEditSlip(null)} className="flex-1 py-2 text-xs border border-white/10 rounded-lg text-slate-400 hover:text-white">Cancel</button>
              <button onClick={saveSlip} disabled={slipSaving} className="flex-1 py-2 text-xs font-semibold bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-lg">{slipSaving?'Saving…':'Save Slip'}</button>
            </div>
          </div>
        </div>
      )}

      {/* ── NEW PERIOD MODAL ─────────────────────────────────────────── */}
      <Modal
        open={showNewPeriod}
        onClose={() => setShowNewPeriod(false)}
        title="New Payroll Period"
        variant="centered"
        maxWidth="max-w-sm"
        footer={
          <ModalFooter
            onClose={() => setShowNewPeriod(false)}
            onSave={doCreatePeriod}
            saving={creating}
            saveLabel="Create Period"
          />
        }
      >
        <div className="p-6 space-y-3">
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Month" required><select value={newPeriod.month} onChange={e=>setNewPeriod(p=>({...p,month:e.target.value}))} className={sel}>{MONTHS.map((m,i)=><option key={i+1} value={i+1}>{m}</option>)}</select></Field>
        <Field label="Year" required><input type="number" value={newPeriod.year} onChange={e=>setNewPeriod(p=>({...p,year:e.target.value}))} className={inp} min="2020" max="2030"/></Field>
      </div>
      <Field label="Payment Date"><input type="date" value={newPeriod.paymentDate} onChange={e=>setNewPeriod(p=>({...p,paymentDate:e.target.value}))} style={{colorScheme:'dark'}} className={dInp}/></Field>
      <Field label="Notes"><textarea value={newPeriod.notes} onChange={e=>setNewPeriod(p=>({...p,notes:e.target.value}))} rows={2} className={inp+' resize-none'} placeholder="Optional…"/></Field>
    </div>
        </div>
      </Modal>

      {/* ── NEW LOAN MODAL ───────────────────────────────────────────── */}      {/* ── NEW LOAN MODAL ───────────────────────────────────────────── */}
      <Modal
        open={showLoanForm}
        onClose={() => setShowLoanForm(false)}
        title="Record Employee Loan"
        variant="centered"
        maxWidth="max-w-sm"
        footer={
          <ModalFooter
            onClose={() => setShowLoanForm(false)}
            onSave={doCreateLoan}
            saving={loanSaving}
            saveLabel="Record Loan"
          />
        }
      >
        <div className="p-6 space-y-3">
    <div className="space-y-3">
      <Field label="Employee" required><select value={loanForm.employeeId} onChange={e=>setLoanForm(p=>({...p,employeeId:e.target.value}))} className={sel}><option value="">Select…</option>{employees.map((e:any)=><option key={e.id} value={e.id}>{e.first_name} {e.last_name} · {e.department}</option>)}</select></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Loan Amount" required><input type="number" min="0" value={loanForm.loanAmount} onChange={e=>setLoanForm(p=>({...p,loanAmount:e.target.value}))} className={inp} placeholder="0.00"/></Field>
        <Field label="Monthly Deduction" required><input type="number" min="0" value={loanForm.monthlyDeduction} onChange={e=>setLoanForm(p=>({...p,monthlyDeduction:e.target.value}))} className={inp} placeholder="0.00"/></Field>
      </div>
      <Field label="Disbursed Date" required><input type="date" value={loanForm.disbursedDate} onChange={e=>setLoanForm(p=>({...p,disbursedDate:e.target.value}))} style={{colorScheme:'dark'}} className={dInp}/></Field>
      <Field label="Reason"><input value={loanForm.reason} onChange={e=>setLoanForm(p=>({...p,reason:e.target.value}))} className={inp} placeholder="e.g. Personal emergency"/></Field>
      {loanForm.loanAmount && loanForm.monthlyDeduction && (
        <p className="text-[11px] text-slate-500 text-center">Payoff: ~{Math.ceil(parseFloat(loanForm.loanAmount)/parseFloat(loanForm.monthlyDeduction))} months</p>
      )}
    </div>
        </div>
      </Modal>

      {/* ── YTD MODAL ────────────────────────────────────────────────────────────── */}      {/* ── YTD MODAL ────────────────────────────────────────────────────────────── */}
      <Modal
        open={!!ytdData}
        onClose={() => setYtdData(null)}
        title="Year-to-Date Summary"
        subtitle={ytdData ? `${ytdName} · ${new Date().getFullYear()}` : undefined}
        variant="centered"
        maxWidth="max-w-sm"
        footer={
          <div className="flex justify-end px-4 sm:px-6 py-4 border-t border-white/5 bg-[#1a1d27] flex-shrink-0">
            <button onClick={() => setYtdData(null)} className="px-4 py-2.5 min-h-[44px] text-xs text-slate-400 hover:text-white transition-colors">Close</button>
          </div>
        }
      >
        {ytdData && (
          <div className="px-6 pt-4 pb-2 space-y-2">
    <div className="space-y-2">
      {[
        ['Months Paid',          ytdData.months_paid || 0,              'text-white'],
        ['YTD Gross',            fmtSAR(ytdData.ytd_gross),             'text-blue-400'],
        ['YTD Net Received',     fmtSAR(ytdData.ytd_net),               'text-emerald-400'],
        ['Total Deductions',     fmtSAR(ytdData.ytd_deductions),        'text-red-400'],
        ['GOSI Paid (Employee)', fmtSAR(ytdData.ytd_gosi),              'text-orange-400'],
        ['Loan Repayments',      fmtSAR(ytdData.ytd_loan_deductions),   'text-amber-400'],
        ['Bonus Received',       fmtSAR(ytdData.ytd_bonus),             'text-purple-400'],
        ['Overtime Received',    fmtSAR(ytdData.ytd_overtime),          'text-cyan-400'],
      ].map(([l,v,c])=>(
        <div key={l as string} className="flex justify-between items-center py-2 border-b border-white/5">
          <span className="text-xs text-slate-400">{l}</span>
          <span className={`text-xs font-semibold tabular-nums ${c}`}>{v}</span>
        </div>
      ))}
    </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
