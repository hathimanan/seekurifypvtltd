(async () => {

// ── Toggle ─────────────────────────────────────────────────────────────────────
const stored = await chrome.storage.local.get('breach_check_enabled');
let checkEnabled = stored.breach_check_enabled !== false;

// ── Site-level breached credential banner ──────────────────────────────────────
let siteBannerEl = null;

function showSiteBanner(entry) {
  if (siteBannerEl) return; // already shown

  const bar = document.createElement('div');
  bar.className = 'sk-site-breach-bar';
  bar.innerHTML = `
    <div class="sk-site-breach-inner">
      <div class="sk-site-breach-icon">
        <svg width="18" height="18" fill="none" stroke="#ef4444" stroke-width="2" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
        </svg>
      </div>
      <div class="sk-site-breach-body">
        <span class="sk-site-breach-title">Seekurify: Breached credential on this site</span>
        <span class="sk-site-breach-sub">
          Your saved password for <strong>${entry.website}</strong>
          (${entry.username}) was found in a data breach and is quarantined.
          Change it before logging in.
        </span>
      </div>
      <a class="sk-site-breach-btn" href="${entry.website.startsWith('http') ? entry.website : 'https://' + entry.website}" target="_blank" rel="noopener">
        Open site
      </a>
      <button class="sk-site-breach-dismiss" aria-label="Dismiss">✕</button>
    </div>`;

  bar.querySelector('.sk-site-breach-dismiss').addEventListener('click', () => {
    bar.remove();
    siteBannerEl = null;
  });

  document.body.prepend(bar);
  siteBannerEl = bar;
}

async function checkSiteBreach() {
  if (!checkEnabled) return;
  try {
    const resp = await chrome.runtime.sendMessage({ type: 'GET_BREACHED_DOMAINS' });
    if (!resp?.domains?.length) return;

    const currentDomain = location.hostname.replace(/^www\./, '');
    const match = resp.queue?.find(entry => {
      try {
        const url = entry.website.startsWith('http') ? entry.website : `https://${entry.website}`;
        const d = new URL(url).hostname.replace(/^www\./, '');
        return d === currentDomain || currentDomain.endsWith('.' + d);
      } catch {
        return entry.website.toLowerCase().replace(/^www\./, '') === currentDomain;
      }
    });

    if (match) showSiteBanner(match);
  } catch { /* extension unavailable — skip */ }
}

// Run after DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', checkSiteBreach);
} else {
  checkSiteBreach();
}

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && 'breach_check_enabled' in changes) {
    checkEnabled = changes.breach_check_enabled.newValue !== false;
    if (!checkEnabled) clearAllWarnings();
  }
});

// ── SHA-1 via SubtleCrypto (k-anonymity — only 5-char prefix ever leaves browser) ─
async function sha1hex(text) {
  const buf = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

// ── Warning element helpers ────────────────────────────────────────────────────
let idCounter = 0;

function ensureFieldId(field) {
  if (!field.dataset.skBreachId) field.dataset.skBreachId = `sk-b-${++idCounter}`;
  return field.dataset.skBreachId;
}

function getWarnEl(field) {
  const id = field.dataset.skBreachId;
  return id ? document.querySelector(`[data-sk-breach-for="${id}"]`) : null;
}

// state: null (clear) | 'checking' | { breached: false } | { breached: true, count }
function setWarning(field, state) {
  let warn = getWarnEl(field);

  if (state === null) {
    warn?.remove();
    return;
  }

  if (!warn) {
    warn = document.createElement('div');
    warn.setAttribute('data-sk-breach-for', ensureFieldId(field));
    // Insert immediately after the password field
    field.insertAdjacentElement('afterend', warn);
  }

  if (state === 'checking') {
    warn.className = 'sk-breach-checking';
    warn.textContent = '⏳ Checking against breach database…';
    return;
  }

  if (!state.breached) {
    warn.className = 'sk-breach-clean';
    warn.textContent = '✓ Not found in known data breaches';
    // Fade out after 3 s so it doesn't distract
    clearTimeout(warn._hideTimer);
    warn._hideTimer = setTimeout(() => warn?.remove(), 3000);
    return;
  }

  clearTimeout(warn._hideTimer);
  const count = state.count || 0;
  const countStr =
    count >= 1_000_000 ? `${(count / 1_000_000).toFixed(1)}M` :
    count >= 1_000     ? `${(count / 1_000).toFixed(0)}k`     :
    String(count);
  warn.className = 'sk-breach-pwned';
  warn.innerHTML =
    `⚠ Found in <strong>${countStr}</strong> data breach${count !== 1 ? 'es' : ''} — ` +
    `use a different password`;
}

function clearAllWarnings() {
  document.querySelectorAll('[data-sk-breach-for]').forEach(el => el.remove());
}

// ── Debounce state ─────────────────────────────────────────────────────────────
const timers      = new WeakMap(); // field → debounce timer id
const lastChecked = new WeakMap(); // field → last password value that was checked

// ── Input listener ─────────────────────────────────────────────────────────────
document.addEventListener('input', e => {
  if (!checkEnabled) return;
  const field = e.target;
  if (!(field instanceof HTMLInputElement) || field.type !== 'password') return;

  const val = field.value;

  // Clear below threshold immediately
  if (val.length < 8) {
    clearTimeout(timers.get(field));
    setWarning(field, null);
    lastChecked.delete(field);
    return;
  }

  // Show checking indicator right away, then debounce the actual HIBP call
  setWarning(field, 'checking');

  clearTimeout(timers.get(field));
  timers.set(field, setTimeout(() => doCheck(field, val), 800));
}, true);

async function doCheck(field, val) {
  if (!checkEnabled) return;
  if (field.value !== val) return;      // user typed more — stale check
  if (lastChecked.get(field) === val) { // same password, result still valid
    return;
  }

  lastChecked.set(field, val);

  try {
    const hash   = await sha1hex(val);
    const prefix = hash.slice(0, 5).toUpperCase();
    const suffix = hash.slice(5).toUpperCase();

    const resp = await chrome.runtime.sendMessage({
      type: 'HIBP_PASSWORD_CHECK',
      hashPrefix: prefix,
    });

    // Discard if user changed the field while we were waiting
    if (field.value !== val) return;

    if (!resp || !resp.suffixes) {
      setWarning(field, null); // backend unavailable — fail silently
      return;
    }

    const match = resp.suffixes.find(s => s.suffix === suffix);
    setWarning(field, match ? { breached: true, count: match.count } : { breached: false });
  } catch {
    setWarning(field, null); // background unavailable — fail silently
  }
}

// ── Clear on empty blur ────────────────────────────────────────────────────────
document.addEventListener('blur', e => {
  const field = e.target;
  if (!(field instanceof HTMLInputElement) || field.type !== 'password') return;
  if (!field.value) setWarning(field, null);
}, true);

})();
