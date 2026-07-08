import React, { useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Target, ShieldAlert, ShieldCheck, Zap, AlertTriangle, AlertCircle,
  Info, CheckCircle, XCircle, Loader2, ChevronDown, ChevronUp,
  RotateCcw, Download, Clock, Eye, Cpu, Database, Globe,
  Lock, Unlock, Activity, FileCode, Upload, Trash2, FolderOpen,
} from "lucide-react";
import { API_BASE_URL } from "../services/api";
import Header from "./ui/Header";
import Footer from "./ui/Footer";
import AppSidebar from "./ui/AppSidebar";
import jsPDF from "jspdf";

// ─── Types ────────────────────────────────────────────────────────────────────

type RiskLevel   = "critical" | "high" | "medium" | "low" | "clean";
type Severity    = "critical" | "high" | "medium" | "low";
type ScanStatus  = "idle" | "scanning" | "complete" | "error";
type ReqFormat   = "openai" | "anthropic" | "simple" | "custom";
type ScanMode    = "endpoint" | "code";

interface Finding {
  category:    string;
  severity:    Severity;
  succeeded:   boolean;
  payload:     string;
  evidence:    string;
  description: string;
  timestamp?:  string;
}

interface Step {
  step:        number;
  tool:        string;
  description: string;
  category?:   string;
  severity?:   Severity;
  probeNum?:   number;
}

interface ScanReport {
  summary:           string;
  score:             number;
  riskLevel:         RiskLevel;
  recommendations:   string[];
  findings:          Finding[];
  totalProbes:       number;
  successfulAttacks: number;
  duration:          number;
}

// ─── Colour maps ──────────────────────────────────────────────────────────────

const riskColor: Record<RiskLevel, string> = {
  critical: "text-red-600",
  high:     "text-orange-500",
  medium:   "text-yellow-500",
  low:      "text-blue-500",
  clean:    "text-green-500",
};

const riskBg: Record<RiskLevel, string> = {
  critical: "bg-red-100 border-red-300 dark:bg-red-900/20 dark:border-red-700",
  high:     "bg-orange-100 border-orange-300 dark:bg-orange-900/20 dark:border-orange-700",
  medium:   "bg-yellow-100 border-yellow-300 dark:bg-yellow-900/20 dark:border-yellow-700",
  low:      "bg-blue-100 border-blue-300 dark:bg-blue-900/20 dark:border-blue-700",
  clean:    "bg-green-100 border-green-300 dark:bg-green-900/20 dark:border-green-700",
};

const severityBadge: Record<Severity, string> = {
  critical: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  high:     "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300",
  medium:   "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300",
  low:      "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
};

const severityIcon = (s: Severity) => {
  if (s === "critical") return <XCircle className="w-4 h-4 text-red-500 flex-shrink-0" />;
  if (s === "high")     return <AlertTriangle className="w-4 h-4 text-orange-500 flex-shrink-0" />;
  if (s === "medium")   return <AlertTriangle className="w-4 h-4 text-yellow-500 flex-shrink-0" />;
  return <Info className="w-4 h-4 text-blue-500 flex-shrink-0" />;
};

const toolIcon = (tool: string) => {
  if (tool === "fingerprint_target")     return <Eye className="w-4 h-4 text-amber-400" />;
  if (tool === "send_adversarial_probe") return <Zap className="w-4 h-4 text-orange-400" />;
  if (tool === "record_finding")         return <Database className="w-4 h-4 text-purple-400" />;
  if (tool === "complete_scan")          return <ShieldCheck className="w-4 h-4 text-green-400" />;
  return <Cpu className="w-4 h-4 text-gray-400" />;
};

const categoryIcon = (cat?: string) => {
  if (!cat) return null;
  if (cat.includes("Role"))       return <Unlock className="w-3.5 h-3.5" />;
  if (cat.includes("Exfil"))      return <Database className="w-3.5 h-3.5" />;
  if (cat.includes("Tool"))       return <Zap className="w-3.5 h-3.5" />;
  if (cat.includes("Jailbreak"))  return <Lock className="w-3.5 h-3.5" />;
  if (cat.includes("Context"))    return <Globe className="w-3.5 h-3.5" />;
  if (cat.includes("Agentic"))    return <Activity className="w-3.5 h-3.5" />;
  return <AlertCircle className="w-3.5 h-3.5" />;
};

// ─── Risk Score Gauge ─────────────────────────────────────────────────────────

