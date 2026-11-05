// The money rules, with no React. Amounts are whole cents (integers), never floating-point dollars,
// so 0.10 + 0.20 is exactly 0.30 and totals never drift.

export const CATEGORIES = {
  income: ['Salary', 'Freelance', 'Bonus', 'Gifts', 'Other income'],
  expense: ['Housing', 'Groceries', 'Dining', 'Transport', 'Utilities', 'Health', 'Shopping', 'Entertainment', 'Subscriptions', 'Other'],
};
const DATE = /^\d{4}-\d{2}-\d{2}$/;
let counter = 0;
const newId = () => `x${Date.now().toString(36)}${(counter++).toString(36)}`;

/** "1,234.5" or "$12" → cents (123450, 1200); null if it isn't a money amount. */
export function toCents(text) {
  const s = String(text ?? '').trim().replace(/[$,\s]/g, '');
  if (!/^\d+(\.\d{0,2})?$/.test(s)) return null;
  const [whole, frac = ''] = s.split('.');
  return Number(whole) * 100 + Number(frac.padEnd(2, '0'));
}

const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
/** 123450 → "$1,234.50"; with sign: "−$12.00" or "+$12.00". */
export function money(cents, { sign = false } = {}) {
  const s = usd.format(Math.abs(cents) / 100);
  if (!sign || cents === 0) return cents < 0 ? `−${s}` : s;
  return cents < 0 ? `−${s}` : `+${s}`;
}

/** Checks a transaction from the form or a saved file: { ok, tx } or { ok: false, error }. */
export function cleanTx(input, existing = {}) {
  const type = input.type === 'income' ? 'income' : input.type === 'expense' ? 'expense' : null;
  if (!type) return { ok: false, error: 'Choose income or expense.' };
  const amount = typeof input.amount === 'number' ? input.amount : toCents(input.amount);
  if (!Number.isInteger(amount) || amount <= 0) return { ok: false, error: 'Enter an amount above $0, like 12.50.' };
  if (amount > 100_000_000_00) return { ok: false, error: 'That amount is too large.' };
  const date = String(input.date ?? '');
  if (!DATE.test(date) || Number.isNaN(Date.parse(date))) return { ok: false, error: 'Choose a date.' };
  const description = String(input.description ?? '').replace(/\s+/g, ' ').trim().slice(0, 80);
  if (!description) return { ok: false, error: 'Add a short description, like “Groceries at Publix”.' };
  const category = CATEGORIES[type].includes(input.category) ? input.category : type === 'income' ? 'Other income' : 'Other';
  return { ok: true, tx: { id: existing.id ?? input.id ?? newId(), type, amount, date, description, category, note: String(input.note ?? '').trim().slice(0, 200) } };
}

/** The signed value of a transaction: income adds, expenses subtract. */
export const signed = (tx) => (tx.type === 'income' ? tx.amount : -tx.amount);

export function totals(txs) {
  let income = 0, expense = 0;
  for (const t of txs) t.type === 'income' ? (income += t.amount) : (expense += t.amount);
  return { income, expense, balance: income - expense, savingsRate: income ? Math.round((100 * (income - expense)) / income) : 0 };
}

export const inMonth = (txs, ym) => txs.filter((t) => t.date.startsWith(ym));
export const monthKey = (iso) => iso.slice(0, 7);

/** Expense totals per category, biggest first, with each one's share of spending. */
export function byCategory(txs, type = 'expense') {
  const map = new Map();
  for (const t of txs) if (t.type === type) map.set(t.category, (map.get(t.category) ?? 0) + t.amount);
  const total = [...map.values()].reduce((a, b) => a + b, 0);
  return [...map].map(([category, amount]) => ({ category, amount, share: total ? amount / total : 0 })).sort((a, b) => b.amount - a.amount);
}

function addDays(iso, n) {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Income and expenses for each of the last `days` days, ending today (for the weekly chart). */
export function daily(txs, today, days = 7) {
  const out = [];
  for (let i = days - 1; i >= 0; i--) {
    const date = addDays(today, -i);
    const day = txs.filter((t) => t.date === date);
    out.push({ date, ...totals(day) });
  }
  return out;
}

/** Income and expenses for each of the last `weeks` weeks (Monday to Sunday), ending this week. */
export function weekly(txs, today, weeks = 8) {
  const dow = (new Date(`${today}T12:00:00Z`).getUTCDay() + 6) % 7; // Monday = 0
  const thisMonday = addDays(today, -dow);
  const out = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const start = addDays(thisMonday, -7 * i);
    const end = addDays(start, 6);
    out.push({ start, end, ...totals(txs.filter((t) => t.date >= start && t.date <= end)) });
  }
  return out;
}

