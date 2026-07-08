import Anthropic from '@anthropic-ai/sdk';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CredentialMetadata {
  _id: string;
  website: string;
  username: string;
  category: string;
  isFinancial: boolean;
  lastChanged: string | Date | null;
  isBreached: boolean;
  breachCount: number;
  passwordLength: number;
  passwordStrengthScore: number; // 0-4: count of char classes (lower, upper, digit, special)
  reuseCount: number;            // # of OTHER credentials sharing this exact password
}

export interface RiskFactors {
  breach: number;     // 0-35
  sensitivity: number; // 0-20
  reuse: number;      // 0-20
  age: number;        // 0-15
  weakness: number;   // 0-10
}

export interface RiskScoreResult {
  _id: string;
  score: number;                // 0-100, higher = riskier
  level: 'critical' | 'high' | 'medium' | 'low' | 'safe';
  factors: RiskFactors;
  reasons: string[];            // one human-readable string per factor that contributed
  summary: string;              // Claude-generated one-sentence plain-English advice
}

// ---------------------------------------------------------------------------
// Scoring rubric
// ---------------------------------------------------------------------------

const SENSITIVITY_MAP: Record<string, number> = {
  Email:     18,
  Developer: 14,
  Work:      14,
  Finance:   20,   // category-level catch; isFinancial flag also maps to 20
  Social:    10,
  Shopping:   7,
  Streaming:  5,
  General:    5,
  Other:      5,
};

function getLevel(score: number): RiskScoreResult['level'] {
  if (score <= 20) return 'safe';
  if (score <= 40) return 'low';
  if (score <= 60) return 'medium';
  if (score <= 80) return 'high';
  return 'critical';
}

function computeFactors(meta: CredentialMetadata): { factors: RiskFactors; reasons: string[] } {
  const reasons: string[] = [];

  // --- Breach (0–35) ---
  let breach = 0;
  if (meta.isBreached) {
    if (meta.breachCount > 10_000) {
      breach = 35;
      reasons.push(`Password exposed in ${meta.breachCount.toLocaleString()} known data breaches — change immediately`);
    } else if (meta.breachCount > 100) {
      breach = 28;
      reasons.push(`Password found in ${meta.breachCount.toLocaleString()} breach records`);
    } else {
      breach = 20;
      reasons.push(`Password appears in known breach dataset(s)`);
    }
  }

  // --- Account sensitivity (0–20) ---
  let sensitivity = 0;
  if (meta.isFinancial) {
    sensitivity = 20;
    reasons.push('Financial account — a compromise can cause direct monetary loss');
  } else {
    sensitivity = SENSITIVITY_MAP[meta.category] ?? 5;
    if (sensitivity >= 18) reasons.push('Email accounts are high-value targets used for account recovery');
    else if (sensitivity >= 14) reasons.push(`${meta.category} credentials grant access to sensitive systems`);
    else if (sensitivity >= 10) reasons.push(`${meta.category} account has moderate sensitivity`);
  }

  // --- Password reuse (0–20) ---
  let reuse = 0;
  if (meta.reuseCount >= 3) {
    reuse = 20;
    reasons.push(`Password reused across ${meta.reuseCount + 1} accounts — one breach exposes all of them`);
  } else if (meta.reuseCount === 2) {
    reuse = 15;
    reasons.push('Password shared with 2 other accounts');
  } else if (meta.reuseCount === 1) {
    reuse = 10;
    reasons.push('Password reused on 1 other site');
  }

  // --- Age (0–15) ---
  let age = 0;
  if (!meta.lastChanged) {
    age = 10;
    reasons.push('Password change date unknown — treat as stale');
  } else {
    const days = Math.floor(
      (Date.now() - new Date(meta.lastChanged).getTime()) / (1000 * 60 * 60 * 24)
    );
    if (days > 365) {
      age = 15;
      reasons.push(`Password not changed in ${Math.floor(days / 365)}+ year(s)`);
    } else if (days > 180) {
      age = 11;
      reasons.push(`Password unchanged for ${days} days (over 6 months)`);
    } else if (days > 90) {
      age = 7;
      reasons.push(`Password is ${days} days old`);
    } else if (days > 30) {
      age = 3;
    }
  }

  // --- Weakness (0–10) ---
  let weakness = 0;
  const len = meta.passwordLength;
  const strength = meta.passwordStrengthScore; // 0-4

  if (len <= 6) weakness = 10;
  else if (len <= 10) weakness = 7;
  else if (len <= 14) weakness = 4;
  else if (len <= 19) weakness = 2;

  // Credit for character diversity
  if (strength >= 4) weakness = Math.max(0, weakness - 3);
  else if (strength === 3) weakness = Math.max(0, weakness - 1);

  weakness = Math.min(10, Math.max(0, weakness));
  if (weakness >= 7) reasons.push(`Weak password: ${len} chars with limited character variety`);
  else if (weakness >= 4) reasons.push(`Password could be stronger (${len} characters)`);

  return { factors: { breach, sensitivity, reuse, age, weakness }, reasons };
}

