import express from 'express';
import jwt from 'jsonwebtoken';
import WatchlistItem from '../models/WatchlistItem.js';
import WatchAlert    from '../models/WatchAlert.js';
import User          from '../models/User.ts';
import { runWatchAgent, scanSingleItem } from '../agent/watchAgent.js';

const WATCHLIST_LIMIT = 20;

const router = express.Router();

// ─── Auth helper ──────────────────────────────────────────────────────────────
function requireAuth(req, res, next) {
  try {
    const auth = req.headers.authorization;
    if (!auth?.startsWith('Bearer ')) return res.status(401).json({ error: 'Authentication required.' });
    const decoded = jwt.verify(auth.split(' ')[1], process.env.JWT_SECRET);
    req._userId = decoded.id ?? decoded.userId ?? decoded._id ?? null;
    if (!req._userId) return res.status(401).json({ error: 'Authentication required.' });
    next();
  } catch (_) {
    return res.status(401).json({ error: 'Authentication required.' });
  }
}

// ─── GET /watchlist ───────────────────────────────────────────────────────────
router.get('/watchlist', requireAuth, async (req, res) => {
  try {
    const items = await WatchlistItem.find({ userId: req._userId })
      .sort({ createdAt: -1 })
      .lean();
    res.json({ items });
  } catch (err) {
    console.error('Watchlist fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch watchlist.' });
  }
});

// ─── POST /watchlist ──────────────────────────────────────────────────────────
router.post('/watchlist', requireAuth, async (req, res) => {
  try {
    const { url } = req.body;
    if (!url?.trim()) return res.status(400).json({ error: 'URL is required.' });

    // Validate URL shape
    let parsed;
    try { parsed = new URL(url.trim()); } catch (_) {
      return res.status(400).json({ error: 'Invalid URL format.' });
    }
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return res.status(400).json({ error: 'Only http/https URLs are supported.' });
    }

    const count = await WatchlistItem.countDocuments({ userId: req._userId, active: true });
    if (count >= WATCHLIST_LIMIT) {
      return res.status(429).json({ error: `Watchlist limit reached (max ${WATCHLIST_LIMIT} URLs).` });
    }

    const existing = await WatchlistItem.findOne({ userId: req._userId, url: url.trim() });
    if (existing) {
      // Re-activate if previously deactivated
      if (!existing.active) {
        existing.active = true;
        await existing.save();
        return res.json({ item: existing });
      }
      return res.status(409).json({ error: 'URL already in watchlist.' });
    }

    const item = await WatchlistItem.create({
      userId:   req._userId,
      url:      url.trim(),
      hostname: parsed.hostname,
      active:   true,
    });
    res.status(201).json({ item });
  } catch (err) {
    console.error('Watchlist add error:', err);
    res.status(500).json({ error: 'Failed to add URL.' });
  }
});

// ─── DELETE /watchlist/:id ─────────────────────────────────────────────────────
router.delete('/watchlist/:id', requireAuth, async (req, res) => {
  try {
    const item = await WatchlistItem.findOneAndDelete({
      _id:    req.params.id,
      userId: req._userId,
    });
    if (!item) return res.status(404).json({ error: 'Item not found.' });
    res.json({ deleted: true });
  } catch (err) {
    console.error('Watchlist delete error:', err);
    res.status(500).json({ error: 'Failed to delete item.' });
  }
});

// ─── GET /watchlist/alerts ────────────────────────────────────────────────────
router.get('/watchlist/alerts', requireAuth, async (req, res) => {
  try {
    const alerts = await WatchAlert.find({ userId: req._userId })
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();
    res.json({ alerts });
  } catch (err) {
    console.error('Alerts fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch alerts.' });
  }
});

// ─── PATCH /watchlist/alerts/:id/read ────────────────────────────────────────
router.patch('/watchlist/alerts/:id/read', requireAuth, async (req, res) => {
  try {
    const alert = await WatchAlert.findOneAndUpdate(
      { _id: req.params.id, userId: req._userId },
      { $set: { read: true } },
      { new: true }
    );
    if (!alert) return res.status(404).json({ error: 'Alert not found.' });
    res.json({ alert });
  } catch (err) {
    console.error('Alert read error:', err);
    res.status(500).json({ error: 'Failed to mark alert as read.' });
  }
});

