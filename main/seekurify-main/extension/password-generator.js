(async () => {

// ── Character sets ─────────────────────────────────────────────────────────────
const CHARS = {
  lower:   'abcdefghijklmnopqrstuvwxyz',
  upper:   'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  digits:  '0123456789',
  symbols: '!@#$%^&*()_+-=[]{}|;:,.<>?',
};

function generatePassword(length, opts) {
  let charset = CHARS.lower;
  const required = [CHARS.lower[Math.floor(Math.random() * 26)]]; // always one lower
  if (opts.upper)   { charset += CHARS.upper;   required.push(pickRandom(CHARS.upper)); }
  if (opts.digits)  { charset += CHARS.digits;  required.push(pickRandom(CHARS.digits)); }
  if (opts.symbols) { charset += CHARS.symbols; required.push(pickRandom(CHARS.symbols)); }

  const arr = new Uint32Array(length);
  crypto.getRandomValues(arr);
  const pw = Array.from(arr, n => charset[n % charset.length]);

  // Inject required chars at random positions (guarantees at least 1 of each class)
  required.forEach((ch, i) => { pw[i] = ch; });

  // Fisher-Yates shuffle
  for (let i = pw.length - 1; i > 0; i--) {
    const j = Math.floor(crypto.getRandomValues(new Uint32Array(1))[0] / 0xFFFFFFFF * (i + 1));
    [pw[i], pw[j]] = [pw[j], pw[i]];
  }
  return pw.join('');
}

function pickRandom(str) {
  return str[crypto.getRandomValues(new Uint32Array(1))[0] % str.length];
}

// ── Shadow DOM CSS ─────────────────────────────────────────────────────────────
const SHADOW_CSS = `
  :host {
    all: initial;
    position: fixed;
    z-index: 2147483646;
    display: block;
    pointer-events: none;
  }

  /* ── Trigger button ── */
  .gen-btn {
    pointer-events: auto;
    position: absolute;
    width: 24px;
    height: 24px;
    border-radius: 6px;
    background: #0e7490;
    font-size: 0;
    line-height: 1;
    border: 1px solid #0891b2;
    color: #cffafe;
    font-size: 13px;
    line-height: 1;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 1px 6px rgba(0,0,0,0.45);
    transition: background 0.15s, transform 0.1s;
    top: 0; left: 0;
    padding: 0;
  }
  .gen-btn:hover { background: #0891b2; transform: scale(1.08); }
  .gen-btn:active { transform: scale(0.95); }

  /* ── Generator panel ── */
  .panel {
    pointer-events: auto;
    position: absolute;
    top: 32px;
    right: 0;
    width: 260px;
    background: #0f172a;
    border: 1.5px solid #0e7490;
    border-radius: 10px;
    box-shadow: 0 8px 32px rgba(0,0,0,0.8);
    padding: 12px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    color: #e2e8f0;
    font-size: 12px;
    animation: pop 0.15s ease;
    box-sizing: border-box;
  }
  .panel[hidden] { display: none; }
  @keyframes pop {
    from { opacity: 0; transform: translateY(-6px); }
    to   { opacity: 1; transform: translateY(0); }
  }

  .panel-title {
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.07em;
    color: #0e7490;
    margin-bottom: 8px;
    display: flex;
    align-items: center;
    gap: 5px;
  }

  /* ── Password display ── */
  .pw-row {
    display: flex;
    align-items: center;
    gap: 5px;
    background: #1e293b;
    border: 1px solid #334155;
    border-radius: 7px;
    padding: 6px 8px;
    margin-bottom: 10px;
  }
  .pw-text {
    flex: 1;
    font-family: 'Courier New', monospace;
    font-size: 12px;
    font-weight: 600;
    color: #f1f5f9;
    word-break: break-all;
    line-height: 1.4;
    user-select: all;
  }
  .pw-text.hidden-pw { filter: blur(4px); user-select: none; }

  .icon-btn {
    background: none;
    border: none;
    cursor: pointer;
    color: #64748b;
    font-size: 13px;
    padding: 2px 4px;
    border-radius: 4px;
    transition: color 0.12s, background 0.12s;
    flex-shrink: 0;
    line-height: 1;
  }
  .icon-btn:hover { color: #94a3b8; background: #334155; }

  /* ── Strength bar ── */
  .strength-row {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 10px;
  }
  .strength-bar {
    flex: 1;
    height: 3px;
    background: #1e293b;
    border-radius: 2px;
    overflow: hidden;
  }
  .strength-label {
    font-size: 9px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    flex-shrink: 0;
    min-width: 54px;
    text-align: right;
  }
  .strength-fill {
    height: 100%;
    border-radius: 2px;
    transition: width 0.3s ease, background 0.3s ease;
  }

  /* ── Options ── */
  .option-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 7px;
  }
  .option-label {
    font-size: 11px;
    color: #94a3b8;
  }
  .length-row {
    display: flex;
    align-items: center;
    gap: 7px;
    margin-bottom: 9px;
  }
  .length-row input[type=range] {
    flex: 1;
    accent-color: #0e7490;
    cursor: pointer;
  }
  .length-val {
    font-size: 12px;
    font-weight: 700;
    color: #f1f5f9;
    min-width: 20px;
    text-align: right;
  }

  .checkboxes {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 5px 10px;
    margin-bottom: 10px;
  }
  .cb-label {
    display: flex;
    align-items: center;
    gap: 5px;
    font-size: 11px;
    color: #94a3b8;
    cursor: pointer;
    user-select: none;
  }
  .cb-label input { accent-color: #0e7490; cursor: pointer; }

  /* ── Actions ── */
  .actions {
    display: flex;
    gap: 6px;
    margin-top: 2px;
  }
  .btn-regen {
    flex: 1;
    padding: 7px;
    background: #1e293b;
    color: #94a3b8;
    border: 1px solid #334155;
    border-radius: 7px;
    font-size: 11px;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.12s, color 0.12s;
  }
  .btn-regen:hover { background: #334155; color: #f1f5f9; }

  .btn-fill {
    flex: 1;
    padding: 7px;
    background: #0e7490;
    color: white;
    border: none;
    border-radius: 7px;
    font-size: 11px;
    font-weight: 700;
    cursor: pointer;
    transition: background 0.12s;
  }
  .btn-fill:hover { background: #0891b2; }

  .copy-flash { color: #4ade80 !important; }
`;

// ── State tracking ─────────────────────────────────────────────────────────────
const attached = new WeakSet();   // fields that already have a button
const buttons  = new Map();       // field → { host, shadow, panelOpen }

// Open panel reference — only one open at a time
let openField = null;

// ── Attach button to a password field ─────────────────────────────────────────
function attachButton(field) {
  if (attached.has(field)) return;
  if (field.hasAttribute('data-no-pwgen')) return;
  if (field.offsetWidth < 60) return; // skip tiny hidden fields

  attached.add(field);

  // Reserve space inside the field for the button (skip if host element controls its own padding)
  if (!field.hasAttribute('data-pwgen-right')) {
    const origPR = field.style.paddingRight;
    const curPR  = parseInt(getComputedStyle(field).paddingRight, 10) || 6;
    field.style.paddingRight = `${curPR + 30}px`;
    field._skOrigPR = origPR;
  }

  // Host div — fixed-positioned, zero-size, Shadow DOM inside
  const host = document.createElement('div');
  host.setAttribute('data-sk-pwgen', '');
  const shadow = host.attachShadow({ mode: 'closed' });

  const style = document.createElement('style');
  style.textContent = SHADOW_CSS;
  shadow.appendChild(style);

  // Trigger button
  const btn = document.createElement('button');
  btn.className = 'gen-btn';
  btn.title = 'Generate secure password';
  btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
    <path d="M13 10h-3l1 4h-2l3 4-1-4h2z" fill="white" stroke="none"/>
  </svg>`;
  shadow.appendChild(btn);

  // Generator panel
  const panel = document.createElement('div');
  panel.className = 'panel';
  panel.setAttribute('hidden', '');
  panel.innerHTML = buildPanelHTML();
  shadow.appendChild(panel);

  document.body.appendChild(host);

  const state = { host, shadow, panel, field, opts: { upper: true, digits: true, symbols: true }, length: 16, visible: false, currentPw: '' };
  buttons.set(field, state);

  positionHost(host, field);
  wirePanel(state, btn, panel, field);

  // Re-position if the autofill icon attaches after us (SPA late-attach)
  field.addEventListener('pwgen-reposition', () => positionHost(host, field));
}

function buildPanelHTML() {
  return `
    <div class="panel-title">🔑 Password Generator</div>
    <div class="pw-row">
      <span class="pw-text" id="pw-text"></span>
      <button class="icon-btn" id="btn-eye" title="Show/hide">👁</button>
      <button class="icon-btn" id="btn-copy" title="Copy">⧉</button>
    </div>
    <div class="strength-row"><div class="strength-bar"><div class="strength-fill" id="strength-fill"></div></div><span class="strength-label" id="strength-label"></span></div>
    <div class="length-row">
      <span class="option-label">Length</span>
      <input type="range" id="len-slider" min="8" max="32" value="16" />
      <span class="length-val" id="len-val">16</span>
    </div>
    <div class="checkboxes">
      <label class="cb-label"><input type="checkbox" id="cb-upper" checked> Uppercase</label>
      <label class="cb-label"><input type="checkbox" id="cb-digits" checked> Numbers</label>
      <label class="cb-label"><input type="checkbox" id="cb-symbols" checked> Symbols</label>
    </div>
    <div class="actions">
      <button class="btn-regen" id="btn-regen">↺ Regenerate</button>
      <button class="btn-fill" id="btn-fill">Use Password</button>
    </div>`;
}

function wirePanel(state, btn, panel, field) {
  const { shadow } = state;
  const $  = id => shadow.getElementById(id);

  const pwText     = $('pw-text');
  const eyeBtn     = $('btn-eye');
  const copyBtn    = $('btn-copy');
  const lenSlider  = $('len-slider');
  const lenVal     = $('len-val');
  const cbUpper    = $('cb-upper');
  const cbDigits   = $('cb-digits');
  const cbSymbols  = $('cb-symbols');
  const regenBtn   = $('btn-regen');
  const fillBtn    = $('btn-fill');
  const strengthFill  = $('strength-fill');
  const strengthLabel = $('strength-label');

  function regen() {
    state.currentPw = generatePassword(state.length, state.opts);
    pwText.textContent = state.currentPw;
    if (!state.visible) pwText.classList.add('hidden-pw');
    updateStrength(state.currentPw, strengthFill, strengthLabel);
  }

  function openPanel() {
    // Close any other open panel
    if (openField && openField !== field) {
      const other = buttons.get(openField);
      if (other) { other.panel.setAttribute('hidden', ''); }
    }
    openField = field;
    regen();
    panel.removeAttribute('hidden');
    // Flip panel to left if it would overflow right edge
    const rect = field.getBoundingClientRect();
    if (rect.right + 270 > window.innerWidth) {
      panel.style.right = '0';
      panel.style.left  = 'auto';
    } else {
      panel.style.right = 'auto';
      panel.style.left  = '0';
    }
  }

  function closePanel() {
    panel.setAttribute('hidden', '');
    if (openField === field) openField = null;
  }

  // Trigger button toggle
  btn.addEventListener('click', e => {
    e.stopPropagation();
    panel.hasAttribute('hidden') ? openPanel() : closePanel();
  });

  // Eye toggle
  eyeBtn.addEventListener('click', () => {
    state.visible = !state.visible;
    pwText.classList.toggle('hidden-pw', !state.visible);
    eyeBtn.textContent = state.visible ? '🙈' : '👁';
  });

  // Copy
  copyBtn.addEventListener('click', () => {
    navigator.clipboard.writeText(state.currentPw).then(() => {
      copyBtn.classList.add('copy-flash');
      copyBtn.textContent = '✓';
      setTimeout(() => { copyBtn.classList.remove('copy-flash'); copyBtn.textContent = '⧉'; }, 1500);
    });
  });

  // Length slider
  lenSlider.addEventListener('input', () => {
    state.length = parseInt(lenSlider.value, 10);
    lenVal.textContent = state.length;
    regen();
  });

  // Checkboxes — always keep at least one class enabled
  [cbUpper, cbDigits, cbSymbols].forEach(cb => {
    cb.addEventListener('change', () => {
      state.opts.upper   = cbUpper.checked;
      state.opts.digits  = cbDigits.checked;
      state.opts.symbols = cbSymbols.checked;
      // Prevent all off
      if (!state.opts.upper && !state.opts.digits && !state.opts.symbols) {
        cb.checked = true;
        state.opts[cb.id === 'cb-upper' ? 'upper' : cb.id === 'cb-digits' ? 'digits' : 'symbols'] = true;
      }
      regen();
    });
  });

  // Regenerate
  regenBtn.addEventListener('click', regen);

  // Fill password into field
  fillBtn.addEventListener('click', () => {
    field.focus();
    field.value = state.currentPw;
    // Trigger React / Vue synthetic events so frameworks detect the change
    field.dispatchEvent(new InputEvent('input',  { bubbles: true, composed: true }));
    field.dispatchEvent(new Event('change',       { bubbles: true, composed: true }));
    closePanel();
  });

  // Close when clicking outside
  document.addEventListener('click', e => {
    if (!panel.hasAttribute('hidden') && !state.host.contains(e.target)) {
      closePanel();
    }
  }, true);
}

// ── Password strength ──────────────────────────────────────────────────────────
function updateStrength(pw, fillEl, labelEl) {
  let score = 0;
  if (pw.length >= 12) score++;
  if (pw.length >= 16) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;

  const pct   = (score / 5) * 100;
  const color = score <= 1 ? '#f87171' : score <= 2 ? '#f97316' : score <= 3 ? '#fbbf24' : score === 4 ? '#34d399' : '#4ade80';
  fillEl.style.width      = `${pct}%`;
  fillEl.style.background = color;

  if (labelEl) {
    const labels = ['Very Weak', 'Weak', 'Fair', 'Good', 'Strong'];
    labelEl.textContent  = labels[score] ?? 'Strong';
    labelEl.style.color  = color;
  }
}

// ── Positioning ────────────────────────────────────────────────────────────────
function positionHost(host, field) {
  const rect = field.getBoundingClientRect();
  if (rect.width === 0) return; // not visible
  const btnTop  = rect.top  + (rect.height - 24) / 2;
  const btnLeft = rect.right - parseInt(field.getAttribute('data-pwgen-right') || '30', 10);
  host.style.cssText = `position:fixed;z-index:2147483646;top:${btnTop}px;left:${btnLeft}px;width:0;height:0;pointer-events:none;`;
}

function repositionAll() {
  buttons.forEach(({ host }, field) => positionHost(host, field));
}

window.addEventListener('scroll',  repositionAll, { passive: true });
window.addEventListener('resize',  repositionAll, { passive: true });

// ── Field discovery ────────────────────────────────────────────────────────────
function scanFields() {
  document.querySelectorAll('input[type="password"]').forEach(attachButton);
}

// Initial scan
scanFields();

// Watch for dynamically added fields (SPAs, lazy-rendered forms)
new MutationObserver(mutations => {
  for (const m of mutations) {
    for (const node of m.addedNodes) {
      if (node.nodeType !== 1) continue;
      if (node.matches?.('input[type="password"]')) attachButton(node);
      node.querySelectorAll?.('input[type="password"]').forEach(attachButton);
    }
  }
}).observe(document.body, { childList: true, subtree: true });

// ── Cleanup when a field is removed ───────────────────────────────────────────
new MutationObserver(mutations => {
  for (const m of mutations) {
    for (const node of m.removedNodes) {
      if (node.nodeType !== 1) continue;
      const check = el => {
        if (buttons.has(el)) {
          const { host } = buttons.get(el);
          host.remove();
          buttons.delete(el);
        }
      };
      check(node);
      node.querySelectorAll?.('input[type="password"]').forEach(check);
    }
  }
}).observe(document.body, { childList: true, subtree: true });

})();
