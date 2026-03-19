// csv.js — parse and validate payroll CSV imports

const { parse } = require('csv-parse/sync');
const { validateAddress } = require('./zip321');

const REQUIRED = ['name', 'wallet_address', 'amount', 'currency'];
const CURRENCIES = ['USD', 'ZEC'];

function parseCSV(buffer) {
  let records;
  try {
    records = parse(buffer.toString('utf8'), {
      columns: true, trim: true, skip_empty_lines: true, relax_column_count: true,
    });
  } catch (e) {
    return { valid: [], errors: [{ row: 0, message: `Parse error: ${e.message}` }] };
  }

  if (!records.length) return { valid: [], errors: [{ row: 0, message: 'CSV is empty' }] };

  const cols = Object.keys(records[0]);
  const missing = REQUIRED.filter(c => !cols.includes(c));
  if (missing.length) return { valid: [], errors: [{ row: 0, message: `Missing columns: ${missing.join(', ')}` }] };

  const valid = [];
  const errors = [];

  records.forEach((row, i) => {
    const n = i + 2;
    if (!row.name?.trim()) { errors.push({ row: n, message: 'Missing name' }); return; }
    try { validateAddress(row.wallet_address); } catch (e) { errors.push({ row: n, message: `${row.name}: ${e.message}` }); return; }
    const amount = parseFloat(row.amount);
    if (!Number.isFinite(amount) || amount <= 0) { errors.push({ row: n, message: `${row.name}: Invalid amount` }); return; }
    const currency = (row.currency || '').toUpperCase();
    if (!CURRENCIES.includes(currency)) { errors.push({ row: n, message: `${row.name}: Currency must be USD or ZEC` }); return; }
    valid.push({ name: row.name.trim(), address: row.wallet_address.trim(), amount, currency });
  });

  return { valid, errors };
}

module.exports = { parseCSV };
