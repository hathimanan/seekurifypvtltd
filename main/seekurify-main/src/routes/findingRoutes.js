import express from 'express';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import Finding from '../models/Finding.js';
import User from '../models/User.ts';
import { routeEvent } from '../services/triggerRouter.js';

const router = express.Router();

// ─── Auth middleware ──────────────────────────────────────────────────────────
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

// Helper: resolve which model to query based on scanType
async function fetchSourceScanTitle(scanType, sourceScanId) {
  if (!sourceScanId) return null;
  try {
    const modelMap = {
      redteam: (await import('../models/RedTeamScanLog.js')).default,
      injection: (await import('../models/InjectionScanLog.js')).default,
      siteaudit: (await import('../models/SiteAuditLog.js')).default,
      pii: (await import('../models/PIIScanLog.js')).default,
      aiagent: (await import('../models/AIAgentScanLog.js')).default,
    };
    const Model = modelMap[scanType];
    if (!Model) return null;
    const doc = await Model.findById(sourceScanId).lean();
    return doc;
  } catch {
    return null;
  }
}

// ─── List findings ────────────────────────────────────────────────────────────
// GET /api/findings
// Query params: status, severity, scanType, assignedTo, workspaceId, page, limit
router.get('/findings', authenticateToken, async (req, res) => {
  try {
    const { status, severity, scanType, assignedTo, workspaceId, page = 1, limit = 50 } = req.query;

    const filter = {
      $or: [
        { userId: req.user._id },
        { assignedTo: req.user._id },
      ],
    };

    if (status) filter.status = status;
    if (severity) filter.severity = severity;
    if (scanType) filter.scanType = scanType;
    if (assignedTo) filter.assignedTo = assignedTo;
    if (workspaceId) filter.workspaceId = workspaceId;

    const [findings, total] = await Promise.all([
      Finding.find(filter)
        .populate('assignedTo', 'name email profileImage')
        .populate('userId', 'name email')
        .sort({ createdAt: -1 })
        .skip((Number(page) - 1) * Number(limit))
        .limit(Number(limit))
        .lean(),
      Finding.countDocuments(filter),
    ]);

    res.json({ findings, total, page: Number(page), limit: Number(limit) });
  } catch {
    res.status(500).json({ error: 'Failed to fetch findings' });
  }
});

