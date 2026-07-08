import express from 'express';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import Incident from '../models/Incident.js';
import User from '../models/User.ts';

const router = express.Router();

const VALID_STATUSES = ['open', 'investigating', 'contained', 'resolved', 'closed'];
const VALID_SEVERITIES = ['critical', 'high', 'medium', 'low'];

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

// GET /api/incidents
router.get('/incidents', authenticateToken, async (req, res) => {
  try {
    const { status, severity, category, page = 1, limit = 20 } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const filter = {
      $or: [{ userId: req.user._id }, { assignedTo: req.user._id }],
    };
    if (status) filter.status = status;
    if (severity) filter.severity = severity;
    if (category) filter.category = category;

    const [incidents, total] = await Promise.all([
      Incident.find(filter)
        .populate('assignedTo', 'name email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit))
        .lean(),
      Incident.countDocuments(filter),
    ]);

    const result = incidents.map(i => ({
      ...i,
      findingCount: (i.findingIds || []).length,
    }));

    res.json({ incidents: result, total, page: Number(page) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/incidents/stats
router.get('/incidents/stats', authenticateToken, async (req, res) => {
  try {
    const baseFilter = { $or: [{ userId: req.user._id }, { assignedTo: req.user._id }] };
    const counts = await Incident.aggregate([
      { $match: baseFilter },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);
    const stats = { open: 0, investigating: 0, contained: 0, resolved: 0, closed: 0 };
    for (const c of counts) stats[c._id] = c.count;
    res.json(stats);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/incidents
router.post('/incidents', authenticateToken, async (req, res) => {
  try {
    const { title, severity, description, category, workspaceId, dueDate } = req.body;

    if (!title?.trim()) return res.status(400).json({ error: 'title is required' });
    if (!severity) return res.status(400).json({ error: 'severity is required' });
    if (!VALID_SEVERITIES.includes(severity))
      return res.status(400).json({ error: `Invalid severity. Must be one of: ${VALID_SEVERITIES.join(', ')}` });

    const incident = await Incident.create({
      title: title.trim(),
      description: description || '',
      severity,
      userId: req.user._id,
      workspaceId: workspaceId || null,
      category: category || 'manual',
      dueDate: dueDate || undefined,
      timeline: [{ action: 'created', to: 'open', by: req.user._id, at: new Date() }],
    });

    res.status(201).json(incident);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/incidents/:id
router.get('/incidents/:id', authenticateToken, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id))
      return res.status(400).json({ error: 'Invalid id' });

    const incident = await Incident.findOne({
      _id: req.params.id,
      $or: [{ userId: req.user._id }, { assignedTo: req.user._id }],
    })
      .populate('assignedTo', 'name email')
      .populate('findingIds', 'title severity status category scanType')
      .lean();

    if (!incident) return res.status(404).json({ error: 'Incident not found' });
    res.json(incident);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/incidents/:id
router.put('/incidents/:id', authenticateToken, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id))
      return res.status(400).json({ error: 'Invalid id' });

    const incident = await Incident.findOne({ _id: req.params.id, userId: req.user._id });
    if (!incident) return res.status(404).json({ error: 'Incident not found' });

    const { status, severity, assignedToEmail, note, dueDate, title, description } = req.body;

    const timelineEntries = [];
    const update = {};

    if (status !== undefined) {
      if (!VALID_STATUSES.includes(status))
        return res.status(400).json({ error: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}` });
      if (status !== incident.status) {
        timelineEntries.push({ action: 'status_changed', from: incident.status, to: status, by: req.user._id, at: new Date() });
        update.status = status;
        if (status === 'resolved') update.resolvedAt = new Date();
      }
    }

    if (severity !== undefined) {
      if (!VALID_SEVERITIES.includes(severity))
        return res.status(400).json({ error: 'Invalid severity' });
      if (severity !== incident.severity) {
        timelineEntries.push({ action: 'severity_changed', from: incident.severity, to: severity, by: req.user._id, at: new Date() });
        update.severity = severity;
      }
    }

    if (assignedToEmail) {
      const assignee = await User.findOne({ email: assignedToEmail.toLowerCase() }).select('_id').lean();
      if (!assignee) return res.status(400).json({ error: 'User not found for assignment' });
      update.assignedTo = assignee._id;
      timelineEntries.push({ action: 'assigned', to: String(assignee._id), by: req.user._id, at: new Date() });
    }

    if (note) {
      timelineEntries.push({ action: 'note_added', note, by: req.user._id, at: new Date() });
    }

    if (title !== undefined) update.title = title.trim();
    if (description !== undefined) update.description = description;
    if (dueDate !== undefined) update.dueDate = dueDate;

    if (timelineEntries.length) {
      update.$push = { timeline: { $each: timelineEntries } };
    }

    const updated = await Incident.findByIdAndUpdate(req.params.id, update, { new: true })
      .populate('assignedTo', 'name email')
      .lean();

    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/incidents/:id
router.delete('/incidents/:id', authenticateToken, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id))
      return res.status(400).json({ error: 'Invalid id' });

    const incident = await Incident.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
    if (!incident) return res.status(404).json({ error: 'Incident not found' });

    res.json({ deleted: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/incidents/:id/findings  — attach a finding
router.post('/incidents/:id/findings', authenticateToken, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id))
      return res.status(400).json({ error: 'Invalid incident id' });

    const { findingId } = req.body;
    if (!findingId || !mongoose.isValidObjectId(findingId))
      return res.status(400).json({ error: 'Valid findingId is required' });

    const incident = await Incident.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      {
        $addToSet: { findingIds: findingId },
        $push: { timeline: { action: 'finding_added', to: findingId, by: req.user._id, at: new Date() } },
      },
      { new: true }
    ).populate('findingIds', 'title severity status').lean();

    if (!incident) return res.status(404).json({ error: 'Incident not found' });
    res.json(incident);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/incidents/:id/findings/:fid  — detach a finding
router.delete('/incidents/:id/findings/:fid', authenticateToken, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id) || !mongoose.isValidObjectId(req.params.fid))
      return res.status(400).json({ error: 'Invalid id' });

    const incident = await Incident.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      {
        $pull: { findingIds: new mongoose.Types.ObjectId(req.params.fid) },
        $push: { timeline: { action: 'finding_removed', to: req.params.fid, by: req.user._id, at: new Date() } },
      },
      { new: true }
    ).lean();

    if (!incident) return res.status(404).json({ error: 'Incident not found' });
    res.json({ removed: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
