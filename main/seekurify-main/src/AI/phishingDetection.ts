// ============================================================
// Seekurify — AI-Powered Phishing Detection Service
// File: services/phishingDetection.ts
// ============================================================

import { completion } from "litellm";
import { GoogleGenerativeAI } from "@google/generative-ai";

// ─── Provider selection (same priority order as bot.ts) ──────
// LITELLM_API_KEY → GOOGLE_AI_API_KEY → ANTHROPIC_API_KEY
const _litellmApiKey   = process.env.LITELLM_API_KEY;
const _googleApiKey    = process.env.GOOGLE_AI_API_KEY;
const _anthropicApiKey = process.env.ANTHROPIC_API_KEY;

type Provider = "litellm" | "google" | "anthropic" | "none";
let _provider: Provider = "none";
let _litellmModel = process.env.LITELLM_MODEL || "claude-opus-4-6";
let _genAI: GoogleGenerativeAI | null = null;

if (_litellmApiKey) {
  _provider = "litellm";
} else if (_googleApiKey) {
  _provider = "google";
  _genAI = new GoogleGenerativeAI(_googleApiKey);
} else if (_anthropicApiKey) {
  _provider = "anthropic";
} else {
  console.error("❌ [phishingDetection] No AI API key found. Set LITELLM_API_KEY, GOOGLE_AI_API_KEY, or ANTHROPIC_API_KEY.");
}

console.log(`[phishingDetection] Provider: ${_provider}`);

// ─── Internal AI caller ───────────────────────────────────────
async function callPhishingAI(prompt: string, maxTokens = 1024): Promise<string> {
  if (_provider === "google" && _genAI) {
    const model = _genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
    const result = await model.generateContent({ contents: [{ role: 'user', parts: [{ text: prompt }] }], generationConfig: { maxOutputTokens: maxTokens } });
    return result.response.text().trim();
  }
  if (_provider === "litellm") {
    const res = await completion({
      model: _litellmModel,
      max_tokens: maxTokens,
      messages: [{ role: "user", content: prompt }],
      apiKey: _litellmApiKey,
    } as any);
    return ((res.choices[0].message.content) || "") as string;
  }
  // anthropic (or none — will fail fast with a clear error)
  const res = await completion({
    model: "claude-opus-4-6",
    max_tokens: maxTokens,
    messages: [{ role: "user", content: prompt }],
    apiKey: _anthropicApiKey,
  } as any);
  return ((res.choices[0].message.content) || "") as string;
}

// ─── Types ───────────────────────────────────────────────────

export interface PhishingAnalysisInput {
  emailSubject?: string;
  emailBody?: string;
  emailHeader?: string;
  senderEmail?: string;
  senderDisplayName?: string;
  urls?: string[];
}

export interface PhishingIndicator {
  type: string;
  description: string;
  severity: "low" | "medium" | "high" | "critical";
}

export interface PhishingAnalysisResult {
  phishingProbability: number; // 0–100
  verdict: "safe" | "suspicious" | "phishing";
  confidenceLevel: "low" | "medium" | "high";
  indicators: PhishingIndicator[];
  senderAnalysis: {
    displayNameMismatch: boolean;
    domainReputation: string;
    spoofingDetected: boolean;
  };
  urlAnalysis: {
    suspiciousUrls: string[];
    typosquattingDetected: boolean;
  };
  explanation: string;       // plain English for end user
  recommendations: string[]; // actionable next steps
  rawAiResponse?: string;
  spearPhishingAnalysis?: {
    isTargeted: boolean;
    personalizationDepth: 'none' | 'low' | 'high';
    aiGeneratedProbability: number;
    attackVector: 'credential_harvest' | 'wire_transfer' | 'malware_delivery' | 'data_exfil' | 'unknown';
    suspiciousAbsences: string[];
    lookalikeDomains: { domain: string; closestMatch: string; technique: string }[];
  };
}

export interface SpearPhishingInput extends PhishingAnalysisInput {
  recipientName?: string;
  recipientCompany?: string;
  recipientRole?: string;
}

// ─── Prompt Builder ──────────────────────────────────────────

