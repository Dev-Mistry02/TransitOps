import { useState } from 'react';
import { User, Mail, Phone, Shield, Save } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { useToast } from '../lib/toast';
import { ROLE_LABELS } from '../lib/utils';
import { supabase } from '../lib/supabase';
import { Card, PageHeader, Spinner } from '../components/ui';

export default function ProfilePage() {
  const { profile, refreshProfile } = useAuth();
  const { toast } = useToast();
  const [fullName, setFullName] = useState(profile?.full_name ?? '');
  const [phone, setPhone] = useState(profile?.phone ?? '');
  const [saving, setSaving] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    setSaving(true);
    try {
      const { error } = await supabase.from('profiles').update({ full_name: fullName, phone: phone || null }).eq('id', profile.id);
      if (error) throw error;
      await refreshProfile();
      toast('Profile updated', 'success');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Update failed';
      toast(msg, 'error');
    } finally {
      setSaving(false);
    }
  };

  if (!profile) return null;

  return (
    <div className="animate-fade-in max-w-3xl">
      <PageHeader title="My Profile" subtitle="Manage your personal information and account details" />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Profile card */}
        <Card className="p-6 text-center">
          <div className="h-24 w-24 rounded-full bg-gradient-to-br from-sky-500 to-blue-700 flex items-center justify-center text-white text-3xl font-bold mx-auto mb-4 shadow-lg shadow-sky-500/30">
            {profile.full_name?.charAt(0) ?? 'U'}
          </div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">{profile.full_name}</h2>
          <p className="text-sm text-slate-500">{profile.email}</p>
          <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-sky-500/15 text-sky-600 dark:text-sky-400 px-3 py-1 text-xs font-semibold">
            <Shield className="h-3.5 w-3.5" />
            {ROLE_LABELS[profile.role]}
          </div>
        </Card>

        {/* Edit form */}
        <Card className="p-6 lg:col-span-2">
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100 mb-4">Edit Information</h3>
          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <label className="glass-label">Full Name</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} className="glass-input pl-10" placeholder="Jane Smith" />
              </div>
            </div>
            <div>
              <label className="glass-label">Email (read-only)</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input type="email" value={profile.email} readOnly className="glass-input pl-10 opacity-60 cursor-not-allowed" />
              </div>
            </div>
            <div>
              <label className="glass-label">Phone</label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input type="text" value={phone} onChange={(e) => setPhone(e.target.value)} className="glass-input pl-10" placeholder="555-0100" />
              </div>
            </div>
            <div>
              <label className="glass-label">Role (assigned at signup)</label>
              <div className="relative">
                <Shield className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input type="text" value={ROLE_LABELS[profile.role]} readOnly className="glass-input pl-10 opacity-60 cursor-not-allowed" />
              </div>
            </div>
            <div className="flex justify-end pt-2">
              <button type="submit" disabled={saving} className="btn-primary">
                {saving ? <Spinner className="h-4 w-4" /> : <><Save className="h-4 w-4" /> Save Changes</>}
              </button>
            </div>
          </form>
        </Card>
      </div>
    </div>
  );
}
