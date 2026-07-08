import express from 'express';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import Playbook from '../models/Playbook.js';
import PlaybookRun from '../models/PlaybookRun.js';
import { executePlaybook } from '../services/playbookEngine.js';

const router = express.Router();

const VALID_EVENT_TYPES = ['breach_detected', 'risk_score_critical', 'login_anomaly', 'site_degraded', 'finding_opened'];
const VALID_ACTIONS = ['send_email', 'send_slack', 'send_webhook', 'update_finding', 'create_incident', 'add_note', 'assign_finding', 'trigger_scan', 'push_alert'];

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

// GET /api/playbooks
router.get('/playbooks', authenticateToken, async (req, res) => {
  try {
    const { workspaceId } = req.query;
    const filter = { userId: req.user._id };
    if (workspaceId) filter.workspaceId = workspaceId;

    const playbooks = await Playbook.find(filter).sort({ createdAt: -1 }).lean();
    const result = playbooks.map(p => ({
      ...p,
      stepCount: (p.steps || []).length,
    }));
    res.json({ playbooks: result, total: result.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/playbooks
router.post('/playbooks', authenticateToken, async (req, res) => {
  try {
    const { name, description, enabled, workspaceId, trigger, steps } = req.body;

    if (!name?.trim()) return res.status(400).json({ error: 'name is required' });
    if (!trigger?.eventType) return res.status(400).json({ error: 'trigger.eventType is required' });
    if (!VALID_EVENT_TYPES.includes(trigger.eventType))
      return res.status(400).json({ error: `Invalid eventType. Must be one of: ${VALID_EVENT_TYPES.join(', ')}` });

    if (steps?.length) {
      for (const s of steps) {
        if (!VALID_ACTIONS.includes(s.action))
          return res.status(400).json({ error: `Invalid action '${s.action}'. Must be one of: ${VALID_ACTIONS.join(', ')}` });
      }
    }

    const playbook = await Playbook.create({
      name: name.trim(),
      description: description || '',
      enabled: enabled !== false,
      userId: req.user._id,
      workspaceId: workspaceId || null,
      trigger: { eventType: trigger.eventType, conditions: trigger.conditions || {} },
      steps: (steps || []).map((s, i) => ({
        order: s.order ?? i,
        action: s.action,
        params: s.params || {},
        label: s.label || s.action,
        continueOnError: s.continueOnError !== false,
      })),
    });

    res.status(201).json(playbook);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/playbooks/:id
router.get('/playbooks/:id', authenticateToken, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id))
      return res.status(400).json({ error: 'Invalid id' });

    const playbook = await Playbook.findOne({ _id: req.params.id, userId: req.user._id }).lean();
    if (!playbook) return res.status(404).json({ error: 'Playbook not found' });

    res.json(playbook);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/playbooks/:id
router.put('/playbooks/:id', authenticateToken, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id))
      return res.status(400).json({ error: 'Invalid id' });

    const { name, description, enabled, trigger, steps } = req.body;

    if (trigger?.eventType && !VALID_EVENT_TYPES.includes(trigger.eventType))
      return res.status(400).json({ error: 'Invalid eventType' });

    if (steps?.length) {
      for (const s of steps) {
        if (!VALID_ACTIONS.includes(s.action))
          return res.status(400).json({ error: `Invalid action '${s.action}'` });
      }
    }

    const update = {};
    if (name !== undefined) update.name = name.trim();
    if (description !== undefined) update.description = description;
    if (enabled !== undefined) update.enabled = enabled;
    if (trigger) update.trigger = { eventType: trigger.eventType, conditions: trigger.conditions || {} };
    if (steps) {
      update.steps = steps.map((s, i) => ({
        order: s.order ?? i,
        action: s.action,
        params: s.params || {},
        label: s.label || s.action,
        continueOnError: s.continueOnError !== false,
      }));
    }

    const playbook = await Playbook.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      update,
      { new: true }
    );
    if (!playbook) return res.status(404).json({ error: 'Playbook not found' });

    res.json(playbook);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/playbooks/:id/toggle
router.patch('/playbooks/:id/toggle', authenticateToken, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id))
      return res.status(400).json({ error: 'Invalid id' });

    const { enabled } = req.body;
    if (typeof enabled !== 'boolean')
      return res.status(400).json({ error: 'enabled must be a boolean' });

    const playbook = await Playbook.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      { enabled },
      { new: true }
    );
    if (!playbook) return res.status(404).json({ error: 'Playbook not found' });

    res.json({ _id: playbook._id, enabled: playbook.enabled });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/playbooks/:id
router.delete('/playbooks/:id', authenticateToken, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id))
      return res.status(400).json({ error: 'Invalid id' });

    const playbook = await Playbook.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
    if (!playbook) return res.status(404).json({ error: 'Playbook not found' });

    res.json({ deleted: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/playbooks/:id/run  — manual trigger
router.post('/playbooks/:id/run', authenticateToken, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id))
      return res.status(400).json({ error: 'Invalid id' });

    const playbook = await Playbook.findOne({ _id: req.params.id, userId: req.user._id }).lean();
    if (!playbook) return res.status(404).json({ error: 'Playbook not found' });

    const testPayload = req.body.testPayload || {};
    const context = { userId: String(req.user._id), eventType: 'manual' };

    // executePlaybook creates the run doc and returns its ID synchronously, then runs steps in background
    const runId = await executePlaybook(playbook, testPayload, context);
    res.status(202).json({ runId: String(runId), status: 'running' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/playbooks/:id/runs
router.get('/playbooks/:id/runs', authenticateToken, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id))
      return res.status(400).json({ error: 'Invalid id' });

    const playbook = await Playbook.findOne({ _id: req.params.id, userId: req.user._id }).lean();
    if (!playbook) return res.status(404).json({ error: 'Playbook not found' });

    const { page = 1, limit = 20 } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const [runs, total] = await Promise.all([
      PlaybookRun.find({ playbookId: req.params.id })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit))
        .lean(),
      PlaybookRun.countDocuments({ playbookId: req.params.id }),
    ]);

    res.json({ runs, total, page: Number(page) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
