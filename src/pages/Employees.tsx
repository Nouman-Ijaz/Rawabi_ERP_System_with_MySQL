import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { employeesApi } from '@/lib/api';
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

interface Employee {
  id: number;
  employee_code: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  department: string;
  position: string;
  hire_date: string;
  status: string;
  salary?: number;
  nationality?: string;
}

function getStatusColor(s: string) {
  const m: Record<string,string> = { active:'bg-green-100 text-green-800', on_leave:'bg-yellow-100 text-yellow-800', terminated:'bg-red-100 text-red-800', suspended:'bg-orange-100 text-orange-800' };
  return m[s] || 'bg-gray-100 text-gray-800';
}
function getDeptColor(d: string) {
  const m: Record<string,string> = { Operations:'bg-blue-100 text-blue-800', Finance:'bg-green-100 text-green-800', HR:'bg-purple-100 text-purple-800', Maintenance:'bg-orange-100 text-orange-800', Sales:'bg-pink-100 text-pink-800', Dispatch:'bg-cyan-100 text-cyan-800', Warehouse:'bg-amber-100 text-amber-800' };
  return m[d] || 'bg-gray-100 text-gray-800';
}

const UserIcon = (p: React.SVGProps<SVGSVGElement>) => <svg {...p} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>;
const PlusIcon = (p: React.SVGProps<SVGSVGElement>) => <svg {...p} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/></svg>;
const SearchIcon = (p: React.SVGProps<SVGSVGElement>) => <svg {...p} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>;
const EditIcon = (p: React.SVGProps<SVGSVGElement>) => <svg {...p} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>;
const TrashIcon = (p: React.SVGProps<SVGSVGElement>) => <svg {...p} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>;
const EyeIcon = (p: React.SVGProps<SVGSVGElement>) => <svg {...p} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>;

const emptyForm = { firstName:'', lastName:'', email:'', phone:'', department:'', position:'', hireDate:'', salary:'', nationality:'', address:'', emergencyContactName:'', emergencyContactPhone:'', status:'active' };

// Helper to safely extract array from backend response
function extractArray(response: unknown): unknown[] {
  if (Array.isArray(response)) return response;
  if (response && typeof response === 'object' && 'data' in response) {
    const data = (response as Record<string, unknown>).data;
    return Array.isArray(data) ? data : [];
  }
  return [];
}

