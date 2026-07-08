import express from 'express';
import axios   from 'axios';
import jwt     from 'jsonwebtoken';
import tls     from 'tls';
import dns     from 'dns';
import { promisify } from 'util';
import Webhook  from '../models/Webhook.js';

const router     = express.Router();
const resolveTxt = promisify(dns.resolveTxt);

// ─── Auth helper ──────────────────────────────────────────────────────────────
function getUserId(req) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return null;
  try {
    const decoded = jwt.verify(header.split(' ')[1], process.env.JWT_SECRET);
    return decoded.id || decoded.userId || decoded._id || null;
  } catch (_) { return null; }
}

// ─── Inline mini-audit for the trigger (avoids circular imports) ──────────────
async function runMiniAudit(url) {
  const hostname = new URL(url).hostname;
  let score = 100; const findings = [];

  // SSL
  await new Promise(resolve => {
    const socket = tls.connect({ host: hostname, port: 443, servername: hostname, rejectUnauthorized: false }, () => {
      const cert = socket.getPeerCertificate();
      const authorized = socket.authorized;
      socket.destroy();
      if (!cert?.valid_to || !authorized) { score -= 30; findings.push('SSL/TLS invalid or missing'); }
      else {
        const daysLeft = Math.floor((new Date(cert.valid_to) - Date.now()) / 86400000);
        if (daysLeft < 7) { score -= 20; findings.push(`SSL expires in ${daysLeft} day(s)`); }
      }
      resolve();
    });
    socket.setTimeout(5000, () => { socket.destroy(); resolve(); });
    socket.on('error', () => resolve());
  });

  // Headers
  try {
    const r = await axios.head(url, { timeout: 6000, validateStatus: () => true, maxRedirects: 5 });
    const h = r.headers;
    if (!h['content-security-policy'])   { score -= 10; findings.push('CSP missing'); }
    if (!h['strict-transport-security']) { score -= 10; findings.push('HSTS missing'); }
    if (!h['x-frame-options'])           { score -=  5; findings.push('X-Frame-Options missing'); }
    if (!h['x-content-type-options'])    { score -=  5; findings.push('X-Content-Type-Options missing'); }
  } catch (_) {}

  // DNS
  try {
    const txts = await resolveTxt(hostname);
    if (!txts.flat().some(r => r.startsWith('v=spf1')))  { score -= 5; findings.push('SPF missing'); }
  } catch (_) { score -= 5; findings.push('SPF missing'); }
  try {
    const txts = await resolveTxt(`_dmarc.${hostname}`);
    if (!txts.flat().some(r => r.startsWith('v=DMARC1'))) { score -= 5; findings.push('DMARC missing'); }
  } catch (_) { score -= 5; findings.push('DMARC missing'); }

  score = Math.max(0, score);
  const grade = score >= 90 ? 'A' : score >= 75 ? 'B' : score >= 60 ? 'C' : score >= 40 ? 'D' : 'F';
  return { url, hostname, score, grade, findings, timestamp: new Date().toISOString() };
}

// ─── Format notification payload ─────────────────────────────────────────────
function buildSlackPayload(audit, webhook) {
  const emoji = audit.score >= 90 ? ':white_check_mark:' : audit.score >= 70 ? ':warning:' : ':x:';
  const status = audit.score >= webhook.threshold ? 'PASSED' : 'FAILED';
  return {
    text: `${emoji} *SiteShield Audit — ${audit.hostname}*`,
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `${emoji} *SiteShield Audit: ${audit.hostname}*\nStatus: *${status}*  |  Score: *${audit.score}/100 (${audit.grade})*\nTriggered by: ${webhook.name}`,
        },
      },
      audit.findings.length > 0 && {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '*Findings:*\n' + audit.findings.slice(0, 8).map(f => `• ${f}`).join('\n'),
        },
      },
      {
        type: 'context',
        elements: [{ type: 'mrkdwn', text: `Scanned at ${audit.timestamp} via Seekurify SiteShield` }],
      },
    ].filter(Boolean),
  };
}

