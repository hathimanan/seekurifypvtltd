import express from 'express';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import Password, { decrypt } from '../models/Password.js';
import User from '../models/User.ts';
import { routeEvent } from '../services/triggerRouter.js';
import { createNotification } from '../utils/createNotification.js';
import { sendBreachAlertEmail } from '../emailService.js';
import Finding from '../models/Finding.js';

const hibpRouter = express.Router();

const HIBP_PASSWORD_API = 'https://api.pwnedpasswords.com/range';
const HIBP_BREACH_API = 'https://haveibeenpwned.com/api/v3/breachedaccount';
const USER_AGENT = 'Seekurify-PasswordManager/1.0';

function authenticateToken(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid Authorization header' });
  }
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch {
    return res.status(403).json({ error: 'Invalid or expired token' });
  }
}

// Fetch HIBP range for a given SHA-1 prefix and check if a suffix is present.
// Returns { isBreached, count } — never throws; returns isBreached=false on network errors.
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

// POST /api/hibp/check-password
// Body: { hashPrefix: "5-char hex" }
// Returns { suffixes: [{ suffix, count }] } — client-side k-anonymity lookup
hibpRouter.post('/check-password', async (req, res) => {
  const { hashPrefix } = req.body;
  if (!hashPrefix || typeof hashPrefix !== 'string' || !/^[A-Fa-f0-9]{5}$/.test(hashPrefix)) {
    return res.status(400).json({ error: 'hashPrefix must be exactly 5 hex characters' });
  }

  try {
    const response = await fetch(`${HIBP_PASSWORD_API}/${hashPrefix.toUpperCase()}`, {
      headers: { 'Add-Padding': 'true', 'User-Agent': USER_AGENT },
    });
    if (!response.ok) throw new Error(`HIBP status ${response.status}`);

    const text = await response.text();
    const suffixes = text
      .split('\r\n')
      .filter(Boolean)
      .map(line => {
        const [suffix, count] = line.split(':');
        return { suffix, count: parseInt(count, 10) };
      });

    res.json({ suffixes });
  } catch (err) {
    console.error('HIBP /check-password error:', err.message);
    res.status(502).json({ error: 'Failed to reach HIBP password API' });
  }
});

