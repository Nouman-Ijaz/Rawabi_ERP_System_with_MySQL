import { useEffect, useState, useCallback } from 'react';
import { usersApi } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { fmtDate, fmtDateTime } from '@/lib/format';
import { inp, sel } from '@/lib/cx';
import FormField from '@/components/FormField';
import Icon from '@/components/Icon';
const initials = (f: string, l: string) => `${f?.[0]||''}${l?.[0]||''}`.toUpperCase();

const ROLES = ['super_admin','admin','office_admin','dispatcher','accountant','driver'];
const ROLE_STYLE: Record<string,string> = {
  super_admin:  'bg-red-500/20 text-red-300 border-red-500/30',
  admin:        'bg-blue-500/20 text-blue-300 border-blue-500/30',
  accountant:   'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  office_admin: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
  dispatcher:   'bg-amber-500/20 text-amber-300 border-amber-500/30',
  driver:       'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
};
const AVC = ['from-blue-500 to-blue-700','from-emerald-500 to-emerald-700','from-purple-500 to-purple-700',
             'from-amber-500 to-amber-700','from-cyan-500 to-cyan-700','from-rose-500 to-rose-700'];
const av = (id: number) => AVC[id % AVC.length];

const EMPTY_FORM = {
  email:'',firstName:'',lastName:'',role:'dispatcher',department:'',phone:'',password:'',isActive:'1',
};

const Fld = FormField;

