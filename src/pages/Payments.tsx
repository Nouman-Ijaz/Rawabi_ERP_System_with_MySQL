import { useEffect, useState } from 'react';
import { financeApi } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from 'sonner';

interface Payment {
  id: number;
  payment_number: string;
  customer_name: string;
  invoice_number?: string;
  payment_date: string;
  amount: number;
  payment_method: string;
  reference_number?: string;
}

function CreditCardIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg {...props} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
    </svg>
  );
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-SA', {
    style: 'currency',
    currency: 'SAR',
  }).format(amount || 0);
}

export default function Payments() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadPayments();
  }, []);

  const loadPayments = async () => {
    try {
      const data = await financeApi.getAllPayments();
      setPayments(data);
    } catch (error) {
      toast.error('Failed to load payments');
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
          <h1 className="text-2xl font-bold text-slate-900">Payments</h1>
          <p className="text-slate-500">Track and manage customer payments</p>
        </div>
      </div>

      <div className="space-y-4">
        {payments.map((payment) => (
          <Card key={payment.id}>
            <CardContent className="p-6">
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <CreditCardIcon className="w-6 h-6 text-green-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg text-slate-900">{payment.payment_number}</h3>
                    <p className="text-sm text-slate-500">{payment.customer_name}</p>
                    {payment.invoice_number && (
                      <p className="text-sm text-slate-400">Invoice: {payment.invoice_number}</p>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-4 lg:gap-8">
                  <div className="text-center">
                    <p className="text-xs text-slate-500">Date</p>
                    <p className="font-medium">{new Date(payment.payment_date).toLocaleDateString()}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-slate-500">Amount</p>
                    <p className="font-medium text-green-600">{formatCurrency(payment.amount)}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-slate-500">Method</p>
                    <p className="font-medium capitalize">{payment.payment_method.replace('_', ' ')}</p>
                  </div>
                  {payment.reference_number && (
                    <div className="text-center">
                      <p className="text-xs text-slate-500">Reference</p>
                      <p className="font-medium">{payment.reference_number}</p>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {payments.length === 0 && (
        <div className="text-center py-12">
          <CreditCardIcon className="w-16 h-16 mx-auto text-slate-300 mb-4" />
          <h3 className="text-lg font-medium text-slate-900">No payments found</h3>
          <p className="text-slate-500">Record payments to see them here</p>
        </div>
      )}
    </div>
  );
}
