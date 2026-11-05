import { test } from 'node:test';
import assert from 'node:assert/strict';
import { budgetUse, byCategory, cleanTx, daily, filterTx, inMonth, load, money, newestFirst, parseSaved, sample, save, signed, toCents, toCsv, totals, weekly } from '../src/lib/money.js';

const tx = (type, amount, date, extra = {}) => cleanTx({ type, amount, date, description: extra.description ?? 'x', category: extra.category, note: extra.note }).tx;
const memory = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)) }; };

test('amounts are whole cents, read the way people type them', () => {
  assert.equal(toCents('12.5'), 1250);
  assert.equal(toCents('$1,234.56'), 123456);
  assert.equal(toCents('7'), 700);
  assert.equal(toCents('0.1') + toCents('0.2'), toCents('0.3'));
  for (const bad of ['', 'abc', '1.234', '-5', '1e3']) assert.equal(toCents(bad), null, bad);
  assert.equal(money(123450), '$1,234.50');
  assert.equal(money(-1200, { sign: true }), '−$12.00');
  assert.equal(money(1200, { sign: true }), '+$12.00');
});

test('a transaction needs a type, an amount above zero, a date and a description', () => {
  assert.match(cleanTx({ type: 'x' }).error, /income or expense/);
  assert.match(cleanTx({ type: 'expense', amount: '0' }).error, /above \$0/);
  assert.match(cleanTx({ type: 'expense', amount: '5', date: 'soon' }).error, /date/);
  assert.match(cleanTx({ type: 'expense', amount: '5', date: '2026-11-05', description: ' ' }).error, /description/);
  const r = cleanTx({ type: 'expense', amount: '5.25', date: '2026-11-05', description: '  Coffee   beans ', category: 'Salary' });
  assert.equal(r.tx.amount, 525);
  assert.equal(r.tx.description, 'Coffee beans');
  assert.equal(r.tx.category, 'Other', 'an income category can’t be used for an expense');
});

test('totals, balance and savings rate', () => {
  const txs = [tx('income', 300000, '2026-11-01'), tx('expense', 145000, '2026-11-02'), tx('expense', 5000, '2026-11-03')];
  assert.deepEqual(totals(txs), { income: 300000, expense: 150000, balance: 150000, savingsRate: 50 });
  assert.equal(signed(txs[1]), -145000);
  assert.deepEqual(totals([]), { income: 0, expense: 0, balance: 0, savingsRate: 0 });
});

test('spending by category, biggest first, with shares', () => {
  const txs = [tx('expense', 300, '2026-11-01', { category: 'Dining' }), tx('expense', 100, '2026-11-01', { category: 'Transport' }), tx('expense', 100, '2026-11-02', { category: 'Dining' }), tx('income', 999, '2026-11-02')];
  const c = byCategory(txs);
  assert.deepEqual(c.map((x) => [x.category, x.amount]), [['Dining', 400], ['Transport', 100]]);
  assert.equal(c[0].share, 0.8);
});

test('daily and weekly series end today, Monday to Sunday', () => {
  const txs = [tx('income', 1000, '2026-11-05'), tx('expense', 400, '2026-11-02'), tx('expense', 50, '2026-10-26')];
  const d = daily(txs, '2026-11-05');
  assert.equal(d.length, 7);
  assert.equal(d[6].date, '2026-11-05');
  assert.equal(d[6].income, 1000);
  assert.equal(d[3].expense, 400);
  const w = weekly(txs, '2026-11-05', 3);    // 2026-11-05 is a Thursday
  assert.deepEqual(w.map((x) => x.start), ['2026-10-19', '2026-10-26', '2026-11-02']);
  assert.deepEqual(w.map((x) => x.expense), [0, 50, 400]);
});

test('budgets: used, left and over, for one month only', () => {
  const txs = [tx('expense', 9000, '2026-11-03', { category: 'Dining' }), tx('expense', 5000, '2026-11-04', { category: 'Dining' }), tx('expense', 9999, '2026-10-30', { category: 'Dining' }), tx('expense', 2000, '2026-11-01', { category: 'Groceries' })];
  const b = budgetUse(txs, { Dining: 12000, Groceries: 40000, Health: 0 }, '2026-11');
  assert.deepEqual(b.map((x) => [x.category, x.used, x.over]), [['Dining', 14000, true], ['Groceries', 2000, false]]);
  assert.equal(b[0].left, -2000);
  assert.equal(b[0].percent, 117);
  assert.equal(inMonth(txs, '2026-10').length, 1);
});

test('search and filters, newest first', () => {
  const txs = [tx('expense', 100, '2026-11-01', { description: 'Gas station', category: 'Transport' }), tx('income', 100, '2026-11-03', { description: 'Paycheck', category: 'Salary' }), tx('expense', 100, '2026-10-20', { description: 'Gas bill', category: 'Utilities' })];
  assert.equal(filterTx(txs, { q: 'gas' }).length, 2);
  assert.equal(filterTx(txs, { q: 'gas', month: '2026-11' }).length, 1);
  assert.equal(filterTx(txs, { type: 'income' })[0].description, 'Paycheck');
  assert.equal(filterTx(txs, { category: 'Utilities' }).length, 1);
  assert.deepEqual(newestFirst(txs).map((t) => t.date), ['2026-11-03', '2026-11-01', '2026-10-20']);
});

test('CSV export quotes text and defuses spreadsheet formulas', () => {
  const csv = toCsv([tx('expense', 1250, '2026-11-05', { description: '=HYPERLINK("evil")', note: 'said "hi"' })]);
  const [head, row] = csv.trim().split('\r\n');
  assert.equal(head, 'Date,Type,Category,Description,Amount,Note');
  assert.equal(row, '2026-11-05,"expense","Other","\'=HYPERLINK(""evil"")",-12.50,"said ""hi"""');
});

test('saving and loading keep only valid data', () => {
  const s = memory();
  const state = sample('2026-11-05');
  assert.ok(save(state, s));
  assert.deepEqual(load(s), state);
  assert.deepEqual(load(memory(), () => 'first'), 'first');
  const r = parseSaved(JSON.stringify({ txs: [{ id: 'a', type: 'expense', amount: 100, date: '2026-11-01', description: 'ok' }, { type: 'nope' }, null], budgets: { Dining: 500, Salary: 100, Health: -1 } }));
  assert.equal(r.txs.length, 1);
  assert.deepEqual(r.budgets, { Dining: 500 });
  s.setItem('finance-tracker', 'junk');
  assert.equal(load(s, () => 'fallback'), 'fallback');
});

test('the example month balances to a believable picture', () => {
  const { txs, budgets } = sample('2026-11-05');
  const t = totals(txs);
  assert.ok(t.income > t.expense);
  assert.ok(Object.keys(budgets).length >= 3);
  assert.ok(txs.every((x) => x.date <= '2026-11-05'));
});
