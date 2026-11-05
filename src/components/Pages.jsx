import { useState } from 'react';
import { Bars, Gauge } from './Charts.jsx';
import { CATEGORIES, budgetUse, byCategory, daily, filterTx, inMonth, money, newestFirst, signed, toCents, totals, weekly } from '../lib/money.js';

const date = (iso) => new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
export const monthName = (ym) => new Date(`${ym}-15T12:00:00Z`).toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });

function TxTable({ txs, onEdit, empty = 'No transactions yet.' }) {
  return (
    <div className="table-wrap">
      <table className="tx">
        <thead><tr><th scope="col">Transaction</th><th scope="col">Date</th><th scope="col">Category</th><th scope="col" className="num">Amount</th><th scope="col"><span className="sr-only">Edit</span></th></tr></thead>
        <tbody>
          {txs.map((t) => (
            <tr key={t.id}>
              <td><span className={`badge ${t.type}`} aria-hidden="true">{t.type === 'income' ? '↓' : '↑'}</span> <strong>{t.description}</strong>{t.note && <small className="muted"> · {t.note}</small>}</td>
              <td>{date(t.date)}</td>
              <td><span className="pill">{t.category}</span></td>
              <td className={`num ${t.type}`}>{money(signed(t), { sign: true })}</td>
              <td><button type="button" className="round small" aria-label={`Edit ${t.description} on ${date(t.date)}`} onClick={() => onEdit(t)}>⋯</button></td>
            </tr>
          ))}
          {txs.length === 0 && <tr><td colSpan={5} className="muted">{empty}</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

export function Dashboard({ txs, budgets, month, today, onAdd, onEdit, onShowAll }) {
  const [mode, setMode] = useState('day');
  const m = inMonth(txs, month);
  const t = totals(m);
  const all = totals(txs);
  const series = mode === 'day' ? daily(txs, today, 7) : weekly(txs, today, 8);
  const periodSpend = series.reduce((s, x) => s + x.expense, 0);
  const cats = byCategory(m);
  const use = budgetUse(txs, budgets, month).slice(0, 3);
  return (
    <div className="dash">
      <section className="panel stats-panel" aria-labelledby="stat-h">
        <header><h2 id="stat-h">Statistics</h2>
          <div className="seg" role="group" aria-label="Group by">
            <button type="button" aria-pressed={mode === 'day'} onClick={() => setMode('day')}>7 days</button>
            <button type="button" aria-pressed={mode === 'week'} onClick={() => setMode('week')}>8 weeks</button>
          </div></header>
        <div className="stats-body">
          <div className="stats-sum">
            <p className="big">{money(periodSpend)}</p>
            <p className="muted">spent in the last {mode === 'day' ? '7 days' : '8 weeks'}</p>
            <ul className="mini" aria-label="Top spending this month">{cats.slice(0, 3).map((c) => <li key={c.category}><span className="dot" />{c.category} · {Math.round(c.share * 100)}%</li>)}</ul>
          </div>
          <Bars series={series} mode={mode} />
        </div>
      </section>

      <section className="panel balance" aria-labelledby="bal-h">
        <header><h2 id="bal-h">Total balance</h2></header>
        <div className="card-face">
          <p className="muted small">All transactions</p>
          <p className={`big ${all.balance < 0 ? 'neg' : ''}`}>{money(all.balance)}</p>
          <dl className="split">
            <div><dt>{monthName(month)} income</dt><dd className="income">{money(t.income)}</dd></div>
            <div><dt>Spending</dt><dd className="expense">{money(t.expense)}</dd></div>
            <div><dt>Saved</dt><dd>{t.income ? `${t.savingsRate}%` : '–'}</dd></div>
          </dl>
          <div className="actions">
            <button type="button" className="primary" onClick={() => onAdd('income')}>+ Income</button>
            <button type="button" className="ghost" onClick={() => onAdd('expense')}>+ Expense</button>
          </div>
        </div>
      </section>

      <section className="panel recent" aria-labelledby="rec-h">
        <header><h2 id="rec-h">Recent transactions</h2><button type="button" className="link" onClick={onShowAll}>See all</button></header>
        <TxTable txs={newestFirst(txs).slice(0, 5)} onEdit={onEdit} empty="Add your first income or expense to get started." />
      </section>

      <section className="panel cats" aria-labelledby="cat-h">
        <header><h2 id="cat-h">Spending by category</h2></header>
        <Gauge income={t.income} expense={t.expense} />
        <ul className="cat-list">
          {cats.slice(0, 5).map((c) => (
            <li key={c.category}><span>{c.category}</span><span className="track"><span style={{ width: `${Math.round(c.share * 100)}%` }} /></span><span className="num">{money(c.amount)}</span></li>
          ))}
          {cats.length === 0 && <li className="muted">No spending in {monthName(month)} yet.</li>}
        </ul>
        {use.some((b) => b.over) && <p className="warn small">Over budget: {use.filter((b) => b.over).map((b) => b.category).join(', ')}</p>}
      </section>
    </div>
  );
}

export function Transactions({ txs, onEdit, onAdd, onExport }) {
  const [f, setF] = useState({ q: '', type: '', category: '', month: '' });
  const months = [...new Set(txs.map((t) => t.date.slice(0, 7)))].sort().reverse();
  const shown = newestFirst(filterTx(txs, f));
  const sum = totals(shown);
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value, ...(k === 'type' ? { category: '' } : {}) }));
  return (
    <section className="panel" aria-labelledby="all-h">
      <header><h2 id="all-h">Transactions</h2>
        <div className="actions"><button type="button" className="ghost" onClick={onExport}>Export CSV</button><button type="button" className="primary" onClick={() => onAdd('expense')}>+ Add</button></div></header>
      <div className="filters">
        <input type="search" placeholder="Search" aria-label="Search transactions" value={f.q} onChange={set('q')} />
        <select aria-label="Type" value={f.type} onChange={set('type')}><option value="">Income and spending</option><option value="income">Income</option><option value="expense">Spending</option></select>
        <select aria-label="Category" value={f.category} onChange={set('category')}><option value="">All categories</option>{(f.type ? CATEGORIES[f.type] : [...CATEGORIES.income, ...CATEGORIES.expense]).map((c) => <option key={c}>{c}</option>)}</select>
        <select aria-label="Month" value={f.month} onChange={set('month')}><option value="">All months</option>{months.map((m) => <option key={m} value={m}>{monthName(m)}</option>)}</select>
      </div>
      <p className="muted small">{shown.length} shown · in {money(sum.income)} · out {money(sum.expense)} · net {money(sum.balance, { sign: true })}</p>
      <TxTable txs={shown} onEdit={onEdit} empty="Nothing matches those filters." />
    </section>
  );
}

