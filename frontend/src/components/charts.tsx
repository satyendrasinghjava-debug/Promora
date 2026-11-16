/** Small dependency-free SVG charts, drawn from the rows the API returns. */
export interface Series { key: string; label: string; color: string }

export function BarChart({ data, series, labelKey, height = 220, format = (n: number) => String(n) }: {
  data: Record<string, any>[]; series: Series[]; labelKey: string; height?: number; format?: (n: number) => string;
}) {
  const max = Math.max(1, ...data.flatMap((d) => series.map((s) => Number(d[s.key] || 0))));
  const total = data.reduce((sum, d) => sum + series.reduce((a, s) => a + Number(d[s.key] || 0), 0), 0);
  const W = 720, pad = { l: 44, r: 8, t: 10, b: 26 }, innerW = W - pad.l - pad.r, innerH = height - pad.t - pad.b;
  const group = innerW / Math.max(1, data.length), bar = Math.max(2, Math.min(18, (group - 6) / series.length));
  const ticks = [0, 0.5, 1].map((t) => Math.round(max * t));
  if (total === 0) return <p className="py-10 text-center text-sm text-ink-500">No activity recorded in this period yet.</p>;
  return (
    <figure>
      <svg viewBox={`0 0 ${W} ${height}`} className="w-full" role="img" aria-label={`${series.map((s) => s.label).join(' and ')} by day`}>
        {ticks.map((t) => {
          const y = pad.t + innerH - (t / max) * innerH;
          return <g key={t}><line x1={pad.l} x2={W - pad.r} y1={y} y2={y} stroke="#E4E7F0" /><text x={pad.l - 8} y={y + 4} textAnchor="end" fontSize="11" fill="#6B7491">{format(t)}</text></g>;
        })}
        {data.map((d, i) => (
          <g key={i}>
            {series.map((s, j) => {
              const v = Number(d[s.key] || 0), h = (v / max) * innerH;
              const x = pad.l + i * group + (group - bar * series.length) / 2 + j * bar;
              return <rect key={s.key} x={x} y={pad.t + innerH - h} width={bar - 1.5} height={Math.max(h, v > 0 ? 2 : 0)} rx="2.5" fill={s.color}><title>{`${d[labelKey]}: ${s.label} ${format(v)}`}</title></rect>;
            })}
            {(data.length <= 16 || i % Math.ceil(data.length / 10) === 0) && (
              <text x={pad.l + i * group + group / 2} y={height - 8} textAnchor="middle" fontSize="10.5" fill="#6B7491">{String(d[labelKey]).slice(5)}</text>
            )}
          </g>
        ))}
      </svg>
      <figcaption className="mt-2 flex flex-wrap gap-4 text-xs text-ink-600">
        {series.map((s) => <span key={s.key} className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: s.color }} />{s.label}</span>)}
      </figcaption>
    </figure>
  );
}

export function ProgressBar({ value, max, label }: { value: number; max: number; label?: string }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div>
      {label && <div className="mb-1 flex justify-between text-xs text-ink-500"><span>{label}</span><span className="num">{pct}%</span></div>}
      <div className="h-2 overflow-hidden rounded-full bg-ink-100" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
        <div className="h-full rounded-full bg-gradient-to-r from-brand-500 to-sky-500" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
