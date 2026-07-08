// ============================================================
// Seekurify — API Routes
// File: routes/aiRoutes.ts
// ============================================================

import { Router } from "express";
import type { Request, Response } from "express";
import {
  analyzePhishingEmail,
  analyzeBatchEmails,
} from "./phishingDetection.ts";
import type { PhishingAnalysisInput } from "./phishingDetection.ts";
import {
  chatWithSecurityAssistant,
  getSecuritySummary,
} from "./securityAssistant.ts";
import type { ChatMessage, UserSecurityContext } from "./securityAssistant.ts";
// @ts-ignore — JS model file
import Conversation from "../models/Conversation.js";

const router = Router();

// ════════════════════════════════════════════════════════════
// PHISHING DETECTION ROUTES
// ════════════════════════════════════════════════════════════

/**
 * POST /api/ai/phishing/analyze
 * Analyze a single email for phishing
 *
 * Body: PhishingAnalysisInput
 * {
 *   emailSubject?: string
 *   emailBody?: string
 *   emailHeader?: string
 *   senderEmail?: string
 *   senderDisplayName?: string
 *   urls?: string[]
 * }
 */
router.post("/phishing/analyze", async (req: Request, res: Response) => {
  try {
    const input: PhishingAnalysisInput = req.body;

    if (
      !input.emailBody &&
      !input.emailHeader &&
      !input.emailSubject &&
      !input.senderEmail
    ) {
      return res.status(400).json({
        error:
          "At least one of emailBody, emailHeader, emailSubject, or senderEmail is required.",
      });
    }

    const result = await analyzePhishingEmail(input);

    // Log to SIEM (integrate with your existing logging)
    // await logSIEMEvent({
    //   userId: req.user?.id,
    //   eventType: "phishing_scan",
    //   severity: result.verdict === "phishing" ? "high" : "low",
    //   details: { verdict: result.verdict, probability: result.phishingProbability }
    // });

    return res.status(200).json({ success: true, data: result });
  } catch (error: any) {
    console.error("Phishing analysis error:", error);
    const msg: string = error?.message || String(error);
    if (msg.includes("credit balance is too low") || msg.includes("insufficient_quota") || (error?.status === 400 && msg.includes("credit"))) {
      return res.status(402).json({
        error: "AI service unavailable: Anthropic API credit balance is too low. Please top up at console.anthropic.com.",
      });
    }
    return res.status(500).json({
      error: "Failed to analyze email.",
      details: error.message,
    });
  }
});

/**
 * POST /api/ai/phishing/batch
 * Analyze multiple emails at once
 *
 * Body: { emails: PhishingAnalysisInput[] }
 */
router.post("/phishing/batch", async (req: Request, res: Response) => {
  try {
    const { emails } = req.body;

    if (!Array.isArray(emails) || emails.length === 0) {
      return res
        .status(400)
        .json({ error: "emails must be a non-empty array." });
    }

    if (emails.length > 10) {
      return res
        .status(400)
        .json({ error: "Maximum 10 emails per batch request." });
    }

    const results = await analyzeBatchEmails(emails);
    return res.status(200).json({ success: true, data: results });
  } catch (error: any) {
    console.error("Batch phishing analysis error:", error);
    const msg: string = error?.message || String(error);
    if (msg.includes("credit balance is too low") || (error?.status === 400 && msg.includes("credit"))) {
      return res.status(402).json({ error: "AI service unavailable: Anthropic API credit balance is too low." });
    }
    return res
      .status(500)
      .json({ error: "Batch analysis failed.", details: error.message });
  }
});

// ════════════════════════════════════════════════════════════
// SECURITY ASSISTANT ROUTES
// ════════════════════════════════════════════════════════════

/**
 * POST /api/ai/assistant/chat
 * Send a message to the context-aware security assistant
 *
 * Body: {
 *   message: string
 *   sessionId: string          // unique per user session
 *   userContext: UserSecurityContext
 * }
 */
router.post("/assistant/chat", async (req: Request, res: Response) => {
  try {
    const { message, sessionId, userContext } = req.body;

    if (!message || typeof message !== "string") {
      return res.status(400).json({ error: "message is required." });
    }

    if (!sessionId) {
      return res.status(400).json({ error: "sessionId is required." });
    }

    if (!userContext) {
      return res.status(400).json({ error: "userContext is required." });
    }

    // Get or initialize conversation history from MongoDB
    const doc = await Conversation.findOne({ sessionId });
    const history: ChatMessage[] = doc?.messages ?? [];

    // Get AI response
    const response = await chatWithSecurityAssistant(
      message,
      history,
      userContext as UserSecurityContext
    );

    // Update conversation history, keeping last 20 messages to avoid token overflow
    const updatedHistory: ChatMessage[] = [
      ...history,
      { role: "user" as const, content: message },
      { role: "assistant" as const, content: response.message },
    ].slice(-20);

    await Conversation.findOneAndUpdate(
      { sessionId },
      { messages: updatedHistory, updatedAt: new Date() },
      { upsert: true }
    );

    return res.status(200).json({ success: true, data: response });
  } catch (error: any) {
    console.error("Assistant chat error:", error);
    return res
      .status(500)
      .json({ error: "Assistant failed to respond.", details: error.message });
  }
});

/**
 * POST /api/ai/assistant/summary
 * Get a quick security summary for the user's dashboard
 *
 * Body: { userContext: UserSecurityContext }
 */
router.post("/assistant/summary", async (req: Request, res: Response) => {
  try {
    const { userContext } = req.body;

    if (!userContext) {
      return res.status(400).json({ error: "userContext is required." });
    }

    const summary = await getSecuritySummary(userContext as UserSecurityContext);
    return res.status(200).json({ success: true, data: summary });
  } catch (error: any) {
    console.error("Security summary error:", error);
    return res
      .status(500)
      .json({ error: "Failed to generate summary.", details: error.message });
  }
});

/**
 * DELETE /api/ai/assistant/session/:sessionId
 * Clear conversation history for a session
 */
router.delete(
  "/assistant/session/:sessionId",
  async (req: Request, res: Response) => {
    const { sessionId } = req.params;
    await Conversation.deleteOne({ sessionId });
    return res
      .status(200)
      .json({ success: true, message: "Session cleared." });
  }
);

export default router;
