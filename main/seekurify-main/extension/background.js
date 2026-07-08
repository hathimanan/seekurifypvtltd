// Default API base — user can override via extension settings
const DEFAULT_API_BASE = 'http://localhost:5000';

// Open the side panel when the toolbar icon is clicked
chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});
});
chrome.action.onClicked.addListener(tab => {
  chrome.sidePanel.open({ tabId: tab.id }).catch(() => {});
});

async function getApiBase() {
  const { apiBase } = await chrome.storage.local.get('apiBase');
  return apiBase || DEFAULT_API_BASE;
}

async function getToken() {
  const { token } = await chrome.storage.local.get('token');
  return token || null;
}

async function authedFetch(path, options = {}) {
  const [base, token] = await Promise.all([getApiBase(), getToken()]);
  const res = await fetch(`${base}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });
  return res;
}

// ── Message handler ────────────────────────────────────────────────────────────
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  handleMessage(message)
    .then(sendResponse)
    .catch(err => sendResponse({ error: err.message }));
  return true; // keep channel open for async response
});

async function handleMessage(message) {
  switch (message.type) {

    case 'GET_TOKEN':
      return { token: await getToken() };

    // Step 1 — verify email + password
    case 'LOGIN_STEP1': {
      const base = await getApiBase();
      const res = await fetch(`${base}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(message.credentials),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || 'Login failed');
      // Returns { message, user: { id, email } } — no token yet
      return { success: true, email: body.user?.email || message.credentials.email };
    }

    // Step 2 — send OTP to email
    case 'SEND_OTP': {
      const base = await getApiBase();
      const res = await fetch(`${base}/api/auth/send-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: message.email }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || 'Failed to send OTP');
      // Returns { message, otpToken }
      return { success: true, otpToken: body.otpToken };
    }

    // Step 3 — verify OTP
    case 'VERIFY_OTP': {
      const base = await getApiBase();
      const res = await fetch(`${base}/api/auth/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: message.email, otp: message.otp, otpToken: message.otpToken }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || 'Invalid OTP');
      return { success: true };
    }

    // Step 4 — verify PIN → receive JWT
    case 'VERIFY_PIN': {
      const base = await getApiBase();
      const res = await fetch(`${base}/api/auth/verify-pin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: message.email, pin: message.pin, source: 'extension' }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || 'Invalid PIN');
      if (!body.token) throw new Error('No token returned from server');
      await chrome.storage.local.set({ token: body.token });
      return { success: true };
    }

    case 'LOGOUT':
      await chrome.storage.local.remove('token');
      return { success: true };

    case 'GET_VAULT': {
      const res = await authedFetch('/api/passwords');
      if (res.status === 401 || res.status === 403) throw new Error('session_expired');
      if (!res.ok) throw new Error('Failed to fetch vault');
      return res.json(); // array of decrypted password entries
    }

    case 'SAVE_PASSWORD': {
      const res = await authedFetch('/api/passwords', {
        method: 'POST',
        body: JSON.stringify(message.data),
      });
      if (res.status === 401 || res.status === 403) throw new Error('session_expired');
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Failed to save password');
      }
      return res.json();
    }

    case 'UPDATE_PASSWORD': {
      const res = await authedFetch(`/api/passwords/${message.id}`, {
        method: 'PUT',
        body: JSON.stringify(message.data),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Failed to update password');
      }
      return res.json();
    }

    case 'GET_API_BASE':
      return { apiBase: await getApiBase() };

    case 'SET_API_BASE':
      await chrome.storage.local.set({ apiBase: message.apiBase });
      return { success: true };

    case 'SITE_AUDIT': {
      const res = await authedFetch('/api/site-audit', {
        method: 'POST',
        body: JSON.stringify({ url: message.url }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || 'Site audit failed');
      return body;
    }

    // ── PII monitoring ─────────────────────────────────────────────────────
    case 'PII_ANALYZE': {
      // Calls the Seekurify AI backend and returns findings — no logging.
      // Used by the content script for both typing (async) and submit scans.
      const [base, token] = await Promise.all([getApiBase(), getToken()]);
      if (!token) return { findings: [] };
      try {
        const res = await fetch(`${base}/api/pii-scan/analyze`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ text: message.text.slice(0, 5000) }),
        });
        if (!res.ok) return { findings: [] };
        const data = await res.json().catch(() => ({}));
        return {
          findings:  data.findings  || [],
          score:     data.score     ?? 0,
          riskLevel: data.riskLevel ?? 'safe',
        };
      } catch {
        return { findings: [] };
      }
    }

    case 'PII_DETECTED': {
      const { pii_log = [] } = await chrome.storage.session.get('pii_log');
      pii_log.unshift({
        platform: message.platform,
        url:      message.url,
        findings: message.findings,
        snippet:  message.snippet,
        submitted: false,
        timestamp: message.timestamp,
      });
      if (pii_log.length > 50) pii_log.length = 50;
      await chrome.storage.session.set({ pii_log });
      return { ok: true };
    }

    case 'PII_SUBMIT': {
      // Log detection
      const { pii_log: log2 = [] } = await chrome.storage.session.get('pii_log');
      const entry = {
        platform: message.platform,
        url:      message.url,
        findings: message.findings,
        snippet:  message.snippet,
        submitted: true,
        timestamp: message.timestamp,
      };
      log2.unshift(entry);
      if (log2.length > 50) log2.length = 50;
      await chrome.storage.session.set({ pii_log: log2 });

      // Call backend to create a Seekurify PII finding (best-effort, no throw)
      try {
        const [base, token] = await Promise.all([getApiBase(), getToken()]);
        if (token && message.text) {
          await fetch(`${base}/api/pii-scan/analyze`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({
              text:  message.text.slice(0, 10000),
              label: `${message.platform} prompt — ${new Date(message.timestamp).toLocaleTimeString()}`,
            }),
          });
        }
      } catch { /* non-fatal */ }
      return { ok: true };
    }

    case 'GET_PII_LOG': {
      const { pii_log = [] } = await chrome.storage.session.get('pii_log');
      return pii_log;
    }

    case 'CLEAR_PII_LOG':
      await chrome.storage.session.remove('pii_log');
      return { ok: true };

    // ── Injection monitoring ────────────────────────────────────────────────────
    case 'INJECTION_ANALYZE': {
      const [base, token] = await Promise.all([getApiBase(), getToken()]);
      if (!token) return { findings: [] };
      try {
        const res = await fetch(`${base}/api/injection-scan/analyze`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ text: message.text.slice(0, 5000) }),
        });
        if (!res.ok) return { findings: [] };
        const data = await res.json().catch(() => ({}));
        return {
          findings:  data.findings  || [],
          score:     data.score     ?? 0,
          riskLevel: data.riskLevel ?? 'safe',
        };
      } catch {
        return { findings: [] };
      }
    }

    case 'INJECTION_DETECTED': {
      const { injection_log = [] } = await chrome.storage.session.get('injection_log');
      injection_log.unshift({
        platform:  message.platform,
        url:       message.url,
        findings:  message.findings,
        snippet:   message.snippet,
        submitted: false,
        timestamp: message.timestamp,
      });
      if (injection_log.length > 50) injection_log.length = 50;
      await chrome.storage.session.set({ injection_log });
      return { ok: true };
    }

    case 'INJECTION_SUBMIT': {
      const { injection_log: log2 = [] } = await chrome.storage.session.get('injection_log');
      log2.unshift({
        platform:  message.platform,
        url:       message.url,
        findings:  message.findings,
        snippet:   message.snippet,
        submitted: true,
        timestamp: message.timestamp,
      });
      if (log2.length > 50) log2.length = 50;
      await chrome.storage.session.set({ injection_log: log2 });

      try {
        const [base, token] = await Promise.all([getApiBase(), getToken()]);
        if (token && message.text) {
          await fetch(`${base}/api/injection-scan/analyze`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({
              text:  message.text.slice(0, 10000),
              label: `${message.platform} prompt — ${new Date(message.timestamp).toLocaleTimeString()}`,
            }),
          });
        }
      } catch { /* non-fatal */ }
      return { ok: true };
    }

    case 'GET_INJECTION_LOG': {
      const { injection_log = [] } = await chrome.storage.session.get('injection_log');
      return injection_log;
    }

    case 'CLEAR_INJECTION_LOG':
      await chrome.storage.session.remove('injection_log');
      return { ok: true };

    // ── Link scanner ───────────────────────────────────────────────────────────
    case 'LINK_SCAN': {
      const [base, token] = await Promise.all([getApiBase(), getToken()]);
      if (!token) return { verdict: 'safe', reason: 'Not authenticated', source: 'local', flags: [] };
      try {
        const res = await fetch(`${base}/api/link-scan/check`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ url: message.url }),
        });
        if (!res.ok) return { error: 'Backend unavailable' };
        const data = await res.json().catch(() => ({}));
        return {
          verdict:    data.verdict    || 'safe',
          reason:     data.reason     || 'No threats detected',
          confidence: data.confidence ?? null,
          flags:      data.flags      || [],
          source:     'ai',
        };
      } catch {
        return { error: 'Backend unavailable' };
      }
    }

    // ── Phishing monitoring ─────────────────────────────────────────────────────
    case 'PHISHING_SPEAR_ANALYZE': {
      const [base, token] = await Promise.all([getApiBase(), getToken()]);
      if (!token) return { spearPhishingAnalysis: null };
      try {
        const res = await fetch(`${base}/api/phishing/spear-analyze`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ emailContent: message.text.slice(0, 5000) }),
        });
        if (!res.ok) return { spearPhishingAnalysis: null };
        return res.json().catch(() => ({ spearPhishingAnalysis: null }));
      } catch {
        return { spearPhishingAnalysis: null };
      }
    }

    case 'PHISHING_ANALYZE': {
      const [base, token] = await Promise.all([getApiBase(), getToken()]);
      if (!token) return { findings: [] };
      try {
        const res = await fetch(`${base}/api/phishing-scan/analyze`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ text: message.text.slice(0, 5000) }),
        });
        if (!res.ok) return { findings: [] };
        const data = await res.json().catch(() => ({}));
        return {
          findings:  data.findings  || [],
          score:     data.score     ?? 0,
          riskLevel: data.riskLevel ?? 'safe',
        };
      } catch {
        return { findings: [] };
      }
    }

    case 'PHISHING_DETECTED': {
      const { phishing_log = [] } = await chrome.storage.session.get('phishing_log');
      phishing_log.unshift({
        platform:      message.platform,
        url:           message.url,
        findings:      message.findings,
        snippet:       message.snippet,
        score:         message.score        ?? 0,
        riskLevel:     message.riskLevel    ?? 'low',
        spearAnalysis: message.spearAnalysis ?? null,
        timestamp:     message.timestamp,
      });
      if (phishing_log.length > 50) phishing_log.length = 50;
      await chrome.storage.session.set({ phishing_log });
      return { ok: true };
    }

    case 'GET_PHISHING_LOG': {
      const { phishing_log = [] } = await chrome.storage.session.get('phishing_log');
      return phishing_log;
    }

    case 'CLEAR_PHISHING_LOG':
      await chrome.storage.session.remove('phishing_log');
      return { ok: true };

    // ── Breach detection (HIBP) ────────────────────────────────────────────────

    // Real-time password check — k-anonymity: only 5-char SHA-1 prefix sent.
    // The full hash never leaves the browser; suffix matching happens in content script.
    case 'HIBP_PASSWORD_CHECK': {
      const [base, token] = await Promise.all([getApiBase(), getToken()]);
      if (!token) return { suffixes: [] }; // not logged in — skip silently
      try {
        const res = await fetch(`${base}/api/hibp/check-password`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ hashPrefix: message.hashPrefix }),
        });
        if (!res.ok) return { suffixes: [] };
        return res.json();
      } catch {
        return { suffixes: [] };
      }
    }

    case 'HIBP_CHECK_ALL': {
      const res = await authedFetch('/api/hibp/check-all', { method: 'POST' });
      if (res.status === 401 || res.status === 403) throw new Error('session_expired');
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Breach check failed');
      }
      return res.json();
    }

    case 'HIBP_CHECK_EMAIL': {
      const res = await authedFetch('/api/hibp/check-email');
      if (res.status === 401 || res.status === 403) throw new Error('session_expired');
      const body = await res.json().catch(() => ({}));
      if (!res.ok) return { error: body.error || 'Email breach check failed', breaches: [] };
      return body;
    }

    // Returns domain names where the user has quarantined/breached credentials.
    // Used by breach-checker.js to show the site-level warning banner.
    case 'GET_BREACHED_DOMAINS': {
      try {
        const res = await authedFetch('/api/passwords/breach-control');
        if (!res.ok) return { domains: [] };
        const data = await res.json().catch(() => ({}));
        // Extract unique domain names from the quarantine queue
        const domains = [...new Set(
          (data.queue || []).map(p => {
            try {
              const url = p.website.startsWith('http') ? p.website : `https://${p.website}`;
              return new URL(url).hostname.replace(/^www\./, '');
            } catch { return p.website.toLowerCase().replace(/^www\./, ''); }
          })
        )];
        return { domains, queue: data.queue || [] };
      } catch {
        return { domains: [] };
      }
    }

    // ── QR code phishing scan ───────────────────────────────────────────────────
    // Reuses the link-scan backend endpoint; source flag lets the server log it
    // as a QR-code origin rather than a hovered link.
    case 'QR_SCAN': {
      const [base, token] = await Promise.all([getApiBase(), getToken()]);
      if (!token) return { verdict: 'safe', reason: 'Not authenticated' };
      try {
        const res = await fetch(`${base}/api/link-scan/check`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ url: message.url, source: 'qr_code' }),
        });
        if (!res.ok) return { verdict: 'safe', reason: 'Backend unavailable' };
        const data = await res.json().catch(() => ({}));
        return {
          verdict: data.verdict || 'safe',
          reason:  data.reason  || '',
          flags:   data.flags   || [],
        };
      } catch {
        return { verdict: 'safe', reason: 'Backend unavailable' };
      }
    }

    case 'VAULT_UPDATED':
      return { ok: true }; // acknowledged — side panel handles the refresh

    default:
      throw new Error(`Unknown message type: ${message.type}`);
  }
}
