/**
 * Seekurify — QR Code Phishing Detector
 *
 * Flow:
 *   1. Find <img> elements that could be QR codes (square-ish, ≥50 px)
 *   2. Decode with BarcodeDetector (Chrome native, no extra library)
 *   3. Run URL through local heuristics instantly
 *   4. Send to Seekurify link-scan backend for AI verdict
 *   5. Overlay a warning badge on suspicious / malicious QR codes
 *
 * Watches for dynamically injected images via MutationObserver.
 */

const SK_QR_MIN_SIZE          = 50;   // px — ignore tiny icons
const SK_QR_MAX_ASPECT_DELTA  = 0.35; // how non-square is acceptable
const SK_QR_SCAN_DEBOUNCE_MS  = 600;  // ms after DOM mutation before re-scan

// ── Supported check ──────────────────────────────────────────────────────────
const skQrSupported = typeof BarcodeDetector !== 'undefined';
let   skQrDetector  = null;

if (skQrSupported) {
  try {
    skQrDetector = new BarcodeDetector({ formats: ['qr_code'] });
  } catch (_) { /* not available */ }
}

// Track processed images so we don't double-scan
const skQrProcessed = new WeakSet();

// ── Local heuristics ─────────────────────────────────────────────────────────
const SK_QR_BAD_TLDS = new Set([
  'tk', 'ml', 'ga', 'cf', 'gq', 'xyz', 'top', 'click',
  'link', 'pw', 'ws', 'cc', 'buzz', 'live', 'surf', 'icu',
]);

const SK_QR_SHORTENERS = new Set([
  'bit.ly', 'tinyurl.com', 't.co', 'goo.gl', 'ow.ly',
  'short.link', 'qr.io', 'qrco.de', 'rb.gy', 'cutt.ly', 'is.gd',
]);

function skQrLocalCheck(rawUrl) {
  let parsed;
  try { parsed = new URL(rawUrl); } catch (_) {
    return { verdict: 'suspicious', reason: 'Malformed URL encoded in QR code' };
  }

  const host = parsed.hostname.toLowerCase();

  if (parsed.protocol === 'http:')
    return { verdict: 'suspicious', reason: 'Non-HTTPS link in QR code' };

  if (/^(\d{1,3}\.){3}\d{1,3}$/.test(host))
    return { verdict: 'suspicious', reason: 'Raw IP address in QR code URL' };

  const tld = host.split('.').pop();
  if (SK_QR_BAD_TLDS.has(tld))
    return { verdict: 'suspicious', reason: `High-risk TLD (.${tld}) in QR code URL` };

  if (SK_QR_SHORTENERS.has(host))
    return { verdict: 'suspicious', reason: 'URL shortener in QR code — real destination hidden' };

  const credWords = /login|signin|verify|account|password|credential|secure|update|confirm/i;
  if (credWords.test(parsed.pathname + parsed.search))
    return { verdict: 'suspicious', reason: 'Credential-harvesting keywords in QR code URL' };

  return { verdict: 'safe' };
}

// ── Warning overlay ───────────────────────────────────────────────────────────
function skQrShowWarning(img, url, verdict, reason) {
  // Don't double-show on the same image
  if (img._skQrWarned) return;
  img._skQrWarned = true;

  const shortUrl = url.length > 55 ? url.slice(0, 52) + '…' : url;

  // Wrap the image so we can position the overlay absolutely over it
  const wrapper = document.createElement('div');
  wrapper.className = 'sk-qr-wrapper';

  img.parentNode.insertBefore(wrapper, img);
  wrapper.appendChild(img);

  const overlay = document.createElement('div');
  overlay.className = `sk-qr-overlay sk-qr-${verdict}`;
  overlay.innerHTML = `
    <span class="sk-qr-icon">${verdict === 'malicious' ? '🚨' : '⚠️'}</span>
    <span class="sk-qr-title">${verdict === 'malicious' ? 'Phishing QR Code' : 'Suspicious QR Code'}</span>
    <span class="sk-qr-url" title="${url}">${shortUrl}</span>
    ${reason ? `<span class="sk-qr-reason">${reason}</span>` : ''}
    <div class="sk-qr-actions">
      <button class="sk-qr-block">Block</button>
      <button class="sk-qr-dismiss">Dismiss</button>
    </div>
  `;
  wrapper.appendChild(overlay);

  // Block: dim the QR so it can't be scanned
  overlay.querySelector('.sk-qr-block').addEventListener('click', (e) => {
    e.stopPropagation();
    img.style.cssText += 'opacity:0.04!important;filter:blur(6px)!important;';
    overlay.style.display = 'none';
  });

  // Dismiss: remove overlay, restore image, unwrap
  overlay.querySelector('.sk-qr-dismiss').addEventListener('click', (e) => {
    e.stopPropagation();
    wrapper.parentNode.insertBefore(img, wrapper);
    wrapper.remove();
    img._skQrWarned = false;
  });
}

