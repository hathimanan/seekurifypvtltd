(async () => {

// ── Toggle ─────────────────────────────────────────────────────────────────────
const stored = await chrome.storage.local.get('link_scan_enabled');
let scanEnabled = stored.link_scan_enabled !== false;

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && 'link_scan_enabled' in changes) {
    scanEnabled = changes.link_scan_enabled.newValue !== false;
    if (!scanEnabled) hideTooltip();
  }
});

// ── Local result cache (URL → result, max 300 entries) ─────────────────────────
const cache = new Map();
function cacheSet(url, result) {
  if (cache.size >= 300) cache.delete(cache.keys().next().value);
  cache.set(url, result);
}

// ── Trusted domain detection ───────────────────────────────────────────────────
// Pattern-based: matches .gov/.mil/.edu/.int across ALL country codes dynamically.
// (.gov.in, .gov.uk, .gov.au, .edu.au, .ac.uk, etc.) — no country list to maintain.
const TRUSTED_DOMAIN_RE = /\.(gov|mil|edu|int)(\.[a-z]{2})?$|\.ac\.[a-z]{2}$/i;

function isTrustedDomain(host) {
  return TRUSTED_DOMAIN_RE.test(host);
}

// ── Known-safe domain bypass ───────────────────────────────────────────────────
// Major recognised platforms whose auth flows legitimately contain credential
// keywords and long tokens — skip those two heuristics for them.
const KNOWN_SAFE_DOMAINS = new Set([
  'google.com','gmail.com','youtube.com','googleapis.com',
  'microsoft.com','live.com','outlook.com','office.com','azure.com',
  'apple.com','icloud.com',
  'amazon.com',
  'github.com','gitlab.com',
  'facebook.com','instagram.com','meta.com',
  'twitter.com','x.com',
  'linkedin.com','dropbox.com','slack.com','zoom.us',
  'perplexity.ai','openai.com','chatgpt.com','anthropic.com','claude.ai',
  'netflix.com','spotify.com','adobe.com',
  'cloudflare.com','stripe.com','paypal.com',
  'chase.com','wellsfargo.com','bankofamerica.com','citibank.com',
]);

function isKnownSafeDomain(host) {
  const root = host.split('.').slice(-2).join('.');
  return KNOWN_SAFE_DOMAINS.has(root) || KNOWN_SAFE_DOMAINS.has(host);
}

// ── Threat scoring ─────────────────────────────────────────────────────────────
const FLAG_WEIGHTS = {
  'Data URI link':                             95,
  'Credentials embedded in URL authority':     75,
  'Nested redirect in URL':                    40,
  'Internationalized domain (homograph risk)': 40,
  'IP address used as hostname':               35,
  'High-risk free TLD':                        35,
  'Credential/account keywords in URL path':   30,
  'URL shortener — destination hidden':        25,
  'Excessive subdomain depth':                 20,
  'Unusually long URL':                        15,
};

function scoreFlags(flags) {
  const total = flags.reduce((sum, f) => {
    const weight = FLAG_WEIGHTS[f.reason]
      ?? (f.reason.includes('spoofed') ? 85 : 10); // dynamic brand-spoof message
    return sum + weight;
  }, 0);
  return Math.min(100, total);
}

// ── Local heuristics ───────────────────────────────────────────────────────────
const SUSPICIOUS_TLDS   = new Set(['.tk','.ml','.ga','.cf','.gq','.xyz','.top','.click','.loan','.win','.download','.party','.stream','.racing','.date']);
const URL_SHORTENERS    = new Set(['bit.ly','tinyurl.com','t.co','goo.gl','ow.ly','is.gd','buff.ly','adf.ly','short.link','rb.gy','cutt.ly','shorturl.at']);
const BRAND_NAMES       = ['paypal','google','microsoft','apple','amazon','facebook','netflix','instagram','twitter','linkedin','chase','wellsfargo','citibank','dropbox','github'];
const CRED_KEYWORDS     = ['login','signin','sign-in','verify','confirm','account','password','credential','banking','secure','update-account','webscr'];

