import crypto from 'crypto';
import express from 'express';
import jwt from 'jsonwebtoken';
import ScannerApiKey from '../models/ScannerApiKey.js';

const router = express.Router();
const DEFAULT_SCOPE = 'injection-scan';

function extractJwtUserId(req) {
  try {
    const auth = req.headers.authorization;
    if (!auth?.startsWith('Bearer ')) return null;
    const token = auth.split(' ')[1];
    if (!token || token.startsWith('sk_')) return null;
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    return decoded.id ?? decoded.userId ?? decoded._id ?? null;
  } catch (_) {
    return null;
  }
}

function requireUserAuth(req, res, next) {
  const userId = extractJwtUserId(req);
  if (!userId) {
    return res.status(401).json({ error: 'Authentication required.' });
  }

  req._userId = userId;
  next();
}

function createRawApiKey() {
  return `sk_live_${crypto.randomBytes(24).toString('hex')}`;
}

router.get('/scanner-api-keys', requireUserAuth, async (req, res) => {
  try {
    const apiKeys = await ScannerApiKey.find({ userId: req._userId })
      .sort({ createdAt: -1 })
      .select('name keyPrefix last4 scopes lastUsedAt revokedAt createdAt')
      .lean();

    res.json({ apiKeys });
  } catch (error) {
    console.error('Failed to list scanner API keys:', error);
    res.status(500).json({ error: 'Failed to load API keys.' });
  }
});

router.post('/scanner-api-keys', requireUserAuth, async (req, res) => {
  try {
    const name = String(req.body?.name ?? '').trim();

    if (!name) {
      return res.status(400).json({ error: 'API key name is required.' });
    }

    const rawKey = createRawApiKey();
    const apiKey = await ScannerApiKey.create({
      userId: req._userId,
      name,
      keyPrefix: rawKey.slice(0, 15),
      keyHash: ScannerApiKey.hashKey(rawKey),
      last4: rawKey.slice(-4),
      scopes: [DEFAULT_SCOPE],
    });

    res.status(201).json({
      message: 'API key created. Store it now; it will not be shown again.',
      apiKey: {
        id: apiKey._id,
        name: apiKey.name,
        keyPrefix: apiKey.keyPrefix,
        last4: apiKey.last4,
        scopes: apiKey.scopes,
        createdAt: apiKey.createdAt,
      },
      rawKey,
      usage: {
        header: 'x-api-key',
        endpoint: '/api/injection-scan',
      },
    });
  } catch (error) {
    console.error('Failed to create scanner API key:', error);
    res.status(500).json({ error: 'Failed to create API key.' });
  }
});

router.delete('/scanner-api-keys/:id', requireUserAuth, async (req, res) => {
  try {
    const revoked = await ScannerApiKey.findOneAndUpdate(
      { _id: req.params.id, userId: req._userId, revokedAt: null },
      { $set: { revokedAt: new Date() } },
      { new: true }
    ).select('_id');

    if (!revoked) {
      return res.status(404).json({ error: 'API key not found.' });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Failed to revoke scanner API key:', error);
    res.status(500).json({ error: 'Failed to revoke API key.' });
  }
});

export default router;
