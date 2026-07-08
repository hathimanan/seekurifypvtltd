// detectors.ts
// Local regex-based PII and sensitive data detection engine
// Runs entirely in the browser — zero data leaves until user chooses to scan with AI

export type Severity = "critical" | "warning" | "info";

export interface Detector {
  id: string;
  label: string;
  description: string;
  regex: RegExp;
  severity: Severity;
  scoreWeight: number; // contribution to risk score (0-100 total)
}

export interface DetectionHit {
  detector: Detector;
  matches: string[];
  count: number;
}

export interface LocalScanResult {
  hits: DetectionHit[];
  score: number; // 0-100
  riskLevel: "safe" | "moderate" | "high";
  // Base64/encoded strings in original text whose decoded form triggered a hit
  encodedRedactions: Array<{ original: string; detectorId: string }>;
}

export const DETECTORS: Detector[] = [
  {
    id: "email",
    label: "Email address",
    description: "Personal or corporate email addresses",
    regex: /\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-z]{2,}\b/g,
    severity: "critical",
    scoreWeight: 25,
  },
  {
    id: "phone",
    label: "Phone number",
    description: "Mobile or landline numbers",
    // Matches +91 XXXXX XXXXX, (XXX) XXX-XXXX, XXX-XXX-XXXX — NOT 12-digit Aadhaar or 16-digit CC
    regex: /(\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]\d{3}[-.\s]\d{4}\b|\b(\+?91[-.\s]?)[6-9]\d{4}[-.\s]\d{5}\b/g,
    severity: "critical",
    scoreWeight: 20,
  },
  {
    id: "apikey",
    label: "API key / token",
    description: "API keys, bearer tokens, or secrets",
    regex:
      /\b(sk-[a-zA-Z0-9]{20,}|AIza[0-9A-Za-z\-_]{35}|gh[pousr]_[A-Za-z0-9]{36,}|Bearer\s+[A-Za-z0-9\-._~+/]{20,}|A(?:KIA|BIA|SIA|RES)[0-9A-Z]{16})\b/gi,
    severity: "critical",
    scoreWeight: 40,
  },
  {
    id: "password",
    label: "Password / credential",
    description: "Passwords or secrets in plaintext",
    regex: /\b(password|passwd|pwd|secret|token|auth)[:\s=]+\S+/gi,
    severity: "critical",
    scoreWeight: 40,
  },
  {
    id: "creditcard",
    label: "Credit card number",
    description: "16-digit card numbers",
    regex: /\b(?:\d[ -]?){13,16}\b/g,
    severity: "critical",
    scoreWeight: 35,
  },
  {
    id: "aadhaar",
    label: "Aadhaar / SSN",
    description: "Indian Aadhaar or US Social Security numbers",
    regex: /\b\d{4}\s?\d{4}\s?\d{4}\b|\b\d{3}[-\s]?\d{2}[-\s]?\d{4}\b/g,
    severity: "critical",
    scoreWeight: 35,
  },
  {
    id: "pan",
    label: "PAN card",
    description: "Indian Permanent Account Number",
    regex: /\b[A-Z]{5}[0-9]{4}[A-Z]\b/g,
    severity: "critical",
    scoreWeight: 30,
  },
  {
    id: "name",
    label: "Personal name",
    description: "Self-identified personal names",
    regex: /\b(my name is|i am|i'm|call me)\s+[A-Z][a-z]+(\s[A-Z][a-z]+)?/gi,
    severity: "warning",
    scoreWeight: 12,
  },
  {
    id: "company",
    label: "Company / org name",
    description: "Confidential company or client names",
    regex:
      /\b(at|for|from|company|corp|ltd|pvt|inc|llc)\s+[A-Z][a-zA-Z\s&]{2,30}/g,
    severity: "warning",
    scoreWeight: 10,
  },
  {
    id: "legal",
    label: "Legal / contract content",
    description: "Legal terms suggesting confidential documents",
    regex:
      /\b(clause|agreement|contract|confidential|nda|non-compete|non-disclosure|jurisdiction|liability|indemnity|arbitration|plaintiff|defendant|employment\s+contract|severance|termination|equity|vesting|intellectual\s+property|trade\s+secret)\b/gi,
    severity: "warning",
    scoreWeight: 15,
  },
  {
    id: "medical",
    label: "Medical / health info",
    description: "Protected health information",
    regex:
      /\b(diagnosis|symptoms|medication|prescription|patient|disease|disorder|therapy|dosage|hiv|cancer|diabetes|insulin|metformin|hypertension|blood pressure|type\s*[12]|chronic|condition|asthma|thyroid|depression|anxiety|epilepsy|chemotherapy|dialysis|surgery|allergy|allergic)\b/gi,
    severity: "warning",
    scoreWeight: 20,
  },
  {
    id: "financial",
    label: "Financial data",
    description: "Bank accounts, GST, currency amounts, financial figures",
    regex:
      /\b(bank account|ifsc|pan card|income|salary|invoice|gst|revenue|profit|loss|balance sheet|turnover)\b|[₹$€£]\s*[\d,]+(?:\.\d{1,2})?|\b[\d,]+\s*(lakh|crore|thousand|million|billion)\b/gi,
    severity: "warning",
    scoreWeight: 15,
  },
  {
    id: "address",
    label: "Physical address",
    description: "Home or office addresses",
    regex:
      /\b\d{1,5}\s+[A-Z][a-z]+\s+(street|road|avenue|lane|nagar|colony|sector|marg|floor|tower|wing|block|plot|gate|building|complex)\b|\b(floor|tower|wing|block|plot|gate|building|complex)\b.{0,60}\b[1-9]\d{5}\b/gi,
    severity: "warning",
    scoreWeight: 12,
  },
  {
    id: "passport",
    label: "Passport number",
    description: "Passport or travel document numbers",
    regex: /\b[A-Z]{1,2}\d{7}\b/g,
    severity: "critical",
    scoreWeight: 30,
  },
  {
    id: "webhook",
    label: "Webhook / service URL",
    description: "Slack, Discord, or other webhook URLs with embedded tokens",
    regex: /https?:\/\/hooks\.(slack|discord)\.com\/services\/[A-Za-z0-9/]+|https?:\/\/\S+\/webhooks?\/[A-Za-z0-9_\-]{20,}/gi,
    severity: "critical",
    scoreWeight: 35,
  },
  {
    id: "ip",
    label: "IP address",
    description: "Internal or public IP addresses",
    regex: /\b(\d{1,3}\.){3}\d{1,3}\b/g,
    severity: "info",
    scoreWeight: 8,
  },
  {
    id: "highentropy",
    label: "High-entropy string",
    description: "Random-looking string likely to be a secret or key",
    regex: /(?!x)x/, // never matches via regex — detected via entropy analysis
    severity: "critical",
    scoreWeight: 30,
  },
];

