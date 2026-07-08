import express from 'express';
import tls from 'tls';
import axios from 'axios';
import dns from 'dns';
import jwt from 'jsonwebtoken';
import { promisify } from 'util';
import SiteAuditLog from '../models/SiteAuditLog.js';

const resolveTxt = promisify(dns.resolveTxt);
const router = express.Router();

// ─── SSL/TLS Check ───────────────────────────────────────────────────────────
async function checkSSL(hostname) {
  return new Promise((resolve) => {
    const socket = tls.connect(
      { host: hostname, port: 443, servername: hostname, rejectUnauthorized: false },
      () => {
        const cert = socket.getPeerCertificate();
        const authorized = socket.authorized;
        socket.destroy();

        if (!cert || !cert.valid_to) {
          return resolve({ valid: false, grade: 'F', error: 'No certificate found' });
        }

        const validTo = new Date(cert.valid_to);
        const now = new Date();
        const daysLeft = Math.floor((validTo - now) / (1000 * 60 * 60 * 24));

        resolve({
          valid: authorized,
          subject: cert.subject?.CN || hostname,
          issuer: cert.issuer?.O || 'Unknown',
          validTo: validTo.toISOString().split('T')[0],
          daysLeft,
          grade: !authorized ? 'F' : daysLeft > 30 ? 'A' : daysLeft > 7 ? 'B' : 'F',
        });
      }
    );

    socket.setTimeout(6000, () => {
      socket.destroy();
      resolve({ valid: false, grade: 'F', error: 'Connection timeout' });
    });
    socket.on('error', (err) => {
      resolve({ valid: false, grade: 'F', error: err.message });
    });
  });
}

// ─── HTTP Security Headers Check ─────────────────────────────────────────────
async function checkHeaders(url) {
  try {
    const res = await axios.head(url, {
      timeout: 8000,
      validateStatus: () => true,
      maxRedirects: 5,
    });
    const h = res.headers;
    return {
      csp: !!h['content-security-policy'],
      hsts: !!h['strict-transport-security'],
      xFrameOptions: !!h['x-frame-options'],
      xContentTypeOptions: !!h['x-content-type-options'],
      referrerPolicy: !!h['referrer-policy'],
      permissionsPolicy: !!h['permissions-policy'],
      raw: {
        csp: h['content-security-policy'] || null,
        hsts: h['strict-transport-security'] || null,
        xFrameOptions: h['x-frame-options'] || null,
        xContentTypeOptions: h['x-content-type-options'] || null,
        referrerPolicy: h['referrer-policy'] || null,
      },
    };
  } catch (e) {
    return { error: e.message };
  }
}

// ─── Google Safe Browsing Blacklist Check ─────────────────────────────────────
async function checkBlacklist(url) {
  const apiKey = process.env.GOOGLE_SAFE_BROWSING_API_KEY;
  if (!apiKey) return { blacklisted: false, skipped: true };

  try {
    const res = await axios.post(
      `https://safebrowsing.googleapis.com/v4/threatMatches:find?key=${apiKey}`,
      {
        client: { clientId: 'seekurify', clientVersion: '1.0' },
        threatInfo: {
          threatTypes: [
            'MALWARE',
            'SOCIAL_ENGINEERING',
            'UNWANTED_SOFTWARE',
            'POTENTIALLY_HARMFUL_APPLICATION',
          ],
          platformTypes: ['ANY_PLATFORM'],
          threatEntryTypes: ['URL'],
          threatEntries: [{ url }],
        },
      },
      { timeout: 5000 }
    );
    const matches = res.data?.matches || [];
    return {
      blacklisted: matches.length > 0,
      threats: matches.map((m) => m.threatType),
    };
  } catch (e) {
    return { blacklisted: false, error: e.message };
  }
}

// ─── DNS SPF / DMARC Check ────────────────────────────────────────────────────
async function checkDNS(domain) {
  const result = { spf: false, dmarc: false, spfRecord: null, dmarcRecord: null };

  try {
    const txts = await resolveTxt(domain);
    for (const record of txts.flat()) {
      if (record.startsWith('v=spf1')) {
        result.spf = true;
        result.spfRecord = record;
      }
    }
  } catch (_) {}

  try {
    const dmarcTxts = await resolveTxt(`_dmarc.${domain}`);
    for (const record of dmarcTxts.flat()) {
      if (record.startsWith('v=DMARC1')) {
        result.dmarc = true;
        result.dmarcRecord = record;
      }
    }
  } catch (_) {}

  return result;
}

