import express from 'express';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import mongoose from 'mongoose';
import Integration from '../models/Integration.js';

const router = express.Router();

const INTEGRATION_SECRET = process.env.INTEGRATION_SECRET || 'seekurify-integration-secret-key!';
const SENSITIVE_KEYS = ['apiToken', 'webhookUrl', 'token', 'secret'];

function authenticateToken(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer '))
    return res.status(401).json({ error: 'Missing or invalid Authorization header' });
  try {
    req.user = jwt.verify(authHeader.split(' ')[1], process.env.JWT_SECRET);
    next();
  } catch {
    return res.status(403).json({ error: 'Invalid or expired token' });
  }
}

function encryptValue(plaintext) {
  try {
    const cipher = crypto.createCipher('aes-256-cbc', INTEGRATION_SECRET);
    let enc = cipher.update(plaintext, 'utf8', 'hex');
    enc += cipher.final('hex');
    return 'enc:' + enc;
  } catch {
    return plaintext;
  }
}

function decryptValue(value) {
  if (!value?.startsWith('enc:')) return value;
  try {
    const decipher = crypto.createDecipher('aes-256-cbc', INTEGRATION_SECRET);
    let dec = decipher.update(value.slice(4), 'hex', 'utf8');
    dec += decipher.final('utf8');
    return dec;
  } catch {
    return value;
  }
}

function encryptConfig(config) {
  const out = { ...config };
  for (const key of SENSITIVE_KEYS) {
    if (out[key] && typeof out[key] === 'string' && !out[key].startsWith('enc:')) {
      out[key] = encryptValue(out[key]);
    }
  }
  return out;
}

function maskConfig(config) {
  const out = { ...config };
  for (const key of SENSITIVE_KEYS) {
    if (out[key]) out[key] = '[stored]';
  }
  return out;
}

// GET /api/integrations
router.get('/integrations', authenticateToken, async (req, res) => {
  try {
    const filter = { userId: req.user._id };
    if (req.query.type) filter.type = req.query.type;

    const integrations = await Integration.find(filter).sort({ createdAt: -1 }).lean();
    const result = integrations.map(i => ({ ...i, config: maskConfig(i.config || {}) }));
    res.json({ integrations: result, total: result.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/integrations
router.post('/integrations', authenticateToken, async (req, res) => {
  try {
    const { name, type, config, workspaceId } = req.body;

    if (!name?.trim()) return res.status(400).json({ error: 'name is required' });
    if (!['slack', 'jira', 'webhook'].includes(type))
      return res.status(400).json({ error: 'type must be slack, jira, or webhook' });
    if (!config || typeof config !== 'object')
      return res.status(400).json({ error: 'config is required' });

    if (type === 'slack' && !config.webhookUrl)
      return res.status(400).json({ error: 'config.webhookUrl is required for Slack integrations' });
    if (type === 'jira' && (!config.host || !config.email || !config.apiToken || !config.projectKey))
      return res.status(400).json({ error: 'config.host, email, apiToken, and projectKey are required for Jira integrations' });
    if (type === 'webhook' && !config.url)
      return res.status(400).json({ error: 'config.url is required for webhook integrations' });

    const integration = await Integration.create({
      userId:      req.user._id,
      workspaceId: workspaceId || null,
      name:        name.trim(),
      type,
      config:      encryptConfig(config),
    });

    res.status(201).json({ ...integration.toObject(), config: maskConfig(integration.config || {}) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/integrations/:id
router.get('/integrations/:id', authenticateToken, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id))
      return res.status(400).json({ error: 'Invalid id' });

    const integration = await Integration.findOne({ _id: req.params.id, userId: req.user._id }).lean();
    if (!integration) return res.status(404).json({ error: 'Integration not found' });

    res.json({ ...integration, config: maskConfig(integration.config || {}) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/integrations/:id
router.put('/integrations/:id', authenticateToken, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id))
      return res.status(400).json({ error: 'Invalid id' });

    const existing = await Integration.findOne({ _id: req.params.id, userId: req.user._id });
    if (!existing) return res.status(404).json({ error: 'Integration not found' });

    const { name, config, enabled } = req.body;
    const update = {};
    if (name !== undefined) update.name = name.trim();
    if (enabled !== undefined) update.enabled = enabled;
    if (config !== undefined) {
      // Merge with existing config: keep encrypted values if not re-supplied
      const merged = { ...existing.config };
      for (const [k, v] of Object.entries(config)) {
        if (v === '[stored]' || v === '') continue; // skip masked placeholders
        merged[k] = v;
      }
      update.config = encryptConfig(merged);
    }

    const updated = await Integration.findByIdAndUpdate(req.params.id, update, { new: true }).lean();
    res.json({ ...updated, config: maskConfig(updated.config || {}) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/integrations/:id
router.delete('/integrations/:id', authenticateToken, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id))
      return res.status(400).json({ error: 'Invalid id' });

    const integration = await Integration.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
    if (!integration) return res.status(404).json({ error: 'Integration not found' });

    res.json({ deleted: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/integrations/:id/test
router.post('/integrations/:id/test', authenticateToken, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id))
      return res.status(400).json({ error: 'Invalid id' });

    const integration = await Integration.findOne({ _id: req.params.id, userId: req.user._id });
    if (!integration) return res.status(404).json({ error: 'Integration not found' });

    let ok = false;
    let message = '';

    try {
      if (integration.type === 'slack') {
        const url = decryptValue(integration.config?.webhookUrl);
        const r = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: '✅ Seekurify SOAR integration test — connection confirmed.' }),
        });
        ok = r.ok;
        message = ok ? 'Slack test message sent successfully.' : `Slack returned HTTP ${r.status}`;
      } else if (integration.type === 'jira') {
        const host = integration.config?.host;
        const email = integration.config?.email;
        const token = decryptValue(integration.config?.apiToken);
        const r = await fetch(`${host}/rest/api/3/myself`, {
          headers: { Authorization: 'Basic ' + Buffer.from(`${email}:${token}`).toString('base64') },
        });
        ok = r.ok;
        message = ok ? 'Jira connection verified.' : `Jira returned HTTP ${r.status}`;
      } else if (integration.type === 'webhook') {
        const url = integration.config?.url;
        const headers = integration.config?.headers || {};
        const r = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...headers },
          body: JSON.stringify({ test: true, source: 'seekurify-soar' }),
        });
        ok = r.ok;
        message = ok ? `Webhook responded with ${r.status}.` : `Webhook returned HTTP ${r.status}`;
      }
    } catch (testErr) {
      ok = false;
      message = testErr.message;
    }

    await Integration.findByIdAndUpdate(integration._id, {
      lastTestedAt:    new Date(),
      lastTestStatus:  ok ? 'ok' : 'failed',
      lastTestMessage: message,
    });

    res.json({ ok, message });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
