import express from 'express';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import Anthropic from '@anthropic-ai/sdk';
import FirewallRule from '../models/FirewallRule.js';
import FirewallEvent from '../models/FirewallEvent.js';
import Finding from '../models/Finding.js';
import { pushEvent } from '../realtime/socketHub.js';
import { routeEvent } from '../services/triggerRouter.js';

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

const PATTERN_TYPES = ['url_pattern', 'user_agent', 'payload_pattern'];

function ipToNum(ip) {
  return ip.split('.').reduce((acc, octet) => (acc << 8) + parseInt(octet, 10), 0) >>> 0;
}

function ipMatchesRule(sourceIp, ruleValue) {
  const val = ruleValue.trim();
  if (!val.includes('/')) return sourceIp.trim() === val;
  const [range, bits] = val.split('/');
  const maskBits = parseInt(bits, 10);
  if (isNaN(maskBits) || maskBits < 0 || maskBits > 32) return false;
  const mask = maskBits === 0 ? 0 : (~0 << (32 - maskBits)) >>> 0;
  return (ipToNum(sourceIp) & mask) === (ipToNum(range) & mask);
}
const VALID_TYPES    = ['ip_block', 'ip_allow', 'url_pattern', 'user_agent', 'payload_pattern'];
const VALID_ACTIONS  = ['block', 'allow', 'log'];
const VALID_SEVS     = ['critical', 'high', 'medium', 'low'];

function validateRegex(value) {
  try { new RegExp(value); return true; } catch { return false; }
}

// ── GET /api/firewall/rules ────────────────────────────────────────────────────
router.get('/rules', authenticateToken, async (req, res) => {
  try {
    const rules = await FirewallRule.find({ userId: req.user._id })
      .sort({ createdAt: -1 })
      .lean();
    res.json({ rules });
  } catch (err) {
    console.error('[Firewall] GET /rules:', err.message);
    res.status(500).json({ error: 'Failed to fetch rules' });
  }
});

// ── POST /api/firewall/rules ───────────────────────────────────────────────────
router.post('/rules', authenticateToken, async (req, res) => {
  try {
    const { name, type, action, value, severity, description, enabled } = req.body;

    if (!name?.trim())               return res.status(400).json({ error: 'name is required' });
    if (!VALID_TYPES.includes(type))   return res.status(400).json({ error: `type must be one of: ${VALID_TYPES.join(', ')}` });
    if (!VALID_ACTIONS.includes(action)) return res.status(400).json({ error: `action must be one of: ${VALID_ACTIONS.join(', ')}` });
    if (!value?.trim())              return res.status(400).json({ error: 'value is required' });
    if (!VALID_SEVS.includes(severity)) return res.status(400).json({ error: `severity must be one of: ${VALID_SEVS.join(', ')}` });

    if (PATTERN_TYPES.includes(type)) {
      if (value.length > 200) return res.status(400).json({ error: 'Pattern value must be 200 characters or fewer' });
      if (!validateRegex(value)) return res.status(400).json({ error: 'value is not a valid regular expression' });
    }

    const rule = await FirewallRule.create({
      userId: req.user._id,
      name: name.trim(),
      type,
      action,
      value: value.trim(),
      severity,
      description: description?.trim() ?? '',
      enabled: enabled !== false,
    });

    res.status(201).json(rule);
  } catch (err) {
    console.error('[Firewall] POST /rules:', err.message);
    res.status(500).json({ error: 'Failed to create rule' });
  }
});

