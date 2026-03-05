import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { driversApi, vehiclesApi } from '@/lib/api';
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

// Based on 'drivers' table and related 'employees' table
interface Driver {
  id: number;
  employee_code: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  license_number: string;
  license_type: string;
  license_expiry: string;
  medical_certificate_expiry?: string;
  years_of_experience: number;
  rating: number;
  total_trips: number;
  driver_status: string;
  assigned_vehicle_plate?: string;
  assigned_vehicle_id?: number;
  nationality?: string;
  hire_date?: string;
}

function getStatusColor(s: string) {
  const m: Record<string, string> = {
    available: 'bg-green-100 text-green-800',
    on_trip: 'bg-blue-100 text-blue-800',
    on_leave: 'bg-yellow-100 text-yellow-800',
    suspended: 'bg-red-100 text-red-800',
    off_duty: 'bg-gray-100 text-gray-800',
  };
  return m[s] || 'bg-gray-100 text-gray-800';
}

function daysUntil(dateStr?: string): number | null {
  if (!dateStr) return null;
  const diff = new Date(dateStr).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function expiryBucket(dateStr?: string): string {
  const days = daysUntil(dateStr);
  if (days === null) return 'none';
  if (days < 0) return 'expired';
  if (days <= 30) return '15_30';
  if (days <= 60) return '1_2_months';
  return 'ok';
}

function ExpiryCell({ dateStr }: { dateStr?: string }) {
  if (!dateStr) return <span className="text-slate-400 text-sm">—</span>;
  const days = daysUntil(dateStr);
  const formatted = new Date(dateStr).toLocaleDateString();
  if (days === null) return <span className="text-slate-400 text-sm">—</span>;
  if (days < 0) return (
    <div>
      <p className="text-sm font-semibold text-red-600">{formatted}</p>
      <p className="text-xs text-red-500">Expired</p>
    </div>
  );
  if (days <= 30) return (
    <div>
      <p className="text-sm font-semibold text-amber-600">{formatted}</p>
      <p className="text-xs text-amber-500">{days}d left</p>
    </div>
  );
  if (days <= 60) return (
    <div>
      <p className="text-sm font-semibold text-yellow-600">{formatted}</p>
      <p className="text-xs text-yellow-500">{days}d left</p>
    </div>
  );
  return <span className="text-sm text-slate-600">{formatted}</span>;
}

const UserIcon = (p: React.SVGProps<SVGSVGElement>) => <svg {...p} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>;
const PlusIcon = (p: React.SVGProps<SVGSVGElement>) => <svg {...p} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>;
const SearchIcon = (p: React.SVGProps<SVGSVGElement>) => <svg {...p} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>;
const EditIcon = (p: React.SVGProps<SVGSVGElement>) => <svg {...p} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>;
const TrashIcon = (p: React.SVGProps<SVGSVGElement>) => <svg {...p} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>;
const EyeIcon = (p: React.SVGProps<SVGSVGElement>) => <svg {...p} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>;
const ChevronDownIcon = (p: React.SVGProps<SVGSVGElement>) => <svg {...p} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>;
const ChevronUpIcon = (p: React.SVGProps<SVGSVGElement>) => <svg {...p} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" /></svg>;

const emptyForm = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  nationality: '',
  licenseNumber: '',
  licenseType: '',
  licenseExpiry: '',
  medicalCertificateExpiry: '',
  yearsOfExperience: '',
  rating: '0',
  hireDate: new Date().toISOString().split('T')[0],
  assignedVehicleId: '',
  status: 'available',
};

function extractArray(response: unknown): unknown[] {
  if (Array.isArray(response)) return response;
  if (response && typeof response === 'object' && 'data' in response) {
    const data = (response as Record<string, unknown>).data;
    return Array.isArray(data) ? data : [];
  }
  return [];
}

