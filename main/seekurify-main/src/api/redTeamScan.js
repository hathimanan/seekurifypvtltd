/**
 * Seekurify — AI Pipeline Red-Team Agent API
 *
 * POST /api/red-team/scan      — start a scan (SSE stream)
 * GET  /api/red-team/history   — list past scans for the user
 * GET  /api/red-team/scan/:id  — get a single scan result
 */

import express    from 'express';
import jwt        from 'jsonwebtoken';
import multer     from 'multer';
import path       from 'path';
import { runRedTeamAgent } from '../agents/redTeamAgent.js';
import RedTeamScanLog       from '../models/RedTeamScanLog.js';

const router = express.Router();

// ─── Auth helper ──────────────────────────────────────────────────────────────
function extractUserId(req) {
  try {
    const auth = req.headers.authorization;
    if (!auth?.startsWith('Bearer ')) return null;
    const decoded = jwt.verify(auth.split(' ')[1], process.env.JWT_SECRET);
    return decoded.id ?? decoded.userId ?? decoded._id ?? null;
  } catch (_) { return null; }
}

function requireAuth(req, res, next) {
  const userId = extractUserId(req);
  if (!userId) return res.status(401).json({ error: 'Authentication required.' });
  req._userId = userId;
  next();
}

// ─── Simple per-user in-memory rate limit (1 concurrent scan) ────────────────
const activeScans = new Set();

// ─── POST /red-team/scan ──────────────────────────────────────────────────────
router.post('/red-team/scan', requireAuth, async (req, res) => {
  const userId = req._userId;

  if (activeScans.has(userId)) {
    return res.status(429).json({ error: 'A scan is already running. Please wait for it to complete.' });
  }

  const { targetUrl, apiKey, authHeader, requestFormat, customBodyTemplate } = req.body;
  if (!targetUrl) return res.status(400).json({ error: 'targetUrl is required.' });

  // ── Set up SSE ──────────────────────────────────────────────────────────
  res.setHeader('Content-Type',  'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection',    'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');  // disable nginx buffering
  res.flushHeaders();

  const emit = (event, data) => {
    if (res.writableEnded) return;
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  // Keep-alive ping every 20s to prevent proxy timeouts
  const ping = setInterval(() => {
    if (res.writableEnded) { clearInterval(ping); return; }
    res.write(': ping\n\n');
  }, 20_000);

  activeScans.add(userId);

  try {
    await runRedTeamAgent({
      config: { targetUrl, apiKey, authHeader, requestFormat, customBodyTemplate },
      emit,
      userId,
    });
  } catch (err) {
    emit('error', { message: err.message });
    // Mark scan as failed in DB if it was saved
    await RedTeamScanLog.findOneAndUpdate(
      { userId, status: 'running' },
      { $set: { status: 'failed' } },
      { sort: { createdAt: -1 } }
    ).catch(() => {});
  } finally {
    clearInterval(ping);
    activeScans.delete(userId);
    if (!res.writableEnded) res.end();
  }
});

// ─── GET /red-team/history ────────────────────────────────────────────────────
router.get('/red-team/history', requireAuth, async (req, res) => {
  try {
    const logs = await RedTeamScanLog.find({ userId: req._userId })
      .sort({ createdAt: -1 })
      .limit(20)
      .select('targetUrl requestFormat status score riskLevel totalProbes successfulAttacks duration createdAt summary')
      .lean();
    res.json({ logs });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch scan history.' });
  }
});

// ─── GET /red-team/scan/:id ───────────────────────────────────────────────────
router.get('/red-team/scan/:id', requireAuth, async (req, res) => {
  try {
    const log = await RedTeamScanLog.findOne({
      _id: req.params.id,
      userId: req._userId,
    }).lean();
    if (!log) return res.status(404).json({ error: 'Scan not found.' });
    res.json(log);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch scan.' });
  }
});

// ─── POST /red-team/scan-code ─────────────────────────────────────────────────
// Static analysis: accept source files, ask Claude to find AI security vulns.

const ACCEPTED_EXTS = new Set([
  '.js', '.ts', '.tsx', '.jsx', '.py', '.json',
  '.txt', '.md', '.yaml', '.yml', '.toml', '.env',
]);

const codeUpload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: 200 * 1024, files: 15 },
});

