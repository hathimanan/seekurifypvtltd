// ── State ──────────────────────────────────────────────────────────────────────
let allEntries    = [];
let currentHost   = '';
let currentTabUrl = '';

// Auth flow state (lives only for the current popup session)
let _loginEmail    = '';
let _otpToken      = '';
let _editingEntryId = null;

// ── Boot ───────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.url) {
      currentTabUrl = tab.url;
      currentHost = new URL(tab.url).hostname.replace(/^www\./, '');
    }
  } catch { /* non-URL tab (e.g. chrome://) */ }

  const { token } = await chrome.storage.local.get('token');
  token ? await showVault() : showLogin();

  bindStaticEvents();
  bindPasswordFormEvents();
  bindVaultRefresh();
  bindPhishingEvents();
  bindBreachEvents();
  bindLinkScanToggle();
  bindBreachCheckToggle();
});

// ── View switchers ─────────────────────────────────────────────────────────────
const AUTH_VIEWS   = ['view-login','view-otp','view-pin'];
const MAIN_VIEWS   = ['view-vault','view-audit','view-phishing','view-breach','view-settings','view-password-form'];
const ALL_VIEWS    = [...AUTH_VIEWS, ...MAIN_VIEWS];

function hideAll() { ALL_VIEWS.forEach(v => hide(v)); }

function showLogin() {
  hideAll(); hide('tab-bar'); hide('header-actions');
  show('view-login');
}
function showOtp(email) {
  _loginEmail = email;
  $('otp-hint').textContent = `Enter the 6-digit code sent to ${email}.`;
  $('input-otp').value = '';
  $('otp-error').style.display = 'none';
  hideAll(); hide('tab-bar'); hide('header-actions');
  show('view-otp');
}
function showPin() {
  $('input-pin').value = '';
  $('pin-error').style.display = 'none';
  hideAll(); hide('tab-bar'); hide('header-actions');
  show('view-pin');
}
async function showVault() {
  hideAll();
  show('header-actions'); show('tab-bar'); show('view-vault');
  setActiveTab('vault');
  await loadVault();
}
function showAudit() {
  hideAll();
  show('header-actions'); show('tab-bar'); show('view-audit');
  setActiveTab('audit');
  initAuditView();
}
async function showPhishing() {
  hideAll();
  show('header-actions'); show('tab-bar'); show('view-phishing');
  setActiveTab('phishing');
  await loadPhishingView();
}
function showBreach() {
  hideAll();
  show('header-actions'); show('tab-bar'); show('view-breach');
  setActiveTab('breach');
  // Reset to button-only state; results persist from last scan until user re-runs
  hide('breach-loading'); hide('breach-error');
  $('btn-run-breach').disabled = false;
}

function showSettings() {
  hideAll(); hide('tab-bar');
  show('header-actions'); show('view-settings');
  loadApiBase();
  loadLinkScanToggle();
  loadBreachCheckToggle();
}

function showPasswordForm(entry = null) {
  _editingEntryId = entry ? entry._id : null;
  $('form-title').textContent        = entry ? 'Edit Password' : 'Add Password';
  $('form-website').value            = entry ? (entry.website  || '') : '';
  $('form-username').value           = entry ? (entry.username || '') : '';
  $('form-password-val').value       = entry ? (entry.password || '') : '';
  $('form-error').style.display      = 'none';
  $('btn-form-save').textContent     = entry ? 'Update' : 'Save';
  $('btn-form-save').disabled        = false;
  hideAll();
  show('header-actions'); show('tab-bar'); show('view-password-form');
  setActiveTab('vault');
}

function setActiveTab(name) {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.toggle('tab-active', btn.dataset.tab === name);
  });
}

