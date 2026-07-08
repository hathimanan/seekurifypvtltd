import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { jsPDF } from "jspdf";
import {
  ShieldAlert, ShieldCheck, Shield, FileSearch, KeyRound, BarChart3,
  Phone, Globe, Server, AlertTriangle, CheckCircle,
  XCircle, Info, Loader2, MessageCircle, ChevronDown, ChevronUp,
  Upload, Link, Type, Cpu, Zap, Eye, EyeOff, RotateCcw, Copy, CheckCheck, ScanEye, FileDown,
} from "lucide-react";
import { API_BASE_URL } from "../services/api";
import Header from "./ui/Header";
import Footer from "./ui/Footer";
import { useNavigate } from "react-router-dom";
import AppSidebar from "./ui/AppSidebar";

// ─── Types ────────────────────────────────────────────────────────────────────

type InputMode = "text" | "file" | "url";
type Severity  = "critical" | "high" | "medium" | "low";
type RiskLevel = "critical" | "high" | "medium" | "low" | "clean";

interface Annotation {
  start: number; end: number;
  severity: Severity; category: string; label: string;
}

interface Finding {
  patternId: string; category: string; severity: Severity;
  description: string; remediation?: string; codefix?: string;
  matchedText: string; position: { start: number; end: number };
}

interface ScanResult {
  inputType: InputMode;
  fileName?: string; url?: string;
  inputSummary: string; displayText: string; truncated: boolean;
  score: number; riskLevel: RiskLevel;
  findings: Finding[]; annotations: Annotation[];
  mlResult?: {
    topLabel: string;
    topScore: number;
    scores: Record<string, number>;
    isInjection: boolean;
    attackCategory: string | null;
    mlScore: number;
    novelDetection: boolean;
  } | null;
  semantic?: { isInjection: boolean; confidence: number; attackType: string | null; reason: string; error?: string; skipped?: boolean };
  agenticSim?: { complied: boolean; toolsInvoked: { name: string; input: any }[]; agentResponse: string; error?: string; skipped?: boolean };
  timestamp: string;
}

// ─── Colour helpers ───────────────────────────────────────────────────────────

const riskColors: Record<RiskLevel, string> = {
  critical: "text-red-600 dark:text-red-400",
  high:     "text-orange-600 dark:text-orange-400",
  medium:   "text-yellow-600 dark:text-yellow-400",
  low:      "text-blue-600 dark:text-blue-400",
  clean:    "text-green-600 dark:text-green-400",
};

const riskBg: Record<RiskLevel, string> = {
  critical: "bg-red-50 dark:bg-red-900/20 border-red-300 dark:border-red-700",
  high:     "bg-orange-50 dark:bg-orange-900/20 border-orange-300 dark:border-orange-700",
  medium:   "bg-yellow-50 dark:bg-yellow-900/20 border-yellow-300 dark:border-yellow-700",
  low:      "bg-blue-50 dark:bg-blue-900/20 border-blue-300 dark:border-blue-700",
  clean:    "bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-700",
};

