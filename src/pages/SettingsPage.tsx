import { useState } from 'react';
import { Moon, Sun, Bell, Mail, Shield, User as UserIcon } from 'lucide-react';
import { useTheme } from '../lib/theme';
import { useAuth } from '../lib/auth';
import { useToast } from '../lib/toast';
import { ROLE_LABELS } from '../lib/utils';
import { Card, PageHeader } from '../components/ui';

export default function SettingsPage() {
  const { theme, toggleTheme } = useTheme();
  const { profile } = useAuth();
  const { toast } = useToast();
  const [emailNotifs, setEmailNotifs] = useState(true);
  const [licenseAlerts, setLicenseAlerts] = useState(true);
  const [insuranceAlerts, setInsuranceAlerts] = useState(true);

  return (
    <div className="animate-fade-in max-w-3xl">
      <PageHeader title="Settings" subtitle="Configure your preferences and notifications" />

      <div className="space-y-6">
        {/* Appearance */}
        <Card className="p-6">
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100 mb-4">Appearance</h3>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                {theme === 'dark' ? <Moon className="h-5 w-5 text-sky-400" /> : <Sun className="h-5 w-5 text-amber-500" />}
              </div>
              <div>
                <p className="text-sm font-medium text-slate-800 dark:text-slate-100">Theme</p>
                <p className="text-xs text-slate-400">Switch between light and dark mode</p>
              </div>
            </div>
            <button onClick={toggleTheme} className="btn-secondary">
              {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              {theme === 'dark' ? 'Light' : 'Dark'}
            </button>
          </div>
        </Card>

        {/* Account info */}
        <Card className="p-6">
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100 mb-4">Account</h3>
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <UserIcon className="h-4 w-4 text-slate-400" />
              <span className="text-sm text-slate-500">Name:</span>
              <span className="text-sm font-medium text-slate-800 dark:text-slate-100">{profile?.full_name}</span>
            </div>
            <div className="flex items-center gap-3">
              <Mail className="h-4 w-4 text-slate-400" />
              <span className="text-sm text-slate-500">Email:</span>
              <span className="text-sm font-medium text-slate-800 dark:text-slate-100">{profile?.email}</span>
            </div>
            <div className="flex items-center gap-3">
              <Shield className="h-4 w-4 text-slate-400" />
              <span className="text-sm text-slate-500">Role:</span>
              <span className="text-sm font-medium text-slate-800 dark:text-slate-100">{ROLE_LABELS[profile?.role ?? 'fleet_manager']}</span>
            </div>
          </div>
        </Card>

        {/* Notifications */}
        <Card className="p-6">
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100 mb-4">Notifications</h3>
          <div className="space-y-4">
            <ToggleRow
              icon={Bell}
              title="In-app notifications"
              desc="Receive notifications in the dashboard"
              value={true}
              onChange={() => toast('In-app notifications are always enabled', 'info')}
              disabled
            />
            <ToggleRow
              icon={Mail}
              title="Email notifications"
              desc="Get email updates about fleet activity"
              value={emailNotifs}
              onChange={() => { setEmailNotifs((v) => !v); toast(`Email notifications ${!emailNotifs ? 'enabled' : 'disabled'}`, 'success'); }}
            />
            <ToggleRow
              icon={Shield}
              title="License expiry alerts"
              desc="Email reminders for expiring driver licenses"
              value={licenseAlerts}
              onChange={() => { setLicenseAlerts((v) => !v); toast(`License alerts ${!licenseAlerts ? 'enabled' : 'disabled'}`, 'success'); }}
            />
            <ToggleRow
              icon={Shield}
              title="Insurance expiry alerts"
              desc="Email reminders for expiring vehicle insurance"
              value={insuranceAlerts}
              onChange={() => { setInsuranceAlerts((v) => !v); toast(`Insurance alerts ${!insuranceAlerts ? 'enabled' : 'disabled'}`, 'success'); }}
            />
          </div>
        </Card>
      </div>
    </div>
  );
}

function ToggleRow({ icon: Icon, title, desc, value, onChange, disabled }: { icon: React.ElementType; title: string; desc: string; value: boolean; onChange: () => void; disabled?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="h-9 w-9 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
          <Icon className="h-4 w-4 text-slate-500" />
        </div>
        <div>
          <p className="text-sm font-medium text-slate-800 dark:text-slate-100">{title}</p>
          <p className="text-xs text-slate-400">{desc}</p>
        </div>
      </div>
      <button
        onClick={onChange}
        disabled={disabled}
        className={`relative h-6 w-11 rounded-full transition ${value ? 'bg-sky-500' : 'bg-slate-300 dark:bg-slate-600'} ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${value ? 'translate-x-5' : 'translate-x-0.5'}`} />
      </button>
    </div>
  );
}
