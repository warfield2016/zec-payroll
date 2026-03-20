// price.js — ZEC/USD price with fallback sources, 60s cache

const SOURCES = [
  {
    name: 'CryptoCompare',
    url: 'https://min-api.cryptocompare.com/data/price?fsym=ZEC&tsyms=USD',
    parse: (data) => data?.USD,
  },
  {
    name: 'CoinGecko',
    url: 'https://api.coingecko.com/api/v3/simple/price?ids=zcash&vs_currencies=usd',
    parse: (data) => data?.zcash?.usd,
  },
  {
    name: 'Kraken',
    url: 'https://api.kraken.com/0/public/Ticker?pair=ZECUSD',
    parse: (data) => parseFloat(data?.result?.XZECZUSD?.c?.[0]),
  },
];

const HEADERS = { 'User-Agent': 'zec-payroll/1.0', 'Accept': 'application/json' };
const TTL = 60_000;
let cache = { price: null, at: 0 };

function makeTimeout(ms) {
  const ctrl = new AbortController();
  setTimeout(() => ctrl.abort(), ms);
  return ctrl.signal;
}

async function fetchFromSource(source) {
  const res = await fetch(source.url, {
    headers: HEADERS,
    signal: makeTimeout(8_000),
  });
  if (!res.ok) throw new Error(`${source.name} ${res.status}`);
  const data = await res.json();
  const price = source.parse(data);
  if (typeof price !== 'number' || !Number.isFinite(price) || price <= 0) {
    throw new Error(`${source.name} returned invalid price`);
  }
  return price;
}

async function getZECPrice() {
  const now = Date.now();
  if (cache.price && now - cache.at < TTL) {
    return { price: cache.price, stale: false, fetchedAt: new Date(cache.at) };
  }

  // Try each source in order until one works
  for (const source of SOURCES) {
    try {
      const price = await fetchFromSource(source);
      cache = { price, at: now };
      return { price, stale: false, fetchedAt: new Date(now) };
    } catch {
      // try next source
    }
  }

  // All sources failed — return stale cache if available
  if (cache.price) {
    return { price: cache.price, stale: true, fetchedAt: new Date(cache.at) };
  }
  throw new Error('All price sources unavailable');
}

function usdToZec(usd, zecPrice) {
  if (!zecPrice || zecPrice <= 0) throw new Error('Invalid ZEC price for conversion');
  const zec = usd / zecPrice;
  if (!Number.isFinite(zec) || zec <= 0) throw new Error('Conversion produced invalid result');
  return Number(zec.toFixed(8));
}

module.exports = { getZECPrice, usdToZec };