function extractBase64Candidates(text: string): Array<{ original: string; decoded: string }> {
  const results: Array<{ original: string; decoded: string }> = [];
  const base64Re = /[A-Za-z0-9+/]{16,}={0,2}/g;
  let m: RegExpExecArray | null;
  while ((m = base64Re.exec(text)) !== null) {
    try {
      const decoded = atob(m[0]);
      if (/^[\x20-\x7E]+$/.test(decoded)) {
        results.push({ original: m[0], decoded });
      }
    } catch {
      // not valid Base64
    }
  }
  return results;
}

function shannonEntropy(str: string): number {
  const freq: Record<string, number> = {};
  for (const c of str) freq[c] = (freq[c] || 0) + 1;
  const len = str.length;
  return Object.values(freq).reduce((sum, count) => {
    const p = count / len;
    return sum - p * Math.log2(p);
  }, 0);
}

export function runLocalScan(text: string): LocalScanResult {
  const hits: DetectionHit[] = [];
  const encodedRedactions: Array<{ original: string; detectorId: string }> = [];

  const addHit = (detector: Detector, matches: string[]) => {
    const existing = hits.find((h) => h.detector.id === detector.id);
    if (existing) {
      existing.matches = [...new Set([...existing.matches, ...matches])].slice(0, 3);
      existing.count += matches.length;
    } else {
      hits.push({ detector, matches: [...new Set(matches)].slice(0, 3), count: matches.length });
    }
  };

  const scanText = (source: string) => {
    for (const detector of DETECTORS) {
      if (detector.id === "highentropy") continue; // handled separately
      detector.regex.lastIndex = 0;
      const matches = source.match(detector.regex);
      if (matches && matches.length > 0) addHit(detector, matches);
    }
  };

  // Scan original text
  scanText(text);

  // Decode Base64 candidates and scan — track which originals trigger new hits
  for (const { original, decoded } of extractBase64Candidates(text)) {
    const idsBefore = new Set(hits.map((h) => h.detector.id));
    scanText(decoded);
    for (const h of hits) {
      if (!idsBefore.has(h.detector.id)) {
        encodedRedactions.push({ original, detectorId: h.detector.id });
      }
    }
  }

  // Entropy-based detection for high-randomness tokens not already flagged
  const alreadyFlagged = new Set(hits.flatMap((h) => h.matches));
  const tokenRe = /[A-Za-z0-9+/=_\-]{20,}/g;
  const entropyDetector = DETECTORS.find((d) => d.id === "highentropy")!;
  let tokenMatch: RegExpExecArray | null;
  while ((tokenMatch = tokenRe.exec(text)) !== null) {
    const token = tokenMatch[0];
    if (!alreadyFlagged.has(token) && shannonEntropy(token) >= 4.5) {
      addHit(entropyDetector, [token]);
      alreadyFlagged.add(token);
    }
  }

  // Score: sum of weighted hits, capped at 100
  let raw = 0;
  for (const hit of hits) {
    raw += hit.detector.scoreWeight * Math.min(hit.count, 2);
  }
  const score = Math.min(Math.round(raw), 100);
  const riskLevel = score === 0 ? "safe" : score < 40 ? "moderate" : "high";

  return { hits, score, riskLevel, encodedRedactions };
}

