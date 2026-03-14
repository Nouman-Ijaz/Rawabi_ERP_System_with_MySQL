// src/pages/MyTrips.tsx
// Driver "My Trips" portal.
// Visible to driver role ONLY — all other roles are redirected.
// Three tabs: Active (assigned/picked_up/in_transit/delayed),
//             Completed (delivered/cancelled),
//             Issues (all issues this driver has ever filed).

import { useEffect, useState, useCallback } from 'react';
import { useNavigate }      from 'react-router-dom';
import { useAuth }          from '@/contexts/AuthContext';
import { toast }            from 'sonner';
import { fmtDate, fmtDateTime } from '@/lib/format';
import { SHIPMENT_STATUS }  from '@/lib/statusStyles';
import { inp, sel }         from '@/lib/cx';
import FormField            from '@/components/FormField';
import Modal, { ModalFooter } from '@/components/Modal';
import { myTripsApi, shipmentsApi } from '@/lib/api';

// ── Status helpers ─────────────────────────────────────────────────
// Add delayed to SHIPMENT_STATUS fallback locally (it's now in statusStyles.ts too)
const STATUS_MAP: Record<string, string> = {
  ...SHIPMENT_STATUS,
  delayed:   'bg-rose-500/15 text-rose-400 border-rose-500/20',
  confirmed: 'bg-blue-500/15 text-blue-400 border-blue-500/20',
};

const STATUS_LABEL: Record<string, string> = {
  confirmed:  'Assigned',
  picked_up:  'Picked Up',
  in_transit: 'In Transit',
  delayed:    'Delayed',
  delivered:  'Delivered',
  cancelled:  'Cancelled',
};

// What action button to show for each active status
const ACTION_LABEL: Record<string, string> = {
  confirmed:  'Confirm Pickup',
  picked_up:  'Mark In Transit',
  in_transit: 'Mark Delivered',
  delayed:    'Resume Transit',
};

// What status each action transitions to
const ACTION_TARGET: Record<string, string> = {
  confirmed:  'picked_up',
  picked_up:  'in_transit',
  in_transit: 'delivered',
  delayed:    'in_transit',
};

const ISSUE_LABELS: Record<string, string> = {
  breakdown:    'Breakdown',
  accident:     'Accident',
  customs_hold: 'Customs Hold',
  road_closure: 'Road Closure',
  other:        'Other',
};

const ISSUE_COLORS: Record<string, string> = {
  breakdown:    'bg-red-500/15 text-red-400',
  accident:     'bg-red-600/20 text-red-300',
  customs_hold: 'bg-orange-500/15 text-orange-400',
  road_closure: 'bg-amber-500/15 text-amber-400',
  other:        'bg-slate-500/15 text-slate-400',
};

const ISSUE_STATUS_COLORS: Record<string, string> = {
  open:         'bg-red-500/15 text-red-400',
  acknowledged: 'bg-amber-500/15 text-amber-400',
  resolved:     'bg-emerald-500/15 text-emerald-400',
};

// ── Derive display status ─────────────────────────────────────────
// The DB stores 'in_transit' for delayed shipments. We detect the
// delayed state from last_event_type returned by the API.
function displayStatus(trip: any): string {
  if (trip.last_event_type === 'DELAYED') return 'delayed';
  return trip.status;
}

// ── Icons ──────────────────────────────────────────────────────────
function Icon({ name, className }: { name: string; className?: string }) {
  const p = { className: className || 'w-5 h-5', fill: 'none', stroke: 'currentColor', viewBox: '0 0 24 24' };
  const icons: Record<string, JSX.Element> = {
    truck:    <svg {...p}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0"/></svg>,
    check:    <svg {...p}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/></svg>,
    alert:    <svg {...p}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>,
    arrow:    <svg {...p}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 7l5 5m0 0l-5 5m5-5H6"/></svg>,
    upload:   <svg {...p}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/></svg>,
    clock:    <svg {...p}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>,
    list:     <svg {...p}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 10h16M4 14h16M4 18h16"/></svg>,
    warning:  <svg {...p}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/></svg>,
    refresh:  <svg {...p}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>,
    location: <svg {...p}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/></svg>,
    x:        <svg {...p}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>,
  };
  return icons[name] || icons['truck'];
}

