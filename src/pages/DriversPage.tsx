import { useEffect, useMemo, useState } from 'react';
import { Users, Plus, Search, Edit2, Trash2, Download, ArrowUpDown, Phone, Mail, ShieldAlert } from 'lucide-react';
import { supabase, type Driver } from '../lib/supabase';
import { useToast } from '../lib/toast';
import { exportToCSV, exportToPDF, formatDate, daysUntil } from '../lib/utils';
import { Card, PageHeader, Modal, ConfirmDialog, EmptyState, Badge, Spinner } from '../components/ui';

type SortKey = 'name' | 'license_number' | 'status' | 'safety_score' | 'license_expiry';

export default function DriversPage() {
  const { toast } = useToast();
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState(1);
  const pageSize = 8;

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Driver | null>(null);
  const [deleting, setDeleting] = useState<Driver | null>(null);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    name: '', license_number: '', license_expiry: '', safety_score: '100',
    phone: '', email: '', status: 'available' as Driver['status'],
  });

  const fetchDrivers = async () => {
    setLoading(true);
    const { data } = await supabase.from('drivers').select('*').order('created_at', { ascending: false });
    setDrivers(data ?? []);
    setLoading(false);
  };

  useEffect(() => { fetchDrivers(); }, []);

  const filtered = useMemo(() => {
    let result = drivers.filter((d) => {
      const matchSearch = !search || d.name.toLowerCase().includes(search.toLowerCase()) || d.license_number.toLowerCase().includes(search.toLowerCase());
      const matchStatus = statusFilter === 'all' || d.status === statusFilter;
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
  }, [drivers, search, statusFilter, sortKey, sortDir]);

  const totalPages = Math.ceil(filtered.length / pageSize) || 1;
  const paged = filtered.slice((page - 1) * pageSize, page * pageSize);

  const openCreate = () => {
    setEditing(null);
    setForm({ name: '', license_number: '', license_expiry: '', safety_score: '100', phone: '', email: '', status: 'available' });
    setModalOpen(true);
  };

  const openEdit = (d: Driver) => {
    setEditing(d);
    setForm({
      name: d.name,
      license_number: d.license_number,
      license_expiry: d.license_expiry,
      safety_score: String(d.safety_score),
      phone: d.phone ?? '',
      email: d.email ?? '',
      status: d.status,
    });
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.license_number || !form.license_expiry) { toast('Name, license number, and expiry are required', 'warning'); return; }
    setSaving(true);
    try {
      const payload = {
        name: form.name,
        license_number: form.license_number,
        license_expiry: form.license_expiry,
        safety_score: Number(form.safety_score) || 0,
        phone: form.phone || null,
        email: form.email || null,
        status: form.status,
      };
      if (editing) {
        const { error } = await supabase.from('drivers').update(payload).eq('id', editing.id);
        if (error) throw error;
        toast('Driver updated', 'success');
      } else {
        const { error } = await supabase.from('drivers').insert(payload);
        if (error) throw error;
        toast('Driver created', 'success');
      }
      setModalOpen(false);
      fetchDrivers();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Save failed';
      toast(msg, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleting) return;
    const { error } = await supabase.from('drivers').delete().eq('id', deleting.id);
    if (error) { toast(error.message, 'error'); return; }
    toast('Driver deleted', 'success');
    setDeleting(null);
    fetchDrivers();
  };

  const handleExportCSV = () => {
    exportToCSV('drivers.csv', filtered.map((d) => ({
      Name: d.name, License: d.license_number, Expiry: d.license_expiry,
      SafetyScore: d.safety_score, Phone: d.phone ?? '', Email: d.email ?? '', Status: d.status,
    })));
    toast('CSV exported', 'success');
  };

  const handleExportPDF = () => {
    exportToPDF('Drivers Report', filtered.map((d) => ({
      Name: d.name, License: d.license_number, Expiry: formatDate(d.license_expiry),
      Safety: d.safety_score, Status: d.status,
    })));
    toast('PDF exported', 'success');
  };

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  };

  const scoreColor = (score: number) => {
    if (score >= 90) return 'text-emerald-600 dark:text-emerald-400';
    if (score >= 75) return 'text-amber-600 dark:text-amber-400';
    return 'text-red-600 dark:text-red-400';
  };

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Drivers"
        subtitle={`${drivers.length} drivers in your team`}
        action={
          <>
            <button onClick={handleExportCSV} className="btn-secondary"><Download className="h-4 w-4" /> CSV</button>
            <button onClick={handleExportPDF} className="btn-secondary"><Download className="h-4 w-4" /> PDF</button>
            <button onClick={openCreate} className="btn-primary"><Plus className="h-4 w-4" /> Add Driver</button>
          </>
        }
      />

      <Card className="p-4 mb-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input type="text" placeholder="Search by name or license…" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} className="glass-input pl-10" />
          </div>
          <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }} className="glass-input w-auto">
            <option value="all">All Statuses</option>
            <option value="available">Available</option>
            <option value="on_trip">On Trip</option>
            <option value="suspended">Suspended</option>
            <option value="off_duty">Off Duty</option>
          </select>
        </div>
      </Card>

      <Card className="overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-16"><Spinner className="text-sky-500" /></div>
        ) : paged.length === 0 ? (
          <EmptyState icon={Users} title="No drivers found" subtitle="Try adjusting your filters or add a new driver" />
        ) : (
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200/60 dark:border-slate-700/50 text-left text-xs uppercase tracking-wide text-slate-400">
                  <th className="px-4 py-3 cursor-pointer" onClick={() => toggleSort('name')}><span className="flex items-center gap-1">Name <ArrowUpDown className="h-3 w-3" /></span></th>
                  <th className="px-4 py-3 cursor-pointer" onClick={() => toggleSort('license_number')}>License #</th>
                  <th className="px-4 py-3 cursor-pointer" onClick={() => toggleSort('license_expiry')}>License Expiry</th>
                  <th className="px-4 py-3 cursor-pointer" onClick={() => toggleSort('safety_score')}>Safety Score</th>
                  <th className="px-4 py-3">Contact</th>
                  <th className="px-4 py-3 cursor-pointer" onClick={() => toggleSort('status')}>Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {paged.map((d) => {
                  const expDays = daysUntil(d.license_expiry);
                  const expiring = expDays !== null && expDays < 30;
                  return (
                    <tr key={d.id} className="border-b border-slate-100/60 dark:border-slate-800/50 hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition">
                      <td className="px-4 py-3 font-semibold text-slate-800 dark:text-slate-100">{d.name}</td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{d.license_number}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs ${expiring ? 'text-amber-600 dark:text-amber-400 font-semibold flex items-center gap-1' : 'text-slate-500'}`}>
                          {expiring && <ShieldAlert className="h-3 w-3" />}
                          {formatDate(d.license_expiry)}
                        </span>
                      </td>
                      <td className="px-4 py-3"><span className={`font-semibold ${scoreColor(d.safety_score)}`}>{d.safety_score}</span></td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-0.5 text-xs text-slate-500">
                          {d.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{d.phone}</span>}
                          {d.email && <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{d.email}</span>}
                          {!d.phone && !d.email && <span className="text-slate-400">—</span>}
                        </div>
                      </td>
                      <td className="px-4 py-3"><Badge status={d.status} /></td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => openEdit(d)} className="btn-ghost h-8 w-8 p-0" title="Edit"><Edit2 className="h-4 w-4" /></button>
                          <button onClick={() => setDeleting(d)} className="btn-ghost h-8 w-8 p-0 text-red-500 hover:text-red-600" title="Delete"><Trash2 className="h-4 w-4" /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
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

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit Driver' : 'Add Driver'} size="lg">
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="glass-label">Full Name *</label>
              <input type="text" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="glass-input" placeholder="James Carter" />
            </div>
            <div>
              <label className="glass-label">License Number *</label>
              <input type="text" required value={form.license_number} onChange={(e) => setForm({ ...form, license_number: e.target.value })} className="glass-input" placeholder="DL-2024001" />
            </div>
            <div>
              <label className="glass-label">License Expiry *</label>
              <input type="date" required value={form.license_expiry} onChange={(e) => setForm({ ...form, license_expiry: e.target.value })} className="glass-input" />
            </div>
            <div>
              <label className="glass-label">Safety Score (0–100)</label>
              <input type="number" min="0" max="100" value={form.safety_score} onChange={(e) => setForm({ ...form, safety_score: e.target.value })} className="glass-input" placeholder="100" />
            </div>
            <div>
              <label className="glass-label">Phone</label>
              <input type="text" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="glass-input" placeholder="555-0101" />
            </div>
            <div>
              <label className="glass-label">Email</label>
              <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="glass-input" placeholder="driver@transitops.com" />
            </div>
            <div>
              <label className="glass-label">Status</label>
              <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as Driver['status'] })} className="glass-input">
                <option value="available">Available</option>
                <option value="on_trip">On Trip</option>
                <option value="suspended">Suspended</option>
                <option value="off_duty">Off Duty</option>
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setModalOpen(false)} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary">{saving ? <Spinner className="h-4 w-4" /> : editing ? 'Save Changes' : 'Create Driver'}</button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={handleDelete}
        title="Delete Driver"
        message={`Are you sure you want to delete ${deleting?.name}? This action cannot be undone.`}
        confirmLabel="Delete"
        danger
      />
    </div>
  );
}