// ── Event bindings ─────────────────────────────────────────────────────────────
function bindStaticEvents() {

  // ── Sign-up link ───────────────────────────────────────────────────────────
  $('btn-signup').addEventListener('click', async () => {
    const { apiBase } = await chrome.storage.local.get('apiBase');
    const base = (apiBase || 'http://localhost:5000').replace(/\/+$/, '');
    chrome.tabs.create({ url: `${base}/signup` });
  });

  // ── Step 1: email + password ───────────────────────────────────────────────
  $('form-login').addEventListener('submit', async e => {
    e.preventDefault();
    const email    = $('input-email').value.trim();
    const password = $('input-password').value;
    const errEl    = $('login-error');
    const btn      = $('btn-login');

    errEl.style.display = 'none';
    btn.textContent = 'Signing in…'; btn.disabled = true;

    const resp = await chrome.runtime.sendMessage({
      type: 'LOGIN_STEP1',
      credentials: { email, password },
    });

    btn.textContent = 'Sign in'; btn.disabled = false;

    if (resp.error) {
      errEl.textContent = resp.error;
      errEl.style.display = 'block';
      return;
    }

    // Step 1 succeeded — send OTP
    const otpResp = await chrome.runtime.sendMessage({ type: 'SEND_OTP', email });
    if (otpResp.error) {
      errEl.textContent = otpResp.error;
      errEl.style.display = 'block';
      return;
    }

    _otpToken = otpResp.otpToken || '';
    showOtp(email);
  });

  // ── Step 2: verify OTP ─────────────────────────────────────────────────────
  $('form-otp').addEventListener('submit', async e => {
    e.preventDefault();
    const otp   = $('input-otp').value.trim();
    const errEl = $('otp-error');
    const btn   = $('btn-otp');

    errEl.style.display = 'none';
    btn.textContent = 'Verifying…'; btn.disabled = true;

    const resp = await chrome.runtime.sendMessage({
      type: 'VERIFY_OTP',
      email: _loginEmail,
      otp,
      otpToken: _otpToken,
    });

    btn.textContent = 'Verify code'; btn.disabled = false;

    if (resp.error) {
      errEl.textContent = resp.error;
      errEl.style.display = 'block';
      return;
    }

    showPin();
  });

  // Resend OTP
  $('btn-resend-otp').addEventListener('click', async () => {
    const errEl = $('otp-error');
    errEl.style.display = 'none';
    const resp = await chrome.runtime.sendMessage({ type: 'SEND_OTP', email: _loginEmail });
    if (resp.error) {
      errEl.textContent = resp.error;
      errEl.style.display = 'block';
    } else {
      _otpToken = resp.otpToken || '';
      $('input-otp').value = '';
      errEl.textContent = 'New code sent!';
      errEl.style.color = '#4ade80';
      errEl.style.display = 'block';
      setTimeout(() => { errEl.style.display = 'none'; errEl.style.color = ''; }, 2000);
    }
  });

  $('btn-otp-back').addEventListener('click', showLogin);

  // ── Step 3: verify PIN → receive JWT ──────────────────────────────────────
  $('form-pin').addEventListener('submit', async e => {
    e.preventDefault();
    const pin   = $('input-pin').value.trim();
    const errEl = $('pin-error');
    const btn   = $('btn-pin');

    errEl.style.display = 'none';
    btn.textContent = 'Unlocking…'; btn.disabled = true;

    const resp = await chrome.runtime.sendMessage({
      type: 'VERIFY_PIN',
      email: _loginEmail,
      pin,
    });

    btn.textContent = 'Unlock vault'; btn.disabled = false;

    if (resp.error) {
      errEl.textContent = resp.error;
      errEl.style.display = 'block';
      return;
    }

    await showVault();
  });

  $('btn-pin-back').addEventListener('click', showOtp.bind(null, _loginEmail));

  // ── Tabs ──────────────────────────────────────────────────────────────────
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      if (btn.dataset.tab === 'vault') showVault();
      else if (btn.dataset.tab === 'audit') showAudit();
      else if (btn.dataset.tab === 'phishing')  showPhishing();
      else if (btn.dataset.tab === 'breach')    showBreach();
    });
  });

  // ── Header ────────────────────────────────────────────────────────────────
  $('btn-settings').addEventListener('click', showSettings);
  $('btn-lock').addEventListener('click', async () => {
    await chrome.runtime.sendMessage({ type: 'LOGOUT' });
    showLogin();
  });

  // ── Site Audit ────────────────────────────────────────────────────────────
  $('btn-run-audit').addEventListener('click', runAudit);

  // ── Settings ──────────────────────────────────────────────────────────────
  $('btn-back').addEventListener('click', showVault);
  $('btn-save-settings').addEventListener('click', async () => {
    const apiBase = $('input-api-base').value.trim();
    if (!apiBase) return;
    await chrome.runtime.sendMessage({ type: 'SET_API_BASE', apiBase });
    const msg = $('settings-msg');
    msg.textContent = 'Saved!'; msg.style.display = 'block';
    setTimeout(() => { msg.style.display = 'none'; }, 1500);
  });
  $('btn-logout').addEventListener('click', async () => {
    await chrome.runtime.sendMessage({ type: 'LOGOUT' });
    showLogin();
  });

  // ── Search ────────────────────────────────────────────────────────────────
  $('input-search').addEventListener('input', e => {
    renderAll(e.target.value.trim().toLowerCase(), computePwCount());
  });
}

