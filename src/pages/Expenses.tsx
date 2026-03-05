import { useEffect, useState } from 'react';
import { financeApi } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

interface Expense {
  id: number;
  expense_number: string;
  expense_date: string;
  category: string;
  description: string;
  amount: number;
  vehicle_plate?: string;
  vendor_name?: string;
  status: string;
}

function getStatusColor(status: string) {
  const colors: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-800',
    approved: 'bg-green-100 text-green-800',
    rejected: 'bg-red-100 text-red-800',
    paid: 'bg-blue-100 text-blue-800',
  };
  return colors[status] || 'bg-gray-100 text-gray-800';
}

function ReceiptIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg {...props} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z" />
    </svg>
  );
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-SA', {
    style: 'currency',
    currency: 'SAR',
  }).format(amount || 0);
}

export default function Expenses() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadExpenses();
  }, []);

  const loadExpenses = async () => {
    try {
      const data = await financeApi.getAllExpenses();
      setExpenses(data);
    } catch (error) {
      toast.error('Failed to load expenses');
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Expenses</h1>
          <p className="text-slate-500">Track and manage company expenses</p>
        </div>
      </div>

      <div className="space-y-4">
        {expenses.map((expense) => (
          <Card key={expense.id}>
            <CardContent className="p-6">
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <ReceiptIcon className="w-6 h-6 text-red-600" />
                  </div>
                  <div>
                    <div className="flex items-center gap-3">
                      <h3 className="font-semibold text-lg text-slate-900">{expense.expense_number}</h3>
                      <Badge className={getStatusColor(expense.status)}>
                        {expense.status}
                      </Badge>
                    </div>
                    <p className="text-sm text-slate-500">{expense.description}</p>
                    <p className="text-sm text-slate-400 capitalize">Category: {expense.category.replace('_', ' ')}</p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-4 lg:gap-8">
                  <div className="text-center">
                    <p className="text-xs text-slate-500">Date</p>
                    <p className="font-medium">{new Date(expense.expense_date).toLocaleDateString()}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-slate-500">Amount</p>
                    <p className="font-medium text-red-600">{formatCurrency(expense.amount)}</p>
                  </div>
                  {expense.vehicle_plate && (
                    <div className="text-center">
                      <p className="text-xs text-slate-500">Vehicle</p>
                      <p className="font-medium">{expense.vehicle_plate}</p>
                    </div>
                  )}
                  {expense.vendor_name && (
                    <div className="text-center">
                      <p className="text-xs text-slate-500">Vendor</p>
                      <p className="font-medium">{expense.vendor_name}</p>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {expenses.length === 0 && (
        <div className="text-center py-12">
          <ReceiptIcon className="w-16 h-16 mx-auto text-slate-300 mb-4" />
          <h3 className="text-lg font-medium text-slate-900">No expenses found</h3>
          <p className="text-slate-500">Record expenses to see them here</p>
        </div>
      )}
    </div>
  );
}
