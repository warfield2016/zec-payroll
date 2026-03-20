// app.js — theme toggle, privacy shield, clipboard

const THEME_KEY = 'zec-theme';
const SHIELD_KEY = 'zec-shield';

function getTheme() {
  return localStorage.getItem(THEME_KEY) ||
    (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
}

function setTheme(t) {
  document.documentElement.setAttribute('data-theme', t);
  localStorage.setItem(THEME_KEY, t);
  const btn = document.getElementById('theme-toggle');
  if (!btn) return;
  btn.innerHTML = t === 'dark'
    ? '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>'
    : '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/></svg>';
  btn.title = t === 'dark' ? 'Light mode' : 'Dark mode';
}

function setShield(on) {
  localStorage.setItem(SHIELD_KEY, on);
  document.body.classList.toggle('shielded', on);
  const btn = document.getElementById('shield-toggle');
  if (!btn) return;
  btn.classList.toggle('shield-active', on);
  btn.title = on ? 'Shield ON (click to reveal)' : 'Shield OFF (click to hide)';
  const fill = on ? 'currentColor' : 'none';
  const sw = on ? '1' : '2';
  btn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="${fill}" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`;
}

document.addEventListener('DOMContentLoaded', () => {
  setTheme(getTheme());
  setShield(localStorage.getItem(SHIELD_KEY) === 'true');

  document.getElementById('theme-toggle')?.addEventListener('click', () => {
    setTheme(getTheme() === 'dark' ? 'light' : 'dark');
  });

  document.getElementById('shield-toggle')?.addEventListener('click', () => {
    setShield(localStorage.getItem(SHIELD_KEY) !== 'true');
  });
});

// --- ZEC price ticker ---
function updatePriceTicker() {
  const el = document.getElementById('price-ticker');
  if (!el) return;
  el.classList.add('loading');
  fetch('/api/price')
    .then(r => r.json())
    .then(data => {
      if (data.price) {
        el.textContent = '$' + data.price.toFixed(2);
        el.title = 'ZEC/USD' + (data.stale ? ' (cached)' : ' (live)');
      } else {
        el.textContent = '--';
      }
    })
    .catch(() => { el.textContent = '--'; })
    .finally(() => { el.classList.remove('loading'); });
}

// Fetch price on load and every 60s
updatePriceTicker();
setInterval(updatePriceTicker, 60_000);

document.addEventListener('click', (e) => {
  if (!e.target.classList.contains('copy-btn')) return;
  const el = document.getElementById(e.target.dataset.target);
  if (!el) return;
  navigator.clipboard.writeText(el.value).then(() => {
    const orig = e.target.textContent;
    e.target.textContent = 'Copied';
    setTimeout(() => e.target.textContent = orig, 1500);
  });
});
