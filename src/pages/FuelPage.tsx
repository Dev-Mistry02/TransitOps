import { useEffect, useMemo, useState } from 'react';
import { Fuel, Plus, Search, Download, Trash2, Edit2 } from 'lucide-react';
import { supabase, type FuelLog, type Vehicle } from '../lib/supabase';
import { useToast } from '../lib/toast';
import { exportToCSV, exportToPDF, formatCurrency, formatNumber, formatDateTime } from '../lib/utils';
import { Card, PageHeader, Modal, ConfirmDialog, EmptyState, Spinner } from '../components/ui';

type SortKey = 'date' | 'liters' | 'cost' | 'odometer_reading';

export default function FuelPage() {
  const { toast } = useToast();
  const [logs, setLogs] = useState<FuelLog[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('date');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);
  const pageSize = 8;

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<FuelLog | null>(null);
  const [deleting, setDeleting] = useState<FuelLog | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ vehicle_id: '', liters: '', cost: '', odometer_reading: '', date: '' });

  const fetchAll = async () => {
    setLoading(true);
    const [f, v] = await Promise.all([
      supabase.from('fuel_logs').select('*, vehicles:vehicle_id(registration_number,model)').order('created_at', { ascending: false }),
      supabase.from('vehicles').select('*'),
    ]);
    setLogs(f.data ?? []);
    setVehicles(v.data ?? []);
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, []);

  const filtered = useMemo(() => {
    let result = logs.filter((l) => !search || (l.vehicles?.registration_number ?? '').toLowerCase().includes(search.toLowerCase()));
    result = [...result].sort((a, b) => {
      const av = a[sortKey]; const bv = b[sortKey];
      if (av < bv) return sortDir === 'asc' ? -1 : 1;
      if (av > bv) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
    return result;
  }, [logs, search, sortKey, sortDir]);

  const totalPages = Math.ceil(filtered.length / pageSize) || 1;
  const paged = filtered.slice((page - 1) * pageSize, page * pageSize);

  const stats = useMemo(() => {
    const totalLiters = filtered.reduce((s, l) => s + l.liters, 0);
    const totalCost = filtered.reduce((s, l) => s + l.cost, 0);
    const avgPrice = totalLiters > 0 ? totalCost / totalLiters : 0;
    return { totalLiters, totalCost, avgPrice };
  }, [filtered]);

  const openCreate = () => {
    setEditing(null);
    setForm({ vehicle_id: '', liters: '', cost: '', odometer_reading: '', date: new Date().toISOString().slice(0, 16) });
    setModalOpen(true);
  };

  const openEdit = (l: FuelLog) => {
    setEditing(l);
    setForm({
      vehicle_id: l.vehicle_id ?? '',
      liters: String(l.liters),
      cost: String(l.cost),
      odometer_reading: String(l.odometer_reading),
      date: new Date(l.date).toISOString().slice(0, 16),
    });
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.vehicle_id || !form.liters || !form.cost) { toast('Vehicle, liters, and cost are required', 'warning'); return; }
    setSaving(true);
    try {
      const payload = {
        vehicle_id: form.vehicle_id,
        liters: Number(form.liters) || 0,
        cost: Number(form.cost) || 0,
        odometer_reading: Number(form.odometer_reading) || 0,
        date: new Date(form.date).toISOString(),
      };
      if (editing) {
        const { error } = await supabase.from('fuel_logs').update(payload).eq('id', editing.id);
        if (error) throw error;
        toast('Fuel log updated', 'success');
      } else {
        const { error } = await supabase.from('fuel_logs').insert(payload);
        if (error) throw error;
        toast('Fuel log added', 'success');
      }
      setModalOpen(false);
      fetchAll();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Save failed';
      toast(msg, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleting) return;
    const { error } = await supabase.from('fuel_logs').delete().eq('id', deleting.id);
    if (error) { toast(error.message, 'error'); return; }
    toast('Fuel log deleted', 'success');
    setDeleting(null);
    fetchAll();
  };

  const handleExportCSV = () => {
    exportToCSV('fuel_logs.csv', filtered.map((l) => ({
      Vehicle: l.vehicles?.registration_number ?? '', Liters: l.liters, Cost: l.cost,
      Odometer: l.odometer_reading, Date: l.date,
    })));
    toast('CSV exported', 'success');
  };

  const handleExportPDF = () => {
    exportToPDF('Fuel Logs Report', filtered.map((l) => ({
      Vehicle: l.vehicles?.registration_number ?? '—', Liters: l.liters,
      Cost: formatCurrency(l.cost), Odometer: formatNumber(l.odometer_reading), Date: formatDateTime(l.date),
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
        title="Fuel Logs"
        subtitle={`${logs.length} fuel entries`}
        action={
          <>
            <button onClick={handleExportCSV} className="btn-secondary"><Download className="h-4 w-4" /> CSV</button>
            <button onClick={handleExportPDF} className="btn-secondary"><Download className="h-4 w-4" /> PDF</button>
            <button onClick={openCreate} className="btn-primary"><Plus className="h-4 w-4" /> Add Fuel Log</button>
          </>
        }
      />

      {/* Summary stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
        <Card className="p-4">
          <p className="text-xs uppercase tracking-wide text-slate-400">Total Liters</p>
          <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{formatNumber(stats.totalLiters)} L</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs uppercase tracking-wide text-slate-400">Total Cost</p>
          <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{formatCurrency(stats.totalCost)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs uppercase tracking-wide text-slate-400">Avg Price / L</p>
          <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{formatCurrency(stats.avgPrice)}</p>
        </Card>
      </div>

      <Card className="p-4 mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input type="text" placeholder="Search by vehicle registration…" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} className="glass-input pl-10" />
        </div>
      </Card>

      <Card className="overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-16"><Spinner className="text-sky-500" /></div>
        ) : paged.length === 0 ? (
          <EmptyState icon={Fuel} title="No fuel logs found" subtitle="Add a fuel entry to start tracking consumption" />
        ) : (
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200/60 dark:border-slate-700/50 text-left text-xs uppercase tracking-wide text-slate-400">
                  <th className="px-4 py-3">Vehicle</th>
                  <th className="px-4 py-3 text-right cursor-pointer" onClick={() => toggleSort('liters')}>Liters</th>
                  <th className="px-4 py-3 text-right cursor-pointer" onClick={() => toggleSort('cost')}>Cost</th>
                  <th className="px-4 py-3 text-right cursor-pointer" onClick={() => toggleSort('odometer_reading')}>Odometer</th>
                  <th className="px-4 py-3 cursor-pointer" onClick={() => toggleSort('date')}>Date</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {paged.map((l) => (
                  <tr key={l.id} className="border-b border-slate-100/60 dark:border-slate-800/50 hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition">
                    <td className="px-4 py-3 font-semibold text-slate-800 dark:text-slate-100">{l.vehicles?.registration_number ?? '—'}</td>
                    <td className="px-4 py-3 text-right text-slate-600 dark:text-slate-300">{l.liters} L</td>
                    <td className="px-4 py-3 text-right font-semibold text-slate-700 dark:text-slate-200">{formatCurrency(l.cost)}</td>
                    <td className="px-4 py-3 text-right text-slate-600 dark:text-slate-300">{formatNumber(l.odometer_reading)}</td>
                    <td className="px-4 py-3 text-xs text-slate-500">{formatDateTime(l.date)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => openEdit(l)} className="btn-ghost h-8 w-8 p-0"><Edit2 className="h-4 w-4" /></button>
                        <button onClick={() => setDeleting(l)} className="btn-ghost h-8 w-8 p-0 text-red-500"><Trash2 className="h-4 w-4" /></button>
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

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit Fuel Log' : 'Add Fuel Log'} size="md">
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="glass-label">Vehicle *</label>
            <select required value={form.vehicle_id} onChange={(e) => setForm({ ...form, vehicle_id: e.target.value })} className="glass-input">
              <option value="">Select vehicle…</option>
              {vehicles.map((v) => (
                <option key={v.id} value={v.id}>{v.registration_number} — {v.model}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="glass-label">Liters *</label>
              <input type="number" step="0.01" min="0" required value={form.liters} onChange={(e) => setForm({ ...form, liters: e.target.value })} className="glass-input" placeholder="180" />
            </div>
            <div>
              <label className="glass-label">Cost ($) *</label>
              <input type="number" step="0.01" min="0" required value={form.cost} onChange={(e) => setForm({ ...form, cost: e.target.value })} className="glass-input" placeholder="216.00" />
            </div>
            <div>
              <label className="glass-label">Odometer (km)</label>
              <input type="number" min="0" value={form.odometer_reading} onChange={(e) => setForm({ ...form, odometer_reading: e.target.value })} className="glass-input" placeholder="156000" />
            </div>
            <div>
              <label className="glass-label">Date *</label>
              <input type="datetime-local" required value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className="glass-input" />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setModalOpen(false)} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary">{saving ? <Spinner className="h-4 w-4" /> : editing ? 'Save Changes' : 'Add Fuel Log'}</button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog open={!!deleting} onClose={() => setDeleting(null)} onConfirm={handleDelete} title="Delete Fuel Log" message="Are you sure you want to delete this fuel log?" confirmLabel="Delete" danger />
    </div>
  );
}
