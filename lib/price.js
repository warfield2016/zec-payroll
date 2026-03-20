// price.js — ZEC/USD from CoinGecko, 60s cache

const API = 'https://api.coingecko.com/api/v3/simple/price?ids=zcash&vs_currencies=usd';
const TTL = 60_000;

let cache = { price: null, at: 0 };

async function getZECPrice() {
  const now = Date.now();
  if (cache.price && now - cache.at < TTL) {
    return { price: cache.price, stale: false, fetchedAt: new Date(cache.at) };
  }

  let res;
  try {
    res = await fetch(API, { signal: AbortSignal.timeout(10_000) });
  } catch (e) {
    if (cache.price) return { price: cache.price, stale: true, fetchedAt: new Date(cache.at) };
    throw new Error(`CoinGecko request failed: ${e.message}`);
  }
  if (!res.ok) {
    if (cache.price) return { price: cache.price, stale: true, fetchedAt: new Date(cache.at) };
    throw new Error(`CoinGecko ${res.status}`);
  }

  const data = await res.json();
  const price = data?.zcash?.usd;
  if (typeof price !== 'number' || price <= 0) throw new Error('Invalid price data');

  cache = { price, at: now };
  return { price, stale: false, fetchedAt: new Date(now) };
}

function usdToZec(usd, zecPrice) {
  if (!zecPrice || zecPrice <= 0) throw new Error('Invalid ZEC price for conversion');
  const zec = usd / zecPrice;
  if (!Number.isFinite(zec) || zec <= 0) throw new Error('Conversion produced invalid result');
  return Number(zec.toFixed(8));
}

module.exports = { getZECPrice, usdToZec };
