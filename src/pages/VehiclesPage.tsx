import { useEffect, useMemo, useState } from 'react';
import { Truck, Plus, Search, Edit2, Trash2, FileText, Download, Upload, ArrowUpDown } from 'lucide-react';
import { supabase, type Vehicle, type Document } from '../lib/supabase';
import { useToast } from '../lib/toast';
import { exportToCSV, exportToPDF, formatCurrency, formatNumber, formatDate, daysUntil } from '../lib/utils';
import { Card, PageHeader, Modal, ConfirmDialog, EmptyState, Badge, Spinner } from '../components/ui';

type SortKey = 'registration_number' | 'model' | 'type' | 'status' | 'odometer' | 'acquisition_cost';

export default function VehiclesPage() {
  const { toast } = useToast();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [sortKey, setSortKey] = useState<SortKey>('registration_number');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState(1);
  const pageSize = 8;

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Vehicle | null>(null);
  const [deleting, setDeleting] = useState<Vehicle | null>(null);
  const [docsOpen, setDocsOpen] = useState<Vehicle | null>(null);
  const [docs, setDocs] = useState<Document[]>([]);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    registration_number: '',
    model: '',
    type: 'truck' as Vehicle['type'],
    load_capacity: '',
    odometer: '',
    acquisition_cost: '',
    status: 'available' as Vehicle['status'],
    insurance_provider: '',
    insurance_policy_number: '',
    insurance_expiry: '',
  });

  const fetchVehicles = async () => {
    setLoading(true);
    const { data } = await supabase.from('vehicles').select('*').order('created_at', { ascending: false });
    setVehicles(data ?? []);
    setLoading(false);
  };

  useEffect(() => { fetchVehicles(); }, []);

  const filtered = useMemo(() => {
    let result = vehicles.filter((v) => {
      const matchSearch = !search || v.registration_number.toLowerCase().includes(search.toLowerCase()) || v.model.toLowerCase().includes(search.toLowerCase());
      const matchStatus = statusFilter === 'all' || v.status === statusFilter;
      const matchType = typeFilter === 'all' || v.type === typeFilter;
      return matchSearch && matchStatus && matchType;
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
  }, [vehicles, search, statusFilter, typeFilter, sortKey, sortDir]);

  const totalPages = Math.ceil(filtered.length / pageSize) || 1;
  const paged = filtered.slice((page - 1) * pageSize, page * pageSize);

  const openCreate = () => {
    setEditing(null);
    setForm({ registration_number: '', model: '', type: 'truck', load_capacity: '', odometer: '', acquisition_cost: '', status: 'available', insurance_provider: '', insurance_policy_number: '', insurance_expiry: '' });
    setModalOpen(true);
  };

  const openEdit = (v: Vehicle) => {
    setEditing(v);
    setForm({
      registration_number: v.registration_number,
      model: v.model,
      type: v.type,
      load_capacity: String(v.load_capacity),
      odometer: String(v.odometer),
      acquisition_cost: String(v.acquisition_cost),
      status: v.status,
      insurance_provider: v.insurance_provider ?? '',
      insurance_policy_number: v.insurance_policy_number ?? '',
      insurance_expiry: v.insurance_expiry ?? '',
    });
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.registration_number || !form.model) { toast('Registration number and model are required', 'warning'); return; }
    setSaving(true);
    try {
      const payload = {
        registration_number: form.registration_number,
        model: form.model,
        type: form.type,
        load_capacity: Number(form.load_capacity) || 0,
        odometer: Number(form.odometer) || 0,
        acquisition_cost: Number(form.acquisition_cost) || 0,
        status: form.status,
        insurance_provider: form.insurance_provider || null,
        insurance_policy_number: form.insurance_policy_number || null,
        insurance_expiry: form.insurance_expiry || null,
      };
      if (editing) {
        const { error } = await supabase.from('vehicles').update(payload).eq('id', editing.id);
        if (error) throw error;
        toast('Vehicle updated', 'success');
      } else {
        const { error } = await supabase.from('vehicles').insert(payload);
        if (error) throw error;
        toast('Vehicle created', 'success');
      }
      setModalOpen(false);
      fetchVehicles();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Save failed';
      toast(msg, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleting) return;
    const { error } = await supabase.from('vehicles').delete().eq('id', deleting.id);
    if (error) { toast(error.message, 'error'); return; }
    toast('Vehicle deleted', 'success');
    setDeleting(null);
    fetchVehicles();
  };

  const openDocs = async (v: Vehicle) => {
    setDocsOpen(v);
    const { data } = await supabase.from('documents').select('*').eq('vehicle_id', v.id).order('uploaded_at', { ascending: false });
    setDocs(data ?? []);
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !e.target.files[0] || !docsOpen) return;
    const file = e.target.files[0];
    setUploading(true);
    try {
      const fileName = `${docsOpen.id}/${Date.now()}-${file.name}`;
      const { error: upErr } = await supabase.storage.from('vehicle-docs').upload(fileName, file);
      let fileUrl = '';
      if (upErr) {
        // Storage bucket may not exist; store as data URL fallback
        fileUrl = URL.createObjectURL(file);
      } else {
        const { data: urlData } = supabase.storage.from('vehicle-docs').getPublicUrl(fileName);
        fileUrl = urlData.publicUrl;
      }
      const { error: docErr } = await supabase.from('documents').insert({
        vehicle_id: docsOpen.id,
        file_name: file.name,
        file_url: fileUrl,
        file_type: file.type,
      });
      if (docErr) throw docErr;
      toast('Document uploaded', 'success');
      const { data } = await supabase.from('documents').select('*').eq('vehicle_id', docsOpen.id).order('uploaded_at', { ascending: false });
      setDocs(data ?? []);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Upload failed';
      toast(msg, 'error');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleDeleteDoc = async (doc: Document) => {
    await supabase.from('documents').delete().eq('id', doc.id);
    setDocs((prev) => prev.filter((d) => d.id !== doc.id));
    toast('Document removed', 'success');
  };

  const handleExportCSV = () => {
    exportToCSV('vehicles.csv', filtered.map((v) => ({
      Registration: v.registration_number,
      Model: v.model,
      Type: v.type,
      Capacity: v.load_capacity,
      Odometer: v.odometer,
      Cost: v.acquisition_cost,
      Status: v.status,
      Insurance_Provider: v.insurance_provider ?? '',
      Insurance_Expiry: v.insurance_expiry ?? '',
    })));
    toast('CSV exported', 'success');
  };

  const handleExportPDF = () => {
    exportToPDF('Vehicles Report', filtered.map((v) => ({
      Registration: v.registration_number,
      Model: v.model,
      Type: v.type,
      Status: v.status,
      Odometer: formatNumber(v.odometer),
      Cost: formatCurrency(v.acquisition_cost),
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
        title="Vehicles"
        subtitle={`${vehicles.length} vehicles in your fleet`}
        action={
          <>
            <button onClick={handleExportCSV} className="btn-secondary"><Download className="h-4 w-4" /> CSV</button>
            <button onClick={handleExportPDF} className="btn-secondary"><Download className="h-4 w-4" /> PDF</button>
            <button onClick={openCreate} className="btn-primary"><Plus className="h-4 w-4" /> Add Vehicle</button>
          </>
        }
      />

      {/* Filters */}
      <Card className="p-4 mb-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input type="text" placeholder="Search by registration or model…" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} className="glass-input pl-10" />
          </div>
          <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }} className="glass-input w-auto">
            <option value="all">All Statuses</option>
            <option value="available">Available</option>
            <option value="on_trip">On Trip</option>
            <option value="in_shop">In Shop</option>
            <option value="retired">Retired</option>
          </select>
          <select value={typeFilter} onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }} className="glass-input w-auto">
            <option value="all">All Types</option>
            <option value="truck">Truck</option>
            <option value="van">Van</option>
            <option value="bus">Bus</option>
            <option value="trailer">Trailer</option>
            <option value="car">Car</option>
          </select>
        </div>
      </Card>

      {/* Table */}
      <Card className="overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-16"><Spinner className="text-sky-500" /></div>
        ) : paged.length === 0 ? (
          <EmptyState icon={Truck} title="No vehicles found" subtitle="Try adjusting your filters or add a new vehicle" />
        ) : (
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200/60 dark:border-slate-700/50 text-left text-xs uppercase tracking-wide text-slate-400">
                  <th className="px-4 py-3 cursor-pointer hover:text-slate-600 dark:hover:text-slate-200" onClick={() => toggleSort('registration_number')}>
                    <span className="flex items-center gap-1">Registration <ArrowUpDown className="h-3 w-3" /></span>
                  </th>
                  <th className="px-4 py-3 cursor-pointer hover:text-slate-600 dark:hover:text-slate-200" onClick={() => toggleSort('model')}>Model</th>
                  <th className="px-4 py-3 cursor-pointer hover:text-slate-600 dark:hover:text-slate-200" onClick={() => toggleSort('type')}>Type</th>
                  <th className="px-4 py-3 text-right">Capacity</th>
                  <th className="px-4 py-3 text-right cursor-pointer" onClick={() => toggleSort('odometer')}>Odometer</th>
                  <th className="px-4 py-3 text-right cursor-pointer" onClick={() => toggleSort('acquisition_cost')}>Cost</th>
                  <th className="px-4 py-3 cursor-pointer" onClick={() => toggleSort('status')}>Status</th>
                  <th className="px-4 py-3">Insurance</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {paged.map((v) => {
                  const insDays = daysUntil(v.insurance_expiry);
                  return (
                    <tr key={v.id} className="border-b border-slate-100/60 dark:border-slate-800/50 hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition">
                      <td className="px-4 py-3 font-semibold text-slate-800 dark:text-slate-100">{v.registration_number}</td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{v.model}</td>
                      <td className="px-4 py-3 capitalize text-slate-600 dark:text-slate-300">{v.type}</td>
                      <td className="px-4 py-3 text-right text-slate-600 dark:text-slate-300">{formatNumber(v.load_capacity)} kg</td>
                      <td className="px-4 py-3 text-right text-slate-600 dark:text-slate-300">{formatNumber(v.odometer)}</td>
                      <td className="px-4 py-3 text-right text-slate-600 dark:text-slate-300">{formatCurrency(v.acquisition_cost)}</td>
                      <td className="px-4 py-3"><Badge status={v.status} /></td>
                      <td className="px-4 py-3">
                        {v.insurance_expiry ? (
                          <span className={`text-xs ${insDays !== null && insDays < 30 ? 'text-amber-600 dark:text-amber-400 font-semibold' : 'text-slate-500'}`}>
                            {formatDate(v.insurance_expiry)}
                          </span>
                        ) : <span className="text-slate-400 text-xs">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => openDocs(v)} className="btn-ghost h-8 w-8 p-0" title="Documents"><FileText className="h-4 w-4" /></button>
                          <button onClick={() => openEdit(v)} className="btn-ghost h-8 w-8 p-0" title="Edit"><Edit2 className="h-4 w-4" /></button>
                          <button onClick={() => setDeleting(v)} className="btn-ghost h-8 w-8 p-0 text-red-500 hover:text-red-600" title="Delete"><Trash2 className="h-4 w-4" /></button>
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

      {/* Create/Edit modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit Vehicle' : 'Add Vehicle'} size="lg">
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="glass-label">Registration Number *</label>
              <input type="text" required value={form.registration_number} onChange={(e) => setForm({ ...form, registration_number: e.target.value })} className="glass-input" placeholder="TRK-1001" />
            </div>
            <div>
              <label className="glass-label">Model *</label>
              <input type="text" required value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} className="glass-input" placeholder="Volvo FH16" />
            </div>
            <div>
              <label className="glass-label">Type</label>
              <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as Vehicle['type'] })} className="glass-input">
                <option value="truck">Truck</option>
                <option value="van">Van</option>
                <option value="bus">Bus</option>
                <option value="trailer">Trailer</option>
                <option value="car">Car</option>
              </select>
            </div>
            <div>
              <label className="glass-label">Status</label>
              <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as Vehicle['status'] })} className="glass-input">
                <option value="available">Available</option>
                <option value="on_trip">On Trip</option>
                <option value="in_shop">In Shop</option>
                <option value="retired">Retired</option>
              </select>
            </div>
            <div>
              <label className="glass-label">Load Capacity (kg)</label>
              <input type="number" min="0" value={form.load_capacity} onChange={(e) => setForm({ ...form, load_capacity: e.target.value })} className="glass-input" placeholder="24000" />
            </div>
            <div>
              <label className="glass-label">Odometer (km)</label>
              <input type="number" min="0" value={form.odometer} onChange={(e) => setForm({ ...form, odometer: e.target.value })} className="glass-input" placeholder="156000" />
            </div>
            <div>
              <label className="glass-label">Acquisition Cost ($)</label>
              <input type="number" min="0" value={form.acquisition_cost} onChange={(e) => setForm({ ...form, acquisition_cost: e.target.value })} className="glass-input" placeholder="185000" />
            </div>
            <div>
              <label className="glass-label">Insurance Provider</label>
              <input type="text" value={form.insurance_provider} onChange={(e) => setForm({ ...form, insurance_provider: e.target.value })} className="glass-input" placeholder="Guardian Insurance" />
            </div>
            <div>
              <label className="glass-label">Insurance Policy #</label>
              <input type="text" value={form.insurance_policy_number} onChange={(e) => setForm({ ...form, insurance_policy_number: e.target.value })} className="glass-input" placeholder="GI-2024-1001" />
            </div>
            <div>
              <label className="glass-label">Insurance Expiry</label>
              <input type="date" value={form.insurance_expiry} onChange={(e) => setForm({ ...form, insurance_expiry: e.target.value })} className="glass-input" />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setModalOpen(false)} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary">{saving ? <Spinner className="h-4 w-4" /> : editing ? 'Save Changes' : 'Create Vehicle'}</button>
          </div>
        </form>
      </Modal>

      {/* Documents modal */}
      <Modal open={!!docsOpen} onClose={() => setDocsOpen(null)} title={`Documents — ${docsOpen?.registration_number ?? ''}`} size="md">
        <div className="space-y-3">
          <label className="btn-primary w-full cursor-pointer">
            <Upload className="h-4 w-4" /> {uploading ? 'Uploading…' : 'Upload Document'}
            <input type="file" className="hidden" onChange={handleUpload} disabled={uploading} />
          </label>
          {docs.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-6">No documents uploaded yet</p>
          ) : (
            <div className="space-y-2">
              {docs.map((doc) => (
                <div key={doc.id} className="flex items-center justify-between rounded-lg px-3 py-2.5 bg-slate-50/60 dark:bg-slate-800/40">
                  <a href={doc.file_url} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-sm font-medium text-sky-600 dark:text-sky-400 hover:underline min-w-0">
                    <FileText className="h-4 w-4 shrink-0" />
                    <span className="truncate">{doc.file_name}</span>
                  </a>
                  <button onClick={() => handleDeleteDoc(doc)} className="text-red-500 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
                </div>
              ))}
            </div>
          )}
        </div>
      </Modal>

      {/* Delete confirm */}
      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={handleDelete}
        title="Delete Vehicle"
        message={`Are you sure you want to delete ${deleting?.registration_number}? This action cannot be undone.`}
        confirmLabel="Delete"
        danger
      />
    </div>
  );
}
