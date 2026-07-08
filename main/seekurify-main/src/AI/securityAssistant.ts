// ============================================================
// Seekurify — Context-Aware AI Security Assistant
// File: services/securityAssistant.ts
// ============================================================

import { completion } from "litellm";

// ─── Types ───────────────────────────────────────────────────

export interface UserSecurityContext {
  securityScore: number;          // 0–100
  weakPasswords: number;
  reusedPasswords: number;
  breachedEmails: string[];
  recentAlerts: SecurityAlert[];
  recentPhishingScans: PhishingScanSummary[];
  recentLinkScans: LinkScanSummary[];
  loginAnomalies: LoginAnomaly[];
  lastPasswordChange?: Date;
  twoFactorEnabled: boolean;
}

export interface SecurityAlert {
  type: string;
  severity: "low" | "medium" | "high" | "critical";
  message: string;
  timestamp: Date;
  resolved: boolean;
}

export interface PhishingScanSummary {
  timestamp: Date;
  verdict: "safe" | "suspicious" | "phishing";
  senderEmail?: string;
  phishingProbability: number;
}

export interface LinkScanSummary {
  timestamp: Date;
  url: string;
  result: "safe" | "suspicious" | "malicious";
}

export interface LoginAnomaly {
  timestamp: Date;
  type: "new_device" | "unusual_time" | "multiple_failures" | "impossible_travel";
  description: string;
  severity: "low" | "medium" | "high";
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface AssistantResponse {
  message: string;
  suggestedActions?: SuggestedAction[];
  relatedAlerts?: SecurityAlert[];
  urgencyLevel: "none" | "low" | "medium" | "high" | "critical";
}

export interface SuggestedAction {
  label: string;
  action: string;         // e.g. "change_password", "enable_2fa", "review_login"
  targetId?: string;      // e.g. password ID or alert ID
  priority: "low" | "medium" | "high";
}

// ─── System Prompt Builder ───────────────────────────────────

function buildSystemPrompt(context: UserSecurityContext): string {
  const recentAlertsText =
    context.recentAlerts.length > 0
      ? context.recentAlerts
          .slice(0, 5)
          .map(
            (a) =>
              `- [${a.severity.toUpperCase()}] ${a.type}: ${a.message} (${formatRelativeTime(a.timestamp)}) — ${a.resolved ? "Resolved" : "UNRESOLVED"}`
          )
          .join("\n")
      : "No recent alerts.";

  const phishingText =
    context.recentPhishingScans.length > 0
      ? context.recentPhishingScans
          .slice(0, 3)
          .map(
            (s) =>
              `- ${s.verdict.toUpperCase()} (${s.phishingProbability}% probability) from ${s.senderEmail || "unknown"} — ${formatRelativeTime(s.timestamp)}`
          )
          .join("\n")
      : "No recent phishing scans.";

  const linkText =
    context.recentLinkScans.length > 0
      ? context.recentLinkScans
          .slice(0, 3)
          .map(
            (l) =>
              `- ${l.url} → ${l.result.toUpperCase()} (${formatRelativeTime(l.timestamp)})`
          )
          .join("\n")
      : "No recent link scans.";

  const anomalyText =
    context.loginAnomalies.length > 0
      ? context.loginAnomalies
          .slice(0, 3)
          .map(
            (a) =>
              `- [${a.severity.toUpperCase()}] ${a.type}: ${a.description} (${formatRelativeTime(a.timestamp)})`
          )
          .join("\n")
      : "No login anomalies detected.";

  return `You are Seekurify's AI Security Assistant — a friendly, expert cybersecurity advisor built into the Seekurify platform. 

Your role is to:
1. Answer the user's cybersecurity questions with expert knowledge
2. Always relate your answers to the user's ACTUAL security situation shown below
3. Be proactive — if the user asks a general question but their data shows a related risk, mention it
4. Use plain English — avoid jargon unless the user asks for technical details
5. Be concise but complete — don't overwhelm, prioritize what matters most
6. Never be alarmist, but never downplay real risks

═══ USER'S CURRENT SECURITY CONTEXT ═══

Security Score: ${context.securityScore}/100
2FA Enabled: ${context.twoFactorEnabled ? "Yes ✅" : "No ⚠️"}
Weak Passwords: ${context.weakPasswords}
Reused Passwords: ${context.reusedPasswords}
Breached Emails: ${context.breachedEmails.length > 0 ? context.breachedEmails.join(", ") : "None detected"}
Last Password Change: ${context.lastPasswordChange ? formatRelativeTime(context.lastPasswordChange) : "Unknown"}

RECENT SECURITY ALERTS:
${recentAlertsText}

RECENT PHISHING SCANS:
${phishingText}

RECENT LINK SCANS:
${linkText}

LOGIN ANOMALIES:
${anomalyText}

═══════════════════════════════════════

When responding, end your message with a JSON block on a new line in this exact format if there are actions to suggest:
ACTIONS_JSON:{"suggestedActions":[{"label":"...","action":"...","priority":"..."}],"urgencyLevel":"none|low|medium|high|critical"}

If no actions are needed, end with:
ACTIONS_JSON:{"suggestedActions":[],"urgencyLevel":"none"}`;
}

// ─── Response Parser ─────────────────────────────────────────

function parseAssistantResponse(rawResponse: string): AssistantResponse {
  const actionsMarker = "ACTIONS_JSON:";
  const markerIndex = rawResponse.lastIndexOf(actionsMarker);

  let message = rawResponse;
  let suggestedActions: SuggestedAction[] = [];
  let urgencyLevel: AssistantResponse["urgencyLevel"] = "none";

  if (markerIndex !== -1) {
    message = rawResponse.substring(0, markerIndex).trim();
    const jsonStr = rawResponse.substring(markerIndex + actionsMarker.length).trim();
    try {
      const parsed = JSON.parse(jsonStr);
      suggestedActions = parsed.suggestedActions || [];
      urgencyLevel = parsed.urgencyLevel || "none";
    } catch {
      // If JSON parse fails, just use the full message
      message = rawResponse;
    }
  }

  return { message, suggestedActions, urgencyLevel };
}

// ─── Core Chat Function ──────────────────────────────────────

export async function chatWithSecurityAssistant(
  userMessage: string,
  conversationHistory: ChatMessage[],
  userContext: UserSecurityContext
): Promise<AssistantResponse> {
  const systemPrompt = buildSystemPrompt(userContext);

  // Build messages array from history + new message
  const messages = [
    { role: "system" as const, content: systemPrompt },
    ...conversationHistory.map((msg) => ({
      role: msg.role as "user" | "assistant",
      content: msg.content,
    })),
    { role: "user" as const, content: userMessage },
  ];

  const litellmBase = process.env.LITELLM_API_BASE;
  const litellmKey = process.env.LITELLM_API_KEY;

  if (!litellmBase || !litellmKey || process.env.NODE_ENV === "production") {
    return {
      message:
        "The Security Assistant is currently unavailable. Please configure a cloud AI provider (Anthropic, OpenAI, or Google AI) to enable this feature in production.",
      suggestedActions: [],
      urgencyLevel: "none",
    };
  }

  const response = await completion({
    model: process.env.LITELLM_MODEL || "claude-opus-4-6",
    max_tokens: 1024,
    messages,
    apiKey: litellmKey,
    baseURL: litellmBase,
  } as any);

  const rawText = (response.choices[0].message.content || "") as string;

  return parseAssistantResponse(rawText);
}

// ─── Quick Security Summary (no conversation needed) ─────────

export async function getSecuritySummary(
  context: UserSecurityContext
): Promise<AssistantResponse> {
  return chatWithSecurityAssistant(
    "Give me a quick summary of my current security status and the most important thing I should do right now.",
    [],
    context
  );
}

// ─── Helper ──────────────────────────────────────────────────

function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - new Date(date).getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins} minutes ago`;
  if (diffHours < 24) return `${diffHours} hours ago`;
  if (diffDays === 1) return "yesterday";
  return `${diffDays} days ago`;
}
