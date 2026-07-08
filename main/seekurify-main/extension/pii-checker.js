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

if (!platformName) return; // not an AI platform

// ── Monitoring toggle (respect user preference) ────────────────────────────────
const stored = await chrome.storage.local.get('pii_monitoring_enabled');
let monitoringEnabled = stored.pii_monitoring_enabled !== false; // default ON

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && 'pii_monitoring_enabled' in changes) {
    monitoringEnabled = changes.pii_monitoring_enabled.newValue !== false;
    if (!monitoringEnabled) removeWarning();
  }
});

// ── Regex patterns — structural PII ──────────────────────────────────────────
// These fire instantly with no network call.
const REGEX_PATTERNS = [
  // ── Structured identifiers ────────────────────────────────────────────────
  { type: 'email',        label: 'Email address',       severity: 'medium',   re: /\b[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}\b/g },
  // US phone (must have 3+3+4 digit groups)
  { type: 'phone_us',     label: 'US phone number',     severity: 'medium',   re: /\b(?:\+1[\s\-.]?)?\(?\d{3}\)?[\s\-.]?\d{3}[\s\-.]?\d{4}\b/g },
  // International phone: +[country code] then digits — exclude US (+1) since covered above
  { type: 'phone_intl',   label: 'Intl phone number',   severity: 'medium',   re: /\+(?!1[\s\-.(])[1-9]\d{0,2}[\s\-.]?\(?\d{1,4}\)?(?:[\s\-.]?\d{2,4}){2,4}/g },
  { type: 'ssn',          label: 'SSN',                 severity: 'critical', re: /\b(?!000|666|9\d{2})\d{3}[- ](?!00)\d{2}[- ](?!0{4})\d{4}\b/g },
  // Credit card: Visa/MC/Discover (16 digits) | Amex 15 digits (4-6-5 format) | MC 2-series
  { type: 'credit_card',  label: 'Credit card',         severity: 'critical', re: /\b(?:(?:4\d{3}|5[1-5]\d{2}|2[2-7]\d{2}|6011|65\d{2}|64[4-9]\d)[\s\-]?\d{4}[\s\-]?\d{4}[\s\-]?\d{4}|3[47]\d{2}[\s\-]?\d{6}[\s\-]?\d{5})\b/g },
  { type: 'iban',         label: 'IBAN',                severity: 'high',     re: /\b[A-Z]{2}\d{2}[A-Z0-9]{4}\d{7}(?:[A-Z0-9]{0,16})?\b/g },
  { type: 'passport',     label: 'Passport number',     severity: 'high',     re: /\bpassport(?:\s*(?:no|num|number|#|id))?\.?\s*[:\-]?\s*[A-Z]{1,2}\d{6,9}\b/gi },
  // Indian national IDs — actual number formats, not just keywords
  { type: 'aadhar',       label: 'Aadhar number',       severity: 'high',     re: /\b[2-9]\d{3}[\s\-]?\d{4}[\s\-]?\d{4}\b/g },
  { type: 'pan_card',     label: 'PAN card',            severity: 'high',     re: /\b[A-Z]{5}\d{4}[A-Z]\b/g },
  // ── Credentials ──────────────────────────────────────────────────────────
  { type: 'openai_key',   label: 'API key (OpenAI)',    severity: 'critical', re: /\bsk-(?:proj-|svcacct-)?[A-Za-z0-9\-_]{20,}/g },
  { type: 'aws_key',      label: 'AWS access key',      severity: 'critical', re: /\bAKIA[0-9A-Z]{16}\b/g },
  { type: 'aws_secret',   label: 'AWS secret key',      severity: 'critical', re: /\b(?:aws[_\-]?secret(?:[_\-]?access)?[_\-]?key|AWS_SECRET_ACCESS_KEY)\s*[=:]\s*["']?([A-Za-z0-9\/+=]{40})/gi },
  { type: 'github_token', label: 'GitHub token',        severity: 'critical', re: /\bgh[pousr]_[A-Za-z0-9_]{36,}\b/g },
  { type: 'google_key',   label: 'API key (Google)',    severity: 'critical', re: /\bAIza[0-9A-Za-z\-_]{35}\b/g },
  { type: 'jwt',          label: 'JWT token',           severity: 'high',     re: /\beyJ[A-Za-z0-9_\-]+\.[A-Za-z0-9_\-]+\.[A-Za-z0-9_\-]+/g },
  { type: 'pem_key',      label: 'Private key',         severity: 'critical', re: /-----BEGIN\s+(?:RSA\s+|EC\s+|OPENSSH\s+|DSA\s+)?PRIVATE\s+KEY-----/gi },
  { type: 'password',     label: 'Inline password',     severity: 'high',     re: /\b(?:password|passwd|pwd)\s*[=:]\s*["']?([^\s"',;]{6,})/gi },
  { type: 'db_url',       label: 'Database URL',        severity: 'critical', re: /(?:mongodb(?:\+srv)?|postgres(?:ql)?|mysql|redis|mssql):\/\/[^/\s]+:[^@\s]+@[^\s/]+/gi },
  { type: 'private_ip',   label: 'Private IP',          severity: 'medium',   re: /\b(?:10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(?:1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3})\b/g },
  // ── Natural-language / contextual patterns ────────────────────────────────
  { type: 'name',         label: 'Person name',         severity: 'medium',   re: /\b(?:my name is|i(?:'m| am| go by)|call me|this is)\s+([A-Za-z]{2,20}(?:\s+[A-Za-z]{2,20}){0,2})\b/gi },
  // full_name now requires a label (name:, patient:, client:) to avoid false positives on any two capitalized words
  { type: 'full_name',    label: 'Full name',           severity: 'low',      re: /\b(?:name|patient|client|employee|user|contact|for|to|from)\s*[:\-]\s*([A-Z][a-z]{1,20})\s+([A-Z][a-z]{1,20}(?:\s+[A-Z][a-z]{1,20})?)\b/gi },
  { type: 'age',          label: 'Age',                 severity: 'low',      re: /\bi(?:'m| am)\s+(\d{1,3})\s*(?:years?\s*(?:old)?|yr\.?s?)\b/gi },
  { type: 'home_address', label: 'Home address',        severity: 'high',     re: /\b(?:i live(?:\s+at)?|my (?:home|house|apartment|flat|address)(?:\s+is)?(?:\s+at)?|(?:living|residing) at)\s+\d+\s+[A-Za-z]/gi },
  { type: 'medical',      label: 'Medical info',        severity: 'high',     re: /\bmy\s+(?:doctor|physician|therapist|diagnosis|condition|medication|prescription|blood\s+type)\b|\b(?:diagnosed with|suffering from|allergic to|taking (?:medication|pills?|tablets?))\b/gi },
  // ── Government & classified ───────────────────────────────────────────────
  { type: 'gov_classified',     label: 'Classified document',       severity: 'critical', re: /\b(?:TOP\s+SECRET|SECRET|CONFIDENTIAL|RESTRICTED|CLASSIFIED|FOR\s+OFFICIAL\s+USE\s+ONLY|FOUO|SENSITIVE\s+BUT\s+UNCLASSIFIED|SBU|NOT\s+FOR\s+PUBLIC\s+RELEASE)\b/g },
  { type: 'voter_id_in',        label: 'Voter ID (EPIC)',           severity: 'high',     re: /\b[A-Z]{3}\d{7}\b/g },
  { type: 'driving_license_in', label: 'Driving licence (India)',   severity: 'high',     re: /\b[A-Z]{2}[\s\-]?\d{2}[\s\-]?\d{4}[\s\-]?\d{7}\b/g },
  // ── DPDP / GDPR special categories ───────────────────────────────────────
  { type: 'biometric_ref',    label: 'Biometric data',            severity: 'critical', re: /\b(?:fingerprint|biometric(?:\s+data)?|retina\s+scan|iris\s+scan|facial\s+recognition|face\s+(?:id|scan|data)|voice\s+(?:print|id|biometric)|palm\s+(?:print|vein)|gait\s+analysis)\b/gi },
  { type: 'genetic_data',     label: 'Genetic data',              severity: 'critical', re: /\b(?:genetic\s+(?:data|test|profile|sequence|information)|DNA\s+(?:test|profile|sequence|sample|data)|genomic\s+(?:data|profile|sequence)|genome\s+sequence)\b/gi },
  { type: 'caste_data',       label: 'Caste / tribal data',       severity: 'high',     re: /\b(?:caste\s*[:\-=]\s*\w+|scheduled\s+caste|scheduled\s+tribe|other\s+backward\s+class|OBC\s+certificate|SC\/ST\s+certificate|dalit\s+community)\b/gi },
  { type: 'religious_data',   label: 'Religious belief',          severity: 'high',     re: /\b(?:religion\s*[:\-=]\s*\w+|religious\s+(?:belief|affiliation|identity)|religious\s+convert|place\s+of\s+worship\s+preference)\b/gi },
  { type: 'political_data',   label: 'Political affiliation',     severity: 'high',     re: /\b(?:political\s+(?:affiliation|belief|opinion|party\s+membership)|party\s+member(?:ship)?\s+(?:card|number)|voter\s+affiliation\s*[:\-=])\b/gi },
  { type: 'sexual_orientation', label: 'Sexual orientation / gender identity', severity: 'critical', re: /\b(?:sexual\s+orientation|gender\s+identity\s*[:\-=]|(?:gay|lesbian|bisexual|transgender|queer|non[\s\-]?binary|intersex)\s+(?:identity|person|individual|status))\b/gi },
];

const SEV_COLOR = { critical: '#f87171', high: '#f97316', medium: '#fbbf24', low: '#60a5fa' };
const SEV_ORDER = { critical: 0, high: 1, medium: 2, low: 3 };

function scanText(text) {
  const found = [];
  for (const p of REGEX_PATTERNS) {
    p.re.lastIndex = 0;
    if (p.re.test(text)) found.push({ type: p.type, label: p.label, severity: p.severity });
  }
  return found;
}

function mergeFindings(a, b) {
  const seen = new Set(a.map(f => f.type));
  return [...a, ...b.filter(f => !seen.has(f.type))];
}

// ── In-page warning banner ─────────────────────────────────────────────────────
let warningEl = null;

function showWarning(findings, source) {
  if (!monitoringEnabled || !findings.length) return;
  removeWarning();

  const sorted = [...findings].sort((a, b) => (SEV_ORDER[a.severity] ?? 4) - (SEV_ORDER[b.severity] ?? 4));
  const color  = SEV_COLOR[sorted[0]?.severity || 'medium'];
  const pills  = sorted.map(f =>
    `<span class="sk-pii-pill" style="border-color:${SEV_COLOR[f.severity]};color:${SEV_COLOR[f.severity]}">${escHtml(f.label)}</span>`
  ).join('');

  warningEl = document.createElement('div');
  warningEl.className = 'sk-pii-bar';
  warningEl.innerHTML = `
    <div class="sk-pii-bar-inner">
      <span class="sk-pii-shield" style="background:${color}22;border:1.5px solid ${color}">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
        </svg>
      </span>
      <div class="sk-pii-bar-body">
        <div class="sk-pii-bar-title" style="color:${color}">PII detected in prompt</div>
        <div class="sk-pii-pills">${pills}</div>
        <div class="sk-pii-bar-note">AI platforms may log and train on your inputs — remove sensitive data before submitting.</div>
        ${source === 'ai' ? '<div class="sk-pii-source">Detected by Seekurify AI</div>' : ''}
      </div>
      <button class="sk-pii-dismiss" title="Dismiss">✕</button>
    </div>`;

  warningEl.querySelector('.sk-pii-dismiss').addEventListener('click', removeWarning);
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

  // Enter = send on all AI platforms (Shift+Enter = newline)
  el.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) handleSubmit(el);
  });

  watchSendButtons(el);
}

function watchSendButtons(inputEl) {
  // Walk up ancestors to find the send button — try multiple levels
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
  if (text.length < 8) { removeWarning(); return; }

  // 1 — instant local regex scan
  const localFindings = scanText(text);
  if (localFindings.length) {
    showWarning(localFindings, 'local');
    logDetection(localFindings, text, false);
  } else {
    removeWarning();
  }

  // 2 — async AI scan after 3 s of idle (catches names the regex missed)
  if (text.length > 10) {
    backendTypingTimer = setTimeout(() => runAiScan(el, text, false, localFindings), 3000);
  }
}

function handleSubmit(el) {
  if (!monitoringEnabled) return;
  const text = getText(el).trim();
  if (text.length < 3) return;

  // Local regex (instant) — log immediately so detection is stored even if backend is down
  const localFindings = scanText(text);
  if (localFindings.length) {
    showWarning(localFindings, 'local');
    logDetection(localFindings, text, true);
  }

  // Backend scan — runs regardless; only logs again if AI finds new types beyond local regex
  runAiScan(el, text, true, localFindings);
}

async function runAiScan(el, text, isSubmit, knownFindings) {
  try {
    const resp = await chrome.runtime.sendMessage({
      type: 'PII_ANALYZE',
      text,
      platform: platformName,
      url: window.location.hostname,
      snippet: text.slice(0, 120) + (text.length > 120 ? '…' : ''),
      timestamp: Date.now(),
    });

    if (!resp || resp.error || !resp.findings?.length) return;

    const merged = mergeFindings(knownFindings, resp.findings);
    showWarning(merged, 'ai');
    // Only create a new log entry if AI surfaced types the regex didn't catch
    if (merged.length > knownFindings.length || !knownFindings.length) {
      logDetection(merged, text, isSubmit);
    }
  } catch { /* backend unavailable — degrade silently */ }
}

function logDetection(findings, text, isSubmit) {
  const key = platformName + ':' + findings.map(f => f.type).sort().join(',');
  // Suppress duplicate typing events within 30 s
  if (!isSubmit && key === lastLogKey && Date.now() - lastLogTime < 30_000) return;
  lastLogKey  = key;
  lastLogTime = Date.now();

  const snippet = text.slice(0, 120) + (text.length > 120 ? '…' : '');
  chrome.runtime.sendMessage({
    type: isSubmit ? 'PII_SUBMIT' : 'PII_DETECTED',
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

})(); // end IIFE