// ─── Static analysis rules ────────────────────────────────────────────────────
const CODE_RULES = [
  {
    category: 'Prompt Injection', severity: 'high',
    description: 'User-controlled request input directly interpolated into a prompt template string',
    pattern: /`[^`]*\$\{[^}]*(req\.|body\.|params\.|query\.)[^`]*`/,
  },
  {
    category: 'Prompt Injection', severity: 'high',
    description: 'User input concatenated into prompt via string addition',
    pattern: /["'`]\s*\+\s*(req\.|body\.|params\.|query\.)\w+|\+\s*["'`].*?(prompt|message|content|instruction)/i,
  },
  {
    category: 'Secret Exposure', severity: 'critical',
    description: 'Hardcoded API key or authentication token found in source',
    pattern: /(sk-ant-api|sk-proj-|AIzaSy|ghp_|xoxb-)[A-Za-z0-9_\-]{15,}/,
  },
  {
    category: 'System Prompt Exposure', severity: 'medium',
    description: 'System prompt hardcoded as constant — extractable if model is tricked into repeating it',
    pattern: /\b(SYSTEM_PROMPT|systemPrompt|system_prompt)\s*[=:]\s*[`"']/,
  },
  {
    category: 'Tool Permission Overreach', severity: 'high',
    description: 'Shell execution capability in AI tool context — enables arbitrary command injection',
    pattern: /\b(exec|execSync|spawn|spawnSync)\s*\(|require\(['"]child_process['"]\)|from ['"]child_process['"]/,
  },
  {
    category: 'Tool Permission Overreach', severity: 'high',
    description: 'Unrestricted file system write or delete operation accessible to AI tools',
    pattern: /\bfs\.(writeFile|appendFile|unlink|rmdir|rm)\s*\(/,
  },
  {
    category: 'Data Exfiltration Risk', severity: 'medium',
    description: 'HTTP request with string interpolation — AI-generated content may be exfiltrated',
    pattern: /(fetch|axios)\s*\(`[^`]*\$\{|axios\.(post|put|patch)\s*\(`/,
  },
  {
    category: 'Jailbreak Vectors', severity: 'medium',
    description: 'Raw AI model output used directly without content validation or filtering',
    pattern: /choices\[0\]\.message\.content|content\[0\]\.text(?!.*\b(filter|sanitize|validate|moderate)\b)/,
  },
  {
    category: 'Input Validation Gap', severity: 'medium',
    description: 'Request body/query field flows into AI pipeline without apparent validation',
    pattern: /req\.(body|query|params)\.\w+[^\n;]*?(prompt|message|content|instruction)/i,
  },
  {
    category: 'Agentic Risks', severity: 'high',
    description: 'Unbounded agent loop without enforced iteration limit',
    pattern: /while\s*\(\s*true\s*\)|for\s*\(.*;\s*\)\s*\{[^}]*messages\.push/,
  },
];

const SEVERITY_SCORE_CODE = { critical: 35, high: 20, medium: 10, low: 5 };

function runStaticAnalysis(files) {
  const findings = [];

  for (const file of files) {
    const lines = file.content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('*')) continue;

      for (const rule of CODE_RULES) {
        if (rule.pattern.test(trimmed)) {
          // One finding per category per file to avoid flooding
          const alreadyFound = findings.some(
            f => f.category === rule.category && f.evidence.startsWith(file.name)
          );
          if (!alreadyFound) {
            findings.push({
              category:    rule.category,
              severity:    rule.severity,
              description: rule.description,
              payload:     trimmed.slice(0, 200),
              evidence:    `${file.name} line ${i + 1}: ${trimmed.slice(0, 150)}`,
              succeeded:   true,
            });
          }
        }
      }
    }
  }

  return findings;
}

router.post('/red-team/scan-code', requireAuth, codeUpload.array('files', 15), (req, res) => {
  if (!req.files || req.files.length === 0)
    return res.status(400).json({ error: 'No files uploaded.' });

  const t0 = Date.now();

  const files = req.files
    .filter(f => ACCEPTED_EXTS.has(path.extname(f.originalname).toLowerCase()))
    .map(f => ({ name: f.originalname, content: f.buffer.toString('utf-8').slice(0, 10_000) }));

  if (files.length === 0)
    return res.status(400).json({
      error: 'No supported file types found. Accepted: .js .ts .tsx .jsx .py .json .txt .md .yaml',
    });

  const findings = runStaticAnalysis(files);
  const score    = Math.min(100, findings.reduce((s, f) => s + (SEVERITY_SCORE_CODE[f.severity] ?? 0), 0));
  const riskLevel =
    score === 0  ? 'clean'    :
    score <= 20  ? 'low'      :
    score <= 50  ? 'medium'   :
    score <= 75  ? 'high'     : 'critical';

  const cats = [...new Set(findings.map(f => f.category))];
  const critCount = findings.filter(f => f.severity === 'critical').length;
  const highCount = findings.filter(f => f.severity === 'high').length;

  const summary = findings.length === 0
    ? `${files.length} file(s) analysed. No AI security vulnerabilities detected by static rules.`
    : `${files.length} file(s) analysed. ${findings.length} finding(s) across: ${cats.join(', ')}. ` +
      (critCount ? `${critCount} critical. ` : '') +
      (highCount ? `${highCount} high severity. ` : '') +
      'Review and remediate before deployment.';

  const REC_MAP = {
    'Prompt Injection':        'Sanitize all user input before injecting into prompt templates. Use parameterised prompt builders instead of string concatenation.',
    'Secret Exposure':         'Move API keys to environment variables immediately and rotate the exposed credentials.',
    'System Prompt Exposure':  'Treat system prompts as secrets. Instruct the model never to repeat them and add an output filter for prompt keywords.',
    'Tool Permission Overreach': 'Apply least-privilege to all AI tools. Gate shell and file-system operations behind an allow-list and human-in-the-loop approval.',
    'Data Exfiltration Risk':  'Audit every HTTP call reachable by the AI. Strip or mask sensitive fields before passing responses to the model.',
    'Jailbreak Vectors':       'Add a post-processing content filter on all model outputs before using them in application logic.',
    'Input Validation Gap':    'Validate and sanitize all request parameters with a schema library (zod, joi) before they reach the AI pipeline.',
    'Agentic Risks':           'Cap agent iterations with a hard limit and add a circuit-breaker that halts on repeated tool failures.',
  };
  const recommendations = cats.map(c => REC_MAP[c]).filter(Boolean);
  if (recommendations.length === 0)
    recommendations.push('No critical issues found. Continue monitoring as the AI pipeline evolves.');

  res.json({
    findings,
    score,
    riskLevel,
    summary,
    recommendations,
    totalProbes:       files.length,
    successfulAttacks: findings.length,
    duration:          Date.now() - t0,
  });
});

export default router;
