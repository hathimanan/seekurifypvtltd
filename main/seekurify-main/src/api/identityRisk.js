import express from 'express';
import jwt from 'jsonwebtoken';
import LoginEvent from '../models/LoginEvent.model.js';
import DeviceFingerprint from '../models/DeviceFingerprint.js';
import UserLoginBaseline from '../models/UserLoginBaseline.js';
import Password from '../models/Password.js';

const router = express.Router();

function auth(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    res.status(403).json({ error: 'Invalid or expired token' });
  }
}

// GET /api/identity-risk
// Returns the current user's identity risk score, known devices, and recent anomaly signals.
router.get('/identity-risk', auth, async (req, res) => {
  try {
    const userId  = req.user._id || req.user.id;
    const now     = new Date();
    const last24h = new Date(now - 24 * 3_600_000);
    const last30d = new Date(now - 30 * 24 * 3_600_000);

    const [devices, baseline, failedLast24h, recentLogins, passwords] = await Promise.all([
      DeviceFingerprint.find({ userId }).sort({ lastSeen: -1 }).limit(20).lean(),
      UserLoginBaseline.findOne({ userId }).lean(),
      LoginEvent.countDocuments({ userId, success: false, timestamp: { $gte: last24h } }),
      LoginEvent.find({ userId }).sort({ timestamp: -1 }).limit(10).lean(),
      Password.find({ userId }).select('isBreached breachCount strength reused website username').lean(),
    ]);

    const breachedPasswords = passwords.filter(p => p.isBreached).length;
    const weakPasswords     = passwords.filter(p => p.strength === 'weak').length;
    const reusedPasswords   = passwords.filter(p => p.reused).length;
    const newDevices30d     = devices.filter(d => new Date(d.firstSeen) >= last30d).length;

    // Composite identity risk score — higher = more risk
    let riskScore = 0;
    if (failedLast24h >= 5) riskScore += 30;
    else if (failedLast24h >= 2) riskScore += 15;
    riskScore += Math.min(breachedPasswords * 20, 40);
    riskScore += Math.min(weakPasswords     * 8,  20);
    riskScore += Math.min(reusedPasswords   * 5,  10);
    if (newDevices30d > 3) riskScore += 15;
    riskScore = Math.min(riskScore, 100);

    const riskLevel =
      riskScore >= 70 ? 'critical' :
      riskScore >= 40 ? 'high'     :
      riskScore >= 20 ? 'medium'   : 'low';

    res.json({
      riskScore,
      riskLevel,
      devices: devices.slice(0, 10).map(d => ({
        label:     d.label     || 'Unknown Device',
        userAgent: d.userAgent || '',
        firstSeen: d.firstSeen,
        lastSeen:  d.lastSeen,
        isNew:     new Date(d.firstSeen) >= last30d,
      })),
      knownCountries:    baseline?.knownCountries || [],
      lastLoginAt:       baseline?.lastLoginAt    || null,
      lastLoginCountry:  baseline?.lastLoginCountry || null,
      failedAttemptsLast24h: failedLast24h,
      recentLogins: recentLogins.map(e => ({
        success:   e.success,
        ip:        e.ipAddress,
        location:  e.location  || null,
        userAgent: e.userAgent || '',
        at:        e.timestamp,
      })),
      passwordHealth: {
        total:    passwords.length,
        breached: breachedPasswords,
        weak:     weakPasswords,
        reused:   reusedPasswords,
      },
    });
  } catch (err) {
    console.error('[IdentityRisk] error:', err.message);
    res.status(500).json({ error: 'Failed to load identity risk data' });
  }
});

export default router;