export default function Drivers() {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showMoreFilters, setShowMoreFilters] = useState(false);

  // Row 1 filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All Status');
  const [vehicleFilter, setVehicleFilter] = useState('All Assignments');
  const [licenseExpiryFilter, setLicenseExpiryFilter] = useState('All');
  const [medicalExpiryFilter, setMedicalExpiryFilter] = useState('All');

  // Row 2 filters (More Filters)
  const [ratingFilter, setRatingFilter] = useState('All Ratings');
  const [experienceSort, setExperienceSort] = useState('None');
  const [tripsSort, setTripsSort] = useState('None');

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [selected, setSelected] = useState<Driver | null>(null);
  const [form, setForm] = useState({ ...emptyForm });

  const moreFiltersActive = ratingFilter !== 'All Ratings' || experienceSort !== 'None' || tripsSort !== 'None';

  useEffect(() => {
    loadDrivers();
    loadVehicles();
  }, [searchQuery, statusFilter, ratingFilter, vehicleFilter, experienceSort, tripsSort]);

  const loadDrivers = async () => {
    try {
      const params: Record<string, string> = {};
      if (searchQuery) params.search = searchQuery;
      if (statusFilter && statusFilter !== 'All Status') params.status = statusFilter;
      if (ratingFilter && ratingFilter !== 'All Ratings') params.rating = ratingFilter;
      if (vehicleFilter && vehicleFilter !== 'All Assignments') params.vehicleAssignment = vehicleFilter;
      if (experienceSort && experienceSort !== 'None') params.sortExperience = experienceSort;
      if (tripsSort && tripsSort !== 'None') params.sortTrips = tripsSort;

      const res = await driversApi.getAll(params);
      const data = extractArray(res);
      setDrivers(data as Driver[]);
    } catch { toast.error('Failed to load drivers'); }
    finally { setIsLoading(false); }
  };

  const loadVehicles = async () => {
    try {
      const res = await vehiclesApi.getAll();
      setVehicles(extractArray(res));
    } catch { console.error('Failed to load vehicles'); }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = { ...form, assigned_vehicle_id: form.assignedVehicleId ? parseInt(form.assignedVehicleId) : null };
      await driversApi.create(payload);
      toast.success('Driver created successfully');
      setIsAddOpen(false); setForm({ ...emptyForm }); loadDrivers();
    } catch (err: any) { toast.error(err.message || 'Failed to create driver'); }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected) return;
    try {
      const payload = { ...form, assigned_vehicle_id: form.assignedVehicleId ? parseInt(form.assignedVehicleId) : null };
      await driversApi.update(selected.id, payload);
      toast.success('Driver updated successfully');
      setIsEditOpen(false); setForm({ ...emptyForm }); loadDrivers();
    } catch (err: any) { toast.error(err.message || 'Failed to update driver'); }
  };

  const handleDelete = async () => {
    if (!selected) return;
    try { await driversApi.delete(selected.id); toast.success('Driver deleted'); setIsDeleteOpen(false); setSelected(null); loadDrivers(); }
    catch (err: any) { toast.error(err.message || 'Failed to delete driver'); }
  };

  const openEdit = (d: Driver) => {
    setSelected(d);
    setForm({
      firstName: d.first_name || '',
      lastName: d.last_name || '',
      email: d.email || '',
      phone: d.phone || '',
      nationality: d.nationality || '',
      licenseNumber: d.license_number || '',
      licenseType: d.license_type || '',
      licenseExpiry: d.license_expiry || '',
      medicalCertificateExpiry: d.medical_certificate_expiry || '',
      yearsOfExperience: d.years_of_experience?.toString() || '',
      rating: d.rating?.toString() || '0',
      hireDate: d.hire_date || new Date().toISOString().split('T')[0],
      assignedVehicleId: d.assigned_vehicle_id?.toString() || '',
      status: d.driver_status || 'available',
    });
    setIsEditOpen(true);
  };

  const visibleDrivers = drivers.filter((d) => {
    if (licenseExpiryFilter !== 'All' && expiryBucket(d.license_expiry) !== licenseExpiryFilter) return false;
    if (medicalExpiryFilter !== 'All' && expiryBucket(d.medical_certificate_expiry) !== medicalExpiryFilter) return false;
    return true;
  });

  const f = (k: keyof typeof emptyForm) => (e: React.ChangeEvent<HTMLInputElement>) => setForm(prev => ({ ...prev, [k]: e.target.value }));
  const fs = (k: keyof typeof emptyForm) => (v: string) => setForm(prev => ({ ...prev, [k]: v }));

  const DriverForm = ({ isEdit }: { isEdit: boolean }) => (
    <form onSubmit={isEdit ? handleUpdate : handleCreate} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2"><Label>First Name *</Label><Input value={form.firstName} onChange={f('firstName')} required /></div>
        <div className="space-y-2"><Label>Last Name *</Label><Input value={form.lastName} onChange={f('lastName')} required /></div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2"><Label>Email</Label><Input type="email" value={form.email} onChange={f('email')} /></div>
        <div className="space-y-2"><Label>Phone</Label><Input value={form.phone} onChange={f('phone')} /></div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2"><Label>Nationality</Label><Input value={form.nationality} onChange={f('nationality')} /></div>
        <div className="space-y-2"><Label>Hire Date *</Label><Input type="date" value={form.hireDate} onChange={f('hireDate')} required /></div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2"><Label>License Number *</Label><Input value={form.licenseNumber} onChange={f('licenseNumber')} required /></div>
        <div className="space-y-2"><Label>License Type *</Label>
          <Select value={form.licenseType} onValueChange={fs('licenseType')}>
            <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="light">Light</SelectItem>
              <SelectItem value="heavy">Heavy</SelectItem>
              <SelectItem value="trailer">Trailer</SelectItem>
              <SelectItem value="motorcycle">Motorcycle</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2"><Label>License Expiry *</Label><Input type="date" value={form.licenseExpiry} onChange={f('licenseExpiry')} required /></div>
        <div className="space-y-2"><Label>Medical Certificate Expiry</Label><Input type="date" value={form.medicalCertificateExpiry} onChange={f('medicalCertificateExpiry')} /></div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2"><Label>Years of Experience</Label><Input type="number" value={form.yearsOfExperience} onChange={f('yearsOfExperience')} /></div>
        <div className="space-y-2"><Label>Rating (0-5)</Label><Input type="number" step="0.1" min="0" max="5" value={form.rating} onChange={f('rating')} /></div>
      </div>
      <div className="space-y-2">
        <Label className={form.status !== 'available' ? 'text-slate-400' : ''}>Assigned Vehicle</Label>
        <Select
          disabled={form.status !== 'available'}
          value={form.assignedVehicleId || 'unassigned'}
          onValueChange={(v) => fs('assignedVehicleId')(v === 'unassigned' ? '' : v)}
        >
          <SelectTrigger><SelectValue placeholder="Select vehicle" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="unassigned">Unassigned</SelectItem>
            {vehicles.filter(v => v.status === 'active').map((v: any) => (
              <SelectItem key={v.id} value={v.id.toString()}>{v.plate_number}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {isEdit && (
        <div className="space-y-2"><Label>Status</Label>
          <Select value={form.status} onValueChange={(v) => { fs('status')(v); if (v !== 'available') fs('assignedVehicleId')(''); }}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="available">Available</SelectItem>
              <SelectItem value="on_trip">On Trip</SelectItem>
              <SelectItem value="on_leave">On Leave</SelectItem>
              <SelectItem value="suspended">Suspended</SelectItem>
              <SelectItem value="off_duty">Off Duty</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}
      <Button type="submit" className="w-full">{isEdit ? 'Update Driver' : 'Create Driver'}</Button>
    </form>
  );

  if (isLoading) return <div className="flex items-center justify-center h-96"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div></div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div><h1 className="text-2xl font-bold text-slate-900">Driver Management</h1><p className="text-slate-500">Manage your drivers and licenses</p></div>
        <Button className="gap-2" onClick={() => { setForm({ ...emptyForm }); setIsAddOpen(true); }}><PlusIcon className="w-4 h-4" /> Add Driver</Button>
      </div>

      {/* Row 1: flex layout — Search (flex-[2]) | 4 filters (flex-[1] each) | More Filters button (fixed w-36) */}
      <div className="flex items-center gap-3">

        {/* Search — widest */}
        <div className="relative flex-[2] min-w-0">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input placeholder="Search drivers..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10 w-full" />
        </div>

        {/* Status */}
        <div className="flex-1 min-w-0">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger><SelectValue placeholder="All Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="All Status">All Status</SelectItem>
              <SelectItem value="available">Available</SelectItem>
              <SelectItem value="on_trip">On Trip</SelectItem>
              <SelectItem value="on_leave">On Leave</SelectItem>
              <SelectItem value="suspended">Suspended</SelectItem>
              <SelectItem value="off_duty">Off Duty</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Assignments */}
        <div className="flex-1 min-w-0">
          <Select value={vehicleFilter} onValueChange={setVehicleFilter}>
            <SelectTrigger><SelectValue placeholder="All Assignments" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="All Assignments">All Assignments</SelectItem>
              <SelectItem value="assigned">Assigned</SelectItem>
              <SelectItem value="unassigned">Unassigned</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* License Expiry */}
        <div className="flex-1 min-w-0">
          <Select value={licenseExpiryFilter} onValueChange={setLicenseExpiryFilter}>
            <SelectTrigger><SelectValue placeholder="License Expiry" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="All">All License Expiry</SelectItem>
              <SelectItem value="expired">Expired</SelectItem>
              <SelectItem value="15_30">15 – 30 Days Left</SelectItem>
              <SelectItem value="1_2_months">1 – 2 Months Left</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Medical Expiry */}
        <div className="flex-1 min-w-0">
          <Select value={medicalExpiryFilter} onValueChange={setMedicalExpiryFilter}>
            <SelectTrigger><SelectValue placeholder="Medical Expiry" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="All">All Medical Expiry</SelectItem>
              <SelectItem value="expired">Expired</SelectItem>
              <SelectItem value="15_30">15 – 30 Days Left</SelectItem>
              <SelectItem value="1_2_months">1 – 2 Months Left</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* More Filters button — fixed width, never stretches */}
        <Button
          variant="outline"
          className={`w-36 shrink-0 gap-2 ${moreFiltersActive ? 'border-primary text-primary' : ''}`}
          onClick={() => setShowMoreFilters(prev => !prev)}
        >
          {showMoreFilters ? <ChevronUpIcon className="w-4 h-4" /> : <ChevronDownIcon className="w-4 h-4" />}
          More Filters
          {moreFiltersActive && <span className="w-2 h-2 rounded-full bg-primary inline-block" />}
        </Button>
      </div>

      {/* Row 2: More Filters — 6-column grid, col 1 empty, cols 2-4 hold filters, cols 5-6 empty */}
      {showMoreFilters && (
        <div className="grid grid-cols-6 gap-3 px-3 py-3 border border-slate-200 rounded-lg bg-slate-50">
          {/* Col 1: empty spacer */}
          <div />

          <Select value={ratingFilter} onValueChange={setRatingFilter}>
            <SelectTrigger><SelectValue placeholder="All Ratings" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="All Ratings">All Ratings</SelectItem>
              <SelectItem value="elite">Elite (4.5 – 5.0)</SelectItem>
              <SelectItem value="good">Good (3.5 – 4.4)</SelectItem>
              <SelectItem value="average">Average (2.5 – 3.4)</SelectItem>
              <SelectItem value="poor">Poor (1.0 – 2.4)</SelectItem>
            </SelectContent>
          </Select>

          <Select value={experienceSort} onValueChange={setExperienceSort}>
            <SelectTrigger><SelectValue placeholder="Experience" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="None">Experience</SelectItem>
              <SelectItem value="desc">Highest First</SelectItem>
              <SelectItem value="asc">Lowest First</SelectItem>
            </SelectContent>
          </Select>

          <Select value={tripsSort} onValueChange={setTripsSort}>
            <SelectTrigger><SelectValue placeholder="Trips" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="None">Trips</SelectItem>
              <SelectItem value="desc">Most Trips First</SelectItem>
              <SelectItem value="asc">Least Trips First</SelectItem>
            </SelectContent>
          </Select>

          {/* Cols 5-6: empty */}
          <div />
          <div />
        </div>
      )}

      <Card><CardContent className="p-0"><div className="overflow-x-auto"><Table>
        <TableHeader>
          <TableRow>
            <TableHead>Driver</TableHead>
            <TableHead>Code</TableHead>
            <TableHead>License</TableHead>
            <TableHead>License Expiry</TableHead>
            <TableHead>Medical Expiry</TableHead>
            <TableHead>Experience</TableHead>
            <TableHead>Trips</TableHead>
            <TableHead>Rating</TableHead>
            <TableHead>Assigned Vehicle</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {visibleDrivers.map((d) => (
            <TableRow key={d.id}>
              <TableCell><div className="flex items-center gap-3"><div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center"><UserIcon className="w-5 h-5 text-slate-400" /></div><div><p className="font-medium text-slate-900">{d.first_name} {d.last_name}</p><p className="text-sm text-slate-500">{d.email}</p></div></div></TableCell>
              <TableCell><span className="font-mono text-sm">{d.employee_code}</span></TableCell>
              <TableCell><div><p className="font-medium">{d.license_number}</p><p className="text-sm text-slate-500 capitalize">{d.license_type}</p></div></TableCell>
              <TableCell><ExpiryCell dateStr={d.license_expiry} /></TableCell>
              <TableCell><ExpiryCell dateStr={d.medical_certificate_expiry} /></TableCell>
              <TableCell>{d.years_of_experience} yrs</TableCell>
              <TableCell><span className="text-sm text-slate-600">{d.total_trips ?? 0}</span></TableCell>
              <TableCell><span className="font-medium text-amber-600">{d.rating?.toFixed(1) || '—'} ⭐</span></TableCell>
              <TableCell><span className="text-sm">{d.assigned_vehicle_plate || 'Unassigned'}</span></TableCell>
              <TableCell><Badge className={getStatusColor(d.driver_status)}>{d.driver_status?.replace(/_/g, ' ') || '—'}</Badge></TableCell>
              <TableCell className="text-right"><div className="flex items-center justify-end gap-2">
                <Link to={`/drivers/${d.id}`}><Button variant="ghost" size="icon"><EyeIcon className="w-4 h-4" /></Button></Link>
                <Button variant="ghost" size="icon" onClick={() => openEdit(d)}><EditIcon className="w-4 h-4" /></Button>
                <Button variant="ghost" size="icon" onClick={() => { setSelected(d); setIsDeleteOpen(true); }} className="text-red-600 hover:text-red-700"><TrashIcon className="w-4 h-4" /></Button>
              </div></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table></div></CardContent></Card>

      {visibleDrivers.length === 0 && <div className="text-center py-12"><UserIcon className="w-16 h-16 mx-auto text-slate-300 mb-4" /><h3 className="text-lg font-medium text-slate-900">No drivers found</h3><p className="text-slate-500">Add your first driver to get started</p></div>}

      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}><DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto"><DialogHeader><DialogTitle>Add New Driver</DialogTitle><DialogDescription>Fill in the details to create a new driver.</DialogDescription></DialogHeader><DriverForm isEdit={false} /></DialogContent></Dialog>
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}><DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto"><DialogHeader><DialogTitle>Edit Driver</DialogTitle><DialogDescription>Update driver information.</DialogDescription></DialogHeader><DriverForm isEdit={true} /></DialogContent></Dialog>
      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Are you sure?</AlertDialogTitle><AlertDialogDescription>This will permanently delete driver {selected && `"${selected.first_name} ${selected.last_name}"`} and their employee record.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">Delete</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
    </div>
  );
}