// ── Vault loading ──────────────────────────────────────────────────────────────
async function loadVault() {
  _lastVaultLoad = Date.now();
  $('all-entries').innerHTML = '<div class="empty">Loading…</div>';

  const resp = await chrome.runtime.sendMessage({ type: 'GET_VAULT' });

  if (resp.error === 'session_expired' || resp.error?.includes('401')) {
    await chrome.runtime.sendMessage({ type: 'LOGOUT' });
    return showLogin();
  }
  if (resp.error) {
    $('all-entries').innerHTML = `<div class="empty" style="color:#f87171">${escHtml(resp.error)}</div>`;
    return;
  }

  allEntries = Array.isArray(resp) ? resp : [];
  const pwCount = computePwCount();
  renderSiteMatches(pwCount);
  renderAll('', pwCount);
}

// ── Render current-site matches ────────────────────────────────────────────────
function renderSiteMatches(pwCount = new Map()) {
  const siteSection = $('site-section');
  if (!currentHost) { siteSection.style.display = 'none'; return; }

  const matches = allEntries.filter(e => matchesDomain(e, currentHost));
  if (!matches.length) { siteSection.style.display = 'none'; return; }

  siteSection.style.display = 'block';
  $('site-label').textContent = `Matches for ${currentHost}`;
  $('site-entries').innerHTML = '';
  matches.forEach(e => $('site-entries').appendChild(buildCard(e, true, pwCount)));
}

// ── Render all entries (with optional search filter) ──────────────────────────
function renderAll(query, pwCount = new Map()) {
  const container = $('all-entries');
  container.innerHTML = '';

  const filtered = query
    ? allEntries.filter(e =>
        e.website?.toLowerCase().includes(query) ||
        e.username?.toLowerCase().includes(query)
      )
    : allEntries;

  if (!filtered.length) {
    $('empty-msg').style.display = 'block';
    return;
  }
  $('empty-msg').style.display = 'none';

  filtered.forEach(e => container.appendChild(buildCard(e, false, pwCount)));
}

// ── Entry card ─────────────────────────────────────────────────────────────────
function buildCard(entry, isSiteMatch, pwCount = new Map()) {
  const isReused = entry.password && (pwCount.get(entry.password) || 0) > 1;
  const card = document.createElement('div');
  card.className = 'entry-card';

  const initial = (entry.website || '?')[0].toUpperCase();

  card.innerHTML = `
    <div class="entry-avatar">${escHtml(initial)}</div>
    <div class="entry-info">
      <div class="entry-website">${escHtml(entry.website)}${isReused ? ' <span class="reuse-badge">⚠ Reused</span>' : ''}</div>
      <div class="entry-user">${escHtml(entry.username)}</div>
    </div>
    <div class="entry-actions">
      ${isSiteMatch ? `<button class="action-btn fill-btn">Fill</button>` : ''}
      <button class="action-btn copy-btn">Copy</button>
      <button class="action-btn edit-btn">Edit</button>
    </div>
  `;

  card.querySelector('.copy-btn')?.addEventListener('click', e => {
    e.stopPropagation();
    navigator.clipboard.writeText(entry.password || '');
    const btn = e.currentTarget;
    const orig = btn.textContent;
    btn.textContent = '✓ Copied'; btn.classList.add('copied-flash');
    setTimeout(() => { btn.textContent = orig; btn.classList.remove('copied-flash'); }, 1500);
  });

  card.querySelector('.edit-btn')?.addEventListener('click', e => {
    e.stopPropagation();
    showPasswordForm(entry);
  });

  card.querySelector('.fill-btn')?.addEventListener('click', async e => {
    e.stopPropagation();
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) return;
    try {
      await chrome.tabs.sendMessage(tab.id, { type: 'FILL_CREDENTIALS', entry });
      window.close();
    } catch {
      await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content.js'] });
      await chrome.tabs.sendMessage(tab.id, { type: 'FILL_CREDENTIALS', entry });
      window.close();
    }
  });

  return card;
}

