const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const multer = require('multer');
const QRCode = require('qrcode');

const { encrypt, decrypt } = require('./lib/encryption');
const { buildURI, splitIntoBatches, estimateURILength, validateAddress, formatAmount } = require('./lib/zip321');
const { getZECPrice, usdToZec } = require('./lib/price');
const { parseCSV } = require('./lib/csv');

const app = express();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 1_000_000 } });

const DATA_FILE = path.join(__dirname, 'data', 'payroll.enc');
const PORT = 3001;
const MAX_NAME_LENGTH = 256;

// Session state (single-user app)
let sessionPassphrase = null;

// In-memory data cache to prevent race conditions
let cachedData = null;

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));

// --- Data helpers ---

function emptyData() {
  return {
    recipients: [],
    batches: [],
    schedule: { frequency: 'biweekly', lastPayout: null, nextPayout: null },
  };
}

function loadData() {
  if (!sessionPassphrase) return null;
  if (cachedData) return cachedData;

  if (!fs.existsSync(DATA_FILE)) {
    cachedData = emptyData();
    saveData(cachedData);
    return cachedData;
  }
  try {
    const raw = fs.readFileSync(DATA_FILE, 'utf8');
    cachedData = JSON.parse(decrypt(raw, sessionPassphrase));
    return cachedData;
  } catch (e) {
    cachedData = null;
    throw new Error('Failed to load data: ' + e.message);
  }
}

function saveData(data) {
  const json = JSON.stringify(data);
  fs.writeFileSync(DATA_FILE, encrypt(json, sessionPassphrase));
  cachedData = data;
}

function requireAuth(req, res, next) {
  if (!sessionPassphrase) return res.redirect('/unlock');
  try {
    loadData();
    next();
  } catch {
    sessionPassphrase = null;
    cachedData = null;
    res.redirect('/unlock');
  }
}

