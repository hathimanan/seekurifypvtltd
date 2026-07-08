import React, { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ShieldAlert, Shield, AlertTriangle, CheckCircle,
  XCircle, Info, Loader2, ChevronDown, ChevronUp, Database,
  Bot, Lock, Eye, EyeOff, Zap, RotateCcw,
  FileCode, Upload, Trash2, FolderOpen,
} from "lucide-react";
import { API_BASE_URL } from "../services/api";
import Header from "./ui/Header";
import Footer from "./ui/Footer";
import { useNavigate } from "react-router-dom";
import AppSidebar from "./ui/AppSidebar";

// ─── Types ────────────────────────────────────────────────────────────────────

type RiskLevel = "safe" | "low" | "medium" | "high" | "critical";
type Severity = "critical" | "high" | "medium" | "low";

interface ProbeResult {
  id: string;
  category: string;
  description: string;
  payload: string;
  severity: Severity;
  response: string | null;
  responseError: string | null;
  analysis: {
    leaked: boolean;
    confidence: number;
    evidence: string;
    severity: string;
  };
}

interface VectorResult {
  id: string;
  category: string;
  description: string;
  payload: string;
  severity: Severity;
  simulation: {
    agentResponse?: string;
    wouldSucceed?: boolean;
    confidence?: number;
    impact?: string;
    mitigations?: string;
    error?: string;
  };
}

interface ExfilResult {
  scanType: "system_prompt_exfiltration";
  endpointUrl: string;
  score: number;
  riskLevel: RiskLevel;
  leakedCount: number;
  totalProbes: number;
  probeResults: ProbeResult[];
  timestamp: string;
}

interface RagResult {
  scanType: "rag_poisoning";
  score: number;
  riskLevel: RiskLevel;
  successCount: number;
  totalVectors: number;
  vectorResults: VectorResult[];
  timestamp: string;
}

// ─── Style maps ───────────────────────────────────────────────────────────────

const riskColors: Record<RiskLevel, string> = {
  safe:     "text-green-600 dark:text-green-400",
  low:      "text-blue-600 dark:text-blue-400",
  medium:   "text-yellow-600 dark:text-yellow-400",
  high:     "text-orange-600 dark:text-orange-400",
  critical: "text-red-600 dark:text-red-400",
};

const riskBg: Record<RiskLevel, string> = {
  safe:     "bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-700",
  low:      "bg-blue-50 dark:bg-blue-900/20 border-blue-300 dark:border-blue-700",
  medium:   "bg-yellow-50 dark:bg-yellow-900/20 border-yellow-300 dark:border-yellow-700",
  high:     "bg-orange-50 dark:bg-orange-900/20 border-orange-300 dark:border-orange-700",
  critical: "bg-red-50 dark:bg-red-900/20 border-red-300 dark:border-red-700",
};

const riskGauge: Record<RiskLevel, string> = {
  safe:     "bg-green-500",
  low:      "bg-blue-500",
  medium:   "bg-yellow-500",
  high:     "bg-orange-500",
  critical: "bg-red-600",
};

const severityBadge: Record<Severity | string, string> = {
  critical: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  high:     "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300",
  medium:   "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300",
  low:      "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  none:     "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400",
};