// ── PUT /api/firewall/rules/:id ────────────────────────────────────────────────
router.put('/rules/:id', authenticateToken, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id))
      return res.status(400).json({ error: 'Invalid id' });

    const { name, type, action, value, severity, description, enabled } = req.body;
    const update = {};

    if (name !== undefined)        update.name        = String(name).trim();
    if (description !== undefined) update.description = String(description).trim();
    if (enabled !== undefined)     update.enabled     = Boolean(enabled);

    if (type !== undefined) {
      if (!VALID_TYPES.includes(type)) return res.status(400).json({ error: `Invalid type` });
      update.type = type;
    }
    if (action !== undefined) {
      if (!VALID_ACTIONS.includes(action)) return res.status(400).json({ error: 'Invalid action' });
      update.action = action;
    }
    if (severity !== undefined) {
      if (!VALID_SEVS.includes(severity)) return res.status(400).json({ error: 'Invalid severity' });
      update.severity = severity;
    }
    if (value !== undefined) {
      const effectiveType = type ?? (await FirewallRule.findById(req.params.id).select('type').lean())?.type;
      if (PATTERN_TYPES.includes(effectiveType)) {
        if (String(value).length > 200) return res.status(400).json({ error: 'Pattern value must be 200 characters or fewer' });
        if (!validateRegex(value)) return res.status(400).json({ error: 'value is not a valid regular expression' });
      }
      update.value = String(value).trim();
    }

    const rule = await FirewallRule.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      { $set: update },
      { new: true }
    );
    if (!rule) return res.status(404).json({ error: 'Rule not found' });
    res.json(rule);
  } catch (err) {
    console.error('[Firewall] PUT /rules/:id:', err.message);
    res.status(500).json({ error: 'Failed to update rule' });
  }
});

// ── PATCH /api/firewall/rules/:id/toggle ──────────────────────────────────────
router.patch('/rules/:id/toggle', authenticateToken, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id))
      return res.status(400).json({ error: 'Invalid id' });

    const { enabled } = req.body;
    if (typeof enabled !== 'boolean')
      return res.status(400).json({ error: 'enabled must be a boolean' });

    const rule = await FirewallRule.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      { $set: { enabled } },
      { new: true, select: '_id enabled' }
    );
    if (!rule) return res.status(404).json({ error: 'Rule not found' });
    res.json({ _id: rule._id, enabled: rule.enabled });
  } catch (err) {
    console.error('[Firewall] PATCH /rules/:id/toggle:', err.message);
    res.status(500).json({ error: 'Failed to toggle rule' });
  }
});

// ── DELETE /api/firewall/rules/:id ────────────────────────────────────────────
router.delete('/rules/:id', authenticateToken, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id))
      return res.status(400).json({ error: 'Invalid id' });

    const rule = await FirewallRule.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
    if (!rule) return res.status(404).json({ error: 'Rule not found' });
    res.json({ deleted: true });
  } catch (err) {
    console.error('[Firewall] DELETE /rules/:id:', err.message);
    res.status(500).json({ error: 'Failed to delete rule' });
  }
});

