import { type ReactNode, useMemo } from 'react';

// Lightweight SVG chart components — no external deps.

export function LineChart({ data, height = 200, color = '#0ea5e9', formatY }: { data: { label: string; value: number }[]; height?: number; color?: string; formatY?: (v: number) => string }) {
  const width = 600;
  const padding = { top: 16, right: 16, bottom: 28, left: 44 };
  const innerW = width - padding.left - padding.right;
  const innerH = height - padding.top - padding.bottom;

  const { points, maxVal, minVal, gridLines } = useMemo(() => {
    if (data.length === 0) return { points: '', maxVal: 0, minVal: 0, gridLines: [] };
    const values = data.map((d) => d.value);
    const maxV = Math.max(...values, 1);
    const minV = Math.min(...values, 0);
    const range = maxV - minV || 1;
    const stepX = data.length > 1 ? innerW / (data.length - 1) : 0;
    const pts = data.map((d, i) => {
      const x = padding.left + i * stepX;
      const y = padding.top + innerH - ((d.value - minV) / range) * innerH;
      return `${x},${y}`;
    }).join(' ');
    const grid = Array.from({ length: 5 }, (_, i) => {
      const v = minV + (range * i) / 4;
      const y = padding.top + innerH - (i / 4) * innerH;
      return { y, value: v };
    });
    return { points: pts, maxVal: maxV, minVal: minV, gridLines: grid };
  }, [data, innerW, innerH, padding.left, padding.top]);

  if (data.length === 0) return <div className="flex items-center justify-center text-sm text-slate-400" style={{ height }}>No data</div>;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full" style={{ height }}>
      {/* Grid */}
      {gridLines.map((g, i) => (
        <g key={i}>
          <line x1={padding.left} y1={g.y} x2={width - padding.right} y2={g.y} stroke="currentColor" className="text-slate-200 dark:text-slate-700" strokeWidth="1" strokeDasharray="3 3" />
          <text x={padding.left - 6} y={g.y + 4} textAnchor="end" className="fill-slate-400 text-[10px]">{formatY ? formatY(g.value) : Math.round(g.value)}</text>
        </g>
      ))}
      {/* Area fill */}
      <polygon
        points={`${padding.left},${padding.top + innerH} ${points} ${padding.left + (data.length - 1) * (innerW / Math.max(data.length - 1, 1))},${padding.top + innerH}`}
        fill={color}
        fillOpacity="0.08"
      />
      {/* Line */}
      <polyline points={points} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
      {/* Points */}
      {data.map((d, i) => {
        const stepX = data.length > 1 ? innerW / (data.length - 1) : 0;
        const x = padding.left + i * stepX;
        const range = maxVal - minVal || 1;
        const y = padding.top + innerH - ((d.value - minVal) / range) * innerH;
        return <circle key={i} cx={x} cy={y} r="3" fill={color} className="hover:r-5 transition-all" />;
      })}
      {/* X labels */}
      {data.map((d, i) => {
        const stepX = data.length > 1 ? innerW / (data.length - 1) : 0;
        const x = padding.left + i * stepX;
        return <text key={i} x={x} y={height - 8} textAnchor="middle" className="fill-slate-400 text-[10px]">{d.label}</text>;
      })}
    </svg>
  );
}

export function BarChart({ data, height = 200, color = '#0ea5e9', formatY }: { data: { label: string; value: number }[]; height?: number; color?: string; formatY?: (v: number) => string }) {
  const width = 600;
  const padding = { top: 16, right: 16, bottom: 28, left: 44 };
  const innerW = width - padding.left - padding.right;
  const innerH = height - padding.top - padding.bottom;

  const { maxVal, gridLines } = useMemo(() => {
    if (data.length === 0) return { maxVal: 0, gridLines: [] };
    const maxV = Math.max(...data.map((d) => d.value), 1);
    const grid = Array.from({ length: 5 }, (_, i) => {
      const v = (maxV * i) / 4;
      const y = padding.top + innerH - (i / 4) * innerH;
      return { y, value: v };
    });
    return { maxVal: maxV, gridLines: grid };
  }, [data, innerH]);

  if (data.length === 0) return <div className="flex items-center justify-center text-sm text-slate-400" style={{ height }}>No data</div>;

  const barWidth = (innerW / data.length) * 0.6;
  const gap = (innerW / data.length) * 0.4;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full" style={{ height }}>
      {gridLines.map((g, i) => (
        <g key={i}>
          <line x1={padding.left} y1={g.y} x2={width - padding.right} y2={g.y} stroke="currentColor" className="text-slate-200 dark:text-slate-700" strokeWidth="1" strokeDasharray="3 3" />
          <text x={padding.left - 6} y={g.y + 4} textAnchor="end" className="fill-slate-400 text-[10px]">{formatY ? formatY(g.value) : Math.round(g.value)}</text>
        </g>
      ))}
      {data.map((d, i) => {
        const barH = (d.value / maxVal) * innerH;
        const x = padding.left + i * (barWidth + gap) + gap / 2;
        const y = padding.top + innerH - barH;
        return (
          <g key={i}>
            <rect x={x} y={y} width={barWidth} height={Math.max(barH, 0)} rx="4" fill={color} fillOpacity="0.85" className="transition-all hover:fill-opacity-100" />
            <text x={x + barWidth / 2} y={height - 8} textAnchor="middle" className="fill-slate-400 text-[10px]">{d.label}</text>
          </g>
        );
      })}
    </svg>
  );
}