// ── ConfirmActionModal ─────────────────────────────────────────────
interface ConfirmProps {
  open: boolean;
  shipmentNumber: string;
  actionLabel: string;
  targetStatus: string;
  hasPod: boolean;
  requiresReason: boolean;
  onClose: () => void;
  onConfirm: (reason?: string, location?: string) => Promise<void>;
}
function ConfirmActionModal({ open, shipmentNumber, actionLabel, targetStatus, hasPod, requiresReason, onClose, onConfirm }: ConfirmProps) {
  const [saving, setSaving]   = useState(false);
  const [reason, setReason]   = useState('');
  const [location, setLoc]    = useState('');

  useEffect(() => { if (!open) { setReason(''); setLoc(''); } }, [open]);

  const handle = async () => {
    if (requiresReason && !reason.trim()) { toast.error('Please enter a reason for the delay'); return; }
    setSaving(true);
    try {
      await onConfirm(reason.trim() || undefined, location.trim() || undefined);
      onClose();
    } finally { setSaving(false); }
  };

  const isDelivery = targetStatus === 'delivered';

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={actionLabel}
      subtitle={shipmentNumber}
      variant="centered"
      maxWidth="max-w-sm"
      footer={<ModalFooter onClose={onClose} onSave={handle} saving={saving} saveLabel={actionLabel} saveDisabled={isDelivery && !hasPod} />}
    >
      <div className="p-5 space-y-4">
        {isDelivery && !hasPod && (
          <div className="flex items-start gap-2 bg-amber-500/10 border border-amber-500/20 rounded-lg p-3">
            <Icon name="warning" className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-amber-300">Upload a Proof of Delivery (POD) before marking this shipment as delivered.</p>
          </div>
        )}
        {isDelivery && hasPod && (
          <p className="text-xs text-slate-400">POD uploaded. Confirm delivery for <span className="text-white font-medium">{shipmentNumber}</span>?</p>
        )}
        {!isDelivery && !requiresReason && (
          <p className="text-xs text-slate-400">Confirm: <span className="text-white font-medium">{actionLabel}</span> for shipment <span className="text-white font-medium">{shipmentNumber}</span>?</p>
        )}
        {requiresReason && (
          <FormField label="Reason for Delay" required>
            <textarea value={reason} onChange={e => setReason(e.target.value)}
              rows={3} className={inp + ' resize-none'} placeholder="What caused the delay?" />
          </FormField>
        )}
        <FormField label="Current Location (optional)">
          <input value={location} onChange={e => setLoc(e.target.value)}
            className={inp} placeholder="e.g. Jeddah ring road, km 14" />
        </FormField>
      </div>
    </Modal>
  );
}

// ── IssueModal ─────────────────────────────────────────────────────
interface IssueModalProps {
  open: boolean;
  shipment: any;
  onClose: () => void;
  onSubmitted: () => void;
}
function IssueModal({ open, shipment, onClose, onSubmitted }: IssueModalProps) {
  const [saving, setSaving]       = useState(false);
  const [issueType, setIssueType] = useState('');
  const [description, setDesc]    = useState('');
  const [location, setLoc]        = useState('');

  useEffect(() => { if (!open) { setIssueType(''); setDesc(''); setLoc(''); } }, [open]);

  const handle = async () => {
    if (!issueType)        { toast.error('Select an issue type'); return; }
    if (!description.trim()) { toast.error('Describe the issue'); return; }
    setSaving(true);
    try {
      await myTripsApi.reportIssue(shipment.id, {
        issue_type:  issueType,
        description: description.trim(),
        location:    location.trim() || undefined,
      });
      toast.success('Issue reported. Dispatch has been notified.');
      onSubmitted();
      onClose();
    } catch (e: any) {
      toast.error(e.message || 'Failed to report issue');
    } finally { setSaving(false); }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Report Issue"
      subtitle={shipment?.shipment_number}
      variant="sheet"
      maxWidth="sm:max-w-md"
      footer={<ModalFooter onClose={onClose} onSave={handle} saving={saving} saveLabel="Report Issue" variant="danger" saveDisabled={!issueType || !description.trim()} />}
    >
      <div className="p-4 sm:p-6 space-y-4">
        <FormField label="Issue Type" required>
          <select value={issueType} onChange={e => setIssueType(e.target.value)} className={sel}>
            <option value="">— Select type —</option>
            <option value="breakdown">Breakdown</option>
            <option value="accident">Accident</option>
            <option value="customs_hold">Customs Hold</option>
            <option value="road_closure">Road Closure</option>
            <option value="other">Other</option>
          </select>
        </FormField>
        <FormField label="Description" required>
          <textarea value={description} onChange={e => setDesc(e.target.value)}
            rows={4} className={inp + ' resize-none'} placeholder="Describe what happened..." />
        </FormField>
        <FormField label="Location (optional)">
          <input value={location} onChange={e => setLoc(e.target.value)}
            className={inp} placeholder="e.g. Highway 65, near Mecca junction" />
        </FormField>
        <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3">
          <p className="text-[11px] text-blue-300">Dispatchers and admins will be notified immediately.</p>
        </div>
      </div>
    </Modal>
  );
}

