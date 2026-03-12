// ============================================================
// src/pages/AuditLog.tsx
// Audit Log Viewer — super_admin and admin only
// ============================================================
import { useEffect, useState, useCallback, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { auditApi } from '@/lib/api';
import { toast } from 'sonner';
import { fmtDateTime } from '@/lib/format';
import { ROLES } from '@/lib/roles';
import { fInp, fSel } from '@/lib/cx';
import { loadJsPDF } from '@/lib/pdf';

// ── Types ─────────────────────────────────────────────────────────────────────

interface LogEntry {
  id: number;
  action: string;
  entity_type: string | null;
  entity_id: number | null;
  old_values: string | null;
  new_values: string | null;
  ip_address: string | null;
  created_at: string;
  user_id: number | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  role: string | null;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface Filters {
  actions: string[];
  entities: string[];
  users: { id: number; first_name: string; last_name: string; role: string }[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const ROLE_COLORS: Record<string, string> = {
  super_admin:  'bg-red-500/15 text-red-300 border-red-500/20',
  admin:        'bg-blue-500/15 text-blue-300 border-blue-500/20',
  accountant:   'bg-emerald-500/15 text-emerald-300 border-emerald-500/20',
  office_admin: 'bg-purple-500/15 text-purple-300 border-purple-500/20',
  dispatcher:   'bg-amber-500/15 text-amber-300 border-amber-500/20',
  driver:       'bg-cyan-500/15 text-cyan-300 border-cyan-500/20',
};

const ACTION_COLORS: Record<string, string> = {
  CREATE: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20',
  UPDATE: 'bg-blue-500/15 text-blue-400 border-blue-500/20',
  DELETE: 'bg-red-500/15 text-red-400 border-red-500/20',
  LOGIN:  'bg-slate-500/15 text-slate-400 border-slate-500/20',
  APPROVE:'bg-purple-500/15 text-purple-400 border-purple-500/20',
  REJECT: 'bg-orange-500/15 text-orange-400 border-orange-500/20',
  CANCEL: 'bg-amber-500/15 text-amber-400 border-amber-500/20',
};

function actionColor(action: string): string {
  const prefix = action.split('_')[0];
  return ACTION_COLORS[prefix] || ACTION_COLORS[action] || 'bg-slate-500/15 text-slate-400 border-slate-500/20';
}

/** snake_case → Title Case */
function fieldLabel(key: string): string {
  return key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

/** Parse JSON safely, return null on failure */
function safeJson(s: string | null): Record<string, any> | null {
  if (!s) return null;
  try { return JSON.parse(s); } catch { return null; }
}

/**
 * Compute a human-readable diff between old and new values.
 * Returns an array of { field, from, to } objects where value changed.
 * For CREATE (no old), returns all new fields.
 * For DELETE (no new), returns all old fields.
 */
function computeDiff(oldRaw: string | null, newRaw: string | null) {
  const oldObj = safeJson(oldRaw);
  const newObj = safeJson(newRaw);

  if (!oldObj && !newObj) return [];

  // CREATE — only new values
  if (!oldObj && newObj) {
    return Object.entries(newObj).map(([field, to]) => ({ field, from: null, to }));
  }

  // DELETE — only old values
  if (oldObj && !newObj) {
    return Object.entries(oldObj).map(([field, from]) => ({ field, from, to: null }));
  }

  // UPDATE — show only changed fields
  const allKeys = new Set([...Object.keys(oldObj!), ...Object.keys(newObj!)]);
  const diffs: { field: string; from: any; to: any }[] = [];
  allKeys.forEach(key => {
    const fromVal = oldObj![key];
    const toVal   = newObj![key];
    // Loose compare — catches null vs undefined, avoids false positives on numbers
    if (String(fromVal) !== String(toVal)) {
      diffs.push({ field: key, from: fromVal, to: toVal });
    }
  });
  return diffs;
}

/** Truncate a value for inline display in the table summary */
function truncate(v: any, maxLen = 40): string {
  if (v === null || v === undefined) return 'null';
  const s = typeof v === 'object' ? JSON.stringify(v) : String(v);
  return s.length > maxLen ? s.slice(0, maxLen) + '…' : s;
}

/** Render a single diff item value in a readable way */
function fmtValue(v: any): string {
  if (v === null || v === undefined) return '—';
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  if (typeof v === 'object') return JSON.stringify(v, null, 2);
  return String(v);
}

/** Build a one-line change summary for the table row */
function buildSummary(oldRaw: string | null, newRaw: string | null, action: string): string {
  const diffs = computeDiff(oldRaw, newRaw);
  if (!diffs.length) return action.replace(/_/g, ' ');
  if (diffs.length === 1) {
    const d = diffs[0];
    if (d.from === null) return `Set ${fieldLabel(d.field)}: ${truncate(d.to)}`;
    if (d.to === null)   return `Removed ${fieldLabel(d.field)}: ${truncate(d.from)}`;
    return `${fieldLabel(d.field)}: ${truncate(d.from)} → ${truncate(d.to)}`;
  }
  return `${diffs.length} fields changed: ${diffs.slice(0, 3).map(d => fieldLabel(d.field)).join(', ')}${diffs.length > 3 ? '…' : ''}`;
}

// ── Expanded row diff view ────────────────────────────────────────────────────

function DiffPanel({ log }: { log: LogEntry }) {
  const diffs = computeDiff(log.old_values, log.new_values);

  if (!diffs.length) {
    return (
      <p className="text-xs text-slate-500 italic">No value data recorded for this action.</p>
    );
  }

  const isCreate = !safeJson(log.old_values) && !!safeJson(log.new_values);
  const isDelete = !!safeJson(log.old_values) && !safeJson(log.new_values);

  return (
    <div className="space-y-1">
      {isCreate && (
        <p className="text-[10px] text-emerald-400 uppercase tracking-wider mb-2 font-semibold">Created with values</p>
      )}
      {isDelete && (
        <p className="text-[10px] text-red-400 uppercase tracking-wider mb-2 font-semibold">Deleted — prior values</p>
      )}
      {!isCreate && !isDelete && (
        <p className="text-[10px] text-blue-400 uppercase tracking-wider mb-2 font-semibold">Changed fields</p>
      )}
      <div className="grid gap-1">
        {diffs.map(({ field, from, to }) => (
          <div key={field} className="grid grid-cols-[180px_1fr_1fr] gap-3 items-start py-1.5 border-b border-white/[0.04] last:border-0">
            <span className="text-[11px] text-slate-400 font-medium pt-0.5">{fieldLabel(field)}</span>
            {isCreate ? (
              <>
                <span className="text-[11px] text-slate-600 italic">—</span>
                <span className="text-[11px] text-emerald-300 font-mono break-all">{fmtValue(to)}</span>
              </>
            ) : isDelete ? (
              <>
                <span className="text-[11px] text-red-300 font-mono break-all">{fmtValue(from)}</span>
                <span className="text-[11px] text-slate-600 italic">deleted</span>
              </>
            ) : (
              <>
                <span className="text-[11px] text-slate-400 font-mono break-all line-through opacity-60">{fmtValue(from)}</span>
                <span className="text-[11px] text-blue-300 font-mono break-all">{fmtValue(to)}</span>
              </>
            )}
          </div>
        ))}
      </div>
      {log.ip_address && (
        <p className="text-[10px] text-slate-600 mt-2 pt-2 border-t border-white/5">
          IP: <span className="font-mono text-slate-500">{log.ip_address}</span>
        </p>
      )}
    </div>
  );
}

// ── Pagination ────────────────────────────────────────────────────────────────

function Pager({ pag, onChange }: { pag: Pagination; onChange: (p: number) => void }) {
  if (pag.totalPages <= 1) return null;
  const pages = Array.from({ length: Math.min(7, pag.totalPages) }, (_, i) => {
    if (pag.totalPages <= 7) return i + 1;
    // sliding window
    const half = 3;
    let start = Math.max(1, pag.page - half);
    const end = Math.min(pag.totalPages, start + 6);
    start = Math.max(1, end - 6);
    return start + i;
  });
  return (
    <div className="flex items-center justify-between px-4 py-3 border-t border-white/5">
      <p className="text-[11px] text-slate-500">
        {((pag.page - 1) * pag.limit) + 1}–{Math.min(pag.page * pag.limit, pag.total)} of {pag.total.toLocaleString()} entries
      </p>
      <div className="flex gap-1">
        <button onClick={() => onChange(pag.page - 1)} disabled={pag.page === 1}
          className="px-2.5 py-1 text-xs rounded border border-white/10 text-slate-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
          ←
        </button>
        {pages.map(p => (
          <button key={p} onClick={() => onChange(p)}
            className={`px-2.5 py-1 text-xs rounded border transition-colors ${
              p === pag.page
                ? 'bg-blue-600 border-blue-500 text-white'
                : 'border-white/10 text-slate-400 hover:text-white'
            }`}>
            {p}
          </button>
        ))}
        <button onClick={() => onChange(pag.page + 1)} disabled={pag.page === pag.totalPages}
          className="px-2.5 py-1 text-xs rounded border border-white/10 text-slate-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
          →
        </button>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function AuditLog() {
  const { hasPermission } = useAuth();

  // Guard — belt-and-suspenders, ProtectedRoute should already block this
  if (!hasPermission(ROLES.ADMIN_UP)) {
    return (
      <div className="flex items-center justify-center py-32 text-slate-500 text-sm">
        Access denied.
      </div>
    );
  }

  const [logs,    setLogs]    = useState<LogEntry[]>([]);
  const [pag,     setPag]     = useState<Pagination>({ page: 1, limit: 50, total: 0, totalPages: 1 });
  const [filters, setFilters] = useState<Filters>({ actions: [], entities: [], users: [] });
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [expanded, setExpanded] = useState<number | null>(null);

  // Filter state
  const [search,     setSearch]     = useState('');
  const [userId,     setUserId]     = useState('');
  const [action,     setAction]     = useState('');
  const [entityType, setEntityType] = useState('');
  const [dateFrom,   setDateFrom]   = useState('');
  const [dateTo,     setDateTo]     = useState('');
  const [page,       setPage]       = useState(1);

  const searchRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load filter options once
  useEffect(() => {
    auditApi.getFilters()
      .then(setFilters)
      .catch(() => toast.error('Failed to load filter options'));
  }, []);

  const load = useCallback(async (p = page) => {
    setLoading(true);
    const params: Record<string, string> = { page: String(p), limit: '50' };
    if (search)     params.search     = search;
    if (userId)     params.userId     = userId;
    if (action)     params.action     = action;
    if (entityType) params.entityType = entityType;
    if (dateFrom)   params.dateFrom   = dateFrom;
    if (dateTo)     params.dateTo     = dateTo;
    try {
      const res = await auditApi.getLogs(params);
      setLogs(res.data || []);
      setPag(res.pagination);
      setExpanded(null);
    } catch {
      toast.error('Failed to load audit logs');
    } finally {
      setLoading(false);
    }
  }, [page, search, userId, action, entityType, dateFrom, dateTo]);

  // Debounce search input
  useEffect(() => {
    if (searchRef.current) clearTimeout(searchRef.current);
    searchRef.current = setTimeout(() => { setPage(1); load(1); }, 350);
    return () => { if (searchRef.current) clearTimeout(searchRef.current); };
  }, [search]);

  // Immediate reload on filter changes (non-search)
  useEffect(() => { setPage(1); load(1); }, [userId, action, entityType, dateFrom, dateTo]);

  useEffect(() => { load(page); }, [page]);

  const handlePageChange = (p: number) => setPage(p);

  const clearFilters = () => {
    setSearch(''); setUserId(''); setAction('');
    setEntityType(''); setDateFrom(''); setDateTo('');
    setPage(1);
  };

  const hasActiveFilters = search || userId || action || entityType || dateFrom || dateTo;

  // ── PDF Export ────────────────────────────────────────────────────────────
  const handleExport = async () => {
    setExporting(true);
    try {
      const jsPDF = await loadJsPDF();
      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      const pageW = doc.internal.pageSize.getWidth();

      // Header
      doc.setFillColor(15, 17, 23);
      doc.rect(0, 0, pageW, 18, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text('Rawabi Logistics — Audit Log', 12, 11);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(148, 163, 184);
      doc.text(`Exported ${new Date().toLocaleString('en-GB')}  ·  Page ${pag.page} of ${pag.totalPages}  ·  ${pag.total} total entries`, pageW - 12, 11, { align: 'right' });

      // Table header
      const cols = ['Timestamp', 'User', 'Role', 'Action', 'Entity', 'ID', 'Summary'];
      const colX = [12, 52, 80, 106, 140, 166, 178];
      const colW = [38, 26, 24, 32, 24, 10, 97];

      doc.setFillColor(26, 29, 39);
      doc.rect(0, 20, pageW, 8, 'F');
      doc.setTextColor(100, 116, 139);
      doc.setFontSize(7);
      doc.setFont('helvetica', 'bold');
      cols.forEach((c, i) => doc.text(c.toUpperCase(), colX[i], 25.5));

      // Rows
      let y = 30;
      doc.setFont('helvetica', 'normal');
      logs.forEach((log, idx) => {
        if (y > 190) {
          doc.addPage();
          y = 12;
        }
        if (idx % 2 === 0) {
          doc.setFillColor(20, 22, 32);
          doc.rect(0, y - 3, pageW, 7, 'F');
        }
        doc.setTextColor(226, 232, 240);
        doc.setFontSize(7);

        const userName = log.first_name
          ? `${log.first_name} ${log.last_name}`
          : log.email || 'System';
        const summary = buildSummary(log.old_values, log.new_values, log.action);

        const vals = [
          fmtDateTime(log.created_at),
          userName,
          log.role || '—',
          log.action.replace(/_/g, ' '),
          log.entity_type || '—',
          log.entity_id ? String(log.entity_id) : '—',
          summary,
        ];

        vals.forEach((v, i) => {
          const maxChars = Math.floor(colW[i] / 1.8);
          const text = v.length > maxChars ? v.slice(0, maxChars) + '…' : v;
          doc.text(text, colX[i], y + 1.5);
        });
        y += 7;
      });

      // Footer
      const totalPages = doc.internal.pages.length - 1;
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setFontSize(7);
        doc.setTextColor(71, 85, 105);
        doc.text(
          `Rawabi Logistics ERP · Confidential · Page ${i} of ${totalPages}`,
          pageW / 2, 205, { align: 'center' }
        );
      }

      doc.save(`audit-log-${new Date().toISOString().slice(0, 10)}.pdf`);
      toast.success('PDF exported');
    } catch {
      toast.error('Export failed');
    } finally {
      setExporting(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">

      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-base font-semibold text-white">Audit Log</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            {pag.total.toLocaleString()} entries recorded
          </p>
        </div>
        <button
          onClick={handleExport}
          disabled={exporting || loading || logs.length === 0}
          className="flex items-center gap-2 px-3 py-2 text-xs border border-white/10 rounded-lg text-slate-400 hover:text-white hover:border-white/20 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          {exporting ? 'Exporting…' : 'Export PDF'}
        </button>
      </div>

      {/* Filter bar */}
      <div className="bg-[#1a1d27] rounded-xl border border-white/5 p-3">
        <div className="flex flex-wrap gap-2 items-center">

          {/* Search */}
          <div className="relative flex-1 min-w-[180px]">
            <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              className={fInp}
              placeholder="Search user, action, entity…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          {/* User filter */}
          <select className={fSel} value={userId} onChange={e => setUserId(e.target.value)}>
            <option value="">All users</option>
            {filters.users.map(u => (
              <option key={u.id} value={u.id}>
                {u.first_name} {u.last_name}
              </option>
            ))}
          </select>

          {/* Action filter */}
          <select className={fSel} value={action} onChange={e => setAction(e.target.value)}>
            <option value="">All actions</option>
            {filters.actions.map(a => (
              <option key={a} value={a}>{a.replace(/_/g, ' ')}</option>
            ))}
          </select>

          {/* Entity type filter */}
          <select className={fSel} value={entityType} onChange={e => setEntityType(e.target.value)}>
            <option value="">All entities</option>
            {filters.entities.map(e => (
              <option key={e} value={e}>{e.replace(/_/g, ' ')}</option>
            ))}
          </select>

          {/* Date range */}
          <input
            type="date"
            className={fSel + ' w-36'}
            value={dateFrom}
            onChange={e => setDateFrom(e.target.value)}
            style={{ colorScheme: 'dark' }}
          />
          <span className="text-slate-600 text-xs">to</span>
          <input
            type="date"
            className={fSel + ' w-36'}
            value={dateTo}
            onChange={e => setDateTo(e.target.value)}
            style={{ colorScheme: 'dark' }}
          />

          {/* Clear */}
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="px-3 py-2 text-xs text-slate-500 hover:text-white border border-white/5 rounded-lg transition-colors"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="bg-[#1a1d27] rounded-xl border border-white/5 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20 text-slate-500 text-sm">Loading…</div>
        ) : logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-500 text-sm gap-2">
            <svg className="w-8 h-8 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            No log entries found
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-white/5">
                    <th className="text-left px-4 py-3 text-[10px] text-slate-500 uppercase tracking-wider font-medium w-44">Timestamp</th>
                    <th className="text-left px-4 py-3 text-[10px] text-slate-500 uppercase tracking-wider font-medium w-40">User</th>
                    <th className="text-left px-4 py-3 text-[10px] text-slate-500 uppercase tracking-wider font-medium w-32">Action</th>
                    <th className="text-left px-4 py-3 text-[10px] text-slate-500 uppercase tracking-wider font-medium w-28">Entity</th>
                    <th className="text-left px-4 py-3 text-[10px] text-slate-500 uppercase tracking-wider font-medium w-16 text-center">ID</th>
                    <th className="text-left px-4 py-3 text-[10px] text-slate-500 uppercase tracking-wider font-medium">Summary</th>
                    <th className="w-8" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04]">
                  {logs.map(log => {
                    const isOpen = expanded === log.id;
                    const userName = log.first_name
                      ? `${log.first_name} ${log.last_name}`
                      : log.email || 'System';
                    const summary = buildSummary(log.old_values, log.new_values, log.action);

                    return [
                      // Main row
                      <tr
                        key={log.id}
                        onClick={() => setExpanded(isOpen ? null : log.id)}
                        className={`cursor-pointer transition-colors ${isOpen ? 'bg-blue-500/5' : 'hover:bg-white/[0.02]'}`}
                      >
                        {/* Timestamp */}
                        <td className="px-4 py-3 text-slate-400 font-mono text-[11px] whitespace-nowrap">
                          {fmtDateTime(log.created_at)}
                        </td>

                        {/* User */}
                        <td className="px-4 py-3">
                          <div className="flex flex-col gap-0.5">
                            <span className="text-slate-200">{userName}</span>
                            {log.role && (
                              <span className={`self-start text-[10px] px-1.5 py-0.5 rounded border font-medium ${ROLE_COLORS[log.role] || 'bg-slate-500/15 text-slate-400 border-slate-500/20'}`}>
                                {log.role.replace('_', ' ')}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Action */}
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded-md text-[10px] font-medium border ${actionColor(log.action)}`}>
                            {log.action.replace(/_/g, ' ')}
                          </span>
                        </td>

                        {/* Entity type */}
                        <td className="px-4 py-3 text-slate-400 capitalize">
                          {log.entity_type?.replace(/_/g, ' ') || '—'}
                        </td>

                        {/* Entity ID */}
                        <td className="px-4 py-3 text-center text-slate-500 font-mono">
                          {log.entity_id ?? '—'}
                        </td>

                        {/* Summary */}
                        <td className="px-4 py-3 text-slate-400 max-w-xs truncate">
                          {summary}
                        </td>

                        {/* Expand chevron */}
                        <td className="px-3 py-3">
                          <svg
                            className={`w-3.5 h-3.5 text-slate-600 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                            fill="none" stroke="currentColor" viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </td>
                      </tr>,

                      // Expanded detail row
                      isOpen && (
                        <tr key={`${log.id}-detail`} className="bg-[#0f1117]">
                          <td colSpan={7} className="px-8 py-4">
                            <div className="max-w-4xl">
                              {/* Header strip */}
                              <div className="flex items-center gap-4 mb-3 pb-3 border-b border-white/5">
                                <div>
                                  <p className="text-[10px] text-slate-500 uppercase tracking-wider">Log ID</p>
                                  <p className="text-xs font-mono text-slate-300">#{log.id}</p>
                                </div>
                                <div>
                                  <p className="text-[10px] text-slate-500 uppercase tracking-wider">Timestamp</p>
                                  <p className="text-xs text-slate-300">{fmtDateTime(log.created_at)}</p>
                                </div>
                                <div>
                                  <p className="text-[10px] text-slate-500 uppercase tracking-wider">User</p>
                                  <p className="text-xs text-slate-300">{userName}{log.email && log.first_name ? ` (${log.email})` : ''}</p>
                                </div>
                                {log.ip_address && (
                                  <div>
                                    <p className="text-[10px] text-slate-500 uppercase tracking-wider">IP Address</p>
                                    <p className="text-xs font-mono text-slate-300">{log.ip_address}</p>
                                  </div>
                                )}
                              </div>
                              {/* Diff */}
                              {(safeJson(log.old_values) || safeJson(log.new_values)) ? (
                                <>
                                  {/* Column headers for UPDATE */}
                                  {safeJson(log.old_values) && safeJson(log.new_values) && (
                                    <div className="grid grid-cols-[180px_1fr_1fr] gap-3 mb-1 px-0">
                                      <span className="text-[10px] text-slate-600 uppercase tracking-wider">Field</span>
                                      <span className="text-[10px] text-slate-600 uppercase tracking-wider">Before</span>
                                      <span className="text-[10px] text-slate-600 uppercase tracking-wider">After</span>
                                    </div>
                                  )}
                                  <DiffPanel log={log} />
                                </>
                              ) : (
                                <p className="text-xs text-slate-500 italic">No value data recorded for this action.</p>
                              )}
                            </div>
                          </td>
                        </tr>
                      ),
                    ];
                  })}
                </tbody>
              </table>
            </div>
            <Pager pag={pag} onChange={handlePageChange} />
          </>
        )}
      </div>
    </div>
  );
}