// ── POST /api/firewall/inspect ─────────────────────────────────────────────────
router.post('/inspect', authenticateToken, async (req, res) => {
  try {
    const { sourceIp, targetUrl, userAgent = '', requestBody = '', headers = {} } = req.body;

    if (!sourceIp?.trim()) return res.status(400).json({ error: 'sourceIp is required' });
    if (!targetUrl?.trim()) return res.status(400).json({ error: 'targetUrl is required' });

    let parsedHeaders = headers;
    if (typeof headers === 'string') {
      try { parsedHeaders = JSON.parse(headers); }
      catch { return res.status(400).json({ error: 'headers must be valid JSON' }); }
    }

    const rules = await FirewallRule.find({ userId: req.user._id, enabled: true }).lean();

    const matchedRules = [];
    for (const rule of rules) {
      let matched = false;
      switch (rule.type) {
        case 'ip_block':
        case 'ip_allow':
          matched = ipMatchesRule(sourceIp, rule.value);
          break;
        case 'url_pattern':
          try { matched = new RegExp(rule.value, 'i').test(targetUrl); } catch { matched = false; }
          break;
        case 'user_agent':
          try { matched = new RegExp(rule.value, 'i').test(userAgent); } catch { matched = false; }
          break;
        case 'payload_pattern':
          try { matched = new RegExp(rule.value, 'i').test(requestBody); } catch { matched = false; }
          break;
      }
      if (matched) matchedRules.push(rule);
    }

    const aiAnalysis = await analyzeRequestWithAI(sourceIp, targetUrl, userAgent, requestBody, parsedHeaders);

    const hasBlockRule = matchedRules.some(r => r.action === 'block');
    const aiSev = aiAnalysis.severity;
    let verdict;
    if (hasBlockRule || aiSev === 'critical' || aiSev === 'high') {
      verdict = 'block';
    } else if (aiSev === 'medium' || matchedRules.some(r => r.action === 'log')) {
      verdict = 'monitor';
    } else {
      verdict = 'allow';
    }

    // Atomic increment on matched rules
    const matchedIds = matchedRules.map(r => r._id);
    if (matchedIds.length > 0) {
      await FirewallRule.updateMany(
        { _id: { $in: matchedIds } },
        { $inc: { hitCount: 1 }, $set: { lastTriggeredAt: new Date() } }
      );
    }

    const primaryMatch = matchedRules.find(r => r.action === 'block') ?? matchedRules[0] ?? null;

    const eventDoc = await FirewallEvent.create({
      userId:          req.user._id,
      sourceIp:        sourceIp.trim(),
      targetUrl:       targetUrl.trim(),
      userAgent:       userAgent.slice(0, 500),
      requestBody:     String(requestBody).slice(0, 5000),
      headers:         parsedHeaders,
      matchedRuleId:   primaryMatch?._id ?? null,
      matchedRuleName: primaryMatch?.name ?? null,
      aiThreatType:     aiAnalysis.threatType ?? null,
      aiSeverity:       aiSev !== 'none' ? aiSev : null,
      aiConfidence:     aiAnalysis.confidence ?? null,
      aiRecommendation: aiAnalysis.recommendation ?? null,
      aiIndicators:     aiAnalysis.indicators ?? [],
      verdict,
    });

    let findingId = null;
    if (verdict === 'block' && (aiSev === 'critical' || aiSev === 'high')) {
      try {
        const finding = await Finding.create({
          title:       `[WAF] ${aiAnalysis.threatType || 'Threat'} detected from ${sourceIp}`,
          description: `WAF blocked a ${aiSev} severity ${aiAnalysis.threatType || 'threat'}.\n\nTarget URL: ${targetUrl}\nSource IP: ${sourceIp}`,
          evidence:    `User-Agent: ${userAgent || 'N/A'}\nBody snapshot: ${String(requestBody).slice(0, 500)}`,
          severity:    aiSev,
          category:    aiAnalysis.threatType || 'WAF Threat',
          scanType:    'waf',
          sourceScanId: eventDoc._id,
          sourceUrl:   targetUrl,
          userId:      req.user._id,
          timeline:    [{ action: 'created', to: 'open', by: req.user._id, at: new Date() }],
        });
        findingId = finding._id;
        await FirewallEvent.findByIdAndUpdate(eventDoc._id, { $set: { findingId } });

        routeEvent('finding_opened', {
          findingId: String(finding._id),
          title:     finding.title,
          severity:  finding.severity,
          category:  finding.category,
          scanType:  'waf',
        }, { userId: String(req.user._id) }).catch(() => {});
      } catch (err) {
        console.error('[Firewall] auto-create finding failed:', err.message);
      }
    }

    if (verdict === 'block' && aiSev === 'critical') {
      pushEvent(String(req.user._id), 'firewall:block', {
        eventId:     String(eventDoc._id),
        sourceIp,
        targetUrl,
        aiThreatType: aiAnalysis.threatType,
        aiSeverity:   aiSev,
      });
    }

    if (aiSev === 'critical' || aiSev === 'high') {
      routeEvent('firewall_threat', {
        eventId:    String(eventDoc._id),
        sourceIp,
        targetUrl,
        threatType: aiAnalysis.threatType,
        severity:   aiSev,
        verdict,
      }, { userId: String(req.user._id) }).catch(() => {});
    }

    res.json({
      matchedRules: matchedRules.map(r => ({ _id: r._id, name: r.name, type: r.type, action: r.action })),
      aiAnalysis,
      verdict,
      eventId:   String(eventDoc._id),
      findingId: findingId ? String(findingId) : null,
    });
  } catch (err) {
    console.error('[Firewall] POST /inspect:', err.message);
    res.status(500).json({ error: 'Inspection failed' });
  }
});

