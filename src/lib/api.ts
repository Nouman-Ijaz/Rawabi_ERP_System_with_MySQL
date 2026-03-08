// API client for Rawabi Logistics ERP
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

// Get token from localStorage
function getToken(): string | null {
  return localStorage.getItem('token');
}

// Generic fetch wrapper
async function fetchApi<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;
  
  const headers: Record<string, string> = {
    ...((options.headers as Record<string, string>) || {}),
  };

  const token = getToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // Don't set Content-Type for FormData (browser will set it with boundary)
  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || `HTTP error! status: ${response.status}`);
  }

  return response.json();
}

// Auth API
export const authApi = {
  login: (email: string, password: string) =>
    fetchApi<{ token: string; user: any }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),
  
  getProfile: () => fetchApi<any>('/profile'),
  
  updateProfile: (data: any) =>
    fetchApi<any>('/profile', {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  
  changePassword: (currentPassword: string, newPassword: string) =>
    fetchApi<any>('/me/change-password', {
      method: 'PUT',
      body: JSON.stringify({ currentPassword, newPassword }),
    }),
  
  getDashboardStats: () => fetchApi<any>('/dashboard/stats'),
};

// Users API
export const usersApi = {
  getAll: (params?: Record<string, string>) =>
    fetchApi<any>(`/users?${new URLSearchParams(params || {}).toString()}`),

  getStats: () => fetchApi<any>('/users/stats'),

  getById: (id: number) => fetchApi<any>(`/users/${id}`),
  
  create: (data: any) =>
    fetchApi<any>('/users', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  
  update: (id: number, data: any) =>
    fetchApi<any>(`/users/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  
  delete: (id: number) =>
    fetchApi<any>(`/users/${id}`, {
      method: 'DELETE',
    }),
  
  resetPassword: (id: number, newPassword: string) =>
    fetchApi<any>(`/users/${id}/reset-password`, {
      method: 'PUT',
      body: JSON.stringify({ newPassword }),
    }),
};

// Employees API (Kept as FormData for file uploads)
export const employeesApi = {
  getAll: (params?: Record<string, string>) =>
    fetchApi<any>(`/employees?${new URLSearchParams(params || {}).toString()}`),
  
  getById: (id: number) => fetchApi<any>(`/employees/${id}`),
  
  getDepartments: () => fetchApi<string[]>('/employees/departments'),
  
  getStats: () => fetchApi<any>('/employees/stats'),
  
  create: (data: FormData) =>
    fetchApi<any>('/employees', {
      method: 'POST',
      body: data,
    }),
  
  update: (id: number, data: FormData) =>
    fetchApi<any>(`/employees/${id}`, {
      method: 'PUT',
      body: data,
    }),
  
  delete: (id: number) =>
    fetchApi<any>(`/employees/${id}`, {
      method: 'DELETE',
    }),
};

// Vehicles API
export const vehiclesApi = {
  getAll: (params?: Record<string, string>) =>
    fetchApi<any>(`/vehicles?${new URLSearchParams(params || {}).toString()}`),
  
  getById: (id: number) => fetchApi<any>(`/vehicles/${id}`),
  
  getSummary: () => fetchApi<any>('/vehicles/summary'),
  
  create: (data: any) =>
    fetchApi<any>('/vehicles', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  
  update: (id: number, data: any) =>
    fetchApi<any>(`/vehicles/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  
  delete: (id: number) =>
    fetchApi<any>(`/vehicles/${id}`, {
      method: 'DELETE',
    }),
  
  assignDriver: (id: number, driverId: number, isPrimary: boolean = true) =>
    fetchApi<any>(`/vehicles/${id}/assign-driver`, {
      method: 'POST',
      body: JSON.stringify({ driverId, isPrimary }),
    }),
  
  unassignDriver: (id: number, driverId: number) =>
    fetchApi<any>(`/vehicles/${id}/unassign-driver`, {
      method: 'POST',
      body: JSON.stringify({ driverId }),
    }),
  
  addFuelRecord: (id: number, data: any) =>
    fetchApi<any>(`/vehicles/${id}/fuel`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
};

// Drivers API (Fixed to use JSON)
export const driversApi = {
  getAll: (params?: Record<string, string>) =>
    fetchApi<any>(`/drivers?${new URLSearchParams(params || {}).toString()}`),
  
  getAvailable: () => fetchApi<any[]>('/drivers/available'),
  
  getById: (id: number) => fetchApi<any>(`/drivers/${id}`),
  
  getPerformance: (id: number, period?: string) =>
    fetchApi<any>(`/drivers/${id}/performance?${period ? `period=${period}` : ''}`),
  
  create: (data: any) => // Changed from FormData
    fetchApi<any>('/drivers', {
      method: 'POST',
      body: JSON.stringify(data), // Added JSON.stringify
    }),
  
  update: (id: number, data: any) => // Changed from FormData
    fetchApi<any>(`/drivers/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data), // Added JSON.stringify
    }),
  
  delete: (id: number) =>
    fetchApi<any>(`/drivers/${id}`, {
      method: 'DELETE',
    }),

  updateRating: (id: number, rating: number, notes?: string) =>
    fetchApi<any>(`/drivers/${id}/rating`, {
      method: 'PUT',
      body: JSON.stringify({ rating, notes }),
    }),
};

// Shipments API
export const shipmentsApi = {
  getAll: (params?: Record<string, string>) =>
    fetchApi<any>(`/shipments?${new URLSearchParams(params || {}).toString()}`),
  
  getStats: (period?: string) => fetchApi<any>(`/shipments/stats${period ? `?period=${period}` : ''}`),
  
  getById: (id: number) => fetchApi<any>(`/shipments/${id}`),
  
  create: (data: any) =>
    fetchApi<any>('/shipments', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  
  update: (id: number, data: any) =>
    fetchApi<any>(`/shipments/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  
  updateStatus: (id: number, status: string, location?: string, notes?: string) =>
    fetchApi<any>(`/shipments/${id}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status, location, notes }),
    }),
  
  assignVehicleAndDriver: (id: number, vehicleId: number, driverId: number) =>
    fetchApi<any>(`/shipments/${id}/assign`, {
      method: 'POST',
      body: JSON.stringify({ vehicleId, driverId }),
    }),
  
  delete: (id: number) =>
    fetchApi<any>(`/shipments/${id}`, {
      method: 'DELETE',
    }),
  
  submitForApproval: (id: number) =>
    fetchApi<any>(`/shipments/${id}/submit-approval`, { method: 'PUT' }),
  
  approveShipment: (id: number) =>
    fetchApi<any>(`/shipments/${id}/approve`, { method: 'PUT' }),
  
  rejectShipment: (id: number, reason: string) =>
    fetchApi<any>(`/shipments/${id}/reject`, { method: 'PUT', body: JSON.stringify({ rejection_reason: reason }) }),
  
  track: (trackingNumber: string) =>
    fetchApi<any>(`/shipments/track/${trackingNumber}`),

  uploadDocument: (id: number, file: File, documentType: string, notes?: string) => {
    const form = new FormData();
    form.append('file', file);
    form.append('documentType', documentType);
    if (notes) form.append('notes', notes);
    return fetchApi<any>(`/shipments/${id}/documents`, { method: 'POST', body: form });
  },

  deleteDocument: (id: number, docId: number) =>
    fetchApi<any>(`/shipments/${id}/documents/${docId}`, { method: 'DELETE' }),
};

// Notifications
export const notificationsApi = {
  get: () => fetchApi<any>('/notifications'),
};

// Available vehicles/drivers for assignment (excludes busy ones)
export const availableApi = {
  vehicles: (excludeShipmentId?: number) =>
    fetchApi<any[]>(`/available/vehicles${excludeShipmentId ? `?exclude=${excludeShipmentId}` : ''}`),
  drivers: (excludeShipmentId?: number) =>
    fetchApi<any[]>(`/available/drivers${excludeShipmentId ? `?exclude=${excludeShipmentId}` : ''}`),
};

// Customers API
export const customersApi = {
  getAll: (params?: Record<string, string>) =>
    fetchApi<any>(`/customers?${new URLSearchParams(params || {}).toString()}`),
  
  getSummary: () => fetchApi<any>('/customers/summary'),
  
  getById: (id: number) => fetchApi<any>(`/customers/${id}`),
  
  create: (data: any) =>
    fetchApi<any>('/customers', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  
  update: (id: number, data: any) =>
    fetchApi<any>(`/customers/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  
  delete: (id: number) =>
    fetchApi<any>(`/customers/${id}`, {
      method: 'DELETE',
    }),
  
  addContact: (id: number, data: any) =>
    fetchApi<any>(`/customers/${id}/contacts`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  
  updateContact: (id: number, contactId: number, data: any) =>
    fetchApi<any>(`/customers/${id}/contacts/${contactId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  
  deleteContact: (id: number, contactId: number) =>
    fetchApi<any>(`/customers/${id}/contacts/${contactId}`, {
      method: 'DELETE',
    }),
};

// Finance API
export const financeApi = {
  // Invoices
  getAllInvoices: (params?: Record<string, string>) =>
    fetchApi<any[]>(`/invoices?${new URLSearchParams(params || {}).toString()}`),
  
  getInvoiceById: (id: number) => fetchApi<any>(`/invoices/${id}`),
  
  createInvoice: (data: any) =>
    fetchApi<any>('/invoices', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  
  updateInvoiceStatus: (id: number, status: string) =>
    fetchApi<any>(`/invoices/${id}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status }),
    }),
  
  // Payments
  getAllPayments: (params?: Record<string, string>) =>
    fetchApi<any[]>(`/payments?${new URLSearchParams(params || {}).toString()}`),
  
  createPayment: (data: any) =>
    fetchApi<any>('/payments', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  
  // Expenses
  getAllExpenses: (params?: Record<string, string>) =>
    fetchApi<any[]>(`/expenses?${new URLSearchParams(params || {}).toString()}`),
  
  createExpense: (data: any) =>
    fetchApi<any>('/expenses', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  
  approveExpense: (id: number, status: string) =>
    fetchApi<any>(`/expenses/${id}/approve`, {
      method: 'PUT',
      body: JSON.stringify({ status }),
    }),
  
  // Reports
  getFinancialSummary: (period?: string) =>
    fetchApi<any>(`/finance/summary${period ? `?period=${period}` : ''}`),

  // Invoice creation helpers
  getDeliverableShipments: () =>
    fetchApi<any[]>('/finance/deliverable-shipments'),

  getCompanySettings: () =>
    fetchApi<any>('/finance/company-settings'),

  // Update invoice (full edit)
  updateInvoice: (id: number, data: any) =>
    fetchApi<any>(`/invoices/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
};

// Maintenance API
export const maintenanceApi = {
  getAll: (params?: Record<string, string>) =>
    fetchApi<any[]>(`/maintenance?${new URLSearchParams(params || {}).toString()}`),
  
  getUpcoming: () => fetchApi<any>('/maintenance/upcoming'),
  
  getSummary: () => fetchApi<any>('/maintenance/summary'),
  
  getById: (id: number) => fetchApi<any>(`/maintenance/${id}`),
  
  create: (data: any) =>
    fetchApi<any>('/maintenance', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  
  update: (id: number, data: any) =>
    fetchApi<any>(`/maintenance/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  
  delete: (id: number) =>
    fetchApi<any>(`/maintenance/${id}`, {
      method: 'DELETE',
    }),
};

// Reports API
export const reportsApi = {
  getShipmentKPIs:       (period?: string) => fetchApi<any>(`/reports/shipment-kpis?period=${period || 'month'}`),
  getRevenueByCustomer:  (period?: string) => fetchApi<any>(`/reports/revenue-by-customer?period=${period || 'month'}`),
  getRoutePerformance:   (period?: string) => fetchApi<any>(`/reports/route-performance?period=${period || 'month'}`),
  getFleetAlerts:        ()                => fetchApi<any>(`/reports/fleet-alerts`),
  getCashFlowForecast:   ()                => fetchApi<any>(`/reports/cash-flow-forecast`),
  getDriverPerformance:  (period?: string) => fetchApi<any>(`/reports/driver-performance?period=${period || 'month'}`),
};

export const settingsApi = {
  getAll: () => fetchApi<any>('/settings'),
  update: (data: Record<string, string>) =>
    fetchApi<any>('/settings', { method: 'PUT', body: JSON.stringify(data) }),
};

// Payroll API
export const payrollApi = {
  getStats: () => fetchApi<any>('/payroll/stats'),
  getPeriods: (params?: Record<string,string>) =>
    fetchApi<any[]>(`/payroll/periods?${new URLSearchParams(params||{}).toString()}`),
  createPeriod: (data: any) =>
    fetchApi<any>('/payroll/periods', { method: 'POST', body: JSON.stringify(data) }),
  getPeriodById: (id: number) => fetchApi<any>(`/payroll/periods/${id}`),
  generateSlips: (id: number) =>
    fetchApi<any>(`/payroll/periods/${id}/generate`, { method: 'POST', body: '{}' }),
  approvePeriod: (id: number) =>
    fetchApi<any>(`/payroll/periods/${id}/approve`, { method: 'POST', body: '{}' }),
  markPaid: (id: number, paymentDate?: string) =>
    fetchApi<any>(`/payroll/periods/${id}/mark-paid`, { method: 'POST', body: JSON.stringify({ paymentDate }) }),
  updateSlip: (id: number, data: any) =>
    fetchApi<any>(`/payroll/slips/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  getSalaryStructure: (employeeId: number) =>
    fetchApi<any[]>(`/payroll/salary/${employeeId}`),
  upsertSalaryStructure: (employeeId: number, data: any) =>
    fetchApi<any>(`/payroll/salary/${employeeId}`, { method: 'POST', body: JSON.stringify(data) }),
  getLoans: (params?: Record<string,string>) =>
    fetchApi<any[]>(`/payroll/loans?${new URLSearchParams(params||{}).toString()}`),
  createLoan: (data: any) =>
    fetchApi<any>('/payroll/loans', { method: 'POST', body: JSON.stringify(data) }),
  updateLoanStatus: (id: number, status: string) =>
    fetchApi<any>(`/payroll/loans/${id}/status`, { method: 'PUT', body: JSON.stringify({ status }) }),
};

// Export all APIs
export const api = {
  auth: authApi,
  users: usersApi,
  employees: employeesApi,
  vehicles: vehiclesApi,
  drivers: driversApi,
  shipments: shipmentsApi,
  customers: customersApi,
  finance: financeApi,
  maintenance: maintenanceApi,
  reports: reportsApi,
  settings: settingsApi,
  payroll: payrollApi,
};

export default api;