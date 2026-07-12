import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { CheckCircle, AlertTriangle, XCircle, Info, X } from 'lucide-react';

type ToastType = 'success' | 'error' | 'warning' | 'info';

type Toast = {
  id: string;
  message: string;
  type: ToastType;
};

type ToastContextValue = {
  toast: (message: string, type?: ToastType) => void;
};

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

const icons = {
  success: CheckCircle,
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
};

const styles = {
  success: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  error: 'border-red-500/40 bg-red-500/10 text-red-600 dark:text-red-400',
  warning: 'border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400',
  info: 'border-sky-500/40 bg-sky-500/10 text-sky-600 dark:text-sky-400',
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const toast = useCallback((message: string, type: ToastType = 'info') => {
    const id = Math.random().toString(36).slice(2);
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  }, []);

  const dismiss = (id: string) => setToasts((prev) => prev.filter((t) => t.id !== id));

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-3 max-w-sm">
        {toasts.map((t) => {
          const Icon = icons[t.type];
          return (
            <div
              key={t.id}
              className={`glass-card flex items-start gap-3 rounded-xl border px-4 py-3 shadow-lg animate-slide-in ${styles[t.type]}`}
            >
              <Icon className="h-5 w-5 shrink-0 mt-0.5" />
              <p className="text-sm font-medium flex-1 text-slate-800 dark:text-slate-100">{t.message}</p>
              <button onClick={() => dismiss(t.id)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                <X className="h-4 w-4" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
