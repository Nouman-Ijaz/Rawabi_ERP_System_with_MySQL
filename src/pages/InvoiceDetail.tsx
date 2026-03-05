import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { financeApi } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

function getStatusColor(status: string) {
  const colors: Record<string, string> = {
    draft: 'bg-gray-100 text-gray-800',
    sent: 'bg-blue-100 text-blue-800',
    paid: 'bg-green-100 text-green-800',
    partial: 'bg-yellow-100 text-yellow-800',
    overdue: 'bg-red-100 text-red-800',
    cancelled: 'bg-gray-100 text-gray-800',
  };
  return colors[status] || 'bg-gray-100 text-gray-800';
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-SA', {
    style: 'currency',
    currency: 'SAR',
  }).format(amount || 0);
}

export default function InvoiceDetail() {
  const { id } = useParams<{ id: string }>();
  const [invoice, setInvoice] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (id) {
      loadInvoice();
    }
  }, [id]);

  const loadInvoice = async () => {
    try {
      const data = await financeApi.getInvoiceById(parseInt(id!));
      setInvoice(data);
    } catch (error) {
      toast.error('Failed to load invoice details');
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

  if (!invoice) {
    return (
      <div className="text-center py-12">
        <h3 className="text-lg font-medium text-slate-900">Invoice not found</h3>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-900">{invoice.invoice_number}</h1>
            <Badge className={getStatusColor(invoice.status)}>{invoice.status}</Badge>
          </div>
          <p className="text-slate-500">{invoice.customer_name}</p>
        </div>
        <Link to="/invoices">
          <Button variant="outline">Back to Invoices</Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Invoice Details</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div>
                <p className="text-sm text-slate-500">Invoice Date</p>
                <p className="font-medium">{new Date(invoice.invoice_date).toLocaleDateString()}</p>
              </div>
              <div>
                <p className="text-sm text-slate-500">Due Date</p>
                <p className="font-medium">{new Date(invoice.due_date).toLocaleDateString()}</p>
              </div>
              {invoice.shipment_number && (
                <div>
                  <p className="text-sm text-slate-500">Shipment</p>
                  <p className="font-medium">{invoice.shipment_number}</p>
                </div>
              )}
              <div>
                <p className="text-sm text-slate-500">Payment Terms</p>
                <p className="font-medium">{invoice.payment_terms} days</p>
              </div>
            </div>

            {/* Invoice Items */}
            <div className="border-t pt-4">
              <h3 className="font-medium mb-3">Invoice Items</h3>
              {invoice.items && invoice.items.length > 0 ? (
                <div className="space-y-2">
                  {invoice.items.map((item: any, index: number) => (
                    <div key={index} className="flex justify-between p-2 bg-slate-50 rounded">
                      <div>
                        <p className="font-medium">{item.description}</p>
                        <p className="text-sm text-slate-500">{item.quantity} {item.unit} × {formatCurrency(item.unit_price)}</p>
                      </div>
                      <p className="font-medium">{formatCurrency(item.total_price)}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-slate-500">No items</p>
              )}
            </div>

            {/* Totals */}
            <div className="border-t pt-4 mt-4">
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-500">Subtotal</span>
                  <span className="font-medium">{formatCurrency(invoice.subtotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Tax</span>
                  <span className="font-medium">{formatCurrency(invoice.tax_amount)}</span>
                </div>
                {invoice.discount_amount > 0 && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">Discount</span>
                    <span className="font-medium text-red-600">-{formatCurrency(invoice.discount_amount)}</span>
                  </div>
                )}
                <div className="flex justify-between text-lg font-bold">
                  <span>Total</span>
                  <span>{formatCurrency(invoice.total_amount)}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Payment Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div>
                  <p className="text-sm text-slate-500">Total Amount</p>
                  <p className="font-medium text-xl">{formatCurrency(invoice.total_amount)}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500">Paid Amount</p>
                  <p className="font-medium text-xl text-green-600">{formatCurrency(invoice.paid_amount || 0)}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500">Balance Due</p>
                  <p className="font-medium text-xl text-amber-600">{formatCurrency(invoice.balance_due)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Payments */}
          <Card>
            <CardHeader>
              <CardTitle>Payments</CardTitle>
            </CardHeader>
            <CardContent>
              {invoice.payments && invoice.payments.length > 0 ? (
                <div className="space-y-3">
                  {invoice.payments.map((payment: any) => (
                    <div key={payment.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                      <div>
                        <p className="font-medium">{payment.payment_number}</p>
                        <p className="text-sm text-slate-500">{new Date(payment.payment_date).toLocaleDateString()}</p>
                      </div>
                      <p className="font-medium text-green-600">{formatCurrency(payment.amount)}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-slate-500">No payments recorded</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