function skQrUpgradeToMalicious(img) {
  const overlay = img._skQrWrapper?.querySelector('.sk-qr-overlay');
  if (!overlay) return;
  overlay.className = 'sk-qr-overlay sk-qr-malicious';
  const title = overlay.querySelector('.sk-qr-title');
  if (title) title.textContent = 'Phishing QR Code';
}

// ── Process a single image ────────────────────────────────────────────────────
async function skQrProcessImage(img) {
  if (skQrProcessed.has(img)) return;
  skQrProcessed.add(img);

  // Wait for load
  if (!img.complete || img.naturalWidth === 0) {
    await new Promise(resolve => {
      img.addEventListener('load',  resolve, { once: true });
      img.addEventListener('error', resolve, { once: true });
      setTimeout(resolve, 3000);
    });
  }

  const w = img.naturalWidth  || img.offsetWidth;
  const h = img.naturalHeight || img.offsetHeight;

  if (!w || !h || w < SK_QR_MIN_SIZE || h < SK_QR_MIN_SIZE) return;

  // QR codes are square — skip obviously non-square images
  if (Math.abs(w / h - 1) > SK_QR_MAX_ASPECT_DELTA) return;

  if (!skQrDetector) return; // BarcodeDetector not available

  let decoded;
  try {
    const results = await skQrDetector.detect(img);
    if (!results.length) return;
    decoded = results[0].rawValue;
  } catch (_) {
    return;
  }

  if (!decoded) return;

  // Only care about URL payloads
  if (!/^https?:\/\//i.test(decoded) && !decoded.startsWith('//')) return;
  const url = decoded.startsWith('//') ? 'https:' + decoded : decoded;

  // ── Phase 1: instant local verdict ────────────────────────────────────────
  const local = skQrLocalCheck(url);
  if (local.verdict !== 'safe') {
    skQrShowWarning(img, url, local.verdict, local.reason);
  }

  // ── Phase 2: backend AI scan ──────────────────────────────────────────────
  try {
    const result = await chrome.runtime.sendMessage({ type: 'QR_SCAN', url });
    if (!result || result.error) return;

    const { verdict, reason } = result;
    if (verdict === 'malicious' || verdict === 'suspicious') {
      if (!img._skQrWarned) {
        skQrShowWarning(img, url, verdict, reason || '');
      } else if (verdict === 'malicious') {
        skQrUpgradeToMalicious(img);
      }
    }
  } catch (_) { /* extension context invalidated or backend down */ }
}

// ── Scan all current images ───────────────────────────────────────────────────
function skQrScanAll() {
  document.querySelectorAll('img[src]').forEach(skQrProcessImage);
}

// ── MutationObserver — catch dynamically injected images ─────────────────────
let skQrDebounceTimer = null;
const skQrObserver = new MutationObserver((mutations) => {
  // Quick check: any added nodes contain images?
  const hasNewImages = mutations.some(m =>
    [...m.addedNodes].some(n =>
      n.nodeName === 'IMG' ||
      (n.querySelectorAll && n.querySelectorAll('img').length > 0)
    )
  );
  if (!hasNewImages) return;

  clearTimeout(skQrDebounceTimer);
  skQrDebounceTimer = setTimeout(skQrScanAll, SK_QR_SCAN_DEBOUNCE_MS);
});

// ── Boot ──────────────────────────────────────────────────────────────────────
if (!skQrSupported) {
  // BarcodeDetector not available — silent no-op (Chrome 88+ required)
} else {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      skQrScanAll();
      skQrObserver.observe(document.body, { childList: true, subtree: true });
    });
  } else {
    skQrScanAll();
    skQrObserver.observe(document.body, { childList: true, subtree: true });
  }
}
