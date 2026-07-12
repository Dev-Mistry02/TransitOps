import { type ReactNode, useState } from 'react';
import {
  Bus, LayoutDashboard, Truck, Users, Route, Wrench, Fuel, Receipt,
  Bell, Moon, Sun, LogOut, Menu, X, User as UserIcon, Settings, ChevronDown, Search
} from 'lucide-react';
import { useAuth } from '../lib/auth';
import { useTheme } from '../lib/theme';
import { ROLE_LABELS } from '../lib/utils';
import { supabase, type Notification, type Role } from '../lib/supabase';
import { useEffect } from 'react';

type NavItem = { label: string; icon: React.ElementType; path: string; roles?: Role[] };

const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', icon: LayoutDashboard, path: 'dashboard' },
  { label: 'Vehicles', icon: Truck, path: 'vehicles', roles: ['admin', 'fleet_manager', 'safety_officer', 'financial_analyst'] },
  { label: 'Drivers', icon: Users, path: 'drivers', roles: ['admin', 'fleet_manager', 'safety_officer'] },
  { label: 'Trips', icon: Route, path: 'trips', roles: ['admin', 'fleet_manager', 'driver'] },
  { label: 'Maintenance', icon: Wrench, path: 'maintenance', roles: ['admin', 'fleet_manager'] },
  { label: 'Fuel Logs', icon: Fuel, path: 'fuel', roles: ['admin', 'fleet_manager', 'financial_analyst'] },
  { label: 'Expenses', icon: Receipt, path: 'expenses', roles: ['admin', 'financial_analyst'] },
];

