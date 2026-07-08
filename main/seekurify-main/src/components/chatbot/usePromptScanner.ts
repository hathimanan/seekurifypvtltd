// usePromptScanner.ts
// React hook — manages scan state using local pattern detection only

import { useState, useCallback } from "react";
import { runLocalScan, generateLocalAnalysis, LocalScanResult, LocalAnalysis } from "./detectors.ts";

export interface ScanState {
  status: "idle" | "done";
  localResult: LocalScanResult | null;
  analysis: LocalAnalysis | null;
}

export function usePromptScanner() {
  const [state, setState] = useState<ScanState>({
    status: "idle",
    localResult: null,
    analysis: null,
  });

  const scan = useCallback((prompt: string) => {
    if (!prompt.trim()) return;
    const localResult = runLocalScan(prompt);
    const analysis = generateLocalAnalysis(localResult, prompt);
    setState({ status: "done", localResult, analysis });
  }, []);

  const reset = useCallback(() => {
    setState({ status: "idle", localResult: null, analysis: null });
  }, []);

  return { state, scan, reset };
}