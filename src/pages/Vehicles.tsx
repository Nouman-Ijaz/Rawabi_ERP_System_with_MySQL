import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { vehiclesApi } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { toast } from 'sonner';

interface Vehicle {
  id: number;
  vehicle_code: string;
  plate_number: string;
  vehicle_type: string;
  brand: string;
  model: string;
  year: number;
  capacity_kg: number;
  fuel_type: string;
  status: string;
  total_km: number;
  driver_name?: string;
  trailer_type?: string;
}

function getStatusColor(s: string) {
  const m: Record<string,string> = { active:'bg-green-100 text-green-800', maintenance:'bg-yellow-100 text-yellow-800', retired:'bg-gray-100 text-gray-800', sold:'bg-red-100 text-red-800', accident:'bg-orange-100 text-orange-800' };
  return m[s] || 'bg-gray-100 text-gray-800';
}
function getTypeColor(t: string) {
  const m: Record<string,string> = { truck_3ton:'bg-blue-100 text-blue-800', truck_7ton:'bg-indigo-100 text-indigo-800', trailer:'bg-purple-100 text-purple-800', van:'bg-green-100 text-green-800', pickup:'bg-orange-100 text-orange-800' };
  return m[t] || 'bg-gray-100 text-gray-800';
}
const TruckIcon = (p: React.SVGProps<SVGSVGElement>) => <svg {...p} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0"/></svg>;
const PlusIcon = (p: React.SVGProps<SVGSVGElement>) => <svg {...p} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/></svg>;
const SearchIcon = (p: React.SVGProps<SVGSVGElement>) => <svg {...p} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>;
const EditIcon = (p: React.SVGProps<SVGSVGElement>) => <svg {...p} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>;
const TrashIcon = (p: React.SVGProps<SVGSVGElement>) => <svg {...p} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>;
const EyeIcon = (p: React.SVGProps<SVGSVGElement>) => <svg {...p} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>;

const emptyForm = { plateNumber:'', brand:'', model:'', year:'', vehicleType:'', capacityKg:'', totalKm:'', fuelType:'', trailerType:'', registrationExpiry:'', insuranceExpiry:'', notes:'', status:'active' };

function extractArray(response: unknown): unknown[] {
  if (Array.isArray(response)) return response;
  if (response && typeof response === 'object' && 'data' in response) {
    const data = (response as Record<string, unknown>).data;
    return Array.isArray(data) ? data : [];
  }
  return [];
}

