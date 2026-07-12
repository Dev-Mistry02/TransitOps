import { useEffect, useMemo, useState } from 'react';
import { Route, Plus, Search, Download, ArrowUpDown, Play, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import { supabase, type Trip, type Vehicle, type Driver } from '../lib/supabase';
import { useToast } from '../lib/toast';
import { exportToCSV, exportToPDF, formatCurrency, formatDateTime } from '../lib/utils';
import { Card, PageHeader, Modal, EmptyState, Badge, Spinner } from '../components/ui';

type SortKey = 'origin' | 'destination' | 'status' | 'revenue' | 'departure_time';

export default function TripsPage() {
  const { toast } = useToast();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortKey, setSortKey] = useState<SortKey>('departure_time');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);
  const pageSize = 8;

  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    vehicle_id: '',
    driver_id: '',
    origin: '',
    destination: '',
    cargo_weight: '',
    departure_time: '',
    revenue: '',
    notes: '',
  });

  const fetchAll = async () => {
    setLoading(true);
    const [t, v, d] = await Promise.all([
      supabase.from('trips').select('*, vehicles:vehicle_id(registration_number,model), drivers:driver_id(name,license_number)').order('created_at', { ascending: false }),
      supabase.from('vehicles').select('*'),
      supabase.from('drivers').select('*'),
    ]);
    setTrips(t.data ?? []);
    setVehicles(v.data ?? []);
    setDrivers(d.data ?? []);
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, []);

  // Business rules: which vehicles/drivers are selectable
  const availableVehicles = vehicles.filter((v) => v.status === 'available');
  const availableDrivers = drivers.filter((d) => {
    const expDays = new Date(d.license_expiry).getTime() - Date.now();
    return d.status === 'available' && expDays > 0;
  });

  const filtered = useMemo(() => {
    let result = trips.filter((t) => {
      const matchSearch = !search || t.origin.toLowerCase().includes(search.toLowerCase()) || t.destination.toLowerCase().includes(search.toLowerCase()) || (t.vehicles?.registration_number ?? '').toLowerCase().includes(search.toLowerCase());
      const matchStatus = statusFilter === 'all' || t.status === statusFilter;
      return matchSearch && matchStatus;
    });
    result = [...result].sort((a, b) => {
      let av: string | number = a[sortKey];
      let bv: string | number = b[sortKey];
      if (typeof av === 'string') av = av.toLowerCase();
      if (typeof bv === 'string') bv = bv.toLowerCase();
      if (av < bv) return sortDir === 'asc' ? -1 : 1;
      if (av > bv) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
    return result;
  }, [trips, search, statusFilter, sortKey, sortDir]);

  const totalPages = Math.ceil(filtered.length / pageSize) || 1;
  const paged = filtered.slice((page - 1) * pageSize, page * pageSize);

  const openCreate = () => {
    setForm({ vehicle_id: '', driver_id: '', origin: '', destination: '', cargo_weight: '', departure_time: '', revenue: '', notes: '' });
    setModalOpen(true);
  };

  const validateTrip = (): string | null => {
    if (!form.vehicle_id) return 'Please select a vehicle';
    if (!form.driver_id) return 'Please select a driver';
    if (!form.origin || !form.destination) return 'Origin and destination are required';
    if (!form.departure_time) return 'Departure time is required';
    const vehicle = vehicles.find((v) => v.id === form.vehicle_id);
    const driver = drivers.find((d) => d.id === form.driver_id);
    if (!vehicle) return 'Vehicle not found';
    if (!driver) return 'Driver not found';
    if (vehicle.status === 'retired') return 'Retired vehicles cannot be assigned to trips';
    if (vehicle.status === 'in_shop') return 'Vehicles in shop cannot be assigned to trips';
    if (vehicle.status !== 'available') return 'Only available vehicles can be assigned';
    if (driver.status === 'suspended') return 'Suspended drivers cannot be assigned to trips';
    if (driver.status !== 'available') return 'Only available drivers can be assigned';
    const expDays = new Date(driver.license_expiry).getTime() - Date.now();
    if (expDays <= 0) return 'Drivers with expired licenses cannot be assigned to trips';
    const cargo = Number(form.cargo_weight) || 0;
    if (cargo > vehicle.load_capacity) return `Cargo weight (${cargo} kg) exceeds vehicle capacity (${vehicle.load_capacity} kg)`;
    return null;
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const err = validateTrip();
    if (err) { toast(err, 'warning'); return; }
    setSaving(true);
    try {
      const payload = {
        vehicle_id: form.vehicle_id,
        driver_id: form.driver_id,
        origin: form.origin,
        destination: form.destination,
        cargo_weight: Number(form.cargo_weight) || 0,
        departure_time: new Date(form.departure_time).toISOString(),
        status: 'pending' as Trip['status'],
        revenue: Number(form.revenue) || 0,
        notes: form.notes || null,
      };
      const { error } = await supabase.from('trips').insert(payload);
      if (error) throw error;
      toast('Trip created', 'success');
      setModalOpen(false);
      fetchAll();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Create failed';
      toast(msg, 'error');
    } finally {
      setSaving(false);
    }
  };

  // Dispatch: change status to dispatched, set vehicle+driver to on_trip
  const handleDispatch = async (trip: Trip) => {
    if (!trip.vehicle_id || !trip.driver_id) { toast('Trip is missing vehicle or driver', 'error'); return; }
    try {
      const { error: tErr } = await supabase.from('trips').update({ status: 'dispatched' }).eq('id', trip.id);
      if (tErr) throw tErr;
      await supabase.from('vehicles').update({ status: 'on_trip' }).eq('id', trip.vehicle_id);
      await supabase.from('drivers').update({ status: 'on_trip' }).eq('id', trip.driver_id);
      toast('Trip dispatched — vehicle and driver are now on trip', 'success');
      fetchAll();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Dispatch failed';
      toast(msg, 'error');
    }
  };

  // Complete: set status to completed, set arrival time, restore vehicle+driver to available
  const handleComplete = async (trip: Trip) => {
    if (!trip.vehicle_id || !trip.driver_id) { toast('Trip is missing vehicle or driver', 'error'); return; }
    try {
      const { error: tErr } = await supabase.from('trips').update({ status: 'completed', arrival_time: new Date().toISOString() }).eq('id', trip.id);
      if (tErr) throw tErr;
      await supabase.from('vehicles').update({ status: 'available' }).eq('id', trip.vehicle_id);
      await supabase.from('drivers').update({ status: 'available' }).eq('id', trip.driver_id);
      toast('Trip completed — vehicle and driver are available again', 'success');
      fetchAll();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Complete failed';
      toast(msg, 'error');
    }
  };

  // Cancel: set status to cancelled, restore vehicle+driver to available
  const handleCancel = async (trip: Trip) => {
    if (!trip.vehicle_id || !trip.driver_id) { toast('Trip is missing vehicle or driver', 'error'); return; }
    try {
      const { error: tErr } = await supabase.from('trips').update({ status: 'cancelled' }).eq('id', trip.id);
      if (tErr) throw tErr;
      await supabase.from('vehicles').update({ status: 'available' }).eq('id', trip.vehicle_id);
      await supabase.from('drivers').update({ status: 'available' }).eq('id', trip.driver_id);
      toast('Trip cancelled — vehicle and driver are available again', 'success');
      fetchAll();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Cancel failed';
      toast(msg, 'error');
    }
  };

  const handleExportCSV = () => {
    exportToCSV('trips.csv', filtered.map((t) => ({
      Origin: t.origin, Destination: t.destination, Vehicle: t.vehicles?.registration_number ?? '',
      Driver: t.drivers?.name ?? '', Cargo: t.cargo_weight, Status: t.status,
      Revenue: t.revenue, Departure: t.departure_time, Arrival: t.arrival_time ?? '',
    })));
    toast('CSV exported', 'success');
  };

  const handleExportPDF = () => {
    exportToPDF('Trips Report', filtered.map((t) => ({
      Origin: t.origin, Destination: t.destination, Vehicle: t.vehicles?.registration_number ?? '—',
      Driver: t.drivers?.name ?? '—', Status: t.status, Revenue: formatCurrency(t.revenue),
    })));
    toast('PDF exported', 'success');
  };

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  };

  const selectedVehicle = vehicles.find((v) => v.id === form.vehicle_id);

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Trips"
        subtitle={`${trips.length} trips · ${trips.filter((t) => t.status === 'dispatched').length} active`}
        action={
          <>
            <button onClick={handleExportCSV} className="btn-secondary"><Download className="h-4 w-4" /> CSV</button>
            <button onClick={handleExportPDF} className="btn-secondary"><Download className="h-4 w-4" /> PDF</button>
            <button onClick={openCreate} className="btn-primary"><Plus className="h-4 w-4" /> New Trip</button>
          </>
        }
      />

      <Card className="p-4 mb-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input type="text" placeholder="Search by origin, destination, or vehicle…" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} className="glass-input pl-10" />
          </div>
          <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }} className="glass-input w-auto">
            <option value="all">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="dispatched">Dispatched</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
      </Card>

      <Card className="overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-16"><Spinner className="text-sky-500" /></div>
        ) : paged.length === 0 ? (
          <EmptyState icon={Route} title="No trips found" subtitle="Create a new trip to get started" />
        ) : (
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200/60 dark:border-slate-700/50 text-left text-xs uppercase tracking-wide text-slate-400">
                  <th className="px-4 py-3 cursor-pointer" onClick={() => toggleSort('origin')}><span className="flex items-center gap-1">Route <ArrowUpDown className="h-3 w-3" /></span></th>
                  <th className="px-4 py-3">Vehicle</th>
                  <th className="px-4 py-3">Driver</th>
                  <th className="px-4 py-3 text-right">Cargo</th>
                  <th className="px-4 py-3 cursor-pointer" onClick={() => toggleSort('departure_time')}>Departure</th>
                  <th className="px-4 py-3 text-right cursor-pointer" onClick={() => toggleSort('revenue')}>Revenue</th>
                  <th className="px-4 py-3 cursor-pointer" onClick={() => toggleSort('status')}>Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {paged.map((trip) => (
                  <tr key={trip.id} className="border-b border-slate-100/60 dark:border-slate-800/50 hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition">
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-800 dark:text-slate-100">{trip.origin}</div>
                      <div className="text-xs text-slate-400">→ {trip.destination}</div>
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{trip.vehicles?.registration_number ?? '—'}</td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{trip.drivers?.name ?? '—'}</td>
                    <td className="px-4 py-3 text-right text-slate-600 dark:text-slate-300">{trip.cargo_weight} kg</td>
                    <td className="px-4 py-3 text-xs text-slate-500">{formatDateTime(trip.departure_time)}</td>
                    <td className="px-4 py-3 text-right font-semibold text-slate-700 dark:text-slate-200">{formatCurrency(trip.revenue)}</td>
                    <td className="px-4 py-3"><Badge status={trip.status} /></td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        {trip.status === 'pending' && (
                          <button onClick={() => handleDispatch(trip)} className="btn-secondary px-2.5 py-1.5 text-xs" title="Dispatch trip"><Play className="h-3.5 w-3.5" /> Dispatch</button>
                        )}
                        {trip.status === 'dispatched' && (
                          <>
                            <button onClick={() => handleComplete(trip)} className="btn-secondary px-2.5 py-1.5 text-xs text-emerald-600" title="Complete trip"><CheckCircle className="h-3.5 w-3.5" /> Complete</button>
                            <button onClick={() => handleCancel(trip)} className="btn-secondary px-2.5 py-1.5 text-xs text-red-500" title="Cancel trip"><XCircle className="h-3.5 w-3.5" /></button>
                          </>
                        )}
                        {(trip.status === 'completed' || trip.status === 'cancelled') && (
                          <span className="text-xs text-slate-400">—</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {!loading && filtered.length > 0 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200/60 dark:border-slate-700/50">
            <p className="text-xs text-slate-400">Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, filtered.length)} of {filtered.length}</p>
            <div className="flex gap-1">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="btn-secondary px-3 py-1.5 text-xs disabled:opacity-50">Prev</button>
              <span className="px-3 py-1.5 text-xs text-slate-500">{page} / {totalPages}</span>
              <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="btn-secondary px-3 py-1.5 text-xs disabled:opacity-50">Next</button>
            </div>
          </div>
        )}
      </Card>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="New Trip" size="lg">
        <form onSubmit={handleCreate} className="space-y-4">
          {availableVehicles.length === 0 || availableDrivers.length === 0 ? (
            <div className="flex items-start gap-3 rounded-lg border border-amber-300/50 dark:border-amber-500/30 bg-amber-50/60 dark:bg-amber-500/5 p-4">
              <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
              <p className="text-sm text-amber-700 dark:text-amber-400">
                {availableVehicles.length === 0 && 'No available vehicles. '}
                {availableDrivers.length === 0 && 'No available drivers (with valid licenses). '}
                Please add or free up vehicles and drivers before creating a trip.
              </p>
            </div>
          ) : null}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="glass-label">Vehicle *</label>
              <select required value={form.vehicle_id} onChange={(e) => setForm({ ...form, vehicle_id: e.target.value })} className="glass-input">
                <option value="">Select vehicle…</option>
                {availableVehicles.map((v) => (
                  <option key={v.id} value={v.id}>{v.registration_number} — {v.model} ({v.load_capacity} kg)</option>
                ))}
              </select>
            </div>
            <div>
              <label className="glass-label">Driver *</label>
              <select required value={form.driver_id} onChange={(e) => setForm({ ...form, driver_id: e.target.value })} className="glass-input">
                <option value="">Select driver…</option>
                {availableDrivers.map((d) => (
                  <option key={d.id} value={d.id}>{d.name} — {d.license_number}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="glass-label">Origin *</label>
              <input type="text" required value={form.origin} onChange={(e) => setForm({ ...form, origin: e.target.value })} className="glass-input" placeholder="New York, NY" />
            </div>
            <div>
              <label className="glass-label">Destination *</label>
              <input type="text" required value={form.destination} onChange={(e) => setForm({ ...form, destination: e.target.value })} className="glass-input" placeholder="Boston, MA" />
            </div>
            <div>
              <label className="glass-label">Cargo Weight (kg)</label>
              <input type="number" min="0" value={form.cargo_weight} onChange={(e) => setForm({ ...form, cargo_weight: e.target.value })} className="glass-input" placeholder="22000" />
              {selectedVehicle && (
                <p className="text-xs text-slate-400 mt-1">Max capacity: {selectedVehicle.load_capacity} kg</p>
              )}
            </div>
            <div>
              <label className="glass-label">Departure Time *</label>
              <input type="datetime-local" required value={form.departure_time} onChange={(e) => setForm({ ...form, departure_time: e.target.value })} className="glass-input" />
            </div>
            <div>
              <label className="glass-label">Revenue ($)</label>
              <input type="number" min="0" value={form.revenue} onChange={(e) => setForm({ ...form, revenue: e.target.value })} className="glass-input" placeholder="4200" />
            </div>
            <div className="sm:col-span-2">
              <label className="glass-label">Notes</label>
              <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="glass-input" rows={2} placeholder="Standard freight delivery" />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setModalOpen(false)} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary">{saving ? <Spinner className="h-4 w-4" /> : 'Create Trip'}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
