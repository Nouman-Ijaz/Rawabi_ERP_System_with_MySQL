import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { customersApi } from '@/lib/api';
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

interface Customer {
  id: number;
  customer_code: string;
  company_name: string;
  contact_person: string;
  email: string;
  phone: string;
  city: string;
  country: string;
  credit_limit: number;
  customer_type: string;
  status: string;
  total_shipments?: number;
  total_revenue?: number;
}

function getStatusColor(s: string) {
  const m: Record<string,string> = { active:'bg-green-100 text-green-800', inactive:'bg-gray-100 text-gray-800', suspended:'bg-red-100 text-red-800' };
  return m[s] || 'bg-gray-100 text-gray-800';
}
function getTypeColor(t: string) {
  const m: Record<string,string> = { regular:'bg-blue-100 text-blue-800', vip:'bg-amber-100 text-amber-800', corporate:'bg-purple-100 text-purple-800', government:'bg-green-100 text-green-800' };
  return m[t] || 'bg-gray-100 text-gray-800';
}

const BuildingIcon = (p: React.SVGProps<SVGSVGElement>) => <svg {...p} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/></svg>;
const PlusIcon = (p: React.SVGProps<SVGSVGElement>) => <svg {...p} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/></svg>;
const SearchIcon = (p: React.SVGProps<SVGSVGElement>) => <svg {...p} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>;
const EditIcon = (p: React.SVGProps<SVGSVGElement>) => <svg {...p} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>;
const TrashIcon = (p: React.SVGProps<SVGSVGElement>) => <svg {...p} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>;
const EyeIcon = (p: React.SVGProps<SVGSVGElement>) => <svg {...p} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>;

const emptyForm = { companyName:'', contactPerson:'', email:'', phone:'', mobile:'', address:'', city:'', country:'Saudi Arabia', taxNumber:'', crNumber:'', creditLimit:'', paymentTerms:'30', customerType:'regular', status:'active', notes:'' };

// Helper to safely extract array from backend response
function extractArray(response: unknown): unknown[] {
  if (Array.isArray(response)) return response;
  if (response && typeof response === 'object' && 'data' in response) {
    const data = (response as Record<string, unknown>).data;
    return Array.isArray(data) ? data : [];
  }
  return [];
}

