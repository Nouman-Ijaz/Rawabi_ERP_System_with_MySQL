import { useEffect, useState } from 'react';
import { maintenanceApi } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

interface MaintenanceRecord {
  id: number;
  vehicle_plate: string;
  vehicle_type: string;
  maintenance_type: string;
  service_date: string;
  description: string;
  service_provider?: string;
  cost?: number;
  status: string;
  next_service_date?: string;
  next_service_km?: number;
}

function getStatusColor(status: string) {
  const colors: Record<string, string> = {
    scheduled: 'bg-blue-100 text-blue-800',
    in_progress: 'bg-yellow-100 text-yellow-800',
    completed: 'bg-green-100 text-green-800',
    cancelled: 'bg-gray-100 text-gray-800',
  };
  return colors[status] || 'bg-gray-100 text-gray-800';
}

function getTypeColor(type: string) {
  const colors: Record<string, string> = {
    routine: 'bg-blue-100 text-blue-800',
    repair: 'bg-red-100 text-red-800',
    inspection: 'bg-purple-100 text-purple-800',
    tire_change: 'bg-orange-100 text-orange-800',
    oil_change: 'bg-green-100 text-green-800',
    other: 'bg-gray-100 text-gray-800',
  };
  return colors[type] || 'bg-gray-100 text-gray-800';
}

function WrenchIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg {...props} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}

function formatCurrency(amount?: number) {
  if (!amount) return '-';
  return new Intl.NumberFormat('en-SA', {
    style: 'currency',
    currency: 'SAR',
  }).format(amount);
}

export default function Maintenance() {
  const [records, setRecords] = useState<MaintenanceRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadMaintenance();
  }, []);

  const loadMaintenance = async () => {
    try {
      const data = await maintenanceApi.getAll();
      setRecords(data);
    } catch (error) {
      toast.error('Failed to load maintenance records');
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
          <h1 className="text-2xl font-bold text-slate-900">Maintenance</h1>
          <p className="text-slate-500">Track vehicle maintenance and service records</p>
        </div>
      </div>

      <div className="space-y-4">
        {records.map((record) => (
          <Card key={record.id}>
            <CardContent className="p-6">
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <WrenchIcon className="w-6 h-6 text-orange-600" />
                  </div>
                  <div>
                    <div className="flex items-center gap-3">
                      <h3 className="font-semibold text-lg text-slate-900">{record.vehicle_plate}</h3>
                      <Badge className={getTypeColor(record.maintenance_type)}>
                        {record.maintenance_type.replace('_', ' ')}
                      </Badge>
                      <Badge className={getStatusColor(record.status)}>
                        {record.status.replace('_', ' ')}
                      </Badge>
                    </div>
                    <p className="text-sm text-slate-500">{record.description}</p>
                    <p className="text-sm text-slate-400">{record.vehicle_type}</p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-4 lg:gap-8">
                  <div className="text-center">
                    <p className="text-xs text-slate-500">Service Date</p>
                    <p className="font-medium">{new Date(record.service_date).toLocaleDateString()}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-slate-500">Cost</p>
                    <p className="font-medium">{formatCurrency(record.cost)}</p>
                  </div>
                  {record.service_provider && (
                    <div className="text-center">
                      <p className="text-xs text-slate-500">Provider</p>
                      <p className="font-medium">{record.service_provider}</p>
                    </div>
                  )}
                  {record.next_service_date && (
                    <div className="text-center">
                      <p className="text-xs text-slate-500">Next Service</p>
                      <p className="font-medium">{new Date(record.next_service_date).toLocaleDateString()}</p>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {records.length === 0 && (
        <div className="text-center py-12">
          <WrenchIcon className="w-16 h-16 mx-auto text-slate-300 mb-4" />
          <h3 className="text-lg font-medium text-slate-900">No maintenance records found</h3>
          <p className="text-slate-500">Add maintenance records to track vehicle service history</p>
        </div>
      )}
    </div>
  );
}
