// ── Dashboard → extension bridge ───────────────────────────────────────────────
// The Seekurify dashboard (web page) posts window messages with { skBridge: true }
// which this listener relays into the extension runtime so the popup can react
// to vault changes (add / update / delete) without a full reload.
window.addEventListener('message', (e) => {
  if (e.source !== window || !e.data?.skBridge) return;
  chrome.runtime.sendMessage(e.data.payload).catch(() => {});
});

// ── State ──────────────────────────────────────────────────────────────────────
let vaultEntries   = [];
let activeDropdown = null;
let activeBar      = null;
let initialized    = false;

// Tracks all injected icon buttons so orphans can be pruned when React remounts
const _iconBtns = new Set();

const PENDING_KEY = 'sk_pending_cred';

// ── Helpers ────────────────────────────────────────────────────────────────────
function getDomain() {
  return window.location.hostname.replace(/^www\./, '');
}

function matchesDomain(entry, domain) {
  if (!entry.website) return false;
  try {
    const url = entry.website.startsWith('http') ? entry.website : `https://${entry.website}`;
    const d = new URL(url).hostname.replace(/^www\./, '');
    return d === domain || d.endsWith(`.${domain}`) || domain.endsWith(`.${d}`);
  } catch {
    return entry.website.includes(domain);
  }
}

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function setNativeValue(el, value) {
  try {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
    if (setter) setter.call(el, value);
    else el.value = value;
  } catch { el.value = value; }
  el.dispatchEvent(new Event('input',  { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
}

// ── Init ───────────────────────────────────────────────────────────────────────
async function init() {
  if (initialized) return;
  initialized = true;

  const { token, apiBase } = await chrome.storage.local.get(['token', 'apiBase']);
  if (!token) return;

  // Don't inject on the Seekurify app's own pages (same hostname as the API/dashboard)
  try {
    const appHost = new URL(apiBase || 'http://localhost:5000').hostname;
    if (window.location.hostname === appHost) return;
  } catch { /* malformed apiBase — continue */ }

  // Check for credentials captured on the previous page before navigation
  await checkPendingCredential();

  // Load vault for autofill — failure is non-fatal, form watching still runs
  try {
    const data = await chrome.runtime.sendMessage({ type: 'GET_VAULT' });
    if (Array.isArray(data)) {
      const domain = getDomain();
      vaultEntries = data.filter(e => matchesDomain(e, domain));
    }
  } catch { /* vault unavailable — autofill icons won't show, but save detection still works */ }

  attachToPage();
  observeDOM();
}

// ── Pending credential — survives page navigation via session storage ───────────
async function checkPendingCredential() {
  try {
    const stored = await chrome.storage.session.get(PENDING_KEY);
    const pending = stored[PENDING_KEY];
    if (!pending) return;

    // Discard stale entries (older than 30 s)
    if (Date.now() - pending.timestamp > 30_000) {
      await chrome.storage.session.remove(PENDING_KEY);
      return;
    }

    await chrome.storage.session.remove(PENDING_KEY);

    if (pending.mode === 'save') {
      showBar('save', null, pending.password, pending.username, pending.website);
    } else {
      showBar('update',
        { _id: pending.existingId, website: pending.website, password: pending.oldPassword },
        pending.password, pending.username, pending.website
      );
    }
  } catch {
    // chrome.storage.session not available in this context — ignore
  }
}

function savePending(payload) {
  // Fire-and-forget write — fast enough to survive most page navigations
  chrome.storage.session.set({ [PENDING_KEY]: { ...payload, timestamp: Date.now() } }).catch(() => {});
}

function clearPending() {
  chrome.storage.session.remove(PENDING_KEY).catch(() => {});
}

// ── Form attachment ────────────────────────────────────────────────────────────
function attachToPage() {
  document.querySelectorAll('input[type="password"]').forEach(attachToPasswordField);
  document.querySelectorAll('form').forEach(watchForm);
}

function pruneOrphanedIcons() {
  for (const btn of _iconBtns) {
    if (!document.body.contains(btn._skField)) {
      btn.remove();
      _iconBtns.delete(btn);
    }
  }
}

function attachToPasswordField(field) {
  if (field.dataset.skAttached) return;
  field.dataset.skAttached = 'true';
  if (!vaultEntries.length) return; // no entries to autofill — skip icon

  pruneOrphanedIcons(); // remove buttons whose fields were unmounted by React

  function placeIcon() {
    const rect = field.getBoundingClientRect();
    if (!rect.width) return;

    let btn = field._skBtn;
    if (!btn) {
      btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'sk-icon-btn';
      btn.title = 'Autofill from Seekurify';
      btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 2L4 6v6c0 5.25 3.5 10.15 8 11.35C16.5 22.15 20 17.25 20 12V6l-8-4z" fill="#06b6d4"/>
        <path d="M9 12l2 2 4-4" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>`;
      btn.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); showDropdown(field, btn); });
      btn._skField = field; // back-reference for orphan detection
      document.body.appendChild(btn);
      _iconBtns.add(btn);
      field._skBtn = btn;
      // Tell the password generator to shift left so the two icons don't overlap.
      // Dispatching 'pwgen-reposition' lets the generator reposition immediately
      // for SPA fields where it may have already run before this icon was attached.
      field.setAttribute('data-pwgen-right', '60');
      field.dispatchEvent(new CustomEvent('pwgen-reposition', { bubbles: false }));
    }

    const sx = window.scrollX, sy = window.scrollY;
    btn.style.top  = `${rect.top  + sy + (rect.height - 24) / 2}px`;
    btn.style.left = `${rect.left + sx + rect.width - 30}px`;
  }

  placeIcon();
  window.addEventListener('resize', placeIcon, { passive: true });
  window.addEventListener('scroll', placeIcon, { passive: true });
}

function watchForm(form) {
  if (form.dataset.skWatched) return;
  form.dataset.skWatched = 'true';
  form.addEventListener('submit', handleFormSubmit, true);
}

// ── Autofill dropdown ──────────────────────────────────────────────────────────
function showDropdown(passwordField, anchorBtn) {
  closeDropdown();
  const dropdown = document.createElement('div');
  dropdown.className = 'sk-dropdown';

  vaultEntries.forEach(entry => {
    const item = document.createElement('button');
    item.type = 'button';
    item.className = 'sk-dropdown-item';
    item.innerHTML = `
      <span class="sk-dd-avatar">S</span>
      <span class="sk-dd-info">
        <span class="sk-dd-user">${escapeHtml(entry.username)}</span>
        <span class="sk-dd-site">${escapeHtml(entry.website)}</span>
      </span>`;
    item.addEventListener('click', e => {
      e.preventDefault(); e.stopPropagation();
      fillCredentials(passwordField, entry);
      closeDropdown();
    });
    dropdown.appendChild(item);
  });

  const rect = anchorBtn.getBoundingClientRect();
  dropdown.style.top  = `${rect.bottom + window.scrollY + 6}px`;
  dropdown.style.left = `${rect.left   + window.scrollX - 180}px`;

  document.body.appendChild(dropdown);
  activeDropdown = dropdown;
  setTimeout(() => document.addEventListener('click', closeDropdown, { once: true }), 0);
}

function closeDropdown() { activeDropdown?.remove(); activeDropdown = null; }

function fillCredentials(passwordField, entry) {
  const form = passwordField.closest('form') || passwordField.closest('div[class*="login"], section');
  const candidates = (form || document).querySelectorAll(
    'input[type="text"], input[type="email"], input[autocomplete*="username"], input[autocomplete*="email"]'
  );
  let usernameField = null;
  for (const input of candidates) {
    if (input.compareDocumentPosition(passwordField) & Node.DOCUMENT_POSITION_FOLLOWING) {
      usernameField = input;
    }
  }
  if (usernameField) setNativeValue(usernameField, entry.username || '');
  setNativeValue(passwordField, entry.password || '');
}

// ── Form submit detection ──────────────────────────────────────────────────────
function handleFormSubmit(e) {
  const form = e.currentTarget;
  const pwFields = [...form.querySelectorAll('input[type="password"]')];
  if (!pwFields.length) return;

  const usernameInput = form.querySelector([
    'input[type="email"]',
    'input[type="text"]',
    'input[autocomplete*="username"]',
    'input[autocomplete*="email"]',
    'input[name*="user"]',
    'input[name*="email"]',
    'input[id*="email"]',
    'input[id*="user"]',
  ].join(', '));

  const username = usernameInput?.value?.trim() || '';
  const password = pwFields[0]?.value || '';
  if (!password) return;

  const domain = getDomain();
  const isPasswordChange = pwFields.length >= 2;

  if (isPasswordChange) {
    const newPassword = pwFields[pwFields.length - 1]?.value || password;
    const existing = vaultEntries.find(en => en.username === username) || vaultEntries[0];
    if (!existing) return;

    savePending({ mode: 'update', username, password: newPassword, existingId: existing._id, oldPassword: existing.password, website: domain });
    showBar('update', existing, newPassword, username, domain);
  } else {
    const alreadySaved = vaultEntries.some(en => en.username === username);
    if (alreadySaved || !username || !password) return;

    savePending({ mode: 'save', username, password, website: domain });
    showBar('save', null, password, username, domain);
  }
}

// ── Save / Update banner ───────────────────────────────────────────────────────
function showBar(mode, existing, password, username, website) {
  removeBar();

  const label = mode === 'save'
    ? `Save password for <strong>${escapeHtml(website)}</strong>?`
    : `Update password for <strong>${escapeHtml(existing?.website || website)}</strong>?`;

  const bar = document.createElement('div');
  bar.className = `sk-bar sk-bar-${mode}`;
  bar.innerHTML = `
    <div class="sk-bar-inner">
      <span class="sk-bar-logo">S</span>
      <span class="sk-bar-text">${label}</span>
      <div class="sk-bar-actions">
        <button class="sk-bar-btn sk-bar-confirm">${mode === 'save' ? 'Save' : 'Update'}</button>
        <button class="sk-bar-btn sk-bar-dismiss">Not now</button>
      </div>
    </div>`;

  bar.querySelector('.sk-bar-confirm').addEventListener('click', async () => {
    clearPending();
    const confirmBtn = bar.querySelector('.sk-bar-confirm');
    confirmBtn.textContent = '…';
    confirmBtn.disabled = true;

    try {
      if (mode === 'save') {
        const resp = await chrome.runtime.sendMessage({
          type: 'SAVE_PASSWORD',
          data: { website, username, password },
        });
        if (resp?.error) throw new Error(resp.error);
        const newEntry = { ...resp, website, username, password };
        vaultEntries.push(newEntry);
        chrome.runtime.sendMessage({ type: 'VAULT_UPDATED', action: 'add', entry: newEntry }).catch(() => {});
      } else {
        const resp = await chrome.runtime.sendMessage({
          type: 'UPDATE_PASSWORD',
          id: existing._id,
          data: { password, currentPassword: existing.password },
        });
        if (resp?.error) throw new Error(resp.error);
        if (existing) existing.password = password;
        chrome.runtime.sendMessage({ type: 'VAULT_UPDATED', action: 'update', entry: { _id: existing._id, password } }).catch(() => {});
      }
      confirmBtn.textContent = '✓ Saved';
      confirmBtn.style.background = '#15803d';
      setTimeout(removeBar, 1500);
    } catch (err) {
      const isExpired = err.message === 'session_expired';
      confirmBtn.textContent = isExpired ? 'Sign in' : 'Retry';
      confirmBtn.disabled = false;
      bar.querySelector('.sk-bar-text').innerHTML = isExpired
        ? `<span style="color:#fbbf24">Session expired — open the Seekurify extension to sign in again</span>`
        : `<span style="color:#f87171">${escapeHtml(err.message || 'Failed to save — check you are signed in')}</span>`;
      if (isExpired) {
        confirmBtn.addEventListener('click', () => chrome.runtime.sendMessage({ type: 'OPEN_POPUP' }).catch(() => {}), { once: true });
      }
    }
  });

  bar.querySelector('.sk-bar-dismiss').addEventListener('click', () => { clearPending(); removeBar(); });
  document.body.insertBefore(bar, document.body.firstChild);
  activeBar = bar;
}

function removeBar() { activeBar?.remove(); activeBar = null; }

// ── Listen for fill command from popup ─────────────────────────────────────────
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'FILL_CREDENTIALS') {
    const pwField = document.querySelector('input[type="password"]');
    if (pwField) fillCredentials(pwField, message.entry);
    sendResponse({ ok: true });
  }
  if (message.type === 'PING') sendResponse({ ok: true });
});

// ── MutationObserver for SPAs ──────────────────────────────────────────────────
function observeDOM() {
  let timer;
  new MutationObserver(() => {
    clearTimeout(timer);
    timer = setTimeout(attachToPage, 300);
  }).observe(document.body, { childList: true, subtree: true });
}

init();