// POST /api/hibp/check-all
// Checks every stored password for the authenticated user against HIBP.
// Persists isBreached + breachCount on each Password document.
// Fires in-app notifications + email for credentials that are NEWLY breached.
// Returns: { results: [{ _id, isBreached, breachCount }] }
hibpRouter.post('/check-all', authenticateToken, async (req, res) => {
  const userId = req.user._id;

  try {
    const passwords = await Password.find({ userId }).lean();
    const results = [];

    for (const entry of passwords) {
      const plaintext = decrypt(entry.password);
      if (!plaintext) {
        results.push({ _id: entry._id, website: entry.website, username: entry.username, isBreached: false, breachCount: 0, wasAlreadyBreached: entry.isBreached ?? false });
        continue;
      }

      const sha1 = crypto.createHash('sha1').update(plaintext).digest('hex');
      const { isBreached, count } = await hibpRangeCheck(sha1);

      const updateFields = { isBreached, breachCount: count, breachCheckedAt: new Date() };

      // Auto-quarantine newly-breached credentials and any that reuse the same password
      if (isBreached && !entry.isBreached) {
        updateFields.quarantined      = true;
        updateFields.quarantineReason = `Found in ${count.toLocaleString()} breach record${count !== 1 ? 's' : ''} via HIBP scan`;
        updateFields.quarantinedAt    = new Date();

        // Find all passwords for this user that share the same plaintext (reuse chain)
        const otherPasswords = await Password.find({ userId, _id: { $ne: entry._id }, quarantined: { $ne: true } }).lean();
        const reuseIds = [];
        for (const other of otherPasswords) {
          const otherPlain = decrypt(other.password);
          if (otherPlain && otherPlain === plaintext) reuseIds.push(other._id);
        }
        if (reuseIds.length > 0) {
          await Password.updateMany({ _id: { $in: reuseIds } }, {
            $set: {
              quarantined: true,
              quarantineReason: `Reused password — linked credential for "${entry.website}" was found in a data breach`,
              quarantinedAt: new Date(),
            },
          });
        }
      }

      await Password.updateOne({ _id: entry._id }, { $set: updateFields });

      results.push({
        _id: entry._id,
        website: entry.website,
        username: entry.username,
        isBreached,
        breachCount: count,
        wasAlreadyBreached: entry.isBreached ?? false,
      });
    }

    // Fire alerts for credentials that are NEWLY compromised (false → true)
    const newlyBreached = results.filter(r => r.isBreached && !r.wasAlreadyBreached);

    // Fire SOAR triggers for all currently breached credentials — playbook minBreachCount condition decides
    const allBreached = results.filter(r => r.isBreached);
    for (const r of allBreached) {
      routeEvent('breach_detected', {
        website: r.website,
        username: r.username,
        breachCount: r.breachCount,
        passwordId: String(r._id),
      }, { userId: String(userId) }).catch(() => {});
    }

    if (newlyBreached.length > 0) {

      // In-app notification per newly breached credential
      const notificationPromises = newlyBreached.map(r =>
        createNotification({
          userId,
          message: `⚠️ ${r.website} password found in ${(r.breachCount || 0).toLocaleString()} data breach${(r.breachCount || 0) !== 1 ? 'es' : ''} — change it immediately`,
          type: 'error',
        }).catch(err => console.error('Notification create error:', err.message))
      );

      // Upsert Finding for every currently-breached credential (dedup by sourceScanId + category)
      const findingPromises = newlyBreached.map(r =>
        Finding.findOneAndUpdate(
          { userId, sourceScanId: r._id, category: 'Breached Credential' },
          {
            $setOnInsert: {
              title:       `Breached credential: ${r.website}`,
              description: `The password for "${r.website}" (username: ${r.username}) was found in ${(r.breachCount || 0).toLocaleString()} known data breach record${r.breachCount !== 1 ? 's' : ''}. Change this password immediately.`,
              evidence:    `Source: HaveIBeenPwned (k-anonymity SHA-1 check)\nBreach appearances: ${(r.breachCount || 0).toLocaleString()}`,
              scanType:    'manual',
              sourceUrl:   r.website,
              status:      'open',
              timeline:    [{ action: 'created', to: 'open', by: userId, at: new Date() }],
            },
            $set: { severity: (r.breachCount || 0) > 100_000 ? 'critical' : 'high' },
          },
          { upsert: true, new: true }
        ).catch(err => console.error('Breach finding upsert error:', err.message))
      );

      // Email alert (fire-and-forget — don't block the response)
      const emailPromise = (async () => {
        try {
          const user = await User.findById(userId).select('email').lean();
          if (user?.email) {
            await sendBreachAlertEmail(user.email, { credentials: newlyBreached });
          }
        } catch (err) {
          console.error('Breach alert email error:', err.message);
        }
      })();

      // Run all in parallel without blocking response
      Promise.all([...notificationPromises, ...findingPromises, emailPromise]).catch(() => {});
    }

    res.json({ results, newlyBreachedCount: newlyBreached.length });
  } catch (err) {
    console.error('HIBP /check-all error:', err.message);
    res.status(500).json({ error: 'Server error during breach check' });
  }
});

// GET /api/hibp/check-email
// Checks the authenticated user's email against HIBP breached accounts.
// Requires HIBP_API_KEY env variable.
// Returns: { breaches: [{ Name, Title, BreachDate, PwnCount, DataClasses }] }
hibpRouter.get('/check-email', authenticateToken, async (req, res) => {
  const HIBP_API_KEY = process.env.HIBP_API_KEY;
  if (!HIBP_API_KEY) {
    return res.status(503).json({ error: 'HIBP email check not configured (missing HIBP_API_KEY)' });
  }

  try {
    const user = await User.findById(req.user._id).select('email').lean();
    if (!user?.email) {
      return res.status(404).json({ error: 'User not found' });
    }

    const response = await fetch(
      `${HIBP_BREACH_API}/${encodeURIComponent(user.email)}?truncateResponse=false`,
      {
        headers: {
          'hibp-api-key': HIBP_API_KEY,
          'User-Agent': USER_AGENT,
        },
      }
    );

    if (response.status === 404) return res.json({ breaches: [] });

    if (response.status === 401) {
      console.error('HIBP API key rejected');
      return res.status(503).json({ error: 'HIBP service unavailable — invalid API key' });
    }

    if (!response.ok) throw new Error(`HIBP status ${response.status}`);

    const raw = await response.json();
    const breaches = raw.map(b => ({
      Name: b.Name,
      Title: b.Title,
      BreachDate: b.BreachDate,
      PwnCount: b.PwnCount,
      DataClasses: b.DataClasses,
    }));

    res.json({ breaches });
  } catch (err) {
    console.error('HIBP /check-email error:', err.message);
    res.status(502).json({ error: 'Failed to reach HIBP breach API' });
  }
});

