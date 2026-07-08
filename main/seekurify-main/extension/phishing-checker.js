(async () => {

// ── Platform detection ─────────────────────────────────────────────────────────
const EMAIL_PLATFORMS = {
  'mail.google.com':        'Gmail',
  'outlook.live.com':       'Outlook',
  'outlook.office.com':     'Outlook',
  'outlook.office365.com':  'Outlook',
  'mail.yahoo.com':         'Yahoo Mail',
  'mail.proton.me':         'ProtonMail',
  'protonmail.com':         'ProtonMail',
};

const hostname     = window.location.hostname;
const platformName = Object.entries(EMAIL_PLATFORMS)
  .find(([h]) => hostname === h || hostname.endsWith('.' + h))?.[1];

if (!platformName) return;

// ── Monitoring toggle ──────────────────────────────────────────────────────────
const stored = await chrome.storage.local.get('phishing_monitoring_enabled');
let monitoringEnabled = stored.phishing_monitoring_enabled !== false;

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && 'phishing_monitoring_enabled' in changes) {
    monitoringEnabled = changes.phishing_monitoring_enabled.newValue !== false;
    if (!monitoringEnabled) removeWarning();
  }
});

// ── Phishing patterns ──────────────────────────────────────────────────────────
const PHISHING_PATTERNS = [
  // Account takeover
  { type: 'account_takeover', label: 'Account takeover',     severity: 'critical',
    re: /\b(?:unusual\s+(?:sign-?in|login|activity)\s+(?:detected|on\s+your\s+account)|we\s+(?:detected|noticed|found)\s+(?:suspicious|unauthorized|unusual)\s+(?:activity|access|login)|your\s+account\s+(?:has\s+been\s+(?:compromised|hacked|accessed)|was\s+(?:accessed|logged)\s+from))\b/gi },
  // Credential harvesting
  { type: 'credential_req',   label: 'Credential request',   severity: 'critical',
    re: /\b(?:verify\s+your\s+(?:password|account|identity|email|credentials?)|confirm\s+your\s+(?:password|account|login)|enter\s+your\s+(?:password|credentials?|login\s+details)|update\s+your\s+(?:password|billing|payment|credentials?))\b/gi },
  // Prize / lottery scam
  { type: 'prize_scam',       label: 'Prize/lottery scam',   severity: 'critical',
    re: /\b(?:you(?:'ve|\s+have)\s+(?:won|been\s+selected|been\s+chosen)|congratulations[,!]?\s+you|claim\s+your\s+(?:prize|reward|winnings?)|lottery\s+winner|lucky\s+(?:winner|draw))\b/gi },
  // Advance fee / wire fraud
  { type: 'advance_fee',      label: 'Advance fee fraud',    severity: 'critical',
    re: /\b(?:transfer\s+(?:funds?|money|millions?|thousands?)|(?:million|billion)\s+(?:dollars?|USD|GBP|euros?)|need\s+your\s+(?:bank\s+)?(?:account|assistance)\s+to\s+transfer|(?:inheritance|bequest|investment)\s+(?:funds?|money)|prince\s+of|foreign\s+(?:funds?|money))\b/gi },
  // Malware delivery
  { type: 'malware_delivery', label: 'Malware delivery',     severity: 'critical',
    re: /\b(?:download\s+(?:and\s+)?(?:run|install|open|execute)\s+(?:this|the)\s+(?:file|attachment|document)|open\s+the\s+attached\s+(?:document|file|invoice|receipt)|(?:enable\s+macros?|enable\s+content)\s+to\s+(?:view|read|open))\b/gi },
  // Urgency pressure
  { type: 'urgency',          label: 'Urgency pressure',     severity: 'high',
    re: /\b(?:act\s+(?:now|immediately)|urgent(?:ly)?|immediate(?:ly)?|within\s+(?:24|48|72)\s+hours?|account\s+(?:suspended|disabled|blocked|locked)|limited\s+time|expires?\s+(?:soon|today|in\s+\d+))\b/gi },
  // Suspicious link / click bait
  { type: 'suspicious_link',  label: 'Suspicious link',      severity: 'high',
    re: /\b(?:click\s+(?:here|below|this\s+link|the\s+link)|follow\s+this\s+link|tap\s+(?:here|below)|login\s+(?:here|now|to\s+verify)|sign\s+in\s+(?:here|now)\s+to)\b/gi },
  // Brand impersonation
  { type: 'brand_impersonate',label: 'Brand impersonation',  severity: 'high',
    re: /\b(?:paypal|netflix|amazon|apple\s+id|microsoft\s+account|google\s+account|facebook|instagram|twitter|linkedin|bank\s+of\s+america|wells\s+fargo|chase\s+bank|citibank)\s+(?:team|support|security|account|service)\b/gi },
  // Password reset phishing
  { type: 'pw_reset_phish',   label: 'Password reset phish', severity: 'high',
    re: /\b(?:click\s+to\s+reset|change\s+your\s+password\s+(?:now|immediately)|your\s+password\s+will\s+expire|password\s+reset\s+link|reset\s+your\s+password\s+(?:now|immediately|below))\b/gi },
  // OTP request (social engineering)
  { type: 'otp_request',      label: 'OTP/code sharing',     severity: 'high',
    re: /\b(?:(?:do\s+not|never)\s+share\s+(?:this\s+)?(?:code|OTP|PIN)|your\s+(?:OTP|verification\s+code|one-time\s+(?:code|password))\s+(?:is|was)\s*:?\s*\d{4,8})\b/gi },
  // Generic greeting (phishing indicator)
  { type: 'generic_greeting', label: 'Generic greeting',     severity: 'low',
    re: /\b(?:dear\s+(?:user|customer|account\s+holder|valued\s+member|client)|hello\s+(?:user|customer)|greetings\s+(?:user|customer))\b/gi },
];

const SEV_COLOR  = { critical: '#f87171', high: '#f97316', medium: '#fbbf24', low: '#60a5fa' };
const SEV_ORDER  = { critical: 0, high: 1, medium: 2, low: 3 };
const SEV_POINTS = { critical: 35, high: 20, medium: 10, low: 5 };

function scanText(text) {
  const found = [];
  for (const p of PHISHING_PATTERNS) {
    p.re.lastIndex = 0;
    if (p.re.test(text)) found.push({ type: p.type, label: p.label, severity: p.severity });
  }
  return found;
}

function calculateScore(findings) {
  const raw = findings.reduce((sum, f) => sum + (SEV_POINTS[f.severity] ?? 5), 0);
  return Math.min(100, raw);
}

function scoreToRiskLevel(score) {
  if (score >= 81) return 'critical';
  if (score >= 61) return 'high';
  if (score >= 31) return 'medium';
  return 'low';
}

// ── Warning banner ─────────────────────────────────────────────────────────────
let warningEl      = null;
let spearWarningEl = null;

function showWarning(findings, source, anchor) {
  if (!monitoringEnabled || !findings.length) return;
  removeWarning();

  const sorted    = [...findings].sort((a, b) => (SEV_ORDER[a.severity] ?? 4) - (SEV_ORDER[b.severity] ?? 4));
  const color     = SEV_COLOR[sorted[0]?.severity || 'high'];
  const score     = calculateScore(findings);
  const riskLevel = scoreToRiskLevel(score);
  const scoreColor = SEV_COLOR[riskLevel];
  const pills     = sorted.map(f =>
    `<span class="sk-phi-pill" style="border-color:${SEV_COLOR[f.severity]};color:${SEV_COLOR[f.severity]}">${escHtml(f.label)}</span>`
  ).join('');

  warningEl = document.createElement('div');
  warningEl.className = 'sk-phi-bar';
  warningEl.innerHTML = `
    <div class="sk-phi-bar-inner">
      <span class="sk-phi-icon" style="background:${color}22;border:1.5px solid ${color}">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
          <polyline points="22,6 12,13 2,6"/>
        </svg>
      </span>
      <div class="sk-phi-bar-body">
        <div class="sk-phi-bar-title-row">
          <span class="sk-phi-bar-title" style="color:${color}">Phishing indicators detected</span>
          <span class="sk-phi-score-badge" style="background:${scoreColor}22;border-color:${scoreColor};color:${scoreColor}">${score}/100 · ${riskLevel.toUpperCase()}</span>
        </div>
        <div class="sk-phi-pills">${pills}</div>
        ${source === 'ai' ? '<div class="sk-phi-source">Verified by Seekurify AI</div>' : ''}
        <div class="sk-phi-score-note">Score: critical signal +35 pts, high +20, medium +10, low +5 — capped at 100.</div>
      </div>
      <button class="sk-phi-dismiss" title="Dismiss">✕</button>
    </div>`;

  warningEl.querySelector('.sk-phi-dismiss').addEventListener('click', removeWarning);

  if (anchor && anchor.parentNode) {
    anchor.parentNode.insertBefore(warningEl, anchor);
  } else {
    document.body.prepend(warningEl);
  }
}

function removeWarning() { warningEl?.remove(); warningEl = null; }

function showSpearWarning(spear, anchor) {
  spearWarningEl?.remove();

  const VECTOR_LABELS = {
    credential_harvest: 'Credential Harvest',
    wire_transfer:      'Wire Transfer Fraud',
    malware_delivery:   'Malware Delivery',
    data_exfil:         'Data Exfiltration',
    unknown:            'Unknown',
  };

  const targetLabel = spear.personalizationDepth === 'high' ? 'HIGHLY TARGETED'
    : spear.isTargeted ? 'TARGETED' : 'GENERIC';
  const aiPct = spear.aiGeneratedProbability ?? 0;
  const vector = VECTOR_LABELS[spear.attackVector] || spear.attackVector || '—';

  const absences = (spear.suspiciousAbsences || []).slice(0, 3);
  const absenceHtml = absences.length
    ? `<div class="sk-spear-absences">${absences.map(a =>
        `<div class="sk-spear-absence">↳ ${escHtml(a)}</div>`
      ).join('')}</div>`
    : '';

  const lookalikes = (spear.lookalikeDomains || []).slice(0, 2);
  const lookalikesHtml = lookalikes.length
    ? `<div class="sk-spear-lookalikes">${lookalikes.map(d =>
        `<span class="sk-spear-domain">${escHtml(d.domain)} → ${escHtml(d.closestMatch)} <em>(${escHtml(d.technique)})</em></span>`
      ).join('')}</div>`
    : '';

  spearWarningEl = document.createElement('div');
  spearWarningEl.className = 'sk-spear-bar';
  spearWarningEl.innerHTML = `
    <div class="sk-spear-bar-inner">
      <span class="sk-spear-icon">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fb7185" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
      </span>
      <div class="sk-spear-body">
        <div class="sk-spear-title-row">
          <span class="sk-spear-title">AI-Crafted Spear Phishing Suspected</span>
          <span class="sk-spear-badge sk-spear-target">${escHtml(targetLabel)}</span>
        </div>
        <div class="sk-spear-signals">
          <span class="sk-spear-sig">🤖 ${aiPct}% AI-written</span>
          <span class="sk-spear-sig">⚡ ${escHtml(vector)}</span>
          ${lookalikes.length ? `<span class="sk-spear-sig sk-spear-sig-warn">🌐 ${lookalikes.length} lookalike domain${lookalikes.length > 1 ? 's' : ''}</span>` : ''}
        </div>
        ${absenceHtml}
        ${lookalikesHtml}
        <div class="sk-spear-source">Analyzed by Seekurify AI — no urgency language or errors doesn't mean it's safe</div>
      </div>
      <button class="sk-spear-dismiss" title="Dismiss">✕</button>
    </div>`;

  spearWarningEl.querySelector('.sk-spear-dismiss').addEventListener('click', () => {
    spearWarningEl?.remove(); spearWarningEl = null;
  });

  if (anchor && anchor.parentNode) {
    anchor.parentNode.insertBefore(spearWarningEl, anchor);
  } else {
    document.body.prepend(spearWarningEl);
  }
}

function removeSpearWarning() { spearWarningEl?.remove(); spearWarningEl = null; }

function escHtml(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ── Email body selectors by platform ──────────────────────────────────────────
const EMAIL_BODY_SELECTORS = {
  Gmail: [
    '.a3s.aiL',
    'div[data-message-id] .a3s',
    '.ii.gt .a3s',
    '.ii.gt div[dir="ltr"]',
    '.gs .ii.gt',
  ],
  Outlook: [
    '[data-automationid="messageBody"]',
    'div[aria-label="Message body"]',
    'div[id*="messageBody"]',
    '.ReadMsgBody',
  ],
  'Yahoo Mail': [
    'div[data-test-id="message-view-body"]',
    '.msg-body',
    '.thread-read-content',
  ],
  ProtonMail: [
    'div[data-testid="message-view:message-body"]',
    '.message-content',
    '[class*="MessageBody"]',
  ],
};

function getEmailBodyEl() {
  const selectors = EMAIL_BODY_SELECTORS[platformName] || [];
  for (const sel of selectors) {
    try {
      const el = document.querySelector(sel);
      if (el && el.offsetHeight > 0) return el;
    } catch {}
  }
  return null;
}

// ── Detection state ────────────────────────────────────────────────────────────
let lastScannedText = '';
let scanTimer;
let lastLogKey  = '';
let lastLogTime = 0;

function scanEmail() {
  if (!monitoringEnabled) return;
  const el = getEmailBodyEl();
  if (!el) return;

  const text = (el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim();
  if (text.length < 30 || text === lastScannedText) return;
  lastScannedText = text;
  removeSpearWarning(); // clear previous spear banner on each new email

  const findings = scanText(text);
  if (findings.length) {
    const score = calculateScore(findings);
    showWarning(findings, 'local', el);
    logDetection(findings, text, score);
    runAiScan(text, findings, el);
  } else {
    removeWarning();
  }

  // Run spear scan on all substantial emails — spear phishing evades pattern detection
  if (text.length >= 150) {
    runSpearScan(text, el);
  }
}

// Spear scan runs on every substantial email regardless of pattern findings.
// Spear phishing is defined by ABSENCE of normal red flags — we can't wait for patterns to fire.
let lastSpearText = '';

async function runSpearScan(text, anchor) {
  if (text === lastSpearText) return;
  lastSpearText = text;

  try {
    const resp = await chrome.runtime.sendMessage({
      type: 'PHISHING_SPEAR_ANALYZE',
      text: text.slice(0, 5000),
    });
    const spear = resp?.spearPhishingAnalysis;
    if (!spear) return;

    // Only surface to the user if there's a meaningful spear signal
    const isWorthShowing = spear.isTargeted
      || spear.aiGeneratedProbability >= 65
      || (spear.lookalikeDomains?.length > 0);
    if (!isWorthShowing) return;

    showSpearWarning(spear, anchor);

    // Log it so it appears in the popup phishing tab
    const score = calculateScore([]);
    logDetection([], text, score, spear);
  } catch { /* backend unavailable */ }
}

async function runAiScan(text, knownFindings, anchor) {
  try {
    const resp = await chrome.runtime.sendMessage({
      type: 'PHISHING_ANALYZE',
      text: text.slice(0, 3000),
      platform: platformName,
      url: window.location.hostname,
      timestamp: Date.now(),
    });

    if (!resp || resp.error || !resp.findings?.length) return;

    const seen = new Set(knownFindings.map(f => f.type));
    const merged = [...knownFindings, ...resp.findings.filter(f => !seen.has(f.type))];
    if (merged.length > knownFindings.length) {
      const score = calculateScore(merged);
      showWarning(merged, 'ai', anchor);
      logDetection(merged, text, score);
    }
  } catch { /* backend unavailable */ }
}

function logDetection(findings, text, score, spearAnalysis = null) {
  const key = platformName + ':' + findings.map(f => f.type).sort().join(',') + (spearAnalysis ? ':spear' : '');
  if (key === lastLogKey && Date.now() - lastLogTime < 30_000) return;
  lastLogKey  = key;
  lastLogTime = Date.now();

  const snippet   = text.slice(0, 120) + (text.length > 120 ? '…' : '');
  const riskLevel = scoreToRiskLevel(score ?? calculateScore(findings));
  chrome.runtime.sendMessage({
    type:          'PHISHING_DETECTED',
    platform:      platformName,
    url:           window.location.hostname,
    findings,
    snippet,
    score:         score ?? calculateScore(findings),
    riskLevel,
    spearAnalysis,
    timestamp:     Date.now(),
  }).catch(() => {});
}

// ── Observe DOM changes ────────────────────────────────────────────────────────
function scheduleEmailScan() {
  clearTimeout(scanTimer);
  scanTimer = setTimeout(scanEmail, 900);
}

scheduleEmailScan();

let mutTimer;
new MutationObserver(() => {
  clearTimeout(mutTimer);
  mutTimer = setTimeout(scheduleEmailScan, 500);
}).observe(document.body, { childList: true, subtree: true });

})();