const severityIcon = (s: string) => {
  if (s === "critical") return <XCircle className="w-4 h-4 text-red-500 flex-shrink-0" />;
  if (s === "high")     return <AlertTriangle className="w-4 h-4 text-orange-500 flex-shrink-0" />;
  if (s === "medium")   return <AlertTriangle className="w-4 h-4 text-yellow-500 flex-shrink-0" />;
  return <Info className="w-4 h-4 text-blue-500 flex-shrink-0" />;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const toBase64 = (str: string): string => {
  const bytes = new TextEncoder().encode(str);
  let binary = "";
  bytes.forEach(b => (binary += String.fromCharCode(b)));
  return btoa(binary);
};

const authToken = () => localStorage.getItem("token") || "";

// ─── Collapsible section card ─────────────────────────────────────────────────

const SectionCard: React.FC<{
  title: string; icon: React.ReactNode; children: React.ReactNode; defaultOpen?: boolean;
}> = ({ title, icon, children, defaultOpen = true }) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-md border border-gray-200 dark:border-gray-700 overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-gray-50 dark:hover:bg-gray-700/50 transition"
      >
        <div className="flex items-center gap-2 font-semibold text-gray-800 dark:text-gray-100">
          <span className="text-amber-500">{icon}</span>{title}
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="body"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-5 pb-5 border-t border-gray-100 dark:border-gray-700">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ─── Score Gauge ──────────────────────────────────────────────────────────────

const ScoreGauge: React.FC<{ score: number; riskLevel: RiskLevel; label: string }> = ({ score, riskLevel, label }) => (
  <div className={`rounded-2xl border p-6 ${riskBg[riskLevel]}`}>
    <div className="flex items-center justify-between mb-3">
      <span className="font-semibold text-gray-700 dark:text-gray-200">{label}</span>
      <span className={`text-2xl font-bold ${riskColors[riskLevel]}`}>
        {riskLevel.toUpperCase()}
      </span>
    </div>
    <div className="w-full h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
      <motion.div
        className={`h-full rounded-full ${riskGauge[riskLevel]}`}
        initial={{ width: 0 }}
        animate={{ width: `${score}%` }}
        transition={{ duration: 0.8, ease: "easeOut" }}
      />
    </div>
    <div className="flex justify-between mt-1 text-xs text-gray-500">
      <span>0 — Safe</span>
      <span className={`font-bold ${riskColors[riskLevel]}`}>{score}/100</span>
      <span>100 — Critical</span>
    </div>
  </div>
);

// ─── Nav sidebar items ────────────────────────────────────────────────────────

// ─── Exfil tab ────────────────────────────────────────────────────────────────

const PROBE_META = [
  { id: "direct_ask",       category: "Direct Extraction",     severity: "high"     },
  { id: "role_override",    category: "Role Override",         severity: "critical" },
  { id: "delimiter_injection", category: "Delimiter Injection", severity: "critical" },
  { id: "indirect_probe",   category: "Indirect Probing",      severity: "medium"   },
  { id: "hypothetical_framing", category: "Hypothetical Framing", severity: "medium" },
  { id: "first_message_probe",  category: "Context Window Leak",  severity: "high"  },
  { id: "translation_attack",   category: "Translation Attack",   severity: "high"  },
  { id: "completion_attack",    category: "Completion Attack",    severity: "medium" },
  { id: "jailbreak_dan",    category: "DAN Jailbreak",         severity: "critical" },
  { id: "authority_override", category: "Authority Impersonation", severity: "critical" },
] as const;

const ExfilTab: React.FC = () => {
  const [endpointUrl, setEndpointUrl]     = useState("");
  const [apiKey, setApiKey]               = useState("");
  const [authHeader, setAuthHeader]       = useState("");
  const [showApiKey, setShowApiKey]       = useState(false);
  const [selectedProbes, setSelectedProbes] = useState<Set<string>>(new Set(PROBE_META.map(p => p.id)));
  const [loading, setLoading]             = useState(false);
  const [result, setResult]               = useState<ExfilResult | null>(null);
  const [error, setError]                 = useState<string | null>(null);
  const [expandedProbe, setExpandedProbe] = useState<string | null>(null);

  const toggleProbe = (id: string) => {
    setSelectedProbes(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const runScan = async () => {
    if (!endpointUrl.trim()) { setError("Please enter a target AI endpoint URL."); return; }
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch(`${API_BASE_URL}/ai-agent/exfil-check`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken()}`,
        },
        body: JSON.stringify({
          endpointUrl: endpointUrl.trim(),
          apiKey:      apiKey.trim()     || undefined,
          authHeader:  authHeader.trim() || undefined,
          selectedProbeIds: selectedProbes.size < PROBE_META.length ? [...selectedProbes] : [],
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Scan failed");
      setResult(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">

      {/* Config */}
      <SectionCard title="Target AI Agent" icon={<Bot className="w-5 h-5" />}>
        <div className="space-y-4 pt-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              AI Agent Endpoint URL <span className="text-red-500">*</span>
            </label>
            <input
              type="url"
              value={endpointUrl}
              onChange={e => setEndpointUrl(e.target.value)}
              placeholder="https://api.your-ai-agent.com/v1/chat/completions"
              className="w-full px-4 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
            <p className="mt-1 text-xs text-gray-500">Must be an external URL. Private/localhost endpoints are blocked for security.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                API Key <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <div className="relative">
                <input
                  type={showApiKey ? "text" : "password"}
                  value={apiKey}
                  onChange={e => setApiKey(e.target.value)}
                  placeholder="sk-..."
                  className="w-full px-4 py-2.5 pr-10 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
                <button
                  type="button"
                  onClick={() => setShowApiKey(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Custom Auth Header <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <input
                type="text"
                value={authHeader}
                onChange={e => setAuthHeader(e.target.value)}
                placeholder="Bearer your-token or X-API-Key: ..."
                className="w-full px-4 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
            </div>
          </div>
        </div>
      </SectionCard>

      {/* Probe selector */}
      <SectionCard title="Attack Probes" icon={<ShieldAlert className="w-5 h-5" />} defaultOpen={false}>
        <div className="pt-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm text-gray-500">Select which probes to run ({selectedProbes.size}/{PROBE_META.length} selected)</p>
            <div className="flex gap-2">
              <button onClick={() => setSelectedProbes(new Set(PROBE_META.map(p => p.id)))}
                className="text-xs text-amber-500 hover:underline">All</button>
              <span className="text-gray-300">|</span>
              <button onClick={() => setSelectedProbes(new Set())}
                className="text-xs text-amber-500 hover:underline">None</button>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {PROBE_META.map(p => (
              <label key={p.id}
                className="flex items-center gap-3 p-3 rounded-xl border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700/40 cursor-pointer transition">
                <input
                  type="checkbox"
                  checked={selectedProbes.has(p.id)}
                  onChange={() => toggleProbe(p.id)}
                  className="rounded accent-indigo-600"
                />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-800 dark:text-gray-100 truncate">{p.category}</div>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${severityBadge[p.severity]}`}>
                  {p.severity}
                </span>
              </label>
            ))}
          </div>
        </div>
      </SectionCard>

      {/* Run button */}
      <button
        onClick={runScan}
        disabled={loading}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-amber-500 hover:bg-amber-400 disabled:opacity-60 text-slate-900 font-semibold transition"
      >
        {loading
          ? <><Loader2 className="w-5 h-5 animate-spin" />Running {selectedProbes.size} probes…</>
          : <><ShieldAlert className="w-5 h-5" />Run Exfiltration Check</>}
      </button>

      {error && (
        <div className="rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-300 dark:border-red-700 px-4 py-3 text-sm text-red-700 dark:text-red-300 flex items-start gap-2">
          <XCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />{error}
        </div>
      )}

      {/* Results */}
      {result && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
          <ScoreGauge score={result.score} riskLevel={result.riskLevel} label="Exfiltration Risk Score" />

          <div className={`rounded-2xl border p-4 ${riskBg[result.riskLevel]}`}>
            <div className="grid grid-cols-3 gap-4 text-center text-sm">
              <div>
                <div className="text-2xl font-bold text-gray-800 dark:text-gray-100">{result.totalProbes}</div>
                <div className="text-gray-500">Probes Sent</div>
              </div>
              <div>
                <div className={`text-2xl font-bold ${result.leakedCount > 0 ? "text-red-600" : "text-green-600"}`}>{result.leakedCount}</div>
                <div className="text-gray-500">Leaked</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-gray-800 dark:text-gray-100">{result.totalProbes - result.leakedCount}</div>
                <div className="text-gray-500">Resisted</div>
              </div>
            </div>
          </div>

          <SectionCard title="Probe-by-Probe Results" icon={<Eye className="w-5 h-5" />}>
            <div className="space-y-3 pt-4">
              {result.probeResults.map(probe => (
                <div key={probe.id}
                  className={`rounded-xl border p-4 cursor-pointer transition ${
                    probe.analysis?.leaked
                      ? "border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-900/10"
                      : probe.responseError
                        ? "border-gray-300 dark:border-gray-500 bg-gray-50 dark:bg-gray-700/30"
                        : "border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/30"}`}
                  onClick={() => setExpandedProbe(expandedProbe === probe.id ? null : probe.id)}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      {probe.analysis?.leaked
                        ? <XCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                        : probe.responseError
                          ? <AlertTriangle className="w-4 h-4 text-gray-400 flex-shrink-0" />
                          : <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />}
                      <span className="text-sm font-medium text-gray-800 dark:text-gray-100 truncate">{probe.category}</span>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        probe.analysis?.leaked
                          ? "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300"
                          : probe.responseError
                            ? "bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400"
                            : "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300"}`}>
                        {probe.analysis?.leaked ? "LEAKED" : probe.responseError ? "ERROR" : "SAFE"}
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${severityBadge[probe.severity]}`}>{probe.severity}</span>
                      {expandedProbe === probe.id ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                    </div>
                  </div>

                  <AnimatePresence>
                    {expandedProbe === probe.id && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="pt-3 space-y-2 border-t border-gray-200 dark:border-gray-600 mt-3">
                          <p className="text-xs text-gray-600 dark:text-gray-400">{probe.description}</p>
                          {probe.analysis?.leaked && probe.analysis.evidence && (
                            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-lg px-3 py-2">
                              <span className="text-xs font-medium text-yellow-800 dark:text-yellow-300">Evidence: </span>
                              <span className="text-xs text-yellow-700 dark:text-yellow-400 italic">"{probe.analysis.evidence}"</span>
                            </div>
                          )}
                          {probe.responseError && (
                            <div className="bg-gray-100 dark:bg-gray-700 rounded-lg px-3 py-2">
                              <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Endpoint error: </span>
                              <span className="text-xs font-mono text-gray-500 dark:text-gray-400">{probe.responseError.slice(0, 120)}</span>
                            </div>
                          )}
                          {probe.response && (
                            <div>
                              <div className="text-xs font-medium text-gray-500 mb-1">Agent Response:</div>
                              <div className="bg-gray-100 dark:bg-gray-700 rounded-lg px-3 py-2 text-xs font-mono text-gray-700 dark:text-gray-300 whitespace-pre-wrap break-words max-h-36 overflow-y-auto">
                                {probe.response}
                              </div>
                            </div>
                          )}
                          {!probe.responseError && typeof probe.analysis?.confidence === "number" && (
                            <div className="flex items-center gap-2 text-xs text-gray-500">
                              <span>Confidence: <strong>{Math.round(probe.analysis.confidence * 100)}%</strong></span>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ))}
            </div>
          </SectionCard>
        </motion.div>
      )}
    </div>
  );
};

