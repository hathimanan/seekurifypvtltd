// promptScanner.tsx
// Combined Privacy & PII Scanner
//   Tab 1 — Pre-Send Scanner: client-side regex scan of prompts before sending to any LLM
//   Tab 2 — Response PII Audit: server-side scan of AI responses for leaked PII

import React, { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { usePromptScanner } from "./usePromptScanner";
import { DETECTORS, Severity } from "./detectors";
import {
  Shield, AlertTriangle, CheckCircle, Copy, RotateCcw, Zap,
  ScanSearch, Eye, EyeOff, ChevronDown, ChevronUp,
  BarChart2, Clock, Loader2, Trash2, XCircle, Scale,
} from "lucide-react";
import Header from "../ui/Header";
import Footer from "../ui/Footer";
import { motion, AnimatePresence } from "framer-motion";
import { API_BASE_URL } from "../../services/api";
import AppSidebar from "../ui/AppSidebar";

// ─── Types ────────────────────────────────────────────────────────────────────

type PIIRisk = "safe" | "low" | "medium" | "high" | "critical";
type PIISeverity = "critical" | "high" | "medium" | "low";

interface PIIFinding {
  id: string; label: string; category: string;
  severity: PIISeverity; description: string;
  count: number; examples: string[];
  regulations?: string[];
}
interface ComplianceSummary {
  triggeredLaws: string[];
  dpdpTier: 'none' | 'general' | 'sensitive';
  euAiActRisk: 'minimal' | 'limited' | 'high';
  requiredActions: string[];
  governmentDataDetected: boolean;
  sensitiveCategoryDetected: boolean;
}
interface PIIScanResult {
  score: number; riskLevel: PIIRisk;
  findings: PIIFinding[]; categoryBreakdown: Record<string, number>; scannedLength: number;
  complianceSummary?: ComplianceSummary;
}
interface PIIHistoryEntry {
  _id: string; label: string; score: number; riskLevel: PIIRisk;
  findingCount: number; summary: string; createdAt: string;
}

// ─── Style helpers ─────────────────────────────────────────────────────────────

const piiRiskColor: Record<PIIRisk, string> = {
  safe: "text-green-600", low: "text-blue-600", medium: "text-yellow-600",
  high: "text-orange-600", critical: "text-red-600",
};
const piiRiskBg: Record<PIIRisk, string> = {
  safe: "bg-green-50 border-green-300", low: "bg-blue-50 border-blue-300",
  medium: "bg-yellow-50 border-yellow-300", high: "bg-orange-50 border-orange-300",
  critical: "bg-red-50 border-red-300",
};
const piiSevBadge: Record<PIISeverity, string> = {
  critical: "bg-red-100 text-red-700", high: "bg-orange-100 text-orange-700",
  medium: "bg-yellow-100 text-yellow-700", low: "bg-blue-100 text-blue-700",
};
const catColor: Record<string, string> = {
  Personal:   "bg-purple-100 text-purple-700",
  Financial:  "bg-rose-100 text-rose-700",
  Credential: "bg-red-100 text-red-700",
  Network:    "bg-cyan-100 text-cyan-700",
  Government: "bg-amber-100 text-amber-800",
  Sensitive:  "bg-fuchsia-100 text-fuchsia-700",
};

const authToken = () => localStorage.getItem("token") || "";

// ─── Pre-Send Scanner sub-components ─────────────────────────────────────────

const RiskBadge: React.FC<{ level: "safe" | "moderate" | "high"; score: number }> = ({ level, score }) => {
  const config = {
    safe:     { bg: "bg-emerald-50 border-emerald-200", text: "text-emerald-800", score: "text-emerald-700", label: "Low Risk",      icon: <CheckCircle size={18} className="text-emerald-600" /> },
    moderate: { bg: "bg-amber-50 border-amber-200",     text: "text-amber-800",   score: "text-amber-700",   label: "Moderate Risk", icon: <AlertTriangle size={18} className="text-amber-600" /> },
    high:     { bg: "bg-red-50 border-red-200",         text: "text-red-800",     score: "text-red-700",     label: "High Risk",     icon: <AlertTriangle size={18} className="text-red-600" /> },
  } as const;
  const c = config[level];
  return (
    <div className={`flex items-center gap-4 rounded-xl border px-5 py-4 ${c.bg}`}>
      <div className="text-center">
        <div className={`text-3xl font-semibold ${c.score}`}>{score}</div>
        <div className="text-xs text-gray-400 mt-0.5">/ 100</div>
      </div>
      <div className="w-px h-10 bg-gray-200" />
      <div className="flex items-center gap-2">
        {c.icon}
        <div>
          <div className={`font-medium text-sm ${c.text}`}>{c.label}</div>
          <div className="text-xs text-gray-400 mt-0.5">
            {level === "safe" ? "No critical data detected" : level === "moderate" ? "Some sensitive patterns found" : "Sensitive data detected — review before sending"}
          </div>
        </div>
      </div>
    </div>
  );
};

const SeverityDot: React.FC<{ severity: Severity; triggered: boolean }> = ({ severity, triggered }) => {
  if (!triggered) return <span className="inline-block w-2 h-2 rounded-full bg-gray-200" />;
  const colors = { critical: "bg-red-500", warning: "bg-amber-400", info: "bg-blue-400" };
  return <span className={`inline-block w-2 h-2 rounded-full ${colors[severity]}`} />;
};

const FlagGrid: React.FC<{ hits: ReturnType<typeof import("./detectors").runLocalScan>["hits"] }> = ({ hits }) => {
  const hitMap = new Map(hits.map(h => [h.detector.id, h]));
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
      {DETECTORS.map(d => {
        const hit = hitMap.get(d.id);
        const triggered = !!hit;
        const cardStyle = triggered
          ? d.severity === "critical" ? "border-red-700/50 bg-red-900/20"
          : d.severity === "warning"  ? "border-amber-700/50 bg-amber-900/20"
          : "border-blue-700/50 bg-blue-900/20"
          : "border-slate-700 bg-slate-800/40";
        return (
          <div key={d.id} className={`rounded-lg border px-3 py-2.5 ${cardStyle}`}>
            <div className="flex items-center gap-1.5 mb-1">
              <SeverityDot severity={d.severity} triggered={triggered} />
              <span className="text-xs font-medium text-gray-200 truncate">{d.label}</span>
            </div>
            <div className={`text-xs ${triggered ? d.severity === "critical" ? "text-red-600" : "text-amber-600" : "text-gray-400"}`}>
              {triggered ? `Detected (${hit!.count})` : "Clear"}
            </div>
          </div>
        );
      })}
    </div>
  );
};