// ── Password reuse map ─────────────────────────────────────────────────────────
function computePwCount() {
  const map = new Map();
  for (const e of allEntries) {
    if (e.password) map.set(e.password, (map.get(e.password) || 0) + 1);
  }
  return map;
}

// ── Add / Edit password form ───────────────────────────────────────────────────
function bindPasswordFormEvents() {
  $('btn-form-back').addEventListener('click', () => {
    hideAll();
    show('header-actions'); show('tab-bar'); show('view-vault');
    setActiveTab('vault');
  });

  $('form-password').addEventListener('submit', async e => {
    e.preventDefault();
    const btn   = $('btn-form-save');
    const errEl = $('form-error');
    const data  = {
      website:  $('form-website').value.trim(),
      username: $('form-username').value.trim(),
      password: $('form-password-val').value,
    };

    errEl.style.display  = 'none';
    btn.disabled         = true;
    btn.textContent      = _editingEntryId ? 'Updating…' : 'Saving…';

    const resp = _editingEntryId
      ? await chrome.runtime.sendMessage({ type: 'UPDATE_PASSWORD', id: _editingEntryId, data })
      : await chrome.runtime.sendMessage({ type: 'SAVE_PASSWORD', data });

    btn.disabled    = false;
    btn.textContent = _editingEntryId ? 'Update' : 'Save';

    if (resp?.error) {
      errEl.textContent    = resp.error === 'session_expired'
        ? 'Session expired — please sign out and sign in again'
        : resp.error;
      errEl.style.display  = 'block';
      return;
    }

    // Optimistic update — no loadVault() / GET_VAULT call
    if (_editingEntryId) {
      const idx = allEntries.findIndex(e => e._id === _editingEntryId);
      if (idx !== -1) allEntries[idx] = { ...allEntries[idx], ...data };
    } else {
      allEntries.unshift({ ...resp, password: data.password });
    }

    const pwCount = computePwCount();
    hideAll();
    show('header-actions'); show('tab-bar'); show('view-vault');
    setActiveTab('vault');
    renderSiteMatches(pwCount);
    renderAll($('input-search').value.trim().toLowerCase(), pwCount);
  });
}

// ── Helpers ────────────────────────────────────────────────────────────────────
// ── Vault auto-refresh ─────────────────────────────────────────────────────────
let _lastVaultLoad = 0;

function isVaultVisible() {
  return $('view-vault') && $('view-vault').style.display !== 'none';
}

function bindVaultRefresh() {
  chrome.runtime.onMessage.addListener((message) => {
    if (message.type !== 'VAULT_UPDATED') return;

    if (message.action === 'add' && message.entry) {
      allEntries.unshift(message.entry);
    } else if (message.action === 'update' && message.entry) {
      const idx = allEntries.findIndex(e => e._id === message.entry._id);
      if (idx !== -1) allEntries[idx] = { ...allEntries[idx], ...message.entry };
    } else if (message.action === 'delete' && message.id) {
      const idx = allEntries.findIndex(e => e._id === message.id);
      if (idx !== -1) allEntries.splice(idx, 1);
    }

    if (!isVaultVisible()) return;

    if (message.action === 'add' || message.action === 'update' || message.action === 'delete') {
      const pwCount = computePwCount();
      renderSiteMatches(pwCount);
      renderAll($('input-search').value.trim().toLowerCase(), pwCount);
    } else {
      loadVault(); // fallback for bare VAULT_UPDATED with no payload
    }
  });

  // Refresh when the side panel regains focus — covers password edits made on the dashboard
  document.addEventListener('visibilitychange', async () => {
    if (document.visibilityState !== 'visible') return;
    if (!isVaultVisible()) return;
    if (Date.now() - _lastVaultLoad < 5_000) return; // skip if refreshed < 5 s ago
    const { token } = await chrome.storage.local.get('token');
    if (token) loadVault();
  });
}

async function loadApiBase() {
  const resp = await chrome.runtime.sendMessage({ type: 'GET_API_BASE' });
  $('input-api-base').value = resp.apiBase || '';
}

async function loadLinkScanToggle() {
  const { link_scan_enabled = true } = await chrome.storage.local.get('link_scan_enabled');
  $('link-scan-toggle-btn')?.setAttribute('aria-pressed', link_scan_enabled ? 'true' : 'false');
}

