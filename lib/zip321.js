// zip321.js — ZIP-321 multi-payment URI builder
// https://zips.z.cash/zip-0321

const SHIELDED = ['zs1', 'u1'];
const TRANSPARENT = ['t1', 't3'];
const MAX_ZEC = 21_000_000;
const MAX_MEMO = 512;

function formatAmount(zec) {
  const n = Number(zec);
  if (!Number.isFinite(n) || n <= 0) throw new Error(`Invalid amount: ${zec}`);
  if (n > MAX_ZEC) throw new Error(`Amount exceeds max supply: ${n}`);
  return n.toFixed(8).replace(/\.?0+$/, '');
}

function encodeMemo(text) {
  const buf = Buffer.from(text, 'utf8');
  if (buf.byteLength > MAX_MEMO) throw new Error(`Memo exceeds ${MAX_MEMO} bytes`);
  return buf.toString('base64url');
}

function validateAddress(address) {
  if (!address || typeof address !== 'string') throw new Error('Address is required');
  const addr = address.trim();
  if (TRANSPARENT.some(p => addr.startsWith(p)))
    throw new Error('Transparent address rejected. Only shielded addresses (zs1/u1) are accepted.');
  if (!SHIELDED.some(p => addr.startsWith(p)))
    throw new Error(`Unrecognized address. Expected ${SHIELDED.join(' or ')} prefix.`);
  return addr;
}

function paymentParams(payment, idx) {
  const s = idx === 0 ? '' : `.${idx}`;
  const p = [`address${s}=${payment.address}`, `amount${s}=${formatAmount(payment.amount)}`];
  if (payment.label) p.push(`label${s}=${encodeURIComponent(payment.label)}`);
  if (payment.memo) p.push(`memo${s}=${encodeMemo(payment.memo)}`);
  return p;
}

function buildURI(payments) {
  if (!Array.isArray(payments) || !payments.length) throw new Error('At least one payment required');
  for (const p of payments) p.address = validateAddress(p.address);

  if (payments.length === 1) {
    const p = payments[0];
    const q = [`amount=${formatAmount(p.amount)}`];
    if (p.label) q.push(`label=${encodeURIComponent(p.label)}`);
    if (p.memo) q.push(`memo=${encodeMemo(p.memo)}`);
    return `zcash:${p.address}?${q.join('&')}`;
  }

  // Multi-payment: bare params for index 0, then .1, .2, ...
  const params = [];
  for (let i = 0; i < payments.length; i++) {
    params.push(...paymentParams(payments[i], i === 0 ? 0 : i));
  }
  return `zcash:?${params.join('&')}`;
}

function splitIntoBatches(payments, max = 15) {
  const out = [];
  for (let i = 0; i < payments.length; i += max) out.push(payments.slice(i, i + max));
  return out;
}

function estimateURILength(payments) {
  return 7 + payments.reduce((sum, p, i) => {
    const s = i === 0 ? '' : `.${i}`;
    let len = 8 + s.length + p.address.length;
    len += 8 + s.length + formatAmount(p.amount).length;
    if (p.label) len += 7 + s.length + encodeURIComponent(p.label).length;
    if (p.memo) len += 6 + s.length + encodeMemo(p.memo).length;
    return sum + len;
  }, 0);
}

if (require.main === module) {
  const addr1 = 'zs1x39jyznkrcv08h43k3jhatl5e60hxmjgm0xna4slsm2n8edq7g0fmj2kruy58r44uss6lms7a4w';
  const addr2 = 'zs1dn22g50h7ald7e2y7tq66pscz5aysqccnj7lhz9a2rqjmyuvw0zcpmg9yjfgr2dge9rvqj3q3z3';
  const addr3 = 'zs1g2ne05kn0al3fqvgj27v7c0xkfeg2xnejhc76k5gm7fxklq5jzgq46mzauphznjsaw5yk97gamc0';

  console.log('Single:', buildURI([{ address: addr1, amount: 1.5, label: 'Test' }]));
  console.log('Multi:', buildURI([
    { address: addr1, amount: 500, label: 'Balaji' },
    { address: addr2, amount: 0.001, label: 'Donovan', memo: 'Payroll Q1' },
    { address: addr3, amount: 750, label: 'Jackson' },
  ]));

  console.log('\nAmounts:', [1.5, 0.001, 100, 0.00000001].map(a => `${a} -> ${formatAmount(a)}`).join(', '));
  console.log('Memo:', encodeMemo('Hello'));

  try { validateAddress('t1abc'); } catch (e) { console.log('Transparent rejected:', e.message); }

  const big = Array.from({ length: 35 }, (_, i) => ({ address: addr1, amount: 10, label: `R${i + 1}` }));
  console.log(`\nBatch split: ${big.length} -> ${splitIntoBatches(big).length} batches`);
}

module.exports = { buildURI, formatAmount, encodeMemo, validateAddress, splitIntoBatches, estimateURILength };