const severityHighlight: Record<Severity, string> = {
  critical: "bg-red-300/60 dark:bg-red-500/40 rounded px-0.5 cursor-pointer",
  high:     "bg-orange-300/60 dark:bg-orange-500/40 rounded px-0.5 cursor-pointer",
  medium:   "bg-yellow-200/70 dark:bg-yellow-600/40 rounded px-0.5 cursor-pointer",
  low:      "bg-blue-200/60 dark:bg-blue-600/30 rounded px-0.5 cursor-pointer",
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

function downloadInjectionReport(result: ScanResult): void {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;
  const maxWidth = pageWidth - margin * 2;
  let y = 16;

  const addPageIfNeeded = (requiredHeight = 10) => {
    if (y + requiredHeight > pageHeight - 14) {
      doc.addPage();
      y = 16;
    }
  };

  const writeLines = (text: string, size = 10, color: [number, number, number] = [55, 65, 81], gap = 5) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(size);
    doc.setTextColor(color[0], color[1], color[2]);
    const lines = doc.splitTextToSize(text, maxWidth);
    addPageIfNeeded(lines.length * gap + 2);
    doc.text(lines, margin, y);
    y += lines.length * gap + 2;
  };

  const sectionTitle = (title: string) => {
    addPageIfNeeded(12);
    doc.setDrawColor(203, 213, 225);
    doc.line(margin, y, pageWidth - margin, y);
    y += 6;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(15, 23, 42);
    doc.text(title, margin, y);
    y += 7;
  };

  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, pageWidth, 28, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(255, 255, 255);
  doc.text("Seekurify Prompt Injection Report", margin, 16);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(`Generated ${new Date(result.timestamp).toLocaleString()}`, margin, 22);
  y = 38;

  sectionTitle("Executive Summary");
  writeLines(`Risk level: ${result.riskLevel.toUpperCase()}`);
  writeLines(`Overall score: ${result.score}/100`);
  writeLines(
    result.inputType === "file"
      ? `Source: file (${result.fileName || "unknown"})`
      : result.inputType === "url"
        ? `Source: URL (${result.url || "unknown"})`
        : `Source: text input (${result.displayText.length.toLocaleString()} characters scanned)`
  );
  writeLines(`Pattern findings: ${result.findings.length}`);

  if (result.mlResult) {
    sectionTitle("Layer 1.5 ML Detection");
    writeLines(`Decision: ${result.mlResult.isInjection ? "FLAGGED" : "CLEAN"}`);
    writeLines(`Top label: ${result.mlResult.topLabel}`);
    writeLines(`Top confidence: ${Math.round(result.mlResult.topScore * 100)}%`);
    writeLines(`Score contribution: +${result.mlResult.mlScore}/25`);
    if (result.mlResult.attackCategory) {
      writeLines(`Attack category: ${result.mlResult.attackCategory}`);
    }
    if (result.mlResult.novelDetection) {
      writeLines("Novel detection: ML flagged suspicious behavior beyond the regex layer.");
    }
  }

  if (result.semantic && !result.semantic.skipped) {
    sectionTitle("Semantic Analysis");
    if (result.semantic.error) {
      writeLines(`Semantic layer error: ${result.semantic.error}`);
    } else {
      writeLines(`Decision: ${result.semantic.isInjection ? "INJECTION" : "CLEAN"}`);
      writeLines(`Confidence: ${Math.round((result.semantic.confidence ?? 0) * 100)}%`);
      if (result.semantic.attackType) {
        writeLines(`Attack type: ${result.semantic.attackType}`);
      }
      writeLines(`Reason: ${result.semantic.reason}`);
    }
  }

  if (result.agenticSim && !result.agenticSim.skipped) {
    sectionTitle("Agentic Simulation");
    if (result.agenticSim.error) {
      writeLines(`Agentic layer error: ${result.agenticSim.error}`);
    } else {
      writeLines(`Outcome: ${result.agenticSim.complied ? "AGENT COMPROMISED" : "AGENT RESISTANT"}`);
      writeLines(`Tools invoked: ${result.agenticSim.toolsInvoked.length}`);
      if (result.agenticSim.agentResponse) {
        writeLines(`Agent response: ${result.agenticSim.agentResponse}`);
      }
    }
  }

  sectionTitle("Findings");
  if (result.findings.length === 0) {
    writeLines("No regex pattern findings were detected.");
  } else {
    result.findings.forEach((finding, index) => {
      addPageIfNeeded(24);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(15, 23, 42);
      doc.text(`${index + 1}. ${finding.category} (${finding.severity.toUpperCase()})`, margin, y);
      y += 6;
      writeLines(finding.description, 10);
      writeLines(`Matched text: "${finding.matchedText}"`, 9, [71, 85, 105]);
      if (finding.remediation) {
        writeLines(`Remediation: ${finding.remediation}`, 9, [29, 78, 216]);
      }
      if (finding.codefix) {
        writeLines(`Code fix: ${finding.codefix}`, 8, [22, 101, 52], 4);
      }
      y += 2;
    });
  }

  sectionTitle("Scanned Content Preview");
  writeLines(result.displayText.slice(0, 2500) || result.inputSummary, 8, [71, 85, 105], 4);

  const fileLabel = result.inputType === "file"
    ? (result.fileName || "scan")
    : result.inputType === "url"
      ? "url-scan"
      : "text-scan";

  doc.save(`seekurify-prompt-injection-report-${fileLabel}.pdf`);
}

// ─── Annotated Text Renderer ──────────────────────────────────────────────────

const AnnotatedText: React.FC<{
  text: string; annotations: Annotation[]; truncated: boolean;
}> = ({ text, annotations, truncated }) => {
  const [tooltip, setTooltip] = useState<{ ann: Annotation; x: number; y: number } | null>(null);

  if (!annotations.length) {
    return (
      <div className="text-sm font-mono whitespace-pre-wrap break-words leading-relaxed text-gray-700 dark:text-gray-300">
        {text}
        {truncated && <span className="text-gray-400 italic"> … [truncated to 10 000 chars]</span>}
      </div>
    );
  }

  // Sort by start; remove fully-overlapping duplicates
  const sorted = [...annotations].sort((a, b) => a.start - b.start);
  const segments: { text: string; ann: Annotation | null }[] = [];
  let pos = 0;

  for (const ann of sorted) {
    if (ann.start > pos) segments.push({ text: text.slice(pos, ann.start), ann: null });
    const segEnd = Math.max(ann.end, pos);
    if (segEnd > pos) {
      segments.push({ text: text.slice(Math.max(ann.start, pos), segEnd), ann });
      pos = segEnd;
    }
  }
  if (pos < text.length) segments.push({ text: text.slice(pos), ann: null });

  return (
    <div className="relative">
      <div className="text-sm font-mono whitespace-pre-wrap break-words leading-relaxed text-gray-700 dark:text-gray-300">
        {segments.map((seg, i) =>
          seg.ann ? (
            <mark
              key={i}
              className={severityHighlight[seg.ann.severity as Severity]}
              onMouseEnter={e => {
                const rect = (e.target as HTMLElement).getBoundingClientRect();
                setTooltip({ ann: seg.ann!, x: rect.left, y: rect.bottom + 4 });
              }}
              onMouseLeave={() => setTooltip(null)}
            >
              {seg.text}
            </mark>
          ) : (
            <span key={i}>{seg.text}</span>
          )
        )}
        {truncated && <span className="text-gray-400 italic"> … [truncated to 10 000 chars]</span>}
      </div>

      {tooltip && (
        <div
          className="fixed z-50 bg-gray-900 text-white text-xs rounded-lg px-3 py-2 shadow-lg max-w-xs pointer-events-none"
          style={{ left: Math.min(tooltip.x, window.innerWidth - 260), top: tooltip.y }}
        >
          <div className={`font-bold mb-0.5 ${severityBadge[tooltip.ann.severity as Severity].split(' ')[1]}`}>
            {tooltip.ann.category}
          </div>
          {tooltip.ann.label}
        </div>
      )}
    </div>
  );
};

