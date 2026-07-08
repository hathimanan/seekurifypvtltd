/**
 * Seekurify — Log Report API
 *
 * GET /api/log-report        — aggregated logs across all sources
 * GET /api/log-report/stats  — summary counts by type and severity
 */

import express    from 'express';
import jwt        from 'jsonwebtoken';
import Finding    from '../models/Finding.js';
import Incident   from '../models/Incident.js';
import FirewallEvent from '../models/FirewallEvent.js';
import WatchAlert from '../models/WatchAlert.js';
import LoginEvent from '../models/LoginEvent.model.js';
import Log        from '../models/Log.js';
import RedTeamScanLog  from '../models/RedTeamScanLog.js';
import AIAgentScanLog  from '../models/AIAgentScanLog.js';

const router = express.Router();

function extractUserId(req) {
  try {
    const auth = req.headers.authorization;
    if (!auth?.startsWith('Bearer ')) return null;
    const decoded = jwt.verify(auth.split(' ')[1], process.env.JWT_SECRET);
    return decoded.id ?? decoded.userId ?? decoded._id ?? null;
  } catch (_) { return null; }
}

function requireAuth(req, res, next) {
  const userId = extractUserId(req);
  if (!userId) return res.status(401).json({ error: 'Authentication required.' });
  req._userId = userId;
  next();
}

// Normalize severity to a common set
function normSeverity(s) {
  if (!s) return 'info';
  const v = s.toLowerCase();
  if (['critical', 'high', 'medium', 'low', 'info'].includes(v)) return v;
  if (v === 'none' || v === 'safe' || v === 'clean') return 'info';
  if (v === 'improvement') return 'low';
  return 'info';
}

// Severity sort weight (lower = more severe)
const SEV_WEIGHT = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };

