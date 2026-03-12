import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from '@/components/ui/sonner';
import { toast } from 'sonner';

// Layouts
import MainLayout from './layouts/MainLayout';
import AuthLayout from './layouts/AuthLayout';

// Pages
import Login from './pages/Login';
import TrackShipment from './pages/TrackShipment';
import Dashboard from './pages/Dashboard';
import Fleet from './pages/Fleet';
import Employees from './pages/Employees';
import EmployeeDetail from './pages/EmployeeDetail';
import Shipments from './pages/Shipments';
import ShipmentDetail from './pages/ShipmentDetail';
import Customers from './pages/Customers';
import CustomerDetail from './pages/CustomerDetail';
import Invoices from './pages/Invoices';
import InvoiceDetail from './pages/InvoiceDetail';
import Payments from './pages/Payments';
import Expenses from './pages/Expenses';
import Maintenance from './pages/Maintenance';
import Reports from './pages/Reports';
import Payroll from './pages/Payroll';
import Leave from './pages/Leave';
import Users from './pages/Users';
import Settings from './pages/Settings';
import Profile from './pages/Profile';
import AuditLog from './pages/AuditLog';

// Context
import { AuthProvider, useAuth } from './contexts/AuthContext';

// Protected Route Component
function ProtectedRoute({ children, allowedRoles = [] }: { children: React.ReactNode; allowedRoles?: string[] }) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
    toast.error('You do not have permission to access this page');
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public — no auth required */}
          <Route path="/track" element={<TrackShipment />} />
          <Route path="/track/:trackingNumber" element={<TrackShipment />} />

          {/* Auth Routes */}
          <Route element={<AuthLayout />}>
            <Route path="/login" element={<Login />} />
          </Route>

          {/* Protected Routes */}
          <Route element={
            <ProtectedRoute>
              <MainLayout />
            </ProtectedRoute>
          }>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<Dashboard />} />
            
            {/* Fleet Management */}
            <Route path="/fleet" element={<Navigate to="/fleet/vehicles" replace />} />
            <Route path="/fleet/vehicles" element={<Fleet />} />
            <Route path="/fleet/drivers"  element={<Fleet />} />
            
            {/* Employee Management */}
            <Route path="/employees" element={<Employees />} />
            <Route path="/employees/:id" element={<EmployeeDetail />} />
            
            {/* Shipment Management */}
            <Route path="/shipments" element={<Shipments />} />
            <Route path="/shipments/:id" element={<ShipmentDetail />} />
            
            {/* Customer Management */}
            <Route path="/customers" element={<Customers />} />
            <Route path="/customers/:id" element={<CustomerDetail />} />
            
            {/* Finance */}
            <Route path="/invoices" element={<Invoices />} />
            <Route path="/invoices/:id" element={<InvoiceDetail />} />
            <Route path="/payments" element={<Payments />} />
            <Route path="/expenses" element={<Expenses />} />
            
            {/* Maintenance */}
            <Route path="/maintenance" element={<Maintenance />} />
            
            {/* Reports */}
            <Route path="/reports" element={<Reports />} />

            {/* Payroll — all staff can reach /payroll to see "My Slips" */}
            <Route path="/payroll" element={<Payroll />} />

            {/* Leave Management */}
            <Route path="/leave" element={<Leave />} />
            
            {/* Admin */}
            <Route path="/users" element={
              <ProtectedRoute allowedRoles={['super_admin', 'admin']}>
                <Users />
              </ProtectedRoute>
            } />
            
            {/* Settings & Profile */}
            <Route path="/settings" element={
              <ProtectedRoute allowedRoles={['super_admin','admin']}>
                <Settings />
              </ProtectedRoute>
            } />
            <Route path="/audit-log" element={
              <ProtectedRoute allowedRoles={['super_admin','admin']}>
                <AuditLog />
              </ProtectedRoute>
            } />
            <Route path="/profile" element={<Profile />} />
          </Route>

          {/* Catch All */}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
        <Toaster position="top-right" richColors />
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
