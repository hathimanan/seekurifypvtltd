import express from 'express';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import Password, { decrypt } from '../models/Password.js';
import User from '../models/User.ts';
import { routeEvent } from '../services/triggerRouter.js';
import {
  scoreCredential,
  enrichWithAI,
  MOCK_CREDENTIALS,
} from '../AI/credentialRiskScorer.ts';
import { createNotification } from '../utils/createNotification.js';
import { sendHighRiskAlertEmail } from '../emailService.js';
import Finding from '../models/Finding.js';

const riskScoreRouter = express.Router();

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

// Count character-class diversity of a plaintext password (0-4)
function strengthScore(password) {
  let s = 0;
  if (/[a-z]/.test(password)) s++;
  if (/[A-Z]/.test(password)) s++;
  if (/[0-9]/.test(password)) s++;
  if (/[^a-zA-Z0-9]/.test(password)) s++;
  return s;
}

// POST /api/risk-score/score-all
// Scores every stored credential for the authenticated user.
// Returns { results: RiskScoreResult[] }
riskScoreRouter.post('/score-all', authenticateToken, async (req, res) => {
  const userId = req.user._id;

  try {
    const entries = await Password.find({ userId }).lean();
    if (entries.length === 0) return res.json({ results: [] });

    // Decrypt all passwords once; build a SHA-256 frequency map for reuse detection
    const plaintexts = entries.map(e => decrypt(e.password) ?? '');
    const hashFreq = new Map();
    plaintexts.forEach(pt => {
      if (!pt) return;
      const h = crypto.createHash('sha256').update(pt).digest('hex');
      hashFreq.set(h, (hashFreq.get(h) ?? 0) + 1);
    });

    const batch = entries.map((entry, i) => {
      const pt = plaintexts[i];
      const h = pt ? crypto.createHash('sha256').update(pt).digest('hex') : null;
      const reuseCount = h ? Math.max(0, (hashFreq.get(h) ?? 1) - 1) : 0;

      const meta = {
        _id: String(entry._id),
        website: entry.website ?? '',
        username: entry.username ?? '',
        category: entry.category ?? 'General',
        isFinancial: entry.isFinancial ?? false,
        lastChanged: entry.lastChanged ?? null,
        isBreached: entry.isBreached ?? false,
        breachCount: entry.breachCount ?? 0,
        passwordLength: pt.length,
        passwordStrengthScore: pt ? strengthScore(pt) : 0,
        reuseCount,
      };

      return { meta, partial: scoreCredential(meta) };
    });

    const results = await enrichWithAI(batch);

    // Persist scores + fire alerts — all async, don't block the response
    const urgentResults = results.filter(r => r.level === 'critical' || r.level === 'high');
    const findingResults = results.filter(r => ['critical', 'high', 'medium'].includes(r.level));

    // Fire SOAR triggers for all non-safe credentials — playbook scoreThreshold condition decides
    const triggerResults = results.filter(r => r.level !== 'safe');
    for (const r of triggerResults) {
      const entry = entries.find(e => String(e._id) === r._id);
      routeEvent('risk_score_critical', {
        website: entry?.website ?? '',
        username: entry?.username ?? '',
        score: r.score,
        level: r.level,
        summary: r.summary,
        passwordId: r._id,
      }, { userId: String(userId) }).catch(() => {});
    }

    Promise.all([
      // Persist scores to DB
      ...results.map(r =>
        Password.updateOne(
          { _id: r._id },
          { $set: { riskScore: r.score, riskLevel: r.level, riskScoredAt: new Date() } }
        )
      ),
      // In-app notification per critical/high credential
      ...urgentResults.map(r => {
        const entry = entries.find(e => String(e._id) === r._id);
        const label = r.level === 'critical' ? '🔴 Critical' : '🟠 High';
        return createNotification({
          userId,
          message: `${label} risk: ${entry?.website ?? r._id} scored ${r.score}/100 — ${r.summary || r.reasons?.[0] || 'review recommended'}`,
          type: r.level === 'critical' ? 'error' : 'warning',
        }).catch(err => console.error('Risk notification error:', err.message));
      }),
      // Single summary email if there are any urgent credentials
      urgentResults.length > 0
        ? (async () => {
            try {
              const user = await User.findById(userId).select('email').lean();
              if (user?.email) {
                const emailPayload = urgentResults.map(r => {
                  const entry = entries.find(e => String(e._id) === r._id);
                  return {
                    website: entry?.website ?? r._id,
                    username: entry?.username ?? '',
                    score: r.score,
                    level: r.level,
                    summary: r.summary,
                  };
                });
                await sendHighRiskAlertEmail(user.email, { credentials: emailPayload });
              }
            } catch (err) {
              console.error('Risk alert email error:', err.message);
            }
          })()
        : Promise.resolve(),
    ]).catch(err => console.error('Risk score async pipeline error:', err.message));

    // Upsert Findings for critical/high/medium credentials — awaited so the board reflects immediately
    await Promise.all(findingResults.map(async r => {
      const entry = entries.find(e => String(e._id) === r._id);
      try {
        await Finding.findOneAndUpdate(
          { userId, sourceScanId: entry?._id ?? null, category: 'High Risk Credential' },
          {
            $setOnInsert: {
              title:    `High-risk credential: ${entry?.website ?? r._id}`,
              scanType: 'manual',
              sourceUrl: entry?.website ?? '',
              status:   'open',
              timeline: [{ action: 'created', to: 'open', by: userId, at: new Date() }],
            },
            $set: {
              description: `Risk score ${r.score}/100 (${r.level}) for "${entry?.website ?? 'unknown'}" (username: "${entry?.username ?? 'unknown'}").\n\n${r.summary}`,
              evidence:    r.reasons?.join('\n') ?? '',
              severity:    r.level === 'medium' ? 'medium' : r.level,
            },
          },
          { upsert: true, new: true }
        );
      } catch (err) {
        console.error('[Risk] Finding upsert error:', err.message);
      }
    }));

    res.json({ results });
  } catch (err) {
    console.error('Risk score /score-all error:', err);
    res.status(500).json({ error: 'Server error during risk scoring' });
  }
});

// GET /api/risk-score/test
// Runs the scorer against 10 mock credential sets — verifies rubric correctness.
// Development/demo only; does not touch any real user data.
riskScoreRouter.get('/test', async (req, res) => {
  try {
    const batch = MOCK_CREDENTIALS.map(meta => ({ meta, partial: scoreCredential(meta) }));
    const results = await enrichWithAI(batch);
    res.json({
      note: 'Mock test results — no real user data involved',
      results: results.map(r => ({
        website: MOCK_CREDENTIALS.find(m => m._id === r._id)?.website,
        score: r.score,
        level: r.level,
        factors: r.factors,
        topReason: r.reasons[0] ?? null,
        summary: r.summary,
      })),
    });
  } catch (err) {
    console.error('Risk score /test error:', err);
    res.status(500).json({ error: 'Test run failed' });
  }
});

export default riskScoreRouter;