function daysUntil(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  const diff = d - new Date();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

// Validate a single recipient object (reused in import/confirm and batch/generate)
function validateRecipient(r) {
  if (!r.name || typeof r.name !== 'string' || r.name.trim().length === 0) {
    return 'Missing name';
  }
  if (r.name.length > MAX_NAME_LENGTH) {
    return `Name too long (max ${MAX_NAME_LENGTH} chars)`;
  }
  try {
    validateAddress(r.address);
  } catch (e) {
    return e.message;
  }
  const amt = Number(r.amount);
  if (!Number.isFinite(amt) || amt <= 0) {
    return 'Invalid amount';
  }
  if (r.currency && !['USD', 'ZEC'].includes(r.currency)) {
    return 'Currency must be USD or ZEC';
  }
  return null;
}

// Validate a payment object for batch generation
function validatePayment(p) {
  try {
    validateAddress(p.address);
  } catch (e) {
    return e.message;
  }
  const amt = Number(p.amount);
  if (!Number.isFinite(amt) || amt <= 0) {
    return 'Invalid amount';
  }
  return null;
}

// --- Routes ---

app.get('/unlock', (req, res) => {
  res.render('unlock', { error: null });
});

app.post('/unlock', (req, res) => {
  const { passphrase } = req.body;
  if (!passphrase || passphrase.length < 4) {
    return res.render('unlock', { error: 'Passphrase must be at least 4 characters.' });
  }

  if (fs.existsSync(DATA_FILE)) {
    try {
      const raw = fs.readFileSync(DATA_FILE, 'utf8');
      JSON.parse(decrypt(raw, passphrase));
    } catch {
      return res.render('unlock', { error: 'Wrong passphrase.' });
    }
  }

  sessionPassphrase = passphrase;
  cachedData = null; // force reload from disk
  loadData();
  res.redirect('/');
});

app.get('/lock', (req, res) => {
  sessionPassphrase = null;
  cachedData = null;
  res.redirect('/unlock');
});

app.get('/', requireAuth, (req, res) => {
  const data = loadData();
  const nextDays = daysUntil(data.schedule.nextPayout);
  res.render('dashboard', {
    data,
    nextDays,
    page: 'dashboard',
  });
});

// --- Recipients ---

app.get('/recipients', requireAuth, (req, res) => {
  const data = loadData();
  res.render('recipients', { data, error: null, page: 'recipients' });
});

app.post('/recipients', requireAuth, (req, res) => {
  const { name, address, amount, currency } = req.body;
  const data = loadData();

  if (!name || name.trim().length === 0) {
    return res.render('recipients', { data, error: 'Name is required.', page: 'recipients' });
  }
  if (name.length > MAX_NAME_LENGTH) {
    return res.render('recipients', { data, error: `Name too long (max ${MAX_NAME_LENGTH} chars).`, page: 'recipients' });
  }

  try {
    validateAddress(address);
  } catch (e) {
    return res.render('recipients', { data, error: e.message, page: 'recipients' });
  }

  const amt = parseFloat(amount);
  if (!Number.isFinite(amt) || amt <= 0) {
    return res.render('recipients', { data, error: 'Amount must be a positive number.', page: 'recipients' });
  }

  if (!['USD', 'ZEC'].includes(currency)) {
    return res.render('recipients', { data, error: 'Currency must be USD or ZEC.', page: 'recipients' });
  }

  data.recipients.push({
    id: crypto.randomUUID(),
    name: name.trim().slice(0, MAX_NAME_LENGTH),
    address: address.trim(),
    amount: amt,
    currency,
  });
  saveData(data);
  res.redirect('/recipients');
});

app.post('/recipients/:id/delete', requireAuth, (req, res) => {
  const data = loadData();
  data.recipients = data.recipients.filter((r) => r.id !== req.params.id);
  saveData(data);
  res.redirect('/recipients');
});

// --- CSV Import ---

app.get('/import', requireAuth, (req, res) => {
  res.render('import', { result: null, page: 'import' });
});

app.post('/import', requireAuth, upload.single('csv'), (req, res) => {
  if (!req.file) {
    return res.render('import', { result: { valid: [], errors: [{ row: 0, message: 'No file uploaded.' }] }, page: 'import' });
  }
  const result = parseCSV(req.file.buffer);
  res.render('import', { result, page: 'import' });
});

app.post('/import/confirm', requireAuth, (req, res) => {
  const { recipients: jsonStr } = req.body;
  let imported;
  try {
    imported = JSON.parse(jsonStr);
  } catch {
    return res.redirect('/import');
  }

  if (!Array.isArray(imported) || imported.length === 0) {
    return res.redirect('/import');
  }

  const data = loadData();
  const errors = [];

  for (const r of imported) {
    const err = validateRecipient(r);
    if (err) {
      errors.push(`${r.name || 'Unknown'}: ${err}`);
      continue;
    }
    data.recipients.push({
      id: crypto.randomUUID(),
      name: String(r.name).trim().slice(0, MAX_NAME_LENGTH),
      address: String(r.address).trim(),
      amount: Number(r.amount),
      currency: r.currency || 'ZEC',
    });
  }

  saveData(data);

  if (errors.length > 0) {
    return res.render('import', {
      result: { valid: [], errors: errors.map((msg, i) => ({ row: i, message: msg })) },
      page: 'import',
    });
  }

  res.redirect('/recipients');
});

// --- Batch ---

app.get('/batch/new', requireAuth, async (req, res) => {
  const data = loadData();
  if (data.recipients.length === 0) {
    return res.redirect('/recipients');
  }

  let priceInfo;
  try {
    priceInfo = await getZECPrice();
  } catch (e) {
    return res.render('batch', {
      error: 'Price fetch failed. Try again.',
      preview: null, qrCodes: null, rawURIs: null, page: 'batch',
    });
  }

  const preview = data.recipients.map((r) => {
    const zecAmount = r.currency === 'USD' ? usdToZec(r.amount, priceInfo.price) : r.amount;
    return { ...r, zecAmount };
  });

  const totalZec = preview.reduce((sum, r) => sum + r.zecAmount, 0);
  const totalUsd = preview.reduce((sum, r) => {
    return sum + (r.currency === 'USD' ? r.amount : r.amount * priceInfo.price);
  }, 0);

  res.render('batch', {
    error: null,
    preview,
    priceInfo,
    totalZec,
    totalUsd,
    isTest: false,
    qrCodes: null,
    rawURIs: null,
    page: 'batch',
  });
});

app.get('/batch/test', requireAuth, async (req, res) => {
  const data = loadData();
  if (data.recipients.length === 0) {
    return res.redirect('/recipients');
  }

  const preview = data.recipients.map((r) => ({
    ...r,
    zecAmount: 0.001,
    originalAmount: r.amount,
    originalCurrency: r.currency,
  }));

  res.render('batch', {
    error: null,
    preview,
    priceInfo: { price: null, stale: false },
    totalZec: preview.length * 0.001,
    totalUsd: null,
    isTest: true,
    qrCodes: null,
    rawURIs: null,
    page: 'batch',
  });
});

app.post('/batch/generate', requireAuth, async (req, res) => {
  const { payments: jsonStr, isTest } = req.body;
  let payments;
  try {
    payments = JSON.parse(jsonStr);
  } catch {
    return res.redirect('/batch/new');
  }

  if (!Array.isArray(payments) || payments.length === 0) {
    return res.redirect('/batch/new');
  }

  // Re-validate all payments before generating URIs
  for (const p of payments) {
    const err = validatePayment(p);
    if (err) {
      return res.render('batch', {
        error: `Invalid payment data: ${err}`,
        preview: null, qrCodes: null, rawURIs: null, page: 'batch',
      });
    }
  }

  let batches, qrCodes, rawURIs;
  try {
    batches = splitIntoBatches(payments);
    qrCodes = [];
    rawURIs = [];

    for (const batch of batches) {
      const uri = buildURI(batch);
      rawURIs.push(uri);
      const qr = await QRCode.toDataURL(uri, {
        errorCorrectionLevel: 'L',
        width: 800,
        margin: 2,
      });
      qrCodes.push(qr);
    }
  } catch (e) {
    return res.render('batch', {
      error: `Failed to generate payment URI: ${e.message}`,
      preview: null, qrCodes: null, rawURIs: null, page: 'batch',
    });
  }

  // Save batch record
  const data = loadData();
  const batchRecord = {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    recipientCount: payments.length,
    totalZec: payments.reduce((s, p) => s + Number(p.amount), 0),
    isTest: isTest === 'true',
    status: 'pending',
  };
  data.batches.unshift(batchRecord);
  saveData(data);

  res.render('batch-result', {
    qrCodes,
    rawURIs,
    batches,
    batchRecord,
    page: 'batch',
  });
});

app.post('/batch/:id/mark-sent', requireAuth, (req, res) => {
  const data = loadData();
  const batch = data.batches.find((b) => b.id === req.params.id);
  if (batch) {
    batch.status = 'sent';
    const now = new Date();
    data.schedule.lastPayout = now.toISOString();
    const next = new Date(now);
    next.setDate(next.getDate() + 14);
    data.schedule.nextPayout = next.toISOString();
  }
  saveData(data);
  res.redirect('/');
});

app.listen(PORT, () => {
  console.log(`ZEC Payroll running at http://localhost:${PORT}`);
});