function buildPhishingPrompt(input: PhishingAnalysisInput): string {
  return `You are an expert cybersecurity analyst specializing in phishing email detection. 
Analyze the following email data and return a structured JSON response ONLY — no preamble, no markdown fences.

EMAIL DATA:
${input.senderDisplayName ? `Sender Display Name: ${input.senderDisplayName}` : ""}
${input.senderEmail ? `Sender Email: ${input.senderEmail}` : ""}
${input.emailSubject ? `Subject: ${input.emailSubject}` : ""}
${input.emailHeader ? `Headers:\n${input.emailHeader}` : ""}
${input.emailBody ? `Body:\n${input.emailBody}` : ""}
${input.urls && input.urls.length > 0 ? `URLs found:\n${input.urls.join("\n")}` : ""}

Analyze for:
1. Urgency/fear/reward language manipulation
2. Sender spoofing (display name vs actual email domain mismatch)
3. Typosquatting in domains (e.g. paypa1.com vs paypal.com)
4. Suspicious URL patterns (shortened URLs, IP-based URLs, HTTP instead of HTTPS)
5. Requests for credentials, personal info, or financial details
6. Grammar and spelling patterns common in phishing
7. Impersonation of known brands or organizations
8. Mismatched or suspicious links (link text vs actual href)

Return ONLY this JSON structure:
{
  "phishingProbability": <number 0-100>,
  "verdict": "<safe|suspicious|phishing>",
  "confidenceLevel": "<low|medium|high>",
  "indicators": [
    {
      "type": "<indicator category>",
      "description": "<specific finding>",
      "severity": "<low|medium|high|critical>"
    }
  ],
  "senderAnalysis": {
    "displayNameMismatch": <boolean>,
    "domainReputation": "<trusted|unknown|suspicious|malicious>",
    "spoofingDetected": <boolean>
  },
  "urlAnalysis": {
    "suspiciousUrls": ["<url1>", "<url2>"],
    "typosquattingDetected": <boolean>
  },
  "explanation": "<2-3 sentence plain English summary for a non-technical user>",
  "recommendations": ["<action 1>", "<action 2>", "<action 3>"]
}`;
}

// ─── Core Analysis Function ──────────────────────────────────

export async function analyzePhishingEmail(
  input: PhishingAnalysisInput
): Promise<PhishingAnalysisResult> {
  if (
    !input.emailBody &&
    !input.emailHeader &&
    !input.emailSubject &&
    !input.senderEmail
  ) {
    throw new Error(
      "At least one of emailBody, emailHeader, emailSubject, or senderEmail is required."
    );
  }

  const prompt = buildPhishingPrompt(input);

  const rawText = await callPhishingAI(prompt);

  // Strip any accidental markdown fences just in case
  const cleanJson = rawText
    .replace(/```json\n?/g, "")
    .replace(/```\n?/g, "")
    .trim();

  let parsed: PhishingAnalysisResult;
  try {
    parsed = JSON.parse(cleanJson);
  } catch {
    throw new Error(`Failed to parse AI response as JSON: ${rawText}`);
  }

  parsed.rawAiResponse = rawText;
  return parsed;
}

// ─── Spear Phishing Analysis ─────────────────────────────────

