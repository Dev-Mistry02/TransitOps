import { useEffect, useMemo, useState } from 'react';
import { Wrench, Plus, Search, Download, ArrowUpDown, CheckCircle, Clock } from 'lucide-react';
import { supabase, type Maintenance, type Vehicle } from '../lib/supabase';
import { useToast } from '../lib/toast';
import { exportToCSV, exportToPDF, formatCurrency, formatDateTime } from '../lib/utils';
import { Card, PageHeader, Modal, ConfirmDialog, EmptyState, Badge, Spinner } from '../components/ui';

type SortKey = 'service_type' | 'cost' | 'status' | 'start_date';

export default function MaintenancePage() {
  const { toast } = useToast();
  const [records, setRecords] = useState<Maintenance[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortKey, setSortKey] = useState<SortKey>('start_date');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);
  const pageSize = 8;

  const [modalOpen, setModalOpen] = useState(false);
  const [closing, setClosing] = useState<Maintenance | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    vehicle_id: '', service_type: '', description: '', cost: '', start_date: '',
  });

  const fetchAll = async () => {
    setLoading(true);
    const [m, v] = await Promise.all([
      supabase.from('maintenance').select('*, vehicles:vehicle_id(registration_number,model)').order('created_at', { ascending: false }),
      supabase.from('vehicles').select('*'),
    ]);
    setRecords(m.data ?? []);
    setVehicles(v.data ?? []);
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, []);

  // Vehicles eligible for maintenance: available or on_trip (not retired or already in shop)
  const eligibleVehicles = vehicles.filter((v) => v.status === 'available' || v.status === 'on_trip');

  const filtered = useMemo(() => {
    let result = records.filter((r) => {
      const matchSearch = !search || r.service_type.toLowerCase().includes(search.toLowerCase()) || (r.vehicles?.registration_number ?? '').toLowerCase().includes(search.toLowerCase());
      const matchStatus = statusFilter === 'all' || r.status === statusFilter;
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
  }, [records, search, statusFilter, sortKey, sortDir]);

  const totalPages = Math.ceil(filtered.length / pageSize) || 1;
  const paged = filtered.slice((page - 1) * pageSize, page * pageSize);

  const openCreate = () => {
    setForm({ vehicle_id: '', service_type: '', description: '', cost: '', start_date: new Date().toISOString().slice(0, 16) });
    setModalOpen(true);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.vehicle_id || !form.service_type) { toast('Vehicle and service type are required', 'warning'); return; }
    setSaving(true);
    try {
      const payload = {
        vehicle_id: form.vehicle_id,
        service_type: form.service_type,
        description: form.description || null,
        cost: Number(form.cost) || 0,
        start_date: new Date(form.start_date).toISOString(),
        status: 'open' as Maintenance['status'],
      };
      const { error } = await supabase.from('maintenance').insert(payload);
      if (error) throw error;
      // Business rule: creating maintenance changes vehicle status to in_shop
      await supabase.from('vehicles').update({ status: 'in_shop' }).eq('id', form.vehicle_id);
      toast('Maintenance record created — vehicle is now in shop', 'success');
      setModalOpen(false);
      fetchAll();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Create failed';
      toast(msg, 'error');
    } finally {
      setSaving(false);
    }
  };

  // Close maintenance: set status to closed, set end_date, restore vehicle to available
  const handleClose = async () => {
    if (!closing) return;
    try {
      const { error } = await supabase.from('maintenance').update({ status: 'closed', end_date: new Date().toISOString() }).eq('id', closing.id);
      if (error) throw error;
      if (closing.vehicle_id) {
        await supabase.from('vehicles').update({ status: 'available' }).eq('id', closing.vehicle_id);
      }
      toast('Maintenance closed — vehicle is available again', 'success');
      setClosing(null);
      fetchAll();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Close failed';
      toast(msg, 'error');
    }
  };

  const handleExportCSV = () => {
    exportToCSV('maintenance.csv', filtered.map((r) => ({
      Vehicle: r.vehicles?.registration_number ?? '', ServiceType: r.service_type,
      Description: r.description ?? '', Cost: r.cost, Status: r.status,
      StartDate: r.start_date, EndDate: r.end_date ?? '',
    })));
    toast('CSV exported', 'success');
  };

  const handleExportPDF = () => {
    exportToPDF('Maintenance Report', filtered.map((r) => ({
      Vehicle: r.vehicles?.registration_number ?? '—', Service: r.service_type,
      Cost: formatCurrency(r.cost), Status: r.status, Start: formatDateTime(r.start_date),
    })));
    toast('PDF exported', 'success');
  };

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  };

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Maintenance"
        subtitle={`${records.length} service records · ${records.filter((r) => r.status === 'open').length} open`}
        action={
          <>
            <button onClick={handleExportCSV} className="btn-secondary"><Download className="h-4 w-4" /> CSV</button>
            <button onClick={handleExportPDF} className="btn-secondary"><Download className="h-4 w-4" /> PDF</button>
            <button onClick={openCreate} className="btn-primary"><Plus className="h-4 w-4" /> New Service</button>
          </>
        }
      />

      <Card className="p-4 mb-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input type="text" placeholder="Search by service type or vehicle…" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} className="glass-input pl-10" />
          </div>
          <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }} className="glass-input w-auto">
            <option value="all">All Statuses</option>
            <option value="open">Open</option>
            <option value="closed">Closed</option>
          </select>
        </div>
      </Card>

      <Card className="overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-16"><Spinner className="text-sky-500" /></div>
        ) : paged.length === 0 ? (
          <EmptyState icon={Wrench} title="No maintenance records" subtitle="Create a new service record to track maintenance" />
        ) : (
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200/60 dark:border-slate-700/50 text-left text-xs uppercase tracking-wide text-slate-400">
                  <th className="px-4 py-3 cursor-pointer" onClick={() => toggleSort('service_type')}><span className="flex items-center gap-1">Service Type <ArrowUpDown className="h-3 w-3" /></span></th>
                  <th className="px-4 py-3">Vehicle</th>
                  <th className="px-4 py-3">Description</th>
                  <th className="px-4 py-3 text-right cursor-pointer" onClick={() => toggleSort('cost')}>Cost</th>
                  <th className="px-4 py-3 cursor-pointer" onClick={() => toggleSort('start_date')}>Start Date</th>
                  <th className="px-4 py-3">End Date</th>
                  <th className="px-4 py-3 cursor-pointer" onClick={() => toggleSort('status')}>Status</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {paged.map((r) => (
                  <tr key={r.id} className="border-b border-slate-100/60 dark:border-slate-800/50 hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition">
                    <td className="px-4 py-3 font-semibold text-slate-800 dark:text-slate-100">{r.service_type}</td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{r.vehicles?.registration_number ?? '—'}</td>
                    <td className="px-4 py-3 text-slate-500 max-w-xs truncate">{r.description ?? '—'}</td>
                    <td className="px-4 py-3 text-right font-semibold text-slate-700 dark:text-slate-200">{formatCurrency(r.cost)}</td>
                    <td className="px-4 py-3 text-xs text-slate-500">{formatDateTime(r.start_date)}</td>
                    <td className="px-4 py-3 text-xs text-slate-500">{formatDateTime(r.end_date)}</td>
                    <td className="px-4 py-3"><Badge status={r.status} /></td>
                    <td className="px-4 py-3 text-right">
                      {r.status === 'open' ? (
                        <button onClick={() => setClosing(r)} className="btn-secondary px-2.5 py-1.5 text-xs text-emerald-600"><CheckCircle className="h-3.5 w-3.5" /> Close</button>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs text-slate-400"><Clock className="h-3 w-3" /> Completed</span>
                      )}
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

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="New Maintenance Record" size="lg">
        <form onSubmit={handleCreate} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="glass-label">Vehicle *</label>
              <select required value={form.vehicle_id} onChange={(e) => setForm({ ...form, vehicle_id: e.target.value })} className="glass-input">
                <option value="">Select vehicle…</option>
                {eligibleVehicles.map((v) => (
                  <option key={v.id} value={v.id}>{v.registration_number} — {v.model}</option>
                ))}
              </select>
              <p className="text-xs text-slate-400 mt-1">Creating maintenance sets the vehicle to "In Shop". Retired and in-shop vehicles are excluded.</p>
            </div>
            <div>
              <label className="glass-label">Service Type *</label>
              <input type="text" required value={form.service_type} onChange={(e) => setForm({ ...form, service_type: e.target.value })} className="glass-input" placeholder="Oil Change & Inspection" />
            </div>
            <div>
              <label className="glass-label">Cost ($)</label>
              <input type="number" min="0" value={form.cost} onChange={(e) => setForm({ ...form, cost: e.target.value })} className="glass-input" placeholder="850" />
            </div>
            <div>
              <label className="glass-label">Start Date *</label>
              <input type="datetime-local" required value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} className="glass-input" />
            </div>
            <div className="sm:col-span-2">
              <label className="glass-label">Description</label>
              <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="glass-input" rows={2} placeholder="Routine 90k service, oil filter, brake pads" />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setModalOpen(false)} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary">{saving ? <Spinner className="h-4 w-4" /> : 'Create Record'}</button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!closing}
        onClose={() => setClosing(null)}
        onConfirm={handleClose}
        title="Close Maintenance"
        message={`Close this maintenance record for ${closing?.vehicles?.registration_number ?? 'this vehicle'}? The vehicle will be restored to available status.`}
        confirmLabel="Close & Restore"
      />
    </div>
  );
}
