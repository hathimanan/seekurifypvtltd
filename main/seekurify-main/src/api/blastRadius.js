import express from 'express';
import jwt from 'jsonwebtoken';
import Workspace from '../models/Workspace.js';
import Password from '../models/Password.js';
import passwordShare from '../models/passwordShare.js';
import Integration from '../models/Integration.js';

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

// GET /api/blast-radius
// Returns what an attacker would inherit if the current user's identity is compromised.
router.get('/blast-radius', auth, async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;

    const [workspaces, passwords, shares, integrations] = await Promise.all([
      Workspace.find({ $or: [{ owner: userId }, { 'members.userId': userId }] })
        .select('name owner members').lean(),
      Password.find({ userId }).select('website username isBreached breachCount strength').lean(),
      passwordShare.find({ createdBy: userId, expiresAt: { $gte: new Date() } })
        .select('metadata expiresAt oneTime used').lean(),
      Integration.find({ userId }).select('type name').lean(),
    ]);

    const activeShares       = shares.filter(s => !s.used);
    const highRiskPasswords  = passwords.filter(p => p.isBreached || p.strength === 'weak');

    // Severity of blast radius
    const severity =
      workspaces.length > 2 || passwords.length > 20 || integrations.length > 3 ? 'critical' :
      workspaces.length > 0 || passwords.length > 5                             ? 'high'     :
      passwords.length  > 0                                                      ? 'medium'   : 'low';

    // Human-readable summary of what's exposed
    const criticalAssets = [];
    if (passwords.length   > 0) criticalAssets.push(`${passwords.length} vault credential${passwords.length !== 1 ? 's' : ''}`);
    if (workspaces.length  > 0) criticalAssets.push(`${workspaces.length} workspace${workspaces.length !== 1 ? 's' : ''}`);
    if (integrations.length > 0) criticalAssets.push(`${integrations.length} integration${integrations.length !== 1 ? 's' : ''} (${[...new Set(integrations.map(i => i.type))].join(', ')})`);
    if (activeShares.length > 0) criticalAssets.push(`${activeShares.length} active shared link${activeShares.length !== 1 ? 's' : ''}`);

    res.json({
      severity,
      criticalAssets,
      workspaces: workspaces.map(w => ({
        id:          w._id,
        name:        w.name,
        isOwner:     String(w.owner) === String(userId),
        memberCount: w.members.length,
        yourRole:    w.members.find(m => String(m.userId) === String(userId))?.role || 'owner',
      })),
      vault: {
        total:       passwords.length,
        highRisk:    highRiskPasswords.length,
        credentials: passwords.slice(0, 20).map(p => ({
          website:   p.website,
          username:  p.username,
          isBreached: p.isBreached,
          strength:  p.strength,
        })),
      },
      activeShares: activeShares.map(s => ({
        website:   s.metadata?.website || 'Unknown',
        expiresAt: s.expiresAt,
        oneTime:   s.oneTime,
      })),
      integrations: integrations.map(i => ({ type: i.type, name: i.name })),
      reductionTips: buildReductionTips(workspaces, highRiskPasswords, activeShares, integrations, userId),
    });
  } catch (err) {
    console.error('[BlastRadius] error:', err.message);
    res.status(500).json({ error: 'Failed to load blast radius data' });
  }
});

function buildReductionTips(workspaces, highRiskPasswords, activeShares, integrations, userId) {
  const tips = [];
  if (highRiskPasswords.length > 0)
    tips.push(`Change ${highRiskPasswords.length} breached or weak password${highRiskPasswords.length !== 1 ? 's' : ''} immediately`);
  if (activeShares.length > 0)
    tips.push(`Review and revoke ${activeShares.length} active shared link${activeShares.length !== 1 ? 's' : ''}`);
  const largeWorkspaces = workspaces.filter(w => w.members.length > 5);
  if (largeWorkspaces.length > 0)
    tips.push(`${largeWorkspaces.length} workspace${largeWorkspaces.length !== 1 ? 's have' : ' has'} 5+ members — audit access`);
  if (integrations.length > 2)
    tips.push('Review and remove unused integrations to reduce your attack surface');
  const ownedWorkspaces = workspaces.filter(w => String(w.owner) === String(userId));
  if (ownedWorkspaces.length > 0)
    tips.push(`You own ${ownedWorkspaces.length} workspace${ownedWorkspaces.length !== 1 ? 's' : ''} — enable 2FA to protect them`);
  return tips;
}

export default router;