export function Budgets({ txs, budgets, month, onChange }) {
  const use = new Map(budgetUse(txs, budgets, month).map((b) => [b.category, b]));
  const [drafts, setDrafts] = useState(() => Object.fromEntries(CATEGORIES.expense.map((c) => [c, budgets[c] ? (budgets[c] / 100).toFixed(0) : ''])));
  const [msg, setMsg] = useState('');
  const commit = (cat) => {
    const raw = drafts[cat].trim();
    const cents = raw === '' ? 0 : toCents(raw);
    if (cents === null) { setMsg(`“${raw}” isn’t an amount for ${cat}.`); return; }
    setMsg('');
    onChange({ ...budgets, [cat]: cents });
  };
  return (
    <section className="panel" aria-labelledby="bud-h">
      <header><h2 id="bud-h">Monthly budgets · {monthName(month)}</h2></header>
      <p className="muted small">Set how much you plan to spend in a category each month. Leave it empty for no budget.</p>
      {msg && <p className="form-error" role="alert">{msg}</p>}
      <ul className="budgets">
        {CATEGORIES.expense.map((cat) => {
          const b = use.get(cat);
          return (
            <li key={cat}>
              <label><span>{cat}</span>
                <span className="money-input">$<input inputMode="decimal" value={drafts[cat]} placeholder="—" onChange={(e) => setDrafts((d) => ({ ...d, [cat]: e.target.value }))}
                  onBlur={() => commit(cat)} onKeyDown={(e) => e.key === 'Enter' && commit(cat)} aria-label={`${cat} budget in dollars`} /></span></label>
              {b ? (
                <>
                  <span className={`track ${b.over ? 'over' : b.percent >= 80 ? 'near' : ''}`} role="img" aria-label={`${b.percent}% of the ${cat} budget used`}><span style={{ width: `${Math.min(100, b.percent)}%` }} /></span>
                  <span className={`small ${b.over ? 'warn' : 'muted'}`}>{money(b.used)} of {money(b.limit)} · {b.over ? `${money(-b.left)} over` : `${money(b.left)} left`}</span>
                </>
              ) : <span className="muted small">No budget</span>}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
