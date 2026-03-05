import { useEffect, useState } from 'react';
import { usersApi } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';

interface User {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  role: string;
  department?: string;
  phone?: string;
  is_active: boolean;
  last_login?: string;
}

const emptyForm = {
  email: '',
  password: '',
  firstName: '',
  lastName: '',
  role: 'viewer',
  department: '',
  phone: '',
};

function getRoleColor(role: string) {
  const colors: Record<string, string> = {
    admin: 'bg-red-100 text-red-800',
    manager: 'bg-purple-100 text-purple-800',
    accountant: 'bg-blue-100 text-blue-800',
    dispatcher: 'bg-green-100 text-green-800',
    viewer: 'bg-gray-100 text-gray-800',
  };
  return colors[role] || 'bg-gray-100 text-gray-800';
}

const UserIcon = (p: React.SVGProps<SVGSVGElement>) => (
  <svg {...p} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
  </svg>
);

const PlusIcon = (p: React.SVGProps<SVGSVGElement>) => (
  <svg {...p} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
  </svg>
);

export default function Users() {
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [form, setForm] = useState({ ...emptyForm });

  useEffect(() => {
    loadUsers();
  }, [searchQuery, roleFilter]);

  const loadUsers = async () => {
    try {
      setIsLoading(true);
      const params: any = {};
      if (searchQuery) params.search = searchQuery;
      if (roleFilter !== 'all') params.role = roleFilter;
      
      const res = await usersApi.getAll(params);
      const data = (res as any)?.data || res;
      setUsers(Array.isArray(data) ? data : []);
    } catch {
      toast.error('Failed to load users');
      setUsers([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await usersApi.create(form);
      toast.success('User created successfully');
      setIsAddOpen(false);
      setForm({ ...emptyForm });
      loadUsers();
    } catch (err: any) {
      toast.error(err.message || 'Failed to create user');
    }
  };

  const updateField = (k: keyof typeof emptyForm) => (e: React.ChangeEvent<HTMLInputElement>) => 
    setForm(prev => ({ ...prev, [k]: e.target.value }));

  const updateSelect = (k: keyof typeof emptyForm) => (v: string) => 
    setForm(prev => ({ ...prev, [k]: v }));

  if (isLoading) return <div className="flex items-center justify-center h-96"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div></div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">User Management</h1>
          <p className="text-slate-500">Manage system users and their roles</p>
        </div>
        <Button className="gap-2" onClick={() => { setForm({ ...emptyForm }); setIsAddOpen(true); }}>
          <PlusIcon className="w-4 h-4" /> Add User
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <Input 
          placeholder="Search users..." 
          value={searchQuery} 
          onChange={(e) => setSearchQuery(e.target.value)} 
          className="flex-1" 
        />
        <Select value={roleFilter} onValueChange={setRoleFilter}>
          <SelectTrigger className="w-full sm:w-48"><SelectValue placeholder="All Roles" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Roles</SelectItem>
            <SelectItem value="admin">Admin</SelectItem>
            <SelectItem value="manager">Manager</SelectItem>
            <SelectItem value="accountant">Accountant</SelectItem>
            <SelectItem value="dispatcher">Dispatcher</SelectItem>
            <SelectItem value="viewer">Viewer</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {users.map((user) => (
          <Card key={user.id}>
            <CardContent className="pt-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500"><UserIcon className="w-6 h-6" /></div>
                  <div><h3 className="font-semibold text-slate-900">{user.first_name} {user.last_name}</h3><p className="text-sm text-slate-500">{user.email}</p></div>
                </div>
                <Badge className={getRoleColor(user.role)}>{user.role}</Badge>
              </div>
              <div className="space-y-2 pt-4 border-t text-sm">
                <div className="flex justify-between"><span className="text-slate-500">Department</span><span className="font-medium">{user.department || '—'}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Phone</span><span className="font-medium">{user.phone || '—'}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Status</span><Badge variant={user.is_active ? 'default' : 'secondary'}>{user.is_active ? 'Active' : 'Inactive'}</Badge></div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Add New User</DialogTitle><DialogDescription>Enter account details for the new user.</DialogDescription></DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4 pt-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>First Name *</Label><Input value={form.firstName} onChange={updateField('firstName')} required /></div>
              <div className="space-y-2"><Label>Last Name *</Label><Input value={form.lastName} onChange={updateField('lastName')} required /></div>
            </div>
            <div className="space-y-2"><Label>Email *</Label><Input type="email" value={form.email} onChange={updateField('email')} required /></div>
            <div className="space-y-2"><Label>Password *</Label><Input type="password" value={form.password} onChange={updateField('password')} required /></div>
            <div className="space-y-2">
              <Label>Role *</Label>
              <Select value={form.role} onValueChange={updateSelect('role')}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="manager">Manager</SelectItem>
                  <SelectItem value="accountant">Accountant</SelectItem>
                  <SelectItem value="dispatcher">Dispatcher</SelectItem>
                  <SelectItem value="viewer">Viewer</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label>Department</Label><Input value={form.department} onChange={updateField('department')} /></div>
            <div className="space-y-2"><Label>Phone</Label><Input value={form.phone} onChange={updateField('phone')} /></div>
            <Button type="submit" className="w-full">Create User</Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}