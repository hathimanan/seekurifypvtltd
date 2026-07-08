/**
 * Seekurify Watch Agent
 * Nightly security monitoring — no external AI API required.
 * Scans every watched URL, diffs results, and creates alerts for meaningful changes.
 */

import tls  from 'tls';
import dns  from 'dns';
import axios from 'axios';
import { promisify } from 'util';
import WatchlistItem from '../models/WatchlistItem.js';
import WatchAlert    from '../models/WatchAlert.js';
import { sendWatchAlertsEmail } from '../emailService.js';
import { routeEvent } from '../services/triggerRouter.js';

const resolveTxt = promisify(dns.resolveTxt);

// ─── Mini Security Audit ───────────────────────────────────────────────────────
async function runMiniAudit(url) {
  let hostname;
  try { hostname = new URL(url).hostname; }
  catch (_) { throw new Error(`Invalid URL: ${url}`); }

  let score = 100;
  const findings = [];

  // SSL/TLS
  await new Promise(resolve => {
    const socket = tls.connect(
      { host: hostname, port: 443, servername: hostname, rejectUnauthorized: false },
      () => {
        const cert = socket.getPeerCertificate();
        const authorized = socket.authorized;
        socket.destroy();
        if (!cert?.valid_to || !authorized) {
          score -= 30; findings.push('SSL/TLS invalid or missing');
        } else {
          const daysLeft = Math.floor((new Date(cert.valid_to) - Date.now()) / 86_400_000);
          if (daysLeft < 7)       { score -= 25; findings.push(`SSL expires in ${daysLeft} day(s) — URGENT`); }
          else if (daysLeft < 30) { score -= 15; findings.push(`SSL expires in ${daysLeft} day(s)`); }
        }
        resolve();
      }
    );
    socket.setTimeout(5000, () => { socket.destroy(); resolve(); });
    socket.on('error', () => { score -= 10; findings.push('SSL connection failed'); resolve(); });
  });

  // HTTP Security Headers
  try {
    const r = await axios.head(url, {
      timeout: 8000, validateStatus: () => true, maxRedirects: 5,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Seekurify-WatchAgent/1.0)' },
    });
    const h = r.headers;
    if (!h['content-security-policy'])    { score -= 10; findings.push('CSP header missing'); }
    if (!h['strict-transport-security'])  { score -= 10; findings.push('HSTS header missing'); }
    if (!h['x-frame-options'])            { score -=  5; findings.push('X-Frame-Options missing'); }
    if (!h['x-content-type-options'])     { score -=  5; findings.push('X-Content-Type-Options missing'); }
    if (!h['referrer-policy'])            { score -=  5; findings.push('Referrer-Policy missing'); }
  } catch (_) { score -= 5; findings.push('Headers check failed'); }

  // DNS: SPF
  try {
    const txts = await resolveTxt(hostname);
    if (!txts.flat().some(r => r.startsWith('v=spf1')))
      { score -= 5; findings.push('SPF record missing'); }
  } catch (_) { score -= 5; findings.push('SPF record missing'); }

  // DNS: DMARC
  try {
    const txts = await resolveTxt(`_dmarc.${hostname}`);
    if (!txts.flat().some(r => r.startsWith('v=DMARC1')))
      { score -= 5; findings.push('DMARC record missing'); }
  } catch (_) { score -= 5; findings.push('DMARC record missing'); }

  score = Math.max(0, score);
  const grade =
    score >= 90 ? 'A' :
    score >= 75 ? 'B' :
    score >= 60 ? 'C' :
    score >= 40 ? 'D' : 'F';

  return { url, hostname, score, grade, findings };
}

