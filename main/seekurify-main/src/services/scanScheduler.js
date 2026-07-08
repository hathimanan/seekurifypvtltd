import crypto from 'crypto';
import { schedule } from 'node-cron';
import Password, { decrypt } from '../models/Password.js';
import User from '../models/User.ts';
import ScanJob from '../models/ScanJob.js';
import { scoreCredential } from '../AI/credentialRiskScorer.ts';
import { routeEvent } from './triggerRouter.js';

const HIBP_PASSWORD_API = 'https://api.pwnedpasswords.com/range';
const USER_AGENT = 'Seekurify-PasswordManager/1.0';

async function hibpRangeCheck(sha1Hex) {
  const upper = sha1Hex.toUpperCase();
  const prefix = upper.slice(0, 5);
  const suffix = upper.slice(5);
  try {
    const res = await fetch(`${HIBP_PASSWORD_API}/${prefix}`, {
      headers: { 'Add-Padding': 'true', 'User-Agent': USER_AGENT },
    });
    if (!res.ok) return { isBreached: false, count: 0 };
    const text = await res.text();
    for (const line of text.split('\r\n')) {
      const [s, c] = line.split(':');
      if (s === suffix) return { isBreached: true, count: parseInt(c, 10) || 1 };
    }
    return { isBreached: false, count: 0 };
  } catch {
    return { isBreached: false, count: 0 };
  }
}

function strengthScore(password) {
  let s = 0;
  if (/[a-z]/.test(password)) s++;
  if (/[A-Z]/.test(password)) s++;
  if (/[0-9]/.test(password)) s++;
  if (/[^a-zA-Z0-9]/.test(password)) s++;
  return s;
}

export async function runScanForUser(userId, trigger = 'scheduled') {
  const job = await ScanJob.create({
    userId,
    type: 'both',
    trigger,
    status: 'running',
    startedAt: new Date(),
  });

  const findings = [];
  let breachedFound = 0, criticalFound = 0, highFound = 0, mediumFound = 0, playbooksTriggered = 0;

  try {
    const entries = await Password.find({ userId }).lean();
    const plaintexts = entries.map(e => decrypt(e.password) ?? '');

    // Build reuse frequency map
    const hashFreq = new Map();
    plaintexts.forEach(pt => {
      if (!pt) return;
      const h = crypto.createHash('sha256').update(pt).digest('hex');
      hashFreq.set(h, (hashFreq.get(h) ?? 0) + 1);
    });

    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      const pt = plaintexts[i];
      if (!pt) continue;

      // --- Breach check ---
      const sha1 = crypto.createHash('sha1').update(pt).digest('hex');
      const { isBreached, count } = await hibpRangeCheck(sha1);

      await Password.updateOne(
        { _id: entry._id },
        { $set: { isBreached, breachCount: count, breachCheckedAt: new Date() } }
      );

      if (isBreached) {
        breachedFound++;
        findings.push({ passwordId: String(entry._id), website: entry.website, username: entry.username, type: 'breach', breachCount: count });
        routeEvent('breach_detected', { website: entry.website, username: entry.username, breachCount: count, passwordId: String(entry._id) }, { userId: String(userId) })
          .then(() => { playbooksTriggered++; })
          .catch(() => {});
      }

      // --- Risk score ---
      const sha256 = crypto.createHash('sha256').update(pt).digest('hex');
      const reuseCount = Math.max(0, (hashFreq.get(sha256) ?? 1) - 1);

      const meta = {
        _id: String(entry._id),
        website: entry.website ?? '',
        username: entry.username ?? '',
        category: entry.category ?? 'General',
        isFinancial: entry.isFinancial ?? false,
        lastChanged: entry.lastChanged ?? null,
        isBreached,
        breachCount: count,
        passwordLength: pt.length,
        passwordStrengthScore: strengthScore(pt),
        reuseCount,
      };

      const result = scoreCredential(meta);
      const level = result.level;

      await Password.updateOne(
        { _id: entry._id },
        { $set: { riskScore: result.score, riskLevel: level, riskScoredAt: new Date() } }
      );

      if (level !== 'safe' && level !== 'low') {
        if (level === 'critical') criticalFound++;
        else if (level === 'high') highFound++;
        else mediumFound++;

        findings.push({ passwordId: String(entry._id), website: entry.website, username: entry.username, type: 'risk_score', score: result.score, level });
        routeEvent('risk_score_critical', { website: entry.website, username: entry.username, score: result.score, level, passwordId: String(entry._id) }, { userId: String(userId) })
          .catch(() => {});
      }
    }

    const completedAt = new Date();
    await ScanJob.findByIdAndUpdate(job._id, {
      status: 'completed',
      completedAt,
      durationMs: completedAt - job.startedAt,
      findings,
      summary: {
        credentialsChecked: entries.length,
        breachedFound,
        criticalFound,
        highFound,
        mediumFound,
        playbooksTriggered,
      },
    });

    console.log(`[ScanScheduler] User ${userId}: checked ${entries.length} creds, ${breachedFound} breached, ${criticalFound + highFound + mediumFound} risky`);
  } catch (err) {
    await ScanJob.findByIdAndUpdate(job._id, { status: 'failed', error: err.message, completedAt: new Date() });
    console.error(`[ScanScheduler] Scan failed for user ${userId}:`, err.message);
  }

  return job._id;
}

export function startScheduler(intervalHours = 6) {
  // Cron: run at minute 0 every N hours
  const cronExpr = `0 */${intervalHours} * * *`;

  schedule(cronExpr, async () => {
    console.log(`[ScanScheduler] Starting scheduled scan for all users`);
    try {
      const users = await User.find({}, '_id').lean();
      for (const user of users) {
        await runScanForUser(user._id, 'scheduled');
        // Small delay between users to avoid hammering HIBP rate limits
        await new Promise(r => setTimeout(r, 2000));
      }
      console.log(`[ScanScheduler] Completed scan for ${users.length} users`);
    } catch (err) {
      console.error('[ScanScheduler] Cron job error:', err.message);
    }
  });

  console.log(`[ScanScheduler] Scheduled scans every ${intervalHours}h (cron: ${cronExpr})`);
}