export default function Customers() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [selected, setSelected] = useState<Customer | null>(null);
  const [form, setForm] = useState({ ...emptyForm });

  useEffect(() => { loadCustomers(); }, [searchQuery, typeFilter, statusFilter]);

  const loadCustomers = async () => {
    try {
      const params: Record<string,string> = {};
      if (searchQuery) params.search = searchQuery;
      if (typeFilter) params.customerType = typeFilter;
      if (statusFilter) params.status = statusFilter;
      const res = await customersApi.getAll(params);
      const data = extractArray(res);
      setCustomers(data as Customer[]);
    } catch { toast.error('Failed to load customers'); }
    finally { setIsLoading(false); }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await customersApi.create({ companyName:form.companyName, contactPerson:form.contactPerson, email:form.email, phone:form.phone, mobile:form.mobile, address:form.address, city:form.city, country:form.country, taxNumber:form.taxNumber, crNumber:form.crNumber, creditLimit:parseFloat(form.creditLimit)||0, paymentTerms:parseInt(form.paymentTerms)||30, customerType:form.customerType, notes:form.notes });
      toast.success('Customer created'); setIsAddOpen(false); setForm({...emptyForm}); loadCustomers();
    } catch (err: unknown) { toast.error(err instanceof Error ? err.message : 'Failed to create customer'); }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected) return;
    try {
      await customersApi.update(selected.id, { companyName:form.companyName, contactPerson:form.contactPerson, email:form.email, phone:form.phone, mobile:form.mobile, address:form.address, city:form.city, country:form.country, taxNumber:form.taxNumber, crNumber:form.crNumber, creditLimit:parseFloat(form.creditLimit)||0, paymentTerms:parseInt(form.paymentTerms)||30, customerType:form.customerType, status:form.status, notes:form.notes });
      toast.success('Customer updated'); setIsEditOpen(false); setForm({...emptyForm}); loadCustomers();
    } catch (err: unknown) { toast.error(err instanceof Error ? err.message : 'Failed to update customer'); }
  };

  const handleDelete = async () => {
    if (!selected) return;
    try { await customersApi.delete(selected.id); toast.success('Customer deleted'); setIsDeleteOpen(false); setSelected(null); loadCustomers(); }
    catch (err: unknown) { toast.error(err instanceof Error ? err.message : 'Failed to delete customer'); }
  };

  const openEdit = (c: Customer) => {
    setSelected(c);
    setForm({ companyName:c.company_name||'', contactPerson:c.contact_person||'', email:c.email||'', phone:c.phone||'', mobile:'', address:'', city:c.city||'', country:c.country||'Saudi Arabia', taxNumber:'', crNumber:'', creditLimit:c.credit_limit?.toString()||'', paymentTerms:'30', customerType:c.customer_type||'regular', status:c.status||'active', notes:'' });
    setIsEditOpen(true);
  };

  const f = (k: keyof typeof emptyForm) => (e: React.ChangeEvent<HTMLInputElement>) => setForm(prev => ({...prev, [k]: e.target.value}));
  const fs = (k: keyof typeof emptyForm) => (v: string) => setForm(prev => ({...prev, [k]: v}));

  const CustomerForm = ({ isEdit }: { isEdit: boolean }) => (
    <form onSubmit={isEdit ? handleUpdate : handleCreate} className="space-y-4">
      <div className="space-y-2"><Label>Company Name *</Label><Input value={form.companyName} onChange={f('companyName')} required /></div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2"><Label>Contact Person</Label><Input value={form.contactPerson} onChange={f('contactPerson')} /></div>
        <div className="space-y-2"><Label>Email</Label><Input type="email" value={form.email} onChange={f('email')} /></div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2"><Label>Phone</Label><Input value={form.phone} onChange={f('phone')} /></div>
        <div className="space-y-2"><Label>Mobile</Label><Input value={form.mobile} onChange={f('mobile')} /></div>
      </div>
      <div className="space-y-2"><Label>Address</Label><Input value={form.address} onChange={f('address')} /></div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2"><Label>City</Label><Input value={form.city} onChange={f('city')} /></div>
        <div className="space-y-2"><Label>Country</Label><Input value={form.country} onChange={f('country')} /></div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2"><Label>Tax Number</Label><Input value={form.taxNumber} onChange={f('taxNumber')} /></div>
        <div className="space-y-2"><Label>CR Number</Label><Input value={form.crNumber} onChange={f('crNumber')} /></div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2"><Label>Credit Limit (SAR)</Label><Input type="number" value={form.creditLimit} onChange={f('creditLimit')} /></div>
        <div className="space-y-2"><Label>Payment Terms (days)</Label><Input type="number" value={form.paymentTerms} onChange={f('paymentTerms')} /></div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2"><Label>Customer Type</Label>
          <Select value={form.customerType} onValueChange={fs('customerType')}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="regular">Regular</SelectItem>
              <SelectItem value="vip">VIP</SelectItem>
              <SelectItem value="corporate">Corporate</SelectItem>
              <SelectItem value="government">Government</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {isEdit && <div className="space-y-2"><Label>Status</Label>
          <Select value={form.status} onValueChange={fs('status')}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
              <SelectItem value="suspended">Suspended</SelectItem>
            </SelectContent>
          </Select>
        </div>}
      </div>
      <Button type="submit" className="w-full">{isEdit ? 'Update Customer' : 'Create Customer'}</Button>
    </form>
  );

  if (isLoading) return <div className="flex items-center justify-center h-96"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div></div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div><h1 className="text-2xl font-bold text-slate-900">Customer Management</h1><p className="text-slate-500">Manage your customers and accounts</p></div>
        <Button className="gap-2" onClick={() => { setForm({...emptyForm}); setIsAddOpen(true); }}><PlusIcon className="w-4 h-4" /> Add Customer</Button>
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1"><SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" /><Input placeholder="Search by company, contact, or email..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10" /></div>
        <Select value={typeFilter} onValueChange={setTypeFilter}><SelectTrigger className="w-full sm:w-44"><SelectValue placeholder="All Types" /></SelectTrigger><SelectContent><SelectItem value="All Types">All Types</SelectItem><SelectItem value="regular">Regular</SelectItem><SelectItem value="vip">VIP</SelectItem><SelectItem value="corporate">Corporate</SelectItem><SelectItem value="government">Government</SelectItem></SelectContent></Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}><SelectTrigger className="w-full sm:w-40"><SelectValue placeholder="All Status" /></SelectTrigger><SelectContent><SelectItem value="All Status">All Status</SelectItem><SelectItem value="active">Active</SelectItem><SelectItem value="inactive">Inactive</SelectItem><SelectItem value="suspended">Suspended</SelectItem></SelectContent></Select>
      </div>

      <Card><CardContent className="p-0"><div className="overflow-x-auto"><Table>
        <TableHeader><TableRow><TableHead>Company</TableHead><TableHead>Code</TableHead><TableHead>Type</TableHead><TableHead>Contact</TableHead><TableHead>City</TableHead><TableHead>Credit Limit</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
        <TableBody>
          {Array.isArray(customers) && customers.map((c) => (
            <TableRow key={c.id}>
              <TableCell><div className="flex items-center gap-3"><div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center"><BuildingIcon className="w-5 h-5 text-slate-400" /></div><div><p className="font-medium text-slate-900">{c.company_name}</p><p className="text-sm text-slate-500">{c.email}</p></div></div></TableCell>
              <TableCell><span className="font-mono text-sm">{c.customer_code}</span></TableCell>
              <TableCell><Badge className={getTypeColor(c.customer_type)}>{c.customer_type}</Badge></TableCell>
              <TableCell>{c.contact_person || '—'}</TableCell>
              <TableCell>{c.city || '—'}</TableCell>
              <TableCell>{c.credit_limit != null ? `SAR ${Number(c.credit_limit).toLocaleString()}` : '—'}</TableCell>
              <TableCell><Badge className={getStatusColor(c.status)}>{c.status}</Badge></TableCell>
              <TableCell className="text-right"><div className="flex items-center justify-end gap-2">
                <Link to={`/customers/${c.id}`}><Button variant="ghost" size="icon"><EyeIcon className="w-4 h-4" /></Button></Link>
                <Button variant="ghost" size="icon" onClick={() => openEdit(c)}><EditIcon className="w-4 h-4" /></Button>
                <Button variant="ghost" size="icon" onClick={() => { setSelected(c); setIsDeleteOpen(true); }} className="text-red-600 hover:text-red-700"><TrashIcon className="w-4 h-4" /></Button>
              </div></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table></div></CardContent></Card>

      {(!Array.isArray(customers) || customers.length === 0) && <div className="text-center py-12"><BuildingIcon className="w-16 h-16 mx-auto text-slate-300 mb-4" /><h3 className="text-lg font-medium text-slate-900">No customers found</h3><p className="text-slate-500">Add your first customer to get started</p></div>}

      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}><DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto"><DialogHeader><DialogTitle>Add New Customer</DialogTitle><DialogDescription>Fill in the details to create a new customer.</DialogDescription></DialogHeader><CustomerForm isEdit={false} /></DialogContent></Dialog>
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}><DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto"><DialogHeader><DialogTitle>Edit Customer</DialogTitle><DialogDescription>Update customer information.</DialogDescription></DialogHeader><CustomerForm isEdit={true} /></DialogContent></Dialog>
      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Are you sure?</AlertDialogTitle><AlertDialogDescription>This will permanently delete customer {selected && `"${selected.company_name}"`}.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">Delete</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
    </div>
  );
}