function bindLinkScanToggle() {
  $('link-scan-toggle-btn')?.addEventListener('click', async () => {
    const { link_scan_enabled = true } = await chrome.storage.local.get('link_scan_enabled');
    const next = !link_scan_enabled;
    await chrome.storage.local.set({ link_scan_enabled: next });
    $('link-scan-toggle-btn').setAttribute('aria-pressed', next ? 'true' : 'false');
  });
}

async function loadBreachCheckToggle() {
  const { breach_check_enabled = true } = await chrome.storage.local.get('breach_check_enabled');
  $('breach-check-toggle-btn')?.setAttribute('aria-pressed', breach_check_enabled ? 'true' : 'false');
}

function bindBreachCheckToggle() {
  $('breach-check-toggle-btn')?.addEventListener('click', async () => {
    const { breach_check_enabled = true } = await chrome.storage.local.get('breach_check_enabled');
    const next = !breach_check_enabled;
    await chrome.storage.local.set({ breach_check_enabled: next });
    $('breach-check-toggle-btn').setAttribute('aria-pressed', next ? 'true' : 'false');
  });
}

function matchesDomain(entry, host) {
  if (!entry.website || !host) return false;
  try {
    const url = entry.website.startsWith('http') ? entry.website : `https://${entry.website}`;
    const d = new URL(url).hostname.replace(/^www\./, '');
    return d === host || d.endsWith(`.${host}`) || host.endsWith(`.${d}`);
  } catch {
    return entry.website.includes(host);
  }
}