export default function Employees() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [deptFilter, setDeptFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [selected, setSelected] = useState<Employee | null>(null);
  const [form, setForm] = useState({ ...emptyForm });

  useEffect(() => { loadEmployees(); }, [searchQuery, deptFilter, statusFilter]);

  const loadEmployees = async () => {
    try {
      const params: Record<string,string> = {};
      if (searchQuery) params.search = searchQuery;
      if (deptFilter) params.department = deptFilter;
      if (statusFilter) params.status = statusFilter;
      const res = await employeesApi.getAll(params);
      const data = extractArray(res);
      setEmployees(data as Employee[]);
    } catch { toast.error('Failed to load employees'); }
    finally { setIsLoading(false); }
  };

  const buildPayload = () => {
    const fd = new FormData();
    fd.append('firstName', form.firstName);
    fd.append('lastName', form.lastName);
    fd.append('email', form.email);
    fd.append('phone', form.phone);
    fd.append('department', form.department);
    fd.append('position', form.position);
    fd.append('hireDate', form.hireDate);
    fd.append('salary', form.salary);
    fd.append('nationality', form.nationality);
    fd.append('address', form.address);
    fd.append('emergencyContactName', form.emergencyContactName);
    fd.append('emergencyContactPhone', form.emergencyContactPhone);
    fd.append('status', form.status);
    return fd;
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try { await employeesApi.create(buildPayload()); toast.success('Employee created'); setIsAddOpen(false); setForm({...emptyForm}); loadEmployees(); }
    catch (err: unknown) { toast.error(err instanceof Error ? err.message : 'Failed to create employee'); }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected) return;
    try { await employeesApi.update(selected.id, buildPayload()); toast.success('Employee updated'); setIsEditOpen(false); setForm({...emptyForm}); loadEmployees(); }
    catch (err: unknown) { toast.error(err instanceof Error ? err.message : 'Failed to update employee'); }
  };

  const handleDelete = async () => {
    if (!selected) return;
    try { await employeesApi.delete(selected.id); toast.success('Employee deleted'); setIsDeleteOpen(false); setSelected(null); loadEmployees(); }
    catch (err: unknown) { toast.error(err instanceof Error ? err.message : 'Failed to delete employee'); }
  };

  const openEdit = (emp: Employee) => {
    setSelected(emp);
    setForm({ firstName:emp.first_name||'', lastName:emp.last_name||'', email:emp.email||'', phone:emp.phone||'', department:emp.department||'', position:emp.position||'', hireDate:emp.hire_date||'', salary:emp.salary?.toString()||'', nationality:emp.nationality||'', address:'', emergencyContactName:'', emergencyContactPhone:'', status:emp.status||'active' });
    setIsEditOpen(true);
  };

  const f = (k: keyof typeof emptyForm) => (e: React.ChangeEvent<HTMLInputElement>) => setForm(prev => ({...prev, [k]: e.target.value}));
  const fs = (k: keyof typeof emptyForm) => (v: string) => setForm(prev => ({...prev, [k]: v}));

  const EmployeeForm = ({ isEdit }: { isEdit: boolean }) => (
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
        <div className="space-y-2"><Label>Department *</Label>
          <Select value={form.department} onValueChange={fs('department')}>
            <SelectTrigger><SelectValue placeholder="Select department" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="Operations">Operations</SelectItem>
              <SelectItem value="Finance">Finance</SelectItem>
              <SelectItem value="HR">HR</SelectItem>
              <SelectItem value="Maintenance">Maintenance</SelectItem>
              <SelectItem value="Sales">Sales</SelectItem>
              <SelectItem value="Dispatch">Dispatch</SelectItem>
              <SelectItem value="Warehouse">Warehouse</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2"><Label>Position *</Label><Input value={form.position} onChange={f('position')} required /></div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2"><Label>Hire Date *</Label><Input type="date" value={form.hireDate} onChange={f('hireDate')} required /></div>
        <div className="space-y-2"><Label>Salary</Label><Input type="number" value={form.salary} onChange={f('salary')} placeholder="Monthly salary" /></div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2"><Label>Nationality</Label><Input value={form.nationality} onChange={f('nationality')} /></div>
        <div className="space-y-2"><Label>Status</Label>
          <Select value={form.status} onValueChange={fs('status')}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="on_leave">On Leave</SelectItem>
              <SelectItem value="suspended">Suspended</SelectItem>
              <SelectItem value="terminated">Terminated</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-2"><Label>Address</Label><Input value={form.address} onChange={f('address')} /></div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2"><Label>Emergency Contact Name</Label><Input value={form.emergencyContactName} onChange={f('emergencyContactName')} /></div>
        <div className="space-y-2"><Label>Emergency Contact Phone</Label><Input value={form.emergencyContactPhone} onChange={f('emergencyContactPhone')} /></div>
      </div>
      <Button type="submit" className="w-full">{isEdit ? 'Update Employee' : 'Create Employee'}</Button>
    </form>
  );

  if (isLoading) return <div className="flex items-center justify-center h-96"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div></div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div><h1 className="text-2xl font-bold text-slate-900">Employee Management</h1><p className="text-slate-500">Manage your employees and their information</p></div>
        <Button className="gap-2" onClick={() => { setForm({...emptyForm}); setIsAddOpen(true); }}><PlusIcon className="w-4 h-4" /> Add Employee</Button>
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1"><SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" /><Input placeholder="Search by name, code, or email..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10" /></div>
        <Select value={deptFilter} onValueChange={setDeptFilter}><SelectTrigger className="w-full sm:w-48"><SelectValue placeholder="All Departments" /></SelectTrigger><SelectContent><SelectItem value="All Departments">All Departments</SelectItem><SelectItem value="Operations">Operations</SelectItem><SelectItem value="Finance">Finance</SelectItem><SelectItem value="HR">HR</SelectItem><SelectItem value="Maintenance">Maintenance</SelectItem><SelectItem value="Sales">Sales</SelectItem><SelectItem value="Dispatch">Dispatch</SelectItem><SelectItem value="Warehouse">Warehouse</SelectItem></SelectContent></Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}><SelectTrigger className="w-full sm:w-40"><SelectValue placeholder="All Status" /></SelectTrigger><SelectContent><SelectItem value="All Status">All Status</SelectItem><SelectItem value="active">Active</SelectItem><SelectItem value="on_leave">On Leave</SelectItem><SelectItem value="suspended">Suspended</SelectItem><SelectItem value="terminated">Terminated</SelectItem></SelectContent></Select>
      </div>

      <Card><CardContent className="p-0"><div className="overflow-x-auto"><Table>
        <TableHeader><TableRow><TableHead>Employee</TableHead><TableHead>Code</TableHead><TableHead>Department</TableHead><TableHead>Position</TableHead><TableHead>Hire Date</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
        <TableBody>
          {Array.isArray(employees) && employees.map((emp) => (
            <TableRow key={emp.id}>
              <TableCell><div className="flex items-center gap-3"><div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center"><UserIcon className="w-5 h-5 text-slate-400" /></div><div><p className="font-medium text-slate-900">{emp.first_name} {emp.last_name}</p><p className="text-sm text-slate-500">{emp.email}</p></div></div></TableCell>
              <TableCell><span className="font-mono text-sm">{emp.employee_code}</span></TableCell>
              <TableCell><Badge className={getDeptColor(emp.department)}>{emp.department}</Badge></TableCell>
              <TableCell>{emp.position}</TableCell>
              <TableCell>{emp.hire_date ? new Date(emp.hire_date).toLocaleDateString() : '—'}</TableCell>
              <TableCell><Badge className={getStatusColor(emp.status)}>{emp.status?.replace(/_/g,' ') || '—'}</Badge></TableCell>
              <TableCell className="text-right"><div className="flex items-center justify-end gap-2">
                <Link to={`/employees/${emp.id}`}><Button variant="ghost" size="icon"><EyeIcon className="w-4 h-4" /></Button></Link>
                <Button variant="ghost" size="icon" onClick={() => openEdit(emp)}><EditIcon className="w-4 h-4" /></Button>
                <Button variant="ghost" size="icon" onClick={() => { setSelected(emp); setIsDeleteOpen(true); }} className="text-red-600 hover:text-red-700"><TrashIcon className="w-4 h-4" /></Button>
              </div></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table></div></CardContent></Card>

      {(!Array.isArray(employees) || employees.length === 0) && <div className="text-center py-12"><UserIcon className="w-16 h-16 mx-auto text-slate-300 mb-4" /><h3 className="text-lg font-medium text-slate-900">No employees found</h3><p className="text-slate-500">Add your first employee to get started</p></div>}

      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}><DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto"><DialogHeader><DialogTitle>Add New Employee</DialogTitle><DialogDescription>Fill in the details to create a new employee record.</DialogDescription></DialogHeader><EmployeeForm isEdit={false} /></DialogContent></Dialog>
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}><DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto"><DialogHeader><DialogTitle>Edit Employee</DialogTitle><DialogDescription>Update employee information.</DialogDescription></DialogHeader><EmployeeForm isEdit={true} /></DialogContent></Dialog>
      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Are you sure?</AlertDialogTitle><AlertDialogDescription>This will permanently delete employee {selected && `"${selected.first_name} ${selected.last_name}"`}.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">Delete</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
    </div>
  );
}