function buildGithubPayload(audit, webhook) {
  const passed = audit.score >= webhook.threshold;
  return {
    event_type: 'security_scan',
    client_payload: {
      url:       audit.url,
      hostname:  audit.hostname,
      score:     audit.score,
      grade:     audit.grade,
      passed,
      findings:  audit.findings,
      timestamp: audit.timestamp,
    },
  };
}

// ─── POST /api/webhooks — create ──────────────────────────────────────────────
router.post('/webhooks', async (req, res) => {
  const userId = getUserId(req);
  const { name, targetUrl, webhookUrl, webhookType, threshold } = req.body;

  if (!name || !targetUrl || !webhookUrl)
    return res.status(400).json({ error: 'name, targetUrl, and webhookUrl are required' });

  try {
    const wh = await Webhook.create({ userId, name, targetUrl, webhookUrl, webhookType, threshold });
    res.status(201).json({
      id:        wh._id,
      name:      wh.name,
      token:     wh.token,
      triggerUrl: `${req.protocol}://${req.get('host')}/api/webhooks/trigger/${wh.token}`,
      curlCommand: `curl -X POST ${req.protocol}://${req.get('host')}/api/webhooks/trigger/${wh.token}`,
      githubStep: `- name: Seekurify Security Scan\n  run: curl -f -X POST ${req.protocol}://${req.get('host')}/api/webhooks/trigger/${wh.token}`,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/webhooks — list user's webhooks ─────────────────────────────────
router.get('/webhooks', async (req, res) => {
  const userId = getUserId(req);
  try {
    const list = await Webhook.find({ userId: userId ?? null })
      .sort({ createdAt: -1 })
      .select('-__v')
      .lean();
    res.json({ webhooks: list });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── DELETE /api/webhooks/:id ─────────────────────────────────────────────────
router.delete('/webhooks/:id', async (req, res) => {
  const userId = getUserId(req);
  try {
    const wh = await Webhook.findOneAndDelete({ _id: req.params.id, userId: userId ?? null });
    if (!wh) return res.status(404).json({ error: 'Webhook not found' });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/webhooks/trigger/:token — called from CI/CD ───────────────────
router.post('/webhooks/trigger/:token', async (req, res) => {
  const wh = await Webhook.findOne({ token: req.params.token, active: true }).lean();
  if (!wh) return res.status(404).json({ error: 'Webhook not found or inactive' });

  let audit;
  try {
    audit = await runMiniAudit(wh.targetUrl);
  } catch (err) {
    await Webhook.updateOne({ _id: wh._id }, { lastRunAt: new Date(), lastStatus: 'error' });
    return res.status(500).json({ error: 'Audit failed: ' + err.message });
  }

  const passed = audit.score >= wh.threshold;
  await Webhook.updateOne(
    { _id: wh._id },
    { lastRunAt: new Date(), lastScore: audit.score, lastGrade: audit.grade, lastStatus: passed ? 'passed' : 'failed' }
  );

  // Post notification
  try {
    let payload;
    if (wh.webhookType === 'slack')        payload = buildSlackPayload(audit, wh);
    else if (wh.webhookType === 'github')  payload = buildGithubPayload(audit, wh);
    else                                   payload = { audit, webhook: { name: wh.name, threshold: wh.threshold }, passed };

    await axios.post(wh.webhookUrl, payload, { timeout: 8000, headers: { 'Content-Type': 'application/json' } });
  } catch (notifyErr) {
    // notification failure is non-fatal — still return the audit result
    console.error('Webhook notify failed:', notifyErr.message);
  }

  // Return 422 if below threshold so CI/CD step fails automatically
  const status = passed ? 200 : 422;
  res.status(status).json({
    passed,
    score:    audit.score,
    grade:    audit.grade,
    findings: audit.findings,
    message:  passed
      ? `Security scan passed (${audit.score}/100 ≥ threshold ${wh.threshold})`
      : `Security scan failed (${audit.score}/100 < threshold ${wh.threshold})`,
  });
});

export default router;