// ─── PII Audit sub-components ─────────────────────────────────────────────────

const PIIGauge: React.FC<{ score: number; riskLevel: PIIRisk }> = ({ score, riskLevel }) => (
  <div className="flex flex-col items-center gap-2">
    <div className="relative w-28 h-28">
      <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
        <circle cx="50" cy="50" r="42" fill="none" stroke="#e5e7eb" strokeWidth="12" />
        <circle cx="50" cy="50" r="42" fill="none" strokeWidth="12" strokeLinecap="round"
          strokeDasharray={`${(score / 100) * 263.9} 263.9`}
          className={`transition-all duration-700 ${
            riskLevel === "safe" ? "stroke-green-500" : riskLevel === "low" ? "stroke-blue-500" :
            riskLevel === "medium" ? "stroke-yellow-500" : riskLevel === "high" ? "stroke-orange-500" : "stroke-red-600"
          }`}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={`text-2xl font-extrabold ${piiRiskColor[riskLevel]}`}>{score}</span>
        <span className="text-[10px] text-gray-400">/100</span>
      </div>
    </div>
    <span className={`text-sm font-bold uppercase tracking-wide ${piiRiskColor[riskLevel]}`}>{riskLevel}</span>
  </div>
);

const PIIFindingCard: React.FC<{ finding: PIIFinding }> = ({ finding }) => {
  const [open, setOpen] = useState(false);
  const [showEx, setShowEx] = useState(false);
  return (
    <div className={`border rounded-xl overflow-hidden ${piiRiskBg[finding.severity as PIIRisk] || "bg-slate-800/60 border-slate-700"}`}>
      <button className="w-full flex items-center gap-3 px-4 py-3 text-left" onClick={() => setOpen(o => !o)}>
        <div className="flex-1 flex items-center gap-2 flex-wrap">
          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${piiSevBadge[finding.severity]}`}>{finding.severity.toUpperCase()}</span>
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${catColor[finding.category] || "bg-gray-100 text-gray-600"}`}>{finding.category}</span>
          <span className="font-semibold text-gray-100 text-sm">{finding.label}</span>
          <span className="ml-auto text-xs text-gray-400">{finding.count} match{finding.count !== 1 ? "es" : ""}</span>
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-gray-500 flex-shrink-0" /> : <ChevronDown className="w-4 h-4 text-gray-500 flex-shrink-0" />}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
            <div className="px-4 pb-4 space-y-3 border-t border-slate-700">
              <p className="text-sm text-gray-300 mt-3">{finding.description}</p>
              {finding.examples.length > 0 && (
                <div>
                  <button onClick={() => setShowEx(e => !e)} className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 font-medium">
                    {showEx ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    {showEx ? "Hide" : "Show"} masked examples
                  </button>
                  <AnimatePresence>
                    {showEx && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                        <div className="mt-2 flex flex-wrap gap-2">
                          {finding.examples.map((ex, i) => (
                            <code key={i} className="bg-gray-800 text-gray-100 text-xs px-2 py-1 rounded font-mono">{ex}</code>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ─── Compliance Panel ─────────────────────────────────────────────────────────

const LAW_META: Record<string, { label: string; color: string }> = {
  DPDP:      { label: 'India DPDP Act 2023', color: 'bg-orange-100 text-orange-800 border-orange-300' },
  GDPR:      { label: 'EU GDPR',             color: 'bg-blue-100 text-blue-800 border-blue-300' },
  EU_AI_ACT: { label: 'EU AI Act',           color: 'bg-violet-100 text-violet-800 border-violet-300' },
  HIPAA:     { label: 'HIPAA',               color: 'bg-green-100 text-green-800 border-green-300' },
};

const EU_AI_RISK_STYLE: Record<string, string> = {
  minimal: 'bg-green-900/30 text-green-400 border-green-700',
  limited: 'bg-yellow-900/30 text-yellow-300 border-yellow-700',
  high:    'bg-red-900/30 text-red-400 border-red-700',
};

const DPDP_TIER_STYLE: Record<string, string> = {
  none:      '',
  general:   'bg-orange-900/20 text-orange-300 border-orange-700',
  sensitive: 'bg-red-900/30 text-red-400 border-red-700',
};

const CompliancePanel: React.FC<{ summary: ComplianceSummary }> = ({ summary }) => {
  const [open, setOpen] = useState(false);
  if (summary.triggeredLaws.length === 0) return null;
  return (
    <div className="bg-slate-800/80 rounded-2xl shadow border border-amber-600/40 p-5 space-y-4">
      <button className="w-full flex items-center justify-between gap-2" onClick={() => setOpen(o => !o)}>
        <div className="flex items-center gap-2 flex-wrap">
          <Scale className="w-5 h-5 text-amber-400 flex-shrink-0" />
          <h3 className="font-semibold text-gray-100 text-sm">Regulatory Compliance Impact</h3>
          <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${EU_AI_RISK_STYLE[summary.euAiActRisk]}`}>
            EU AI Act: {summary.euAiActRisk.toUpperCase()}
          </span>
          {summary.dpdpTier !== 'none' && (
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${DPDP_TIER_STYLE[summary.dpdpTier]}`}>
              DPDP: {summary.dpdpTier === 'sensitive' ? 'Sensitive Category' : 'General Data'}
            </span>
          )}
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-gray-400 flex-shrink-0" /> : <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />}
      </button>

      <div className="flex flex-wrap gap-2">
        {summary.triggeredLaws.map(law => {
          const meta = LAW_META[law] || { label: law, color: 'bg-gray-100 text-gray-700 border-gray-300' };
          return (
            <span key={law} className={`text-xs font-semibold px-3 py-1 rounded-full border ${meta.color}`}>{meta.label}</span>
          );
        })}
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden"
          >
            <div className="space-y-2 pt-1">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Required Actions</p>
              {summary.requiredActions.map((action, i) => (
                <div key={i} className="flex items-start gap-2.5 rounded-lg border border-amber-700/30 bg-amber-900/10 px-3.5 py-2.5 text-xs text-gray-300">
                  <span className="text-amber-400 mt-0.5 flex-shrink-0">⚖</span>
                  {action}
                </div>
              ))}
              {summary.governmentDataDetected && (
                <div className="flex items-start gap-2.5 rounded-lg border border-red-700/40 bg-red-900/20 px-3.5 py-2.5 text-xs text-red-300">
                  <span className="mt-0.5 flex-shrink-0">🔒</span>
                  Government-classified or sensitive government data detected — ensure this AI system is not outputting restricted information to unauthorised users.
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────

type MainTab = "presend" | "audit";

const PromptScanner: React.FC = () => {
  const navigate    = useNavigate();
  const token       = localStorage.getItem("token");
  const [profileImage, setProfileImage]     = useState("");
  const [sidebarExpanded, setSidebarExpanded] = useState(true);
  const [activeTab, setActiveTab]           = useState<MainTab>("presend");

  // ── Pre-Send state ──
  const [prompt, setPrompt]   = useState("");
  const [copied, setCopied]   = useState(false);
  const textareaRef           = useRef<HTMLTextAreaElement>(null);
  const { state, scan, reset } = usePromptScanner();

  // ── PII Audit state ──
  const [auditText, setAuditText]       = useState("");
  const [auditLabel, setAuditLabel]     = useState("");
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditResult, setAuditResult]   = useState<PIIScanResult | null>(null);
  const [auditError, setAuditError]     = useState<string | null>(null);
  const [auditCatFilter, setAuditCatFilter] = useState("All");
  const [auditHistory, setAuditHistory] = useState<PIIHistoryEntry[]>([]);
  const [histLoading, setHistLoading]   = useState(false);
  const [auditSubTab, setAuditSubTab]   = useState<"scan" | "history">("scan");

  // Profile image
  useEffect(() => {
    if (!token) return;
    fetch(`${API_BASE_URL}/profile`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.profileImage) setProfileImage(d.profileImage); })
      .catch(() => {});
  }, [token]);

  const handleLogout = () => { localStorage.removeItem("token"); navigate("/"); };

  // ── Pre-Send handlers ──
  const handleScan  = () => scan(prompt);
  const handleClear = () => { setPrompt(""); reset(); textareaRef.current?.focus(); };
  const handleCopy  = async () => {
    if (!state.analysis?.sanitizedPrompt) return;
    await navigator.clipboard.writeText(state.analysis.sanitizedPrompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  const isDone = state.status === "done";

  // ── PII Audit handlers ──
  const handleAuditScan = async () => {
    if (!auditText.trim()) return;
    setAuditLoading(true); setAuditError(null); setAuditResult(null); setAuditCatFilter("All");
    try {
      const res = await fetch(`${API_BASE_URL}/pii-scan/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken()}` },
        body: JSON.stringify({ text: auditText, label: auditLabel || "Unnamed scan" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Scan failed");
      setAuditResult(data as PIIScanResult);
    } catch (err: any) {
      setAuditError(err.message || "Scan failed");
    } finally {
      setAuditLoading(false);
    }
  };

  const loadHistory = async () => {
    setHistLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/pii-scan/history`, { headers: { Authorization: `Bearer ${authToken()}` } });
      const data = await res.json();
      setAuditHistory(Array.isArray(data) ? data : []);
    } catch { setAuditHistory([]); } finally { setHistLoading(false); }
  };

  useEffect(() => { if (auditSubTab === "history") loadHistory(); }, [auditSubTab]);

  const auditCategories = auditResult ? ["All", ...Array.from(new Set(auditResult.findings.map(f => f.category)))] : ["All"];
  const visibleFindings = auditResult?.findings.filter(f => auditCatFilter === "All" || f.category === auditCatFilter) ?? [];

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <title>Privacy &amp; PII Scanner – Seekurify</title>
      <Header token={token || ""} handleLogout={handleLogout} profileImage={profileImage} />

      <div className="flex flex-1 overflow-hidden">
        <AppSidebar sidebarExpanded={sidebarExpanded} setSidebarExpanded={setSidebarExpanded} />

        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Page header */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-700 rounded-xl flex items-center justify-center">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">Privacy &amp; PII Scanner</h1>
              <p className="text-sm text-gray-400">Scan prompts before sending, and audit AI responses for leaked data.</p>
            </div>
          </div>

          {/* Main tabs */}
          <div className="flex gap-1 border-b border-slate-700">
            <button
              onClick={() => setActiveTab("presend")}
              className={`px-4 py-2 text-sm font-semibold rounded-t-lg transition -mb-px ${
                activeTab === "presend" ? "bg-slate-700 border border-b-slate-700 border-slate-600 text-emerald-400" : "text-gray-400 hover:text-gray-200"
              }`}
            >
              <span className="flex items-center gap-1.5"><Zap className="w-3.5 h-3.5" /> Pre-Send Scanner</span>
            </button>
            <button
              onClick={() => setActiveTab("audit")}
              className={`px-4 py-2 text-sm font-semibold rounded-t-lg transition -mb-px ${
                activeTab === "audit" ? "bg-slate-700 border border-b-slate-700 border-slate-600 text-indigo-400" : "text-gray-400 hover:text-gray-200"
              }`}
            >
              <span className="flex items-center gap-1.5"><ScanSearch className="w-3.5 h-3.5" /> Response PII Audit</span>
            </button>
          </div>

          {/* ── TAB 1: Pre-Send Scanner ── */}
          {activeTab === "presend" && (
            <div className="max-w-3xl space-y-5">
              <div className="relative">
                <textarea
                  ref={textareaRef}
                  value={prompt}
                  onChange={e => setPrompt(e.target.value)}
                  placeholder={`Paste your AI prompt here before sending to ChatGPT, Gemini, or any LLM...\n\nExample: "My name is Rahul Mehta, email rahul@company.com. Review this contract clause for Acme Corp Ltd."`}
                  rows={7}
                  className="w-full rounded-xl border border-slate-600 bg-slate-900 px-4 py-3.5 text-sm font-mono text-gray-100 placeholder-gray-500 resize-y focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-shadow"
                />
                <span className="absolute bottom-3 right-3 text-xs text-gray-400">{prompt.length} chars</span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleScan}
                  disabled={!prompt.trim()}
                  className="flex items-center gap-2 bg-emerald-700 hover:bg-emerald-600 disabled:bg-gray-200 disabled:text-gray-400 text-white text-sm font-medium px-5 py-2.5 rounded-lg transition-colors"
                >
                  <Zap size={14} /> Scan Prompt
                </button>
                {(isDone || prompt) && (
                  <button onClick={handleClear} className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-200 px-3 py-2.5 rounded-lg border border-slate-600 hover:bg-slate-700 transition-colors">
                    <RotateCcw size={13} /> Clear
                  </button>
                )}
              </div>

              {state.localResult && state.analysis && (
                <div className="space-y-5">
                  <RiskBadge level={state.localResult.riskLevel} score={state.localResult.score} />

                  <div>
                    <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2.5">Detection flags</h2>
                    <FlagGrid hits={state.localResult.hits} />
                  </div>

                  <div>
                    <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2.5">Analysis</h2>
                    <div className="rounded-xl border border-slate-700 bg-slate-800/60 px-4 py-3.5 text-sm text-gray-300 leading-relaxed">{state.analysis.summary}</div>
                  </div>

                  {state.analysis.hasSensitive && state.analysis.sanitizedPrompt && (
                    <div>
                      <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2.5">Sanitized version</h2>
                      <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3.5">
                        <p className="text-xs font-medium text-emerald-700 uppercase tracking-wider mb-2">Safe to send</p>
                        <pre className="text-sm text-emerald-800 font-mono whitespace-pre-wrap break-words leading-relaxed">{state.analysis.sanitizedPrompt}</pre>
                        <button onClick={handleCopy} className="mt-3 flex items-center gap-1.5 text-xs font-medium text-emerald-400 bg-slate-800 border border-emerald-700 hover:bg-slate-700 px-3 py-1.5 rounded-lg transition-colors">
                          <Copy size={12} /> {copied ? "Copied!" : "Copy sanitized prompt"}
                        </button>
                      </div>
                    </div>
                  )}

                  {state.analysis.recommendations.length > 0 && (
                    <div>
                      <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2.5">Recommendations</h2>
                      <div className="space-y-2">
                        {state.analysis.recommendations.map((rec, i) => (
                          <div key={i} className="flex items-start gap-2.5 rounded-lg border border-slate-700 bg-slate-800/60 px-3.5 py-2.5 text-sm text-gray-300">
                            <span className="text-emerald-600 mt-0.5 flex-shrink-0">→</span>{rec}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              <p className="text-xs text-gray-500 leading-relaxed">
                Pattern detection runs entirely in your browser. No data is sent to any server or third-party AI. No prompts are stored or logged.
              </p>
            </div>
          )}

          {/* ── TAB 2: Response PII Audit ── */}
          {activeTab === "audit" && (
            <div className="space-y-5">
              {/* Sub-tabs */}
              <div className="flex gap-1 border-b border-slate-700">
                {(["scan", "history"] as const).map(st => (
                  <button key={st} onClick={() => setAuditSubTab(st)}
                    className={`px-4 py-1.5 text-sm font-semibold rounded-t-lg capitalize transition -mb-px ${
                      auditSubTab === st ? "bg-slate-700 border border-b-slate-700 border-slate-600 text-indigo-400" : "text-gray-400 hover:text-gray-200"
                    }`}>
                    {st === "scan" ? "Scan" : "History"}
                  </button>
                ))}
              </div>

              {auditSubTab === "scan" && (
                <div className="space-y-5">
                  {/* Input */}
                  <div className="bg-slate-800/80 rounded-2xl shadow border border-slate-700 p-5 space-y-4">
                    <input
                      type="text" value={auditLabel} onChange={e => setAuditLabel(e.target.value)}
                      placeholder="Scan label (optional) — e.g. Customer support bot response"
                      className="w-full px-3 py-2 border border-slate-600 bg-slate-900 text-gray-100 placeholder-gray-500 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                    />
                    <div className="relative">
                      <textarea
                        value={auditText} onChange={e => setAuditText(e.target.value)} rows={9}
                        placeholder={`Paste an AI response or government document snippet here...\n\nDetects & maps to regulation:\n• Personal: emails, phone numbers, SSNs, Aadhar, PAN, passports  →  DPDP · GDPR\n• Financial: credit cards, IBANs, bank accounts  →  DPDP · GDPR\n• Government: classified markers, Voter ID, Driving Licence  →  DPDP · EU AI Act\n• Sensitive: biometric, genetic, health, caste, religious, political data  →  DPDP · GDPR · EU AI Act\n• Credentials: API keys, AWS keys, JWTs, passwords  →  EU AI Act\n• Network: private IPs, internal URLs  →  EU AI Act`}
                        className="w-full px-4 py-3 border border-slate-600 bg-slate-900 text-gray-100 placeholder-gray-500 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none"
                      />
                      <span className="absolute bottom-3 right-3 text-xs text-gray-500">{auditText.length.toLocaleString()} / 50,000</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <button onClick={() => { setAuditText(""); setAuditResult(null); setAuditError(null); setAuditLabel(""); }}
                        className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-200">
                        <Trash2 className="w-4 h-4" /> Clear
                      </button>
                      <button onClick={handleAuditScan} disabled={auditLoading || !auditText.trim()}
                        className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-5 py-2.5 rounded-xl font-semibold text-sm shadow transition">
                        {auditLoading ? <><Loader2 className="w-4 h-4 animate-spin" /> Scanning…</> : <><ScanSearch className="w-4 h-4" /> Run PII Scan</>}
                      </button>
                    </div>
                  </div>

                  {auditError && (
                    <div className="bg-red-50 border border-red-300 rounded-xl p-4 flex items-center gap-3 text-red-700">
                      <XCircle className="w-5 h-5 flex-shrink-0" />
                      <span className="text-sm font-medium">{auditError}</span>
                    </div>
                  )}

                  <AnimatePresence>
                    {auditResult && (
                      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-5">
                        {/* Score + category breakdown */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                          <div className={`bg-slate-800/80 rounded-2xl shadow border p-5 flex flex-col items-center gap-3 ${piiRiskBg[auditResult.riskLevel]}`}>
                            <PIIGauge score={auditResult.score} riskLevel={auditResult.riskLevel} />
                            <div className="text-center text-sm text-gray-400">
                              <p><span className="font-semibold text-gray-200">{auditResult.findings.length}</span> PII type{auditResult.findings.length !== 1 ? "s" : ""} detected</p>
                              <p>in {auditResult.scannedLength.toLocaleString()} characters</p>
                            </div>
                          </div>

                          <div className="bg-slate-800/80 rounded-2xl shadow border border-slate-700 p-5">
                            <div className="flex items-center gap-2 mb-4">
                              <BarChart2 className="w-5 h-5 text-indigo-400" />
                              <h3 className="font-semibold text-gray-100 text-sm">Category Breakdown</h3>
                            </div>
                            {Object.keys(auditResult.categoryBreakdown).length > 0 ? (
                              <div className="space-y-2">
                                {Object.entries(auditResult.categoryBreakdown).sort((a, b) => b[1] - a[1]).map(([cat, count]) => {
                                  const max = Math.max(...Object.values(auditResult.categoryBreakdown), 1);
                                  return (
                                    <div key={cat} className="flex items-center gap-3">
                                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full w-20 text-center ${catColor[cat] || "bg-gray-100 text-gray-600"}`}>{cat}</span>
                                      <div className="flex-1 bg-slate-700 rounded-full h-2.5 overflow-hidden">
                                        <motion.div initial={{ width: 0 }} animate={{ width: `${(count / max) * 100}%` }} transition={{ duration: 0.5 }}
                                          className={`h-full rounded-full ${cat === "Personal" ? "bg-purple-500" : cat === "Financial" ? "bg-rose-500" : cat === "Credential" ? "bg-red-500" : "bg-cyan-500"}`} />
                                      </div>
                                      <span className="text-xs font-bold text-gray-300 w-5 text-right">{count}</span>
                                    </div>
                                  );
                                })}
                              </div>
                            ) : (
                              <div className="flex flex-col items-center justify-center h-20 text-gray-400">
                                <CheckCircle className="w-7 h-7 mb-1 text-green-400" />
                                <span className="text-sm">No PII detected</span>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Compliance Panel */}
                        {auditResult.complianceSummary && (
                          <CompliancePanel summary={auditResult.complianceSummary} />
                        )}

                        {/* Findings */}
                        {auditResult.findings.length > 0 && (
                          <div className="bg-slate-800/80 rounded-2xl shadow border border-slate-700 p-5 space-y-4">
                            <div className="flex items-center justify-between flex-wrap gap-3">
                              <h3 className="font-semibold text-gray-100 flex items-center gap-2 text-sm">
                                <AlertTriangle className="w-4 h-4 text-red-500" /> Detected PII Types
                              </h3>
                              <div className="flex flex-wrap gap-2">
                                {auditCategories.map(cat => (
                                  <button key={cat} onClick={() => setAuditCatFilter(cat)}
                                    className={`text-xs font-semibold px-3 py-1 rounded-full transition border ${
                                      auditCatFilter === cat ? "bg-indigo-600 text-white border-indigo-600" : "bg-slate-700 text-gray-300 border-slate-600 hover:border-indigo-400"
                                    }`}>
                                    {cat}
                                  </button>
                                ))}
                              </div>
                            </div>
                            <div className="space-y-3">
                              {visibleFindings.map(f => <PIIFindingCard key={f.id} finding={f} />)}
                            </div>
                          </div>
                        )}

                        {auditResult.findings.length === 0 && (
                          <div className="bg-green-50 border border-green-300 rounded-2xl p-8 flex flex-col items-center gap-3 text-green-700">
                            <CheckCircle className="w-9 h-9" />
                            <p className="font-semibold">No PII Detected</p>
                            <p className="text-sm text-green-600 text-center">No known PII patterns found across Personal, Financial, Credential, and Network categories.</p>
                          </div>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}

              {/* History sub-tab */}
              {auditSubTab === "history" && (
                <div className="bg-slate-800/80 rounded-2xl shadow border border-slate-700 p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <Clock className="w-5 h-5 text-indigo-400" />
                    <h3 className="font-semibold text-gray-100 text-sm">Scan History</h3>
                    <button onClick={loadHistory} className="ml-auto text-xs text-indigo-600 hover:underline">Refresh</button>
                  </div>
                  {histLoading ? (
                    <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 text-indigo-500 animate-spin" /></div>
                  ) : auditHistory.length === 0 ? (
                    <div className="text-center py-10 text-gray-400">
                      <ScanSearch className="w-9 h-9 mx-auto mb-2 opacity-40" />
                      <p className="text-sm">No scans yet.</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {auditHistory.map(entry => (
                        <div key={entry._id} className={`flex items-center gap-4 border rounded-xl px-4 py-3 ${piiRiskBg[entry.riskLevel]}`}>
                          <div className={`text-2xl font-extrabold ${piiRiskColor[entry.riskLevel]} w-10 text-center`}>{entry.score}</div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-semibold text-gray-100 text-sm truncate">{entry.label}</span>
                              <span className={`text-xs font-bold uppercase px-2 py-0.5 rounded-full border ${
                                entry.riskLevel === "safe" ? "bg-green-100 text-green-700 border-green-300" :
                                entry.riskLevel === "low"  ? "bg-blue-100 text-blue-700 border-blue-300"   :
                                entry.riskLevel === "medium" ? "bg-yellow-100 text-yellow-700 border-yellow-300" :
                                entry.riskLevel === "high"   ? "bg-orange-100 text-orange-700 border-orange-300" :
                                                               "bg-red-100 text-red-700 border-red-300"
                              }`}>{entry.riskLevel}</span>
                            </div>
                            <p className="text-xs text-gray-500 truncate mt-0.5">{entry.summary}</p>
                          </div>
                          <div className="text-right text-xs text-gray-400 flex-shrink-0">
                            <div>{entry.findingCount} finding{entry.findingCount !== 1 ? "s" : ""}</div>
                            <div>{new Date(entry.createdAt).toLocaleDateString()}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default PromptScanner;