function buildSpearPhishingPrompt(input: SpearPhishingInput): string {
  const recipientContext = [
    input.recipientName    ? `Recipient Name: ${input.recipientName}`    : null,
    input.recipientCompany ? `Recipient Company: ${input.recipientCompany}` : null,
    input.recipientRole    ? `Recipient Role: ${input.recipientRole}`    : null,
  ].filter(Boolean).join('\n');

  return `You are a cybersecurity expert specializing in detecting AI-generated spear phishing emails — targeted attacks with PERFECT grammar and DELIBERATE personalization designed to fool standard filters.

Your task is to look for the OPPOSITE signals of mass phishing: suspicious ABSENCE of errors, suspiciously researched personalization, and attack-vector precision.

EMAIL DATA:
${input.senderDisplayName ? `Sender Display Name: ${input.senderDisplayName}` : ''}
${input.senderEmail ? `Sender Email: ${input.senderEmail}` : ''}
${input.emailSubject ? `Subject: ${input.emailSubject}` : ''}
${input.emailBody ? `Body:\n${input.emailBody}` : ''}
${input.urls && input.urls.length > 0 ? `URLs found:\n${input.urls.join('\n')}` : ''}
${recipientContext ? `\nKNOWN RECIPIENT CONTEXT:\n${recipientContext}` : ''}

Analyze for spear phishing signals:
1. PERSONALIZATION DEPTH: Does the email reference specific names, roles, company details, or recent events that required research? Generic emails say "Dear Customer"; spear phish says "Hi John" and mentions your company.
2. SUSPICIOUS ABSENCES: Note red flags that are MISSING — no grammar errors (unusual for mass phishing), no urgency pressure, no generic greeting, professional formatting. Absence of typical phishing signals in a suspicious email is itself a signal.
3. AI-GENERATED PROBABILITY: Uniform sentence structure, no idioms, over-formal tone, consistent paragraph length — signs of LLM-generated text.
4. ATTACK VECTOR: What does this email want? Credential harvest (click to login), wire transfer (send money), malware delivery (open attachment/link), data exfiltration (reply with info)?
5. CONTEXT COHERENCE: Does the pretext make sense for the recipient's role? A "vendor invoice" sent to a Finance Manager is more plausible than one sent to a developer.

Return ONLY this JSON (no markdown, no preamble):
{
  "phishingProbability": <number 0-100>,
  "verdict": "<safe|suspicious|phishing>",
  "confidenceLevel": "<low|medium|high>",
  "indicators": [
    { "type": "<category>", "description": "<finding>", "severity": "<low|medium|high|critical>" }
  ],
  "senderAnalysis": {
    "displayNameMismatch": <boolean>,
    "domainReputation": "<trusted|unknown|suspicious|malicious>",
    "spoofingDetected": <boolean>
  },
  "urlAnalysis": {
    "suspiciousUrls": ["<url>"],
    "typosquattingDetected": <boolean>
  },
  "explanation": "<2-3 sentence plain English summary>",
  "recommendations": ["<action 1>", "<action 2>"],
  "spearPhishingAnalysis": {
    "isTargeted": <boolean>,
    "personalizationDepth": "<none|low|high>",
    "aiGeneratedProbability": <number 0-100>,
    "attackVector": "<credential_harvest|wire_transfer|malware_delivery|data_exfil|unknown>",
    "suspiciousAbsences": ["<observation about missing red flags>"],
    "lookalikeDomains": [{ "domain": "<spoofed>", "closestMatch": "<legit>", "technique": "<description>" }]
  }
}`;
}

export async function analyzeSpearPhishing(input: SpearPhishingInput): Promise<PhishingAnalysisResult> {
  if (!input.emailBody && !input.emailSubject && !input.senderEmail) {
    throw new Error('At least one of emailBody, emailSubject, or senderEmail is required.');
  }

  const prompt = buildSpearPhishingPrompt(input);
  const rawText = await callPhishingAI(prompt, 1500);
  const cleanJson = rawText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

  let parsed: PhishingAnalysisResult;
  try {
    parsed = JSON.parse(cleanJson);
  } catch {
    throw new Error(`Failed to parse AI spear phishing response: ${rawText}`);
  }

  parsed.rawAiResponse = rawText;
  return parsed;
}

// ─── Batch Analysis (multiple emails) ────────────────────────

export async function analyzeBatchEmails(
  emails: PhishingAnalysisInput[]
): Promise<PhishingAnalysisResult[]> {
  const results = await Promise.allSettled(
    emails.map((email) => analyzePhishingEmail(email))
  );

  return results.map((result, index) => {
    if (result.status === "fulfilled") return result.value;
    console.error(`Email ${index} analysis failed:`, result.reason);
    // Return a safe default on failure
    return {
      phishingProbability: 0,
      verdict: "safe" as const,
      confidenceLevel: "low" as const,
      indicators: [],
      senderAnalysis: {
        displayNameMismatch: false,
        domainReputation: "unknown",
        spoofingDetected: false,
      },
      urlAnalysis: { suspiciousUrls: [], typosquattingDetected: false },
      explanation: "Analysis failed for this email.",
      recommendations: ["Please try again or review manually."],
    };
  });
}
