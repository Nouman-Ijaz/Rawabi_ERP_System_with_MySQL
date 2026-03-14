import { useEffect, useState, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { shipmentsApi, driversApi, vehiclesApi, customersApi, availableApi } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { SHIPMENT_STATUS, APPROVAL_STATUS, TIMELINE_HEX } from '@/lib/statusStyles';
import { fmtDate, fmtDateTime, fmtSAR } from '@/lib/format';

// Local aliases — existing JSX uses STATUS_BADGE / APPROVAL_BADGE / TIMELINE_DOT
const STATUS_BADGE    = SHIPMENT_STATUS;
const APPROVAL_BADGE  = APPROVAL_STATUS;
const TIMELINE_DOT    = TIMELINE_HEX;

// ── styles ────────────────────────────────────────────────────────

const ALL_DOC_TYPES = [
  { value: 'pod',               label: 'Proof of Delivery (POD)',  roles: ['super_admin','admin','dispatcher','driver'] },
  { value: 'bill_of_lading',    label: 'Bill of Lading',           roles: ['super_admin','admin','dispatcher'] },
  { value: 'packing_list',      label: 'Packing List',             roles: ['super_admin','admin','dispatcher'] },
  { value: 'customs_clearance', label: 'Customs Clearance',        roles: ['super_admin','admin','dispatcher'] },
  { value: 'invoice',           label: 'Invoice',                  roles: ['super_admin','admin'] },
  { value: 'insurance',         label: 'Insurance Certificate',    roles: ['super_admin','admin'] },
  { value: 'other',             label: 'Other',                    roles: ['super_admin','admin','dispatcher'] },
];

// ── role-aware status options (industry standard) ─────────────────
const STATUS_OPTIONS: Record<string, { value: string; label: string; desc: string }[]> = {
  admin: [
    { value: 'confirmed',  label: 'Confirmed',  desc: 'Shipment verified and ready for pickup' },
    { value: 'picked_up',  label: 'Picked Up',  desc: 'Cargo collected from origin' },
    { value: 'in_transit', label: 'In Transit', desc: 'Shipment is on the road' },
    { value: 'customs',    label: 'In Customs', desc: 'Shipment held at customs' },
    { value: 'delivered',  label: 'Delivered',  desc: 'Cargo delivered to recipient' },
    { value: 'cancelled',  label: 'Cancelled',  desc: 'Shipment cancelled' },
    { value: 'returned',   label: 'Returned',   desc: 'Cargo returned to sender' },
  ],
  dispatcher: [
    { value: 'confirmed',  label: 'Confirmed',  desc: 'Shipment verified and ready for pickup' },
    { value: 'picked_up',  label: 'Picked Up',  desc: 'Cargo collected from origin' },
    { value: 'in_transit', label: 'In Transit', desc: 'Shipment is on the road' },
    { value: 'customs',    label: 'In Customs', desc: 'Shipment held at customs' },
    { value: 'delivered',  label: 'Delivered',  desc: 'Cargo delivered to recipient' },
    { value: 'cancelled',  label: 'Cancelled',  desc: 'Shipment cancelled' },
  ],
  driver: [
    { value: 'picked_up',  label: 'Picked Up',  desc: 'I have collected the cargo' },
    { value: 'in_transit', label: 'In Transit', desc: 'En route to destination' },
    { value: 'delivered',  label: 'Delivered',  desc: 'Cargo delivered successfully' },
  ],
};

// ── helpers ───────────────────────────────────────────────────────
const fileSize = (bytes: number) => bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(0)} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;

function SCard({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="bg-[#1a1d27] rounded-xl border border-white/5 p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{title}</h2>
        {action}
      </div>
      {children}
    </div>
  );
}

function Row({ label, value, italic }: { label: string; value?: string | number | null; italic?: boolean }) {
  return (
    <div>
      <p className="text-[11px] text-slate-500 mb-0.5">{label}</p>
      <p className={`text-sm font-medium ${value ? 'text-white' : 'text-slate-600 italic'} ${italic ? 'italic' : ''}`}>
        {value ?? '—'}
      </p>
    </div>
  );
}