// GET /api/findings/stats — summary counts for dashboard widgets
router.get('/findings/stats', authenticateToken, async (req, res) => {
  try {
    const { workspaceId } = req.query;
    const userObjectId = new mongoose.Types.ObjectId(req.user._id);
    const base = workspaceId
      ? { workspaceId }
      : { $or: [{ userId: userObjectId }, { assignedTo: userObjectId }] };

    const [byStatus, bySeverity] = await Promise.all([
      Finding.aggregate([
        { $match: base },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
      Finding.aggregate([
        { $match: { ...base, status: { $nin: ['resolved', 'ignored'] } } },
        { $group: { _id: '$severity', count: { $sum: 1 } } },
      ]),
    ]);

    const statusMap = Object.fromEntries(byStatus.map(s => [s._id, s.count]));
    const severityMap = Object.fromEntries(bySeverity.map(s => [s._id, s.count]));

    res.json({
      total: Object.values(statusMap).reduce((a, b) => a + b, 0),
      open: statusMap.open || 0,
      acknowledged: statusMap.acknowledged || 0,
      in_progress: statusMap.in_progress || 0,
      to_be_retested: statusMap.to_be_retested || 0,
      resolved: statusMap.resolved || 0,
      ignored: statusMap.ignored || 0,
      critical: severityMap.critical || 0,
      high: severityMap.high || 0,
      medium: severityMap.medium || 0,
      low: severityMap.low || 0,
    });
  } catch {
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// GET /api/findings/:id
router.get('/findings/:id', authenticateToken, async (req, res) => {
  try {
    const finding = await Finding.findById(req.params.id)
      .populate('userId', 'name email profileImage')
      .populate('assignedTo', 'name email profileImage')
      .populate('timeline.by', 'name email profileImage')
      .lean();

    if (!finding) return res.status(404).json({ error: 'Finding not found' });

    // Access check — creator or assignee
    const userId = req.user._id.toString();
    if (finding.userId._id.toString() !== userId && finding.assignedTo?._id?.toString() !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json(finding);
  } catch {
    res.status(500).json({ error: 'Failed to fetch finding' });
  }
});

// ─── Create finding (manual) ─────────────────────────────────────────────────
// POST /api/findings
router.post('/findings', authenticateToken, async (req, res) => {
  const { title, description, severity, category, evidence, sourceUrl, remediationNotes, fixSnippet, dueDate, workspaceId } = req.body;

  if (!title?.trim()) return res.status(400).json({ error: 'Title is required' });
  if (!severity) return res.status(400).json({ error: 'Severity is required' });

  try {
    const finding = await Finding.create({
      title: title.trim(),
      description,
      severity,
      category,
      evidence,
      sourceUrl,
      remediationNotes,
      fixSnippet,
      dueDate: dueDate ? new Date(dueDate) : undefined,
      workspaceId: workspaceId || null,
      userId: req.user._id,
      scanType: 'manual',
      timeline: [{ action: 'created', to: 'open', by: req.user._id }],
    });

    await finding.populate('userId', 'name email');

    if (['critical', 'high'].includes(finding.severity)) {
      routeEvent('finding_opened', {
        findingId: String(finding._id),
        title: finding.title,
        severity: finding.severity,
        category: finding.category,
        scanType: finding.scanType,
        sourceUrl: finding.sourceUrl,
      }, { userId: String(req.user._id), findingId: String(finding._id) }).catch(() => {});
    }

    res.status(201).json(finding);
  } catch {
    res.status(500).json({ error: 'Failed to create finding' });
  }
});

// ─── Import finding from a scan result ───────────────────────────────────────
// POST /api/findings/from-scan
// Body: { scanType, sourceScanId, findingIndex, title?, severity?, workspaceId? }
router.post('/findings/from-scan', authenticateToken, async (req, res) => {
  const { scanType, sourceScanId, findingIndex, workspaceId } = req.body;

  if (!scanType || !sourceScanId) return res.status(400).json({ error: 'scanType and sourceScanId are required' });

  // Check not already tracked
  const existing = await Finding.findOne({ sourceScanId, ...(findingIndex !== undefined ? {} : {}) }).lean();
  if (existing && findingIndex === undefined) {
    return res.status(409).json({ error: 'This scan result is already tracked', findingId: existing._id });
  }

  const doc = await fetchSourceScanTitle(scanType, sourceScanId);
  if (!doc) return res.status(404).json({ error: 'Source scan not found' });

  // Verify ownership of the source scan
  if (doc.userId?.toString() !== req.user._id.toString()) {
    return res.status(403).json({ error: 'You do not own this scan result' });
  }

  let title, description, severity, category, evidence, sourceUrl, fixSnippet;

  // Extract relevant data based on scan type
  if (scanType === 'redteam') {
    sourceUrl = doc.targetUrl;
    if (findingIndex !== undefined && doc.findings?.[findingIndex]) {
      const f = doc.findings[findingIndex];
      title = `[Red Team] ${f.category}`;
      description = f.description;
      severity = f.severity;
      category = f.category;
      evidence = f.succeeded ? `✅ Attack succeeded\n\nPayload: ${f.payload}\n\nEvidence: ${f.evidence}` : `❌ Attack failed\n\nPayload: ${f.payload}`;
    } else {
      title = `Red Team Scan — ${doc.targetUrl}`;
      description = doc.summary;
      severity = doc.riskLevel === 'clean' ? 'low' : doc.riskLevel;
      category = 'AI Red Team';
      evidence = `${doc.successfulAttacks}/${doc.totalProbes} attacks succeeded`;
    }
  } else if (scanType === 'injection') {
    if (findingIndex !== undefined && doc.findings?.[findingIndex]) {
      const f = doc.findings[findingIndex];
      title = `[Injection] ${f.category}`;
      description = f.description;
      severity = f.severity;
      category = f.category;
      evidence = f.matchedText ? `Matched: "${f.matchedText}"` : undefined;
      fixSnippet = f.remediation || f.codefix;
    } else {
      title = `Injection Scan — ${doc.inputSummary?.slice(0, 60) || 'unknown input'}`;
      description = `Risk level: ${doc.riskLevel}, Score: ${doc.score}/100`;
      severity = doc.riskLevel === 'clean' ? 'info' : doc.riskLevel;
      category = 'Prompt Injection';
    }
  } else if (scanType === 'siteaudit') {
    sourceUrl = doc.url;
    if (findingIndex !== undefined && doc.findings?.[findingIndex]) {
      const f = doc.findings[findingIndex];
      title = `[Site Audit] ${f.message}`;
      description = f.message;
      severity = f.severity === 'warning' ? 'medium' : f.severity === 'info' ? 'low' : f.severity;
      category = f.category;
    } else {
      title = `Site Audit — ${doc.hostname}`;
      description = `Grade: ${doc.grade}, Score: ${doc.score}/100. ${doc.findings?.length || 0} findings detected.`;
      severity = doc.grade === 'F' ? 'critical' : doc.grade === 'D' ? 'high' : doc.grade === 'C' ? 'medium' : 'low';
      category = 'Site Security';
    }
  } else if (scanType === 'pii') {
    title = `PII Detected — ${doc.label || 'Unnamed scan'}`;
    description = doc.summary;
    severity = doc.riskLevel === 'safe' ? 'info' : doc.riskLevel;
    category = 'PII Leakage';
    evidence = `${doc.findingCount} PII items detected`;
  } else if (scanType === 'aiagent') {
    sourceUrl = doc.endpointUrl;
    title = `AI Agent Scan — ${doc.scanType === 'exfil' ? 'System Prompt Exfiltration' : 'RAG Poisoning'}`;
    description = doc.summary;
    severity = doc.riskLevel === 'safe' ? 'info' : doc.riskLevel;
    category = doc.scanType === 'exfil' ? 'Prompt Exfiltration' : 'RAG Poisoning';
  }

  try {
    const finding = await Finding.create({
      title,
      description,
      severity,
      category,
      evidence,
      sourceUrl,
      fixSnippet,
      scanType,
      sourceScanId,
      workspaceId: workspaceId || null,
      userId: req.user._id,
      timeline: [{ action: 'created', to: 'open', by: req.user._id }],
    });

    await finding.populate('userId', 'name email');

    if (['critical', 'high'].includes(finding.severity)) {
      routeEvent('finding_opened', {
        findingId: String(finding._id),
        title: finding.title,
        severity: finding.severity,
        category: finding.category,
        scanType: finding.scanType,
        sourceUrl: finding.sourceUrl,
      }, { userId: String(req.user._id), findingId: String(finding._id) }).catch(() => {});
    }

    res.status(201).json(finding);
  } catch {
    res.status(500).json({ error: 'Failed to import finding' });
  }
});

// ─── Update finding ───────────────────────────────────────────────────────────
// PUT /api/findings/:id
// Handles: status change, assignment, severity, notes, due date
router.put('/findings/:id', authenticateToken, async (req, res) => {
  try {
    const finding = await Finding.findById(req.params.id);
    if (!finding) return res.status(404).json({ error: 'Finding not found' });

    const userId = req.user._id.toString();
    if (finding.userId.toString() !== userId && finding.assignedTo?.toString() !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { status, assignedTo, assignedToEmail, severity, remediationNotes, fixSnippet, dueDate, note, title, description } = req.body;
    const timelineEntries = [];

    if (status && status !== finding.status) {
      timelineEntries.push({ action: 'status_changed', from: finding.status, to: status, by: req.user._id });
      finding.status = status;
      if (status === 'resolved') finding.resolvedAt = new Date();
      else if (finding.resolvedAt) finding.resolvedAt = undefined;
    }

    // Assignment: prefer email lookup, fall back to direct ObjectId
    if (assignedToEmail !== undefined) {
      if (!assignedToEmail) {
        // Clearing assignment
        if (finding.assignedTo) {
          timelineEntries.push({ action: 'assigned', from: finding.assignedTo.toString(), to: 'nobody', by: req.user._id });
          finding.assignedTo = null;
        }
      } else {
        const assignee = await User.findOne({ email: assignedToEmail.toLowerCase().trim() }).select('_id name email').lean();
        if (!assignee) return res.status(400).json({ error: `No user found with email: ${assignedToEmail}` });
        const prevId = finding.assignedTo?.toString() || 'nobody';
        const newId = assignee._id.toString();
        if (prevId !== newId) {
          timelineEntries.push({ action: 'assigned', from: prevId, to: assignee.email, by: req.user._id });
          finding.assignedTo = assignee._id;
        }
      }
    } else if (assignedTo !== undefined) {
      const prevAssigned = finding.assignedTo?.toString() || 'nobody';
      const newAssigned = assignedTo || 'nobody';
      if (prevAssigned !== newAssigned) {
        timelineEntries.push({ action: 'assigned', from: prevAssigned, to: newAssigned, by: req.user._id });
        finding.assignedTo = assignedTo || null;
      }
    }

    if (severity && severity !== finding.severity) {
      timelineEntries.push({ action: 'severity_changed', from: finding.severity, to: severity, by: req.user._id });
      finding.severity = severity;
    }

    if (title) finding.title = title;
    if (description !== undefined) finding.description = description;
    if (remediationNotes !== undefined) finding.remediationNotes = remediationNotes;
    if (fixSnippet !== undefined) finding.fixSnippet = fixSnippet;
    if (dueDate !== undefined) finding.dueDate = dueDate ? new Date(dueDate) : null;

    if (note?.trim()) {
      timelineEntries.push({ action: 'note_added', note: note.trim(), by: req.user._id });
    }

    finding.timeline.push(...timelineEntries);
    await finding.save();

    await finding.populate([
      { path: 'userId', select: 'name email profileImage' },
      { path: 'assignedTo', select: 'name email profileImage' },
      { path: 'timeline.by', select: 'name email profileImage' },
    ]);

    res.json(finding);
  } catch {
    res.status(500).json({ error: 'Failed to update finding' });
  }
});

// DELETE /api/findings/:id — creator only
router.delete('/findings/:id', authenticateToken, async (req, res) => {
  try {
    const finding = await Finding.findById(req.params.id);
    if (!finding) return res.status(404).json({ error: 'Finding not found' });
    if (finding.userId.toString() !== req.user._id.toString())
      return res.status(403).json({ error: 'Only the creator can delete a finding' });

    await finding.deleteOne();
    res.json({ message: 'Finding deleted' });
  } catch {
    res.status(500).json({ error: 'Failed to delete finding' });
  }
});

export default router;
