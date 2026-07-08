import express from 'express';
import { runWatchAgent, runDueScheduledScans } from '../agent/watchAgent.js';
import WatchlistItem from '../models/WatchlistItem.js';
import User from '../models/User.ts';

const router = express.Router();

const CRON_SECRET = process.env.CRON_SECRET;

function verifyCronSecret(req, res, next) {
  const auth = req.headers['authorization']?.split(' ')[1];
  if (!CRON_SECRET || auth !== CRON_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

// GET /api/cron/nightly-watch
// Called by Vercel Cron at 0 2 * * *
router.get('/nightly-watch', verifyCronSecret, async (req, res) => {
  console.log('[Cron] Starting nightly Watch Agent scan...');
  try {
    const userIds = await WatchlistItem.distinct('userId', { active: true });
    const results = [];
    for (const userId of userIds) {
      try {
        const user = await User.findById(userId).select('email').lean();
        const result = await runWatchAgent(userId, user?.email ?? null);
        console.log(`[Cron] user=${userId} scanned=${result.scanned} alerts=${result.alertsCreated}`);
        results.push({ userId, ...result });
      } catch (err) {
        console.error(`[Cron] Error for user ${userId}:`, err.message);
        results.push({ userId, error: err.message });
      }
    }
    return res.status(200).json({ ok: true, results });
  } catch (err) {
    console.error('[Cron] Nightly scan failed:', err.message);
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/cron/scheduled-scans
// Called by Vercel Cron at * * * * *
let scheduledWatchScanRunning = false;
router.get('/scheduled-scans', verifyCronSecret, async (req, res) => {
  if (scheduledWatchScanRunning) {
    return res.status(200).json({ ok: true, skipped: true });
  }
  scheduledWatchScanRunning = true;
  try {
    const result = await runDueScheduledScans();
    if (result.scanned > 0) {
      console.log(`[Cron] scheduled watch scans processed=${result.scanned} alerts=${result.alertsCreated}`);
    }
    return res.status(200).json({ ok: true, ...result });
  } catch (err) {
    console.error('[Cron] Scheduled watch scans failed:', err.message);
    return res.status(500).json({ error: err.message });
  } finally {
    scheduledWatchScanRunning = false;
  }
});

export default router;