export interface LocalAnalysis {
  summary: string;
  recommendations: string[];
  sanitizedPrompt: string;
  hasSensitive: boolean;
}

const DETECTOR_PLACEHOLDERS: Partial<Record<string, string>> = {
  email: "[EMAIL]",
  phone: "[PHONE]",
  apikey: "[API_KEY]",
  password: "[CREDENTIAL]",
  creditcard: "[CARD_NUMBER]",
  aadhaar: "[ID_NUMBER]",
  pan: "[PAN]",
  name: "[NAME]",
  company: "[COMPANY]",
  address: "[ADDRESS]",
  ip: "[IP_ADDRESS]",
  webhook: "[WEBHOOK_URL]",
  highentropy: "[REDACTED_SECRET]",
  passport: "[PASSPORT_NUMBER]",
};

const DETECTOR_RECOMMENDATIONS: Partial<Record<string, string>> = {
  email: "Replace email addresses with a placeholder like [EMAIL].",
  phone: "Remove or mask phone numbers before submitting.",
  apikey: "Never include API keys or tokens in AI prompts — revoke and regenerate them immediately. Base64 encoding does not hide secrets.",
  password: "Remove all credentials and passwords from your prompt.",
  creditcard: "Replace card numbers with [CARD_NUMBER].",
  aadhaar: "Remove ID numbers like Aadhaar or SSN from your prompt.",
  pan: "Remove PAN card numbers from your prompt.",
  name: "Use a generic placeholder instead of real names.",
  company: "Replace company names with [COMPANY] to protect confidentiality.",
  legal: "Avoid sharing contract or legal document content with external AI.",
  medical: "Do not share medical or health information with external AI models.",
  financial: "Replace financial figures and account details with placeholders.",
  address: "Remove physical addresses from your prompt.",
  ip: "Avoid sharing internal IP addresses externally.",
  webhook: "Remove webhook URLs — they contain embedded tokens that grant API access.",
  highentropy: "A high-randomness string was detected that may be a secret, token, or key. Remove it before sending.",
  passport: "Remove passport numbers — they are government-issued identifiers and must not be shared with AI models.",
};

export function generateLocalAnalysis(result: LocalScanResult, originalPrompt: string): LocalAnalysis {
  const hasSensitive = result.hits.length > 0;

  let summary: string;
  if (!hasSensitive) {
    summary = "Your prompt looks safe — no sensitive data patterns were detected. Always review manually before sending.";
  } else {
    const labels = result.hits.map((h) => h.detector.label);
    const hasCritical = result.hits.some((h) => h.detector.severity === "critical");
    const listed = labels.slice(0, 3).join(", ");
    summary = hasCritical
      ? `Your prompt contains sensitive data including ${listed}. This information could identify you or expose confidential data if sent to an external AI model.`
      : `Your prompt contains potentially sensitive content including ${listed}. Review the flagged items before sending to an external AI.`;
  }

  const recommendations: string[] = result.hits
    .map((h) => DETECTOR_RECOMMENDATIONS[h.detector.id])
    .filter((r): r is string => Boolean(r))
    .slice(0, 4);

  if (recommendations.length === 0) {
    recommendations.push("Your prompt appears safe to send. Always double-check for sensitive data manually.");
  }

  let sanitizedPrompt = "";
  if (hasSensitive) {
    sanitizedPrompt = originalPrompt;

    // Replace directly-matched patterns
    for (const hit of result.hits) {
      if (hit.detector.id === "highentropy") continue; // handled below as literals
      const placeholder = DETECTOR_PLACEHOLDERS[hit.detector.id];
      if (placeholder) {
        hit.detector.regex.lastIndex = 0;
        sanitizedPrompt = sanitizedPrompt.replace(hit.detector.regex, placeholder);
      }
    }

    // Replace high-entropy tokens as literals (no regex)
    const entropyHit = result.hits.find((h) => h.detector.id === "highentropy");
    if (entropyHit) {
      for (const token of entropyHit.matches) {
        sanitizedPrompt = sanitizedPrompt.split(token).join("[REDACTED_SECRET]");
      }
    }

    // Replace original Base64 strings whose decoded form triggered a hit
    for (const { original, detectorId } of result.encodedRedactions) {
      const placeholder = DETECTOR_PLACEHOLDERS[detectorId] || "[REDACTED]";
      const label = placeholder.slice(1, -1); // e.g. "API_KEY"
      sanitizedPrompt = sanitizedPrompt.split(original).join(`[ENCODED_${label}]`);
    }
  }

  return { summary, recommendations, sanitizedPrompt, hasSensitive };
}

export function maskSensitiveText(text: string): string {
  let masked = text;
  for (const detector of DETECTORS) {
    if (detector.severity === "critical") {
      detector.regex.lastIndex = 0;
      masked = masked.replace(detector.regex, `[REDACTED:${detector.label.toUpperCase()}]`);
    }
  }
  return masked;
}