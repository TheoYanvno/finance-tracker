import { money } from '../lib/money.js';

const dayLabel = (iso) => new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' });
const weekLabel = (iso) => new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });

/** Income (light) and spending (striped) side by side for each day or week, with a table for screen readers. */
export function Bars({ series, mode }) {
  const w = 420, h = 200, top = 12, bottom = 26, left = 6;
  const max = Math.max(1, ...series.flatMap((s) => [s.income, s.expense]));
  const plotH = h - top - bottom;
  const step = (w - left) / series.length;
  const bw = Math.min(22, step * 0.32);
  const label = (s) => (mode === 'week' ? weekLabel(s.start) : dayLabel(s.date));
  return (
    <figure className="bars">
      <svg viewBox={`0 0 ${w} ${h}`} role="img" aria-label={`Income and spending for the last ${series.length} ${mode === 'week' ? 'weeks' : 'days'}`}>
        <defs>
          <pattern id="stripes" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="3" height="6" className="stripe" /></pattern>
        </defs>
        <line className="baseline" x1={left} x2={w} y1={top + plotH} y2={top + plotH} />
        {[0.25, 0.5, 0.75, 1].map((f) => <line key={f} className="gridline" x1={left} x2={w} y1={top + plotH * (1 - f)} y2={top + plotH * (1 - f)} />)}
        {series.map((s, i) => {
          const x = left + i * step + step / 2;
          const ih = Math.max(s.income ? 3 : 0, plotH * (s.income / max));
          const eh = Math.max(s.expense ? 3 : 0, plotH * (s.expense / max));
          return (
            <g key={s.date ?? s.start}>
              {ih > 0 && <rect className="bar-in" x={x - bw - 2} y={top + plotH - ih} width={bw} height={ih} rx={Math.min(bw / 2, ih / 2)}><title>{`${label(s)} income: ${money(s.income)}`}</title></rect>}
              {eh > 0 && <rect className="bar-out" x={x + 2} y={top + plotH - eh} width={bw} height={eh} rx={Math.min(bw / 2, eh / 2)}><title>{`${label(s)} spending: ${money(s.expense)}`}</title></rect>}
              <text className="axis" x={x} y={h - 8} textAnchor="middle">{label(s)}</text>
            </g>
          );
        })}
      </svg>
      <figcaption className="legend"><span className="key in" /> Income <span className="key out" /> Spending</figcaption>
      <table className="sr-only">
        <caption>Income and spending</caption>
        <thead><tr><th scope="col">Period</th><th scope="col">Income</th><th scope="col">Spending</th></tr></thead>
        <tbody>{series.map((s) => <tr key={s.date ?? s.start}><th scope="row">{label(s)}</th><td>{money(s.income)}</td><td>{money(s.expense)}</td></tr>)}</tbody>
      </table>
    </figure>
  );
}

/**
 * A half-circle of segments: how much of the month's income has been spent. Lit segments are
 * spending; the rest is what's left. Over 100% lights them all in the warning color.
 */
export function Gauge({ income, expense }) {
  const n = 24, cx = 120, cy = 118, r1 = 74, r2 = 104;
  const pct = income ? expense / income : expense ? 1.01 : 0;
  const lit = Math.min(n, Math.round(pct * n));
  return (
    <div className="gauge">
      <svg viewBox="0 0 240 130" role="img" aria-label={income ? `${Math.round(pct * 100)}% of this month's income spent` : 'No income recorded this month'}>
        {Array.from({ length: n }, (_, i) => {
          const a = Math.PI - (Math.PI * (i + 0.5)) / n;
          const x1 = cx + r1 * Math.cos(a), y1 = cy - r1 * Math.sin(a), x2 = cx + r2 * Math.cos(a), y2 = cy - r2 * Math.sin(a);
          return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} className={i < lit ? (pct > 1 ? 'seg over' : 'seg on') : 'seg'} />;
        })}
      </svg>
      <p className="gauge-num"><strong>{income ? `${Math.round(pct * 100)}%` : '–'}</strong><span>of income spent</span></p>
    </div>
  );
}
