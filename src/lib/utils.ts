import { type Role } from './supabase';

export const ROLE_LABELS: Record<Role, string> = {
  admin: 'Administrator',
  fleet_manager: 'Fleet Manager',
  driver: 'Driver',
  safety_officer: 'Safety Officer',
  financial_analyst: 'Financial Analyst',
};

export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  admin: 'Full access to all modules, users, and system configuration.',
  fleet_manager: 'Manage vehicles, drivers, trips, maintenance, and fuel logs.',
  driver: 'View assigned trips, vehicle info, and personal driving records.',
  safety_officer: 'Monitor driver safety scores, license status, and compliance.',
  financial_analyst: 'Track expenses, revenue, ROI, and operational cost analytics.',
};

export const ALL_ROLES: Role[] = ['admin', 'fleet_manager', 'driver', 'safety_officer', 'financial_analyst'];

export function canAccess(role: Role | undefined, allowed: Role[]): boolean {
  if (!role) return false;
  if (role === 'admin') return true;
  return allowed.includes(role);
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-US').format(value);
}

export function formatDate(value: string | null): string {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

export function formatDateTime(value: string | null): string {
  if (!value) return '—';
  return new Date(value).toLocaleString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const diff = new Date(dateStr).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

export function exportToCSV(filename: string, rows: Record<string, unknown>[]) {
  if (rows.length === 0) return;
  const headers = Object.keys(rows[0]);
  const csv = [
    headers.join(','),
    ...rows.map((row) =>
      headers
        .map((h) => {
          const val = row[h];
          if (val === null || val === undefined) return '';
          const str = String(val).replace(/"/g, '""');
          return `"${str}"`;
        })
        .join(',')
    ),
  ].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function exportToPDF(title: string, rows: Record<string, unknown>[]) {
  const win = window.open('', '_blank');
  if (!win) return;
  const headers = rows.length > 0 ? Object.keys(rows[0]) : [];
  const html = `
    <html><head><title>${title}</title>
    <style>
      body { font-family: Inter, Arial, sans-serif; padding: 40px; color: #1e293b; }
      h1 { color: #0284c7; border-bottom: 2px solid #0ea5e9; padding-bottom: 10px; }
      table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 13px; }
      th { background: #f0f9ff; padding: 10px 12px; text-align: left; border-bottom: 2px solid #bae6fd; font-weight: 600; }
      td { padding: 8px 12px; border-bottom: 1px solid #e2e8f0; }
      tr:nth-child(even) td { background: #f8fafc; }
      .meta { color: #64748b; font-size: 12px; margin-top: 4px; }
    </style></head><body>
    <h1>${title}</h1>
    <p class="meta">Generated on ${new Date().toLocaleString()}</p>
    <table><thead><tr>${headers.map((h) => `<th>${h}</th>`).join('')}</tr></thead>
    <tbody>${rows.map((r) => `<tr>${headers.map((h) => `<td>${r[h] ?? ''}</td>`).join('')}</tr>`).join('')}</tbody>
    </table></body></html>`;
  win.document.write(html);
  win.document.close();
  setTimeout(() => win.print(), 500);
}
