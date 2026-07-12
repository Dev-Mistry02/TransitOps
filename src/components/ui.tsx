import { type ReactNode } from 'react';
import { Loader2 } from 'lucide-react';

export function Spinner({ className = '' }: { className?: string }) {
  return <Loader2 className={`h-5 w-5 animate-spin ${className}`} />;
}

export function FullPageLoader({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-gradient-to-br from-slate-50 via-sky-50 to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      <div className="flex items-center gap-2">
        <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-sky-500 to-blue-700 flex items-center justify-center shadow-lg shadow-sky-500/30">
          <Spinner className="h-6 w-6 text-white" />
        </div>
      </div>
      <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{label}</p>
    </div>
  );
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`glass-card rounded-2xl shadow-sm ${className}`}>{children}</div>;
}

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">{title}</h1>
        {subtitle && <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{subtitle}</p>}
      </div>
      {action && <div className="flex items-center gap-2">{action}</div>}
    </div>
  );
}

export function EmptyState({ icon: Icon, title, subtitle }: { icon: React.ElementType; title: string; subtitle?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="h-14 w-14 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4">
        <Icon className="h-7 w-7 text-slate-400" />
      </div>
      <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">{title}</h3>
      {subtitle && <p className="text-sm text-slate-400 mt-1">{subtitle}</p>}
    </div>
  );
}

export function Badge({ status, children }: { status: string; children?: ReactNode }) {
  const map: Record<string, string> = {
    available: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
    on_trip: 'bg-sky-500/15 text-sky-600 dark:text-sky-400',
    in_shop: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
    retired: 'bg-slate-500/15 text-slate-500 dark:text-slate-400',
    suspended: 'bg-red-500/15 text-red-600 dark:text-red-400',
    off_duty: 'bg-slate-500/15 text-slate-500 dark:text-slate-400',
    pending: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
    dispatched: 'bg-sky-500/15 text-sky-600 dark:text-sky-400',
    completed: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
    cancelled: 'bg-red-500/15 text-red-600 dark:text-red-400',
    open: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
    closed: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
  };
  const labelMap: Record<string, string> = {
    on_trip: 'On Trip',
    in_shop: 'In Shop',
    off_duty: 'Off Duty',
  };
  return (
    <span className={`badge ${map[status] ?? 'bg-slate-500/15 text-slate-500'}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {children ?? labelMap[status] ?? status.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
    </span>
  );
}

export function Modal({ open, onClose, title, children, size = 'md' }: { open: boolean; onClose: () => void; title: string; children: ReactNode; size?: 'sm' | 'md' | 'lg' }) {
  if (!open) return null;
  const widths = { sm: 'max-w-md', md: 'max-w-lg', lg: 'max-w-2xl' };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in">
      <div className="absolute inset-0 bg-slate-900/40 dark:bg-slate-950/60 backdrop-blur-sm" onClick={onClose} />
      <div className={`relative w-full ${widths[size]} glass-card rounded-2xl shadow-2xl animate-scale-in max-h-[90vh] overflow-y-auto scrollbar-thin`}>
        <div className="flex items-center justify-between border-b border-slate-200/60 dark:border-slate-700/50 px-6 py-4 sticky top-0 bg-white/70 dark:bg-slate-900/60 backdrop-blur-xl rounded-t-2xl z-10">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">{title}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition">
            <span className="text-2xl leading-none">&times;</span>
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

export function ConfirmDialog({ open, onClose, onConfirm, title, message, confirmLabel = 'Confirm', danger = false }: { open: boolean; onClose: () => void; onConfirm: () => void; title: string; message: string; confirmLabel?: string; danger?: boolean }) {
  return (
    <Modal open={open} onClose={onClose} title={title} size="sm">
      <p className="text-sm text-slate-600 dark:text-slate-300 mb-6">{message}</p>
      <div className="flex justify-end gap-3">
        <button onClick={onClose} className="btn-secondary">Cancel</button>
        <button onClick={onConfirm} className={danger ? 'btn-danger' : 'btn-primary'}>{confirmLabel}</button>
      </div>
    </Modal>
  );
}