// ─── Collapsible section card ─────────────────────────────────────────────────

const SectionCard: React.FC<{ title: string; icon: React.ReactNode; children: React.ReactNode; defaultOpen?: boolean }> = ({
  title, icon, children, defaultOpen = true,
}) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-md border border-gray-200 dark:border-gray-700 overflow-hidden">
      <button onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-gray-50 dark:hover:bg-gray-700/50 transition">
        <div className="flex items-center gap-2 font-semibold text-gray-800 dark:text-gray-100">
          <span className="text-amber-500">{icon}</span>{title}
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div key="body" initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
            <div className="px-5 pb-5 border-t border-gray-100 dark:border-gray-700">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ─── Sidebar nav items ────────────────────────────────────────────────────────

const NAV_ITEMS = [
  { label: "Analyze Malware",        path: "/malware-analysis",  icon: <FileSearch   className="w-5 h-5" /> },
  { label: "Password Manager",        path: "/dashboard",         icon: <KeyRound     className="w-5 h-5" /> },
  { label: "System Events Dashboard", path: "/siem-dashboard",    icon: <BarChart3    className="w-5 h-5" /> },
  { label: "Security Awareness",       path: "/securityAwareness", icon: <ShieldCheck  className="w-5 h-5" /> },
  { label: "Contact Us",              path: "/contact",           icon: <Phone        className="w-5 h-5" /> },
  { label: "Prompt Privacy Scanner",          path: "/prompt-scanner",    icon: <Shield       className="w-5 h-5" /> },
  { label: "AI Injection Scanner",    path: "/injection-scanner", icon: <Zap          className="w-5 h-5" /> },
  { label: "DeepFake Detector",       path: "/deepfake-detector", icon: <ScanEye      className="w-5 h-5" /> },
];

// ─── base64 helper (handles UTF-8) ────────────────────────────────────────────
const toBase64 = (str: string): string => {
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  bytes.forEach(b => (binary += String.fromCharCode(b)));
  return btoa(binary);
};

// ─── Main Component ───────────────────────────────────────────────────────────

