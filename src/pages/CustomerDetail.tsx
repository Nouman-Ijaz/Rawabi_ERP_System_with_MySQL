import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { customersApi } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

function getStatusColor(status: string) {
  const colors: Record<string, string> = {
    active: 'bg-green-100 text-green-800',
    inactive: 'bg-gray-100 text-gray-800',
    suspended: 'bg-red-100 text-red-800',
  };
  return colors[status] || 'bg-gray-100 text-gray-800';
}

function getTypeColor(type: string) {
  const colors: Record<string, string> = {
    regular: 'bg-blue-100 text-blue-800',
    vip: 'bg-purple-100 text-purple-800',
    corporate: 'bg-indigo-100 text-indigo-800',
    government: 'bg-amber-100 text-amber-800',
  };
  return colors[type] || 'bg-gray-100 text-gray-800';
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-SA', {
    style: 'currency',
    currency: 'SAR',
  }).format(amount || 0);
}

export default function CustomerDetail() {
  const { id } = useParams<{ id: string }>();
  const [customer, setCustomer] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (id) {
      loadCustomer();
    }
  }, [id]);

  const loadCustomer = async () => {
    try {
      const data = await customersApi.getById(parseInt(id!));
      setCustomer(data);
    } catch (error) {
      toast.error('Failed to load customer details');
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

  if (!customer) {
    return (
      <div className="text-center py-12">
        <h3 className="text-lg font-medium text-slate-900">Customer not found</h3>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-900">{customer.company_name}</h1>
            <Badge className={getTypeColor(customer.customer_type)}>{customer.customer_type}</Badge>
            <Badge className={getStatusColor(customer.status)}>{customer.status}</Badge>
          </div>
          <p className="text-slate-500">{customer.customer_code}</p>
        </div>
        <Link to="/customers">
          <Button variant="outline">Back to Customers</Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Company Information</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-slate-500">Contact Person</p>
                <p className="font-medium">{customer.contact_person || '-'}</p>
              </div>
              <div>
                <p className="text-sm text-slate-500">Email</p>
                <p className="font-medium">{customer.email || '-'}</p>
              </div>
              <div>
                <p className="text-sm text-slate-500">Phone</p>
                <p className="font-medium">{customer.phone || '-'}</p>
              </div>
              <div>
                <p className="text-sm text-slate-500">Mobile</p>
                <p className="font-medium">{customer.mobile || '-'}</p>
              </div>
              <div>
                <p className="text-sm text-slate-500">Address</p>
                <p className="font-medium">{customer.address || '-'}</p>
              </div>
              <div>
                <p className="text-sm text-slate-500">City/Country</p>
                <p className="font-medium">{customer.city}, {customer.country}</p>
              </div>
              <div>
                <p className="text-sm text-slate-500">Tax/VAT Number</p>
                <p className="font-medium">{customer.tax_number || '-'}</p>
              </div>
              <div>
                <p className="text-sm text-slate-500">CR Number</p>
                <p className="font-medium">{customer.cr_number || '-'}</p>
              </div>
              <div>
                <p className="text-sm text-slate-500">Credit Limit</p>
                <p className="font-medium">{formatCurrency(customer.credit_limit)}</p>
              </div>
              <div>
                <p className="text-sm text-slate-500">Payment Terms</p>
                <p className="font-medium">{customer.payment_terms} days</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Statistics</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div>
                <p className="text-sm text-slate-500">Total Shipments</p>
                <p className="font-medium text-2xl">{customer.stats?.total_shipments || 0}</p>
              </div>
              <div>
                <p className="text-sm text-slate-500">Completed Shipments</p>
                <p className="font-medium text-2xl">{customer.stats?.completed_shipments || 0}</p>
              </div>
              <div>
                <p className="text-sm text-slate-500">Total Revenue</p>
                <p className="font-medium text-2xl text-green-600">{formatCurrency(customer.stats?.total_revenue || 0)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Shipments */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Shipments</CardTitle>
        </CardHeader>
        <CardContent>
          {customer.shipments && customer.shipments.length > 0 ? (
            <div className="space-y-3">
              {customer.shipments.slice(0, 5).map((shipment: any) => (
                <div key={shipment.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                  <div>
                    <p className="font-medium">{shipment.shipment_number}</p>
                    <p className="text-sm text-slate-500">{shipment.origin_city} → {shipment.destination_city}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium">{shipment.cargo_type}</p>
                    <p className="text-sm text-slate-500">{shipment.status}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-slate-500">No shipments</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
