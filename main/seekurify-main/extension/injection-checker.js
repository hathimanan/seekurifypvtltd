(async () => {

// ── Platform detection ─────────────────────────────────────────────────────────
const AI_PLATFORMS = {
  'chat.openai.com':        'ChatGPT',
  'chatgpt.com':            'ChatGPT',
  'claude.ai':              'Claude',
  'gemini.google.com':      'Gemini',
  'copilot.microsoft.com':  'Copilot',
  'www.bing.com':           'Bing AI',
  'perplexity.ai':          'Perplexity',
  'www.perplexity.ai':      'Perplexity',
  'character.ai':           'Character.AI',
  'www.character.ai':       'Character.AI',
};

const hostname     = window.location.hostname;
const platformName = Object.entries(AI_PLATFORMS)
  .find(([h]) => hostname === h || hostname.endsWith('.' + h))?.[1];

if (!platformName) return;

// ── Monitoring toggle ──────────────────────────────────────────────────────────
const stored = await chrome.storage.local.get('injection_monitoring_enabled');
let monitoringEnabled = stored.injection_monitoring_enabled !== false;

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && 'injection_monitoring_enabled' in changes) {
    monitoringEnabled = changes.injection_monitoring_enabled.newValue !== false;
    if (!monitoringEnabled) removeWarning();
  }
});