// ─── Alert Decision Logic ──────────────────────────────────────────────────────
function buildAlertIfNeeded({ url, hostname, prevScore, prevFindings, newScore, newFindings, firstScan }) {
  const prevSet = new Set(prevFindings ?? []);
  const newSet  = new Set(newFindings  ?? []);

  const appeared = newFindings.filter(f => !prevSet.has(f));
  const resolved = (prevFindings ?? []).filter(f => !newSet.has(f));
  const delta    = prevScore != null ? newScore - prevScore : 0;

  // First scan: only alert if failing grade
  if (firstScan) {
    if (newScore >= 60) return null;
    return {
      severity: newScore < 40 ? 'critical' : 'high',
      summary:  `First scan of ${hostname} returned a score of ${newScore}/100 (grade ${
        newScore >= 40 ? 'D' : 'F'
      }). Review the findings and address security gaps.`,
      prevScore:        null,
      newScore,
      newFindings:      newFindings,
      resolvedFindings: [],
    };
  }

  const hasNewFindings      = appeared.length > 0;
  const hasResolvedFindings = resolved.length > 0;
  const significantDrop     = delta <= -10;
  const anyImprovement      = delta >= 10 && resolved.length > 0;

  if (!significantDrop && !hasNewFindings && !hasResolvedFindings) return null;

  // Severity
  let severity;
  if (delta <= -20)                              severity = 'critical';
  else if (delta <= -10 || hasNewFindings)       severity = 'high';
  else if (hasResolvedFindings && delta >= 0)    severity = 'improvement';
  else                                           severity = 'medium';

  // Summary
  const parts = [];
  if (delta < 0)  parts.push(`score dropped ${Math.abs(delta)} points (${prevScore} → ${newScore})`);
  if (delta > 0)  parts.push(`score improved ${delta} points (${prevScore} → ${newScore})`);
  if (appeared.length) parts.push(`${appeared.length} new finding${appeared.length > 1 ? 's' : ''}: ${appeared.slice(0, 2).join(', ')}${appeared.length > 2 ? '…' : ''}`);
  if (resolved.length) parts.push(`${resolved.length} issue${resolved.length > 1 ? 's' : ''} resolved: ${resolved.slice(0, 2).join(', ')}${resolved.length > 2 ? '…' : ''}`);

  const summary = `${hostname}: ${parts.join('; ')}.`;

  return { severity, summary, prevScore, newScore, newFindings: appeared, resolvedFindings: resolved };
}

// ─── Persist scan result ───────────────────────────────────────────────────────
async function persistScan(userId, url, result) {
  await WatchlistItem.findOneAndUpdate(
    { userId, url },
    {
      $set: {
        hostname:      result.hostname,
        lastScore:     result.score,
        lastGrade:     result.grade,
        lastFindings:  result.findings,
        lastScannedAt: new Date(),
      },
    }
  );
}

// ─── Save alert to DB ──────────────────────────────────────────────────────────
async function saveAlert(userId, url, hostname, alertData) {
  const item = await WatchlistItem.findOne({ userId, url }).lean();
  const scoreDelta = alertData.prevScore != null ? alertData.newScore - alertData.prevScore : 0;
  await WatchAlert.create({
    userId,
    watchlistItemId: item?._id,
    url,
    hostname,
    severity:         alertData.severity,
    prevScore:        alertData.prevScore ?? null,
    newScore:         alertData.newScore,
    scoreDelta,
    newFindings:      alertData.newFindings,
    resolvedFindings: alertData.resolvedFindings,
    summary:          alertData.summary,
  });
}

// ─── Send email helper ─────────────────────────────────────────────────────────
async function maybeSendEmail(userId, userEmail, alertsCreated) {
  if (alertsCreated === 0 || !userEmail) return;
  try {
    const newAlerts = await WatchAlert.find({ userId })
      .sort({ createdAt: -1 })
      .limit(alertsCreated)
      .lean();
    await sendWatchAlertsEmail(userEmail, newAlerts);
  } catch (err) {
    console.error(`[WatchAgent] Email failed for ${userEmail}:`, err.message);
  }
}