// ─── Exposed Sensitive Paths Check ───────────────────────────────────────────
async function checkExposedPaths(baseUrl) {
  const paths = [
    '/.env',
    '/admin',
    '/wp-admin',
    '/phpmyadmin',
    '/.git/config',
    '/config.php',
    '/wp-config.php',
    '/server-status',
    '/phpinfo.php',
    '/.htaccess',
    '/api/v1',
    '/swagger',
    '/api-docs',
    '/.DS_Store',
    '/backup',
    '/database',
    '/dump.sql',
    '/secrets',
    '/credentials',
    '/private',
  ];

  const exposed = [];
  // Sequential with a short pause to be respectful to the target server
  for (const p of paths) {
    try {
      const r = await axios.get(`${baseUrl}${p}`, {
        timeout: 3000,
        validateStatus: () => true,
        maxRedirects: 0,
      });
      if (r.status === 200) {
        exposed.push({ path: p, status: r.status });
      }
    } catch (_) {}
  }
  return exposed;
}

// ─── Mixed Content + CSP Builder ─────────────────────────────────────────────
function buildCSPFromHtml(html, pageOrigin) {
  const dirs = {
    'script-src':  new Set(["'self'"]),
    'style-src':   new Set(["'self'"]),
    'img-src':     new Set(["'self'", 'data:']),
    'font-src':    new Set(["'self'"]),
    'frame-src':   new Set(),
    'connect-src': new Set(["'self'"]),
  };

  const addOrigin = (directive, src) => {
    try {
      const u = new URL(src, pageOrigin);
      if (u.origin !== pageOrigin && u.origin !== 'null') dirs[directive].add(u.origin);
    } catch (_) {}
  };

  for (const [, src] of html.matchAll(/<script[^>]+src=["']([^"']+)["']/gi))  addOrigin('script-src', src);
  for (const [, h]   of html.matchAll(/<link[^>]+rel=["']stylesheet["'][^>]+href=["']([^"']+)["']/gi)) addOrigin('style-src', h);
  for (const [, h]   of html.matchAll(/<link[^>]+href=["']([^"']+)["'][^>]+rel=["']stylesheet["']/gi)) addOrigin('style-src', h);
  for (const [, src] of html.matchAll(/<img[^>]+src=["']([^"']+)["']/gi))     addOrigin('img-src', src);
  for (const [, src] of html.matchAll(/<iframe[^>]+src=["']([^"']+)["']/gi))  addOrigin('frame-src', src);

  if (html.includes('fonts.googleapis.com')) dirs['style-src'].add('https://fonts.googleapis.com');
  if (html.includes('fonts.gstatic.com'))    dirs['font-src'].add('https://fonts.gstatic.com');

  const parts = ["default-src 'self'"];
  for (const [d, vals] of Object.entries(dirs)) {
    if (vals.size > 0 && !(vals.size === 1 && vals.has("'self'"))) {
      parts.push(`${d} ${[...vals].join(' ')}`);
    }
  }
  parts.push("upgrade-insecure-requests");
  return parts.join('; ');
}

async function checkPageResources(url) {
  try {
    const res = await axios.get(url, {
      timeout: 10000,
      validateStatus: () => true,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Seekurify-Audit/1.0)' },
    });
    if (typeof res.data !== 'string') return { hasMixedContent: false, cspSuggestion: null, mixedElements: [] };

    const html        = res.data;
    const lines       = html.split('\n');
    const mixedElements = [];

    for (let i = 0; i < lines.length && mixedElements.length < 10; i++) {
      const line = lines[i];
      for (const m of line.matchAll(/(<[a-z][^>]+\bsrc=["'](http:\/\/[^"']+)["'][^>]*>)/gi)) {
        const insecureUrl = m[2];
        mixedElements.push({
          element:     m[1].trim().slice(0, 160),
          lineNumber:  i + 1,
          insecureUrl,
          fix: `src="${insecureUrl.replace('http://', 'https://')}"`
        });
        if (mixedElements.length >= 10) break;
      }
      for (const m of line.matchAll(/(<link[^>]+\bhref=["'](http:\/\/[^"']+)["'][^>]*>)/gi)) {
        const insecureUrl = m[2];
        mixedElements.push({
          element:     m[1].trim().slice(0, 160),
          lineNumber:  i + 1,
          insecureUrl,
          fix: `href="${insecureUrl.replace('http://', 'https://')}"`
        });
        if (mixedElements.length >= 10) break;
      }
    }

    const srcCount  = (html.match(/src=["']http:\/\//gi)  || []).length;
    const hrefCount = (html.match(/href=["']http:\/\//gi) || []).length;
    const cspSuggestion = buildCSPFromHtml(html, new URL(url).origin);

    return {
      hasMixedContent: srcCount + hrefCount > 0,
      count:           srcCount + hrefCount,
      cspSuggestion,
      mixedElements,
    };
  } catch (e) {
    return { hasMixedContent: false, error: e.message, cspSuggestion: null, mixedElements: [] };
  }
}

// ─── Stack Detection ──────────────────────────────────────────────────────────
async function detectStack(url) {
  try {
    const res = await axios.head(url, { timeout: 8000, validateStatus: () => true, maxRedirects: 5 });
    const h      = res.headers;
    const server = (h['server'] || '').toLowerCase();
    const via    = (h['via']    || '').toLowerCase();

    if (h['cf-ray'] || server.includes('cloudflare'))
      return { platform: 'cloudflare',     server: h['server'] || 'Cloudflare',    confidence: 'high' };
    if (h['x-vercel-id'] || h['x-vercel-deployment-url'] || h['x-vercel-cache'])
      return { platform: 'vercel',         server: 'Vercel',                       confidence: 'high' };
    if (h['x-netlify'] || server.includes('netlify') || h['netlify-cdn-cache-control'])
      return { platform: 'netlify',        server: 'Netlify',                      confidence: 'high' };
    if (h['x-amzn-requestid'] || h['x-amz-cf-id'] || via.includes('cloudfront'))
      return { platform: 'aws-cloudfront', server: 'AWS CloudFront',               confidence: 'high' };
    if (server.includes('nginx'))
      return { platform: 'nginx',          server: h['server'] || 'nginx',         confidence: 'high' };
    if (server.includes('apache'))
      return { platform: 'apache',         server: h['server'] || 'Apache',        confidence: 'high' };
    if (server.includes('iis') || server.includes('microsoft'))
      return { platform: 'iis',            server: h['server'] || 'IIS',           confidence: 'high' };
    return { platform: 'unknown', server: h['server'] || null, confidence: 'low' };
  } catch (_) {
    return { platform: 'unknown', server: null, confidence: 'low' };
  }
}

// ─── Fix Generator ────────────────────────────────────────────────────────────
function generateFixes(audit, stack, hostname) {
  const h = audit.headers;
  const d = audit.dns;

  const HEADER_DEFS = {
    csp:                 { name: 'Content-Security-Policy',   value: audit.cspSuggestion || "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' https://fonts.gstatic.com; frame-ancestors 'none'; upgrade-insecure-requests" },
    hsts:                { name: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains; preload' },
    xFrameOptions:       { name: 'X-Frame-Options',           value: 'SAMEORIGIN' },
    xContentTypeOptions: { name: 'X-Content-Type-Options',    value: 'nosniff' },
    referrerPolicy:      { name: 'Referrer-Policy',           value: 'strict-origin-when-cross-origin' },
    permissionsPolicy:   { name: 'Permissions-Policy',        value: 'geolocation=(), microphone=(), camera=()' },
  };

  const missing = [];
  if (h && !h.error) {
    for (const [key, def] of Object.entries(HEADER_DEFS)) {
      if (!h[key]) missing.push(def);
    }
  }

  const needsDns = d && !d.error && (!d.spf || !d.dmarc);
  if (missing.length === 0 && !needsDns) return null;

  let nginx = null, apache = null, vercel = null, netlify = null, cloudflare = null;

  if (missing.length > 0) {
    nginx =
      `# ── Nginx ── paste inside your server {} block ──────────────────────────\n` +
      missing.map(hd => `add_header ${hd.name} "${hd.value}" always;`).join('\n');

    apache =
      `# ── Apache ── add to .htaccess or httpd.conf ────────────────────────────\n` +
      `<IfModule mod_headers.c>\n` +
      missing.map(hd => `    Header always set ${hd.name} "${hd.value}"`).join('\n') +
      `\n</IfModule>`;

    vercel = JSON.stringify({
      headers: [{ source: '/(.*)', headers: missing.map(hd => ({ key: hd.name, value: hd.value })) }],
    }, null, 2);

    netlify =
      `# ── Netlify ── save as _headers in your publish directory ──────────────\n` +
      `/*\n` +
      missing.map(hd => `  ${hd.name}: ${hd.value}`).join('\n');

    cloudflare =
      `# ── Cloudflare ── Rules → Transform Rules → Response Header Modification\n` +
      `# Create one rule per header (Action = Set):\n` +
      missing.map(hd => `  ${hd.name}  →  ${hd.value}`).join('\n');
  }

  const dnsSpf   = (!d?.spf)   ? `# Add TXT record to ${hostname}\nv=spf1 include:_spf.google.com ~all`                                        : null;
  const dnsDmarc = (!d?.dmarc) ? `# Add TXT record at _dmarc.${hostname}\nv=DMARC1; p=quarantine; rua=mailto:dmarc@${hostname}` : null;

  return { missingHeaders: missing, nginx, apache, vercel, netlify, cloudflare, dnsSpf, dnsDmarc };
}

// ─── Finding Enrichment: plain-English explain + actionable fix ──────────────

function getExplanation({ category, message }) {
  if (category === 'SSL/TLS') {
    if (message.includes('invalid') || message.includes('untrusted'))
      return "Browsers show a red 'Not Secure' warning to every visitor. Most users leave immediately and search engines may lower your ranking. A free Let's Encrypt certificate fixes this in minutes.";
    if (message.includes('expires'))
      return "Once expired, every browser fully blocks access to your site until the certificate is renewed. Set up auto-renewal now — certbot handles this automatically.";
    if (message.includes('HTTPS'))
      return "Your site uses plain HTTP — all data (passwords, form fields, sessions) travels unencrypted and can be intercepted by anyone on the same network. HTTPS is free via Let's Encrypt.";
  }
  if (category === 'Headers') {
    if (message.includes('Content Security Policy'))
      return "CSP tells browsers which scripts and resources are allowed to run on your page. Without it, if an attacker injects malicious code (XSS), the browser will happily execute it — stealing sessions, redirecting users, or mining crypto.";
    if (message.includes('HSTS'))
      return "HSTS forces browsers to always use HTTPS even if a user types 'http://'. Without it, an attacker on shared Wi-Fi can silently strip HTTPS off your connection and read everything in plain text.";
    if (message.includes('X-Frame-Options'))
      return "Without this, your pages can be silently embedded inside an attacker's site via an invisible iframe. They overlay fake buttons on your UI to trick users into clicking things they didn't intend — stealing clicks, approvals, or payments.";
    if (message.includes('X-Content-Type-Options'))
      return "Browsers sometimes ignore the declared file type and 'sniff' what a file really is. An attacker can upload a file that looks like an image but runs as JavaScript, bypassing upload restrictions.";
    if (message.includes('Referrer-Policy'))
      return "When users click links on your site, their browser sends your full page URL to the destination. If your URLs contain session tokens or user IDs (e.g. /reset-password?token=xyz), those leak to every external site your users visit.";
    if (message.includes('Permissions-Policy'))
      return "Permissions-Policy controls access to browser APIs like the camera, microphone, and geolocation. Without it, any third-party script on your page could request access to these sensitive features.";
  }
  if (category === 'DNS') {
    if (message.includes('SPF'))
      return "Without SPF, anyone on the internet can send email that appears to come from your domain. Attackers use this to run phishing campaigns that impersonate your brand — your customers get convincing fake emails 'from you'.";
    if (message.includes('DMARC'))
      return "DMARC instructs receiving mail servers what to do with emails that fail SPF/DKIM checks. Without it, spoofed emails from your domain land directly in inboxes. DMARC is a hard requirement for Google/Yahoo bulk senders since 2024.";
  }
  if (category === 'Blacklist')
    return "Google Safe Browsing has flagged your site for malware, phishing, or unwanted software. Chrome, Firefox, and Safari actively block users with a full-page red warning. This will kill organic traffic until you request a review.";
  if (category === 'Exposed Paths')
    return "Sensitive files are publicly accessible. A .env file exposes your database passwords, API keys, and JWT secrets — an attacker can fully compromise your infrastructure in minutes. A .git directory leaks your entire source code history.";
  if (category === 'Mixed Content')
    return "Your HTTPS page loads some resources over plain HTTP. Browsers block mixed scripts entirely and warn on mixed images. More critically, an HTTP script can be intercepted mid-transit and replaced with malicious code — even on an HTTPS page.";
  return '';
}

function getActionableFix({ category, message }, audit, stack, hostname) {
  const platform = stack?.platform || 'nginx';

  if (category === 'SSL/TLS') {
    if (platform === 'cloudflare')
      return `# Cloudflare manages SSL for you — no certificate needed.\n# 1. Go to Cloudflare Dashboard → SSL/TLS\n# 2. Set encryption mode to "Full (Strict)"\n# 3. Enable "Always Use HTTPS" under Edge Certificates → toggle on`;
    if (platform === 'vercel')
      return `# Vercel provisions SSL automatically.\n# If the cert is invalid: Dashboard → your project → Settings → Domains\n# Remove and re-add your custom domain to force a new certificate.`;
    if (platform === 'netlify')
      return `# Netlify provisions SSL automatically.\n# Go to: Site settings → Domain management → HTTPS\n# Click "Verify DNS configuration" then "Provision certificate"`;
    const apacheFlag = platform === 'apache' ? 'apache' : 'nginx';
    return `# Install certbot (free Let's Encrypt)\nsudo apt install certbot python3-certbot-${apacheFlag}\n\n# Issue certificate\nsudo certbot --${apacheFlag} -d ${hostname} -d www.${hostname}\n\n# Auto-renew (add to crontab):\nsudo crontab -e\n# Paste: 0 3 * * * certbot renew --quiet --post-hook "systemctl reload ${platform === 'apache' ? 'apache2' : 'nginx'}"`;
  }

  if (category === 'Exposed Paths') {
    const paths = (Array.isArray(audit.exposedPaths) ? audit.exposedPaths : []).map(p => p.path);
    const blocks = [];
    if (paths.some(p => p.includes('.env')))
      blocks.push(`# Remove .env from web root now:\nrm /var/www/html/.env   # then move secrets above web root\n\n# Block in Nginx:\nlocation ~ /\\.env { deny all; return 404; }\n\n# Block in Apache (.htaccess):\n<Files ".env">\n  Require all denied\n</Files>`);
    if (paths.some(p => p.includes('.git')))
      blocks.push(`# Block .git directory in Nginx:\nlocation ~ /\\.git { deny all; return 404; }\n\n# Block in Apache:\n<DirectoryMatch "\\.git">\n  Require all denied\n</DirectoryMatch>`);
    if (paths.some(p => p.includes('wp-config') || p.includes('wp-admin')))
      blocks.push(`# Restrict wp-admin to your IP in Nginx:\nlocation /wp-admin {\n  allow YOUR_IP_HERE;\n  deny all;\n}\n# Block wp-config.php:\nlocation ~* wp-config\\.php { deny all; }`);
    if (paths.some(p => p.includes('phpmyadmin')))
      blocks.push(`# Remove phpMyAdmin from production.\n# If you must keep it, restrict to localhost:\nlocation /phpmyadmin {\n  allow 127.0.0.1;\n  deny all;\n}`);
    if (paths.some(p => p.includes('phpinfo') || p.includes('.php')))
      blocks.push(`# Remove phpinfo.php — it exposes full server config:\nrm /var/www/html/phpinfo.php`);
    if (blocks.length === 0 && paths.length > 0)
      blocks.push(`# Block sensitive paths in Nginx:\n` + paths.map(p => `location ${p} { deny all; return 404; }`).join('\n'));
    return blocks.join('\n\n───\n\n');
  }

  if (category === 'Mixed Content') {
    const els = audit.mixedContent?.elements || [];
    if (els.length > 0)
      return `# Update these elements from HTTP to HTTPS:\n\n` +
        els.slice(0, 5).map(el =>
          `Line ${el.lineNumber}:\n  ${el.element.slice(0, 120)}\n  Fix → ${el.fix}`
        ).join('\n\n') +
        (els.length > 5 ? `\n\n  …and ${els.length - 5} more. Run: grep -rn 'src="http://' ./src` : '');
    return `# Find all mixed content in your source:\ngrep -rn 'src="http://' ./src\ngrep -rn "href='http://" ./src\n\n# Then replace http:// with https:// for each resource.\n# Most CDNs support HTTPS — just change the scheme.`;
  }

  if (category === 'DNS') {
    if (message.includes('SPF'))
      return `# Add TXT record to your DNS zone:\n# Name: ${hostname}  (or @)\n# Type: TXT\n# Value:\nv=spf1 include:_spf.google.com ~all\n\n# Using multiple providers? Combine them:\nv=spf1 include:_spf.google.com include:sendgrid.net ~all`;
    if (message.includes('DMARC'))
      return `# Add TXT record to your DNS zone:\n# Name: _dmarc.${hostname}\n# Type: TXT\n# Value (start with quarantine, move to reject once confirmed working):\nv=DMARC1; p=quarantine; rua=mailto:dmarc@${hostname}\n\n# Strict enforcement:\nv=DMARC1; p=reject; rua=mailto:dmarc@${hostname}; pct=100`;
  }

  if (category === 'Blacklist')
    return `# Step 1 — Find and remove the malicious content:\n# Use Google Search Console → Security Issues to see what was flagged.\n\n# Step 2 — Clean your site, update all passwords and API keys.\n\n# Step 3 — Request a review:\n# https://search.google.com/search-console/security-issues\n# Click "Request Review" after cleanup.\n\n# Step 4 — Repeat scan in 24–72 hours to confirm removal.`;

  return null;
}

function enrichFindings(findings, audit, stack, hostname) {
  return findings.map(f => ({
    ...f,
    explain: getExplanation(f),
    fix:     getActionableFix(f, audit, stack, hostname),
  }));
}

// ─── Main Audit Endpoint ──────────────────────────────────────────────────────
router.post('/site-audit', async (req, res) => {
  let { url } = req.body;

  if (!url || typeof url !== 'string' || url.trim().length === 0) {
    return res.status(400).json({ error: 'URL is required' });
  }

  url = url.trim();
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    url = 'https://' + url;
  }

  let hostname;
  try {
    hostname = new URL(url).hostname;
  } catch (_) {
    return res.status(400).json({ error: 'Invalid URL format' });
  }

  // SSRF protection — block private/internal addresses
  const privatePattern =
    /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2[0-9]|3[01])\.|0\.0\.0\.0|::1|0\.0\.0\.0)/;
  if (privatePattern.test(hostname)) {
    return res.status(400).json({ error: 'Private or internal URLs are not permitted' });
  }

  try {
    const isHttps = url.startsWith('https://');

    const [sslResult, headersResult, blacklistResult, dnsResult, pathsResult, mixedResult, stackResult] =
      await Promise.allSettled([
        isHttps
          ? checkSSL(hostname)
          : Promise.resolve({ valid: false, grade: 'F', error: 'Site does not use HTTPS' }),
        checkHeaders(url),
        checkBlacklist(url),
        checkDNS(hostname),
        checkExposedPaths(url),
        checkPageResources(url),
        detectStack(url),
      ]);

    const get = (r) =>
      r.status === 'fulfilled' ? r.value : { error: r.reason?.message || 'Check failed' };

    const pageResources = get(mixedResult);
    const audit = {
      url,
      hostname,
      timestamp: new Date().toISOString(),
      ssl: get(sslResult),
      headers: get(headersResult),
      blacklist: get(blacklistResult),
      dns: get(dnsResult),
      exposedPaths: get(pathsResult),
      mixedContent: { hasMixedContent: pageResources.hasMixedContent, count: pageResources.count, error: pageResources.error, elements: pageResources.mixedElements || [] },
      cspSuggestion: pageResources.cspSuggestion || null,
      stack: get(stackResult),
    };

    // ─── Scoring ───────────────────────────────────────────────────────────
    let score = 100;
    const findings = [];

    // SSL
    const s = audit.ssl;
    if (s.error && !s.valid) {
      score -= 30;
      findings.push({ severity: 'critical', category: 'SSL/TLS', message: `SSL check failed: ${s.error}` });
    } else if (!s.valid) {
      score -= 30;
      findings.push({ severity: 'critical', category: 'SSL/TLS', message: 'SSL/TLS certificate is invalid or untrusted' });
    } else if (s.daysLeft !== undefined && s.daysLeft < 7) {
      score -= 20;
      findings.push({ severity: 'critical', category: 'SSL/TLS', message: `Certificate expires in ${s.daysLeft} day(s) — critical renewal needed` });
    } else if (s.daysLeft !== undefined && s.daysLeft < 30) {
      score -= 10;
      findings.push({ severity: 'warning', category: 'SSL/TLS', message: `Certificate expires in ${s.daysLeft} days — renew soon` });
    }

    // Headers
    const h = audit.headers;
    if (!h.error) {
      if (!h.csp) {
        score -= 10;
        findings.push({ severity: 'warning', category: 'Headers', message: 'Content Security Policy (CSP) missing — cross-site scripting risk' });
      }
      if (!h.hsts) {
        score -= 10;
        findings.push({ severity: 'warning', category: 'Headers', message: 'HSTS missing — connection downgrade attack risk' });
      }
      if (!h.xFrameOptions) {
        score -= 5;
        findings.push({ severity: 'info', category: 'Headers', message: 'X-Frame-Options missing — clickjacking risk' });
      }
      if (!h.xContentTypeOptions) {
        score -= 5;
        findings.push({ severity: 'info', category: 'Headers', message: 'X-Content-Type-Options missing — MIME sniffing risk' });
      }
    }

    // Blacklist
    if (audit.blacklist.blacklisted) {
      score -= 30;
      findings.push({
        severity: 'critical',
        category: 'Blacklist',
        message: `Flagged by Google Safe Browsing: ${audit.blacklist.threats?.join(', ')}`,
      });
    }

    // DNS
    const d = audit.dns;
    if (!d.error) {
      if (!d.spf) {
        score -= 5;
        findings.push({ severity: 'warning', category: 'DNS', message: 'No SPF record found — email spoofing risk' });
      }
      if (!d.dmarc) {
        score -= 5;
        findings.push({ severity: 'warning', category: 'DNS', message: 'No DMARC record found — email spoofing risk' });
      }
    }

    // Exposed paths
    const ep = audit.exposedPaths;
    if (Array.isArray(ep) && ep.length > 0) {
      score -= Math.min(ep.length * 10, 20);
      findings.push({
        severity: 'critical',
        category: 'Exposed Paths',
        message: `${ep.length} sensitive path(s) publicly accessible: ${ep.map((p) => p.path).join(', ')}`,
      });
    }

    // Mixed content
    const mc = audit.mixedContent;
    if (mc.hasMixedContent) {
      score -= 10;
      findings.push({
        severity: 'warning',
        category: 'Mixed Content',
        message: `${mc.count} insecure resource(s) loaded over HTTP on an HTTPS page`,
      });
    }

    score = Math.max(0, score);
    const grade = score >= 90 ? 'A' : score >= 75 ? 'B' : score >= 60 ? 'C' : score >= 40 ? 'D' : 'F';

    const fixes           = generateFixes(audit, audit.stack, hostname);
    const enrichedFindings = enrichFindings(findings, audit, audit.stack, hostname);
    const finalResult = { ...audit, score, grade, findings: enrichedFindings, fixes };

    // ─── Persist audit log (fire-and-forget, never blocks response) ────────
    try {
      let userId = null;
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.split(' ')[1];
        try {
          const decoded = jwt.verify(token, process.env.JWT_SECRET);
          userId = decoded.id || decoded.userId || decoded._id || null;
        } catch (_) {}
      }

      const savedLog = await SiteAuditLog.create({
        userId,
        url: finalResult.url,
        hostname: finalResult.hostname,
        score: finalResult.score,
        grade: finalResult.grade,
        findings: findings, // store plain findings (no explain/fix text) to keep docs lean
        ssl: finalResult.ssl,
        headers: finalResult.headers,
        blacklist: finalResult.blacklist,
        dns: finalResult.dns,
        exposedPaths: Array.isArray(finalResult.exposedPaths) ? finalResult.exposedPaths : [],
        mixedContent: finalResult.mixedContent,
      });
      finalResult.scanLogId = savedLog._id.toString();
    } catch (saveErr) {
      console.error('Failed to save audit log:', saveErr.message);
    }

    res.json(finalResult);
  } catch (err) {
    console.error('Site audit error:', err);
    res.status(500).json({ error: 'Audit failed: ' + err.message });
  }
});

// ─── PatchPath: Regression Verify Endpoint ────────────────────────────────────
// Re-runs only the checks that were previously failing so devs can confirm fixes.
router.post('/site-audit/verify', async (req, res) => {
  let { url, checks } = req.body;

  if (!url || typeof url !== 'string' || url.trim().length === 0) {
    return res.status(400).json({ error: 'URL is required' });
  }
  url = url.trim();
  if (!url.startsWith('http://') && !url.startsWith('https://')) url = 'https://' + url;

  let hostname;
  try { hostname = new URL(url).hostname; } catch (_) {
    return res.status(400).json({ error: 'Invalid URL format' });
  }

  const privatePattern = /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2[0-9]|3[01])\.|0\.0\.0\.0|::1)/;
  if (privatePattern.test(hostname)) return res.status(400).json({ error: 'Private URLs not permitted' });

  const wanted = Array.isArray(checks) && checks.length ? checks : ['headers', 'dns', 'ssl'];

  try {
    const tasks = {};
    if (wanted.includes('headers'))  tasks.headers  = checkHeaders(url);
    if (wanted.includes('dns'))      tasks.dns      = checkDNS(hostname);
    if (wanted.includes('ssl'))      tasks.ssl      = checkSSL(hostname);
    if (wanted.includes('blacklist'))tasks.blacklist = checkBlacklist(url);

    const keys    = Object.keys(tasks);
    const results = await Promise.allSettled(Object.values(tasks));
    const verifyResult = {};
    keys.forEach((k, i) => {
      verifyResult[k] = results[i].status === 'fulfilled' ? results[i].value : { error: results[i].reason?.message };
    });

    // Summarise what passed vs still failing
    const fixed   = [];
    const failing = [];

    if (verifyResult.headers && !verifyResult.headers.error) {
      const h = verifyResult.headers;
      const checks = { 'Content-Security-Policy': h.csp, 'Strict-Transport-Security': h.hsts,
        'X-Frame-Options': h.xFrameOptions, 'X-Content-Type-Options': h.xContentTypeOptions,
        'Referrer-Policy': h.referrerPolicy, 'Permissions-Policy': h.permissionsPolicy };
      for (const [name, present] of Object.entries(checks)) {
        (present ? fixed : failing).push({ check: 'Headers', item: name });
      }
    }
    if (verifyResult.dns && !verifyResult.dns.error) {
      const d = verifyResult.dns;
      (d.spf   ? fixed : failing).push({ check: 'DNS', item: 'SPF record' });
      (d.dmarc ? fixed : failing).push({ check: 'DNS', item: 'DMARC record' });
    }
    if (verifyResult.ssl && !verifyResult.ssl.error) {
      (verifyResult.ssl.valid ? fixed : failing).push({ check: 'SSL', item: 'Certificate valid' });
    }

    res.json({ url, hostname, timestamp: new Date().toISOString(), results: verifyResult, fixed, failing });
  } catch (err) {
    res.status(500).json({ error: 'Verify failed: ' + err.message });
  }
});

// ─── Audit History Endpoint ───────────────────────────────────────────────────
router.get('/site-audit/history', async (req, res) => {
  try {
    let userId = null;
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        userId = decoded.id || decoded.userId || decoded._id || null;
      } catch (_) {
        return res.status(401).json({ error: 'Invalid token' });
      }
    }

    const query = userId ? { userId } : { userId: null };
    const logs = await SiteAuditLog.find(query)
      .sort({ createdAt: -1 })
      .limit(50)
      .select('url hostname score grade findings ssl blacklist createdAt')
      .lean();

    res.json({ logs });
  } catch (err) {
    console.error('History fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch audit history' });
  }
});

export default router;