// ---------------------------------------------------------------------------
// Public: pure deterministic score (no AI)
// ---------------------------------------------------------------------------

export function scoreCredential(meta: CredentialMetadata): Omit<RiskScoreResult, 'summary'> {
  const { factors, reasons } = computeFactors(meta);
  const raw = factors.breach + factors.sensitivity + factors.reuse + factors.age + factors.weakness;
  const score = Math.min(100, Math.max(0, raw));
  return { _id: meta._id, score, level: getLevel(score), factors, reasons };
}

// ---------------------------------------------------------------------------
// Public: AI enrichment — adds a plain-English summary via Claude
// ---------------------------------------------------------------------------

export async function enrichWithAI(
  batch: Array<{ meta: CredentialMetadata; partial: Omit<RiskScoreResult, 'summary'> }>
): Promise<RiskScoreResult[]> {
  if (batch.length === 0) return [];

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return batch.map(({ partial }) => ({
      ...partial,
      summary: partial.reasons[0] ?? `Risk level: ${partial.level} (${partial.score}/100)`,
    }));
  }

  const client = new Anthropic({ apiKey });

  // Build compact batch input — one API call for all credentials
  const credentialList = batch
    .map(({ meta, partial }, i) => {
      const topReasons = partial.reasons.slice(0, 3).join('; ') || 'no major issues detected';
      return `${i + 1}. [${meta.website}] score=${partial.score}/100 level=${partial.level} issues: ${topReasons}`;
    })
    .join('\n');

  const systemPrompt =
    'You are a concise security advisor in a password manager. ' +
    'For each numbered credential below, write exactly ONE sentence (≤18 words) of plain-English advice for the end user. ' +
    'Focus on the single most important action they should take. ' +
    'Reply with ONLY a valid JSON array of strings in the same order, no extra text.';

  try {
    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 600,
      system: systemPrompt,
      messages: [{ role: 'user', content: credentialList }],
    });

    const text = response.content[0]?.type === 'text' ? response.content[0].text.trim() : '[]';
    // Extract JSON array even if Claude wraps it in markdown
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    const summaries: string[] = jsonMatch ? JSON.parse(jsonMatch[0]) : [];

    return batch.map(({ partial }, i) => ({
      ...partial,
      summary: summaries[i] ?? partial.reasons[0] ?? `Risk level: ${partial.level}`,
    }));
  } catch (err) {
    console.error('credentialRiskScorer enrichWithAI error:', (err as Error).message);
    return batch.map(({ partial }) => ({
      ...partial,
      summary: partial.reasons[0] ?? `Risk level: ${partial.level} (${partial.score}/100)`,
    }));
  }
}

// ---------------------------------------------------------------------------
// Mock credential sets — used by the test endpoint to verify the scorer
// ---------------------------------------------------------------------------

