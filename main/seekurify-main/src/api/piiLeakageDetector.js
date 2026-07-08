import express from 'express';
import jwt from 'jsonwebtoken';
import PIIScanLog from '../models/PIIScanLog.js';

const router = express.Router();

// ─── Auth middleware ───────────────────────────────────────────────────────────
function authMiddleware(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    res.status(403).json({ error: 'Invalid token' });
  }
}

// ─── PII Pattern Registry ─────────────────────────────────────────────────────
// regulations: applicable laws — DPDP (India DPDP Act 2023), GDPR (EU), EU_AI_ACT, HIPAA (US)
const PII_PATTERNS = [
  // ── Personal ──
  {
    id: 'email', label: 'Email Address', category: 'Personal', severity: 'medium',
    regulations: ['DPDP', 'GDPR'],
    pattern: /\b[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}\b/g,
    description: 'Email addresses that could identify a user',
  },
  {
    id: 'phone_us', label: 'US Phone Number', category: 'Personal', severity: 'medium',
    regulations: ['DPDP', 'GDPR'],
    pattern: /\b(?:\+1[\s\-.]?)?\(?\d{3}\)?[\s\-.]?\d{3}[\s\-.]?\d{4}\b/g,
    description: 'US phone numbers in common formats (xxx-xxx-xxxx)',
  },
  {
    id: 'phone_intl', label: 'International Phone Number', category: 'Personal', severity: 'medium',
    regulations: ['DPDP', 'GDPR'],
    pattern: /\+(?:[1-9]\d{0,2})[\s\-.]?\(?\d{1,4}\)?(?:[\s\-.]?\d{2,4}){2,4}/g,
    description: 'International phone numbers with country code prefix (+XX...)',
  },
  {
    id: 'ssn', label: 'Social Security Number (SSN)', category: 'Personal', severity: 'critical',
    regulations: ['DPDP', 'GDPR'],
    pattern: /\b(?!000|666|9\d{2})\d{3}[- ](?!00)\d{2}[- ](?!0{4})\d{4}\b/g,
    description: 'US Social Security Numbers (format: XXX-XX-XXXX)',
  },
  {
    id: 'dob', label: 'Date of Birth', category: 'Personal', severity: 'medium',
    regulations: ['DPDP', 'GDPR'],
    pattern: /\b(?:born|dob|date\s+of\s+birth|birthday)\s*[:\-]?\s*\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}\b/gi,
    description: 'Explicit date of birth references in text',
  },
  {
    id: 'passport', label: 'Passport Number', category: 'Personal', severity: 'high',
    regulations: ['DPDP', 'GDPR'],
    pattern: /\b(?:passport(?:\s*(?:no|num|number|#|id))?\.?\s*[:\-]?\s*)[A-Z]{1,2}\d{6,9}\b/gi,
    description: 'Passport or travel document numbers',
  },
  // Indian national IDs
  {
    id: 'aadhar', label: 'Aadhar Number', category: 'Personal', severity: 'high',
    regulations: ['DPDP'],
    pattern: /\b[2-9]\d{3}[\s\-]?\d{4}[\s\-]?\d{4}\b/g,
    description: 'Indian Aadhar UID numbers (12-digit, first digit 2-9)',
  },
  {
    id: 'pan_card', label: 'PAN Card Number', category: 'Personal', severity: 'high',
    regulations: ['DPDP'],
    pattern: /\b[A-Z]{5}\d{4}[A-Z]\b/g,
    description: 'Indian Permanent Account Number (PAN) in AAAAA9999A format',
  },

  // ── Financial ──
  {
    id: 'credit_card', label: 'Credit Card Number', category: 'Financial', severity: 'critical',
    regulations: ['DPDP', 'GDPR'],
    pattern: /\b(?:(?:4\d{3}|5[1-5]\d{2}|2[2-7]\d{2}|6011|65\d{2}|64[4-9]\d)[\s\-]?\d{4}[\s\-]?\d{4}[\s\-]?\d{4}|3[47]\d{2}[\s\-]?\d{6}[\s\-]?\d{5})\b/g,
    description: 'Visa, Mastercard (inc. 2-series), Discover, or Amex (4-6-5) card numbers',
  },
  {
    id: 'bank_account', label: 'Bank Account Number', category: 'Financial', severity: 'high',
    regulations: ['DPDP', 'GDPR'],
    pattern: /\b(?:account\s*(?:no|num|number|#)?\.?\s*[:\-]?\s*)\d{8,17}\b/gi,
    description: 'Bank account numbers with explicit label',
  },
  {
    id: 'iban', label: 'IBAN', category: 'Financial', severity: 'high',
    regulations: ['DPDP', 'GDPR'],
    pattern: /\b[A-Z]{2}\d{2}[A-Z0-9]{4}\d{7}(?:[A-Z0-9]{0,16})?\b/g,
    description: 'International Bank Account Number (ISO 13616)',
  },
  {
    id: 'routing_number', label: 'Routing Number', category: 'Financial', severity: 'high',
    regulations: ['DPDP', 'GDPR'],
    pattern: /\b(?:routing(?:\s*(?:no|num|number))?\.?\s*[:\-]?\s*)\d{9}\b/gi,
    description: 'US bank routing numbers (9 digits) with label',
  },

  // ── Credentials ──
  {
    id: 'openai_key', label: 'OpenAI / LLM API Key', category: 'Credential', severity: 'critical',
    regulations: ['EU_AI_ACT'],
    pattern: /\bsk-(?:proj-|svcacct-)?[A-Za-z0-9\-_]{20,}/g,
    description: 'OpenAI-style secret keys starting with sk-',
  },
  {
    id: 'aws_access_key', label: 'AWS Access Key ID', category: 'Credential', severity: 'critical',
    regulations: ['EU_AI_ACT'],
    pattern: /\bAKIA[0-9A-Z]{16}\b/g,
    description: 'AWS IAM Access Key IDs (AKIA...)',
  },
  {
    id: 'aws_secret_key', label: 'AWS Secret Access Key', category: 'Credential', severity: 'critical',
    regulations: ['EU_AI_ACT'],
    pattern: /\b(?:aws[_\-]?secret(?:[_\-]?access)?[_\-]?key|secret[_\-]?access[_\-]?key)\s*[=:]\s*["']?([A-Za-z0-9\/+=]{40})\b/gi,
    description: 'AWS IAM Secret Access Keys (40-char base64)',
  },
  {
    id: 'github_token', label: 'GitHub Token', category: 'Credential', severity: 'critical',
    regulations: ['EU_AI_ACT'],
    pattern: /\bgh[pousr]_[A-Za-z0-9_]{36,}\b/g,
    description: 'GitHub personal access, OAuth, or server tokens',
  },
  {
    id: 'google_api_key', label: 'Google API Key', category: 'Credential', severity: 'critical',
    regulations: ['EU_AI_ACT'],
    pattern: /\bAIza[0-9A-Za-z\-_]{35}\b/g,
    description: 'Google Cloud / Firebase API keys (AIza...)',
  },
  {
    id: 'generic_api_key', label: 'Generic API Key', category: 'Credential', severity: 'high',
    regulations: ['EU_AI_ACT'],
    pattern: /\b(?:api[_\-]?key|apikey|x[\-_]api[\-_]key)\s*[=:]\s*["']?([A-Za-z0-9\-_]{20,})/gi,
    description: 'Generic API key assignments in text',
  },
  {
    id: 'bearer_token', label: 'Bearer Token', category: 'Credential', severity: 'high',
    regulations: ['EU_AI_ACT'],
    pattern: /Bearer\s+([A-Za-z0-9\-_=]+\.[A-Za-z0-9\-_=]+\.?[A-Za-z0-9\-_=+/]*)/g,
    description: 'HTTP Bearer authorization tokens',
  },
  {
    id: 'jwt', label: 'JWT Token', category: 'Credential', severity: 'high',
    regulations: ['EU_AI_ACT'],
    pattern: /\beyJ[A-Za-z0-9_\-]+\.[A-Za-z0-9_\-]+\.[A-Za-z0-9_\-]+/g,
    description: 'JSON Web Tokens (three base64url-encoded segments)',
  },
  {
    id: 'private_key_pem', label: 'PEM Private Key', category: 'Credential', severity: 'critical',
    regulations: ['EU_AI_ACT'],
    pattern: /-----BEGIN\s+(?:RSA\s+|EC\s+|OPENSSH\s+|DSA\s+)?PRIVATE\s+KEY-----/gi,
    description: 'PEM-format private key block header',
  },
  {
    id: 'password_inline', label: 'Inline Password', category: 'Credential', severity: 'high',
    regulations: ['EU_AI_ACT'],
    pattern: /\b(?:password|passwd|pwd)\s*[=:]\s*["']?([^\s"',;]{6,})/gi,
    description: 'Password values assigned or printed inline',
  },
  {
    id: 'connection_string', label: 'Database Connection String', category: 'Credential', severity: 'critical',
    regulations: ['EU_AI_ACT'],
    pattern: /(?:mongodb(?:\+srv)?|postgres|postgresql|mysql|redis|mssql|sqlserver):\/\/[^/\s]+:[^@\s]+@[^\s/]+/gi,
    description: 'Database connection strings containing credentials',
  },

  // ── Network ──
  {
    id: 'ipv4_private', label: 'Private IPv4 Address', category: 'Network', severity: 'medium',
    regulations: ['EU_AI_ACT'],
    pattern: /\b(?:10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(?:1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3})\b/g,
    description: 'Private-range IPv4 addresses — may expose internal topology',
  },
  {
    id: 'ipv4_public', label: 'Public IPv4 Address', category: 'Network', severity: 'low',
    regulations: ['EU_AI_ACT'],
    pattern: /\b(?:(?!10\.|172\.(?:1[6-9]|2\d|3[01])\.|192\.168\.)(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\b/g,
    description: 'Public IPv4 addresses',
  },
  {
    id: 'internal_url', label: 'Internal / Localhost URL', category: 'Network', severity: 'medium',
    regulations: ['EU_AI_ACT'],
    pattern: /https?:\/\/(?:localhost|127\.\d+\.\d+\.\d+|0\.0\.0\.0|10\.\d+\.\d+\.\d+|172\.(?:1[6-9]|2\d|3[01])\.\d+\.\d+|192\.168\.\d+\.\d+)(?::\d+)?[^\s]*/gi,
    description: 'URLs pointing to internal or private network addresses',
  },

  // ── Government ──
  {
    id: 'gov_classified', label: 'Classified Document Marker', category: 'Government', severity: 'critical',
    regulations: ['DPDP', 'EU_AI_ACT'],
    pattern: /\b(?:TOP\s+SECRET|SECRET|CONFIDENTIAL|RESTRICTED|CLASSIFIED|FOR\s+OFFICIAL\s+USE\s+ONLY|FOUO|SENSITIVE\s+BUT\s+UNCLASSIFIED|SBU|OFFICIAL\s+USE\s+ONLY|NOT\s+FOR\s+PUBLIC\s+RELEASE)\b/g,
    description: 'Classified or government-restricted document markers',
  },
  {
    id: 'voter_id_in', label: 'Indian Voter ID (EPIC)', category: 'Government', severity: 'high',
    regulations: ['DPDP'],
    pattern: /\b[A-Z]{3}\d{7}\b/g,
    description: 'Indian Electoral Photo Identity Card number (3 uppercase letters + 7 digits)',
  },
  {
    id: 'driving_license_in', label: 'Indian Driving Licence', category: 'Government', severity: 'high',
    regulations: ['DPDP'],
    pattern: /\b[A-Z]{2}[\s\-]?\d{2}[\s\-]?\d{4}[\s\-]?\d{7}\b/g,
    description: 'Indian Driving Licence number (state code + year + 7 digits)',
  },

  // ── Sensitive (DPDP §2(t) / GDPR Art. 9 special categories) ──
  {
    id: 'biometric_ref', label: 'Biometric Data Reference', category: 'Sensitive', severity: 'critical',
    regulations: ['DPDP', 'GDPR', 'EU_AI_ACT'],
    pattern: /\b(?:fingerprint|biometric(?:\s+data)?|retina\s+scan|iris\s+scan|facial\s+recognition|face\s+(?:id|scan|data)|voice\s+(?:print|id|biometric)|palm\s+(?:print|vein)|gait\s+analysis)\b/gi,
    description: 'Biometric identifiers — special category under DPDP §2(t) and GDPR Art. 9',
  },
  {
    id: 'genetic_data', label: 'Genetic Data Reference', category: 'Sensitive', severity: 'critical',
    regulations: ['DPDP', 'GDPR'],
    pattern: /\b(?:genetic\s+(?:data|test|profile|sequence|information)|DNA\s+(?:test|profile|sequence|sample|data)|genomic\s+(?:data|profile|sequence)|genome\s+sequence)\b/gi,
    description: 'Genetic or genomic data — special category under DPDP and GDPR Art. 9',
  },
  {
    id: 'health_data', label: 'Health / Medical Data', category: 'Sensitive', severity: 'high',
    regulations: ['DPDP', 'GDPR', 'HIPAA'],
    pattern: /\b(?:medical\s+(?:record|history|condition|report)|patient\s+(?:record|data|history|id)|prescription|blood\s+(?:type|group|pressure|sugar)|diagnosed\s+with|suffering\s+from|mental\s+(?:health|illness|disorder)|psychiatric\s+(?:record|history)|clinical\s+(?:record|data|trial)|treatment\s+plan)\b/gi,
    description: 'Health and medical data — special category under DPDP, GDPR Art. 9, and HIPAA',
  },
  {
    id: 'caste_data', label: 'Caste / Tribal Data', category: 'Sensitive', severity: 'high',
    regulations: ['DPDP'],
    pattern: /\b(?:caste\s*[:\-=]\s*\w+|scheduled\s+caste|scheduled\s+tribe|other\s+backward\s+class|OBC\s+certificate|SC\/ST\s+certificate|dalit\s+community)\b/gi,
    description: "Caste or tribal affiliation — sensitive category under India's DPDP Act §2(t)",
  },
  {
    id: 'religious_data', label: 'Religious Belief Data', category: 'Sensitive', severity: 'high',
    regulations: ['DPDP', 'GDPR'],
    pattern: /\b(?:religion\s*[:\-=]\s*\w+|religious\s+(?:belief|affiliation|identity)|religious\s+convert|place\s+of\s+worship\s+preference)\b/gi,
    description: 'Religious beliefs or affiliation — sensitive category under DPDP and GDPR Art. 9',
  },
  {
    id: 'political_data', label: 'Political Affiliation Data', category: 'Sensitive', severity: 'high',
    regulations: ['DPDP', 'GDPR'],
    pattern: /\b(?:political\s+(?:affiliation|belief|opinion|party\s+membership)|party\s+member(?:ship)?\s+(?:card|number)|voter\s+affiliation\s*[:\-=])\b/gi,
    description: 'Political opinions or party membership — sensitive category under DPDP and GDPR Art. 9',
  },
  {
    id: 'sexual_orientation', label: 'Sexual Orientation / Gender Identity', category: 'Sensitive', severity: 'critical',
    regulations: ['DPDP', 'GDPR'],
    pattern: /\b(?:sexual\s+orientation|gender\s+identity\s*[:\-=]|(?:gay|lesbian|bisexual|transgender|queer|non[\s\-]?binary|intersex)\s+(?:identity|person|individual|status))\b/gi,
    description: 'Sexual orientation or gender identity — special category under DPDP §2(t) and GDPR Art. 9',
  },
];

// ─── Score helpers ─────────────────────────────────────────────────────────────
const SEVERITY_WEIGHTS = { critical: 40, high: 20, medium: 8, low: 2 };

function calcScore(findings) {
  if (findings.length === 0) return 0;
  const raw = findings.reduce(
    (sum, f) => sum + (SEVERITY_WEIGHTS[f.severity] || 2) * Math.min(f.count, 5),
    0
  );
  return Math.min(100, raw);
}

function scoreToRisk(score) {
  if (score === 0)   return 'safe';
  if (score <= 10)   return 'low';
  if (score <= 30)   return 'medium';
  if (score <= 60)   return 'high';
  return 'critical';
}

// ─── Compliance summary (DPDP Act 2023 + EU AI Act) ──────────────────────────
function buildComplianceSummary(findings) {
  const triggeredRegs = new Set();
  let hasSensitive = false;
  let hasGovernment = false;

  for (const f of findings) {
    if (f.regulations?.length) f.regulations.forEach(r => triggeredRegs.add(r));
    if (f.category === 'Sensitive')   hasSensitive  = true;
    if (f.category === 'Government')  hasGovernment = true;
  }

  // EU AI Act risk tier
  let euAiActRisk = 'minimal';
  if (hasGovernment || hasSensitive)     euAiActRisk = 'high';
  else if (triggeredRegs.has('EU_AI_ACT')) euAiActRisk = 'limited';

  // DPDP data tier
  const hasDPDP = triggeredRegs.has('DPDP');
  const dpdpTier = hasDPDP ? (hasSensitive ? 'sensitive' : 'general') : 'none';

  const requiredActions = [];
  if (hasDPDP) {
    requiredActions.push('Obtain verifiable consent before collection or processing (DPDP Act 2023, §6)');
    if (hasSensitive) requiredActions.push('Sensitive personal data requires separate explicit consent (DPDP §9)');
    requiredActions.push('Notify data principals of breach within 72 hours (DPDP §8(6))');
    requiredActions.push('Honour access, correction, and erasure requests (DPDP §11–13)');
  }
  if (triggeredRegs.has('GDPR')) {
    requiredActions.push('Establish lawful basis for processing (GDPR Art. 6)');
    if (hasSensitive) requiredActions.push('Special category data requires explicit consent or Art. 9(2) exception (GDPR Art. 9)');
    requiredActions.push('Apply data minimisation and purpose limitation principles (GDPR Art. 5)');
  }
  if (euAiActRisk === 'high') {
    requiredActions.push('EU AI Act Art. 10–17: High-risk AI system — mandatory risk management, data governance, and human oversight');
    requiredActions.push('EU AI Act Art. 13: Provide transparency documentation to deployers and users');
  } else if (euAiActRisk === 'limited') {
    requiredActions.push('EU AI Act Art. 50: Disclose AI-generated content to end users (transparency obligation)');
  }
  if (hasGovernment) {
    requiredActions.push('Verify user authorisation before processing or displaying government-classified data');
    requiredActions.push('Apply need-to-know access controls; log all access to classified records');
  }
  if (triggeredRegs.has('HIPAA')) {
    requiredActions.push('PHI detected — apply HIPAA Minimum Necessary standard; ensure Business Associate Agreement is in place');
  }

  return {
    triggeredLaws: [...triggeredRegs].sort(),
    dpdpTier,
    euAiActRisk,
    requiredActions,
    governmentDataDetected: hasGovernment,
    sensitiveCategoryDetected: hasSensitive,
  };
}

// ─── Value masker (shows first + last 20%, replaces middle with ***) ──────────
function maskValue(raw) {
  const v = raw.trim();
  if (v.length <= 6) return '***';
  const show = Math.max(2, Math.ceil(v.length * 0.2));
  return v.slice(0, show) + '***' + v.slice(-show);
}

// ─── Core scan ────────────────────────────────────────────────────────────────
function scanForPII(text) {
  const findings = [];

  for (const def of PII_PATTERNS) {
    const regex = new RegExp(def.pattern.source, def.pattern.flags.includes('g') ? def.pattern.flags : def.pattern.flags + 'g');
    const rawMatches = [...text.matchAll(regex)];
    if (rawMatches.length === 0) continue;

    const uniqueValues = [...new Set(rawMatches.map(m => m[0]))];
    const examples = uniqueValues.slice(0, 5).map(maskValue);

    findings.push({
      id:          def.id,
      label:       def.label,
      category:    def.category,
      severity:    def.severity,
      description: def.description,
      regulations: def.regulations || [],
      count:       rawMatches.length,
      examples,
    });
  }

  return findings;
}

// ─── Routes ───────────────────────────────────────────────────────────────────

// POST /api/pii-scan/analyze
router.post('/pii-scan/analyze', authMiddleware, async (req, res) => {
  try {
    const { text, label } = req.body;

    if (!text || typeof text !== 'string') {
      return res.status(400).json({ error: 'text field is required' });
    }
    if (text.length > 50000) {
      return res.status(400).json({ error: 'Input too large (max 50 000 characters)' });
    }

    const findings  = scanForPII(text);
    const score     = calcScore(findings);
    const riskLevel = scoreToRisk(score);

    const categoryBreakdown = {};
    for (const f of findings) {
      categoryBreakdown[f.category] = (categoryBreakdown[f.category] || 0) + f.count;
    }

    await PIIScanLog.create({
      userId:       req.user?.id || req.user?._id,
      label:        label || 'Unnamed scan',
      score,
      riskLevel,
      findingCount: findings.length,
      summary:      findings.length
        ? findings.map(f => f.label).join(', ')
        : 'No PII detected',
    });

    res.json({
      score,
      riskLevel,
      findings,
      categoryBreakdown,
      scannedLength:     text.length,
      complianceSummary: buildComplianceSummary(findings),
    });
  } catch (err) {
    console.error('PII scan error:', err);
    res.status(500).json({ error: 'Scan failed' });
  }
});

// GET /api/pii-scan/history
router.get('/pii-scan/history', authMiddleware, async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id;
    const logs = await PIIScanLog
      .find({ userId })
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();
    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch history' });
  }
});

// GET /api/pii-scan/patterns  (catalog for frontend reference)
router.get('/pii-scan/patterns', (_req, res) => {
  res.json(
    PII_PATTERNS.map(({ id, label, category, severity, description, regulations }) => ({
      id, label, category, severity, description, regulations,
    }))
  );
});

export default router;