// ── Trip Card ──────────────────────────────────────────────────────
interface TripCardProps {
  trip: any;
  onAction: (trip: any) => void;
  onDelay: (trip: any) => void;
  onIssue: (trip: any) => void;
  onUploadPod: (trip: any) => void;
}

function TripCard({ trip, onAction, onDelay, onIssue, onUploadPod }: TripCardProps) {
  const effectiveStatus = displayStatus(trip);
  const statusClass = STATUS_MAP[effectiveStatus] || 'bg-slate-500/15 text-slate-400';
  const actionLabel = ACTION_LABEL[effectiveStatus];
  const isDelivery  = effectiveStatus === 'in_transit';
  const needsPod    = isDelivery && trip.pod_count === 0;

  const now            = new Date();
  const deliveryDue    = trip.requested_delivery_date ? new Date(trip.requested_delivery_date) : null;
  const isOverdue      = deliveryDue && deliveryDue < now && !['delivered','cancelled'].includes(effectiveStatus);

  const canDelay = ['picked_up', 'in_transit'].includes(effectiveStatus);

  return (
    <div className="bg-[#1a1d27] rounded-2xl border border-white/5 overflow-hidden">
      {/* Card header */}
      <div className="flex items-start justify-between px-4 pt-4 pb-3 border-b border-white/5">
        <div>
          <span className="font-mono text-sm font-bold text-white">{trip.shipment_number}</span>
          <p className="text-[11px] text-slate-500 mt-0.5">{trip.customer_name}</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {trip.open_issues > 0 && (
            <span className="flex items-center gap-1 px-2 py-0.5 bg-red-500/15 text-red-400 rounded-full text-[10px] font-medium">
              <Icon name="alert" className="w-3 h-3" /> {trip.open_issues} issue{trip.open_issues > 1 ? 's' : ''}
            </span>
          )}
          <span className={`px-2.5 py-1 rounded-full text-[10px] font-semibold border ${statusClass}`}>
            {STATUS_LABEL[effectiveStatus] || effectiveStatus}
          </span>
        </div>
      </div>

      {/* Route */}
      <div className="px-4 py-3">
        <div className="flex items-center gap-2 text-xs">
          <span className="text-white font-medium flex-1 min-w-0 truncate">{trip.origin_city}</span>
          <Icon name="arrow" className="w-4 h-4 text-slate-600 flex-shrink-0" />
          <span className="text-white font-medium flex-1 min-w-0 truncate text-right">{trip.destination_city}</span>
        </div>
        {trip.cargo_type && (
          <p className="text-[11px] text-slate-500 mt-1">{trip.cargo_type}{trip.pieces ? ` · ${trip.pieces} pcs` : ''}{trip.weight_kg ? ` · ${trip.weight_kg} kg` : ''}</p>
        )}
      </div>

      {/* Dates */}
      <div className="px-4 pb-3 grid grid-cols-2 gap-2">
        <div className="bg-[#0f1117] rounded-lg p-2.5">
          <p className="text-[10px] text-slate-500 mb-0.5">Pickup</p>
          <p className="text-xs text-white">{trip.requested_pickup_date ? fmtDate(trip.requested_pickup_date) : '—'}</p>
          {trip.actual_pickup_date && (
            <p className="text-[10px] text-emerald-400 mt-0.5">Done {fmtDate(trip.actual_pickup_date)}</p>
          )}
        </div>
        <div className={`rounded-lg p-2.5 ${isOverdue ? 'bg-red-900/20 border border-red-500/20' : 'bg-[#0f1117]'}`}>
          <p className={`text-[10px] mb-0.5 ${isOverdue ? 'text-red-400' : 'text-slate-500'}`}>
            Delivery{isOverdue ? ' — OVERDUE' : ''}
          </p>
          <p className={`text-xs font-medium ${isOverdue ? 'text-red-300' : 'text-white'}`}>
            {deliveryDue ? fmtDate(trip.requested_delivery_date) : '—'}
          </p>
        </div>
      </div>

      {/* Vehicle */}
      {trip.vehicle_plate && (
        <div className="px-4 pb-3">
          <span className="inline-flex items-center gap-1.5 text-[11px] text-slate-400 bg-white/5 rounded-lg px-2.5 py-1.5">
            <Icon name="truck" className="w-3.5 h-3.5" />
            {trip.vehicle_plate} {trip.vehicle_type ? `· ${trip.vehicle_type}` : ''}
          </span>
        </div>
      )}

      {/* POD warning */}
      {needsPod && (
        <div className="mx-4 mb-3 flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
          <Icon name="upload" className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
          <p className="text-[11px] text-amber-300 flex-1">Upload POD before marking delivered</p>
          <button onClick={() => onUploadPod(trip)}
            className="text-[11px] text-amber-400 hover:text-amber-300 font-medium underline flex-shrink-0">
            Upload
          </button>
        </div>
      )}

      {/* Actions */}
      <div className="px-4 pb-4 flex flex-col gap-2">
        {/* Primary action */}
        {actionLabel && (
          <button onClick={() => onAction(trip)}
            className="w-full min-h-[44px] flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-colors">
            <Icon name="check" className="w-4 h-4" />
            {actionLabel}
          </button>
        )}

        {/* Secondary row */}
        <div className="flex gap-2">
          {canDelay && (
            <button onClick={() => onDelay(trip)}
              className="flex-1 min-h-[44px] flex items-center justify-center gap-1.5 bg-amber-500/10 hover:bg-amber-500/20 active:bg-amber-500/30 text-amber-400 text-xs font-medium rounded-xl border border-amber-500/20 transition-colors">
              <Icon name="clock" className="w-3.5 h-3.5" /> Report Delay
            </button>
          )}
          <button onClick={() => onIssue(trip)}
            className="flex-1 min-h-[44px] flex items-center justify-center gap-1.5 bg-red-500/10 hover:bg-red-500/20 active:bg-red-500/30 text-red-400 text-xs font-medium rounded-xl border border-red-500/20 transition-colors">
            <Icon name="alert" className="w-3.5 h-3.5" /> Report Issue
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Completed Card ─────────────────────────────────────────────────
function CompletedCard({ trip }: { trip: any }) {
  const effectiveStatus = displayStatus(trip);
  const statusClass = STATUS_MAP[effectiveStatus] || 'bg-slate-500/15 text-slate-400';
  const transitDays = trip.actual_pickup_date && trip.actual_delivery_date
    ? Math.round((new Date(trip.actual_delivery_date).getTime() - new Date(trip.actual_pickup_date).getTime()) / 86400000)
    : null;

  return (
    <div className="bg-[#1a1d27] rounded-2xl border border-white/5 overflow-hidden">
      <div className="flex items-start justify-between px-4 pt-4 pb-3 border-b border-white/5">
        <div>
          <span className="font-mono text-sm font-bold text-white">{trip.shipment_number}</span>
          <p className="text-[11px] text-slate-500 mt-0.5">{trip.customer_name}</p>
        </div>
        <span className={`px-2.5 py-1 rounded-full text-[10px] font-semibold border ${statusClass}`}>
          {STATUS_LABEL[trip.status] || trip.status}
        </span>
      </div>
      <div className="px-4 py-3">
        <div className="flex items-center gap-2 text-xs">
          <span className="text-white font-medium flex-1 truncate">{trip.origin_city}</span>
          <Icon name="arrow" className="w-4 h-4 text-slate-600 flex-shrink-0" />
          <span className="text-white font-medium flex-1 truncate text-right">{trip.destination_city}</span>
        </div>
      </div>
      <div className="px-4 pb-4 grid grid-cols-2 gap-2">
        <div className="bg-[#0f1117] rounded-lg p-2.5">
          <p className="text-[10px] text-slate-500 mb-0.5">Delivered</p>
          <p className="text-xs text-emerald-400 font-medium">
            {trip.actual_delivery_date ? fmtDate(trip.actual_delivery_date) : '—'}
          </p>
        </div>
        {transitDays !== null && (
          <div className="bg-[#0f1117] rounded-lg p-2.5">
            <p className="text-[10px] text-slate-500 mb-0.5">Transit Time</p>
            <p className="text-xs text-white font-medium">{transitDays} day{transitDays !== 1 ? 's' : ''}</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ── POD Upload Modal ───────────────────────────────────────────────
interface PodModalProps {
  open: boolean;
  shipment: any;
  onClose: () => void;
  onUploaded: () => void;
}
function PodUploadModal({ open, shipment, onClose, onUploaded }: PodModalProps) {
  const [file, setFile]       = useState<File | null>(null);
  const [notes, setNotes]     = useState('');
  const [saving, setSaving]   = useState(false);

  useEffect(() => { if (!open) { setFile(null); setNotes(''); } }, [open]);

  const handle = async () => {
    if (!file) { toast.error('Select a file first'); return; }
    setSaving(true);
    try {
      await shipmentsApi.uploadDocument(shipment.id, file, 'pod', notes.trim() || undefined);
      toast.success('POD uploaded successfully');
      onUploaded();
      onClose();
    } catch (e: any) {
      toast.error(e.message || 'Upload failed');
    } finally { setSaving(false); }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Upload Proof of Delivery"
      subtitle={shipment?.shipment_number}
      variant="sheet"
      maxWidth="sm:max-w-md"
      footer={<ModalFooter onClose={onClose} onSave={handle} saving={saving} saveLabel="Upload POD" saveDisabled={!file} />}
    >
      <div className="p-4 sm:p-6 space-y-4">
        <FormField label="POD File" required hint="Photo, PDF, or scanned document">
          <input type="file" accept="image/*,application/pdf"
            onChange={e => setFile(e.target.files?.[0] || null)}
            className="w-full text-xs text-slate-400 bg-[#0c0e13] border border-white/10 rounded-lg px-3 py-2 file:mr-3 file:py-1 file:px-3 file:rounded file:border-0 file:text-xs file:font-medium file:bg-blue-600 file:text-white hover:file:bg-blue-500 cursor-pointer" />
        </FormField>
        <FormField label="Notes (optional)">
          <textarea value={notes} onChange={e => setNotes(e.target.value)}
            rows={2} className="w-full bg-[#0c0e13] border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-blue-500/50 resize-none"
            placeholder="Recipient name, signature reference..." />
        </FormField>
      </div>
    </Modal>
  );
}

// ── Main Page ──────────────────────────────────────────────────────
type Tab = 'active' | 'completed' | 'issues';

const ACTIVE_STATUSES   = 'confirmed,picked_up,in_transit'; // delayed = in_transit in DB
const COMPLETED_STATUSES = 'delivered,cancelled';

export default function MyTrips() {
  const { user } = useAuth();
  const navigate  = useNavigate();

  // Redirect non-drivers immediately
  useEffect(() => {
    if (user && user.role !== 'driver') {
      toast.error('My Trips is only accessible to drivers');
      navigate('/dashboard', { replace: true });
    }
  }, [user, navigate]);

  const [tab, setTab]                   = useState<Tab>('active');
  const [activeTrips, setActiveTrips]   = useState<any[]>([]);
  const [completed, setCompleted]       = useState<any[]>([]);
  const [allIssues, setAllIssues]       = useState<any[]>([]);
  const [loading, setLoading]           = useState(true);
  const [openIssueCount, setOpenIssueCount] = useState(0);

  // Completed date filters
  const [from, setFrom] = useState('');
  const [to, setTo]     = useState('');

  // Modals
  const [confirmTrip, setConfirmTrip]   = useState<any>(null);
  const [confirmTarget, setConfirmTarget] = useState<string>('');
  const [isDelay, setIsDelay]           = useState(false);
  const [issueTrip, setIssueTrip]       = useState<any>(null);
  const [podTrip, setPodTrip]           = useState<any>(null);

  const loadActive = useCallback(async () => {
    try {
      const data = await myTripsApi.getAll({ status: ACTIVE_STATUSES });
      setActiveTrips(Array.isArray(data) ? data : data?.data ?? []);
    } catch (e: any) { toast.error(e.message || 'Failed to load trips'); }
  }, []);

  const loadCompleted = useCallback(async () => {
    const params: Record<string, string> = { status: COMPLETED_STATUSES };
    if (from) params.from = from;
    if (to)   params.to   = to;
    try {
      const data = await myTripsApi.getAll(params);
      setCompleted(Array.isArray(data) ? data : data?.data ?? []);
    } catch (e: any) { toast.error(e.message || 'Failed to load completed trips'); }
  }, [from, to]);

  const loadIssues = useCallback(async () => {
    try {
      const data = await myTripsApi.getAllIssues();
      const list = Array.isArray(data) ? data : [];
      setAllIssues(list);
      setOpenIssueCount(list.filter((i: any) => i.status === 'open').length);
    } catch (e: any) { toast.error(e.message || 'Failed to load issues'); }
  }, []);

  const loadAll = useCallback(async () => {
    setLoading(true);
    await Promise.all([loadActive(), loadCompleted(), loadIssues()]);
    setLoading(false);
  }, [loadActive, loadCompleted, loadIssues]);

  useEffect(() => { if (user?.role === 'driver') { loadAll(); } }, [loadAll, user]);
  useEffect(() => { if (tab === 'completed' && user?.role === 'driver') { loadCompleted(); } }, [from, to, loadCompleted, tab, user]);

  // ── Status update handler ────────────────────────────────────────
  const openAction = (trip: any) => {
    const effStatus = displayStatus(trip);
    const target = ACTION_TARGET[effStatus];
    if (!target) return;
    // attach computed effectiveStatus so ConfirmActionModal knows hasPod logic
    setConfirmTrip({ ...trip, _effectiveStatus: effStatus });
    setConfirmTarget(target);
    setIsDelay(false);
  };

  const openDelay = (trip: any) => {
    setConfirmTrip({ ...trip, _effectiveStatus: displayStatus(trip) });
    setConfirmTarget('delayed');
    setIsDelay(true);
  };

  const handleConfirm = async (reason?: string, location?: string) => {
    if (!confirmTrip) return;
    try {
      const res = await myTripsApi.updateStatus(confirmTrip.id, {
        status:   confirmTarget,
        reason,
        location,
      });
      toast.success(res.message || `Status updated to ${confirmTarget}`);
      await loadActive();
      if (confirmTarget === 'delivered') await loadCompleted();
    } catch (e: any) {
      toast.error(e.message || 'Status update failed');
      throw e; // keep modal open
    }
  };

  // ── Upload POD then reload ───────────────────────────────────────
  const handlePodUploaded = async () => {
    await loadActive();
  };

  if (!user || user.role !== 'driver') return null;

  const tabs: { key: Tab; label: string; count?: number }[] = [
    { key: 'active',    label: 'Active',    count: activeTrips.length },
    { key: 'completed', label: 'Completed', count: completed.length },
    { key: 'issues',    label: 'Issues',    count: openIssueCount || undefined },
  ];

  return (
    <div className="space-y-5 pb-8">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <Icon name="truck" className="w-5 h-5 text-blue-400" />
            My Trips
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">Your assigned shipments</p>
        </div>
        <button onClick={loadAll}
          className="flex items-center gap-1.5 px-3 py-2 min-h-[44px] bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 text-xs font-medium rounded-lg transition-colors">
          <Icon name="refresh" className="w-3.5 h-3.5" /> Refresh
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-[#1a1d27] rounded-xl p-1 border border-white/5">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 min-h-[44px] rounded-lg text-xs font-medium transition-colors ${
              tab === t.key ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
            }`}>
            {t.label}
            {t.count !== undefined && t.count > 0 && (
              <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                tab === t.key
                  ? 'bg-white/20 text-white'
                  : t.key === 'issues'
                    ? 'bg-red-500/20 text-red-400'
                    : 'bg-white/10 text-slate-300'
              }`}>
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── ACTIVE TAB ── */}
      {tab === 'active' && (
        <div className="space-y-4">
          {loading ? (
            <div className="space-y-3">
              {[1, 2].map(i => <div key={i} className="h-52 bg-[#1a1d27] rounded-2xl animate-pulse" />)}
            </div>
          ) : activeTrips.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Icon name="truck" className="w-12 h-12 text-slate-700 mb-3" />
              <p className="text-sm text-slate-500 font-medium">No active trips</p>
              <p className="text-xs text-slate-600 mt-1">Shipments assigned to you will appear here</p>
            </div>
          ) : (
            activeTrips.map(trip => (
              <TripCard
                key={trip.id}
                trip={trip}
                onAction={openAction}
                onDelay={openDelay}
                onIssue={t => setIssueTrip(t)}
                onUploadPod={t => setPodTrip(t)}
              />
            ))
          )}
        </div>
      )}

      {/* ── COMPLETED TAB ── */}
      {tab === 'completed' && (
        <div className="space-y-4">
          {/* Date filters */}
          <div className="flex items-center gap-3 flex-wrap">
            <input type="date" value={from} onChange={e => setFrom(e.target.value)}
              style={{ colorScheme: 'dark' }}
              className="px-3 py-2 text-xs bg-[#1a1d27] border border-white/10 rounded-lg text-white focus:outline-none focus:border-blue-500/40" />
            <span className="text-slate-500 text-xs">to</span>
            <input type="date" value={to} onChange={e => setTo(e.target.value)}
              style={{ colorScheme: 'dark' }}
              className="px-3 py-2 text-xs bg-[#1a1d27] border border-white/10 rounded-lg text-white focus:outline-none focus:border-blue-500/40" />
            {(from || to) && (
              <button onClick={() => { setFrom(''); setTo(''); }} className="text-[11px] text-slate-400 hover:text-white">Clear</button>
            )}
          </div>

          {loading ? (
            <div className="space-y-3">
              {[1, 2].map(i => <div key={i} className="h-36 bg-[#1a1d27] rounded-2xl animate-pulse" />)}
            </div>
          ) : completed.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Icon name="check" className="w-12 h-12 text-slate-700 mb-3" />
              <p className="text-sm text-slate-500 font-medium">No completed trips</p>
              {(from || to) && <p className="text-xs text-slate-600 mt-1">Try a different date range</p>}
            </div>
          ) : (
            completed.map(trip => <CompletedCard key={trip.id} trip={trip} />)
          )}
        </div>
      )}

      {/* ── ISSUES TAB ── */}
      {tab === 'issues' && (
        <div className="space-y-3">
          {loading ? (
            <div className="h-48 bg-[#1a1d27] rounded-xl animate-pulse" />
          ) : allIssues.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Icon name="list" className="w-12 h-12 text-slate-700 mb-3" />
              <p className="text-sm text-slate-500 font-medium">No issues reported</p>
              <p className="text-xs text-slate-600 mt-1">Issues you report on active trips appear here</p>
            </div>
          ) : (
            <div className="bg-[#1a1d27] rounded-xl border border-white/5 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-white/5">
                      {['Shipment', 'Type', 'Description', 'Reported', 'Status'].map(h => (
                        <th key={h} className="px-4 py-3 text-left text-[11px] font-medium text-slate-500 whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {allIssues.map(issue => (
                      <tr key={issue.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                        <td className="px-4 py-3">
                          <p className="font-mono text-blue-400 font-medium">{issue.shipment_number}</p>
                          <p className="text-[10px] text-slate-500 mt-0.5">{issue.origin_city} → {issue.destination_city}</p>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${ISSUE_COLORS[issue.issue_type] || 'bg-slate-500/15 text-slate-400'}`}>
                            {ISSUE_LABELS[issue.issue_type] || issue.issue_type}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-300 max-w-[180px]">
                          <p className="truncate">{issue.description}</p>
                          {issue.location && <p className="text-[10px] text-slate-500 mt-0.5 truncate">{issue.location}</p>}
                        </td>
                        <td className="px-4 py-3 text-slate-400 whitespace-nowrap">{fmtDateTime(issue.reported_at)}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium capitalize ${ISSUE_STATUS_COLORS[issue.status] || 'bg-slate-500/15 text-slate-400'}`}>
                            {issue.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Modals ── */}
      <ConfirmActionModal
        open={!!confirmTrip}
        shipmentNumber={confirmTrip?.shipment_number || ''}
        actionLabel={isDelay ? 'Report Delay' : (ACTION_LABEL[confirmTrip?.status] || '')}
        targetStatus={confirmTarget}
        hasPod={(confirmTrip?.pod_count ?? 0) > 0}
        requiresReason={isDelay}
        onClose={() => { setConfirmTrip(null); setIsDelay(false); }}
        onConfirm={handleConfirm}
      />

      <IssueModal
        open={!!issueTrip}
        shipment={issueTrip}
        onClose={() => setIssueTrip(null)}
        onSubmitted={() => { loadIssues(); loadActive(); }}
      />

      <PodUploadModal
        open={!!podTrip}
        shipment={podTrip}
        onClose={() => setPodTrip(null)}
        onUploaded={handlePodUploaded}
      />
    </div>
  );
}
