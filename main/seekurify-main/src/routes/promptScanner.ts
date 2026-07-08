// routes/promptScanner.ts
// Express route — receives prompt, calls LLM, returns structured analysis
// Drop this into your existing Express router setup

import { Router } from "express";
import type { Request, Response } from "express";
import { analyzePromptPrivacy } from "./promptScannerService.ts";

const router = Router();

/**
 * POST /api/prompt-scanner/analyze
 * Body: { prompt: string }
 * Returns: AIScanResult JSON
 */
router.post("/analyze", async (req: Request, res: Response) => {
  try {
    const { prompt } = req.body as { prompt?: string };

    if (!prompt || typeof prompt !== "string") {
      return res.status(400).json({ error: "prompt is required and must be a string" });
    }

    if (prompt.trim().length < 5) {
      return res.status(400).json({ error: "Prompt too short to analyze" });
    }

    // Hard cap to avoid abuse / token burn
    if (prompt.length > 8000) {
      return res.status(400).json({ error: "Prompt exceeds maximum length of 8000 characters" });
    }

    const result = await analyzePromptPrivacy(prompt);
    return res.json(result);
  } catch (err) {
    console.error("[PromptScanner] Error:", err);
    return res.status(500).json({ error: "Analysis failed. Please try again." });
  }
});

export default router;