function $(id) { return document.getElementById(id); }
function show(id) { const el = $(id); if (el) el.style.display = ''; }
function hide(id) { const el = $(id); if (el) el.style.display = 'none'; }
function escHtml(s) {
  return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── Site Audit ─────────────────────────────────────────────────────────────────
function initAuditView() {
  // Show current tab URL in the site pill
  const display = currentTabUrl
    ? new URL(currentTabUrl).hostname.replace(/^www\./, '')
    : '—';
  $('audit-site-display').textContent = display;

  // Reset state
  hide('audit-results');
  hide('audit-loading');
  hide('audit-error');
  $('btn-run-audit').disabled = false;
  $('btn-run-audit').textContent = '';
  // Re-add icon + text
  $('btn-run-audit').innerHTML = `
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
    Audit This Site`;
}

async function runAudit() {
  if (!currentTabUrl) {
    showAuditError('No active tab URL detected. Navigate to a website first.');
    return;
  }
  const url = currentTabUrl;
  if (url.startsWith('chrome://') || url.startsWith('chrome-extension://') || url.startsWith('about:')) {
    showAuditError('Cannot audit browser internal pages. Navigate to a real website.');
    return;
  }

  // Loading state
  hide('audit-results');
  hide('audit-error');
  show('audit-loading');
  $('btn-run-audit').disabled = true;

  const resp = await chrome.runtime.sendMessage({ type: 'SITE_AUDIT', url });

  hide('audit-loading');
  $('btn-run-audit').disabled = false;

  if (resp?.error) {
    showAuditError(resp.error);
    return;
  }

  renderAuditResults(resp);
}

function showAuditError(msg) {
  hide('audit-loading');
  hide('audit-results');
  $('audit-error').textContent = msg;
  show('audit-error');
}

function renderAuditResults(data) {
  hide('audit-error');

  // ── Grade + Score ────────────────────────────────────────────────────────
  const grade = data.grade || '—';
  const score = typeof data.score === 'number' ? data.score : 0;
  const gradeBadge = $('audit-grade-badge');
  gradeBadge.textContent = grade;
  gradeBadge.className = `audit-grade grade-${grade}`;

  $('audit-score-val').textContent = score;
  const bar = $('audit-score-bar');
  bar.style.width = `${score}%`;
  bar.className = `audit-bar-fill bar-${grade}`;
  $('audit-scanned-url').textContent = data.hostname || data.url || '';

  const formulaEl = $('audit-score-formula');
  if (formulaEl) {
    formulaEl.textContent = 'Grade based on SSL, security headers (CSP/HSTS/X-Frame-Options), blacklist status, and DNS auth (SPF/DMARC).';
    formulaEl.style.display = 'block';
  }

  // ── Quick checks ─────────────────────────────────────────────────────────
  const sslOk = data.ssl?.valid === true;
  const hdrs  = data.headers || {};
  const headersScore = [hdrs.csp, hdrs.hsts, hdrs.xFrameOptions, hdrs.xContentTypeOptions]
    .filter(Boolean).length;
  const headersOk = headersScore >= 3;
  const blackOk  = data.blacklist?.blacklisted === false;
  const dnsOk    = data.dns?.spf && data.dns?.dmarc;

  setCheck('chk-ssl',       sslOk,     'SSL');
  setCheck('chk-headers',   headersOk, 'Headers');
  setCheck('chk-blacklist', blackOk,   'Blacklist');
  setCheck('chk-dns',       dnsOk,     'DNS');

  // ── Findings ─────────────────────────────────────────────────────────────
  const findings = Array.isArray(data.findings) ? data.findings : [];
  const list = $('audit-findings-list');
  list.innerHTML = '';

  if (!findings.length) {
    show('audit-no-findings');
  } else {
    hide('audit-no-findings');
    // Sort: critical → warning → info
    const order = { critical: 0, warning: 1, info: 2 };
    findings
      .sort((a, b) => (order[a.severity] ?? 3) - (order[b.severity] ?? 3))
      .forEach(f => {
        const item = document.createElement('div');
        item.className = `audit-finding sev-${f.severity || 'info'}`;
        item.innerHTML = `
          <div class="finding-dot"></div>
          <div class="finding-body">
            <div class="finding-cat">${escHtml(f.category || f.severity || '')}</div>
            <div class="finding-msg">${escHtml(f.message || '')}</div>
          </div>`;
        list.appendChild(item);
      });
  }

  show('audit-results');
}

const CHECK_EXPLAIN = {
  SSL:       { ok: 'Encrypted', fail: 'No HTTPS — data sent in plaintext' },
  Headers:   { ok: 'Protected', fail: 'Missing CSP/HSTS — clickjacking possible' },
  Blacklist: { ok: 'Not listed', fail: 'On threat list — avoid credentials' },
  DNS:       { ok: 'SPF+DMARC set', fail: 'No SPF/DMARC — email spoofable' },
};

function setCheck(id, ok, label) {
  const el = $(id);
  const explainEl = el.querySelector('.chk-explain');
  if (ok === null || ok === undefined) {
    el.querySelector('.chk-icon').textContent = '—';
    el.style.borderColor = '';
    if (explainEl) explainEl.textContent = '';
  } else if (ok) {
    el.querySelector('.chk-icon').textContent = '✅';
    el.style.borderColor = '#166534';
    if (explainEl) explainEl.textContent = CHECK_EXPLAIN[label]?.ok || '';
  } else {
    el.querySelector('.chk-icon').textContent = '❌';
    el.style.borderColor = '#7f1d1d';
    if (explainEl) explainEl.textContent = CHECK_EXPLAIN[label]?.fail || '';
  }
  el.querySelector('.chk-label').textContent = label;
}

function formatTimeAgo(ts) {
  const diff = Date.now() - ts;
  if (diff < 60_000)  return 'just now';
  if (diff < 3600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86400_000) return `${Math.floor(diff / 3600_000)}h ago`;
  return new Date(ts).toLocaleDateString();
}

// Refresh the phishing log when background writes detections to session storage
chrome.storage.session.onChanged.addListener(changes => {
  if ('phishing_log' in changes && $('view-phishing')?.style.display !== 'none') {
    loadPhishingView();
  }
});

// ── Phishing view ──────────────────────────────────────────────────────────────
const SEV_ORDER_PHI = { critical: 0, high: 1, medium: 2, low: 3 };

async function loadPhishingView() {
  const { phishing_monitoring_enabled = true } = await chrome.storage.local.get('phishing_monitoring_enabled');
  renderPhishingToggle(phishing_monitoring_enabled);

  if (!phishing_monitoring_enabled) {
    hide('phi-log-list'); hide('phi-log-empty'); hide('phi-stats-row');
    show('phi-disabled-msg');
    return;
  }

  show('phi-stats-row'); hide('phi-disabled-msg');
  const log = await chrome.runtime.sendMessage({ type: 'GET_PHISHING_LOG' });
  renderPhishingLog(Array.isArray(log) ? log : []);
}

function renderPhishingToggle(enabled) {
  const btn = $('phi-toggle-btn');
  if (btn) btn.setAttribute('aria-pressed', enabled ? 'true' : 'false');
}

const PHI_SCORE_COLOR = { critical: '#f87171', high: '#f97316', medium: '#fbbf24', low: '#60a5fa' };

function renderPhishingLog(log) {
  const total    = log.length;
  const critical = log.filter(e => e.findings?.some(f => f.severity === 'critical')).length;
  const avgScore = log.length
    ? Math.round(log.reduce((s, e) => s + (e.score ?? 0), 0) / log.length)
    : null;

  $('phi-stat-total').textContent     = total;
  $('phi-stat-critical').textContent  = critical;
  $('phi-stat-avg-score').textContent = avgScore !== null ? avgScore : '—';

  const list = $('phi-log-list');
  list.innerHTML = '';

  if (!log.length) {
    hide('phi-log-list'); show('phi-log-empty'); return;
  }
  show('phi-log-list'); hide('phi-log-empty');

  log.forEach(entry => {
    const findings  = entry.findings || [];
    const score     = entry.score ?? 0;
    const riskLevel = entry.riskLevel || 'low';
    const scoreColor = PHI_SCORE_COLOR[riskLevel] || '#60a5fa';

    const topSev = [...findings].sort((a, b) =>
      (SEV_ORDER_PHI[a.severity] ?? 4) - (SEV_ORDER_PHI[b.severity] ?? 4)
    )[0]?.severity || 'high';

    const tags = findings.map(f =>
      `<span class="pii-tag pii-tag-${f.severity}">${escHtml(f.label)}</span>`
    ).join('');

    const spear = entry.spearAnalysis;
    const spearHtml = spear ? (() => {
      const VECTOR_SHORT = {
        credential_harvest: 'Cred Harvest',
        wire_transfer:      'Wire Fraud',
        malware_delivery:   'Malware',
        data_exfil:         'Data Exfil',
        unknown:            'Unknown',
      };
      const targetLabel = spear.personalizationDepth === 'high' ? 'Highly Targeted'
        : spear.isTargeted ? 'Targeted' : null;
      const parts = [
        targetLabel ? `🎯 ${targetLabel}` : null,
        spear.aiGeneratedProbability >= 50 ? `🤖 ${spear.aiGeneratedProbability}% AI` : null,
        spear.attackVector !== 'unknown' ? `⚡ ${VECTOR_SHORT[spear.attackVector] || spear.attackVector}` : null,
        spear.lookalikeDomains?.length ? `🌐 ${spear.lookalikeDomains.length} lookalike` : null,
      ].filter(Boolean);
      if (!parts.length) return '';
      return `<div style="margin-top:4px;display:flex;flex-wrap:wrap;gap:3px">
        ${parts.map(p => `<span style="font-size:9px;font-weight:700;padding:1px 5px;border-radius:3px;background:#fb718522;border:1px solid #fb7185;color:#fb7185">${escHtml(p)}</span>`).join('')}
      </div>`;
    })() : '';

    const el = document.createElement('div');
    el.className = `pii-entry has-${topSev}`;
    el.innerHTML = `
      <div class="pii-entry-header">
        <span class="pii-entry-platform">${escHtml(entry.platform)}</span>
        <div class="pii-entry-meta">
          <span class="phi-score-badge" style="background:${scoreColor}22;border:1px solid ${scoreColor};color:${scoreColor};border-radius:4px;padding:1px 6px;font-size:10px;font-weight:700">${score}/100</span>
          <span class="pii-entry-time">${formatTimeAgo(entry.timestamp)}</span>
        </div>
      </div>
      ${entry.snippet ? `<div style="font-size:10px;color:#64748b;margin:3px 0 4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escHtml(entry.snippet)}</div>` : ''}
      <div class="pii-tags">${tags}</div>
      ${spearHtml}`;
    list.appendChild(el);
  });
}

function bindPhishingEvents() {
  $('phi-toggle-btn').addEventListener('click', async () => {
    const { phishing_monitoring_enabled = true } = await chrome.storage.local.get('phishing_monitoring_enabled');
    const next = !phishing_monitoring_enabled;
    await chrome.storage.local.set({ phishing_monitoring_enabled: next });
    renderPhishingToggle(next);
    await loadPhishingView();
  });

  $('btn-clear-phi').addEventListener('click', async () => {
    await chrome.runtime.sendMessage({ type: 'CLEAR_PHISHING_LOG' });
    renderPhishingLog([]);
  });
}

// ── Breach Detector ────────────────────────────────────────────────────────────

function bindBreachEvents() {
  $('btn-run-breach').addEventListener('click', runBreachScan);
  $('btn-check-email').addEventListener('click', runEmailBreachCheck);
}

async function runBreachScan() {
  show('breach-loading');
  hide('breach-results');
  hide('breach-error');
  $('btn-run-breach').disabled = true;

  const resp = await chrome.runtime.sendMessage({ type: 'HIBP_CHECK_ALL' });

  hide('breach-loading');
  $('btn-run-breach').disabled = false;

  if (resp.error === 'session_expired') {
    await chrome.runtime.sendMessage({ type: 'LOGOUT' });
    return showLogin();
  }
  if (resp.error) {
    $('breach-error').textContent = resp.error;
    show('breach-error');
    return;
  }

  renderBreachResults(resp);
}

function renderBreachResults({ results = [], newlyBreachedCount = 0 }) {
  const breached = results.filter(r => r.isBreached);
  const clean    = results.length - breached.length;

  $('breach-stat-pwned').textContent = breached.length;
  $('breach-stat-clean').textContent = clean;
  $('breach-stat-new').textContent   = newlyBreachedCount;

  const list = $('breach-pw-list');
  list.innerHTML = '';

  if (!breached.length) {
    list.innerHTML = '<div class="breach-all-clean">✓ All passwords are clean</div>';
  } else {
    breached
      .sort((a, b) => (b.breachCount || 0) - (a.breachCount || 0))
      .forEach(r => {
        const count = r.breachCount || 0;
        const countLabel = count >= 1_000_000
          ? `${(count / 1_000_000).toFixed(1)}M`
          : count >= 1_000
          ? `${(count / 1_000).toFixed(1)}k`
          : String(count);

        const el = document.createElement('div');
        el.className = 'breach-entry';
        el.innerHTML = `
          <div class="breach-entry-avatar">${escHtml((r.website || '?')[0].toUpperCase())}</div>
          <div class="breach-entry-info">
            <div class="breach-entry-site">${escHtml(r.website || 'Unknown')}</div>
            <div class="breach-entry-user">${escHtml(r.username || '')}</div>
            <div class="breach-entry-reason">Found in ${escHtml(countLabel)} data leak${count !== 1 ? 's' : ''} — change this password now</div>
          </div>
          <div class="breach-entry-count">
            <div class="breach-count-num">${escHtml(countLabel)}</div>
            <div class="breach-count-label">exposures</div>
          </div>`;
        list.appendChild(el);
      });
  }

  // Reset email section for this new scan
  hide('breach-email-loading');
  hide('breach-email-error');
  hide('breach-email-empty');
  $('breach-email-list').innerHTML = '';
  show('breach-results');
}

async function runEmailBreachCheck() {
  const btn = $('btn-check-email');
  btn.disabled = true;
  show('breach-email-loading');
  hide('breach-email-error');
  hide('breach-email-empty');
  $('breach-email-list').innerHTML = '';

  const resp = await chrome.runtime.sendMessage({ type: 'HIBP_CHECK_EMAIL' });

  hide('breach-email-loading');
  btn.disabled = false;

  if (resp.error === 'session_expired') {
    await chrome.runtime.sendMessage({ type: 'LOGOUT' });
    return showLogin();
  }
  if (resp.error) {
    $('breach-email-error').textContent = resp.error;
    show('breach-email-error');
    return;
  }

  renderEmailBreaches(resp.breaches || []);
}

function renderEmailBreaches(breaches) {
  const list = $('breach-email-list');
  list.innerHTML = '';

  if (!breaches.length) {
    $('breach-email-empty').textContent = '✓ Your email was not found in any known breach.';
    show('breach-email-empty');
    return;
  }

  hide('breach-email-empty');
  breaches.forEach(b => {
    const el = document.createElement('div');
    el.className = 'breach-email-item';

    const date    = b.BreachDate ? new Date(b.BreachDate).toLocaleDateString(undefined, { year: 'numeric', month: 'short' }) : '—';
    const pwned   = b.PwnCount   ? `${(b.PwnCount / 1_000_000).toFixed(1)}M accounts` : '';
    const classes = (b.DataClasses || []).slice(0, 4);

    el.innerHTML = `
      <div class="breach-email-header">
        <span class="breach-email-name">${escHtml(b.Title || b.Name)}</span>
        <span class="breach-email-date">${escHtml(date)}</span>
      </div>
      ${pwned ? `<div class="breach-email-size">${escHtml(pwned)} affected</div>` : ''}
      <div class="breach-email-classes">${classes.map(c => `<span class="breach-dc-tag">${escHtml(c)}</span>`).join('')}</div>`;
    list.appendChild(el);
  });
}