const RiskGauge: React.FC<{ score: number; riskLevel: RiskLevel }> = ({ score, riskLevel }) => {
  const r = 54;
  const circ = 2 * Math.PI * r;
  const offset = circ - (score / 100) * circ;
  const strokeColor =
    riskLevel === "critical" ? "#ef4444" :
    riskLevel === "high"     ? "#f97316" :
    riskLevel === "medium"   ? "#eab308" :
    riskLevel === "low"      ? "#3b82f6" : "#22c55e";

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-36 h-36">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
          <circle cx="60" cy="60" r={r} fill="none" stroke="#e5e7eb" strokeWidth="12" />
          <circle
            cx="60" cy="60" r={r} fill="none"
            stroke={strokeColor} strokeWidth="12"
            strokeDasharray={circ} strokeDashoffset={offset}
            strokeLinecap="round"
            style={{ transition: "stroke-dashoffset 1s ease" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={`text-3xl font-black ${riskColor[riskLevel]}`}>{score}</span>
          <span className="text-xs text-gray-500 dark:text-gray-400">/100</span>
        </div>
      </div>
      <span className={`mt-2 text-lg font-bold uppercase tracking-wide ${riskColor[riskLevel]}`}>
        {riskLevel}
      </span>
    </div>
  );
};

// ─── Collapsible Finding Card ─────────────────────────────────────────────────

const FindingCard: React.FC<{ finding: Finding; index: number }> = ({ finding, index }) => {
  const [open, setOpen] = useState(false);
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className={`rounded-xl border p-4 ${
        finding.succeeded
          ? riskBg[finding.severity as RiskLevel]
          : "bg-green-50 border-green-200 dark:bg-green-900/10 dark:border-green-800"
      }`}
    >
      <div className="flex items-start gap-3">
        {finding.succeeded
          ? severityIcon(finding.severity)
          : <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />}
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
              finding.succeeded ? severityBadge[finding.severity] : "bg-green-100 text-green-700"
            }`}>
              {finding.succeeded ? finding.severity.toUpperCase() : "RESISTED"}
            </span>
            <span className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
              {categoryIcon(finding.category)} {finding.category}
            </span>
          </div>
          <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{finding.description}</p>
          <button
            onClick={() => setOpen(o => !o)}
            className="mt-2 flex items-center gap-1 text-xs text-amber-500 hover:text-amber-400"
          >
            {open ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            {open ? "Hide" : "Show"} evidence
          </button>
          <AnimatePresence>
            {open && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="mt-2 space-y-2">
                  <div>
                    <p className="text-xs font-semibold text-gray-500 mb-0.5">Payload sent:</p>
                    <p className="text-xs font-mono bg-gray-900 text-gray-100 rounded px-2 py-1.5 break-all">
                      {finding.payload}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-gray-500 mb-0.5">Evidence from response:</p>
                    <p className="text-xs italic text-gray-600 dark:text-gray-400 bg-white/60 dark:bg-gray-700/60 rounded px-2 py-1.5">
                      "{finding.evidence}"
                    </p>
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

// ─── PDF Export ───────────────────────────────────────────────────────────────

function exportPDF(report: ScanReport, targetLabel: string) {
  const doc = new jsPDF();
  const line = (y: number) => doc.line(14, y, 196, y);

  doc.setFontSize(20);
  doc.setTextColor(79, 70, 229);
  doc.text("Seekurify — AI Red-Team Report", 14, 20);

  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(`Target: ${targetLabel}`, 14, 28);
  doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 33);

  line(37);

  doc.setFontSize(14);
  doc.setTextColor(40);
  doc.text("Risk Assessment", 14, 44);

  doc.setFontSize(28);
  const col = report.riskLevel === "critical" ? [239, 68, 68] :
              report.riskLevel === "high"     ? [249, 115, 22] :
              report.riskLevel === "medium"   ? [234, 179, 8] :
              report.riskLevel === "low"      ? [59, 130, 246] : [34, 197, 94];
  doc.setTextColor(...col as [number, number, number]);
  doc.text(`${report.score}/100`, 14, 58);

  doc.setFontSize(12);
  doc.setTextColor(40);
  doc.text(`Risk Level: ${report.riskLevel.toUpperCase()}`, 60, 52);
  doc.setFontSize(10);
  doc.setTextColor(80);
  doc.text(`Probes fired: ${report.totalProbes}   Successful attacks: ${report.successfulAttacks}`, 60, 59);
  doc.text(`Duration: ${(report.duration / 1000).toFixed(1)}s`, 60, 65);

  line(70);

  doc.setFontSize(12); doc.setTextColor(40);
  doc.text("Executive Summary", 14, 79);
  doc.setFontSize(10); doc.setTextColor(70);
  const summaryLines = doc.splitTextToSize(report.summary, 180);
  doc.text(summaryLines, 14, 86);

  let y = 86 + summaryLines.length * 5 + 8;
  line(y); y += 8;

  doc.setFontSize(12); doc.setTextColor(40);
  doc.text("Findings", 14, y); y += 8;

  for (const f of report.findings) {
    if (y > 260) { doc.addPage(); y = 20; }
    const status = f.succeeded ? `[${f.severity.toUpperCase()}]` : "[RESISTED]";
    doc.setFontSize(10);
    doc.setTextColor(f.succeeded ? 200 : 50, f.succeeded ? 50 : 150, 50);
    doc.text(`${status} ${f.category} — ${f.description}`, 14, y);
    y += 6;
    if (f.succeeded) {
      doc.setFontSize(9); doc.setTextColor(100);
      const ev = doc.splitTextToSize(`Evidence: ${f.evidence}`, 178);
      doc.text(ev, 18, y);
      y += ev.length * 4.5;
    }
    y += 2;
  }

  line(y); y += 8;
  doc.setFontSize(12); doc.setTextColor(40);
  doc.text("Recommendations", 14, y); y += 8;
  doc.setFontSize(10); doc.setTextColor(70);
  for (const rec of report.recommendations) {
    if (y > 275) { doc.addPage(); y = 20; }
    const lines = doc.splitTextToSize(`• ${rec}`, 178);
    doc.text(lines, 14, y);
    y += lines.length * 5 + 2;
  }

  const safeName = (() => {
    try { return new URL(targetLabel).hostname; }
    catch { return targetLabel.replace(/[^a-z0-9]/gi, '_').slice(0, 30); }
  })();
  doc.save(`red-team-${safeName}-${Date.now()}.pdf`);
}

// ─── Main Component ───────────────────────────────────────────────────────────

const RedTeamAgent: React.FC = () => {
  const [sidebarExpanded, setSidebarExpanded] = useState(true);
  const [profileImage] = useState("");

  // Config
  const [targetUrl,           setTargetUrl]           = useState("");
  const [apiKey,              setApiKey]              = useState("");
  const [authHeader,          setAuthHeader]          = useState("");
  const [requestFormat,       setRequestFormat]       = useState<ReqFormat>("openai");
  const [customBodyTemplate,  setCustomBodyTemplate]  = useState('{"message":"{{payload}}"}');
  const [authorized,          setAuthorized]          = useState(false);

  // Scan state
  const [status,    setStatus]    = useState<ScanStatus>("idle");
  const [steps,     setSteps]     = useState<Step[]>([]);
  const [thoughts,  setThoughts]  = useState<string[]>([]);
  const [findings,  setFindings]  = useState<Finding[]>([]);
  const [report,    setReport]    = useState<ScanReport | null>(null);
  const [error,     setError]     = useState<string>("");
  const [fingerprint, setFingerprint] = useState<{ probe: string; response: string } | null>(null);
  const [debugLog,  setDebugLog]  = useState<{ probe: string; response: string; category?: string; error?: string }[]>([]);

  // Code scan state
  const [scanMode,    setScanMode]    = useState<ScanMode>('endpoint');
  const [codeFiles,   setCodeFiles]   = useState<File[]>([]);
  const [codeStatus,  setCodeStatus]  = useState<ScanStatus>('idle');
  const [codeReport,  setCodeReport]  = useState<ScanReport | null>(null);
  const [codeError,   setCodeError]   = useState('');
  const codeInputRef   = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  const stepLogRef = useRef<HTMLDivElement>(null);
  const abortRef   = useRef<AbortController | null>(null);

  const handleLogout = () => { localStorage.removeItem("token"); window.location.href = "/login"; };

  const scrollStepLog = () => {
    setTimeout(() => {
      if (stepLogRef.current) stepLogRef.current.scrollTop = stepLogRef.current.scrollHeight;
    }, 50);
  };

  const startScan = useCallback(async () => {
    if (!targetUrl.trim()) return;
    if (!authorized) return;

    // Reset state
    setStatus("scanning");
    setSteps([]);
    setThoughts([]);
    setFindings([]);
    setReport(null);
    setError("");
    setFingerprint(null);

    const token = localStorage.getItem("token");
    const abort = new AbortController();
    abortRef.current = abort;

    try {
      const response = await fetch(`${API_BASE_URL}/red-team/scan`, {
        method:  "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization:  `Bearer ${token}`,
        },
        body:   JSON.stringify({ targetUrl, apiKey, authHeader, requestFormat, customBodyTemplate }),
        signal: abort.signal,
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Scan failed");
      }

      const reader  = response.body!.getReader();
      const decoder = new TextDecoder();
      let   buffer  = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        let event = "message";
        for (const line of lines) {
          if (line.startsWith("event: ")) { event = line.slice(7).trim(); continue; }
          if (!line.startsWith("data: "))  continue;

          let data: any;
          try { data = JSON.parse(line.slice(6)); } catch { continue; }

          if (event === "step") {
            setSteps(prev => [...prev, data]);
            scrollStepLog();
          } else if (event === "thought") {
            setThoughts(prev => [...prev, data.text]);
            scrollStepLog();
          } else if (event === "fingerprint") {
            setFingerprint(data);
          } else if (event === "finding") {
            setFindings(prev => [...prev, data]);
          } else if (event === "complete") {
            setReport(data);
            setStatus("complete");
          } else if (event === "debug") {
            setDebugLog(prev => [...prev, data]);
            scrollStepLog();
          } else if (event === "error") {
            setError(data.message);
            setStatus("error");
          }
          event = "message";
        }
      }

      if (status === "scanning") setStatus("complete");

    } catch (err: any) {
      if (err.name !== "AbortError") {
        setError(err.message);
        setStatus("error");
      }
    }
  }, [targetUrl, apiKey, authHeader, requestFormat, customBodyTemplate, authorized]);

  const cancelScan = () => {
    abortRef.current?.abort();
    setStatus("idle");
  };

  const reset = () => {
    setStatus("idle");
    setSteps([]);
    setThoughts([]);
    setFindings([]);
    setReport(null);
    setError("");
    setFingerprint(null);
    setDebugLog([]);
  };

  const handleCodeFiles = (newFiles: FileList | null) => {
    if (!newFiles) return;
    setCodeFiles(prev => {
      const existing = new Set(prev.map(f => f.name));
      const toAdd = Array.from(newFiles).filter(f => !existing.has(f.name));
      return [...prev, ...toAdd].slice(0, 15);
    });
  };

  const removeCodeFile = (name: string) => setCodeFiles(prev => prev.filter(f => f.name !== name));

  const startCodeScan = async () => {
    if (codeFiles.length === 0) return;
    setCodeStatus('scanning');
    setCodeReport(null);
    setCodeError('');
    const token = localStorage.getItem('token');
    const fd = new FormData();
    codeFiles.forEach(f => fd.append('files', f));
    try {
      const res = await fetch(`${API_BASE_URL}/red-team/scan-code`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Code scan failed');
      }
      const data = await res.json();
      setCodeReport(data);
      setCodeStatus('complete');
    } catch (err: any) {
      setCodeError(err.message);
      setCodeStatus('error');
    }
  };

  const resetCode = () => {
    setCodeStatus('idle');
    setCodeReport(null);
    setCodeError('');
    setCodeFiles([]);
  };

  const successfulFindings = findings.filter(f => f.succeeded);
  const resistedFindings   = findings.filter(f => !f.succeeded);

  return (
    <div className="flex flex-col min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <Header
        profileImage={profileImage}
        token={localStorage.getItem("token") || ""}
        handleLogout={handleLogout}
      />
      <div className="flex flex-1 overflow-hidden">
        <AppSidebar sidebarExpanded={sidebarExpanded} setSidebarExpanded={setSidebarExpanded} />

        <main className="flex-1 overflow-y-auto p-6">
          {/* ── Header ───────────────────────────────────────────────────── */}
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2.5 bg-red-100 dark:bg-red-900/30 rounded-xl">
              <Target className="w-6 h-6 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">AI Pipeline Red-Team Agent</h1>
              <p className="text-sm text-gray-400">
                Agentic adversarial testing — Claude autonomously discovers vulnerabilities in your AI system
              </p>
            </div>
          </div>

          {/* ── Mode tabs ────────────────────────────────────────────────── */}
          <div className="flex gap-1 p-1 bg-white/10 rounded-xl w-fit mb-6">
            <button
              onClick={() => setScanMode('endpoint')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition ${
                scanMode === 'endpoint' ? 'bg-red-600 text-white shadow' : 'text-gray-300 hover:text-white'
              }`}
            >
              <Globe className="w-4 h-4" /> Scan Endpoint
            </button>
            <button
              onClick={() => setScanMode('code')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition ${
                scanMode === 'code' ? 'bg-indigo-600 text-white shadow' : 'text-gray-300 hover:text-white'
              }`}
            >
              <FileCode className="w-4 h-4" /> Scan Code
            </button>
          </div>

          {/* ── Config Panel (idle) ───────────────────────────────────────── */}
          {scanMode === 'endpoint' && status === "idle" && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="max-w-2xl mx-auto bg-white dark:bg-gray-800 rounded-2xl shadow-md border border-gray-200 dark:border-gray-700 p-6"
            >
              <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-5 flex items-center gap-2">
                <Globe className="w-5 h-5 text-amber-400" /> Target Configuration
              </h2>

              <div className="space-y-4">
                {/* Target URL */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Target AI Endpoint URL <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="url"
                    value={targetUrl}
                    onChange={e => setTargetUrl(e.target.value)}
                    placeholder="https://api.example.com/chat/completions"
                    className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                  />
                </div>

                {/* Request Format */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Request Format
                  </label>
                  <div className="grid grid-cols-4 gap-2">
                    {(["openai", "anthropic", "simple", "custom"] as ReqFormat[]).map(fmt => (
                      <button
                        key={fmt}
                        onClick={() => setRequestFormat(fmt)}
                        className={`py-2 rounded-lg text-sm font-medium border transition ${
                          requestFormat === fmt
                            ? "bg-amber-500 text-slate-900 border-amber-500"
                            : "bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:border-indigo-400"
                        }`}
                      >
                        {fmt.charAt(0).toUpperCase() + fmt.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Custom template */}
                {requestFormat === "custom" && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Request Body Template
                    </label>
                    <textarea
                      rows={3}
                      value={customBodyTemplate}
                      onChange={e => setCustomBodyTemplate(e.target.value)}
                      placeholder='{"message":"{{payload}}"}'
                      className="w-full font-mono text-xs rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-400"
                    />
                    <p className="text-xs text-gray-400 mt-1">Use <code>{"{{payload}}"}</code> as the placeholder for the probe text.</p>
                  </div>
                )}

                {/* Auth */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">API Key</label>
                    <input
                      type="password"
                      value={apiKey}
                      onChange={e => setApiKey(e.target.value)}
                      placeholder="sk-..."
                      className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Auth Header <span className="text-gray-400 font-normal">(overrides key)</span>
                    </label>
                    <input
                      type="text"
                      value={authHeader}
                      onChange={e => setAuthHeader(e.target.value)}
                      placeholder="Bearer eyJ..."
                      className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                    />
                  </div>
                </div>

                {/* Authorization consent */}
                <label className="flex items-start gap-3 cursor-pointer p-3 rounded-lg bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800">
                  <input
                    type="checkbox"
                    checked={authorized}
                    onChange={e => setAuthorized(e.target.checked)}
                    className="mt-0.5 w-4 h-4 accent-indigo-600"
                  />
                  <span className="text-sm text-yellow-800 dark:text-yellow-200">
                    <strong>I confirm</strong> I have explicit authorization to perform security testing on this endpoint. Unauthorized testing is illegal.
                  </span>
                </label>

                <button
                  onClick={startScan}
                  disabled={!targetUrl || !authorized}
                  className="w-full py-3 bg-red-600 hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition flex items-center justify-center gap-2"
                >
                  <Target className="w-5 h-5" /> Start Red-Team Scan
                </button>
              </div>
            </motion.div>
          )}

          {/* ── Scanning State ────────────────────────────────────────────── */}
          {scanMode === 'endpoint' && status === "scanning" && (
            <div className="space-y-4">
              {/* Status bar */}
              <div className="flex items-center justify-between bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 px-5 py-3">
                <div className="flex items-center gap-3">
                  <Loader2 className="w-5 h-5 text-red-500 animate-spin" />
                  <div>
                    <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">Agent running…</p>
                    <p className="text-xs text-gray-400">{targetUrl}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4 text-sm text-gray-500">
                  <span><strong className="text-gray-800 dark:text-gray-200">{steps.length}</strong> steps</span>
                  <span><strong className="text-red-500">{successfulFindings.length}</strong> vulnerabilities</span>
                  <button onClick={cancelScan} className="px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 text-xs font-medium transition">
                    Cancel
                  </button>
                </div>
              </div>

              {/* Two-column live feed */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Agent step log */}
                <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                  <div className="px-5 py-3 border-b border-gray-100 dark:border-gray-700">
                    <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200 flex items-center gap-2">
                      <Cpu className="w-4 h-4 text-amber-400" /> Agent Reasoning
                    </h3>
                  </div>
                  <div ref={stepLogRef} className="h-80 overflow-y-auto p-4 space-y-2 font-mono text-xs">
                    {fingerprint && (
                      <div className="p-2 rounded bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                        <p className="text-amber-600 dark:text-amber-300 font-semibold mb-1">🔍 Fingerprint complete</p>
                        <p className="text-gray-500 truncate">{fingerprint.response}</p>
                      </div>
                    )}
                    {steps.map((step, i) => (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="flex items-start gap-2"
                      >
                        <span className="text-gray-400 select-none w-5 text-right flex-shrink-0">{step.step}.</span>
                        {toolIcon(step.tool)}
                        <span className="text-gray-700 dark:text-gray-300">
                          <span className={`font-semibold ${
                            step.tool === "send_adversarial_probe" ? "text-orange-500" :
                            step.tool === "fingerprint_target"     ? "text-amber-400" :
                            step.tool === "record_finding"         ? "text-purple-400" : "text-green-400"
                          }`}>{step.tool}</span>
                          {step.category && <span className="text-gray-400"> [{step.category}]</span>}
                          {" — "}{step.description}
                        </span>
                      </motion.div>
                    ))}
                    {thoughts.slice(-3).map((t, i) => (
                      <div key={`t${i}`} className="text-gray-400 italic pl-7 border-l-2 border-gray-200 dark:border-gray-700">
                        {t.slice(0, 180)}{t.length > 180 ? "…" : ""}
                      </div>
                    ))}
                    {debugLog.slice(-5).map((d, i) => (
                      <div key={`d${i}`} className="pl-7 space-y-0.5">
                        {d.error
                          ? <span className="text-red-400">⚠ {d.category}: {d.error}</span>
                          : <>
                              <span className="text-yellow-500">→ probe: {d.probe?.slice(0, 80)}</span>
                              <div className="text-green-400 pl-2">← {d.response?.slice(0, 100)}</div>
                            </>
                        }
                      </div>
                    ))}
                    <div className="flex items-center gap-2 text-gray-400 pl-7">
                      <Loader2 className="w-3 h-3 animate-spin" /> thinking…
                    </div>
                  </div>
                </div>

                {/* Live findings */}
                <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                  <div className="px-5 py-3 border-b border-gray-100 dark:border-gray-700">
                    <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200 flex items-center gap-2">
                      <ShieldAlert className="w-4 h-4 text-red-400" /> Live Findings
                      {successfulFindings.length > 0 && (
                        <span className="ml-auto px-2 py-0.5 rounded-full bg-red-100 text-red-600 text-xs font-bold">
                          {successfulFindings.length} vuln{successfulFindings.length > 1 ? "s" : ""}
                        </span>
                      )}
                    </h3>
                  </div>
                  <div className="h-80 overflow-y-auto p-4 space-y-2">
                    {findings.length === 0 ? (
                      <div className="flex flex-col items-center justify-center h-full text-gray-400">
                        <Activity className="w-8 h-8 mb-2 opacity-30" />
                        <p className="text-sm">Probes firing…</p>
                      </div>
                    ) : (
                      findings.map((f, i) => <FindingCard key={i} finding={f} index={i} />)
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── Error State ───────────────────────────────────────────────── */}
          {scanMode === 'endpoint' && status === "error" && (
            <div className="max-w-2xl mx-auto bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-2xl p-6 text-center">
              <XCircle className="w-10 h-10 text-red-500 mx-auto mb-3" />
              <p className="font-semibold text-red-700 dark:text-red-300 mb-1">Scan failed</p>
              <p className="text-sm text-red-600 dark:text-red-400 mb-4">{error}</p>
              <button onClick={reset} className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition">
                Try Again
              </button>
            </div>
          )}

          {/* ── Report ────────────────────────────────────────────────────── */}
          {scanMode === 'endpoint' && status === "complete" && report && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5">

              {/* Summary card */}
              <div className={`rounded-2xl border-2 p-6 ${riskBg[report.riskLevel]}`}>
                <div className="flex flex-col md:flex-row gap-6 items-start md:items-center">
                  <RiskGauge score={report.score} riskLevel={report.riskLevel} />
                  <div className="flex-1">
                    <div className="flex flex-wrap gap-3 mb-3 text-sm text-gray-600 dark:text-gray-400">
                      <span className="flex items-center gap-1"><Target className="w-4 h-4" />{targetUrl}</span>
                      <span className="flex items-center gap-1"><Zap className="w-4 h-4" />{report.totalProbes} probes</span>
                      <span className="flex items-center gap-1"><ShieldAlert className="w-4 h-4 text-red-500" />{report.successfulAttacks} successful attacks</span>
                      <span className="flex items-center gap-1"><Clock className="w-4 h-4" />{(report.duration / 1000).toFixed(1)}s</span>
                    </div>
                    <p className="text-gray-700 dark:text-gray-300 text-sm leading-relaxed">{report.summary}</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => exportPDF(report, targetUrl)}
                      className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-900 rounded-lg text-sm font-medium transition"
                    >
                      <Download className="w-4 h-4" /> PDF
                    </button>
                    <button
                      onClick={reset}
                      className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium transition"
                    >
                      <RotateCcw className="w-4 h-4" /> New Scan
                    </button>
                  </div>
                </div>
              </div>

              {/* Findings grid */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                {/* Vulnerabilities */}
                <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5">
                  <h3 className="font-semibold text-gray-800 dark:text-gray-100 mb-4 flex items-center gap-2">
                    <XCircle className="w-5 h-5 text-red-500" />
                    Vulnerabilities Found
                    <span className="ml-auto text-sm font-bold text-red-500">{successfulFindings.length}</span>
                  </h3>
                  {successfulFindings.length === 0 ? (
                    <div className="text-center py-8 text-gray-400">
                      <ShieldCheck className="w-10 h-10 mx-auto mb-2 text-green-400" />
                      <p className="text-sm">No successful attacks</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {successfulFindings.map((f, i) => <FindingCard key={i} finding={f} index={i} />)}
                    </div>
                  )}
                </div>

                {/* Resistant + Recommendations */}
                <div className="space-y-4">
                  <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5">
                    <h3 className="font-semibold text-gray-800 dark:text-gray-100 mb-3 flex items-center gap-2">
                      <ShieldCheck className="w-5 h-5 text-green-500" />
                      Attacks Resisted
                      <span className="ml-auto text-sm font-bold text-green-500">{resistedFindings.length}</span>
                    </h3>
                    {resistedFindings.length === 0 ? (
                      <p className="text-sm text-gray-400">No resistant probes recorded.</p>
                    ) : (
                      <div className="space-y-2 max-h-48 overflow-y-auto">
                        {resistedFindings.map((f, i) => (
                          <div key={i} className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                            <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0" />
                            <span>{f.category} — {f.description.slice(0, 60)}…</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5">
                    <h3 className="font-semibold text-gray-800 dark:text-gray-100 mb-3 flex items-center gap-2">
                      <AlertTriangle className="w-5 h-5 text-orange-400" /> Recommendations
                    </h3>
                    <ol className="space-y-2">
                      {report.recommendations.map((rec, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300">
                          <span className="flex-shrink-0 w-5 h-5 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-300 text-xs font-bold flex items-center justify-center">
                            {i + 1}
                          </span>
                          {rec}
                        </li>
                      ))}
                    </ol>
                  </div>
                </div>
              </div>

              {/* Agent step log (collapsible) */}
              <details className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700">
                <summary className="px-5 py-4 cursor-pointer font-semibold text-gray-700 dark:text-gray-200 text-sm flex items-center gap-2">
                  <Cpu className="w-4 h-4 text-amber-400" /> Agent Step Log ({steps.length} steps)
                </summary>
                <div className="px-5 pb-4 font-mono text-xs space-y-1 max-h-64 overflow-y-auto">
                  {steps.map((step, i) => (
                    <div key={i} className="flex items-start gap-2 text-gray-600 dark:text-gray-400">
                      <span className="text-gray-400 w-5 text-right flex-shrink-0">{step.step}.</span>
                      {toolIcon(step.tool)}
                      <span>
                        <span className="font-semibold text-gray-700 dark:text-gray-300">{step.tool}</span>
                        {step.category && <span className="text-gray-400"> [{step.category}]</span>}
                        {" — "}{step.description}
                      </span>
                    </div>
                  ))}
                </div>
              </details>

            </motion.div>
          )}
          {/* ══════════════════ SCAN CODE TAB ══════════════════ */}

          {/* ── Code Upload (idle) ───────────────────────────────────────── */}
          {scanMode === 'code' && codeStatus === 'idle' && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="max-w-2xl mx-auto space-y-5"
            >
              {/* Drop zone */}
              <div
                onClick={() => codeInputRef.current?.click()}
                onDragOver={e => e.preventDefault()}
                onDrop={e => { e.preventDefault(); handleCodeFiles(e.dataTransfer.files); }}
                className="flex flex-col items-center justify-center gap-3 border-2 border-dashed border-indigo-500/50 rounded-2xl p-10 cursor-pointer hover:border-indigo-400 hover:bg-indigo-900/10 transition bg-white/5"
              >
                <Upload className="w-10 h-10 text-indigo-400 opacity-70" />
                <p className="text-gray-300 font-medium">Drop files here or click to browse</p>
                <p className="text-xs text-gray-500">.js .ts .tsx .jsx .py .json .yaml .toml .env — up to 15 files, 200 KB each</p>
                <input
                  ref={codeInputRef}
                  type="file"
                  multiple
                  accept=".js,.ts,.tsx,.jsx,.py,.json,.txt,.md,.yaml,.yml,.toml,.env"
                  className="hidden"
                  onChange={e => handleCodeFiles(e.target.files)}
                />
              </div>

              {/* Folder upload */}
              <div className="flex items-center gap-3">
                <button
                  onClick={() => folderInputRef.current?.click()}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg border border-indigo-500/50 text-indigo-300 hover:bg-indigo-900/20 text-sm transition"
                >
                  <FolderOpen className="w-4 h-4" /> Upload folder
                </button>
                <span className="text-xs text-gray-500">Scans all supported files in the folder</span>
                <input
                  ref={folderInputRef}
                  type="file"
                  // @ts-ignore — webkitdirectory is not in the TS types
                  webkitdirectory=""
                  multiple
                  className="hidden"
                  onChange={e => handleCodeFiles(e.target.files)}
                />
              </div>

              {/* File list */}
              {codeFiles.length > 0 && (
                <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-4 space-y-2">
                  <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">
                    {codeFiles.length} file{codeFiles.length > 1 ? 's' : ''} queued
                  </p>
                  {codeFiles.map(f => (
                    <div key={f.name} className="flex items-center justify-between gap-2 text-sm">
                      <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300 min-w-0">
                        <FileCode className="w-4 h-4 text-indigo-400 flex-shrink-0" />
                        <span className="truncate">{f.name}</span>
                        <span className="text-xs text-gray-400 flex-shrink-0">{(f.size / 1024).toFixed(1)} KB</span>
                      </div>
                      <button onClick={() => removeCodeFile(f.name)} className="text-gray-400 hover:text-red-500 flex-shrink-0">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <button
                onClick={startCodeScan}
                disabled={codeFiles.length === 0}
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition flex items-center justify-center gap-2"
              >
                <FileCode className="w-5 h-5" /> Analyse Code
              </button>
            </motion.div>
          )}

          {/* ── Code Scanning ────────────────────────────────────────────── */}
          {scanMode === 'code' && codeStatus === 'scanning' && (
            <div className="flex flex-col items-center justify-center gap-4 py-20">
              <Loader2 className="w-10 h-10 text-indigo-400 animate-spin" />
              <p className="text-gray-300 font-medium">Claude is analysing your code…</p>
              <p className="text-xs text-gray-500">Checking {codeFiles.length} file{codeFiles.length > 1 ? 's' : ''} for AI security vulnerabilities</p>
            </div>
          )}

          {/* ── Code Error ───────────────────────────────────────────────── */}
          {scanMode === 'code' && codeStatus === 'error' && (
            <div className="max-w-2xl mx-auto bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-2xl p-6 text-center">
              <XCircle className="w-10 h-10 text-red-500 mx-auto mb-3" />
              <p className="font-semibold text-red-700 dark:text-red-300 mb-1">Analysis failed</p>
              <p className="text-sm text-red-600 dark:text-red-400 mb-4">{codeError}</p>
              <button onClick={resetCode} className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition">
                Try Again
              </button>
            </div>
          )}

          {/* ── Code Report ──────────────────────────────────────────────── */}
          {scanMode === 'code' && codeStatus === 'complete' && codeReport && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5">

              {/* Summary card */}
              <div className={`rounded-2xl border-2 p-6 ${riskBg[codeReport.riskLevel]}`}>
                <div className="flex flex-col md:flex-row gap-6 items-start md:items-center">
                  <RiskGauge score={codeReport.score} riskLevel={codeReport.riskLevel} />
                  <div className="flex-1">
                    <div className="flex flex-wrap gap-3 mb-3 text-sm text-gray-600 dark:text-gray-400">
                      <span className="flex items-center gap-1"><FileCode className="w-4 h-4" />{codeFiles.length} file{codeFiles.length > 1 ? 's' : ''} scanned</span>
                      <span className="flex items-center gap-1"><ShieldAlert className="w-4 h-4 text-red-500" />{codeReport.successfulAttacks} vulnerabilities</span>
                    </div>
                    <p className="text-gray-700 dark:text-gray-300 text-sm leading-relaxed">{codeReport.summary}</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => exportPDF(codeReport, codeFiles.map(f => f.name).join(', '))}
                      className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-900 rounded-lg text-sm font-medium transition"
                    >
                      <Download className="w-4 h-4" /> PDF
                    </button>
                    <button
                      onClick={resetCode}
                      className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium transition"
                    >
                      <RotateCcw className="w-4 h-4" /> New Scan
                    </button>
                  </div>
                </div>
              </div>

              {/* Findings + Recommendations */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5">
                  <h3 className="font-semibold text-gray-800 dark:text-gray-100 mb-4 flex items-center gap-2">
                    <XCircle className="w-5 h-5 text-red-500" />
                    Vulnerabilities Found
                    <span className="ml-auto text-sm font-bold text-red-500">
                      {codeReport.findings.filter(f => f.succeeded).length}
                    </span>
                  </h3>
                  {codeReport.findings.filter(f => f.succeeded).length === 0 ? (
                    <div className="text-center py-8 text-gray-400">
                      <ShieldCheck className="w-10 h-10 mx-auto mb-2 text-green-400" />
                      <p className="text-sm">No vulnerabilities found</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {codeReport.findings.filter(f => f.succeeded).map((f, i) => (
                        <FindingCard key={i} finding={f} index={i} />
                      ))}
                    </div>
                  )}
                </div>

                <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5">
                  <h3 className="font-semibold text-gray-800 dark:text-gray-100 mb-3 flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-orange-400" /> Recommendations
                  </h3>
                  <ol className="space-y-2">
                    {codeReport.recommendations.map((rec, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300">
                        <span className="flex-shrink-0 w-5 h-5 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-300 text-xs font-bold flex items-center justify-center">
                          {i + 1}
                        </span>
                        {rec}
                      </li>
                    ))}
                  </ol>
                </div>
              </div>

            </motion.div>
          )}

        </main>
      </div>
      <Footer />
    </div>
  );
};

export default RedTeamAgent;