export default function Vehicles() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('All Types');
  const [statusFilter, setStatusFilter] = useState('All Status');
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [selected, setSelected] = useState<Vehicle | null>(null);
  const [form, setForm] = useState({ ...emptyForm });

  useEffect(() => { loadVehicles(); }, [searchQuery, typeFilter, statusFilter]);

  const loadVehicles = async () => {
    try {
      const params: Record<string,string> = {};
      if (searchQuery) params.search = searchQuery;
      if (typeFilter && typeFilter !== 'All Types') params.type = typeFilter;
      if (statusFilter && statusFilter !== 'All Status') params.status = statusFilter;
      
      const res = await vehiclesApi.getAll(params);
      const data = extractArray(res);
      setVehicles(data as Vehicle[]);
    } catch { toast.error('Failed to load vehicles'); }
    finally { setIsLoading(false); }
  };

  const buildPayload = () => ({
    plateNumber: form.plateNumber,
    brand: form.brand,
    model: form.model,
    year: parseInt(form.year) || undefined, // Parsed as number
    vehicleType: form.vehicleType,
    capacityKg: parseFloat(form.capacityKg) || undefined,
    totalKm: parseFloat(form.totalKm) || 0,
    fuelType: form.fuelType,
    trailerType: form.trailerType,
    registrationExpiry: form.registrationExpiry,
    insuranceExpiry: form.insuranceExpiry,
    notes: form.notes,
    status: form.status,
  });

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try { await vehiclesApi.create(buildPayload()); toast.success('Vehicle created'); setIsAddOpen(false); setForm({...emptyForm}); loadVehicles(); }
    catch (err: unknown) { toast.error(err instanceof Error ? err.message : 'Failed to create vehicle'); }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected) return;
    try { await vehiclesApi.update(selected.id, buildPayload()); toast.success('Vehicle updated'); setIsEditOpen(false); setForm({...emptyForm}); loadVehicles(); }
    catch (err: unknown) { toast.error(err instanceof Error ? err.message : 'Failed to update vehicle'); }
  };

  const handleDelete = async () => {
    if (!selected) return;
    try { await vehiclesApi.delete(selected.id); toast.success('Vehicle deleted'); setIsDeleteOpen(false); setSelected(null); loadVehicles(); }
    catch (err: unknown) { toast.error(err instanceof Error ? err.message : 'Failed to delete vehicle'); }
  };

  const openEdit = (v: Vehicle) => {
    setSelected(v);
    setForm({ 
      plateNumber: v.plate_number || '', 
      brand: v.brand || '', 
      model: v.model || '', 
      year: v.year?.toString() || '', // Correctly mapped
      vehicleType: v.vehicle_type || '', 
      capacityKg: v.capacity_kg?.toString() || '', 
      totalKm: v.total_km?.toString() || '0',
      fuelType: v.fuel_type || '', 
      trailerType: v.trailer_type || '', 
      registrationExpiry: '', 
      insuranceExpiry: '', 
      notes: '', 
      status: v.status || 'active' 
    });
    setIsEditOpen(true);
  };

  const f = (k: keyof typeof emptyForm) => (e: React.ChangeEvent<HTMLInputElement>) => setForm(prev => ({...prev, [k]: e.target.value}));
  const fs = (k: keyof typeof emptyForm) => (v: string) => setForm(prev => ({...prev, [k]: v}));

  const VehicleForm = ({ isEdit }: { isEdit: boolean }) => (
    <form onSubmit={isEdit ? handleUpdate : handleCreate} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2"><Label>Plate Number *</Label><Input value={form.plateNumber} onChange={f('plateNumber')} required /></div>
        <div className="space-y-2"><Label>Vehicle Type *</Label>
          <Select value={form.vehicleType} onValueChange={fs('vehicleType')}>
            <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="truck_3ton">Truck 3 Ton</SelectItem>
              <SelectItem value="truck_7ton">Truck 7 Ton</SelectItem>
              <SelectItem value="truck_10ton">Truck 10 Ton</SelectItem>
              <SelectItem value="trailer">Trailer</SelectItem>
              <SelectItem value="van">Van</SelectItem>
              <SelectItem value="pickup">Pickup</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2"><Label>Brand *</Label><Input value={form.brand} onChange={f('brand')} required /></div>
        <div className="space-y-2"><Label>Model *</Label><Input value={form.model} onChange={f('model')} required /></div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2"><Label>Year</Label><Input type="number" value={form.year} onChange={f('year')} placeholder="e.g. 2023" /></div>
        <div className="space-y-2"><Label>Fuel Type</Label>
          <Select value={form.fuelType} onValueChange={fs('fuelType')}>
            <SelectTrigger><SelectValue placeholder="Select fuel" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="diesel">Diesel</SelectItem>
              <SelectItem value="gasoline">Gasoline</SelectItem>
              <SelectItem value="electric">Electric</SelectItem>
              <SelectItem value="hybrid">Hybrid</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2"><Label>Capacity (kg)</Label><Input type="number" value={form.capacityKg} onChange={f('capacityKg')} /></div>
        <div className="space-y-2"><Label>Current Odometer (KM)</Label><Input type="number" value={form.totalKm} onChange={f('totalKm')} placeholder="e.g. 45000" /></div>
      </div>
      
      {form.vehicleType === 'trailer' && (
        <div className="space-y-2"><Label>Trailer Type *</Label>
          <Select value={form.trailerType} onValueChange={fs('trailerType')}>
            <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="flatbed">Flatbed</SelectItem>
              <SelectItem value="reefer">Reefer</SelectItem>
              <SelectItem value="box">Box</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2"><Label>Registration Expiry</Label><Input type="date" value={form.registrationExpiry} onChange={f('registrationExpiry')} /></div>
        <div className="space-y-2"><Label>Insurance Expiry</Label><Input type="date" value={form.insuranceExpiry} onChange={f('insuranceExpiry')} /></div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2"><Label>Status</Label>
          <Select value={form.status} onValueChange={fs('status')}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="maintenance">Maintenance</SelectItem>
              <SelectItem value="retired">Retired</SelectItem>
              <SelectItem value="sold">Sold</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2"><Label>Notes</Label><Input value={form.notes} onChange={f('notes')} /></div>
      </div>
      <Button type="submit" className="w-full">{isEdit ? 'Update Vehicle' : 'Create Vehicle'}</Button>
    </form>
  );

  if (isLoading) return <div className="flex items-center justify-center h-96"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div></div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div><h1 className="text-2xl font-bold text-slate-900">Fleet Management</h1><p className="text-slate-500">Manage your vehicles and fleet</p></div>
        <Button className="gap-2" onClick={() => { setForm({...emptyForm}); setIsAddOpen(true); }}><PlusIcon className="w-4 h-4" /> Add Vehicle</Button>
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1"><SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" /><Input placeholder="Search by plate, brand, or model..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10" /></div>
        <Select value={typeFilter} onValueChange={setTypeFilter}><SelectTrigger className="w-full sm:w-44"><SelectValue placeholder="All Types" /></SelectTrigger><SelectContent><SelectItem value="All Types">All Types</SelectItem><SelectItem value="truck_3ton">Truck 3 Ton</SelectItem><SelectItem value="truck_7ton">Truck 7 Ton</SelectItem><SelectItem value="trailer">Trailer</SelectItem><SelectItem value="van">Van</SelectItem><SelectItem value="pickup">Pickup</SelectItem></SelectContent></Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}><SelectTrigger className="w-full sm:w-40"><SelectValue placeholder="All Status" /></SelectTrigger><SelectContent><SelectItem value="All Status">All Status</SelectItem><SelectItem value="active">Active</SelectItem><SelectItem value="maintenance">Maintenance</SelectItem><SelectItem value="retired">Retired</SelectItem><SelectItem value="sold">Sold</SelectItem></SelectContent></Select>
      </div>

      <Card><CardContent className="p-0"><div className="overflow-x-auto"><Table>
        <TableHeader><TableRow><TableHead>Vehicle</TableHead><TableHead>Plate</TableHead><TableHead>Type</TableHead><TableHead>Capacity</TableHead><TableHead>Total KM</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
        <TableBody>
          {Array.isArray(vehicles) && vehicles.map((v) => (
            <TableRow key={v.id}>
              <TableCell><div className="flex items-center gap-3"><div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center"><TruckIcon className="w-5 h-5 text-slate-400" /></div><div><p className="font-medium text-slate-900">{v.brand} {v.model}</p><p className="text-sm text-slate-500">{v.year || '—'}</p></div></div></TableCell>
              <TableCell><span className="font-mono font-medium">{v.plate_number}</span></TableCell>
              <TableCell><Badge className={getTypeColor(v.vehicle_type)}>{v.vehicle_type?.replace(/_/g,' ') || '—'}</Badge></TableCell>
              <TableCell>{v.capacity_kg ? `${Number(v.capacity_kg).toLocaleString()} kg` : '—'}</TableCell>
              <TableCell>{v.total_km ? `${Number(v.total_km).toLocaleString()} km` : '0 km'}</TableCell>
              <TableCell><Badge className={getStatusColor(v.status)}>{v.status?.replace(/_/g,' ') || '—'}</Badge></TableCell>
              <TableCell className="text-right"><div className="flex items-center justify-end gap-2">
                <Link to={`/vehicles/${v.id}`}><Button variant="ghost" size="icon"><EyeIcon className="w-4 h-4" /></Button></Link>
                <Button variant="ghost" size="icon" onClick={() => openEdit(v)}><EditIcon className="w-4 h-4" /></Button>
                <Button variant="ghost" size="icon" onClick={() => { setSelected(v); setIsDeleteOpen(true); }} className="text-red-600 hover:text-red-700"><TrashIcon className="w-4 h-4" /></Button>
              </div></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table></div></CardContent></Card>

      {(!Array.isArray(vehicles) || vehicles.length === 0) && <div className="text-center py-12"><TruckIcon className="w-16 h-16 mx-auto text-slate-300 mb-4" /><h3 className="text-lg font-medium text-slate-900">No vehicles found</h3><p className="text-slate-500">Add your first vehicle to get started</p></div>}

      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}><DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto"><DialogHeader><DialogTitle>Add New Vehicle</DialogTitle><DialogDescription>Fill in the details to create a new vehicle.</DialogDescription></DialogHeader><VehicleForm isEdit={false} /></DialogContent></Dialog>
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}><DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto"><DialogHeader><DialogTitle>Edit Vehicle</DialogTitle><DialogDescription>Update vehicle information.</DialogDescription></DialogHeader><VehicleForm isEdit={true} /></DialogContent></Dialog>
      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Are you sure?</AlertDialogTitle><AlertDialogDescription>This will permanently delete {selected && `"${selected.brand} ${selected.model} (${selected.plate_number})"`}.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">Delete</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
    </div>
  );
}