function DIn(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} style={props.type === 'date' ? { colorScheme: 'dark' } : undefined}
    className="w-full px-3 py-2 text-xs bg-[#0f1117] border border-white/10 rounded-lg text-white placeholder-slate-600 focus:outline-none focus:border-blue-500/50" />;
}
function DTa(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className="w-full px-3 py-2 text-xs bg-[#0f1117] border border-white/10 rounded-lg text-white placeholder-slate-600 focus:outline-none focus:border-blue-500/50 resize-none" />;
}
function DSel({ value, onChange, children }: { value: string; onChange: (v: string) => void; children: React.ReactNode }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="bg-[#0f1117] border-white/10 text-xs text-white h-9 focus:ring-blue-500/20">
        <SelectValue />
      </SelectTrigger>
      <SelectContent className="bg-[#1a1d27] border-white/10 text-xs text-white">{children}</SelectContent>
    </Select>
  );
}

const STATUS_FLOW = ['pending', 'confirmed', 'picked_up', 'in_transit', 'customs', 'delivered'];

// ── component ─────────────────────────────────────────────────────
export default function ShipmentDetail() {
  const { id } = useParams<{ id: string }>();
  const { user, hasPermission } = useAuth();
  const [shipment, setShipment] = useState<any>(null);
  const [loading, setLoading]   = useState(true);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [drivers,  setDrivers]  = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [tab, setTab]           = useState<'details' | 'timeline' | 'documents'>('details');

  // status modal
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [pendingStatus, setPendingStatus]     = useState('');
  const [statusNote, setStatusNote]           = useState('');
  const [statusLocation, setStatusLocation]   = useState('');
  const [updatingStatus, setUpdatingStatus]   = useState(false);

  // assign
  const [assignOpen, setAssignOpen]   = useState(false);
  const [assignForm, setAssignForm]   = useState({ vehicleId: 'none', driverId: 'none' });

  // edit
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState<any>({});

  // document upload
  const [docType, setDocType]   = useState('');
  const [docNotes, setDocNotes] = useState('');
  const [docFile, setDocFile]   = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isDriver     = user?.role === 'driver';
  const isDispatcher = hasPermission(['super_admin', 'admin', 'dispatcher']);
  const isSuperAdmin = user?.role === 'super_admin';
  const roleKey      = user?.role === 'super_admin' ? 'admin' : (user?.role || 'driver');
  const statusOptions = STATUS_OPTIONS[roleKey] || STATUS_OPTIONS.driver;
  const lockedForAssign = ['picked_up', 'in_transit', 'customs', 'delivered'].includes(shipment?.status);
  const allowedDocTypes = ALL_DOC_TYPES.filter(d => d.roles.includes(user?.role || 'driver'));

  useEffect(() => { if (id) load(); }, [id]);

  // Default doc type to first allowed for this role
  useEffect(() => {
    if (allowedDocTypes.length > 0 && !docType) {
      setDocType(allowedDocTypes[0].value);
    }
  }, [allowedDocTypes.length]);

  useEffect(() => {
    if (!isDispatcher) return;
    Promise.all([customersApi.getAll({})])
      .then(([cd]) => {
        setCustomers((Array.isArray(cd) ? cd : (cd as any)?.data) || []);
      }).catch(() => {});
  }, [isDispatcher]);

  // Load available (non-busy) vehicles and drivers whenever assign panel opens
  useEffect(() => {
    if (!assignOpen || !isDispatcher) return;
    Promise.all([
      availableApi.vehicles(shipment?.id),
      availableApi.drivers(shipment?.id),
    ]).then(([vd, dd]) => {
      setVehicles(Array.isArray(vd) ? vd : []);
      setDrivers(Array.isArray(dd)  ? dd : []);
    }).catch(() => {});
  }, [assignOpen]);

  const load = async () => {
    try {
      const data = await shipmentsApi.getById(parseInt(id!));
      setShipment(data);
    } catch {
      toast.error('Failed to load shipment');
    } finally {
      setLoading(false);
    }
  };

  // ── status change ─────────────────────────────────────────────
  const openStatusModal = (status: string) => {
    setPendingStatus(status);
    setStatusNote('');
    setStatusLocation('');
    setShowStatusModal(true);
  };

  const confirmStatusChange = async () => {
    setUpdatingStatus(true);
    try {
      await shipmentsApi.updateStatus(shipment.id, pendingStatus, statusLocation || undefined, statusNote || undefined);
      toast.success(`Status updated to ${pendingStatus.replace(/_/g, ' ')}`);
      setShowStatusModal(false);
      load();
    } catch (e: any) {
      toast.error(e?.message || 'Failed to update status');
    } finally {
      setUpdatingStatus(false);
    }
  };

  // ── assign ───────────────────────────────────────────────────
  const handleAssign = async () => {
    const vId = assignForm.vehicleId !== 'none' ? parseInt(assignForm.vehicleId) : null;
    const dId = assignForm.driverId  !== 'none' ? parseInt(assignForm.driverId)  : null;
    try {
      await shipmentsApi.assignVehicleAndDriver(shipment.id, vId as any, dId as any);
      toast.success('Assignment updated');
      setAssignOpen(false);
      load();
    } catch (e: any) {
      toast.error(e?.message || 'Failed to assign');
    }
  };

  // ── edit ─────────────────────────────────────────────────────
  const openEdit = () => {
    setEditForm({
      customerId:           shipment.customer_id?.toString() || '',
      originCity:           shipment.origin_city || '',
      originAddress:        shipment.origin_address || '',
      destinationCity:      shipment.destination_city || '',
      destinationAddress:   shipment.destination_address || '',
      cargoType:            shipment.cargo_type || '',
      cargoDescription:     shipment.cargo_description || '',
      weightKg:             shipment.weight_kg?.toString() || '',
      volumeCbm:            shipment.volume_cbm?.toString() || '',
      pieces:               shipment.pieces?.toString() || '',
      transportMode:        shipment.transport_mode || 'road',
      serviceType:          shipment.service_type || 'standard',
      specialInstructions:  shipment.special_instructions || '',
      quotedAmount:         shipment.quoted_amount?.toString() || '',
      finalAmount:          shipment.final_amount?.toString() || '',
      requestedPickupDate:  shipment.requested_pickup_date?.split('T')[0] || '',
      requestedDeliveryDate:shipment.requested_delivery_date?.split('T')[0] || '',
    });
    setEditOpen(true);
  };

  const handleEdit = async () => {
    try {
      await shipmentsApi.update(shipment.id, {
        customerId:           editForm.customerId ? parseInt(editForm.customerId) : undefined,
        originCity:           editForm.originCity           || undefined,
        originAddress:        editForm.originAddress        || undefined,
        destinationCity:      editForm.destinationCity      || undefined,
        destinationAddress:   editForm.destinationAddress   || undefined,
        cargoType:            editForm.cargoType            || undefined,
        cargoDescription:     editForm.cargoDescription     || undefined,
        weightKg:             editForm.weightKg   ? parseFloat(editForm.weightKg)   : undefined,
        volumeCbm:            editForm.volumeCbm  ? parseFloat(editForm.volumeCbm)  : undefined,
        pieces:               editForm.pieces     ? parseInt(editForm.pieces)       : undefined,
        transportMode:        editForm.transportMode        || undefined,
        serviceType:          editForm.serviceType          || undefined,
        specialInstructions:  editForm.specialInstructions  || undefined,
        quotedAmount:         editForm.quotedAmount ? parseFloat(editForm.quotedAmount) : undefined,
        finalAmount:          editForm.finalAmount  ? parseFloat(editForm.finalAmount)  : undefined,
        requestedPickupDate:  editForm.requestedPickupDate  || undefined,
        requestedDeliveryDate:editForm.requestedDeliveryDate || undefined,
      });
      toast.success('Shipment updated');
      setEditOpen(false);
      load();
    } catch (e: any) {
      toast.error(e?.message || 'Failed to update');
    }
  };

  // ── document upload ──────────────────────────────────────────
  const handleUpload = async () => {
    if (!docFile) { toast.error('Select a file first'); return; }
    setUploading(true);
    try {
      await shipmentsApi.uploadDocument(shipment.id, docFile, docType, docNotes || undefined);
      toast.success('Document uploaded');
      setDocFile(null);
      setDocNotes('');
      if (fileInputRef.current) fileInputRef.current.value = '';
      load();
    } catch (e: any) {
      toast.error(e?.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteDoc = async (docId: number) => {
    try {
      await shipmentsApi.deleteDocument(shipment.id, docId);
      toast.success('Document deleted');
      load();
    } catch {
      toast.error('Failed to delete document');
    }
  };

  // ── loading / not found ───────────────────────────────────────
  if (loading) return (
    <div className="flex items-center justify-center h-80">
      <div className="w-7 h-7 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
    </div>
  );
  if (!shipment) return (
    <div className="text-center py-20">
      <p className="text-slate-500">Shipment not found</p>
      <Link to="/shipments" className="text-blue-400 text-sm mt-2 inline-block">Back to shipments</Link>
    </div>
  );

  const tracking = shipment.tracking || [];
  const documents = shipment.documents || [];
  const currentIdx = STATUS_FLOW.indexOf(shipment.status);

  return (
    <div className="space-y-5 max-w-6xl">

      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <Link to="/shipments"
            className="p-2 text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 rounded-lg transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 19l-7-7 7-7"/>
            </svg>
          </Link>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold text-white font-mono">{shipment.shipment_number}</h1>
              <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium border ${STATUS_BADGE[shipment.status] || STATUS_BADGE.pending}`}>
                {shipment.status?.replace(/_/g, ' ')}
              </span>
              <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${APPROVAL_BADGE[shipment.approval_status] || ''}`}>
                {shipment.approval_status?.replace(/_/g, ' ')}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Tracking: <span className="font-mono text-slate-400">{shipment.tracking_number}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Edit shipment details */}
          {isDispatcher && !['delivered','cancelled','returned'].includes(shipment.status) && (
            <button onClick={openEdit}
              className="px-3 py-2 text-xs text-slate-300 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg transition-colors">
              Edit Details
            </button>
          )}
          {/* Change status */}
          {hasPermission(['super_admin','admin','dispatcher','driver']) &&
           !['delivered','cancelled','returned'].includes(shipment.status) && (
            <div className="relative group">
              <button className="px-3 py-2 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors flex items-center gap-2">
                Change Status
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/>
                </svg>
              </button>
              <div className="absolute right-0 top-full mt-1 w-64 bg-[#1a1d27] border border-white/10 rounded-xl shadow-2xl z-50 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all">
                <p className="text-[10px] text-slate-500 px-3 pt-3 pb-1 uppercase tracking-wider">Select new status</p>
                {statusOptions.map(opt => (
                  <button key={opt.value} onClick={() => openStatusModal(opt.value)}
                    className="w-full text-left px-3 py-2.5 hover:bg-white/5 transition-colors last:rounded-b-xl">
                    <p className="text-xs font-medium text-white">{opt.label}</p>
                    <p className="text-[10px] text-slate-500">{opt.desc}</p>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Progress bar ──────────────────────────────────────── */}
      {!['cancelled','returned'].includes(shipment.status) && (
        <div className="bg-[#1a1d27] rounded-xl border border-white/5 p-5">
          <div className="flex items-center">
            {STATUS_FLOW.map((s, i) => (
              <div key={s} className="flex items-center flex-1 last:flex-none">
                <div className="flex flex-col items-center">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold border-2 ${
                    i < currentIdx  ? 'bg-emerald-500 border-emerald-500 text-white' :
                    i === currentIdx ? 'border-blue-500 bg-blue-500/20 text-blue-400' :
                                       'border-white/10 bg-white/5 text-slate-600'
                  }`}>
                    {i < currentIdx ? '✓' : i + 1}
                  </div>
                  <p className={`text-[10px] mt-1 text-center whitespace-nowrap ${i <= currentIdx ? 'text-slate-300' : 'text-slate-600'}`}>
                    {s.replace(/_/g, ' ')}
                  </p>
                </div>
                {i < STATUS_FLOW.length - 1 && (
                  <div className={`flex-1 h-0.5 mx-1 mb-4 ${i < currentIdx ? 'bg-emerald-500' : 'bg-white/10'}`} />
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Tabs ─────────────────────────────────────────────── */}
      <div className="flex gap-1 bg-[#1a1d27] rounded-xl border border-white/5 p-1 w-fit">
        {(['details','timeline','documents'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 text-xs font-medium rounded-lg transition-colors capitalize ${
              tab === t ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
            }`}>
            {t}
            {t === 'documents' && documents.length > 0 && (
              <span className="ml-1.5 px-1.5 py-0.5 bg-white/10 rounded-full text-[10px]">{documents.length}</span>
            )}
          </button>
        ))}
      </div>

      {/* ── Tab: Details ────────────────────────────────────── */}
      {tab === 'details' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 space-y-4">

            <SCard title="Shipment Details">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-4">
                <Row label="Customer"      value={shipment.customer_name} />
                <Row label="Cargo Type"    value={shipment.cargo_type} />
                <Row label="Transport"     value={shipment.transport_mode} />
                <Row label="Service"       value={shipment.service_type} />
                <Row label="Weight"        value={shipment.weight_kg ? `${shipment.weight_kg} kg` : null} />
                <Row label="Volume"        value={shipment.volume_cbm ? `${shipment.volume_cbm} cbm` : null} />
                <Row label="Pieces"        value={shipment.pieces} />
                <Row label="Quoted (SAR)"  value={shipment.quoted_amount ? fmtSAR(shipment.quoted_amount) : null} />
                <Row label="Final (SAR)"   value={shipment.final_amount  ? fmtSAR(shipment.final_amount)  : null} />
              </div>
              <div className="grid grid-cols-2 gap-x-6 gap-y-4 mt-4 pt-4 border-t border-white/5">
                <div>
                  <p className="text-[11px] text-slate-500 mb-0.5">Origin</p>
                  <p className="text-sm font-medium text-white">{shipment.origin_city}</p>
                  {shipment.origin_address && <p className="text-xs text-slate-500">{shipment.origin_address}</p>}
                </div>
                <div>
                  <p className="text-[11px] text-slate-500 mb-0.5">Destination</p>
                  <p className="text-sm font-medium text-white">{shipment.destination_city}</p>
                  {shipment.destination_address && <p className="text-xs text-slate-500">{shipment.destination_address}</p>}
                </div>
              </div>
              {(shipment.cargo_description || shipment.special_instructions) && (
                <div className="mt-4 pt-4 border-t border-white/5 space-y-3">
                  {shipment.cargo_description && <Row label="Cargo Description" value={shipment.cargo_description} />}
                  {shipment.special_instructions && <Row label="Special Instructions" value={shipment.special_instructions} />}
                </div>
              )}
              {shipment.rejection_reason && (
                <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                  <p className="text-[11px] text-red-400 font-medium mb-0.5">Rejection Reason</p>
                  <p className="text-sm text-red-300">{shipment.rejection_reason}</p>
                </div>
              )}
            </SCard>

          </div>

          {/* Sidebar */}
          <div className="space-y-4">

            {/* Assignment */}
            <SCard title="Assignment" action={
              isDispatcher && (!lockedForAssign || isSuperAdmin) ? (
                <button onClick={() => {
                  setAssignForm({
                    vehicleId: shipment.vehicle_id?.toString() || 'none',
                    driverId:  shipment.driver_id?.toString()  || 'none',
                  });
                  setAssignOpen(true);
                }} className="text-[11px] text-blue-400 hover:text-blue-300 transition-colors">
                  {shipment.driver_id || shipment.vehicle_id ? 'Reassign' : 'Assign'}
                </button>
              ) : lockedForAssign && isDispatcher && !isSuperAdmin ? (
                <span className="text-[11px] text-slate-600 italic">Locked</span>
              ) : null
            }>
              {assignOpen ? (
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <p className="text-[11px] text-slate-500">Vehicle</p>
                    <DSel value={assignForm.vehicleId} onChange={v => setAssignForm(p => ({ ...p, vehicleId: v }))}>
                      <SelectItem value="none">None</SelectItem>
                      {vehicles.map((v: any) => <SelectItem key={v.id} value={v.id.toString()}>{v.plate_number} ({v.vehicle_type})</SelectItem>)}
                    </DSel>
                  </div>
                  <div className="space-y-1.5">
                    <p className="text-[11px] text-slate-500">Driver</p>
                    <DSel value={assignForm.driverId} onChange={v => setAssignForm(p => ({ ...p, driverId: v }))}>
                      <SelectItem value="none">None</SelectItem>
                      {drivers.map((d: any) => <SelectItem key={d.id} value={d.id.toString()}>{d.first_name} {d.last_name}{d.driver_status === 'on_trip' ? ' (on trip — unassigned)' : ''}</SelectItem>)}
                    </DSel>
                  </div>
                  <p className="text-[10px] text-slate-600">Only available drivers and vehicles are safe to assign. Busy ones will be rejected by the server.</p>
                  <div className="flex gap-2">
                    <button onClick={() => setAssignOpen(false)}
                      className="flex-1 py-2 text-xs text-slate-400 bg-white/5 hover:bg-white/10 rounded-lg">Cancel</button>
                    <button onClick={handleAssign}
                      className="flex-1 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg">Save</button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-slate-600 to-slate-700 flex items-center justify-center text-[11px] font-bold text-white flex-shrink-0">
                      {shipment.driver_name ? shipment.driver_name.split(' ').map((n: string) => n[0]).join('') : '?'}
                    </div>
                    <div>
                      <p className="text-[11px] text-slate-500">Driver</p>
                      <p className={`text-sm font-medium ${shipment.driver_name ? 'text-white' : 'text-slate-600 italic'}`}>
                        {shipment.driver_name || 'Unassigned'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center flex-shrink-0">
                      <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z"/>
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0"/>
                      </svg>
                    </div>
                    <div>
                      <p className="text-[11px] text-slate-500">Vehicle</p>
                      <p className={`text-sm font-medium ${shipment.vehicle_plate ? 'text-white' : 'text-slate-600 italic'}`}>
                        {shipment.vehicle_plate || 'Unassigned'}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </SCard>

            {/* Timeline sidebar */}
            <SCard title="Timeline">
              <div className="space-y-2.5">
                {[
                  { label: 'Order Date',         value: fmtDate(shipment.order_date) },
                  { label: 'Req. Pickup',        value: fmtDate(shipment.requested_pickup_date) },
                  { label: 'Req. Delivery',      value: fmtDate(shipment.requested_delivery_date) },
                  { label: 'Actual Pickup',      value: fmtDateTime(shipment.actual_pickup_date),   pending: !shipment.actual_pickup_date },
                  { label: 'Actual Delivery',    value: fmtDateTime(shipment.actual_delivery_date), pending: !shipment.actual_delivery_date },
                ].map(r => (
                  <div key={r.label} className="flex items-center justify-between gap-2">
                    <p className="text-[11px] text-slate-500 flex-shrink-0">{r.label}</p>
                    <p className={`text-xs font-medium text-right ${r.pending ? 'text-slate-600 italic' : 'text-white'}`}>
                      {r.pending ? 'Not yet' : (r.value || '—')}
                    </p>
                  </div>
                ))}
              </div>
            </SCard>

            {/* Meta */}
            <SCard title="Record">
              <div className="space-y-2.5">
                {[
                  { label: 'Created by',  value: shipment.created_by_name },
                  { label: 'Created',     value: fmtDate(shipment.created_at) },
                  { label: 'Approved by', value: shipment.approved_by_name },
                  { label: 'Approved',    value: fmtDateTime(shipment.approved_at) },
                ].filter(r => r.value).map(r => (
                  <div key={r.label} className="flex items-center justify-between gap-2">
                    <p className="text-[11px] text-slate-500">{r.label}</p>
                    <p className="text-xs font-medium text-white text-right">{r.value}</p>
                  </div>
                ))}
              </div>
            </SCard>

          </div>
        </div>
      )}

      {/* ── Tab: Timeline ─────────────────────────────────────── */}
      {tab === 'timeline' && (
        <div className="bg-[#1a1d27] rounded-xl border border-white/5 p-5 max-w-2xl">
          {tracking.length === 0 ? (
            <p className="text-xs text-slate-500 text-center py-8">No tracking events yet</p>
          ) : (
            <div>
              {tracking.map((e: any, i: number) => (
                <div key={e.id} className="flex gap-4 relative">
                  <div className="flex flex-col items-center flex-shrink-0">
                    <div className="w-3 h-3 rounded-full mt-0.5 flex-shrink-0 ring-4 ring-[#1a1d27]"
                      style={{ background: TIMELINE_DOT[e.event_type?.toLowerCase()] || TIMELINE_DOT[shipment.status] || '#3b82f6' }} />
                    {i < tracking.length - 1 && <div className="w-px flex-1 bg-white/5 my-1 min-h-[24px]" />}
                  </div>
                  <div className="pb-5 flex-1 min-w-0">
                    <p className="text-xs font-semibold text-white">{e.event_description || e.event_type}</p>
                    {e.location && <p className="text-[11px] text-slate-400 mt-0.5">📍 {e.location}</p>}
                    {e.notes     && <p className="text-[11px] text-slate-500 mt-0.5 italic">{e.notes}</p>}
                    <div className="flex items-center gap-2 mt-1">
                      <p className="text-[10px] text-slate-600">{fmtDateTime(e.event_time)}</p>
                      {e.recorded_by_name && <p className="text-[10px] text-slate-600">· {e.recorded_by_name}</p>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Tab: Documents ────────────────────────────────────── */}
      {tab === 'documents' && (
        <div className="space-y-4 max-w-2xl">

          {/* Upload card */}
          {hasPermission(['super_admin','admin','dispatcher','driver']) && (
            <SCard title="Upload Document">
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <p className="text-[11px] text-slate-500">Document Type</p>
                  <DSel value={docType} onChange={setDocType}>
                    {allowedDocTypes.map(d => <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)}
                  </DSel>
                </div>
                <div className="space-y-1.5">
                  <p className="text-[11px] text-slate-500">File</p>
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors ${
                      docFile ? 'border-blue-500/40 bg-blue-500/5' : 'border-white/10 hover:border-white/20'
                    }`}>
                    {docFile ? (
                      <div>
                        <p className="text-xs font-medium text-white">{docFile.name}</p>
                        <p className="text-[10px] text-slate-500 mt-0.5">{fileSize(docFile.size)}</p>
                      </div>
                    ) : (
                      <div>
                        <p className="text-xs text-slate-400">Click to select file</p>
                        <p className="text-[10px] text-slate-600 mt-0.5">PDF, JPG, PNG up to 10MB</p>
                      </div>
                    )}
                  </div>
                  <input ref={fileInputRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                    className="hidden" onChange={e => setDocFile(e.target.files?.[0] || null)} />
                </div>
                <div className="space-y-1.5">
                  <p className="text-[11px] text-slate-500">Notes (optional)</p>
                  <DTa value={docNotes} onChange={e => setDocNotes(e.target.value)} rows={2} placeholder="Any notes about this document..." />
                </div>
                <button onClick={handleUpload} disabled={!docFile || uploading}
                  className="w-full py-2.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg transition-colors">
                  {uploading ? 'Uploading...' : 'Upload Document'}
                </button>
              </div>
            </SCard>
          )}

          {/* Documents list */}
          <SCard title={`Documents (${documents.length})`}>
            {documents.length === 0 ? (
              <p className="text-xs text-slate-500 text-center py-6">No documents uploaded yet</p>
            ) : (
              <div className="space-y-2">
                {documents.map((doc: any) => (
                  <div key={doc.id} className="flex items-center gap-3 p-3 bg-white/[0.03] rounded-lg border border-white/5">
                    <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center flex-shrink-0">
                      <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <a href={`${import.meta.env.VITE_API_URL?.replace('/api','') || 'http://localhost:3001'}/uploads/shipment_documents/${doc.file_path}`}
                        target="_blank" rel="noopener noreferrer"
                        className="text-xs font-medium text-blue-400 hover:text-blue-300 hover:underline truncate block">
                        {doc.document_name}
                      </a>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] px-1.5 py-0.5 bg-white/5 rounded text-slate-400">
                          {ALL_DOC_TYPES.find(d => d.value === doc.document_type)?.label || doc.document_type}
                        </span>
                        <p className="text-[10px] text-slate-600">{fmtDateTime(doc.uploaded_at)}</p>
                        {doc.uploaded_by_name && <p className="text-[10px] text-slate-600">· {doc.uploaded_by_name}</p>}
                      </div>
                      {doc.notes && <p className="text-[10px] text-slate-500 mt-0.5 italic">{doc.notes}</p>}
                    </div>
                    {(doc.uploaded_by === user?.id || hasPermission(['super_admin','admin'])) && (
                      <button onClick={() => handleDeleteDoc(doc.id)}
                        className="p-1.5 text-slate-600 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors flex-shrink-0" title="Delete">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                        </svg>
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </SCard>
        </div>
      )}

      {/* ── Status Confirmation Modal ─────────────────────────── */}
      {showStatusModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-[#1a1d27] border border-white/10 rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <h3 className="text-base font-bold text-white mb-1">Confirm Status Change</h3>
            <p className="text-xs text-slate-400 mb-5">
              Changing <span className="text-white font-mono">{shipment.shipment_number}</span> to{' '}
              <span className={`px-1.5 py-0.5 rounded text-[11px] font-medium ${STATUS_BADGE[pendingStatus] || 'bg-slate-500/15 text-slate-400'}`}>
                {pendingStatus.replace(/_/g, ' ')}
              </span>
            </p>
            <div className="space-y-3 mb-5">
              <div>
                <p className="text-[11px] text-slate-500 mb-1.5">Current Location (optional)</p>
                <DIn value={statusLocation} onChange={e => setStatusLocation(e.target.value)} placeholder="e.g. Riyadh Gate" />
              </div>
              <div>
                <p className="text-[11px] text-slate-500 mb-1.5">Notes (optional)</p>
                <DTa value={statusNote} onChange={e => setStatusNote(e.target.value)} rows={2} placeholder="Any additional notes..." />
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowStatusModal(false)}
                className="flex-1 py-2.5 text-xs text-slate-400 bg-white/5 hover:bg-white/10 rounded-lg">
                Cancel
              </button>
              <button onClick={confirmStatusChange} disabled={updatingStatus}
                className="flex-1 py-2.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg">
                {updatingStatus ? 'Updating...' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Edit Shipment Modal ───────────────────────────────── */}
      {editOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-[#1a1d27] border border-white/10 rounded-2xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
            <h3 className="text-base font-bold text-white mb-5">Edit Shipment</h3>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2 space-y-1.5">
                  <p className="text-[11px] text-slate-500">Customer</p>
                  <DSel value={editForm.customerId} onChange={v => setEditForm((p: any) => ({ ...p, customerId: v }))}>
                    {customers.map((c: any) => <SelectItem key={c.id} value={c.id.toString()}>{c.company_name}</SelectItem>)}
                  </DSel>
                </div>
                <div className="space-y-1.5">
                  <p className="text-[11px] text-slate-500">Origin City</p>
                  <DIn value={editForm.originCity} onChange={e => setEditForm((p: any) => ({ ...p, originCity: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <p className="text-[11px] text-slate-500">Origin Address</p>
                  <DIn value={editForm.originAddress} onChange={e => setEditForm((p: any) => ({ ...p, originAddress: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <p className="text-[11px] text-slate-500">Destination City</p>
                  <DIn value={editForm.destinationCity} onChange={e => setEditForm((p: any) => ({ ...p, destinationCity: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <p className="text-[11px] text-slate-500">Destination Address</p>
                  <DIn value={editForm.destinationAddress} onChange={e => setEditForm((p: any) => ({ ...p, destinationAddress: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <p className="text-[11px] text-slate-500">Cargo Type</p>
                  <DIn value={editForm.cargoType} onChange={e => setEditForm((p: any) => ({ ...p, cargoType: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <p className="text-[11px] text-slate-500">Weight (kg)</p>
                  <DIn type="number" value={editForm.weightKg} onChange={e => setEditForm((p: any) => ({ ...p, weightKg: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <p className="text-[11px] text-slate-500">Volume (cbm)</p>
                  <DIn type="number" value={editForm.volumeCbm} onChange={e => setEditForm((p: any) => ({ ...p, volumeCbm: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <p className="text-[11px] text-slate-500">Pieces</p>
                  <DIn type="number" value={editForm.pieces} onChange={e => setEditForm((p: any) => ({ ...p, pieces: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <p className="text-[11px] text-slate-500">Transport Mode</p>
                  <DSel value={editForm.transportMode} onChange={v => setEditForm((p: any) => ({ ...p, transportMode: v }))}>
                    <SelectItem value="road">Road</SelectItem>
                    <SelectItem value="sea">Sea</SelectItem>
                    <SelectItem value="air">Air</SelectItem>
                    <SelectItem value="multimodal">Multimodal</SelectItem>
                  </DSel>
                </div>
                <div className="space-y-1.5">
                  <p className="text-[11px] text-slate-500">Service Type</p>
                  <DSel value={editForm.serviceType} onChange={v => setEditForm((p: any) => ({ ...p, serviceType: v }))}>
                    <SelectItem value="standard">Standard</SelectItem>
                    <SelectItem value="express">Express</SelectItem>
                    <SelectItem value="economy">Economy</SelectItem>
                  </DSel>
                </div>
                <div className="space-y-1.5">
                  <p className="text-[11px] text-slate-500">Quoted Amount (SAR)</p>
                  <DIn type="number" value={editForm.quotedAmount} onChange={e => setEditForm((p: any) => ({ ...p, quotedAmount: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <p className="text-[11px] text-slate-500">Final Amount (SAR)</p>
                  <DIn type="number" value={editForm.finalAmount} onChange={e => setEditForm((p: any) => ({ ...p, finalAmount: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <p className="text-[11px] text-slate-500">Req. Pickup Date</p>
                  <DIn type="date" value={editForm.requestedPickupDate} onChange={e => setEditForm((p: any) => ({ ...p, requestedPickupDate: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <p className="text-[11px] text-slate-500">Req. Delivery Date</p>
                  <DIn type="date" value={editForm.requestedDeliveryDate} onChange={e => setEditForm((p: any) => ({ ...p, requestedDeliveryDate: e.target.value }))} />
                </div>
                <div className="col-span-2 space-y-1.5">
                  <p className="text-[11px] text-slate-500">Cargo Description</p>
                  <DTa value={editForm.cargoDescription} onChange={e => setEditForm((p: any) => ({ ...p, cargoDescription: e.target.value }))} rows={2} />
                </div>
                <div className="col-span-2 space-y-1.5">
                  <p className="text-[11px] text-slate-500">Special Instructions</p>
                  <DTa value={editForm.specialInstructions} onChange={e => setEditForm((p: any) => ({ ...p, specialInstructions: e.target.value }))} rows={2} />
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={() => setEditOpen(false)}
                  className="flex-1 py-2.5 text-xs text-slate-400 bg-white/5 hover:bg-white/10 rounded-lg">Cancel</button>
                <button onClick={handleEdit}
                  className="flex-1 py-2.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg">Save Changes</button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
