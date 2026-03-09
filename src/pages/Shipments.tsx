import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { shipmentsApi, customersApi, vehiclesApi, driversApi, availableApi } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { ROLES } from '@/lib/roles';
// ── types ─────────────────────────────────────────────────────────
interface Shipment {
  id: number;
  shipment_number: string;
  tracking_number: string;
  customer_name: string;
  customer_id: number;
  origin_city: string;
  destination_city: string;
  origin_address: string;
  destination_address: string;
  weight_kg: number;
  requested_delivery_date: string;
  status: string;
  approval_status: string;
  rejection_reason?: string;
  driver_name?: string;
  vehicle_plate?: string;
  cargo_type: string;
  transport_mode: string;
  quoted_amount?: number;
}
interface Customer { id: number; company_name: string; }
interface Vehicle  { id: number; plate_number: string; vehicle_type: string; }
interface Driver   { id: number; first_name: string; last_name: string; }

// ── constants ─────────────────────────────────────────────────────
import { SHIPMENT_STATUS, APPROVAL_STATUS } from '@/lib/statusStyles';

const emptyForm = {
  customerId: '', orderDate: new Date().toISOString().split('T')[0],
  requestedPickupDate: '', requestedDeliveryDate: '',
  originAddress: '', originCity: '', destinationAddress: '', destinationCity: '',
  cargoType: '', cargoDescription: '', weightKg: '', volumeCbm: '', pieces: '1',
  transportMode: 'road', serviceType: 'standard',
  specialInstructions: '', quotedAmount: '',
  vehicleId: 'none', driverId: 'none',
};

function safeArray(res: unknown): unknown[] {
  if (Array.isArray(res)) return res;
  if (res && typeof res === 'object') {
    const r = res as Record<string, unknown>;
    if (Array.isArray(r.data)) return r.data;
  }
  return [];
}

// ── icons ──────────────────────────────────────────────────────────
const PlusIcon    = (p: React.SVGProps<SVGSVGElement>) => <svg {...p} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4"/></svg>;
const SearchIcon  = (p: React.SVGProps<SVGSVGElement>) => <svg {...p} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>;
const EyeIcon     = (p: React.SVGProps<SVGSVGElement>) => <svg {...p} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>;
const CheckIcon   = (p: React.SVGProps<SVGSVGElement>) => <svg {...p} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 13l4 4L19 7"/></svg>;
const XIcon       = (p: React.SVGProps<SVGSVGElement>) => <svg {...p} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12"/></svg>;
const SendIcon    = (p: React.SVGProps<SVGSVGElement>) => <svg {...p} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"/></svg>;
const AssignIcon  = (p: React.SVGProps<SVGSVGElement>) => <svg {...p} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/></svg>;
const PackageIcon = (p: React.SVGProps<SVGSVGElement>) => <svg {...p} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/></svg>;

// ── field helpers ──────────────────────────────────────────────────
function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-slate-400">{label}{required && <span className="text-red-400 ml-0.5">*</span>}</Label>
      {children}
    </div>
  );
}

function DarkInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  const isDate = props.type === 'date';
  return (
    <input
      {...props}
      style={isDate ? { colorScheme: 'dark' } : undefined}
      className="w-full px-3 py-2 text-xs bg-[#0f1117] border border-white/10 rounded-lg text-white placeholder-slate-600 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20"
    />
  );
}

function DarkSelect({ value, onChange, children }: { value: string; onChange: (v: string) => void; children: React.ReactNode }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="bg-[#0f1117] border-white/10 text-xs text-white h-9 focus:ring-blue-500/20">
        <SelectValue />
      </SelectTrigger>
      <SelectContent className="bg-[#1a1d27] border-white/10 text-xs text-white">
        {children}
      </SelectContent>
    </Select>
  );
}