// ─── RAG tab ──────────────────────────────────────────────────────────────────

const VECTOR_META = [
  { id: "indirect_injection",   category: "Indirect Prompt Injection",  severity: "critical" },
  { id: "context_stuffing",     category: "Context Stuffing",           severity: "high"     },
  { id: "false_citation",       category: "False Citation Injection",   severity: "high"     },
  { id: "tool_call_injection",  category: "Tool Call Injection",        severity: "critical" },
  { id: "role_confusion",       category: "Role Confusion via Context", severity: "critical" },
  { id: "knowledge_base_poisoning", category: "Knowledge Base Poisoning", severity: "high"  },
  { id: "exfil_via_summarization", category: "Exfiltration via Summarization", severity: "critical" },
] as const;

const RagTab: React.FC = () => {
  const [ragContext, setRagContext]         = useState("");
  const [selectedVectors, setSelectedVectors] = useState<Set<string>>(new Set(VECTOR_META.map(v => v.id)));
  const [loading, setLoading]               = useState(false);
  const [result, setResult]                 = useState<RagResult | null>(null);
  const [error, setError]                   = useState<string | null>(null);
  const [expandedVector, setExpandedVector] = useState<string | null>(null);

  const toggleVector = (id: string) => {
    setSelectedVectors(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const runSimulation = async () => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch(`${API_BASE_URL}/ai-agent/rag-poison`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken()}`,
        },
        body: JSON.stringify({
          encodedRagContext: ragContext.trim() ? toBase64(ragContext.trim()) : undefined,
          selectedVectorIds: selectedVectors.size < VECTOR_META.length ? [...selectedVectors] : [],
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Simulation failed");
      setResult(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Context input */}
      <SectionCard title="RAG Knowledge Base Context" icon={<Database className="w-5 h-5" />}>
        <div className="pt-4 space-y-3">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Optionally paste a sample document from your knowledge base. The simulator will test whether attack payloads injected alongside this context would compromise a typical RAG agent.
          </p>
          <textarea
            value={ragContext}
            onChange={e => setRagContext(e.target.value)}
            rows={6}
            placeholder="Paste a sample document from your RAG knowledge base here (optional)…&#10;&#10;Example: Company FAQ, policy document, product description, etc."
            className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none font-mono"
          />
          <p className="text-xs text-gray-400">Leave blank to simulate a generic RAG context.</p>
        </div>
      </SectionCard>

      {/* Vector selector */}
      <SectionCard title="Attack Vectors" icon={<Zap className="w-5 h-5" />} defaultOpen={false}>
        <div className="pt-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm text-gray-500">{selectedVectors.size}/{VECTOR_META.length} selected</p>
            <div className="flex gap-2">
              <button onClick={() => setSelectedVectors(new Set(VECTOR_META.map(v => v.id)))}
                className="text-xs text-amber-500 hover:underline">All</button>
              <span className="text-gray-300">|</span>
              <button onClick={() => setSelectedVectors(new Set())}
                className="text-xs text-amber-500 hover:underline">None</button>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {VECTOR_META.map(v => (
              <label key={v.id}
                className="flex items-center gap-3 p-3 rounded-xl border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700/40 cursor-pointer transition">
                <input
                  type="checkbox"
                  checked={selectedVectors.has(v.id)}
                  onChange={() => toggleVector(v.id)}
                  className="rounded accent-indigo-600"
                />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-800 dark:text-gray-100 truncate">{v.category}</div>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${severityBadge[v.severity]}`}>
                  {v.severity}
                </span>
              </label>
            ))}
          </div>
        </div>
      </SectionCard>

      {/* Run button */}
      <button
        onClick={runSimulation}
        disabled={loading}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-purple-600 hover:bg-purple-700 disabled:opacity-60 text-white font-semibold transition"
      >
        {loading ? <><Loader2 className="w-5 h-5 animate-spin" />Simulating {selectedVectors.size} attack vectors…</> : <><Database className="w-5 h-5" />Run RAG Poisoning Simulation</>}
      </button>

      {error && (
        <div className="rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-300 dark:border-red-700 px-4 py-3 text-sm text-red-700 dark:text-red-300 flex items-start gap-2">
          <XCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />{error}
        </div>
      )}

      {result && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
          <ScoreGauge score={result.score} riskLevel={result.riskLevel} label="RAG Poisoning Risk Score" />

          <div className={`rounded-2xl border p-4 ${riskBg[result.riskLevel]}`}>
            <div className="grid grid-cols-3 gap-4 text-center text-sm">
              <div>
                <div className="text-2xl font-bold text-gray-800 dark:text-gray-100">{result.totalVectors}</div>
                <div className="text-gray-500">Vectors Tested</div>
              </div>
              <div>
                <div className={`text-2xl font-bold ${result.successCount > 0 ? "text-red-600" : "text-green-600"}`}>{result.successCount}</div>
                <div className="text-gray-500">Would Succeed</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-gray-800 dark:text-gray-100">{result.totalVectors - result.successCount}</div>
                <div className="text-gray-500">Mitigated</div>
              </div>
            </div>
          </div>

          <SectionCard title="Attack Vector Results" icon={<Shield className="w-5 h-5" />}>
            <div className="space-y-3 pt-4">
              {result.vectorResults.map(v => (
                <div key={v.id}
                  className={`rounded-xl border p-4 cursor-pointer transition ${v.simulation?.wouldSucceed
                    ? "border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-900/10"
                    : "border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/30"}`}
                  onClick={() => setExpandedVector(expandedVector === v.id ? null : v.id)}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      {v.simulation?.wouldSucceed
                        ? <XCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                        : <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />}
                      <span className="text-sm font-medium text-gray-800 dark:text-gray-100 truncate">{v.category}</span>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${v.simulation?.wouldSucceed ? "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300" : "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300"}`}>
                        {v.simulation?.error ? "ERROR" : v.simulation?.wouldSucceed ? "VULNERABLE" : "PROTECTED"}
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${severityBadge[v.severity]}`}>{v.severity}</span>
                      {expandedVector === v.id ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                    </div>
                  </div>

                  <AnimatePresence>
                    {expandedVector === v.id && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="pt-3 space-y-3 border-t border-gray-200 dark:border-gray-600 mt-3">
                          <p className="text-xs text-gray-600 dark:text-gray-400">{v.description}</p>

                          {v.simulation?.error ? (
                            <div className="text-xs text-red-600 dark:text-red-400">{v.simulation.error}</div>
                          ) : (
                            <>
                              {v.simulation?.impact && (
                                <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-700 rounded-lg px-3 py-2">
                                  <span className="text-xs font-medium text-orange-800 dark:text-orange-300">Potential Impact: </span>
                                  <span className="text-xs text-orange-700 dark:text-orange-400">{v.simulation.impact}</span>
                                </div>
                              )}
                              {v.simulation?.mitigations && (
                                <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-lg px-3 py-2">
                                  <span className="text-xs font-medium text-green-800 dark:text-green-300">Mitigations: </span>
                                  <span className="text-xs text-green-700 dark:text-green-400">{v.simulation.mitigations}</span>
                                </div>
                              )}
                              {v.simulation?.agentResponse && (
                                <div>
                                  <div className="text-xs font-medium text-gray-500 mb-1">Simulated Agent Response:</div>
                                  <div className="bg-gray-100 dark:bg-gray-700 rounded-lg px-3 py-2 text-xs font-mono text-gray-700 dark:text-gray-300 whitespace-pre-wrap break-words max-h-28 overflow-y-auto">
                                    {v.simulation.agentResponse}
                                  </div>
                                </div>
                              )}
                              {typeof v.simulation?.confidence === "number" && (
                                <div className="text-xs text-gray-500">
                                  Attack confidence: <strong>{Math.round(v.simulation.confidence * 100)}%</strong>
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ))}
            </div>
          </SectionCard>
        </motion.div>
      )}
    </div>
  );
};

// ─── CodeTab ──────────────────────────────────────────────────────────────────

interface CodeFinding {
  category: string;
  severity: Severity;
  description: string;
  payload: string;
  evidence: string;
  recommendation: string;
}

interface CodeScanResult {
  scanType: "code_analysis";
  findings: CodeFinding[];
  score: number;
  riskLevel: RiskLevel;
  summary: string;
  recommendations: string[];
  totalProbes: number;
  successfulAttacks: number;
  fileCount: number;
  timestamp: string;
}

const CodeTab: React.FC = () => {
  const [files, setFiles]       = useState<File[]>([]);
  const [loading, setLoading]   = useState(false);
  const [result, setResult]     = useState<CodeScanResult | null>(null);
  const [error, setError]       = useState<string | null>(null);
  const fileInputRef            = useRef<HTMLInputElement>(null);
  const folderInputRef          = useRef<HTMLInputElement>(null);

  const addFiles = (newFiles: FileList | null) => {
    if (!newFiles) return;
    setFiles(prev => {
      const existing = new Set(prev.map(f => f.name));
      return [...prev, ...Array.from(newFiles).filter(f => !existing.has(f.name))].slice(0, 15);
    });
  };

  const removeFile = (name: string) => setFiles(prev => prev.filter(f => f.name !== name));

  const runScan = async () => {
    if (files.length === 0) return;
    setLoading(true);
    setError(null);
    setResult(null);
    const fd = new FormData();
    files.forEach(f => fd.append('files', f));
    try {
      const res = await fetch(`${API_BASE_URL}/ai-agent/scan-code`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${authToken()}` },
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Scan failed');
      setResult(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const reset = () => { setResult(null); setError(null); setFiles([]); };

  if (loading) return (
    <div className="flex flex-col items-center justify-center gap-4 py-20">
      <Loader2 className="w-10 h-10 text-amber-400 animate-spin" />
      <p className="text-gray-300 font-medium">Scanning {files.length} file{files.length > 1 ? 's' : ''} for AI security issues…</p>
      <p className="text-xs text-gray-500">No API key required — pure heuristic analysis</p>
    </div>
  );

  if (result) return (
    <div className="space-y-5">
      {/* Score card */}
      <ScoreGauge score={result.score} riskLevel={result.riskLevel} label="Code Security Score" />

      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5">
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
          <span className="font-semibold text-gray-800 dark:text-gray-100">{result.fileCount} file{result.fileCount > 1 ? 's' : ''} scanned</span>
          {' · '}{result.totalProbes} rule{result.totalProbes > 1 ? 's' : ''} checked
          {' · '}<span className={result.successfulAttacks > 0 ? 'text-red-500 font-semibold' : 'text-green-500 font-semibold'}>
            {result.successfulAttacks} issue{result.successfulAttacks !== 1 ? 's' : ''} found
          </span>
        </p>
        <p className="text-sm text-gray-600 dark:text-gray-300">{result.summary}</p>
      </div>

      {/* Findings */}
      {result.findings.length > 0 && (
        <SectionCard title={`Findings (${result.findings.length})`} icon={<ShieldAlert className="w-5 h-5" />}>
          <div className="space-y-3 pt-4">
            {result.findings.map((f, i) => (
              <CodeFindingCard key={i} finding={f} index={i} />
            ))}
          </div>
        </SectionCard>
      )}

      {/* Recommendations */}
      {result.recommendations.length > 0 && (
        <SectionCard title="Recommendations" icon={<AlertTriangle className="w-5 h-5" />}>
          <ol className="space-y-2 pt-4">
            {result.recommendations.map((rec, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300">
                <span className="flex-shrink-0 w-5 h-5 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-600 text-xs font-bold flex items-center justify-center">{i + 1}</span>
                {rec}
              </li>
            ))}
          </ol>
        </SectionCard>
      )}

      <button onClick={reset} className="flex items-center gap-2 text-sm text-gray-400 hover:text-gray-200 transition">
        <RotateCcw className="w-4 h-4" /> Scan different files
      </button>
    </div>
  );

  return (
    <div className="space-y-5">
      {/* Drop zone */}
      <div
        onClick={() => fileInputRef.current?.click()}
        onDragOver={e => e.preventDefault()}
        onDrop={e => { e.preventDefault(); addFiles(e.dataTransfer.files); }}
        className="flex flex-col items-center justify-center gap-3 border-2 border-dashed border-amber-500/40 rounded-2xl p-10 cursor-pointer hover:border-amber-400 hover:bg-amber-900/10 transition bg-white/5"
      >
        <Upload className="w-10 h-10 text-amber-400 opacity-70" />
        <p className="text-gray-300 font-medium">Drop source files here or click to browse</p>
        <p className="text-xs text-gray-500">.js .ts .tsx .jsx .py .json .yaml .env — up to 15 files, 200 KB each</p>
        <input ref={fileInputRef} type="file" multiple
          accept=".js,.ts,.tsx,.jsx,.py,.json,.txt,.md,.yaml,.yml,.toml,.env"
          className="hidden" onChange={e => addFiles(e.target.files)} />
      </div>

      <div className="flex items-center gap-3">
        <button onClick={() => folderInputRef.current?.click()}
          className="flex items-center gap-2 px-4 py-2 rounded-lg border border-amber-500/40 text-amber-300 hover:bg-amber-900/20 text-sm transition">
          <FolderOpen className="w-4 h-4" /> Upload folder
        </button>
        <span className="text-xs text-gray-500">Scans all supported files in the folder</span>
        <input ref={folderInputRef} type="file"
          // @ts-ignore
          webkitdirectory="" multiple className="hidden"
          onChange={e => addFiles(e.target.files)} />
      </div>

      {files.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-4 space-y-2">
          <p className="text-xs font-semibold text-gray-500 mb-1">{files.length} file{files.length > 1 ? 's' : ''} queued</p>
          {files.map(f => (
            <div key={f.name} className="flex items-center justify-between gap-2 text-sm">
              <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300 min-w-0">
                <FileCode className="w-4 h-4 text-amber-400 flex-shrink-0" />
                <span className="truncate">{f.name}</span>
                <span className="text-xs text-gray-400 flex-shrink-0">{(f.size / 1024).toFixed(1)} KB</span>
              </div>
              <button onClick={() => removeFile(f.name)} className="text-gray-400 hover:text-red-500 flex-shrink-0">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {error && (
        <div className="rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-300 dark:border-red-700 px-4 py-3 text-sm text-red-700 dark:text-red-300 flex items-start gap-2">
          <XCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />{error}
        </div>
      )}

      <button onClick={runScan} disabled={files.length === 0}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-900 font-semibold transition">
        <FileCode className="w-5 h-5" /> Scan Code
      </button>
    </div>
  );
};

// ─── Collapsible finding card for code scan ───────────────────────────────────

const CodeFindingCard: React.FC<{ finding: CodeFinding; index: number }> = ({ finding, index }) => {
  const [open, setOpen] = useState(false);
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.04 }}
      className={`rounded-xl border p-4 ${
        finding.severity === 'critical' ? 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-700' :
        finding.severity === 'high'     ? 'bg-orange-50 border-orange-200 dark:bg-orange-900/20 dark:border-orange-700' :
        finding.severity === 'medium'   ? 'bg-yellow-50 border-yellow-200 dark:bg-yellow-900/20 dark:border-yellow-700' :
                                          'bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-700'
      }`}
    >
      <div className="flex items-start gap-3">
        {severityIcon(finding.severity)}
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${severityBadge[finding.severity]}`}>
              {finding.severity.toUpperCase()}
            </span>
            <span className="text-xs text-gray-500 dark:text-gray-400">{finding.category}</span>
            <span className="text-xs font-mono text-gray-400 ml-auto">{finding.evidence}</span>
          </div>
          <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{finding.description}</p>
          <button onClick={() => setOpen(o => !o)}
            className="mt-2 flex items-center gap-1 text-xs text-amber-500 hover:text-amber-400">
            {open ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            {open ? 'Hide' : 'Show'} details
          </button>
          <AnimatePresence>
            {open && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                <div className="mt-2 space-y-2">
                  <div>
                    <p className="text-xs font-semibold text-gray-500 mb-0.5">Flagged code:</p>
                    <p className="text-xs font-mono bg-gray-900 text-gray-100 rounded px-2 py-1.5 break-all">{finding.payload}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-gray-500 mb-0.5">Fix:</p>
                    <p className="text-xs text-gray-600 dark:text-gray-400 italic">{finding.recommendation}</p>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────

const AIAgentScanner: React.FC = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'exfil' | 'code'>('exfil');
  const [sidebarExpanded, setSidebarExpanded] = useState(true);
  const token = localStorage.getItem("token");
  const handleLogout = () => { localStorage.removeItem("token"); navigate("/"); };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-gray-100 flex flex-col">
      <Header
        token={token ?? ""}
        handleLogout={handleLogout}
        profileImage=""
      />

      <div className="flex flex-1 overflow-hidden">
        <AppSidebar sidebarExpanded={sidebarExpanded} setSidebarExpanded={setSidebarExpanded} />

        <main className="flex-1 overflow-y-auto">
          <div className="max-w-6xl mx-auto w-full px-4 py-8">
        {/* Page header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2.5 rounded-xl bg-amber-100 dark:bg-amber-900/40">
              <Bot className="w-6 h-6 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">AI Agent Security Scanner</h1>
              <p className="text-sm text-gray-400">Test your AI agents and LLM-powered apps for critical vulnerabilities</p>
            </div>
          </div>

          <div className="mt-4 p-4 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 text-sm text-amber-800 dark:text-amber-300">
            <strong>OWASP LLM Top 10 Coverage:</strong> This tool tests for LLM01 (Prompt Injection), LLM02 (Insecure Output Handling), and LLM06 (Sensitive Information Disclosure) — the most critical AI security risks identified by OWASP for LLM applications.
          </div>
        </div>

        {/* Tab switcher */}
        <div className="flex gap-1 p-1 bg-white/10 rounded-xl w-fit mb-6">
          <button
            onClick={() => setActiveTab('exfil')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition ${
              activeTab === 'exfil' ? 'bg-amber-500 text-slate-900 shadow' : 'text-gray-300 hover:text-white'
            }`}
          >
            <Lock className="w-4 h-4" /> Scan Endpoint
          </button>
          <button
            onClick={() => setActiveTab('code')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition ${
              activeTab === 'code' ? 'bg-amber-500 text-slate-900 shadow' : 'text-gray-300 hover:text-white'
            }`}
          >
            <FileCode className="w-4 h-4" /> Scan Code
          </button>
        </div>

        {activeTab === 'exfil' ? <ExfilTab /> : <CodeTab />}
          </div>
        </main>
      </div>

      <Footer />
    </div>
  );
};

export default AIAgentScanner;
