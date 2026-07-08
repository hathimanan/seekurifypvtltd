import express from 'express';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import ScanJob from '../models/ScanJob.js';
import { runScanForUser } from '../services/scanScheduler.js';

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

// GET /api/scan-jobs
router.get('/scan-jobs', authenticateToken, async (req, res) => {
  try {
    const { page = 1, limit = 20, status } = req.query;
    const filter = { userId: req.user._id };
    if (status) filter.status = status;

    const skip = (Number(page) - 1) * Number(limit);
    const [jobs, total] = await Promise.all([
      ScanJob.find(filter).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)).lean(),
      ScanJob.countDocuments(filter),
    ]);

    res.json({ jobs, total, page: Number(page) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/scan-jobs/:id
router.get('/scan-jobs/:id', authenticateToken, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id))
      return res.status(400).json({ error: 'Invalid id' });

    const job = await ScanJob.findOne({ _id: req.params.id, userId: req.user._id }).lean();
    if (!job) return res.status(404).json({ error: 'Scan job not found' });

    res.json(job);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/scan-jobs/run — manual trigger
router.post('/scan-jobs/run', authenticateToken, async (req, res) => {
  try {
    const jobId = await runScanForUser(req.user._id, 'manual');
    res.status(202).json({ jobId: String(jobId), status: 'running' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