export default function Users(){
  const {user:me,hasPermission}=useAuth();
  const isSuperAdmin=hasPermission(['super_admin']);
  const canEdit=hasPermission(['super_admin','admin']);

  const [users,       setUsers]       = useState<any[]>([]);
  // allRoleCounts fetched once from /users/stats — never filtered
  const [allRoleCounts, setAllRoleCounts] = useState<Record<string,number>>({});
  const [loading,     setLoading]     = useState(true);
  const [search,      setSearch]      = useState('');
  const [roleFilter,  setRoleFilter]  = useState('');
  const [showForm,    setShowForm]    = useState(false);
  const [editId,      setEditId]      = useState<number|null>(null);
  const [saving,      setSaving]      = useState(false);
  const [deleteId,    setDeleteId]    = useState<number|null>(null);
  const [form,        setForm]        = useState({...EMPTY_FORM});
  const [showPassInp, setShowPassInp] = useState(false);
  const [resetTarget, setResetTarget] = useState<any|null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [showResetPw, setShowResetPw] = useState(false);
  const [resetting,   setResetting]   = useState(false);
  const [toggleTarget,setToggleTarget]= useState<any|null>(null);
  const [statsTotal,  setStatsTotal]  = useState(0);
  const [statsActive, setStatsActive] = useState(0);

  // Load stats once (for role pills — never affected by search/filter)
  const loadStats = useCallback(async () => {
    try {
      const s = await usersApi.getStats();
      const counts: Record<string,number> = {};
      (s.roleCounts||[]).forEach((r:any)=>{ counts[r.role]=r.total; });
      setAllRoleCounts(counts);
      setStatsTotal(s.total||0);
      setStatsActive(s.active_count||0);
    } catch {}
  },[]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string,string> = {};
      if (search)     params.search = search;
      if (roleFilter) params.role   = roleFilter;
      const res = await usersApi.getAll(params);
      setUsers(res.data||res||[]);
    } catch { toast.error('Failed to load users'); }
    finally { setLoading(false); }
  },[search, roleFilter]);

  useEffect(()=>{ loadStats(); },[loadStats]);
  useEffect(()=>{ load(); },[load]);

  const openCreate=()=>{ setEditId(null); setForm({...EMPTY_FORM}); setShowPassInp(false); setShowForm(true); };
  const openEdit=(u:any)=>{
    setEditId(u.id);
    setForm({
      email:u.email||'', firstName:u.first_name||'', lastName:u.last_name||'',
      role:u.role||'dispatcher', department:u.department||'', phone:u.phone||'',
      password:'', isActive:u.is_active?'1':'0',
    });
    setShowPassInp(false);
    setShowForm(true);
  };
  const closeForm=()=>{ setShowForm(false); setEditId(null); };

  const save=async()=>{
    if(!form.email||!form.firstName||!form.lastName||!form.role){
      toast.error('Email, name and role are required'); return;
    }
    if(!editId&&form.password.length<6){
      toast.error('Password must be at least 6 characters'); return;
    }
    setSaving(true);
    try{
      if(editId){
        await usersApi.update(editId,{
          firstName:form.firstName, lastName:form.lastName,
          role:form.role, department:form.department||null, phone:form.phone||null,
          isActive:form.isActive==='1',
        });
        toast.success('User updated');
      } else {
        await usersApi.create({
          email:form.email, password:form.password,
          firstName:form.firstName, lastName:form.lastName,
          role:form.role, department:form.department||null, phone:form.phone||null,
        });
        toast.success('User created');
      }
      closeForm(); load(); loadStats();
    }catch(e:any){ toast.error(e.message||'Failed to save user'); }
    finally{ setSaving(false); }
  };

  const confirmDelete=async()=>{
    if(!deleteId)return;
    try{
      await usersApi.delete(deleteId);
      toast.success('User deleted');
      setDeleteId(null); load(); loadStats();
    }catch{ toast.error('Failed to delete user'); }
  };

  const doReset=async()=>{
    if(!resetTarget)return;
    if(newPassword.length<6){ toast.error('Password must be at least 6 characters'); return; }
    setResetting(true);
    try{
      await usersApi.resetPassword(resetTarget.id, newPassword);
      toast.success(`Password reset for ${resetTarget.first_name}`);
      setResetTarget(null); setNewPassword(''); setShowResetPw(false);
    }catch(e:any){ toast.error(e.message||'Failed to reset password'); }
    finally{ setResetting(false); }
  };

  const openReset=(u:any)=>{ setResetTarget(u); setNewPassword(''); setShowResetPw(false); };

  const toggleActive=async(u:any)=>{
    try{
      await usersApi.update(u.id,{isActive:!u.is_active});
      toast.success(`${u.first_name} ${u.is_active?'deactivated':'activated'}`);
      setToggleTarget(null); load(); loadStats();
    }catch{ toast.error('Failed to update user status'); }
  };

  const f=(k:keyof typeof EMPTY_FORM)=>(e:React.ChangeEvent<HTMLInputElement|HTMLSelectElement>)=>
    setForm(p=>({...p,[k]:e.target.value}));

  return(
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Users</h1>
          <p className="text-xs text-slate-500 mt-0.5">{statsTotal} total · {statsActive} active</p>
        </div>
        {isSuperAdmin&&(
          <button onClick={openCreate} className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium rounded-lg transition-colors">
            <Icon name="plus" className="w-3.5 h-3.5"/>Add User
          </button>
        )}
      </div>

      {/* Role filter pills — sourced from allRoleCounts, never disappear */}
      <div className="flex flex-wrap gap-2">
        <button onClick={()=>setRoleFilter('')}
          className={`px-3 py-1 rounded-full text-[11px] font-medium border transition-colors ${
            roleFilter===''?'bg-white/10 text-white border-white/20':'bg-transparent text-slate-500 border-white/10 hover:bg-white/5'
          }`}>
          All ({statsTotal})
        </button>
        {ROLES.filter(r=>allRoleCounts[r]>0).map(r=>(
          <button key={r} onClick={()=>setRoleFilter(roleFilter===r?'':r)}
            className={`px-3 py-1 rounded-full text-[11px] font-medium border transition-colors ${
              roleFilter===r ? ROLE_STYLE[r]+' border-current' : 'bg-transparent text-slate-400 border-white/10 hover:bg-white/5'
            }`}>
            {r.replace('_',' ')} ({allRoleCounts[r]||0})
          </button>
        ))}
      </div>

      {/* Search — autocomplete=off prevents browser autofill pollution */}
      <div className="relative max-w-xs">
        <Icon name="search" className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500"/>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search name or email…"
          autoComplete="off"
          name="users-search"
          className="w-full bg-[#1a1d27] border border-white/5 rounded-lg pl-9 pr-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-blue-500/40"/>
      </div>

      {/* Table */}
      <div className="bg-[#1a1d27] rounded-xl border border-white/5 overflow-hidden">
        {loading?(
          <div className="p-8 text-center text-slate-600 text-xs">Loading users…</div>
        ):users.length===0?(
          <div className="p-12 text-center">
            <Icon name="users" className="w-10 h-10 text-slate-700 mx-auto mb-3"/>
            <p className="text-sm text-slate-500">No users found</p>
          </div>
        ):(
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-white/5">
                  {['User','Role','Department','Phone','Last Login','Status','Actions'].map(h=>(
                    <th key={h} className="py-3 px-4 text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {users.map((u:any)=>{
                  const isMe=u.id===me?.id;
                  return(
                    <tr key={u.id} className={`border-b border-white/5 hover:bg-white/[0.02] transition-colors group ${isMe?'bg-blue-500/[0.04]':''}`}>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${av(u.id)} flex items-center justify-center text-[11px] font-bold text-white flex-shrink-0`}>
                            {initials(u.first_name,u.last_name)}
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <p className="font-semibold text-white">{u.first_name} {u.last_name}</p>
                              {isMe&&<span className="text-[9px] px-1 py-0.5 rounded bg-blue-500/20 text-blue-400 font-medium">you</span>}
                            </div>
                            <p className="text-[10px] text-slate-500">{u.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium border ${ROLE_STYLE[u.role]||'bg-slate-500/15 text-slate-400 border-transparent'}`}>
                          {(u.role||'').replace('_',' ')}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-400">{u.department||'—'}</td>
                      <td className="py-3 px-4 text-slate-400">{u.phone||'—'}</td>
                      <td className="py-3 px-4 text-slate-500 whitespace-nowrap text-[11px]">{fmtDateTime(u.last_login, 'Never')}</td>
                      <td className="py-3 px-4">
                        <button onClick={()=>!isMe&&setToggleTarget(u)} disabled={isMe}
                          className={`px-2 py-0.5 rounded-full text-[10px] font-medium transition-colors ${
                            u.is_active?'bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25':'bg-slate-500/15 text-slate-400 hover:bg-slate-500/25'
                          } ${isMe?'cursor-default opacity-60':'cursor-pointer'}`}>
                          {u.is_active?'Active':'Inactive'}
                        </button>
                      </td>
                      <td className="py-3 px-4">
                        {canEdit&&!isMe&&(
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={()=>openEdit(u)} className="p-1.5 rounded-md hover:bg-blue-500/15 text-slate-500 hover:text-blue-400 transition-colors" title="Edit user">
                              <Icon name="edit" className="w-3.5 h-3.5"/>
                            </button>
                            {isSuperAdmin&&(
                              <button onClick={()=>openReset(u)} className="p-1.5 rounded-md hover:bg-amber-500/15 text-slate-500 hover:text-amber-400 transition-colors" title="Reset password">
                                <Icon name="key" className="w-3.5 h-3.5"/>
                              </button>
                            )}
                            {isSuperAdmin&&(
                              <button onClick={()=>setDeleteId(u.id)} className="p-1.5 rounded-md hover:bg-red-500/15 text-slate-500 hover:text-red-400 transition-colors" title="Delete">
                                <Icon name="trash" className="w-3.5 h-3.5"/>
                              </button>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* CREATE / EDIT MODAL */}
      {showForm&&(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={closeForm}/>
          {/* Hidden dummy fields defeat browser autofill before real fields */}
          <input type="text"     name="prevent_autofill" style={{display:'none'}} autoComplete="off"/>
          <input type="password" name="prevent_autofill_pw" style={{display:'none'}} autoComplete="new-password"/>
          <div className="relative w-full max-w-md bg-[#0d0f14] rounded-2xl border border-white/10 shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 flex-shrink-0">
              <h2 className="text-sm font-semibold text-white">{editId?'Edit User':'New User'}</h2>
              <button onClick={closeForm} className="p-1.5 rounded-md hover:bg-white/5 text-slate-400 hover:text-white transition-colors"><Icon name="x" className="w-4 h-4"/></button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {!editId&&(
                <Fld label="Email" req>
                  <input type="email" value={form.email} onChange={f('email')} className={inp} placeholder="user@rawabi.com" autoComplete="off" name="new-user-email"/>
                </Fld>
              )}
              {editId&&(
                <div className="bg-[#0c0e13] rounded-lg px-4 py-2.5 border border-white/5">
                  <p className="text-[10px] text-slate-500">Email</p>
                  <p className="text-xs text-slate-300 mt-0.5">{form.email}</p>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <Fld label="First Name" req><input value={form.firstName} onChange={f('firstName')} className={inp} placeholder="Ahmed" autoComplete="off"/></Fld>
                <Fld label="Last Name" req><input value={form.lastName} onChange={f('lastName')} className={inp} placeholder="Al-Rashid" autoComplete="off"/></Fld>
              </div>
              <Fld label="Role" req>
                <select value={form.role} onChange={f('role')} className={sel} disabled={!isSuperAdmin&&editId!==null}>
                  {ROLES.map(r=><option key={r} value={r}>{r.replace('_',' ')}</option>)}
                </select>
              </Fld>
              <div className="grid grid-cols-2 gap-3">
                <Fld label="Department">
                  <select value={form.department} onChange={f('department')} className={sel}>
                    <option value="">Select department…</option>
                    {['Operations','Logistics','Finance','HR','IT','Management','Maintenance','Dispatch','Admin','Sales'].map(d=>(
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </Fld>
                <Fld label="Phone"><input value={form.phone} onChange={f('phone')} className={inp} placeholder="+966 5xx xxx xxxx" autoComplete="off"/></Fld>
              </div>
              {editId&&(
                <Fld label="Account Status">
                  <select value={form.isActive} onChange={f('isActive')} className={sel}>
                    <option value="1">Active</option>
                    <option value="0">Inactive</option>
                  </select>
                </Fld>
              )}
              {!editId&&(
                <Fld label="Password" req>
                  <div className="relative">
                    <input type={showPassInp?'text':'password'} value={form.password} onChange={f('password')}
                      className={inp+' pr-10'} placeholder="Min 6 characters"
                      autoComplete="new-password" name="new-user-password"/>
                    <button type="button" onClick={()=>setShowPassInp(p=>!p)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
                      <Icon name={showPassInp?'eyeoff':'eye'} className="w-3.5 h-3.5"/>
                    </button>
                  </div>
                </Fld>
              )}
            </div>
            <div className="px-6 py-4 border-t border-white/5 flex gap-3 flex-shrink-0">
              <button onClick={closeForm} className="flex-1 py-2 text-xs font-medium text-slate-400 border border-white/10 rounded-lg hover:text-white transition-colors">Cancel</button>
              <button onClick={save} disabled={saving} className="flex-1 py-2 text-xs font-medium bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-lg transition-colors">
                {saving?'Saving…':editId?'Save Changes':'Create User'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* RESET PASSWORD MODAL */}
      {resetTarget&&(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={()=>setResetTarget(null)}/>
          <div className="relative bg-[#1a1d27] rounded-xl border border-white/10 p-6 w-full max-w-sm shadow-2xl">
            <h3 className="text-sm font-semibold text-white mb-1">Reset Password</h3>
            <p className="text-xs text-slate-500 mb-4">Set a new password for <span className="text-white font-medium">{resetTarget.first_name} {resetTarget.last_name}</span></p>
            <div className="relative mb-4">
              <input type={showResetPw?'text':'password'} value={newPassword} onChange={e=>setNewPassword(e.target.value)}
                className={inp+' pr-10'} placeholder="New password (min 6 chars)"
                autoComplete="new-password" name="reset-password-field"/>
              <button type="button" onClick={()=>setShowResetPw(p=>!p)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
                <Icon name={showResetPw?'eyeoff':'eye'} className="w-3.5 h-3.5"/>
              </button>
            </div>
            {newPassword.length>0&&newPassword.length<6&&(
              <p className="text-[11px] text-red-400 mb-3">Password must be at least 6 characters</p>
            )}
            <div className="flex gap-3">
              <button onClick={()=>setResetTarget(null)} className="flex-1 py-2 text-xs border border-white/10 rounded-lg text-slate-400 hover:text-white transition-colors">Cancel</button>
              <button onClick={doReset} disabled={resetting||newPassword.length<6}
                className="flex-1 py-2 text-xs bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white rounded-lg transition-colors">
                {resetting?'Resetting…':'Reset Password'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TOGGLE ACTIVE MODAL */}
      {toggleTarget&&(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={()=>setToggleTarget(null)}/>
          <div className="relative bg-[#1a1d27] rounded-xl border border-white/10 p-6 w-full max-w-sm shadow-2xl">
            <h3 className="text-sm font-semibold text-white mb-2">{toggleTarget.is_active?'Deactivate User':'Activate User'}</h3>
            <p className="text-xs text-slate-400 mb-5">
              {toggleTarget.is_active
                ?`${toggleTarget.first_name} will lose access immediately.`
                :`${toggleTarget.first_name} will regain access to the system.`}
            </p>
            <div className="flex gap-3">
              <button onClick={()=>setToggleTarget(null)} className="flex-1 py-2 text-xs border border-white/10 rounded-lg text-slate-400 hover:text-white transition-colors">Cancel</button>
              <button onClick={()=>toggleActive(toggleTarget)}
                className={`flex-1 py-2 text-xs text-white rounded-lg transition-colors ${toggleTarget.is_active?'bg-red-600 hover:bg-red-500':'bg-emerald-600 hover:bg-emerald-500'}`}>
                {toggleTarget.is_active?'Deactivate':'Activate'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE CONFIRM */}
      {deleteId&&(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={()=>setDeleteId(null)}/>
          <div className="relative bg-[#1a1d27] rounded-xl border border-white/10 p-6 w-full max-w-sm shadow-2xl">
            <h3 className="text-sm font-semibold text-white mb-2">Delete User</h3>
            <p className="text-xs text-slate-400 mb-5">This user account will be permanently deleted.</p>
            <div className="flex gap-3">
              <button onClick={()=>setDeleteId(null)} className="flex-1 py-2 text-xs border border-white/10 rounded-lg text-slate-400 hover:text-white transition-colors">Cancel</button>
              <button onClick={confirmDelete} className="flex-1 py-2 text-xs bg-red-600 hover:bg-red-500 text-white rounded-lg transition-colors">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
