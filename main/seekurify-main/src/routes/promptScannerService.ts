// services/promptScannerService.ts
// AI analysis service — uses your existing LLM provider fallback pattern
// Supports: Anthropic Claude → Google Gemini → fallback graceful degradation

import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenerativeAI } from "@google/generative-ai";

export interface AIScanResult {
  summary: string;
  recommendations: string[];
  sanitizedPrompt: string;
  hasSensitive: boolean;
  categories: string[];
}

// ─── System prompt ─────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are a privacy and security analyst embedded in Seekurify, a cybersecurity platform.

The user will send you a prompt they intend to submit to an external AI model (ChatGPT, Gemini, Copilot, etc.).

Your tasks:
1. Identify all privacy risks: PII, credentials, confidential business data, legal documents, medical info, financial data, API keys, internal IP addresses.
2. Write a 2-3 sentence plain-language summary of the risks for a non-technical user.
3. List 3-4 short, actionable recommendations (each under 15 words).
4. If sensitive data is present, produce a sanitized version that replaces sensitive parts with safe placeholders like [NAME], [EMAIL], [COMPANY], [AMOUNT], etc. Preserve the original intent of the prompt.
5. List the broad risk categories found (e.g. "PII", "Credentials", "Legal", "Financial", "Medical").

Respond ONLY with valid JSON. No markdown fences, no preamble, no explanation outside JSON.

JSON schema:
{
  "summary": "string",
  "recommendations": ["string", "string", "string"],
  "sanitizedPrompt": "string",
  "hasSensitive": boolean,
  "categories": ["string"]
}

If nothing sensitive is found, set hasSensitive to false and sanitizedPrompt to "".`;

// ─── Provider: Anthropic ───────────────────────────────────────────────────────

async function analyzeWithAnthropic(prompt: string): Promise<AIScanResult> {
  const client = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY!,
  });

  const message = await client.messages.create({
    model: "claude-3-5-haiku-20241022", // fast + cheap for this use case
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: prompt }],
  });

  const raw = message.content
    .filter((b) => b.type === "text")
    .map((b) => (b as { type: "text"; text: string }).text)
    .join("");

  return parseResponse(raw);
}

// ─── Provider: Google Gemini ───────────────────────────────────────────────────

async function analyzeWithGemini(prompt: string): Promise<AIScanResult> {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

  const result = await model.generateContent(
    `${SYSTEM_PROMPT}\n\nPrompt to analyze:\n${prompt}`
  );

  const raw = result.response.text();
  return parseResponse(raw);
}

// ─── Response parser ───────────────────────────────────────────────────────────

function parseResponse(raw: string): AIScanResult {
  try {
    const clean = raw.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(clean) as AIScanResult;

    // Validate and normalize
    return {
      summary: parsed.summary || "Analysis complete.",
      recommendations: Array.isArray(parsed.recommendations)
        ? parsed.recommendations
        : [],
      sanitizedPrompt: parsed.sanitizedPrompt || "",
      hasSensitive: Boolean(parsed.hasSensitive),
      categories: Array.isArray(parsed.categories) ? parsed.categories : [],
    };
  } catch {
    return {
      summary: raw.slice(0, 300),
      recommendations: ["Review your prompt for any personal information before sending."],
      sanitizedPrompt: "",
      hasSensitive: false,
      categories: [],
    };
  }
}

// ─── Main export with provider fallback ───────────────────────────────────────

export async function analyzePromptPrivacy(prompt: string): Promise<AIScanResult> {
  // Try Anthropic first
  if (process.env.ANTHROPIC_API_KEY) {
    try {
      return await analyzeWithAnthropic(prompt);
    } catch (err) {
      console.warn("[PromptScanner] Anthropic failed, trying Gemini:", err);
    }
  }

  // Fallback to Gemini
  if (process.env.GEMINI_API_KEY) {
    try {
      return await analyzeWithGemini(prompt);
    } catch (err) {
      console.warn("[PromptScanner] Gemini also failed:", err);
    }
  }

  // Graceful degradation — return a helpful message without crashing
  console.error("[PromptScanner] All LLM providers failed");
  return {
    summary:
      "AI analysis is temporarily unavailable. Local pattern detection results are shown above.",
    recommendations: [
      "Remove personal names and emails before submitting.",
      "Never include API keys or passwords in AI prompts.",
      "Use placeholder values for confidential company names.",
      "Avoid sharing medical or financial data with external AI models.",
    ],
    sanitizedPrompt: "",
    hasSensitive: false,
    categories: [],
  };
}