// ─── GET /log-report ──────────────────────────────────────────────────────────
router.get('/log-report', requireAuth, async (req, res) => {
  const userId = req._userId;
  const {
    type      = 'all',
    severity  = 'all',
    dateFrom,
    dateTo,
    search    = '',
    limit     = '200',
    page      = '1',
  } = req.query;

  const pageSize = Math.min(parseInt(limit) || 200, 500);
  const skip     = (Math.max(parseInt(page) || 1, 1) - 1) * pageSize;

  const dateFilter = {};
  if (dateFrom) dateFilter.$gte = new Date(dateFrom);
  if (dateTo)   dateFilter.$lte = new Date(new Date(dateTo).setHours(23, 59, 59, 999));
  const hasDate = Object.keys(dateFilter).length > 0;

  const entries = [];

  try {
    const wants = (t) => type === 'all' || type === t;

    // ── Findings ──────────────────────────────────────────────────────────────
    if (wants('finding')) {
      const q = { userId };
      if (hasDate) q.createdAt = dateFilter;
      const rows = await Finding.find(q).sort({ createdAt: -1 }).limit(500).lean();
      rows.forEach(r => entries.push({
        id:        r._id.toString(),
        type:      'finding',
        timestamp: r.createdAt,
        severity:  normSeverity(r.severity),
        title:     r.title || 'Security Finding',
        summary:   r.description?.slice(0, 150) || `${r.category || ''} — ${r.status}`,
        meta:      { category: r.category, status: r.status, scanType: r.scanType, sourceUrl: r.sourceUrl },
      }));
    }

    // ── Incidents ─────────────────────────────────────────────────────────────
    if (wants('incident')) {
      const q = { userId };
      if (hasDate) q.createdAt = dateFilter;
      const rows = await Incident.find(q).sort({ createdAt: -1 }).limit(200).lean();
      rows.forEach(r => entries.push({
        id:        r._id.toString(),
        type:      'incident',
        timestamp: r.createdAt,
        severity:  normSeverity(r.severity),
        title:     r.title || 'Security Incident',
        summary:   r.description?.slice(0, 150) || `Status: ${r.status}`,
        meta:      { category: r.category, status: r.status },
      }));
    }

    // ── Firewall Events ───────────────────────────────────────────────────────
    if (wants('firewall')) {
      const q = { userId };
      if (hasDate) q.createdAt = dateFilter;
      const rows = await FirewallEvent.find(q).sort({ createdAt: -1 }).limit(500).lean();
      rows.forEach(r => entries.push({
        id:        r._id.toString(),
        type:      'firewall',
        timestamp: r.createdAt,
        severity:  normSeverity(r.aiSeverity || (r.verdict === 'block' ? 'high' : 'info')),
        title:     `Firewall — ${r.verdict?.toUpperCase() || 'EVENT'}`,
        summary:   r.aiThreatType || `${r.sourceIp || 'unknown'} → ${r.targetUrl?.slice(0, 60) || ''}`,
        meta:      { verdict: r.verdict, sourceIp: r.sourceIp, targetUrl: r.targetUrl, matchedRuleName: r.matchedRuleName },
      }));
    }

    // ── Watch Alerts ──────────────────────────────────────────────────────────
    if (wants('watch')) {
      const q = { userId };
      if (hasDate) q.createdAt = dateFilter;
      const rows = await WatchAlert.find(q).sort({ createdAt: -1 }).limit(200).lean();
      rows.forEach(r => entries.push({
        id:        r._id.toString(),
        type:      'watch',
        timestamp: r.createdAt,
        severity:  normSeverity(r.severity),
        title:     `Watch Alert — ${r.hostname || r.url}`,
        summary:   r.summary?.slice(0, 150) || `Score: ${r.newScore}`,
        meta:      { url: r.url, newScore: r.newScore, scoreDelta: r.scoreDelta },
      }));
    }

    // ── Scan Logs (Red-Team + AI Agent) ───────────────────────────────────────
    if (wants('scan')) {
      const [rtRows, aiRows] = await Promise.all([
        RedTeamScanLog.find({ userId, ...(hasDate ? { createdAt: dateFilter } : {}) }).sort({ createdAt: -1 }).limit(100).lean(),
        AIAgentScanLog.find({ userId, ...(hasDate ? { createdAt: dateFilter } : {}) }).sort({ createdAt: -1 }).limit(100).lean(),
      ]);
      rtRows.forEach(r => entries.push({
        id:        r._id.toString(),
        type:      'scan',
        timestamp: r.createdAt,
        severity:  normSeverity(r.riskLevel),
        title:     `Red-Team Scan — ${r.targetUrl?.slice(0, 50)}`,
        summary:   r.summary?.slice(0, 150) || `Score: ${r.score ?? '?'}/100 · ${r.successfulAttacks ?? 0} attacks`,
        meta:      { score: r.score, riskLevel: r.riskLevel, status: r.status, totalProbes: r.totalProbes },
      }));
      aiRows.forEach(r => entries.push({
        id:        r._id.toString(),
        type:      'scan',
        timestamp: r.createdAt,
        severity:  normSeverity(r.riskLevel),
        title:     `AI Agent Scan (${r.scanType}) — ${r.endpointUrl?.slice(0, 40) || 'unknown'}`,
        summary:   r.summary?.slice(0, 150) || `Risk: ${r.riskLevel} · Score: ${r.score}`,
        meta:      { score: r.score, riskLevel: r.riskLevel, scanType: r.scanType },
      }));
    }

    // ── Login Events ──────────────────────────────────────────────────────────
    if (wants('login')) {
      const q = { userId };
      if (hasDate) q.timestamp = dateFilter;
      const rows = await LoginEvent.find(q).sort({ timestamp: -1 }).limit(200).lean();
      rows.forEach(r => entries.push({
        id:        r._id.toString(),
        type:      'login',
        timestamp: r.timestamp,
        severity:  r.success ? 'info' : 'medium',
        title:     r.success ? 'Login Successful' : 'Failed Login Attempt',
        summary:   `IP: ${r.ipAddress || 'unknown'} · ${r.location || ''}`,
        meta:      { ipAddress: r.ipAddress, userAgent: r.userAgent, location: r.location, success: r.success },
      }));
    }

    // ── Generic App Events ────────────────────────────────────────────────────
    if (wants('event')) {
      const q = { userId };
      if (hasDate) q.time = dateFilter;
      const rows = await Log.find(q).sort({ time: -1 }).limit(200).lean();
      rows.forEach(r => entries.push({
        id:        r._id.toString(),
        type:      'event',
        timestamp: r.time,
        severity:  'info',
        title:     r.event || 'App Event',
        summary:   r.site ? `Site: ${r.site}` : '',
        meta:      r.meta || {},
      }));
    }

    // ── Sort all by timestamp desc ────────────────────────────────────────────
    entries.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    // ── Severity filter ───────────────────────────────────────────────────────
    let filtered = severity === 'all' ? entries : entries.filter(e => e.severity === severity);

    // ── Search filter ─────────────────────────────────────────────────────────
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      filtered = filtered.filter(e =>
        e.title.toLowerCase().includes(q) || e.summary.toLowerCase().includes(q)
      );
    }

    const total = filtered.length;
    const paged = filtered.slice(skip, skip + pageSize);

    res.json({ entries: paged, total, page: parseInt(page), pageSize });
  } catch (err) {
    console.error('[LogReport]', err.message);
    res.status(500).json({ error: 'Failed to fetch logs.' });
  }
});

// ─── GET /log-report/stats ────────────────────────────────────────────────────
router.get('/log-report/stats', requireAuth, async (req, res) => {
  const userId = req._userId;
  try {
    const [findings, incidents, firewallBlocks, watchAlerts, scans, logins] = await Promise.all([
      Finding.countDocuments({ userId }),
      Incident.countDocuments({ userId }),
      FirewallEvent.countDocuments({ userId, verdict: 'block' }),
      WatchAlert.countDocuments({ userId }),
      Promise.all([
        RedTeamScanLog.countDocuments({ userId }),
        AIAgentScanLog.countDocuments({ userId }),
      ]).then(([a, b]) => a + b),
      LoginEvent.countDocuments({ userId, success: false }),
    ]);

    const criticalFindings  = await Finding.countDocuments({ userId, severity: 'critical' });
    const openIncidents     = await Incident.countDocuments({ userId, status: { $in: ['open', 'investigating'] } });

    res.json({ findings, incidents, firewallBlocks, watchAlerts, scans, failedLogins: logins, criticalFindings, openIncidents });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch stats.' });
  }
});

export default router;
