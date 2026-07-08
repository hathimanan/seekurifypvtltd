import express from 'express';
import axios   from 'axios';

const router = express.Router();

const SSRF_BLOCK = /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2[0-9]|3[01])\.|0\.0\.0\.0|::1)/;

// ─── CSP source extractor (richer than the audit's buildCSPFromHtml) ──────────
function extractSources(html, pageOrigin) {
  const dirs = {
    'script-src':  new Set(),
    'style-src':   new Set(),
    'img-src':     new Set(),
    'font-src':    new Set(),
    'frame-src':   new Set(),
    'connect-src': new Set(),
    'media-src':   new Set(),
  };

  const add = (d, src) => {
    try {
      const u = new URL(src, pageOrigin);
      if (u.origin !== 'null') dirs[d].add(u.origin);
    } catch (_) {}
  };

  for (const [, s] of html.matchAll(/<script[^>]+src=["']([^"']+)["']/gi))           add('script-src',  s);
  for (const [, h] of html.matchAll(/<link[^>]+rel=["']stylesheet["'][^>]+href=["']([^"']+)["']/gi)) add('style-src', h);
  for (const [, h] of html.matchAll(/<link[^>]+href=["']([^"']+)["'][^>]+rel=["']stylesheet["']/gi)) add('style-src', h);
  for (const [, s] of html.matchAll(/<img[^>]+src=["']([^"']+)["']/gi))              add('img-src',    s);
  for (const [, s] of html.matchAll(/<source[^>]+src=["']([^"']+)["']/gi))           add('media-src',  s);
  for (const [, s] of html.matchAll(/<iframe[^>]+src=["']([^"']+)["']/gi))           add('frame-src',  s);
  for (const [, h] of html.matchAll(/<link[^>]+rel=["']preconnect["'][^>]+href=["']([^"']+)["']/gi)) add('connect-src', h);

  // Google Fonts shorthand detection
  if (html.includes('fonts.googleapis.com')) { dirs['style-src'].add('https://fonts.googleapis.com'); }
  if (html.includes('fonts.gstatic.com'))    { dirs['font-src'].add('https://fonts.gstatic.com'); }

  // Inline script/style detection (needed for unsafe-inline recommendation)
  const hasInlineScript = /<script(?![^>]+src=)[^>]*>[^<]+/i.test(html);
  const hasInlineStyle  = /style=["'][^"']+["']/i.test(html) || /<style[^>]*>[^<]+/i.test(html);

  // Convert sets → sorted arrays, filter out same-origin (will be covered by 'self')
  const sources = {};
  for (const [d, set] of Object.entries(dirs)) {
    sources[d] = [...set]
      .filter(o => o !== pageOrigin)
      .sort();
  }

  return { sources, hasInlineScript, hasInlineStyle };
}

function buildPolicy(sources, pageOrigin, opts = {}) {
  const { unsafeInline = false, unsafeEval = false, strictDynamic = false } = opts;
  const directives = [`default-src 'self'`];

  const append = (directive, extras = []) => {
    const srcs = (sources[directive] || []).filter(s => s !== pageOrigin);
    const parts = ["'self'", ...srcs, ...extras];
    if (parts.length > 1 || extras.length) {
      directives.push(`${directive} ${parts.join(' ')}`);
    }
  };

  const scriptExtras = [];
  if (unsafeInline)   scriptExtras.push("'unsafe-inline'");
  if (unsafeEval)     scriptExtras.push("'unsafe-eval'");
  if (strictDynamic)  scriptExtras.push("'strict-dynamic'");
  append('script-src',  scriptExtras);

  const styleExtras = unsafeInline ? ["'unsafe-inline'"] : [];
  append('style-src',   styleExtras);
  append('img-src',     ['data:']);
  append('font-src');
  append('frame-src');
  append('connect-src');
  if ((sources['media-src'] || []).length) append('media-src');

  directives.push('upgrade-insecure-requests');
  return directives.join('; ');
}

function analyzePolicy(sources, hasInlineScript, hasInlineStyle) {
  const recommendations = [];
  const scriptSrcs = sources['script-src'] || [];
  const totalExternal = Object.values(sources).reduce((n, arr) => n + arr.length, 0);

  if (hasInlineScript)
    recommendations.push({ directive: 'script-src', level: 'warning', note: "Page uses inline <script> tags. Add a 'nonce' attribute to each script and use 'nonce-{value}' in your policy instead of 'unsafe-inline' for stronger protection." });
  if (hasInlineStyle)
    recommendations.push({ directive: 'style-src',  level: 'info',    note: "Page uses inline styles. Consider extracting them to external stylesheets or use 'unsafe-inline' only if you accept the trade-off." });
  if (scriptSrcs.some(s => s.includes('cdn.jsdelivr.net') || s.includes('unpkg.com')))
    recommendations.push({ directive: 'script-src', level: 'warning', note: "Public CDNs like jsDelivr/unpkg can serve any package version. Pin to a specific version URL or use Subresource Integrity (integrity='sha384-...') attributes." });
  if (totalExternal === 0)
    recommendations.push({ directive: 'general', level: 'success', note: "No external sources detected. Your policy can be very strict — this is ideal." });

  const riskLevel =
    scriptSrcs.length > 3 ? 'permissive' :
    scriptSrcs.length > 0 || hasInlineScript ? 'moderate' : 'strict';

  return { recommendations, riskLevel };
}

// ─── POST /api/csp-builder ────────────────────────────────────────────────────
router.post('/csp-builder', async (req, res) => {
  let { url, options = {} } = req.body;
  if (!url || typeof url !== 'string') return res.status(400).json({ error: 'URL is required' });

  url = url.trim();
  if (!url.startsWith('http://') && !url.startsWith('https://')) url = 'https://' + url;

  let hostname, pageOrigin;
  try {
    const u = new URL(url);
    hostname   = u.hostname;
    pageOrigin = u.origin;
  } catch (_) { return res.status(400).json({ error: 'Invalid URL' }); }

  if (SSRF_BLOCK.test(hostname)) return res.status(400).json({ error: 'Private URLs not permitted' });

  try {
    const resp = await axios.get(url, {
      timeout: 12000,
      validateStatus: () => true,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Seekurify-CSPBuilder/1.0)' },
    });

    if (typeof resp.data !== 'string') {
      return res.status(422).json({ error: 'URL did not return HTML — CSP builder requires an HTML page.' });
    }

    const { sources, hasInlineScript, hasInlineStyle } = extractSources(resp.data, pageOrigin);
    const policy   = buildPolicy(sources, pageOrigin, options);
    const analysis = analyzePolicy(sources, hasInlineScript, hasInlineStyle);

    res.json({
      url,
      hostname,
      sources,
      hasInlineScript,
      hasInlineStyle,
      policy,
      analysis,
    });
  } catch (err) {
    res.status(500).json({ error: 'CSP build failed: ' + err.message });
  }
});

// ─── POST /api/csp-builder/policy — recompute policy with updated options ─────
router.post('/csp-builder/policy', (req, res) => {
  const { sources, pageOrigin = 'https://example.com', options = {} } = req.body;
  if (!sources) return res.status(400).json({ error: 'sources required' });
  res.json({ policy: buildPolicy(sources, pageOrigin, options) });
});

export default router;