// ─── Scan All (nightly / manual scan-all) ────────────────────────────────────
async function runWatchAgent(userId, userEmail = null) {
  const watchlist = await WatchlistItem.find({ userId, active: true }).lean();

  if (!watchlist.length) {
    console.log(`[WatchAgent] No active watchlist items for user ${userId}`);
    return { scanned: 0, alertsCreated: 0 };
  }

  let alertsCreated = 0;

  for (const item of watchlist) {
    try {
      const result   = await runMiniAudit(item.url);
      const firstScan = item.lastScannedAt == null;

      const alertData = buildAlertIfNeeded({
        url:          item.url,
        hostname:     result.hostname,
        prevScore:    item.lastScore,
        prevFindings: item.lastFindings ?? [],
        newScore:     result.score,
        newFindings:  result.findings,
        firstScan,
      });

      await persistScan(userId, item.url, result);

      if (alertData) {
        await saveAlert(userId, item.url, result.hostname, alertData);
        alertsCreated++;
        routeEvent('site_degraded', {
          url: item.url,
          hostname: result.hostname,
          newScore: alertData.newScore,
          prevScore: alertData.prevScore,
          scoreDelta: alertData.prevScore != null ? alertData.newScore - alertData.prevScore : 0,
          severity: alertData.severity,
          summary: alertData.summary,
          newFindings: alertData.newFindings,
        }, { userId: String(userId) }).catch(() => {});
      }
    } catch (err) {
      console.error(`[WatchAgent] Error scanning ${item.url}:`, err.message);
    }
  }

  console.log(`[WatchAgent] user=${userId} scanned=${watchlist.length} alerts=${alertsCreated}`);
  await maybeSendEmail(userId, userEmail, alertsCreated);
  return { scanned: watchlist.length, alertsCreated };
}

// ─── Single-URL scan (manual "Scan Now" from the UI) ─────────────────────────
async function scanSingleItem(userId, url, userEmail = null) {
  const item = await WatchlistItem.findOne({ userId, url }).lean();
  if (!item) throw new Error('URL not in watchlist');

  const result    = await runMiniAudit(url);
  const firstScan = item.lastScannedAt == null;

  const alertData = buildAlertIfNeeded({
    url,
    hostname:     result.hostname,
    prevScore:    item.lastScore,
    prevFindings: item.lastFindings ?? [],
    newScore:     result.score,
    newFindings:  result.findings,
    firstScan,
  });

  await persistScan(userId, url, result);

  let alertsCreated = 0;
  if (alertData) {
    await saveAlert(userId, url, result.hostname, alertData);
    alertsCreated = 1;
  }

  await maybeSendEmail(userId, userEmail, alertsCreated);

  const updated = await WatchlistItem.findOne({ userId, url }).lean();
  return { ...updated, alertsCreated };
}

async function runDueScheduledScans() {
  const dueItems = await WatchlistItem.find({
    active: true,
    scheduledScanAt: { $ne: null, $lte: new Date() },
  }).lean();

  let scanned = 0;
  let alertsCreated = 0;

  for (const item of dueItems) {
    try {
      await WatchlistItem.updateOne(
        { _id: item._id, scheduledScanAt: item.scheduledScanAt },
        { $set: { scheduledScanAt: null } }
      );

      const refreshed = await WatchlistItem.findById(item._id).lean();
      if (!refreshed || refreshed.scheduledScanAt !== null) continue;

      const result = await scanSingleItem(item.userId, item.url);
      scanned++;
      alertsCreated += result.alertsCreated ?? 0;
    } catch (err) {
      console.error(`[WatchAgent] Scheduled scan failed for ${item.url}:`, err.message);
      await WatchlistItem.updateOne(
        { _id: item._id, scheduledScanAt: null },
        { $set: { scheduledScanAt: item.scheduledScanAt } }
      );
    }
  }

  return { scanned, alertsCreated };
}

export { runWatchAgent, scanSingleItem, runMiniAudit, runDueScheduledScans };