const PromptInjectionScanner: React.FC = () => {
  const navigate = useNavigate();
  const token = localStorage.getItem("token");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Input state ──────────────────────────────────────────────────────────
  const [mode, setMode] = useState<InputMode>("text");
  const [textInput, setTextInput] = useState("");
  const [urlInput, setUrlInput] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [runSemantic, setRunSemantic]     = useState(true);
  const [runAgenticSim, setRunAgenticSim] = useState(false);
  const [showOptions, setShowOptions]     = useState(false);

  // ── Scan state ───────────────────────────────────────────────────────────
  const [scanning, setScanning]   = useState(false);
  const [result, setResult]       = useState<ScanResult | null>(null);
  const [error, setError]         = useState<string | null>(null);
  const [showRaw, setShowRaw]     = useState(false);

  // ── History / nav state ──────────────────────────────────────────────────
  const [history, setHistory]           = useState<any[]>([]);
  const [historyLoading, setHistLoading] = useState(false);
  const [expandedId, setExpandedId]     = useState<string | null>(null);
  const [copiedIdx, setCopiedIdx]           = useState<number | null>(null);
  const [sidebarExpanded, setSidebarExpanded] = useState(true);
  const [phishingEnabled, setPhishingEnabled] = useState(false);
  const [siteShieldEnabled, setSiteShieldEnabled] = useState(false);

  useEffect(() => {
    fetch(`${API_BASE_URL}/feature-flags/read`)
      .then(r => r.json())
      .then(d => { setPhishingEnabled(d.phishingDetectorEnabled); setSiteShieldEnabled(d.siteShieldEnabled); })
      .catch(() => {});
  }, []);

  const fetchHistory = async () => {
    if (!token) return;
    setHistLoading(true);
    try {
      const r = await fetch(`${API_BASE_URL}/injection-scan/history`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (r.ok) { const d = await r.json(); setHistory(d.logs ?? []); }
    } catch (_) {}
    finally { setHistLoading(false); }
  };

  useEffect(() => { fetchHistory(); }, []);

  // ── Scan handler ─────────────────────────────────────────────────────────
  const handleScan = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null); setResult(null); setScanning(true);

    try {
      let body: BodyInit;
      let contentType: string | undefined;

      if (mode === "file") {
        if (!selectedFile) { setError("Please select a file."); setScanning(false); return; }
        const fd = new FormData();
        fd.append("inputType", "file");
        fd.append("file", selectedFile);
        fd.append("runSemantic", String(runSemantic));
        fd.append("runAgenticSim", String(runAgenticSim));
        body = fd;
      } else {
        const raw = mode === "url" ? urlInput.trim() : textInput;
        if (!raw) { setError(mode === "url" ? "Enter a URL." : "Enter some text."); setScanning(false); return; }
        body = JSON.stringify({ inputType: mode, encodedContent: toBase64(raw), runSemantic, runAgenticSim });
        contentType = "application/json";
      }

      const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
      if (contentType) headers["Content-Type"] = contentType;

      const res = await fetch(`${API_BASE_URL}/injection-scan`, { method: "POST", headers, body });
      const data = await res.json();

      if (!res.ok) setError(data.error ?? "Scan failed.");
      else { setResult(data as ScanResult); fetchHistory(); }
    } catch (_) {
      setError("Could not reach the server.");
    } finally {
      setScanning(false);
    }
  };

  const handleLogout = () => { localStorage.removeItem("token"); navigate("/"); };

  // ── Extra nav items based on feature flags ────────────────────────────────
  const navItems = [
    ...NAV_ITEMS,
    ...(phishingEnabled  ? [{ label: "Phishing Detector", path: "/detect-attacker", icon: <ShieldAlert className="w-5 h-5" /> }] : []),
    ...(siteShieldEnabled ? [{ label: "SiteShield Audit",  path: "/site-shield",     icon: <Globe       className="w-5 h-5" /> }] : []),
  ];

  // ── Risk label ────────────────────────────────────────────────────────────
  const RISK_LABEL: Record<RiskLevel, string> = {
    critical: "CRITICAL THREAT", high: "HIGH RISK", medium: "MEDIUM RISK", low: "LOW RISK", clean: "CLEAN",
  };

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <title>AI Injection Scanner — Seekurify</title>

      <Header token={token ?? ""} handleLogout={handleLogout} profileImage="" />

      {/* Dark mode toggle */}

      <div className="flex flex-1 overflow-hidden">
        {/* ── Sidebar ─────────────────────────────────────────────────────── */}
        <AppSidebar sidebarExpanded={sidebarExpanded} setSidebarExpanded={setSidebarExpanded} />


        {/* ── Main content ─────────────────────────────────────────────────── */}
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-4xl mx-auto px-6 py-10">

            {/* Page title */}
            <motion.div initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-8">
              <div className="inline-flex items-center gap-3 mb-3">
                <Zap className="w-10 h-10 text-amber-400" />
                <h1 className="text-4xl font-extrabold text-white">AI Injection Scanner</h1>
              </div>
              <p className="text-gray-400 text-lg">
                Detect prompt injection, role override, tool hijacking & agentic failure vectors in any content.
              </p>
              {/* Legend */}
              <div className="flex flex-wrap justify-center gap-3 mt-4 text-xs font-semibold">
                {(["critical","high","medium","low"] as Severity[]).map(s => (
                  <span key={s} className={`px-2 py-1 rounded-full ${severityBadge[s]}`}>{s.toUpperCase()}</span>
                ))}
              </div>
            </motion.div>

            {/* ── Input form ───────────────────────────────────────────────── */}
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
              className="bg-white dark:bg-gray-800 rounded-2xl shadow-md border border-gray-200 dark:border-gray-700 p-6 mb-6">

              {/* Mode tabs */}
              <div className="flex gap-2 mb-5">
                {([
                  { id: "text",  label: "Text",        icon: <Type   className="w-4 h-4" /> },
                  { id: "file",  label: "File Upload",  icon: <Upload className="w-4 h-4" /> },
                  { id: "url",   label: "URL",          icon: <Link   className="w-4 h-4" /> },
                ] as { id: InputMode; label: string; icon: React.ReactNode }[]).map(t => (
                  <button key={t.id} onClick={() => { setMode(t.id); setError(null); setResult(null); }}
                    className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition ${
                      mode === t.id
                        ? "bg-amber-500 text-slate-900 shadow"
                        : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
                    }`}>
                    {t.icon}{t.label}
                  </button>
                ))}
              </div>

              <form onSubmit={handleScan} className="space-y-4">
                {/* Text input */}
                {mode === "text" && (
                  <textarea value={textInput} onChange={e => setTextInput(e.target.value)}
                    rows={8} placeholder="Paste email body, document excerpt, web page content, or any text you want to scan for injection payloads…"
                    disabled={scanning}
                    className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white font-mono text-sm resize-y focus:outline-none focus:ring-2 focus:ring-amber-400 disabled:opacity-60" />
                )}

                {/* File upload */}
                {mode === "file" && (
                  <div
                    onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={e => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) setSelectedFile(f); }}
                    onClick={() => fileInputRef.current?.click()}
                    className={`flex flex-col items-center justify-center border-2 border-dashed rounded-xl px-6 py-10 cursor-pointer transition ${
                      dragOver ? "border-amber-500 bg-amber-50 dark:bg-amber-900/20" : "border-gray-300 dark:border-gray-600 hover:border-amber-400"
                    }`}>
                    <input ref={fileInputRef} type="file"
                      accept=".txt,.html,.htm,.md,.markdown,.csv,.json,.xml,.pdf,.docx"
                      className="hidden"
                      onChange={e => { const f = e.target.files?.[0]; if (f) setSelectedFile(f); }} />
                    <Upload className={`w-10 h-10 mb-3 ${selectedFile ? "text-amber-500" : "text-gray-400"}`} />
                    {selectedFile ? (
                      <div className="text-center">
                        <p className="font-semibold text-amber-500 dark:text-amber-400">{selectedFile.name}</p>
                        <p className="text-xs text-gray-400 mt-1">{(selectedFile.size / 1024).toFixed(1)} KB</p>
                        <button type="button" onClick={e => { e.stopPropagation(); setSelectedFile(null); }}
                          className="mt-2 text-xs text-red-500 hover:underline flex items-center gap-1 mx-auto">
                          <RotateCcw className="w-3 h-3" /> Remove
                        </button>
                      </div>
                    ) : (
                      <>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Drop a file here or click to browse</p>
                        <p className="text-xs text-gray-400 mt-1">TXT, HTML, MD, JSON, CSV, PDF, DOCX — max 5 MB</p>
                      </>
                    )}
                  </div>
                )}

                {/* URL input */}
                {mode === "url" && (
                  <div className="relative">
                    <Link className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input type="text" value={urlInput} onChange={e => setUrlInput(e.target.value)}
                      placeholder="https://example.com/page-to-scan"
                      disabled={scanning}
                      className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-400 disabled:opacity-60" />
                  </div>
                )}

                {/* Advanced options */}
                <div>
                  <button type="button" onClick={() => setShowOptions(o => !o)}
                    className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-amber-500 transition">
                    {showOptions ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    Advanced options
                  </button>
                  <AnimatePresence>
                    {showOptions && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.15 }} className="overflow-hidden">
                        <div className="mt-3 flex flex-col sm:flex-row gap-4">
                          <label className="flex items-start gap-3 cursor-pointer select-none">
                            <input type="checkbox" checked={runSemantic} onChange={e => setRunSemantic(e.target.checked)}
                              className="mt-0.5 w-4 h-4 accent-indigo-600" />
                            <div>
                              <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 flex items-center gap-1">
                                <Cpu className="w-4 h-4 text-amber-500" /> Semantic Analysis
                              </p>
                              <p className="text-xs text-gray-400 mt-0.5">AI-powered second opinion (uses Claude — slightly slower)</p>
                            </div>
                          </label>
                          <label className="flex items-start gap-3 cursor-pointer select-none">
                            <input type="checkbox" checked={runAgenticSim} onChange={e => setRunAgenticSim(e.target.checked)}
                              className="mt-0.5 w-4 h-4 accent-indigo-600" />
                            <div>
                              <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 flex items-center gap-1">
                                <Zap className="w-4 h-4 text-orange-500" /> Agentic Simulation
                              </p>
                              <p className="text-xs text-gray-400 mt-0.5">Replay the payload against a sandboxed agent — proves if it would comply</p>
                            </div>
                          </label>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                <button type="submit" disabled={scanning}
                  className="flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-slate-900 font-semibold px-6 py-3 rounded-xl shadow-md disabled:opacity-50 transition hover:scale-105 active:scale-95 w-full sm:w-auto justify-center">
                  {scanning ? <Loader2 className="w-5 h-5 animate-spin" /> : <Zap className="w-5 h-5" />}
                  {scanning ? "Scanning…" : "Run Injection Scan"}
                </button>
              </form>
            </motion.div>

            {/* Error */}
            <AnimatePresence>
              {error && (
                <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                  className="mb-6 p-4 rounded-xl bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 text-red-700 dark:text-red-300 flex items-center gap-2">
                  <XCircle className="w-5 h-5 flex-shrink-0" />{error}
                </motion.div>
              )}
            </AnimatePresence>

            {/* ── Results ──────────────────────────────────────────────────── */}
            <AnimatePresence>
              {result && !scanning && (
                <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-6">

                  {/* Risk header */}
                  <div className={`rounded-2xl border-2 p-6 flex flex-col md:flex-row items-center gap-5 ${riskBg[result.riskLevel]}`}>
                    <div className="flex-shrink-0 text-center">
                      {result.riskLevel === "clean"
                        ? <ShieldCheck className={`w-16 h-16 ${riskColors.clean}`} />
                        : <ShieldAlert  className={`w-16 h-16 ${riskColors[result.riskLevel]}`} />}
                      <div className={`text-lg font-black mt-1 ${riskColors[result.riskLevel]}`}>
                        {RISK_LABEL[result.riskLevel]}
                      </div>
                      <div className="text-2xl font-bold text-gray-700 dark:text-gray-300">{result.score} / 100</div>
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
                        {result.inputType === "file" && <span>File: <span className="font-mono">{result.fileName}</span></span>}
                        {result.inputType === "url"  && <span>URL: <span className="font-mono break-all">{result.url}</span></span>}
                        {result.inputType === "text" && <span>Text input ({result.displayText.length.toLocaleString()} chars scanned)</span>}
                        <span className="ml-2 text-xs">· {new Date(result.timestamp).toLocaleString()}</span>
                      </p>

                      <div className="flex flex-wrap gap-2">
                        {(["critical","high","medium","low"] as Severity[]).map(s => {
                          const n = result.findings.filter(f => f.severity === s).length;
                          return n > 0 ? (
                            <span key={s} className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-semibold ${severityBadge[s]}`}>
                              {severityIcon(s)}{n} {s}
                            </span>
                          ) : null;
                        })}
                        {result.findings.length === 0 && (
                          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-semibold bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300">
                            <CheckCircle className="w-4 h-4" /> No patterns detected
                          </span>
                        )}
                        {result.mlResult && (
                          <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-semibold ${
                            result.mlResult.isInjection
                              ? "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300"
                              : "bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200"
                          }`}>
                            <Cpu className="w-4 h-4" />
                            {result.mlResult.isInjection ? "ML flagged" : "ML clean"}
                          </span>
                        )}
                        {result.agenticSim && !result.agenticSim.skipped && !result.agenticSim.error && (
                          <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-semibold ${
                            result.agenticSim.complied
                              ? "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300"
                              : "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300"
                          }`}>
                            <Zap className="w-4 h-4" />{result.agenticSim.complied ? "Agent Compromised" : "Agent Resistant"}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-3 flex-shrink-0">
                      <button
                        onClick={() => downloadInjectionReport(result)}
                        className="flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800 text-white font-semibold px-5 py-2.5 rounded-xl shadow transition hover:scale-105"
                      >
                        <FileDown className="w-4 h-4" />
                        Export PDF
                      </button>
                      <button onClick={() => navigate("/ask")}
                        className="flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-400 text-slate-900 font-semibold px-5 py-2.5 rounded-xl shadow transition hover:scale-105">
                        <MessageCircle className="w-4 h-4" /> Ask Nick
                      </button>
                    </div>
                  </div>

                  {/* Annotated text view */}
                  <SectionCard title="Annotated Content View" icon={<Eye className="w-5 h-5" />}>
                    <div className="pt-4">
                      <div className="flex items-center gap-3 mb-3">
                        <p className="text-xs text-gray-400 flex-1">
                          Highlights show detected injection patterns.
                          {result.truncated && " Content was truncated to 10 000 chars for display."}
                        </p>
                        <button onClick={() => setShowRaw(r => !r)}
                          className="flex items-center gap-1 text-xs text-gray-500 hover:text-amber-500 transition">
                          {showRaw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          {showRaw ? "Show annotated" : "Show raw"}
                        </button>
                      </div>

                      <div className="bg-gray-50 dark:bg-gray-900 rounded-xl p-4 max-h-80 overflow-y-auto border border-gray-200 dark:border-gray-700">
                        {showRaw
                          ? <pre className="text-sm font-mono whitespace-pre-wrap break-words text-gray-700 dark:text-gray-300">{result.displayText}</pre>
                          : <AnnotatedText text={result.displayText} annotations={result.annotations} truncated={result.truncated} />}
                      </div>

                      {/* Colour legend */}
                      <div className="flex flex-wrap gap-2 mt-3">
                        {(["critical","high","medium","low"] as Severity[]).map(s => (
                          <span key={s} className={`text-xs px-2 py-0.5 rounded ${severityHighlight[s]}`}>{s}</span>
                        ))}
                      </div>
                    </div>
                  </SectionCard>

                  {/* Findings */}
                  {result.findings.length > 0 && (
                    <SectionCard title={`Findings (${result.findings.length})`} icon={<ShieldAlert className="w-5 h-5" />}>
                      <div className="pt-4 space-y-4">
                        {result.findings.map((f, i) => (
                          <div key={i} className="border border-gray-100 dark:border-gray-700 rounded-xl p-4">
                            <div className="flex items-start gap-2 mb-2">
                              {severityIcon(f.severity)}
                              <div className="flex-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${severityBadge[f.severity]}`}>
                                    {f.severity.toUpperCase()}
                                  </span>
                                  <span className="text-xs text-gray-500 dark:text-gray-400 font-semibold">{f.category}</span>
                                </div>
                                <p className="text-sm text-gray-800 dark:text-gray-200 mt-1">{f.description}</p>
                                <p className="text-xs font-mono bg-gray-100 dark:bg-gray-700 rounded px-2 py-1 mt-1 break-all text-gray-600 dark:text-gray-300">
                                  "{f.matchedText}"
                                </p>
                              </div>
                            </div>
                            {f.remediation && (
                              <div className="mt-2 pl-6 text-xs text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/20 rounded-lg px-3 py-2">
                                <span className="font-semibold">Fix: </span>{f.remediation}
                              </div>
                            )}
                            {f.codefix && (
                              <div className="mt-3 pl-6">
                                <div className="flex items-center justify-between mb-1">
                                  <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                                    Code Fix
                                  </span>
                                  <button
                                    onClick={() => {
                                      navigator.clipboard.writeText(f.codefix!);
                                      setCopiedIdx(i);
                                      setTimeout(() => setCopiedIdx(null), 2000);
                                    }}
                                    className={`flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg font-semibold transition ${
                                      copiedIdx === i
                                        ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300"
                                        : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-amber-100 dark:hover:bg-amber-900/30 hover:text-amber-700 dark:hover:text-amber-300"
                                    }`}
                                  >
                                    {copiedIdx === i
                                      ? <><CheckCheck className="w-3.5 h-3.5" /> Copied!</>
                                      : <><Copy className="w-3.5 h-3.5" /> Copy Fix</>}
                                  </button>
                                </div>
                                <pre className="text-xs font-mono bg-gray-900 dark:bg-gray-950 text-green-300 rounded-xl px-4 py-3 overflow-x-auto whitespace-pre leading-relaxed border border-gray-700">
                                  {f.codefix}
                                </pre>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </SectionCard>
                  )}

                  {/* ML Analysis */}
                  {result.mlResult && (
                    <SectionCard title="ML Detection Layer" icon={<Cpu className="w-5 h-5" />}>
                      <div className="pt-4">
                        <div className="flex flex-col md:flex-row gap-4">
                          <div className="flex-shrink-0 text-center">
                            <div className={`text-4xl font-black ${
                              result.mlResult.isInjection ? "text-purple-600 dark:text-purple-400" : "text-green-500"
                            }`}>
                              {result.mlResult.isInjection ? "FLAGGED" : "CLEAN"}
                            </div>
                            <div className="text-sm text-gray-500 mt-1">
                              {Math.round((result.mlResult.topScore ?? 0) * 100)}% top-label confidence
                            </div>
                            <div className="text-xs text-gray-400 mt-1">
                              Score contribution: +{result.mlResult.mlScore}/25
                            </div>
                          </div>

                          <div className="flex-1 space-y-3">
                            <div>
                              <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                                Top label: <span className="text-purple-600 dark:text-purple-400">{result.mlResult.topLabel}</span>
                              </p>
                              {result.mlResult.attackCategory && (
                                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                                  Attack category: <span className="font-semibold">{result.mlResult.attackCategory}</span>
                                </p>
                              )}
                              {result.mlResult.novelDetection && (
                                <p className="text-xs text-amber-600 dark:text-amber-300 mt-2">
                                  ML flagged a likely novel injection pattern that regex did not confidently match.
                                </p>
                              )}
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              {Object.entries(result.mlResult.scores).map(([label, score]) => (
                                <div key={label} className="rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-2 bg-gray-50 dark:bg-gray-900">
                                  <div className="flex items-center justify-between gap-3 text-xs">
                                    <span className="text-gray-600 dark:text-gray-300">{label}</span>
                                    <span className="font-bold text-gray-800 dark:text-gray-100">
                                      {Math.round(score * 100)}%
                                    </span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    </SectionCard>
                  )}

                  {/* Semantic Analysis */}
                  {result.semantic && !result.semantic.skipped && (
                    <SectionCard title="Semantic Analysis (AI)" icon={<Cpu className="w-5 h-5" />}>
                      <div className="pt-4">
                        {result.semantic.error ? (
                          <p className="text-yellow-600 dark:text-yellow-400 text-sm">{result.semantic.error}</p>
                        ) : (
                          <div className="flex flex-col md:flex-row gap-4">
                            <div className="flex-shrink-0 text-center">
                              <div className={`text-4xl font-black ${result.semantic.isInjection ? "text-red-500" : "text-green-500"}`}>
                                {result.semantic.isInjection ? "INJECTION" : "CLEAN"}
                              </div>
                              <div className="text-sm text-gray-500 mt-1">
                                {Math.round((result.semantic.confidence ?? 0) * 100)}% confidence
                              </div>
                            </div>
                            <div className="flex-1">
                              {result.semantic.attackType && (
                                <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-1">
                                  Attack type: <span className="text-orange-600 dark:text-orange-400">{result.semantic.attackType}</span>
                                </p>
                              )}
                              <p className="text-sm text-gray-600 dark:text-gray-400">{result.semantic.reason}</p>
                            </div>
                          </div>
                        )}
                      </div>
                    </SectionCard>
                  )}

                  {/* Agentic Simulation */}
                  {result.agenticSim && !result.agenticSim.skipped && (
                    <SectionCard title="Agentic Failure Simulation" icon={<Zap className="w-5 h-5" />}>
                      <div className="pt-4">
                        {result.agenticSim.error ? (
                          <p className="text-yellow-600 dark:text-yellow-400 text-sm">{result.agenticSim.error}</p>
                        ) : (
                          <>
                            <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-lg mb-4 ${
                              result.agenticSim.complied
                                ? "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300"
                                : "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300"
                            }`}>
                              {result.agenticSim.complied
                                ? <><XCircle className="w-6 h-6" /> AGENT COMPROMISED</>
                                : <><ShieldCheck className="w-6 h-6" /> AGENT RESISTANT</>}
                            </div>

                            {result.agenticSim.toolsInvoked.length > 0 && (
                              <div className="mb-3">
                                <p className="text-sm font-semibold text-red-600 dark:text-red-400 mb-2">Tools the agent invoked:</p>
                                <div className="space-y-1">
                                  {result.agenticSim.toolsInvoked.map((t, i) => (
                                    <div key={i} className="flex items-start gap-2 bg-red-50 dark:bg-red-900/20 rounded-lg px-3 py-2">
                                      <span className="text-xs font-mono font-bold text-red-600 dark:text-red-400">{t.name}</span>
                                      <span className="text-xs text-gray-500 dark:text-gray-400 break-all">
                                        {JSON.stringify(t.input).substring(0, 150)}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {result.agenticSim.agentResponse && (
                              <div>
                                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">Agent's response:</p>
                                <p className="text-sm text-gray-600 dark:text-gray-300 italic bg-gray-50 dark:bg-gray-700 rounded-lg px-3 py-2">
                                  "{result.agenticSim.agentResponse}"
                                </p>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    </SectionCard>
                  )}

                  {/* Ask Nick CTA */}
                  <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-2xl p-5 flex flex-col md:flex-row items-center gap-4">
                    <div className="flex-1">
                      <p className="font-semibold text-amber-800 dark:text-amber-200">Want plain-English fixes?</p>
                      <p className="text-sm text-amber-600 dark:text-amber-400 mt-1">
                        Ask Nick — Seekurify's AI assistant — for step-by-step remediation advice based on these findings.
                      </p>
                    </div>
                    <button onClick={() => navigate("/ask")}
                      className="flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-slate-900 font-semibold px-5 py-2.5 rounded-xl shadow transition hover:scale-105 flex-shrink-0">
                      <MessageCircle className="w-4 h-4" /> Ask Nick
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* ── Scan History ─────────────────────────────────────────────── */}
            {(history.length > 0 || historyLoading) && (
              <div className="mt-12">
                <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100 mb-4 flex items-center gap-2">
                  <Server className="w-5 h-5 text-amber-500" /> Scan History
                </h2>

                {historyLoading && history.length === 0 ? (
                  <div className="flex items-center gap-2 text-gray-400 text-sm py-4">
                    <Loader2 className="w-4 h-4 animate-spin" /> Loading…
                  </div>
                ) : (
                  <div className="space-y-3">
                    {history.map((log: any) => {
                      const id = log._id ?? log.createdAt;
                      const isExp = expandedId === id;
                      const critN = (log.findings ?? []).filter((f: any) => f.severity === "critical").length;
                      const highN  = (log.findings ?? []).filter((f: any) => f.severity === "high").length;
                      const rl = log.riskLevel as RiskLevel;

                      return (
                        <div key={id} className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
                          <button onClick={() => setExpandedId(isExp ? null : id)}
                            className="w-full flex items-center gap-4 px-5 py-4 text-left hover:bg-gray-50 dark:hover:bg-gray-700/40 transition">

                            {/* Input type icon */}
                            <span className="flex-shrink-0 text-gray-400">
                              {log.inputType === "file" ? <Upload className="w-4 h-4" /> :
                               log.inputType === "url"  ? <Link   className="w-4 h-4" /> :
                               <Type className="w-4 h-4" />}
                            </span>

                            {/* Score bar */}
                            <div className="flex-shrink-0 w-14 text-center">
                              <div className={`text-lg font-black leading-none ${riskColors[rl]}`}>{log.score}</div>
                              <div className="h-1 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden mt-1">
                                <div className={`h-full rounded-full ${
                                  log.score >= 76 ? "bg-red-500" : log.score >= 51 ? "bg-orange-500" :
                                  log.score >= 21 ? "bg-yellow-500" : log.score > 0 ? "bg-blue-500" : "bg-green-500"
                                }`} style={{ width: `${Math.max(log.score, 4)}%` }} />
                              </div>
                            </div>

                            {/* Summary */}
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-gray-800 dark:text-gray-100 truncate">
                                {log.inputType === "file" ? log.fileName :
                                 log.inputType === "url"  ? log.url :
                                 (log.inputSummary ?? "").substring(0, 80) + "…"}
                              </p>
                              <p className="text-xs text-gray-400">{new Date(log.createdAt).toLocaleString()}</p>
                            </div>

                            {/* Chips */}
                            <div className="flex items-center gap-2 flex-shrink-0">
                              {critN > 0 && (
                                <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${severityBadge.critical}`}>
                                  {critN} crit
                                </span>
                              )}
                              {highN > 0 && (
                                <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${severityBadge.high}`}>
                                  {highN} high
                                </span>
                              )}
                              {rl === "clean" && (
                                <span className="text-xs px-2 py-0.5 rounded-full font-semibold bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300">
                                  Clean
                                </span>
                              )}
                              {log.agenticSim?.complied && (
                                <span className="text-xs px-2 py-0.5 rounded-full font-semibold bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300">
                                  Compromised
                                </span>
                              )}
                            </div>
                            {isExp ? <ChevronUp className="w-4 h-4 text-gray-400 flex-shrink-0" />
                                   : <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />}
                          </button>

                          <AnimatePresence initial={false}>
                            {isExp && (
                              <motion.div key="hist" initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
                                <div className="px-5 pb-5 pt-4 border-t border-gray-100 dark:border-gray-700 space-y-2">
                                  {(log.findings ?? []).length === 0 ? (
                                    <p className="text-sm text-green-600 dark:text-green-400 flex items-center gap-1">
                                      <CheckCircle className="w-4 h-4" /> No injection patterns detected.
                                    </p>
                                  ) : (
                                    (log.findings as any[]).map((f: any, i: number) => (
                                      <div key={i} className="flex items-start gap-2 text-sm">
                                        {severityIcon(f.severity)}
                                        <span className={`text-xs font-semibold px-1.5 py-0.5 rounded flex-shrink-0 ${severityBadge[f.severity as Severity]}`}>
                                          {f.category}
                                        </span>
                                        <span className="text-gray-700 dark:text-gray-300">{f.description}</span>
                                      </div>
                                    ))
                                  )}
                                  {log.semantic && !log.semantic.skipped && !log.semantic.error && (
                                    <p className={`text-xs mt-2 font-semibold ${log.semantic.isInjection ? "text-red-500" : "text-green-500"}`}>
                                      AI: {log.semantic.isInjection ? `Injection confirmed (${Math.round((log.semantic.confidence ?? 0) * 100)}%)` : "No injection detected"} — {log.semantic.reason}
                                    </p>
                                  )}
                                  {log.agenticSim && !log.agenticSim.skipped && !log.agenticSim.error && (
                                    <p className={`text-xs font-semibold ${log.agenticSim.complied ? "text-red-500" : "text-green-500"}`}>
                                      Agentic sim: {log.agenticSim.complied
                                        ? `Agent complied (${log.agenticSim.toolsInvoked.map((t: any) => t.name).join(", ")})`
                                        : "Agent resisted"}
                                    </p>
                                  )}
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

          </div>{/* content wrapper */}
        </main>
      </div>{/* flex row */}

      <Footer />
    </div>
  );
};

export default PromptInjectionScanner;