function localScan(rawUrl) {
  try {
    const url  = new URL(rawUrl);
    const host = url.hostname.toLowerCase();
    const path = url.pathname.toLowerCase();
    const qs   = url.search.toLowerCase();
    const flags = [];

    // Data URI
    if (rawUrl.startsWith('data:'))
      flags.push({ reason: 'Data URI link', sev: 'malicious' });

    // IP address host
    if (/^(\d{1,3}\.){3}\d{1,3}$/.test(host))
      flags.push({ reason: 'IP address used as hostname', sev: 'suspicious' });

    // Punycode / homograph
    if (host.includes('xn--'))
      flags.push({ reason: 'Internationalized domain (homograph risk)', sev: 'suspicious' });

    // Suspicious TLD
    const tldMatch = SUSPICIOUS_TLDS.has('.' + host.split('.').pop());
    if (tldMatch)
      flags.push({ reason: 'High-risk free TLD', sev: 'suspicious' });

    // URL shortener
    const rootHost = host.replace(/^www\./, '');
    if (URL_SHORTENERS.has(rootHost))
      flags.push({ reason: 'URL shortener — destination hidden', sev: 'suspicious' });

    // Excessive subdomains
    if (host.split('.').length > 4)
      flags.push({ reason: 'Excessive subdomain depth', sev: 'suspicious' });

    // Brand name in non-brand domain
    const rootDomain = host.split('.').slice(-2).join('.');
    const spoofedBrand = BRAND_NAMES.find(b => host.includes(b) && !rootDomain.startsWith(b));
    if (spoofedBrand)
      flags.push({ reason: `"${spoofedBrand}" spoofed in non-official domain`, sev: 'malicious' });

    // Credential keywords in path or query — skip institutional and known-safe domains
    if (!isTrustedDomain(host) && !isKnownSafeDomain(host) &&
        CRED_KEYWORDS.some(kw => path.includes(kw) || qs.includes(kw)))
      flags.push({ reason: 'Credential/account keywords in URL path', sev: 'suspicious' });

    // Credentials in URL authority (user:pass@host) — use URL API, not string search.
    // This correctly ignores @ inside query params (e.g. ?email=user@gmail.com).
    if (url.username || url.password)
      flags.push({ reason: 'Credentials embedded in URL authority', sev: 'malicious' });

    // Abnormally long URL — skip known-safe domains (auth tokens make URLs long)
    if (!isKnownSafeDomain(host) && rawUrl.length > 400)
      flags.push({ reason: 'Unusually long URL', sev: 'suspicious' });

    // Multiple redirects encoded in URL
    if ((rawUrl.match(/https?:\/\//g) || []).length > 1)
      flags.push({ reason: 'Nested redirect in URL', sev: 'suspicious' });

    if (!flags.length)
      return { verdict: 'safe', reason: 'No threats detected', source: 'local', flags: [], score: 0 };

    const verdict = flags.some(f => f.sev === 'malicious') ? 'malicious' : 'suspicious';
    const score   = scoreFlags(flags);
    return { verdict, reason: flags[0].reason, source: 'local', flags, score };
  } catch {
    return { verdict: 'safe', reason: 'Unable to parse URL', source: 'local', flags: [] };
  }
}

// ── Shadow DOM tooltip ─────────────────────────────────────────────────────────
// CSS lives entirely inside the shadow — zero bleed from host page stylesheets.
const SHADOW_CSS = `
  :host {
    all: initial;
    position: absolute;
    z-index: 2147483647;
    width: 280px;
    pointer-events: none;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    display: block;
  }
  .wrap {
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    gap: 5px;
    padding: 9px 11px;
    border-radius: 8px;
    border: 1.5px solid #475569;
    background: #0f172a;
    box-shadow: 0 4px 20px rgba(0,0,0,0.8);
    animation: pop 0.15s ease;
  }
  @keyframes pop {
    from { opacity: 0; transform: translateY(-4px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  .wrap.safe       { background: #052e16; border-color: #16a34a; }
  .wrap.suspicious { background: #431407; border-color: #f97316; }
  .wrap.malicious  { background: #450a0a; border-color: #f87171; }
  .row {
    display: flex;
    align-items: center;
    gap: 7px;
    min-width: 0;
  }
  .badge {
    display: inline-block;
    font-size: 10px;
    font-weight: 800;
    letter-spacing: 0.05em;
    padding: 2px 7px;
    border-radius: 4px;
    border: 1px solid;
    flex-shrink: 0;
    line-height: 1.4;
  }
  .badge.safe       { background: rgba(74,222,128,.13); color: #4ade80; border-color: #4ade80; }
  .badge.suspicious { background: rgba(251,146,60,.13); color: #fb923c; border-color: #fb923c; }
  .badge.malicious  { background: rgba(248,113,113,.13); color: #f87171; border-color: #f87171; }
  .badge.scanning   { background: rgba(148,163,184,.13); color: #94a3b8; border-color: #94a3b8; }
  .host-name {
    display: inline-block;
    font-size: 11px;
    font-weight: 600;
    color: #cbd5e1;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    flex: 1;
    min-width: 0;
  }
  .ai-badge {
    display: inline-block;
    font-size: 9px;
    font-weight: 700;
    padding: 1px 5px;
    border-radius: 3px;
    background: #0e7490;
    color: #cffafe;
    flex-shrink: 0;
  }
  .reason {
    display: block;
    font-size: 11px;
    color: #94a3b8;
    line-height: 1.4;
  }
  .flag {
    display: block;
    font-size: 10px;
    color: #fb923c;
    line-height: 1.4;
  }
  .score-row {
    display: flex;
    align-items: center;
    gap: 7px;
  }
  .score-label {
    font-size: 9px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: #475569;
    flex-shrink: 0;
  }
  .score-track {
    flex: 1;
    height: 3px;
    background: rgba(255,255,255,0.08);
    border-radius: 2px;
    overflow: hidden;
  }
  .score-fill {
    height: 100%;
    border-radius: 2px;
    transition: width 0.3s ease;
  }
  .score-num {
    font-size: 11px;
    font-weight: 700;
    flex-shrink: 0;
    min-width: 28px;
    text-align: right;
  }
`;

const VERDICT_LABEL = {
  safe:      'SAFE',
  suspicious:'SUSPICIOUS',
  malicious: 'MALICIOUS',
  scanning:  'SCANNING…',
};

function escHtml(s) {
  return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// Host element that holds the shadow root — reused across show/update calls
let hostEl   = null;
let shadowRoot = null;
let hideTimer  = null;

function ensureHost() {
  if (!hostEl) {
    hostEl = document.createElement('div');
    hostEl.setAttribute('data-sk-ls', '');
    // Inline position styles — not affected by shadow or host CSS
    hostEl.style.cssText = 'position:absolute;z-index:2147483647;width:280px;pointer-events:none;';
    shadowRoot = hostEl.attachShadow({ mode: 'closed' });
    const style = document.createElement('style');
    style.textContent = SHADOW_CSS;
    shadowRoot.appendChild(style);
  }
}

function buildInner(href, result) {
  const v     = result.verdict || 'scanning';
  const score = result.score   ?? 0;
  const label = escHtml(VERDICT_LABEL[v] || v.toUpperCase());
  let displayHost = '';
  try { displayHost = new URL(href).hostname; } catch { displayHost = href.slice(0, 50); }

  const flagsHtml = (result.flags || []).slice(0, 3)
    .map(f => `<div class="flag">⚠ ${escHtml(f.reason)}</div>`)
    .join('');

  const scoreColor = score >= 70 ? '#f87171' : score >= 40 ? '#f97316' : '#60a5fa';
  const scoreHtml  = score > 0 ? `
    <div class="score-row">
      <span class="score-label">Risk</span>
      <div class="score-track">
        <div class="score-fill" style="width:${score}%;background:${scoreColor}"></div>
      </div>
      <span class="score-num" style="color:${scoreColor}">${score}/100</span>
    </div>` : '';

  return `
    <div class="wrap ${v}">
      <div class="row">
        <span class="badge ${v}">${label}</span>
        <span class="host-name">${escHtml(displayHost)}</span>
        ${result.source === 'ai' ? '<span class="ai-badge">AI</span>' : ''}
      </div>
      ${scoreHtml}
      ${v !== 'safe' && v !== 'scanning' ? `<div class="reason">${escHtml(result.reason)}</div>` : ''}
      ${flagsHtml}
    </div>`;
}

function positionHost(anchor) {
  if (!hostEl) return;
  const rect   = anchor.getBoundingClientRect();
  const scrollY = window.scrollY;
  const scrollX = window.scrollX;
  let top  = rect.bottom + scrollY + 6;
  let left = rect.left   + scrollX;

  const tipW = 280;
  if (left + tipW > window.innerWidth + scrollX - 8)
    left = window.innerWidth + scrollX - tipW - 8;
  if (left < 8) left = 8;

  hostEl.style.top  = `${top}px`;
  hostEl.style.left = `${left}px`;
}

function renderIntoShadow(href, result) {
  // Remove old content div (keep the <style> tag)
  const old = shadowRoot.querySelector('.wrap');
  if (old) old.remove();
  const tmp = document.createElement('div');
  tmp.innerHTML = buildInner(href, result);
  shadowRoot.appendChild(tmp.firstElementChild);
}

function showTooltip(anchor, result) {
  hideTooltip();
  ensureHost();
  renderIntoShadow(anchor.href, result);
  document.body.appendChild(hostEl);
  positionHost(anchor);
}

function updateTooltip(anchor, result) {
  if (!hostEl || !hostEl.isConnected) return;
  renderIntoShadow(anchor.href, result);
  positionHost(anchor);
}

function hideTooltip() {
  clearTimeout(hideTimer);
  hostEl?.remove();
  // Don't null hostEl — reuse the shadow root next time
}

// ── AI scan via background ─────────────────────────────────────────────────────
const SEVER = { malicious: 3, suspicious: 2, safe: 1 };

async function runAiScan(anchor, url, localResult) {
  try {
    const resp = await chrome.runtime.sendMessage({ type: 'LINK_SCAN', url });
    if (!resp || resp.error) return; // backend unavailable — keep local result

    // Never downgrade: if local said malicious, AI safe doesn't overwrite it
    const localSev = SEVER[localResult.verdict] || 1;
    const aiSev    = SEVER[resp.verdict]         || 1;
    const verdict  = localSev >= aiSev ? localResult.verdict : resp.verdict;
    const reason   = localSev >= aiSev ? localResult.reason  : (resp.reason || localResult.reason);

    const mergedFlags = [...(localResult.flags || []), ...(resp.flags || [])];
    const merged = {
      ...resp,
      verdict,
      reason,
      flags: mergedFlags,
      score: Math.max(localResult.score ?? 0, resp.score ?? scoreFlags(mergedFlags)),
    };
    cacheSet(url, merged);
    updateTooltip(anchor, merged);
  } catch { /* background unavailable */ }
}

// ── Event delegation ───────────────────────────────────────────────────────────
let hoverTimer    = null;
let currentAnchor = null;

document.addEventListener('mouseover', e => {
  if (!scanEnabled) return;
  const anchor = e.target.closest('a[href]');
  if (!anchor) return;

  const href = anchor.href || '';
  // Skip non-http links
  if (!href.startsWith('http://') && !href.startsWith('https://') && !href.startsWith('data:')) return;
  // Skip same-page anchors
  try { if (new URL(href).hostname === window.location.hostname && !href.includes('data:')) return; } catch {}

  if (anchor === currentAnchor) return;
  currentAnchor = anchor;
  clearTimeout(hoverTimer);

  hoverTimer = setTimeout(() => {
    // Cache hit — show immediately
    if (cache.has(href)) {
      showTooltip(anchor, cache.get(href));
      return;
    }

    // Local scan first (instant)
    const localResult = localScan(href);
    cacheSet(href, localResult);
    showTooltip(anchor, localResult);

    // AI scan enrichment (async)
    runAiScan(anchor, href, localResult);
  }, 450);
}, true);

document.addEventListener('mouseout', e => {
  const anchor = e.target.closest('a[href]');
  if (!anchor || anchor !== currentAnchor) return;
  // Ignore mouseout events that stay within the same anchor (e.g. moving over a child span)
  if (anchor.contains(e.relatedTarget)) return;
  clearTimeout(hoverTimer);
  currentAnchor = null;
  hideTimer = setTimeout(hideTooltip, 300);
}, true);

// Reposition on scroll
window.addEventListener('scroll', () => {
  if (hostEl?.isConnected && currentAnchor) positionHost(currentAnchor);
}, { passive: true });

})();