// ─── PATCH /watchlist/:id/toggle ─────────────────────────────────────────────
router.patch('/watchlist/:id/toggle', requireAuth, async (req, res) => {
  try {
    const item = await WatchlistItem.findOne({ _id: req.params.id, userId: req._userId });
    if (!item) return res.status(404).json({ error: 'Item not found.' });

    if (!item.active) {
      const count = await WatchlistItem.countDocuments({ userId: req._userId, active: true });
      if (count >= WATCHLIST_LIMIT) {
        return res.status(429).json({ error: `Watchlist limit reached (max ${WATCHLIST_LIMIT} active URLs).` });
      }
    }

    item.active = !item.active;
    await item.save();
    res.json({ item });
  } catch (err) {
    console.error('Toggle error:', err);
    res.status(500).json({ error: 'Failed to toggle item.' });
  }
});

// ─── PATCH /watchlist/:id/schedule ───────────────────────────────────────────
router.patch('/watchlist/:id/schedule', requireAuth, async (req, res) => {
  try {
    const { scheduledScanAt } = req.body;
    const item = await WatchlistItem.findOne({ _id: req.params.id, userId: req._userId });
    if (!item) return res.status(404).json({ error: 'Item not found.' });

    if (scheduledScanAt == null || scheduledScanAt === '') {
      item.scheduledScanAt = null;
      await item.save();
      return res.json({ item });
    }

    const parsed = new Date(scheduledScanAt);
    if (Number.isNaN(parsed.getTime())) {
      return res.status(400).json({ error: 'Invalid scheduled scan date/time.' });
    }
    if (parsed.getTime() <= Date.now()) {
      return res.status(400).json({ error: 'Scheduled scan time must be in the future.' });
    }

    item.scheduledScanAt = parsed;
    await item.save();
    res.json({ item });
  } catch (err) {
    console.error('Schedule update error:', err);
    res.status(500).json({ error: 'Failed to update schedule.' });
  }
});

// ─── PATCH /watchlist/alerts/read-all ────────────────────────────────────────
router.patch('/watchlist/alerts/read-all', requireAuth, async (req, res) => {
  try {
    await WatchAlert.updateMany({ userId: req._userId, read: false }, { $set: { read: true } });
    res.json({ success: true });
  } catch (err) {
    console.error('Read-all error:', err);
    res.status(500).json({ error: 'Failed to mark all alerts as read.' });
  }
});

// ─── DELETE /watchlist/alerts ─────────────────────────────────────────────────
router.delete('/watchlist/alerts', requireAuth, async (req, res) => {
  try {
    await WatchAlert.deleteMany({ userId: req._userId });
    res.json({ success: true });
  } catch (err) {
    console.error('Delete alerts error:', err);
    res.status(500).json({ error: 'Failed to clear alerts.' });
  }
});

// ─── POST /watchlist/scan ─────────────────────────────────────────────────────
// Manual "Scan Now" for a single URL
router.post('/watchlist/scan', requireAuth, async (req, res) => {
  try {
    const { url } = req.body;
    if (!url?.trim()) return res.status(400).json({ error: 'URL is required.' });

    const user = await User.findById(req._userId).select('email').lean();
    const result = await scanSingleItem(req._userId, url.trim(), user?.email ?? null);
    res.json(result);
  } catch (err) {
    console.error('Manual scan error:', err);
    res.status(500).json({ error: err.message || 'Scan failed.' });
  }
});

// ─── POST /watchlist/scan-all ─────────────────────────────────────────────────
// Manual "Scan All" — runs the full agent for this user
router.post('/watchlist/scan-all', requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req._userId).select('email').lean();
    const result = await runWatchAgent(req._userId, user?.email ?? null);
    res.json(result);
  } catch (err) {
    console.error('Scan-all error:', err);
    res.status(500).json({ error: err.message || 'Scan failed.' });
  }
});

export default router;
