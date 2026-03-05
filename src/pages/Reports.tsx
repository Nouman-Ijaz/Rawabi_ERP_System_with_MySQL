import { useEffect, useState } from 'react';
import { financeApi, shipmentsApi } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-SA', {
    style: 'currency',
    currency: 'SAR',
  }).format(amount || 0);
}

function BarChartIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg {...props} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
  );
}

export default function Reports() {
  const [financialSummary, setFinancialSummary] = useState<any>(null);
  const [shipmentStats, setShipmentStats] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadReports();
  }, []);

  const loadReports = async () => {
    try {
      const [financeData, shipmentData] = await Promise.all([
        financeApi.getFinancialSummary('month'),
        shipmentsApi.getStats(),
      ]);
      setFinancialSummary(financeData);
      setShipmentStats(shipmentData);
    } catch (error) {
      toast.error('Failed to load reports');
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
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Reports & Analytics</h1>
        <p className="text-slate-500">View business performance and analytics</p>
      </div>

      {/* Financial Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500">Total Invoiced</p>
                <p className="text-2xl font-bold text-slate-900">
                  {formatCurrency(financialSummary?.revenue?.total_invoiced || 0)}
                </p>
              </div>
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <BarChartIcon className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500">Total Collected</p>
                <p className="text-2xl font-bold text-green-600">
                  {formatCurrency(financialSummary?.revenue?.total_collected || 0)}
                </p>
              </div>
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <BarChartIcon className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500">Outstanding</p>
                <p className="text-2xl font-bold text-amber-600">
                  {formatCurrency(financialSummary?.revenue?.total_outstanding || 0)}
                </p>
              </div>
              <div className="w-12 h-12 bg-amber-100 rounded-lg flex items-center justify-center">
                <BarChartIcon className="w-6 h-6 text-amber-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Shipment Statistics */}
      <Card>
        <CardHeader>
          <CardTitle>Shipment Statistics</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {shipmentStats?.byStatus?.map((item: any) => (
              <div key={item.status} className="text-center p-4 bg-slate-50 rounded-lg">
                <p className="text-3xl font-bold text-slate-900">{item.count}</p>
                <p className="text-sm text-slate-500 capitalize">{item.status.replace('_', ' ')}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Top Routes */}
      <Card>
        <CardHeader>
          <CardTitle>Top Routes</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {shipmentStats?.topRoutes?.map((route: any, index: number) => (
              <div key={index} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                <span className="font-medium">{route.route}</span>
                <span className="text-slate-500">{route.count} shipments</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Aged Receivables */}
      <Card>
        <CardHeader>
          <CardTitle>Aged Receivables</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {financialSummary?.agedReceivables?.map((item: any, index: number) => (
              <div key={index} className="text-center p-4 bg-slate-50 rounded-lg">
                <p className="text-lg font-bold text-slate-900">{formatCurrency(item.amount)}</p>
                <p className="text-sm text-slate-500">{item.aging_bucket}</p>
                <p className="text-xs text-slate-400">{item.invoice_count} invoices</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
