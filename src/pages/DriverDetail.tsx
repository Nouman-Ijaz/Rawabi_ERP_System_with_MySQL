import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { driversApi } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

export default function DriverDetail() {
  const { id } = useParams<{ id: string }>();
  const [driver, setDriver] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (id) {
      loadDriver();
    }
  }, [id]);

  const loadDriver = async () => {
    try {
      const data = await driversApi.getById(parseInt(id!));
      setDriver(data);
    } catch (error) {
      toast.error('Failed to load driver details');
    } finally {
      setIsLoading(false);
    }
  };

  function getStatusColor(status: string) {
    const colors: Record<string, string> = {
      available: 'bg-green-100 text-green-800',
      on_trip: 'bg-blue-100 text-blue-800',
      on_leave: 'bg-yellow-100 text-yellow-800',
      suspended: 'bg-red-100 text-red-800',
      off_duty: 'bg-gray-100 text-gray-800',
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

  if (!driver) {
    return (
      <div className="text-center py-12">
        <h3 className="text-lg font-medium text-slate-900">Driver not found</h3>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-900">{driver.first_name} {driver.last_name}</h1>
            <Badge className={getStatusColor(driver.status)}>{driver.status.replace('_', ' ')}</Badge>
          </div>
          <p className="text-slate-500">{driver.employee_code}</p>
        </div>
        <Link to="/drivers">
          <Button variant="outline">Back to Drivers</Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Driver Information</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-slate-500">Email</p>
                <p className="font-medium">{driver.email || '-'}</p>
              </div>
              <div>
                <p className="text-sm text-slate-500">Phone</p>
                <p className="font-medium">{driver.phone || '-'}</p>
              </div>
              <div>
                <p className="text-sm text-slate-500">Nationality</p>
                <p className="font-medium">{driver.nationality || '-'}</p>
              </div>
              <div>
                <p className="text-sm text-slate-500">Hire Date</p>
                <p className="font-medium">{driver.hire_date ? new Date(driver.hire_date).toLocaleDateString() : '-'}</p>
              </div>
              <div>
                <p className="text-sm text-slate-500">License Number</p>
                <p className="font-medium">{driver.license_number}</p>
              </div>
              <div>
                <p className="text-sm text-slate-500">License Type</p>
                <p className="font-medium capitalize">{driver.license_type}</p>
              </div>
              <div>
                <p className="text-sm text-slate-500">License Expiry</p>
                <p className="font-medium">{driver.license_expiry ? new Date(driver.license_expiry).toLocaleDateString() : '-'}</p>
              </div>
              <div>
                <p className="text-sm text-slate-500">Experience</p>
                <p className="font-medium">{driver.years_of_experience} years</p>
              </div>
              <div>
                <p className="text-sm text-slate-500">Rating</p>
                <p className="font-medium">{driver.rating} / 5</p>
              </div>
              <div>
                <p className="text-sm text-slate-500">Total Trips</p>
                <p className="font-medium">{driver.total_trips}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Current Vehicle</CardTitle>
          </CardHeader>
          <CardContent>
            {driver.assigned_vehicle_plate ? (
              <div>
                <p className="font-medium">{driver.assigned_vehicle_plate}</p>
                <p className="text-sm text-slate-500">{driver.assigned_vehicle_type}</p>
              </div>
            ) : (
              <p className="text-slate-500">No vehicle assigned</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Trip History */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Trips</CardTitle>
        </CardHeader>
        <CardContent>
          {driver.trips && driver.trips.length > 0 ? (
            <div className="space-y-3">
              {driver.trips.slice(0, 5).map((trip: any) => (
                <div key={trip.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                  <div>
                    <p className="font-medium">{trip.shipment_number}</p>
                    <p className="text-sm text-slate-500">{trip.customer_name}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium">{trip.origin_city} → {trip.destination_city}</p>
                    <p className="text-sm text-slate-500">{trip.status}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-slate-500">No trip history</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