// ── Injection patterns ─────────────────────────────────────────────────────────
const INJECTION_PATTERNS = [
  // ── SQL Injection ──────────────────────────────────────────────────────────
  { type: 'sql_union',     label: 'SQL UNION attack',       severity: 'critical',
    re: /\bUNION\s+(?:ALL\s+)?SELECT\b/gi },
  { type: 'sql_drop',      label: 'SQL DROP statement',     severity: 'critical',
    re: /\bDROP\s+(?:TABLE|DATABASE|SCHEMA|INDEX|VIEW|PROCEDURE|TRIGGER|FUNCTION)\b/gi },
  { type: 'sql_truncate',  label: 'SQL TRUNCATE statement', severity: 'critical',
    re: /\bTRUNCATE\s+(?:TABLE\s+)?\w+/gi },
  { type: 'sql_exec',      label: 'SQL code execution',     severity: 'critical',
    re: /\b(?:EXEC(?:UTE)?|xp_cmdshell|sp_executesql)\s*\(/gi },
  { type: 'sql_delete',    label: 'SQL DELETE injection',   severity: 'critical',
    re: /\bDELETE\s+FROM\s+\w+/gi },
  // Tautology: OR/AND with comparison (1=1, 'a'='a', "a"="a", 0=0, true, false)
  { type: 'sql_tautology', label: 'SQL tautology',          severity: 'high',
    re: /\b(?:OR|AND)\s+(?:'[^']{0,30}'\s*=\s*'[^']{0,30}'|"[^"]{0,30}"\s*=\s*"[^"]{0,30}"|\d+\s*=\s*\d+|(?:true|false)\b)/gi },
  // Double-dash, block comment, or MySQL # comment
  { type: 'sql_comment',   label: 'SQL comment bypass',     severity: 'high',
    re: /--(?:[ \t\r\n]|$)|\/\*[\s\S]{0,300}?\*\/|(?:^|[\s;'(])#.*/gim },
  { type: 'sql_stacked',   label: 'Stacked queries',        severity: 'high',
    re: /;\s*(?:SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|TRUNCATE|EXEC)\b/gi },
  { type: 'sql_create',    label: 'SQL CREATE statement',   severity: 'high',
    re: /\bCREATE\s+(?:TABLE|DATABASE|SCHEMA|INDEX|VIEW|PROCEDURE|TRIGGER|FUNCTION)\b/gi },
  { type: 'sql_alter',     label: 'SQL ALTER statement',    severity: 'high',
    re: /\bALTER\s+(?:TABLE|DATABASE|SCHEMA|PROCEDURE|FUNCTION)\s+\w+/gi },
  // SELECT must look like SQL: has a column list or wildcard before FROM
  { type: 'sql_select',    label: 'SQL SELECT statement',   severity: 'medium',
    re: /\bSELECT\s+(?:\*|[\w\s,.*()]+)\s+FROM\s+\w+/gi },
  { type: 'sql_insert',    label: 'SQL INSERT statement',   severity: 'medium',
    re: /\bINSERT\s+INTO\s+\w+/gi },
  { type: 'sql_update',    label: 'SQL UPDATE statement',   severity: 'medium',
    re: /\bUPDATE\s+\w+\s+SET\b/gi },
  { type: 'sql_grant',     label: 'SQL GRANT/REVOKE',       severity: 'medium',
    re: /\b(?:GRANT|REVOKE)\s+\w+\s+(?:ON|FROM|TO)\b/gi },

  // ── Prompt Injection / Jailbreak ────────────────────────────────────────────
  { type: 'ignore_instr',  label: 'Ignore instructions',    severity: 'critical',
    re: /\bignore\s+(?:all\s+)?(?:previous|your|prior|above|the\s+above)\s+instructions\b/gi },
  { type: 'override_sys',  label: 'Override safety',        severity: 'critical',
    re: /\b(?:override|bypass|circumvent|disable)\s+(?:your\s+)?(?:safety|guidelines|restrictions|filters|training|alignment)\b/gi },
  { type: 'jailbreak',     label: 'Jailbreak attempt',      severity: 'critical',
    re: /\b(?:jailbreak|DAN\s+mode|do\s+anything\s+now|unrestricted\s+mode|god\s+mode)\b/gi },
  { type: 'reveal_prompt', label: 'System prompt leak',     severity: 'high',
    re: /\b(?:reveal|show|print|output|display|tell\s+me)\s+(?:your\s+)?(?:system\s+prompt|initial\s+prompt|base\s+prompt|hidden\s+instructions)\b/gi },
  // Role override: simplified to avoid nested optional + lookahead backtracking
  { type: 'role_override', label: 'Role override',          severity: 'high',
    re: /\bpretend\s+(?:you\s+are|to\s+be)\b|\bact\s+as\s+(?:a\s+)?(?!helpful\b|an?\s+AI\b|assistant\b)\w+/gi },
  { type: 'forget_ctx',    label: 'Context wipe',           severity: 'high',
    re: /\b(?:forget|disregard|reset|erase)\s+(?:everything|all|previous\s+(?:context|instructions)|your\s+training)\b/gi },
  { type: 'token_manip',   label: 'Token manipulation',     severity: 'medium',
    re: /\b(?:system:|assistant:|human:|user:)\s*[\[{<]/gi },

  // ── Command Injection ────────────────────────────────────────────────────────
  { type: 'cmd_shell',     label: 'Shell command',          severity: 'critical',
    re: /(?:;\s*(?:ls|cat|rm\s+-rf|wget|curl|chmod|sudo|bash|sh|nc)\b|&&\s*\w+|\|\s*(?:sh|bash|cmd|powershell)(?:\s|$))/gi },
  { type: 'cmd_subshell',  label: 'Subshell execution',     severity: 'critical',
    re: /\$\([^)]{2,80}\)/g },

  // ── Other injections ─────────────────────────────────────────────────────────
  { type: 'xss',           label: 'XSS injection',          severity: 'high',
    re: /<script[\s>]|javascript:\s*(?!void)/gi },
  { type: 'path_traversal',label: 'Path traversal',         severity: 'high',
    re: /\.{2}[/\\](?:etc|windows|system32|proc|var|root)\b/gi },
  { type: 'template_inj',  label: 'Template injection',     severity: 'high',
    re: /\{\{[^}]{1,100}\}\}|\$\{[^}]{1,100}\}/g },
  { type: 'ldap_inj',      label: 'LDAP injection',         severity: 'high',
    re: /\)\s*\(\s*(?:uid|cn|ou|dc|objectClass)\s*=\s*\*/gi },
];

const SEV_COLOR = { critical: '#f87171', high: '#f97316', medium: '#fbbf24', low: '#60a5fa' };
const SEV_ORDER = { critical: 0, high: 1, medium: 2, low: 3 };

function scanText(text) {
  const found = [];
  for (const p of INJECTION_PATTERNS) {
    p.re.lastIndex = 0;
    if (p.re.test(text)) found.push({ type: p.type, label: p.label, severity: p.severity });
  }
  return found;
}

function mergeFindings(a, b) {
  const seen = new Set(a.map(f => f.type));
  return [...a, ...b.filter(f => !seen.has(f.type))];
}

// ── In-page warning banner (top-centered, distinct from PII bar at bottom) ─────
let warningEl = null;

function showWarning(findings, source) {
  if (!monitoringEnabled || !findings.length) return;
  removeWarning();

  const sorted = [...findings].sort((a, b) => (SEV_ORDER[a.severity] ?? 4) - (SEV_ORDER[b.severity] ?? 4));
  const color  = SEV_COLOR[sorted[0]?.severity || 'high'];
  const pills  = sorted.map(f =>
    `<span class="sk-inj-pill" style="border-color:${SEV_COLOR[f.severity]};color:${SEV_COLOR[f.severity]}">${escHtml(f.label)}</span>`
  ).join('');

  warningEl = document.createElement('div');
  warningEl.className = 'sk-inj-bar';
  warningEl.innerHTML = `
    <div class="sk-inj-bar-inner">
      <span class="sk-inj-icon" style="background:${color}22;border:1.5px solid ${color}">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
          <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
        </svg>
      </span>
      <div class="sk-inj-bar-body">
        <div class="sk-inj-bar-title" style="color:${color}">Injection attempt detected</div>
        <div class="sk-inj-pills">${pills}</div>
        ${source === 'ai' ? '<div class="sk-inj-source">Verified by Seekurify AI</div>' : ''}
        <div class="sk-inj-bar-note">These patterns can manipulate AI behavior, extract hidden instructions, or execute unintended commands — remove them before submitting.</div>
      </div>
      <button class="sk-inj-dismiss" title="Dismiss">✕</button>
    </div>`;

  warningEl.querySelector('.sk-inj-dismiss').addEventListener('click', removeWarning);
  document.body.appendChild(warningEl);
}

function removeWarning() { warningEl?.remove(); warningEl = null; }

function escHtml(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ── Input monitoring ───────────────────────────────────────────────────────────
const INPUT_SELECTORS = [
  '#prompt-textarea',
  '.ProseMirror[contenteditable="true"]',
  'div.ql-editor[contenteditable="true"]',
  'div[contenteditable="true"][aria-label]',
  'div[contenteditable="true"][placeholder]',
  'textarea[data-id]',
  'textarea[placeholder*="message" i]',
  'textarea[placeholder*="prompt" i]',
  'textarea[placeholder*="ask" i]',
  'textarea[placeholder*="chat" i]',
  'div[contenteditable="true"]',
  'textarea',
].join(', ');

const watchedInputs = new WeakSet();
const watchedBtns   = new WeakSet();
let inputTimer;
let backendTypingTimer;
let lastLogKey  = '';
let lastLogTime = 0;

function getText(el) {
  return (el.tagName === 'TEXTAREA' ? el.value : el.innerText || el.textContent) || '';
}
function isVisible(el) {
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0;
}

function watchInput(el) {
  if (watchedInputs.has(el) || !isVisible(el)) return;
  watchedInputs.add(el);

  el.addEventListener('input', () => {
    clearTimeout(inputTimer);
    clearTimeout(backendTypingTimer);
    inputTimer = setTimeout(() => handleChange(el), 700);
  });

  el.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) handleSubmit(el);
  });

  watchSendButtons(el);
}

function watchSendButtons(inputEl) {
  const CONTAINERS = [
    inputEl.closest('form'),
    inputEl.parentElement,
    inputEl.parentElement?.parentElement,
    inputEl.parentElement?.parentElement?.parentElement,
    document.querySelector('main'),
    document.body,
  ].filter(Boolean);

  const SEND_SEL = [
    'button[type="submit"]',
    'button[aria-label*="send" i]',
    'button[data-testid*="send" i]',
    'button[aria-label*="submit" i]',
    'button[class*="send" i]',
    'button[title*="send" i]',
  ].join(', ');

  for (const c of CONTAINERS) {
    const btns = c.querySelectorAll(SEND_SEL);
    btns.forEach(btn => {
      if (watchedBtns.has(btn)) return;
      watchedBtns.add(btn);
      btn.addEventListener('click', () => handleSubmit(inputEl), true);
    });
    if (btns.length) break;
  }
}

// ── Handlers ──────────────────────────────────────────────────────────────────
function handleChange(el) {
  if (!monitoringEnabled) return;
  const text = getText(el).trim();
  if (text.length < 5) { removeWarning(); return; }

  const localFindings = scanText(text);
  if (localFindings.length) {
    showWarning(localFindings, 'local');
    logDetection(localFindings, text, false);
  } else {
    removeWarning();
  }

  if (text.length > 10) {
    backendTypingTimer = setTimeout(() => runAiScan(el, text, false, localFindings), 3000);
  }
}

function handleSubmit(el) {
  if (!monitoringEnabled) return;
  const text = getText(el).trim();
  if (text.length < 3) return;

  const localFindings = scanText(text);
  if (localFindings.length) {
    showWarning(localFindings, 'local');
    logDetection(localFindings, text, true);
  }

  runAiScan(el, text, true, localFindings);
}

async function runAiScan(el, text, isSubmit, knownFindings) {
  try {
    const resp = await chrome.runtime.sendMessage({
      type: 'INJECTION_ANALYZE',
      text,
      platform: platformName,
      url: window.location.hostname,
      snippet: text.slice(0, 120) + (text.length > 120 ? '…' : ''),
      timestamp: Date.now(),
    });

    if (!resp || resp.error || !resp.findings?.length) return;

    const merged = mergeFindings(knownFindings, resp.findings);
    showWarning(merged, 'ai');
    if (merged.length > knownFindings.length || !knownFindings.length) {
      logDetection(merged, text, isSubmit);
    }
  } catch { /* backend unavailable — regex-only mode */ }
}

function logDetection(findings, text, isSubmit) {
  const key = platformName + ':' + findings.map(f => f.type).sort().join(',');
  if (!isSubmit && key === lastLogKey && Date.now() - lastLogTime < 30_000) return;
  lastLogKey  = key;
  lastLogTime = Date.now();

  const snippet = text.slice(0, 120) + (text.length > 120 ? '…' : '');
  chrome.runtime.sendMessage({
    type: isSubmit ? 'INJECTION_SUBMIT' : 'INJECTION_DETECTED',
    platform: platformName,
    url: window.location.hostname,
    findings,
    snippet,
    text: isSubmit ? text : undefined,
    timestamp: Date.now(),
  }).catch(() => {});
}

// ── Attach + observe ───────────────────────────────────────────────────────────
function attachAll() {
  document.querySelectorAll(INPUT_SELECTORS).forEach(watchInput);
}

attachAll();
let mutTimer;
new MutationObserver(() => {
  clearTimeout(mutTimer);
  mutTimer = setTimeout(attachAll, 500);
}).observe(document.body, { childList: true, subtree: true });

})();
