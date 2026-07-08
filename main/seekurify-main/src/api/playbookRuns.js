import express from 'express';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import PlaybookRun from '../models/PlaybookRun.js';

const router = express.Router();

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

// GET /api/playbook-runs
router.get('/playbook-runs', authenticateToken, async (req, res) => {
  try {
    const { playbookId, status, page = 1, limit = 20 } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const filter = { userId: req.user._id };
    if (playbookId && mongoose.isValidObjectId(playbookId)) filter.playbookId = playbookId;
    if (status) filter.status = status;

    const [runs, total] = await Promise.all([
      PlaybookRun.find(filter)
        .populate('playbookId', 'name')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit))
        .lean(),
      PlaybookRun.countDocuments(filter),
    ]);

    res.json({ runs, total, page: Number(page) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/playbook-runs/:id
router.get('/playbook-runs/:id', authenticateToken, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id))
      return res.status(400).json({ error: 'Invalid id' });

    const run = await PlaybookRun.findOne({ _id: req.params.id, userId: req.user._id })
      .populate('playbookId', 'name trigger')
      .lean();

    if (!run) return res.status(404).json({ error: 'Run not found' });
    res.json(run);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