/** How much of each budget is used this month. Over 100% means over budget. */
export function budgetUse(txs, budgets, ym) {
  const spent = new Map(byCategory(inMonth(txs, ym)).map((c) => [c.category, c.amount]));
  return Object.entries(budgets).filter(([, limit]) => limit > 0).map(([category, limit]) => {
    const used = spent.get(category) ?? 0;
    return { category, limit, used, left: limit - used, percent: Math.round((100 * used) / limit), over: used > limit };
  }).sort((a, b) => b.percent - a.percent);
}

/** Search words in the description, note or category, plus type, category and month filters. */
export function filterTx(txs, f = {}) {
  const words = String(f.q ?? '').toLowerCase().split(/\s+/).filter(Boolean);
  return txs.filter((t) => {
    const hay = `${t.description} ${t.note} ${t.category}`.toLowerCase();
    return words.every((w) => hay.includes(w)) && (!f.type || t.type === f.type) && (!f.category || t.category === f.category)
      && (!f.month || t.date.startsWith(f.month));
  });
}

/** Newest first; same-day transactions keep the order they were added. */
export const newestFirst = (txs) => [...txs].sort((a, b) => (a.date === b.date ? 0 : a.date < b.date ? 1 : -1));

/**
 * A CSV file for spreadsheets. Every text field is quoted, and a value starting with = + - @
 * gets a leading ' so a spreadsheet won't run it as a formula.
 */
export function toCsv(txs) {
  const cell = (v) => {
    let s = String(v ?? '');
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
    return `"${s.replace(/"/g, '""')}"`;
  };
  const rows = newestFirst(txs).map((t) => [t.date, cell(t.type), cell(t.category), cell(t.description), (signed(t) / 100).toFixed(2), cell(t.note)].join(','));
  return ['Date,Type,Category,Description,Amount,Note', ...rows].join('\r\n') + '\r\n';
}

// ---- saving ----

export const KEY = 'finance-tracker';

export function load(storage = globalThis.localStorage, fallback = () => ({ txs: [], budgets: {} })) {
  try {
    const raw = storage?.getItem(KEY);
    if (raw == null) return fallback();
    return parseSaved(raw);
  } catch {
    return fallback();
  }
}

export function parseSaved(text) {
  const data = JSON.parse(text);
  const txs = [];
  const seen = new Set();
  for (const t of Array.isArray(data?.txs) ? data.txs : []) {
    if (!t || typeof t !== 'object') continue;
    const r = cleanTx(t, { id: typeof t?.id === 'string' && !seen.has(t.id) ? t.id : newId() });
    if (r.ok) { seen.add(r.tx.id); txs.push(r.tx); }
  }
  const budgets = {};
  for (const [k, v] of Object.entries(data?.budgets ?? {})) if (CATEGORIES.expense.includes(k) && Number.isInteger(v) && v > 0) budgets[k] = v;
  return { txs, budgets };
}

export function save(state, storage = globalThis.localStorage) {
  try { storage?.setItem(KEY, JSON.stringify({ version: 1, txs: state.txs, budgets: state.budgets })); return true; } catch { return false; }
}

/** Example data for the first visit: a month of everyday income and spending, ending today. */
export function sample(today) {
  const d = (n) => addDays(today, -n);
  const rows = [
    ['income', 'Salary', 'Paycheck', 2150_00, 1], ['income', 'Salary', 'Paycheck', 2150_00, 15],
    ['income', 'Freelance', 'Website fix for a client', 320_00, 6], ['income', 'Bonus', 'Quarterly bonus', 250_00, 20],
    ['expense', 'Housing', 'Rent', 1450_00, 2], ['expense', 'Groceries', 'Groceries', 86_42, 0], ['expense', 'Groceries', 'Groceries', 112_17, 7],
    ['expense', 'Groceries', 'Groceries', 64_90, 14], ['expense', 'Dining', 'Lunch with coworkers', 18_75, 3], ['expense', 'Dining', 'Pizza night', 31_20, 9],
    ['expense', 'Transport', 'Gas', 42_10, 4], ['expense', 'Transport', 'Gas', 39_85, 12], ['expense', 'Utilities', 'Electric bill', 128_33, 10],
    ['expense', 'Utilities', 'Phone', 45_00, 18], ['expense', 'Subscriptions', 'Music streaming', 10_99, 5], ['expense', 'Subscriptions', 'Cloud storage', 2_99, 11],
    ['expense', 'Health', 'Pharmacy', 14_50, 8], ['expense', 'Entertainment', 'Movie tickets', 26_00, 1], ['expense', 'Shopping', 'Running shoes', 89_99, 16],
  ];
  return {
    txs: rows.map(([type, category, description, amount, ago]) => cleanTx({ type, category, description, amount, date: d(ago) }).tx),
    budgets: { Groceries: 400_00, Dining: 120_00, Transport: 150_00, Entertainment: 60_00 },
  };
}
