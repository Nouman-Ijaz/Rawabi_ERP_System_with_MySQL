import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { vehiclesApi } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

export default function VehicleDetail() {
  const { id } = useParams<{ id: string }>();
  const [vehicle, setVehicle] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (id) {
      loadVehicle();
    }
  }, [id]);

  const loadVehicle = async () => {
    try {
      const data = await vehiclesApi.getById(parseInt(id!));
      setVehicle(data);
    } catch (error) {
      toast.error('Failed to load vehicle details');
    } finally {
      setIsLoading(false);
    }
  };

  function getStatusColor(status: string) {
    const colors: Record<string, string> = {
      active: 'bg-green-100 text-green-800',
      maintenance: 'bg-yellow-100 text-yellow-800',
      retired: 'bg-gray-100 text-gray-800',
      sold: 'bg-blue-100 text-blue-800',
      accident: 'bg-red-100 text-red-800',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!vehicle) {
    return (
      <div className="text-center py-12">
        <h3 className="text-lg font-medium text-slate-900">Vehicle not found</h3>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-900">{vehicle.plate_number}</h1>
            <Badge className={getStatusColor(vehicle.status)}>{vehicle.status}</Badge>
          </div>
          <p className="text-slate-500">{vehicle.vehicle_code}</p>
        </div>
        <Link to="/vehicles">
          <Button variant="outline">Back to Vehicles</Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Vehicle Information</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-slate-500">Vehicle Type</p>
                <p className="font-medium">{vehicle.vehicle_type}</p>
              </div>
              <div>
                <p className="text-sm text-slate-500">Brand/Model</p>
                <p className="font-medium">{vehicle.brand} {vehicle.model}</p>
              </div>
              <div>
                <p className="text-sm text-slate-500">Year</p>
                <p className="font-medium">{vehicle.year}</p>
              </div>
              <div>
                <p className="text-sm text-slate-500">Capacity</p>
                <p className="font-medium">{vehicle.capacity_kg?.toLocaleString()} kg</p>
              </div>
              <div>
                <p className="text-sm text-slate-500">Trailer Type</p>
                <p className="font-medium">{vehicle.trailer_type || '-'}</p>
              </div>
              <div>
                <p className="text-sm text-slate-500">Total KM</p>
                <p className="font-medium">{vehicle.total_km?.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-sm text-slate-500">Registration Expiry</p>
                <p className="font-medium">{vehicle.registration_expiry ? new Date(vehicle.registration_expiry).toLocaleDateString() : '-'}</p>
              </div>
              <div>
                <p className="text-sm text-slate-500">Insurance Expiry</p>
                <p className="font-medium">{vehicle.insurance_expiry ? new Date(vehicle.insurance_expiry).toLocaleDateString() : '-'}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Current Driver</CardTitle>
          </CardHeader>
          <CardContent>
            {vehicle.driver_name ? (
              <div>
                <p className="font-medium">{vehicle.driver_name}</p>
                <p className="text-sm text-slate-500">License: {vehicle.license_number}</p>
                <p className="text-sm text-slate-500">Status: {vehicle.driver_status}</p>
              </div>
            ) : (
              <p className="text-slate-500">No driver assigned</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Maintenance History */}
      <Card>
        <CardHeader>
          <CardTitle>Maintenance History</CardTitle>
        </CardHeader>
        <CardContent>
          {vehicle.maintenance && vehicle.maintenance.length > 0 ? (
            <div className="space-y-3">
              {vehicle.maintenance.map((record: any) => (
                <div key={record.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                  <div>
                    <p className="font-medium">{record.maintenance_type.replace('_', ' ')}</p>
                    <p className="text-sm text-slate-500">{record.description}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium">{new Date(record.service_date).toLocaleDateString()}</p>
                    <p className="text-sm text-slate-500">SAR {record.cost?.toLocaleString()}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-slate-500">No maintenance records</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
