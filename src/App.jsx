import { useEffect, useState } from 'react';
import TxForm from './components/TxForm.jsx';
import { Budgets, Dashboard, Transactions, monthName } from './components/Pages.jsx';
import { load, sample, save, toCsv } from './lib/money.js';

const PAGES = [['dashboard', 'Dashboard', 'M4 13h7V4H4zm9 7h7v-9h-7zM4 20h7v-5H4zm9-16v5h7V4z'], ['transactions', 'Transactions', 'M4 6h16M4 12h16M4 18h10'], ['budgets', 'Budgets', 'M12 3v18M5 8h11a3 3 0 0 1 0 6H8a3 3 0 0 0 0 6h11']];

function localDay(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function App({ storage = globalThis.localStorage, today = localDay() }) {
  const [state, setState] = useState(() => load(storage, () => sample(today)));
  const [page, setPage] = useState('dashboard');
  const [month, setMonth] = useState(today.slice(0, 7));
  const [editing, setEditing] = useState(null);       // { tx } or { type }
  const [note, setNote] = useState('');
  const [clearing, setClearing] = useState(false);

  useEffect(() => { if (!save(state, storage)) setNote('Your browser is blocking storage, so changes last only until you close this tab.'); }, [state, storage]);
  useEffect(() => { if (!note) return undefined; const t = setTimeout(() => setNote(''), 4500); return () => clearTimeout(t); }, [note]);

  const months = [...new Set([today.slice(0, 7), ...state.txs.map((t) => t.date.slice(0, 7))])].sort().reverse();
  const saveTx = (tx) => {
    setState((s) => ({ ...s, txs: s.txs.some((t) => t.id === tx.id) ? s.txs.map((t) => (t.id === tx.id ? tx : t)) : [...s.txs, tx] }));
    setEditing(null);
    setNote(`Saved “${tx.description}”.`);
  };
  const deleteTx = (id) => { setState((s) => ({ ...s, txs: s.txs.filter((t) => t.id !== id) })); setEditing(null); setNote('Deleted.'); };
  const exportCsv = () => {
    const url = URL.createObjectURL(new Blob([toCsv(state.txs)], { type: 'text/csv' }));
    Object.assign(document.createElement('a'), { href: url, download: `transactions-${today}.csv` }).click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  };
  const reset = () => {
    if (!clearing) { setClearing(true); setNote('Click “Clear everything” again to delete all transactions and budgets.'); return; }
    setClearing(false);
    setState({ txs: [], budgets: {} });
    setNote('Cleared. Add your own income and expenses.');
  };

  return (
    <div className="shell">
      <nav className="rail" aria-label="Pages">
        <div className="logo" aria-hidden="true"><img src="icon.svg" alt="" width="40" height="40" /></div>
        {PAGES.map(([id, label, d]) => (
          <button key={id} type="button" aria-current={page === id ? 'page' : undefined} onClick={() => setPage(id)} title={label}>
            <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d={d} /></svg><span>{label}</span>
          </button>
        ))}
      </nav>
      <div className="main">
        <header className="top">
          <div><h1>{page === 'dashboard' ? 'Dashboard overview' : PAGES.find((p) => p[0] === page)[1]}</h1><p className="muted small">Your money on this device only</p></div>
          <label className="month"><span className="sr-only">Month</span>
            <select value={month} onChange={(e) => setMonth(e.target.value)}>{months.map((m) => <option key={m} value={m}>{monthName(m)}</option>)}</select></label>
        </header>
        {page === 'dashboard' && <Dashboard txs={state.txs} budgets={state.budgets} month={month} today={today} onAdd={(type) => setEditing({ type })} onEdit={(tx) => setEditing({ tx })} onShowAll={() => setPage('transactions')} />}
        {page === 'transactions' && <Transactions txs={state.txs} onAdd={(type) => setEditing({ type })} onEdit={(tx) => setEditing({ tx })} onExport={exportCsv} />}
        {page === 'budgets' && <Budgets txs={state.txs} budgets={state.budgets} month={month} onChange={(budgets) => setState((s) => ({ ...s, budgets }))} />}
        <footer className="foot">
          <span>Everything stays in this browser; nothing is sent anywhere. Don’t enter bank account or card numbers.</span>
          {state.txs.length > 0 && <button type="button" className="link" onClick={reset}>{clearing ? 'Yes, clear everything' : 'Clear everything'}</button>}
          {state.txs.length === 0 && <button type="button" className="link" onClick={() => setState(sample(today))}>Load an example month</button>}
        </footer>
      </div>
      {editing && <TxForm tx={editing.tx} type={editing.type} today={today} onSave={saveTx} onDelete={deleteTx} onClose={() => setEditing(null)} />}
      <div className="toast" role="status" aria-live="polite">{note}</div>
    </div>
  );
}
