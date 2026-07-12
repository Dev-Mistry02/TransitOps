import { useEffect, useMemo, useState } from 'react';
import { Receipt, Plus, Search, Download, Trash2, Edit2 } from 'lucide-react';
import { supabase, type Expense, type Vehicle, type ExpenseCategory } from '../lib/supabase';
import { useToast } from '../lib/toast';
import { exportToCSV, exportToPDF, formatCurrency, formatDate } from '../lib/utils';
import { Card, PageHeader, Modal, ConfirmDialog, EmptyState, Spinner } from '../components/ui';

type SortKey = 'date' | 'amount' | 'category';

const CATEGORIES: ExpenseCategory[] = ['fuel', 'maintenance', 'salary', 'insurance', 'other'];

const catColors: Record<ExpenseCategory, string> = {
  fuel: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
  maintenance: 'bg-red-500/15 text-red-600 dark:text-red-400',
  salary: 'bg-violet-500/15 text-violet-600 dark:text-violet-400',
  insurance: 'bg-sky-500/15 text-sky-600 dark:text-sky-400',
  other: 'bg-slate-500/15 text-slate-500 dark:text-slate-400',
};

export default function ExpensesPage() {
  const { toast } = useToast();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('all');
  const [sortKey, setSortKey] = useState<SortKey>('date');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);
  const pageSize = 8;

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);
  const [deleting, setDeleting] = useState<Expense | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ category: 'fuel' as ExpenseCategory, amount: '', description: '', vehicle_id: '', date: '' });

  const fetchAll = async () => {
    setLoading(true);
    const [e, v] = await Promise.all([
      supabase.from('expenses').select('*, vehicles:vehicle_id(registration_number,model)').order('created_at', { ascending: false }),
      supabase.from('vehicles').select('*'),
    ]);
    setExpenses(e.data ?? []);
    setVehicles(v.data ?? []);
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, []);

  const filtered = useMemo(() => {
    let result = expenses.filter((e) => {
      const matchSearch = !search || (e.description ?? '').toLowerCase().includes(search.toLowerCase()) || (e.vehicles?.registration_number ?? '').toLowerCase().includes(search.toLowerCase());
      const matchCat = catFilter === 'all' || e.category === catFilter;
      return matchSearch && matchCat;
    });
    result = [...result].sort((a, b) => {
      const av = a[sortKey] as string | number; const bv = b[sortKey] as string | number;
      if (typeof av === 'string') {
        const alc = av.toLowerCase(); const blc = (bv as string).toLowerCase();
        if (alc < blc) return sortDir === 'asc' ? -1 : 1;
        if (alc > blc) return sortDir === 'asc' ? 1 : -1;
        return 0;
      }
      if ((av as number) < (bv as number)) return sortDir === 'asc' ? -1 : 1;
      if ((av as number) > (bv as number)) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
    return result;
  }, [expenses, search, catFilter, sortKey, sortDir]);

  const totalPages = Math.ceil(filtered.length / pageSize) || 1;
  const paged = filtered.slice((page - 1) * pageSize, page * pageSize);

  const totalAmount = useMemo(() => filtered.reduce((s, e) => s + e.amount, 0), [filtered]);

  const byCategory = useMemo(() => {
    return CATEGORIES.map((cat) => ({
      category: cat,
      total: filtered.filter((e) => e.category === cat).reduce((s, e) => s + e.amount, 0),
      count: filtered.filter((e) => e.category === cat).length,
    }));
  }, [filtered]);

  const openCreate = () => {
    setEditing(null);
    setForm({ category: 'fuel', amount: '', description: '', vehicle_id: '', date: new Date().toISOString().slice(0, 10) });
    setModalOpen(true);
  };

  const openEdit = (e: Expense) => {
    setEditing(e);
    setForm({
      category: e.category,
      amount: String(e.amount),
      description: e.description ?? '',
      vehicle_id: e.vehicle_id ?? '',
      date: new Date(e.date).toISOString().slice(0, 10),
    });
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.amount || !form.category) { toast('Category and amount are required', 'warning'); return; }
    setSaving(true);
    try {
      const payload = {
        category: form.category,
        amount: Number(form.amount) || 0,
        description: form.description || null,
        vehicle_id: form.vehicle_id || null,
        date: new Date(form.date).toISOString(),
      };
      if (editing) {
        const { error } = await supabase.from('expenses').update(payload).eq('id', editing.id);
        if (error) throw error;
        toast('Expense updated', 'success');
      } else {
        const { error } = await supabase.from('expenses').insert(payload);
        if (error) throw error;
        toast('Expense added', 'success');
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
    const { error } = await supabase.from('expenses').delete().eq('id', deleting.id);
    if (error) { toast(error.message, 'error'); return; }
    toast('Expense deleted', 'success');
    setDeleting(null);
    fetchAll();
  };

  const handleExportCSV = () => {
    exportToCSV('expenses.csv', filtered.map((e) => ({
      Category: e.category, Amount: e.amount, Description: e.description ?? '',
      Vehicle: e.vehicles?.registration_number ?? '', Date: e.date,
    })));
    toast('CSV exported', 'success');
  };

  const handleExportPDF = () => {
    exportToPDF('Expenses Report', filtered.map((e) => ({
      Category: e.category, Amount: formatCurrency(e.amount),
      Description: e.description ?? '—', Vehicle: e.vehicles?.registration_number ?? '—', Date: formatDate(e.date),
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
        title="Expenses"
        subtitle={`${expenses.length} expense records · Total: ${formatCurrency(totalAmount)}`}
        action={
          <>
            <button onClick={handleExportCSV} className="btn-secondary"><Download className="h-4 w-4" /> CSV</button>
            <button onClick={handleExportPDF} className="btn-secondary"><Download className="h-4 w-4" /> PDF</button>
            <button onClick={openCreate} className="btn-primary"><Plus className="h-4 w-4" /> Add Expense</button>
          </>
        }
      />

      {/* Category breakdown */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-4">
        {byCategory.map((c) => (
          <Card key={c.category} className="p-3">
            <span className={`badge ${catColors[c.category]} mb-2`}>{c.category}</span>
            <p className="text-lg font-bold text-slate-900 dark:text-white">{formatCurrency(c.total)}</p>
            <p className="text-xs text-slate-400">{c.count} entries</p>
          </Card>
        ))}
      </div>

      <Card className="p-4 mb-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input type="text" placeholder="Search by description or vehicle…" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} className="glass-input pl-10" />
          </div>
          <select value={catFilter} onChange={(e) => { setCatFilter(e.target.value); setPage(1); }} className="glass-input w-auto">
            <option value="all">All Categories</option>
            {CATEGORIES.map((c) => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
          </select>
        </div>
      </Card>

      <Card className="overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-16"><Spinner className="text-sky-500" /></div>
        ) : paged.length === 0 ? (
          <EmptyState icon={Receipt} title="No expenses found" subtitle="Add an expense to start tracking operational costs" />
        ) : (
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200/60 dark:border-slate-700/50 text-left text-xs uppercase tracking-wide text-slate-400">
                  <th className="px-4 py-3 cursor-pointer" onClick={() => toggleSort('category')}>Category</th>
                  <th className="px-4 py-3">Description</th>
                  <th className="px-4 py-3">Vehicle</th>
                  <th className="px-4 py-3 text-right cursor-pointer" onClick={() => toggleSort('amount')}>Amount</th>
                  <th className="px-4 py-3 cursor-pointer" onClick={() => toggleSort('date')}>Date</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {paged.map((e) => (
                  <tr key={e.id} className="border-b border-slate-100/60 dark:border-slate-800/50 hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition">
                    <td className="px-4 py-3"><span className={`badge ${catColors[e.category]}`}>{e.category}</span></td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300 max-w-xs truncate">{e.description ?? '—'}</td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{e.vehicles?.registration_number ?? '—'}</td>
                    <td className="px-4 py-3 text-right font-semibold text-slate-700 dark:text-slate-200">{formatCurrency(e.amount)}</td>
                    <td className="px-4 py-3 text-xs text-slate-500">{formatDate(e.date)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => openEdit(e)} className="btn-ghost h-8 w-8 p-0"><Edit2 className="h-4 w-4" /></button>
                        <button onClick={() => setDeleting(e)} className="btn-ghost h-8 w-8 p-0 text-red-500"><Trash2 className="h-4 w-4" /></button>
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

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit Expense' : 'Add Expense'} size="md">
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="glass-label">Category *</label>
              <select required value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value as ExpenseCategory })} className="glass-input">
                {CATEGORIES.map((c) => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
              </select>
            </div>
            <div>
              <label className="glass-label">Amount ($) *</label>
              <input type="number" step="0.01" min="0" required value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} className="glass-input" placeholder="850" />
            </div>
            <div className="col-span-2">
              <label className="glass-label">Description</label>
              <input type="text" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="glass-input" placeholder="Quarterly insurance premium" />
            </div>
            <div>
              <label className="glass-label">Vehicle (optional)</label>
              <select value={form.vehicle_id} onChange={(e) => setForm({ ...form, vehicle_id: e.target.value })} className="glass-input">
                <option value="">No vehicle</option>
                {vehicles.map((v) => <option key={v.id} value={v.id}>{v.registration_number} — {v.model}</option>)}
              </select>
            </div>
            <div>
              <label className="glass-label">Date *</label>
              <input type="date" required value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className="glass-input" />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setModalOpen(false)} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary">{saving ? <Spinner className="h-4 w-4" /> : editing ? 'Save Changes' : 'Add Expense'}</button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog open={!!deleting} onClose={() => setDeleting(null)} onConfirm={handleDelete} title="Delete Expense" message="Are you sure you want to delete this expense record?" confirmLabel="Delete" danger />
    </div>
  );
}