// ── GET /api/firewall/events ───────────────────────────────────────────────────
router.get('/events', authenticateToken, async (req, res) => {
  try {
    const { verdict, severity, page = 1, limit = 20 } = req.query;
    const filter = { userId: req.user._id };
    if (verdict)  filter.verdict    = verdict;
    if (severity) filter.aiSeverity = severity;

    const skip = (Number(page) - 1) * Number(limit);
    const [events, total] = await Promise.all([
      FirewallEvent.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit))
        .lean(),
      FirewallEvent.countDocuments(filter),
    ]);

    res.json({ events, total, page: Number(page) });
  } catch (err) {
    console.error('[Firewall] GET /events:', err.message);
    res.status(500).json({ error: 'Failed to fetch events' });
  }
});

// ── GET /api/firewall/stats ────────────────────────────────────────────────────
router.get('/stats', authenticateToken, async (req, res) => {
  try {
    const userId = req.user._id;
    const todayStart = new Date();
    todayStart.setUTCHours(0, 0, 0, 0);

    const [activeRules, eventsToday, blockedThreats, distribution] = await Promise.all([
      FirewallRule.countDocuments({ userId, enabled: true }),
      FirewallEvent.countDocuments({ userId, createdAt: { $gte: todayStart } }),
      FirewallEvent.countDocuments({ userId, verdict: 'block' }),
      FirewallEvent.aggregate([
        { $match: { userId: new mongoose.Types.ObjectId(String(userId)), aiThreatType: { $ne: null } } },
        { $group: { _id: '$aiThreatType', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 8 },
        { $project: { _id: 0, name: '$_id', count: 1 } },
      ]),
    ]);

    res.json({ activeRules, eventsToday, blockedThreats, threatDistribution: distribution });
  } catch (err) {
    console.error('[Firewall] GET /stats:', err.message);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// ── AI analysis helper ─────────────────────────────────────────────────────────
async function analyzeRequestWithAI(sourceIp, targetUrl, userAgent, requestBody, headers) {
  const fallback = { threatType: null, severity: 'none', confidence: 0, recommendation: 'AI analysis unavailable.', indicators: [] };
  if (!process.env.ANTHROPIC_API_KEY) return fallback;

  try {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const headersStr = JSON.stringify(headers || {}).slice(0, 500);
    const bodyStr    = String(requestBody || '').slice(0, 2000);

    const prompt = `You are a Web Application Firewall (WAF) security analyst.
Analyze the following HTTP request for security threats. Detect any of:
- SQL Injection (UNION SELECT, OR 1=1, etc.)
- Cross-Site Scripting / XSS (<script>, onerror=, javascript:, etc.)
- Prompt Injection (ignore previous instructions, act as, jailbreak, etc.)
- Path Traversal (../../../, %2e%2e, etc.)
- Automated Bot / Scanner (sqlmap, nikto, dirbuster in User-Agent)
- Command Injection (; ls, | cat, backtick execution, etc.)
- SSRF / LDAP / XML injection patterns

Request details:
Source IP: ${sourceIp}
Target URL: ${targetUrl}
User-Agent: ${userAgent || 'Not provided'}
Headers: ${headersStr}
Request Body: ${bodyStr || 'Empty'}

Respond ONLY with valid JSON — no markdown, no commentary:
{"threatType":string|null,"severity":"critical"|"high"|"medium"|"low"|"none","confidence":0.0-1.0,"recommendation":string,"indicators":string[]}`;

    const msg = await anthropic.messages.create({
      model:      'claude-haiku-4-5-20251001',
      max_tokens: 400,
      messages:   [{ role: 'user', content: prompt }],
    });

    const raw = msg.content[0]?.text?.trim() ?? '{}';
    return JSON.parse(raw);
  } catch (err) {
    console.error('[Firewall] AI analysis error:', err.message);
    return fallback;
  }
}

export default router;