export function DonutChart({ data, size = 160 }: { data: { label: string; value: number; color: string }[]; size?: number }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  const radius = size / 2 - 10;
  const cx = size / 2;
  const cy = size / 2;
  const strokeWidth = 22;

  if (total === 0) return <div className="flex items-center justify-center text-sm text-slate-400" style={{ height: size }}>No data</div>;

  let cumulative = 0;
  const segments = data.map((d) => {
    const fraction = d.value / total;
    const startAngle = (cumulative / total) * 360 - 90;
    const endAngle = ((cumulative + d.value) / total) * 360 - 90;
    cumulative += d.value;
    const startRad = (startAngle * Math.PI) / 180;
    const endRad = (endAngle * Math.PI) / 180;
    const x1 = cx + radius * Math.cos(startRad);
    const y1 = cy + radius * Math.sin(startRad);
    const x2 = cx + radius * Math.cos(endRad);
    const y2 = cy + radius * Math.sin(endRad);
    const largeArc = endAngle - startAngle > 180 ? 1 : 0;
    const path = `M ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2}`;
    return { path, color: d.color, label: d.label, value: d.value, fraction };
  });

  return (
    <div className="flex items-center gap-4">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {segments.map((s, i) => (
          <path key={i} d={s.path} fill="none" stroke={s.color} strokeWidth={strokeWidth} strokeLinecap="round" />
        ))}
        <text x={cx} y={cy - 4} textAnchor="middle" className="fill-slate-800 dark:fill-slate-100 text-lg font-bold">{total}</text>
        <text x={cx} y={cy + 14} textAnchor="middle" className="fill-slate-400 text-[10px] uppercase tracking-wide">Total</text>
      </svg>
      <div className="space-y-1.5">
        {data.map((d) => (
          <div key={d.label} className="flex items-center gap-2 text-xs">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: d.color }} />
            <span className="text-slate-600 dark:text-slate-300 font-medium">{d.label}</span>
            <span className="text-slate-400">{d.value} ({total > 0 ? Math.round((d.value / total) * 100) : 0}%)</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function KpiCard({ icon: Icon, label, value, sub, accent = 'sky', trend }: { icon: React.ElementType; label: string; value: string; sub?: string; accent?: 'sky' | 'emerald' | 'amber' | 'red' | 'violet'; trend?: { value: string; up: boolean } }) {
  const accents = {
    sky: 'from-sky-500/15 to-blue-500/5 text-sky-600 dark:text-sky-400',
    emerald: 'from-emerald-500/15 to-teal-500/5 text-emerald-600 dark:text-emerald-400',
    amber: 'from-amber-500/15 to-orange-500/5 text-amber-600 dark:text-amber-400',
    red: 'from-red-500/15 to-rose-500/5 text-red-600 dark:text-red-400',
    violet: 'from-violet-500/15 to-purple-500/5 text-violet-600 dark:text-violet-400',
  };
  return (
    <div className="glass-card rounded-2xl p-5 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-3">
        <div className={`h-11 w-11 rounded-xl bg-gradient-to-br ${accents[accent]} flex items-center justify-center`}>
          <Icon className="h-5 w-5" />
        </div>
        {trend && (
          <span className={`text-xs font-semibold ${trend.up ? 'text-emerald-500' : 'text-red-500'}`}>
            {trend.up ? '↑' : '↓'} {trend.value}
          </span>
        )}
      </div>
      <p className="text-2xl font-bold text-slate-900 dark:text-white">{value}</p>
      <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">{label}</p>
      {sub && <p className="text-xs text-slate-400 mt-1">{sub}</p>}
    </div>
  );
}

export function ChartCard({ title, subtitle, children, action }: { title: string; subtitle?: string; children: ReactNode; action?: ReactNode }) {
  return (
    <div className="glass-card rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">{title}</h3>
          {subtitle && <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}