// ── main component ─────────────────────────────────────────────────
export default function Shipments() {
  const { user, hasPermission } = useAuth();
  const [shipments, setShipments]   = useState<Shipment[]>([]);
  const [customers, setCustomers]   = useState<Customer[]>([]);
  const [vehicles, setVehicles]     = useState<Vehicle[]>([]);
  const [drivers, setDrivers]       = useState<Driver[]>([]);
  const [loading, setLoading]       = useState(true);
  const [search, setSearch]         = useState('');
  const [statusFilter, setStatusFilter]     = useState('all');
  const [approvalFilter, setApprovalFilter] = useState('all');

  const [isAddOpen,    setIsAddOpen]    = useState(false);
  const [isAssignOpen, setIsAssignOpen] = useState(false);
  const [isRejectOpen, setIsRejectOpen] = useState(false);
  const [selected, setSelected]         = useState<Shipment | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [assignForm, setAssignForm]     = useState({ vehicleId: 'none', driverId: 'none' });
  const [form, setForm] = useState({ ...emptyForm });

  const canCreate   = hasPermission(ROLES.OPERATIONS);
  const canApprove  = hasPermission(ROLES.ADMIN_UP);
  const canDispatch = hasPermission(ROLES.OPERATIONS);

  const loadShipments = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (search)                         params.search          = search;
      if (statusFilter !== 'all')         params.status          = statusFilter;
      if (approvalFilter !== 'all')       params.approval_status = approvalFilter;
      const res = await shipmentsApi.getAll(params);
      setShipments(safeArray(res) as Shipment[]);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load shipments';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, approvalFilter]);

  const loadRefData = useCallback(async () => {
    try {
      const [cd, vd, dd] = await Promise.all([
        customersApi.getAll({}),
        availableApi.vehicles(),   // only vehicles not currently on active shipment
        availableApi.drivers(),    // only drivers not currently on active shipment
      ]);
      setCustomers(safeArray(cd) as Customer[]);
      setVehicles(Array.isArray(vd) ? vd as Vehicle[] : []);
      setDrivers(Array.isArray(dd)  ? dd as Driver[]  : []);
    } catch {
      // ref data failures are non-fatal — form just won't have dropdowns
    }
  }, []);

  useEffect(() => { loadShipments(); }, [loadShipments]);
  useEffect(() => { loadRefData(); }, [loadRefData]);

  // ── form helpers ──
  const f  = (k: keyof typeof emptyForm) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(p => ({ ...p, [k]: e.target.value }));
  const fs = (k: keyof typeof emptyForm) => (v: string) =>
    setForm(p => ({ ...p, [k]: v }));

  // ── create ────────────────────────────────────────────────────────
  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.customerId) { toast.error('Please select a customer'); return; }
    if (!form.originCity)      { toast.error('Origin city is required'); return; }
    if (!form.destinationCity) { toast.error('Destination city is required'); return; }
    if (!form.cargoType)       { toast.error('Cargo type is required'); return; }
    try {
      await shipmentsApi.create({
        customerId:           parseInt(form.customerId),
        orderDate:            form.orderDate,
        requestedPickupDate:  form.requestedPickupDate   || null,
        requestedDeliveryDate:form.requestedDeliveryDate || null,
        originAddress:        form.originAddress,
        originCity:           form.originCity,
        destinationAddress:   form.destinationAddress,
        destinationCity:      form.destinationCity,
        cargoType:            form.cargoType,
        cargoDescription:     form.cargoDescription,
        weightKg:             parseFloat(form.weightKg)    || null,
        volumeCbm:            parseFloat(form.volumeCbm)   || null,
        pieces:               parseInt(form.pieces)        || 1,
        transportMode:        form.transportMode,
        serviceType:          form.serviceType,
        specialInstructions:  form.specialInstructions,
        quotedAmount:         parseFloat(form.quotedAmount) || null,
        vehicleId:            form.vehicleId !== 'none' ? parseInt(form.vehicleId) : null,
        driverId:             form.driverId  !== 'none' ? parseInt(form.driverId)  : null,
      });
      toast.success('Shipment created');
      setIsAddOpen(false);
      setForm({ ...emptyForm });
      loadShipments();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to create shipment');
    }
  };

  // ── approval actions ──────────────────────────────────────────────
  const handleSubmitApproval = async (s: Shipment) => {
    try {
      await (shipmentsApi as any).submitForApproval(s.id);
      toast.success(`${s.shipment_number} submitted for approval`);
      loadShipments();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to submit for approval');
    }
  };

  const handleApprove = async (s: Shipment) => {
    try {
      await (shipmentsApi as any).approveShipment(s.id);
      toast.success(`${s.shipment_number} approved`);
      loadShipments();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to approve');
    }
  };

  const openReject = (s: Shipment) => { setSelected(s); setRejectReason(''); setIsRejectOpen(true); };

  const openAssign = (s: Shipment) => {
    setSelected(s);
    setAssignForm({
      vehicleId: s.vehicle_plate ? 'skip' : 'none',
      driverId:  s.driver_name  ? 'skip' : 'none',
    });
    setIsAssignOpen(true);
  };

  const handleAssign = async () => {
    if (!selected) return;
    const vId = assignForm.vehicleId !== 'none' && assignForm.vehicleId !== 'skip' ? parseInt(assignForm.vehicleId) : 0;
    const dId = assignForm.driverId  !== 'none' && assignForm.driverId  !== 'skip' ? parseInt(assignForm.driverId)  : 0;
    try {
      await shipmentsApi.assignVehicleAndDriver(selected.id, vId || null as any, dId || null as any);
      toast.success(`Assignment updated for ${selected.shipment_number}`);
      setIsAssignOpen(false);
      setSelected(null);
      loadShipments();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to assign');
    }
  };

  const handleReject = async () => {
    if (!selected) return;
    if (!rejectReason.trim()) { toast.error('Please provide a rejection reason'); return; }
    try {
      await (shipmentsApi as any).rejectShipment(selected.id, rejectReason);
      toast.success(`${selected.shipment_number} rejected`);
      setIsRejectOpen(false);
      setSelected(null);
      loadShipments();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to reject');
    }
  };

  // ── render ────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-white">Shipments</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            {shipments.length} shipment{shipments.length !== 1 ? 's' : ''}
            {user?.role === 'driver' ? ' assigned to you' : ' total'}
          </p>
        </div>
        {canCreate && (
          <button onClick={() => { setForm({ ...emptyForm }); setIsAddOpen(true); }}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-lg transition-colors">
            <PlusIcon className="w-3.5 h-3.5" /> New Shipment
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
          <input
            placeholder="Search shipment, customer, city..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-xs bg-[#1a1d27] border border-white/5 rounded-lg text-white placeholder-slate-600 focus:outline-none focus:border-blue-500/40"
          />
        </div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          className="px-3 py-2 text-xs bg-[#1a1d27] border border-white/5 rounded-lg text-slate-300 focus:outline-none focus:border-blue-500/40">
          <option value="all">All Status</option>
          <option value="pending">Pending</option>
          <option value="confirmed">Confirmed</option>
          <option value="picked_up">Picked Up</option>
          <option value="in_transit">In Transit</option>
          <option value="customs">In Customs</option>
          <option value="delivered">Delivered</option>
          <option value="cancelled">Cancelled</option>
          <option value="returned">Returned</option>
        </select>
        {canDispatch && (
          <select value={approvalFilter} onChange={e => setApprovalFilter(e.target.value)}
            className="px-3 py-2 text-xs bg-[#1a1d27] border border-white/5 rounded-lg text-slate-300 focus:outline-none focus:border-blue-500/40">
            <option value="all">All Approvals</option>
            <option value="draft">Draft</option>
            <option value="pending_approval">Pending Approval</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
        )}
      </div>

      {/* Table */}
      <div className="bg-[#1a1d27] rounded-xl border border-white/5 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-6 h-6 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
          </div>
        ) : shipments.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-500">
            <PackageIcon className="w-10 h-10 mb-3 opacity-30" />
            <p className="text-sm">No shipments found</p>
            {canCreate && (
              <button onClick={() => setIsAddOpen(true)} className="mt-3 text-xs text-blue-400 hover:text-blue-300">
                Create your first shipment
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-white/5">
                  <th className="text-left px-4 py-3 text-slate-500 font-medium">Shipment</th>
                  <th className="text-left px-4 py-3 text-slate-500 font-medium">Customer</th>
                  <th className="text-left px-4 py-3 text-slate-500 font-medium">Route</th>
                  <th className="text-left px-4 py-3 text-slate-500 font-medium">Driver / Vehicle</th>
                  <th className="text-left px-4 py-3 text-slate-500 font-medium">Status</th>
                  {canDispatch && <th className="text-left px-4 py-3 text-slate-500 font-medium">Approval</th>}
                  <th className="text-right px-4 py-3 text-slate-500 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {shipments.map(s => (
                  <tr key={s.id} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-mono text-white font-medium">{s.shipment_number}</p>
                      <p className="text-slate-500 mt-0.5 capitalize">{s.transport_mode}</p>
                    </td>
                    <td className="px-4 py-3 text-slate-300">{s.customer_name}</td>
                    <td className="px-4 py-3">
                      <p className="text-slate-300">{s.origin_city}</p>
                      <p className="text-slate-500">→ {s.destination_city}</p>
                    </td>
                    <td className="px-4 py-3">
                      {s.driver_name
                        ? <p className="text-slate-300">{s.driver_name}</p>
                        : <p className="text-slate-600 italic">Unassigned</p>}
                      {s.vehicle_plate && <p className="text-slate-500 mt-0.5">{s.vehicle_plate}</p>}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-medium border ${SHIPMENT_STATUS[s.status] || 'bg-slate-500/15 text-slate-400 border-slate-500/20'}`}>
                        {s.status.replace(/_/g, ' ')}
                      </span>
                    </td>
                    {canDispatch && (
                      <td className="px-4 py-3">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-medium ${APPROVAL_STATUS[s.approval_status] || 'bg-slate-500/15 text-slate-400'}`}>
                          {s.approval_status?.replace(/_/g, ' ') || 'draft'}
                        </span>
                        {s.rejection_reason && (
                          <p className="text-red-400 text-[10px] mt-0.5 max-w-[140px] truncate" title={s.rejection_reason}>
                            {s.rejection_reason}
                          </p>
                        )}
                      </td>
                    )}
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        {/* View detail */}
                        <Link to={`/shipments/${s.id}`}
                          className="p-1.5 text-slate-500 hover:text-white hover:bg-white/10 rounded-lg transition-colors" title="View detail">
                          <EyeIcon className="w-3.5 h-3.5" />
                        </Link>

                        {/* Assign driver/vehicle — admin and dispatcher */}
                        {canDispatch && (
                          <button onClick={() => openAssign(s)}
                            className="p-1.5 text-slate-500 hover:text-blue-300 hover:bg-blue-500/10 rounded-lg transition-colors" title="Assign driver / vehicle">
                            <AssignIcon className="w-3.5 h-3.5" />
                          </button>
                        )}

                        {/* Submit for approval — dispatcher on draft/rejected shipments */}
                        {canDispatch && !canApprove &&
                         (s.approval_status === 'draft' || s.approval_status === 'rejected') && (
                          <button onClick={() => handleSubmitApproval(s)}
                            className="p-1.5 text-amber-500 hover:text-amber-300 hover:bg-amber-500/10 rounded-lg transition-colors" title="Submit for approval">
                            <SendIcon className="w-3.5 h-3.5" />
                          </button>
                        )}

                        {/* Approve — admin on pending_approval */}
                        {canApprove && s.approval_status === 'pending_approval' && (
                          <>
                            <button onClick={() => handleApprove(s)}
                              className="p-1.5 text-emerald-500 hover:text-emerald-300 hover:bg-emerald-500/10 rounded-lg transition-colors" title="Approve">
                              <CheckIcon className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={() => openReject(s)}
                              className="p-1.5 text-red-500 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-colors" title="Reject">
                              <XIcon className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── CREATE SHIPMENT DIALOG ─────────────────────────── */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-[#1a1d27] border-white/10 text-white">
          <DialogHeader>
            <DialogTitle className="text-white">New Shipment</DialogTitle>
            <DialogDescription className="text-slate-500 text-xs">Fill in the shipment details below.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4 pt-2">

            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Field label="Customer" required>
                  <Select value={form.customerId} onValueChange={fs('customerId')}>
                    <SelectTrigger className="bg-[#0f1117] border-white/10 text-xs text-white h-9">
                      <SelectValue placeholder="Select customer" />
                    </SelectTrigger>
                    <SelectContent className="bg-[#1a1d27] border-white/10 text-xs text-white">
                      {customers.length === 0
                        ? <SelectItem value="_none" disabled>No customers found</SelectItem>
                        : customers.map(c => <SelectItem key={c.id} value={c.id.toString()}>{c.company_name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </Field>
              </div>
              <Field label="Order Date" required>
                <DarkInput type="date" value={form.orderDate} onChange={f('orderDate')} required />
              </Field>
              <Field label="Cargo Type" required>
                <DarkInput value={form.cargoType} onChange={f('cargoType')} placeholder="e.g. General Goods" required />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Origin City" required>
                <DarkInput value={form.originCity} onChange={f('originCity')} placeholder="Riyadh" required />
              </Field>
              <Field label="Origin Address">
                <DarkInput value={form.originAddress} onChange={f('originAddress')} placeholder="Street address" />
              </Field>
              <Field label="Destination City" required>
                <DarkInput value={form.destinationCity} onChange={f('destinationCity')} placeholder="Dammam" required />
              </Field>
              <Field label="Destination Address">
                <DarkInput value={form.destinationAddress} onChange={f('destinationAddress')} placeholder="Street address" />
              </Field>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <Field label="Weight (kg)">
                <DarkInput type="number" value={form.weightKg} onChange={f('weightKg')} placeholder="0.00" min="0" step="0.01" />
              </Field>
              <Field label="Transport Mode">
                <DarkSelect value={form.transportMode} onChange={fs('transportMode')}>
                  <SelectItem value="road">Road</SelectItem>
                  <SelectItem value="sea">Sea</SelectItem>
                  <SelectItem value="air">Air</SelectItem>
                  <SelectItem value="multimodal">Multimodal</SelectItem>
                </DarkSelect>
              </Field>
              <Field label="Service Type">
                <DarkSelect value={form.serviceType} onChange={fs('serviceType')}>
                  <SelectItem value="standard">Standard</SelectItem>
                  <SelectItem value="express">Express</SelectItem>
                  <SelectItem value="economy">Economy</SelectItem>
                </DarkSelect>
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Pickup Date">
                <DarkInput type="date" value={form.requestedPickupDate} onChange={f('requestedPickupDate')} />
              </Field>
              <Field label="Delivery Date">
                <DarkInput type="date" value={form.requestedDeliveryDate} onChange={f('requestedDeliveryDate')} />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2 border-t border-white/5">
              <Field label="Assign Vehicle">
                <DarkSelect value={form.vehicleId} onChange={fs('vehicleId')}>
                  <SelectItem value="none">None — assign later</SelectItem>
                  {vehicles.map(v => <SelectItem key={v.id} value={v.id.toString()}>{v.plate_number} ({v.vehicle_type})</SelectItem>)}
                </DarkSelect>
              </Field>
              <Field label="Assign Driver">
                <DarkSelect value={form.driverId} onChange={fs('driverId')}>
                  <SelectItem value="none">None — assign later</SelectItem>
                  {drivers.map(d => <SelectItem key={d.id} value={d.id.toString()}>{d.first_name} {d.last_name}</SelectItem>)}
                </DarkSelect>
              </Field>
            </div>

            <Field label="Quoted Amount (SAR)">
              <DarkInput type="number" value={form.quotedAmount} onChange={f('quotedAmount')} placeholder="0.00" min="0" step="0.01" />
            </Field>

            <div className="flex gap-3 pt-2">
              <button type="button" onClick={() => setIsAddOpen(false)}
                className="flex-1 py-2.5 text-xs text-slate-400 bg-white/5 hover:bg-white/10 rounded-lg transition-colors">
                Cancel
              </button>
              <button type="submit"
                className="flex-1 py-2.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors">
                Create Shipment
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── ASSIGN DIALOG ────────────────────────────────── */}
      <Dialog open={isAssignOpen} onOpenChange={setIsAssignOpen}>
        <DialogContent className="max-w-sm bg-[#1a1d27] border-white/10 text-white">
          <DialogHeader>
            <DialogTitle className="text-white">Assign Driver & Vehicle</DialogTitle>
            <DialogDescription className="text-slate-500 text-xs">
              Updating assignment for <span className="font-mono text-slate-300">{selected?.shipment_number}</span>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <Field label="Vehicle">
              <DarkSelect value={assignForm.vehicleId} onChange={v => setAssignForm(p => ({ ...p, vehicleId: v }))}>
                <SelectItem value="none">None</SelectItem>
                {vehicles.map(v => <SelectItem key={v.id} value={v.id.toString()}>{v.plate_number} ({v.vehicle_type})</SelectItem>)}
              </DarkSelect>
            </Field>
            <Field label="Driver">
              <DarkSelect value={assignForm.driverId} onChange={v => setAssignForm(p => ({ ...p, driverId: v }))}>
                <SelectItem value="none">None</SelectItem>
                {drivers.map(d => <SelectItem key={d.id} value={d.id.toString()}>{d.first_name} {d.last_name}</SelectItem>)}
              </DarkSelect>
            </Field>
            <div className="flex gap-3 pt-2">
              <button type="button" onClick={() => setIsAssignOpen(false)}
                className="flex-1 py-2.5 text-xs text-slate-400 bg-white/5 hover:bg-white/10 rounded-lg transition-colors">
                Cancel
              </button>
              <button type="button" onClick={handleAssign}
                className="flex-1 py-2.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors">
                Save Assignment
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── REJECT DIALOG ─────────────────────────────────── */}
      <AlertDialog open={isRejectOpen} onOpenChange={setIsRejectOpen}>
        <AlertDialogContent className="bg-[#1a1d27] border-white/10 text-white">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">Reject Shipment</AlertDialogTitle>
            <AlertDialogDescription className="text-slate-400 text-xs">
              Rejecting <span className="text-white font-mono">{selected?.shipment_number}</span>.
              The dispatcher will be notified with your reason.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-2">
            <Label className="text-xs text-slate-400">Reason for rejection <span className="text-red-400">*</span></Label>
            <textarea
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
              placeholder="Explain why this shipment is being rejected..."
              rows={3}
              className="mt-1.5 w-full px-3 py-2 text-xs bg-[#0f1117] border border-white/10 rounded-lg text-white placeholder-slate-600 focus:outline-none focus:border-red-500/40 resize-none"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-white/5 border-white/10 text-slate-300 hover:bg-white/10 text-xs">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleReject}
              className="bg-red-600 hover:bg-red-700 text-white text-xs">
              Reject Shipment
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
}
