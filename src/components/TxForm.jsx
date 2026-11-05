import { useEffect, useRef, useState } from 'react';
import { CATEGORIES, cleanTx } from '../lib/money.js';

/** Add or edit one transaction, in a native <dialog>. */
export default function TxForm({ tx, type = 'expense', today, onSave, onDelete, onClose }) {
  const ref = useRef(null);
  const [form, setForm] = useState(() => (tx ? { ...tx, amount: (tx.amount / 100).toFixed(2) }
    : { type, amount: '', date: today, description: '', category: CATEGORIES[type][0], note: '' }));
  const [error, setError] = useState('');
  const [confirm, setConfirm] = useState(false);

  useEffect(() => { const d = ref.current; if (!d.open) d.showModal(); return () => d.open && d.close(); }, []);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const setType = (t) => setForm((f) => ({ ...f, type: t, category: CATEGORIES[t].includes(f.category) ? f.category : CATEGORIES[t][0] }));

  const submit = (e) => {
    e.preventDefault();
    const r = cleanTx(form, tx ?? {});
    if (!r.ok) { setError(r.error); return; }
    onSave(r.tx);
  };

  return (
    <dialog ref={ref} className="dlg" aria-labelledby="tx-h" onClose={onClose} onCancel={onClose}>
      <form onSubmit={submit} noValidate>
        <header><h2 id="tx-h">{tx ? 'Edit transaction' : form.type === 'income' ? 'Add income' : 'Add an expense'}</h2>
          <button type="button" className="round" aria-label="Close" onClick={onClose}>×</button></header>
        <div className="seg wide" role="group" aria-label="Type">
          {['expense', 'income'].map((t) => <button key={t} type="button" aria-pressed={form.type === t} onClick={() => setType(t)}>{t === 'income' ? 'Income' : 'Expense'}</button>)}
        </div>
        <label>Amount ($)<input inputMode="decimal" value={form.amount} onChange={set('amount')} placeholder="0.00" autoFocus /></label>
        <label>Date<input type="date" value={form.date} onChange={set('date')} max="2100-12-31" /></label>
        <label className="wide">Description<input value={form.description} onChange={set('description')} maxLength={80} placeholder={form.type === 'income' ? 'Paycheck' : 'Groceries'} /></label>
        <label>Category<select value={form.category} onChange={set('category')}>{CATEGORIES[form.type].map((c) => <option key={c}>{c}</option>)}</select></label>
        <label>Note (optional)<input value={form.note} onChange={set('note')} maxLength={200} /></label>
        {error && <p className="form-error wide" role="alert">{error}</p>}
        <footer className="wide">
          {tx && (confirm ? <button type="button" className="danger" onClick={() => onDelete(tx.id)}>Yes, delete it</button>
            : <button type="button" className="ghost" onClick={() => setConfirm(true)}>Delete…</button>)}
          <span className="spacer" />
          <button type="button" className="ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="primary">{tx ? 'Save' : 'Add'}</button>
        </footer>
      </form>
    </dialog>
  );
}
