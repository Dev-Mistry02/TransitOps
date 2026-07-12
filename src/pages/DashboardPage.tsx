import { useEffect, useMemo, useState } from 'react';
import { Truck, CheckCircle, Wrench, Route, Users, Gauge, DollarSign, TrendingUp, Fuel, AlertTriangle, ArrowRight } from 'lucide-react';
import { supabase, type Vehicle, type Driver, type Trip, type Maintenance, type FuelLog, type Expense } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { formatCurrency, formatNumber, ROLE_LABELS } from '../lib/utils';
import { KpiCard, ChartCard, LineChart, BarChart, DonutChart } from '../components/charts';
import { Card, Spinner } from '../components/ui';

type DashboardData = {
  vehicles: Vehicle[];
  drivers: Driver[];
  trips: Trip[];
  maintenance: Maintenance[];
  fuelLogs: FuelLog[];
  expenses: Expense[];
};

export default function DashboardPage({ onNavigate }: { onNavigate: (path: string) => void }) {
  const { profile } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [v, d, t, m, f, e] = await Promise.all([
        supabase.from('vehicles').select('*'),
        supabase.from('drivers').select('*'),
        supabase.from('trips').select('*, vehicles:vehicle_id(registration_number,model), drivers:driver_id(name,license_number)'),
        supabase.from('maintenance').select('*, vehicles:vehicle_id(registration_number,model)'),
        supabase.from('fuel_logs').select('*, vehicles:vehicle_id(registration_number,model)'),
        supabase.from('expenses').select('*, vehicles:vehicle_id(registration_number,model)'),
      ]);
      setData({
        vehicles: v.data ?? [],
        drivers: d.data ?? [],
        trips: t.data ?? [],
        maintenance: m.data ?? [],
        fuelLogs: f.data ?? [],
        expenses: e.data ?? [],
      });
      setLoading(false);
    })();
  }, []);

  const stats = useMemo(() => {
    if (!data) return null;
    const activeVehicles = data.vehicles.filter((v) => v.status === 'on_trip').length;
    const availableVehicles = data.vehicles.filter((v) => v.status === 'available').length;
    const inMaintenance = data.vehicles.filter((v) => v.status === 'in_shop').length;
    const activeTrips = data.trips.filter((t) => t.status === 'dispatched').length;
    const pendingTrips = data.trips.filter((t) => t.status === 'pending').length;
    const driversOnDuty = data.drivers.filter((d) => d.status === 'on_trip').length;
    const totalVehicles = data.vehicles.length;
    const fleetUtilization = totalVehicles > 0 ? Math.round((activeVehicles / totalVehicles) * 100) : 0;

    const totalFuel = data.fuelLogs.reduce((s, f) => s + f.liters, 0);
    const totalFuelCost = data.fuelLogs.reduce((s, f) => s + f.cost, 0);
    const totalDistance = data.fuelLogs.length > 0
      ? Math.max(...data.fuelLogs.map((f) => f.odometer_reading)) - Math.min(...data.fuelLogs.map((f) => f.odometer_reading))
      : 0;
    const fuelEfficiency = totalFuel > 0 ? totalDistance / totalFuel : 0;

    const operationalCost = data.expenses.reduce((s, e) => s + e.amount, 0) + totalFuelCost;
    const revenue = data.trips.filter((t) => t.status === 'completed').reduce((s, t) => s + t.revenue, 0);
    const profit = revenue - operationalCost;

    const totalAcquisitionCost = data.vehicles.reduce((s, v) => s + v.acquisition_cost, 0);
    const vehicleRoi = totalAcquisitionCost > 0 ? Math.round((profit / totalAcquisitionCost) * 100) : 0;

    // Maintenance cost per month (last 6 months)
    const now = new Date();
    const maintTrend = Array.from({ length: 6 }, (_, i) => {
      const date = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
      const label = date.toLocaleString('en-US', { month: 'short' });
      const value = data.maintenance
        .filter((m) => {
          const md = new Date(m.start_date);
          return md.getMonth() === date.getMonth() && md.getFullYear() === date.getFullYear();
        })
        .reduce((s, m) => s + m.cost, 0);
      return { label, value };
    });

    // Fuel consumption per month (last 6 months)
    const fuelTrend = Array.from({ length: 6 }, (_, i) => {
      const date = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
      const label = date.toLocaleString('en-US', { month: 'short' });
      const value = data.fuelLogs
        .filter((f) => {
          const fd = new Date(f.date);
          return fd.getMonth() === date.getMonth() && fd.getFullYear() === date.getFullYear();
        })
        .reduce((s, f) => s + f.liters, 0);
      return { label, value };
    });

    // Revenue vs expenses per month
    const revenueTrend = Array.from({ length: 6 }, (_, i) => {
      const date = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
      const label = date.toLocaleString('en-US', { month: 'short' });
      const rev = data.trips
        .filter((t) => t.status === 'completed' && new Date(t.departure_time).getMonth() === date.getMonth() && new Date(t.departure_time).getFullYear() === date.getFullYear())
        .reduce((s, t) => s + t.revenue, 0);
      const exp = data.expenses
        .filter((e) => new Date(e.date).getMonth() === date.getMonth() && new Date(e.date).getFullYear() === date.getFullYear())
        .reduce((s, e) => s + e.amount, 0);
      return { label, value: rev - exp };
    });

    // Vehicle status distribution
    const vehicleStatusData = [
      { label: 'Available', value: availableVehicles, color: '#10b981' },
      { label: 'On Trip', value: activeVehicles, color: '#0ea5e9' },
      { label: 'In Shop', value: inMaintenance, color: '#f59e0b' },
      { label: 'Retired', value: data.vehicles.filter((v) => v.status === 'retired').length, color: '#64748b' },
    ];

    // Expense breakdown
    const expenseBreakdown = (['fuel', 'maintenance', 'salary', 'insurance', 'other'] as const).map((cat) => ({
      label: cat.charAt(0).toUpperCase() + cat.slice(1),
      value: data.expenses.filter((e) => e.category === cat).reduce((s, e) => s + e.amount, 0),
      color: { fuel: '#f59e0b', maintenance: '#ef4444', salary: '#8b5cf6', insurance: '#0ea5e9', other: '#64748b' }[cat],
    })).filter((e) => e.value > 0);

    // Alerts: expiring licenses, expiring insurance
    const expiringLicenses = data.drivers.filter((d) => {
      const diff = new Date(d.license_expiry).getTime() - Date.now();
      return diff < 30 * 24 * 60 * 60 * 1000;
    });
    const expiringInsurance = data.vehicles.filter((v) => {
      if (!v.insurance_expiry) return false;
      const diff = new Date(v.insurance_expiry).getTime() - Date.now();
      return diff < 30 * 24 * 60 * 60 * 1000;
    });

    return {
      activeVehicles, availableVehicles, inMaintenance, activeTrips, pendingTrips, driversOnDuty,
      fleetUtilization, fuelEfficiency, operationalCost, revenue, profit, vehicleRoi,
      maintTrend, fuelTrend, revenueTrend, vehicleStatusData, expenseBreakdown,
      expiringLicenses, expiringInsurance, totalVehicles,
    };
  }, [data]);

  if (loading || !stats || !data) {
    return (
      <div className="flex items-center justify-center py-24">
        <Spinner className="text-sky-500" />
      </div>
    );
  }

  const firstName = profile?.full_name?.split(' ')[0] ?? 'there';

  return (
    <div className="animate-fade-in">
      {/* Greeting */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
          Welcome back, {firstName}
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          You're signed in as <span className="font-semibold text-sky-600 dark:text-sky-400">{ROLE_LABELS[profile?.role ?? 'fleet_manager']}</span> — here's your fleet overview.
        </p>
      </div>

      {/* Alerts banner */}
      {(stats.expiringLicenses.length > 0 || stats.expiringInsurance.length > 0) && (
        <Card className="mb-6 p-4 border-amber-300/50 dark:border-amber-500/30 bg-amber-50/60 dark:bg-amber-500/5">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
            <div className="flex-1 text-sm">
              <p className="font-semibold text-amber-700 dark:text-amber-400">Compliance Alerts</p>
              <p className="text-amber-600 dark:text-amber-300/80 mt-1">
                {stats.expiringLicenses.length > 0 && `${stats.expiringLicenses.length} driver license(s) expiring within 30 days. `}
                {stats.expiringInsurance.length > 0 && `${stats.expiringInsurance.length} vehicle insurance policy(ies) expiring within 30 days.`}
              </p>
            </div>
            <button onClick={() => onNavigate('drivers')} className="text-xs font-semibold text-amber-700 dark:text-amber-400 hover:underline flex items-center gap-1">
              Review <ArrowRight className="h-3 w-3" />
            </button>
          </div>
        </Card>
      )}

      {/* KPI grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <KpiCard icon={Truck} label="Active Vehicles" value={formatNumber(stats.activeVehicles)} sub={`${stats.totalVehicles} total in fleet`} accent="sky" />
        <KpiCard icon={CheckCircle} label="Available Vehicles" value={formatNumber(stats.availableVehicles)} sub={`${stats.inMaintenance} in maintenance`} accent="emerald" />
        <KpiCard icon={Wrench} label="In Maintenance" value={formatNumber(stats.inMaintenance)} sub="Vehicles in shop" accent="amber" />
        <KpiCard icon={Route} label="Active Trips" value={formatNumber(stats.activeTrips)} sub={`${stats.pendingTrips} pending dispatch`} accent="violet" />
        <KpiCard icon={Users} label="Drivers On Duty" value={formatNumber(stats.driversOnDuty)} sub={`${data.drivers.length} total drivers`} accent="sky" />
        <KpiCard icon={Gauge} label="Fleet Utilization" value={`${stats.fleetUtilization}%`} sub="Active / total vehicles" accent="emerald" />
        <KpiCard icon={Fuel} label="Fuel Efficiency" value={`${stats.fuelEfficiency.toFixed(1)} km/L`} sub="Fleet average" accent="amber" />
        <KpiCard icon={DollarSign} label="Operational Cost" value={formatCurrency(stats.operationalCost)} sub="Total expenses" accent="red" />
        <KpiCard icon={TrendingUp} label="Revenue" value={formatCurrency(stats.revenue)} sub="Completed trips" accent="emerald" />
        <KpiCard icon={DollarSign} label="Profit" value={formatCurrency(stats.profit)} sub="Revenue - cost" accent={stats.profit >= 0 ? 'emerald' : 'red'} />
        <KpiCard icon={TrendingUp} label="Vehicle ROI" value={`${stats.vehicleRoi}%`} sub="Profit / acquisition cost" accent="violet" />
        <KpiCard icon={Wrench} label="Maintenance Cost" value={formatCurrency(stats.maintTrend.reduce((s, m) => s + m.value, 0))} sub="Last 6 months" accent="amber" />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <ChartCard title="Profit Trend" subtitle="Revenue minus expenses (last 6 months)">
          <LineChart data={stats.revenueTrend} color="#0ea5e9" formatY={(v) => formatCurrency(v).replace('.00', '')} />
        </ChartCard>
        <ChartCard title="Maintenance Cost Trend" subtitle="Monthly maintenance spend (last 6 months)">
          <BarChart data={stats.maintTrend} color="#f59e0b" formatY={(v) => formatCurrency(v).replace('.00', '')} />
        </ChartCard>
        <ChartCard title="Fuel Consumption" subtitle="Liters consumed per month">
          <LineChart data={stats.fuelTrend} color="#8b5cf6" formatY={(v) => `${Math.round(v)}L`} />
        </ChartCard>
        <ChartCard title="Vehicle Status Distribution" subtitle="Current fleet status breakdown">
          <div className="flex items-center justify-center py-2">
            <DonutChart data={stats.vehicleStatusData} size={170} />
          </div>
        </ChartCard>
      </div>

      {/* Expense breakdown + recent trips */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <ChartCard title="Expense Breakdown" subtitle="By category">
          <div className="flex items-center justify-center py-4">
            <DonutChart data={stats.expenseBreakdown.length > 0 ? stats.expenseBreakdown : [{ label: 'None', value: 1, color: '#cbd5e1' }]} size={170} />
          </div>
        </ChartCard>
        <div className="lg:col-span-2">
          <ChartCard title="Recent Trips" subtitle="Latest fleet activity" action={
            <button onClick={() => onNavigate('trips')} className="text-xs font-semibold text-sky-600 dark:text-sky-400 hover:underline flex items-center gap-1">
              View all <ArrowRight className="h-3 w-3" />
            </button>
          }>
            <div className="space-y-2">
              {data.trips.slice(0, 5).map((trip) => (
                <div key={trip.id} className="flex items-center justify-between rounded-lg px-3 py-2.5 bg-slate-50/60 dark:bg-slate-800/40">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-9 w-9 rounded-lg bg-sky-500/15 flex items-center justify-center shrink-0">
                      <Route className="h-4 w-4 text-sky-500" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">{trip.origin} → {trip.destination}</p>
                      <p className="text-xs text-slate-400 truncate">
                        {trip.vehicles?.registration_number ?? '—'} · {trip.drivers?.name ?? '—'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">{formatCurrency(trip.revenue)}</span>
                    <span className={`badge ${trip.status === 'completed' ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' : trip.status === 'dispatched' ? 'bg-sky-500/15 text-sky-600 dark:text-sky-400' : trip.status === 'pending' ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400' : 'bg-red-500/15 text-red-600 dark:text-red-400'}`}>
                      {trip.status}
                    </span>
                  </div>
                </div>
              ))}
              {data.trips.length === 0 && <p className="text-sm text-slate-400 text-center py-8">No trips yet</p>}
            </div>
          </ChartCard>
        </div>
      </div>
    </div>
  );
}
