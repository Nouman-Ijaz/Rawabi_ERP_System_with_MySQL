import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { authApi } from '@/lib/api';

export type UserRole = 'super_admin' | 'admin' | 'accountant' | 'office_admin' | 'dispatcher' | 'driver';

interface User {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  department?: string;
  employeeId?: number;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  hasPermission: (roles: UserRole[]) => boolean;
  isAdmin: () => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) { loadUser(); } else { setIsLoading(false); }
  }, []);

  const loadUser = async () => {
    try {
      const userData = await authApi.getProfile();
      setUser({
        id: userData.id, email: userData.email,
        firstName: userData.first_name, lastName: userData.last_name,
        role: userData.role, department: userData.department,
        employeeId: userData.employee_id || undefined,
      });
    } catch { localStorage.removeItem('token'); }
    finally { setIsLoading(false); }
  };

  const login = async (email: string, password: string) => {
    const response = await authApi.login(email, password);
    localStorage.setItem('token', response.token);
    setUser(response.user);
  };

  const logout = () => {
    localStorage.removeItem('token');
    setUser(null);
    window.location.href = '/login';
  };

  const hasPermission = (roles: UserRole[]) => {
    if (!user) return false;
    if (roles.length === 0) return true;
    return roles.includes(user.role);
  };

  const isAdmin = () => hasPermission(['super_admin', 'admin']);

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout, hasPermission, isAdmin }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
}