export default function AppShell({ currentPath, onNavigate, children }: { currentPath: string; onNavigate: (path: string) => void; children: ReactNode }) {
  const { profile, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const role = profile?.role ?? 'fleet_manager';
  const visibleItems = NAV_ITEMS.filter((item) => !item.roles || item.roles.includes(role) || role === 'admin');

  useEffect(() => {
    if (!profile) return;
    supabase.from('notifications').select('*').eq('user_id', profile.id).order('created_at', { ascending: false }).limit(20).then(({ data }) => {
      setNotifications(data ?? []);
    });
  }, [profile]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const markAllRead = async () => {
    if (!profile) return;
    await supabase.from('notifications').update({ read: true }).eq('user_id', profile.id).eq('read', false);
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const navigate = (path: string) => {
    onNavigate(path);
    setSidebarOpen(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-sky-50/40 to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      {/* Mobile overlay */}
      {sidebarOpen && <div className="fixed inset-0 z-30 bg-slate-900/40 backdrop-blur-sm lg:hidden" onClick={() => setSidebarOpen(false)} />}

      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-40 w-64 transform transition-transform duration-300 lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="h-full glass-card border-r border-slate-200/60 dark:border-slate-700/50 flex flex-col">
          {/* Logo */}
          <div className="flex items-center justify-between px-5 h-16 border-b border-slate-200/60 dark:border-slate-700/50">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-sky-500 to-blue-700 flex items-center justify-center shadow-lg shadow-sky-500/30">
                <Bus className="h-5 w-5 text-white" />
              </div>
              <div>
                <h1 className="text-sm font-bold text-slate-900 dark:text-white">TransitOps</h1>
                <p className="text-[10px] text-slate-400 uppercase tracking-wider">AI Fleet Platform</p>
              </div>
            </div>
            <button onClick={() => setSidebarOpen(false)} className="lg:hidden text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Nav */}
          <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto scrollbar-thin">
            {visibleItems.map((item) => {
              const active = currentPath === item.path;
              return (
                <button
                  key={item.path}
                  onClick={() => navigate(item.path)}
                  className={`w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                    active
                      ? 'bg-sky-500/15 text-sky-700 dark:text-sky-300 ring-1 ring-sky-500/30'
                      : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200/50 dark:hover:bg-slate-700/40'
                  }`}
                >
                  <item.icon className={`h-4.5 w-4.5 ${active ? 'text-sky-600 dark:text-sky-400' : 'text-slate-400'}`} />
                  {item.label}
                </button>
              );
            })}
          </nav>

          {/* User card */}
          <div className="p-3 border-t border-slate-200/60 dark:border-slate-700/50">
            <div className="flex items-center gap-3 rounded-lg px-3 py-2.5 bg-slate-100/50 dark:bg-slate-800/40">
              <div className="h-9 w-9 rounded-full bg-gradient-to-br from-sky-500 to-blue-700 flex items-center justify-center text-white text-sm font-semibold shrink-0">
                {profile?.full_name?.charAt(0) ?? 'U'}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">{profile?.full_name}</p>
                <p className="text-xs text-slate-400 truncate">{ROLE_LABELS[role]}</p>
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="lg:pl-64">
        {/* Topbar */}
        <header className="sticky top-0 z-20 h-16 glass-card border-b border-slate-200/60 dark:border-slate-700/50 px-4 sm:px-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button onClick={() => setSidebarOpen(true)} className="lg:hidden text-slate-500 hover:text-slate-700 dark:hover:text-slate-200">
              <Menu className="h-5 w-5" />
            </button>
            <div className="relative hidden sm:block">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search fleet…"
                className="glass-input pl-9 py-2 w-56"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    const q = (e.target as HTMLInputElement).value;
                    if (q.trim()) onNavigate('vehicles');
                  }
                }}
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button onClick={toggleTheme} className="btn-ghost h-9 w-9 p-0" title="Toggle theme">
              {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </button>

            {/* Notifications */}
            <div className="relative">
              <button onClick={() => setNotifOpen((o) => !o)} className="btn-ghost h-9 w-9 p-0 relative" title="Notifications">
                <Bell className="h-5 w-5" />
                {unreadCount > 0 && <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-red-500 ring-2 ring-white dark:ring-slate-900" />}
              </button>
              {notifOpen && (
                <>
                  <div className="fixed inset-0 z-30" onClick={() => setNotifOpen(false)} />
                  <div className="absolute right-0 mt-2 w-80 glass-card rounded-xl shadow-xl border border-slate-200/60 dark:border-slate-700/50 z-40 animate-scale-in">
                    <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200/60 dark:border-slate-700/50">
                      <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Notifications</h3>
                      {unreadCount > 0 && <button onClick={markAllRead} className="text-xs text-sky-600 dark:text-sky-400 hover:underline">Mark all read</button>}
                    </div>
                    <div className="max-h-80 overflow-y-auto scrollbar-thin">
                      {notifications.length === 0 ? (
                        <p className="text-sm text-slate-400 text-center py-8">No notifications yet</p>
                      ) : (
                        notifications.map((n) => (
                          <div key={n.id} className={`px-4 py-3 border-b border-slate-100/60 dark:border-slate-800/50 ${!n.read ? 'bg-sky-500/5' : ''}`}>
                            <p className="text-sm text-slate-700 dark:text-slate-200">{n.message}</p>
                            <p className="text-xs text-slate-400 mt-1">{new Date(n.created_at).toLocaleString()}</p>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Profile menu */}
            <div className="relative">
              <button onClick={() => setProfileOpen((o) => !o)} className="flex items-center gap-2 rounded-lg pl-2 pr-1 py-1.5 hover:bg-slate-200/50 dark:hover:bg-slate-700/40 transition">
                <div className="h-8 w-8 rounded-full bg-gradient-to-br from-sky-500 to-blue-700 flex items-center justify-center text-white text-sm font-semibold">
                  {profile?.full_name?.charAt(0) ?? 'U'}
                </div>
                <ChevronDown className="h-4 w-4 text-slate-400" />
              </button>
              {profileOpen && (
                <>
                  <div className="fixed inset-0 z-30" onClick={() => setProfileOpen(false)} />
                  <div className="absolute right-0 mt-2 w-56 glass-card rounded-xl shadow-xl border border-slate-200/60 dark:border-slate-700/50 z-40 py-2 animate-scale-in">
                    <div className="px-4 py-2 border-b border-slate-200/60 dark:border-slate-700/50">
                      <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">{profile?.full_name}</p>
                      <p className="text-xs text-slate-400 truncate">{profile?.email}</p>
                    </div>
                    <button onClick={() => { onNavigate('profile'); setProfileOpen(false); }} className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-100/60 dark:hover:bg-slate-700/40 transition">
                      <UserIcon className="h-4 w-4" /> My Profile
                    </button>
                    <button onClick={() => { onNavigate('settings'); setProfileOpen(false); }} className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-100/60 dark:hover:bg-slate-700/40 transition">
                      <Settings className="h-4 w-4" /> Settings
                    </button>
                    <div className="border-t border-slate-200/60 dark:border-slate-700/50 my-1" />
                    <button onClick={signOut} className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-500/10 transition">
                      <LogOut className="h-4 w-4" /> Sign Out
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">{children}</main>
      </div>
    </div>
  );
}