export const MOCK_CREDENTIALS: CredentialMetadata[] = [
  {
    _id: 'mock-1',
    website: 'chase.com',
    username: 'user@example.com',
    category: 'Finance',
    isFinancial: true,
    lastChanged: new Date(Date.now() - 400 * 86400_000).toISOString(), // 400 days ago
    isBreached: true,
    breachCount: 15_000,
    passwordLength: 7,
    passwordStrengthScore: 1,
    reuseCount: 2,
  },
  {
    _id: 'mock-2',
    website: 'gmail.com',
    username: 'user@gmail.com',
    category: 'Email',
    isFinancial: false,
    lastChanged: new Date(Date.now() - 10 * 86400_000).toISOString(), // 10 days ago
    isBreached: false,
    breachCount: 0,
    passwordLength: 20,
    passwordStrengthScore: 4,
    reuseCount: 0,
  },
  {
    _id: 'mock-3',
    website: 'facebook.com',
    username: 'john.doe',
    category: 'Social',
    isFinancial: false,
    lastChanged: new Date(Date.now() - 200 * 86400_000).toISOString(),
    isBreached: false,
    breachCount: 0,
    passwordLength: 8,
    passwordStrengthScore: 2,
    reuseCount: 3,
  },
  {
    _id: 'mock-4',
    website: 'netflix.com',
    username: 'user@example.com',
    category: 'Streaming',
    isFinancial: false,
    lastChanged: new Date(Date.now() - 300 * 86400_000).toISOString(),
    isBreached: false,
    breachCount: 0,
    passwordLength: 12,
    passwordStrengthScore: 3,
    reuseCount: 0,
  },
  {
    _id: 'mock-5',
    website: 'github.com',
    username: 'devuser',
    category: 'Developer',
    isFinancial: false,
    lastChanged: new Date(Date.now() - 100 * 86400_000).toISOString(),
    isBreached: true,
    breachCount: 500,
    passwordLength: 18,
    passwordStrengthScore: 4,
    reuseCount: 0,
  },
  {
    _id: 'mock-6',
    website: 'amazon.com',
    username: 'shopper@example.com',
    category: 'Shopping',
    isFinancial: false,
    lastChanged: new Date(Date.now() - 250 * 86400_000).toISOString(),
    isBreached: false,
    breachCount: 0,
    passwordLength: 10,
    passwordStrengthScore: 2,
    reuseCount: 1,
  },
  {
    _id: 'mock-7',
    website: 'company.slack.com',
    username: 'employee@company.com',
    category: 'Work',
    isFinancial: false,
    lastChanged: new Date(Date.now() - 20 * 86400_000).toISOString(),
    isBreached: false,
    breachCount: 0,
    passwordLength: 22,
    passwordStrengthScore: 4,
    reuseCount: 0,
  },
  {
    _id: 'mock-8',
    website: 'paypal.com',
    username: 'pay@example.com',
    category: 'Finance',
    isFinancial: true,
    lastChanged: new Date(Date.now() - 500 * 86400_000).toISOString(),
    isBreached: false,
    breachCount: 0,
    passwordLength: 5,
    passwordStrengthScore: 1,
    reuseCount: 0,
  },
  {
    _id: 'mock-9',
    website: 'outlook.com',
    username: 'work@outlook.com',
    category: 'Email',
    isFinancial: false,
    lastChanged: new Date(Date.now() - 150 * 86400_000).toISOString(),
    isBreached: false,
    breachCount: 0,
    passwordLength: 9,
    passwordStrengthScore: 2,
    reuseCount: 3,
  },
  {
    _id: 'mock-10',
    website: 'randomsite.com',
    username: 'newuser',
    category: 'General',
    isFinancial: false,
    lastChanged: new Date(Date.now() - 2 * 86400_000).toISOString(),
    isBreached: false,
    breachCount: 0,
    passwordLength: 24,
    passwordStrengthScore: 4,
    reuseCount: 0,
  },
];