// POST /api/hibp/workspace-scan
// Scans every workspace member email against HIBP breached accounts.
// Requires HIBP_API_KEY. Creates Findings and fires SOAR triggers for hits.
hibpRouter.post('/workspace-scan', authenticateToken, async (req, res) => {
  const HIBP_API_KEY = process.env.HIBP_API_KEY;
  if (!HIBP_API_KEY) {
    return res.status(503).json({ error: 'HIBP email check not configured (missing HIBP_API_KEY)' });
  }

  const { workspaceId } = req.body;
  if (!workspaceId) return res.status(400).json({ error: 'workspaceId is required' });

  try {
    const Workspace = (await import('../models/Workspace.js')).default;
    const workspace = await Workspace.findById(workspaceId).lean();
    if (!workspace) return res.status(404).json({ error: 'Workspace not found' });

    const callerId = req.user._id || req.user.id;
    const isAdmin =
      String(workspace.owner) === String(callerId) ||
      workspace.members.some(m => String(m.userId) === String(callerId) && m.role === 'admin');

    if (!isAdmin) return res.status(403).json({ error: 'Only workspace admins can run this scan' });

    const memberIds = [workspace.owner, ...workspace.members.map(m => m.userId)];
    const members   = await User.find({ _id: { $in: memberIds } }).select('email').lean();

    const results = [];

    for (const member of members) {
      try {
        const response = await fetch(
          `${HIBP_BREACH_API}/${encodeURIComponent(member.email)}?truncateResponse=false`,
          { headers: { 'hibp-api-key': HIBP_API_KEY, 'User-Agent': USER_AGENT } }
        );

        if (response.status === 404) {
          results.push({ email: member.email, breaches: [], breachCount: 0 });
        } else if (!response.ok) {
          results.push({ email: member.email, breaches: [], breachCount: 0, error: true });
        } else {
          const raw = await response.json();
          const breaches = raw.map(b => ({ Name: b.Name, BreachDate: b.BreachDate, DataClasses: b.DataClasses }));
          results.push({ email: member.email, breaches, breachCount: breaches.length });

          if (breaches.length > 0) {
            routeEvent('breach_detected', { email: member.email, breachCount: breaches.length }, { userId: String(callerId) }).catch(() => {});
            Finding.findOneAndUpdate(
              { userId: callerId, sourceScanId: workspaceId, category: 'Workspace Credential Exposure', title: `Breached workspace member: ${member.email}` },
              {
                $setOnInsert: {
                  description: `${member.email} appears in ${breaches.length} known breach${breaches.length !== 1 ? 'es' : ''}`,
                  severity:    breaches.length > 5 ? 'critical' : 'high',
                  scanType:    'manual',
                  status:      'open',
                  evidence:    `Breaches: ${breaches.map(b => b.Name).join(', ')}`,
                  timeline:    [{ action: 'created', to: 'open', by: callerId, at: new Date() }],
                },
              },
              { upsert: true }
            ).catch(() => {});
          }
        }
      } catch {
        results.push({ email: member.email, breaches: [], breachCount: 0, error: true });
      }

      // HIBP rate limit: 1 request per 1.5 seconds
      await new Promise(r => setTimeout(r, 1500));
    }

    res.json({
      results,
      scannedCount:  members.length,
      breachedCount: results.filter(r => r.breachCount > 0).length,
    });
  } catch (err) {
    console.error('HIBP /workspace-scan error:', err.message);
    res.status(500).json({ error: 'Server error during workspace scan' });
  }
});

export default hibpRouter;
