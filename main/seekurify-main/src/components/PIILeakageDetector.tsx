import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Shield, ShieldAlert, AlertTriangle, CheckCircle,
  XCircle, Info, Loader2, ChevronDown, ChevronUp,
  Eye, EyeOff, ScanSearch, Clock, BarChart2, Trash2,
} from "lucide-react";
import { API_BASE_URL } from "../services/api";
import Header from "./ui/Header";
import Footer from "./ui/Footer";
import { useNavigate } from "react-router-dom";
import AppSidebar from "./ui/AppSidebar";

// ─── Types ────────────────────────────────────────────────────────────────────

type RiskLevel = "safe" | "low" | "medium" | "high" | "critical";
type Severity  = "critical" | "high" | "medium" | "low";
type Category  = "Personal" | "Financial" | "Credential" | "Network";

interface Finding {
  id:          string;
  label:       string;
  category:    Category;
  severity:    Severity;
  description: string;
  count:       number;
  examples:    string[];
}

interface ScanResult {
  score:             number;
  riskLevel:         RiskLevel;
  findings:          Finding[];
  categoryBreakdown: Record<string, number>;
  scannedLength:     number;
}

interface HistoryEntry {
  _id:          string;
  label:        string;
  score:        number;
  riskLevel:    RiskLevel;
  findingCount: number;
  summary:      string;
  createdAt:    string;
}

// ─── Style maps ───────────────────────────────────────────────────────────────

const riskColor: Record<RiskLevel, string> = {
  safe:     "text-green-600",
  low:      "text-blue-600",
  medium:   "text-yellow-600",
  high:     "text-orange-600",
  critical: "text-red-600",
};

const riskBg: Record<RiskLevel, string> = {
  safe:     "bg-green-50 border-green-300",
  low:      "bg-blue-50 border-blue-300",
  medium:   "bg-yellow-50 border-yellow-300",
  high:     "bg-orange-50 border-orange-300",
  critical: "bg-red-50 border-red-300",
};

const riskBar: Record<RiskLevel, string> = {
  safe:     "bg-green-500",
  low:      "bg-blue-500",
  medium:   "bg-yellow-500",
  high:     "bg-orange-500",
  critical: "bg-red-600",
};

const sevBadge: Record<Severity, string> = {
  critical: "bg-red-100 text-red-700",
  high:     "bg-orange-100 text-orange-700",
  medium:   "bg-yellow-100 text-yellow-700",
  low:      "bg-blue-100 text-blue-700",
};

const catColor: Record<string, string> = {
  Personal:   "bg-purple-100 text-purple-700",
  Financial:  "bg-rose-100 text-rose-700",
  Credential: "bg-red-100 text-red-700",
  Network:    "bg-cyan-100 text-cyan-700",
};

const authToken = () => localStorage.getItem("token") || "";

// ─── Risk Gauge ───────────────────────────────────────────────────────────────

const RiskGauge: React.FC<{ score: number; riskLevel: RiskLevel }> = ({ score, riskLevel }) => (
  <div className="flex flex-col items-center gap-2">
    <div className="relative w-36 h-36">
      <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
        <circle cx="50" cy="50" r="42" fill="none" stroke="#e5e7eb" strokeWidth="12" />
        <circle
          cx="50" cy="50" r="42" fill="none"
          strokeWidth="12"
          strokeLinecap="round"
          strokeDasharray={`${(score / 100) * 263.9} 263.9`}
          className={`transition-all duration-700 ${
            riskLevel === "safe"     ? "stroke-green-500" :
            riskLevel === "low"      ? "stroke-blue-500"  :
            riskLevel === "medium"   ? "stroke-yellow-500":
            riskLevel === "high"     ? "stroke-orange-500":
                                       "stroke-red-600"
          }`}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={`text-3xl font-extrabold ${riskColor[riskLevel]}`}>{score}</span>
        <span className="text-xs text-gray-500 font-medium">/100</span>
      </div>
    </div>
    <span className={`text-lg font-bold uppercase tracking-wide ${riskColor[riskLevel]}`}>
      {riskLevel}
    </span>
  </div>
);

// ─── Finding Card ─────────────────────────────────────────────────────────────

const FindingCard: React.FC<{ finding: Finding }> = ({ finding }) => {
  const [open, setOpen] = useState(false);
  const [showExamples, setShowExamples] = useState(false);

  return (
    <div className={`border rounded-xl overflow-hidden ${riskBg[finding.severity as RiskLevel] || "bg-gray-50 border-gray-200"}`}>
      <button
        className="w-full flex items-center gap-3 px-4 py-3 text-left"
        onClick={() => setOpen(o => !o)}
      >
        <div className="flex-1 flex items-center gap-3 flex-wrap">
          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${sevBadge[finding.severity]}`}>
            {finding.severity.toUpperCase()}
          </span>
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${catColor[finding.category] || "bg-gray-100 text-gray-600"}`}>
            {finding.category}
          </span>
          <span className="font-semibold text-gray-800 text-sm">{finding.label}</span>
          <span className="ml-auto text-xs text-gray-500">{finding.count} match{finding.count !== 1 ? "es" : ""}</span>
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-gray-500 flex-shrink-0" /> : <ChevronDown className="w-4 h-4 text-gray-500 flex-shrink-0" />}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 space-y-3 border-t border-gray-200">
              <p className="text-sm text-gray-600 mt-3">{finding.description}</p>

              {finding.examples.length > 0 && (
                <div>
                  <button
                    onClick={() => setShowExamples(e => !e)}
                    className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 font-medium"
                  >
                    {showExamples ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    {showExamples ? "Hide" : "Show"} masked examples
                  </button>

                  <AnimatePresence>
                    {showExamples && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="mt-2 flex flex-wrap gap-2">
                          {finding.examples.map((ex, i) => (
                            <code key={i} className="bg-gray-800 text-gray-100 text-xs px-2 py-1 rounded font-mono">
                              {ex}
                            </code>
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

// ─── Category Bar Chart ───────────────────────────────────────────────────────

const CategoryBreakdown: React.FC<{ data: Record<string, number> }> = ({ data }) => {
  const entries = Object.entries(data).sort((a, b) => b[1] - a[1]);
  const max = Math.max(...entries.map(e => e[1]), 1);

  return (
    <div className="space-y-2">
      {entries.map(([cat, count]) => (
        <div key={cat} className="flex items-center gap-3">
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full w-24 text-center ${catColor[cat] || "bg-gray-100 text-gray-600"}`}>
            {cat}
          </span>
          <div className="flex-1 bg-gray-100 rounded-full h-3 overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${(count / max) * 100}%` }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className={`h-full rounded-full ${catColor[cat]?.includes("purple") ? "bg-purple-500" : catColor[cat]?.includes("rose") ? "bg-rose-500" : catColor[cat]?.includes("red") ? "bg-red-500" : "bg-cyan-500"}`}
            />
          </div>
          <span className="text-xs font-bold text-gray-700 w-6 text-right">{count}</span>
        </div>
      ))}
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────

const PIILeakageDetector: React.FC = () => {
  const navigate = useNavigate();
  const [sidebarExpanded, setSidebarExpanded] = useState(true);
  const [profileImage, setProfileImage]       = useState("");
  const [activeTab, setActiveTab]             = useState<"scan" | "history">("scan");

  // Scan state
  const [text, setText]       = useState("");
  const [label, setLabel]     = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult]   = useState<ScanResult | null>(null);
  const [error, setError]     = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<string>("All");

  // History state
  const [history, setHistory]     = useState<HistoryEntry[]>([]);
  const [histLoading, setHistLoading] = useState(false);

  // Load profile image
  useEffect(() => {
    const token = authToken();
    if (!token) return;
    fetch(`${API_BASE_URL}/profile`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.profileImage) setProfileImage(d.profileImage); })
      .catch(() => {});
  }, []);

  const handleLogout = async () => {
    try {
      await fetch(`${API_BASE_URL}/auth/logout`, { method: "POST", credentials: "include" });
    } catch {}
    localStorage.removeItem("token");
    navigate("/login");
  };

  // ── Scan ──
  const handleScan = async () => {
    if (!text.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);
    setActiveCategory("All");

    try {
      const res = await fetch(`${API_BASE_URL}/pii-scan/analyze`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken()}`,
        },
        body: JSON.stringify({ text, label: label || "Unnamed scan" }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Scan failed");
      setResult(data as ScanResult);
    } catch (err: any) {
      setError(err.message || "Scan failed");
    } finally {
      setLoading(false);
    }
  };

  // ── History ──
  const loadHistory = async () => {
    setHistLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/pii-scan/history`, {
        headers: { Authorization: `Bearer ${authToken()}` },
      });
      const data = await res.json();
      setHistory(Array.isArray(data) ? data : []);
    } catch {
      setHistory([]);
    } finally {
      setHistLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === "history") loadHistory();
  }, [activeTab]);

  // ── Filtered findings ──
  const categories = result
    ? ["All", ...Array.from(new Set(result.findings.map(f => f.category)))]
    : ["All"];

  const visibleFindings = result?.findings.filter(
    f => activeCategory === "All" || f.category === activeCategory
  ) ?? [];

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-gray-50 to-blue-50">
      <title>PII Leakage Detector – Seekurify</title>
      <Header
        token={authToken()}
        handleLogout={handleLogout}
        profileImage={profileImage}
      />

      <div className="flex flex-1 overflow-hidden">
        <AppSidebar sidebarExpanded={sidebarExpanded} setSidebarExpanded={setSidebarExpanded} />

        <main className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Page header */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center">
              <ScanSearch className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-extrabold text-gray-900">PII Leakage Detector</h1>
              <p className="text-sm text-gray-500">
                Paste any AI response or document to detect personally identifiable, financial, and credential data.
              </p>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 border-b border-gray-200">
            {(["scan", "history"] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 text-sm font-semibold rounded-t-lg capitalize transition ${
                  activeTab === tab
                    ? "bg-white border border-b-white border-gray-200 text-indigo-700 -mb-px"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                {tab === "scan" ? "Scan" : "History"}
              </button>
            ))}
          </div>

          {/* ── SCAN TAB ── */}
          {activeTab === "scan" && (
            <div className="space-y-6">
              {/* Input card */}
              <div className="bg-white rounded-2xl shadow border border-gray-200 p-6 space-y-4">
                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="flex-1">
                    <label className="block text-sm font-semibold text-gray-700 mb-1">
                      Scan Label <span className="text-gray-400 font-normal">(optional)</span>
                    </label>
                    <input
                      type="text"
                      value={label}
                      onChange={e => setLabel(e.target.value)}
                      placeholder="e.g. Customer support bot response"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">
                    Text to Scan
                    <span className="ml-2 text-gray-400 font-normal text-xs">
                      ({text.length.toLocaleString()} / 50,000 chars)
                    </span>
                  </label>
                  <textarea
                    value={text}
                    onChange={e => setText(e.target.value)}
                    rows={10}
                    placeholder={`Paste an AI response, log snippet, or any text here...\n\nExamples of what gets detected:\n• Email addresses, phone numbers, SSNs\n• Credit card numbers, IBANs, bank accounts\n• API keys, AWS keys, GitHub tokens, JWTs\n• Database connection strings with credentials\n• Private IP addresses, internal URLs`}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none"
                  />
                </div>

                <div className="flex items-center justify-between gap-3">
                  <button
                    onClick={() => { setText(""); setResult(null); setError(null); setLabel(""); }}
                    className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition"
                  >
                    <Trash2 className="w-4 h-4" /> Clear
                  </button>

                  <button
                    onClick={handleScan}
                    disabled={loading || !text.trim()}
                    className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-6 py-2.5 rounded-xl font-semibold text-sm shadow transition"
                  >
                    {loading
                      ? <><Loader2 className="w-4 h-4 animate-spin" /> Scanning…</>
                      : <><ScanSearch className="w-4 h-4" /> Run PII Scan</>}
                  </button>
                </div>
              </div>

              {/* Error */}
              {error && (
                <div className="bg-red-50 border border-red-300 rounded-xl p-4 flex items-center gap-3 text-red-700">
                  <XCircle className="w-5 h-5 flex-shrink-0" />
                  <span className="text-sm font-medium">{error}</span>
                </div>
              )}

              {/* Results */}
              <AnimatePresence>
                {result && (
                  <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 12 }}
                    className="space-y-6"
                  >
                    {/* Score + breakdown row */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                      {/* Gauge card */}
                      <div className={`bg-white rounded-2xl shadow border p-6 flex flex-col items-center gap-4 ${riskBg[result.riskLevel]}`}>
                        <RiskGauge score={result.score} riskLevel={result.riskLevel} />
                        <div className="text-center text-sm text-gray-500">
                          <p>
                            <span className="font-semibold text-gray-700">{result.findings.length}</span> PII type{result.findings.length !== 1 ? "s" : ""} detected
                          </p>
                          <p>in {result.scannedLength.toLocaleString()} characters</p>
                        </div>
                      </div>

                      {/* Category breakdown */}
                      <div className="bg-white rounded-2xl shadow border border-gray-200 p-6">
                        <div className="flex items-center gap-2 mb-4">
                          <BarChart2 className="w-5 h-5 text-indigo-500" />
                          <h3 className="font-semibold text-gray-800">Category Breakdown</h3>
                        </div>
                        {Object.keys(result.categoryBreakdown).length > 0 ? (
                          <CategoryBreakdown data={result.categoryBreakdown} />
                        ) : (
                          <div className="flex flex-col items-center justify-center h-24 text-gray-400">
                            <CheckCircle className="w-8 h-8 mb-2 text-green-400" />
                            <span className="text-sm">No PII detected</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Findings list */}
                    {result.findings.length > 0 && (
                      <div className="bg-white rounded-2xl shadow border border-gray-200 p-6 space-y-4">
                        <div className="flex items-center justify-between flex-wrap gap-3">
                          <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                            <ShieldAlert className="w-5 h-5 text-red-500" />
                            Detected PII Types
                          </h3>
                          {/* Category filter pills */}
                          <div className="flex flex-wrap gap-2">
                            {categories.map(cat => (
                              <button
                                key={cat}
                                onClick={() => setActiveCategory(cat)}
                                className={`text-xs font-semibold px-3 py-1 rounded-full transition border ${
                                  activeCategory === cat
                                    ? "bg-indigo-600 text-white border-indigo-600"
                                    : "bg-white text-gray-600 border-gray-300 hover:border-indigo-400"
                                }`}
                              >
                                {cat}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="space-y-3">
                          {visibleFindings.map(f => (
                            <FindingCard key={f.id} finding={f} />
                          ))}
                        </div>
                      </div>
                    )}

                    {result.findings.length === 0 && (
                      <div className="bg-green-50 border border-green-300 rounded-2xl p-8 flex flex-col items-center gap-3 text-green-700">
                        <CheckCircle className="w-10 h-10" />
                        <p className="font-semibold text-lg">No PII Detected</p>
                        <p className="text-sm text-green-600 text-center">
                          The scanned text did not match any known PII patterns across {PII_CATEGORIES.length} categories.
                        </p>
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          {/* ── HISTORY TAB ── */}
          {activeTab === "history" && (
            <div className="bg-white rounded-2xl shadow border border-gray-200 p-6">
              <div className="flex items-center gap-2 mb-5">
                <Clock className="w-5 h-5 text-indigo-500" />
                <h3 className="font-semibold text-gray-800">Scan History</h3>
                <button
                  onClick={loadHistory}
                  className="ml-auto text-xs text-indigo-600 hover:underline"
                >
                  Refresh
                </button>
              </div>

              {histLoading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="w-6 h-6 text-indigo-500 animate-spin" />
                </div>
              ) : history.length === 0 ? (
                <div className="text-center py-12 text-gray-400">
                  <ScanSearch className="w-10 h-10 mx-auto mb-3 opacity-40" />
                  <p>No scans yet. Run your first PII scan above.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {history.map(entry => (
                    <div
                      key={entry._id}
                      className={`flex items-center gap-4 border rounded-xl px-4 py-3 ${riskBg[entry.riskLevel]}`}
                    >
                      <div className={`text-2xl font-extrabold ${riskColor[entry.riskLevel]} w-12 text-center`}>
                        {entry.score}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-gray-800 text-sm truncate">{entry.label}</span>
                          <span className={`text-xs font-bold uppercase px-2 py-0.5 rounded-full border ${
                            entry.riskLevel === "safe"   ? "bg-green-100 text-green-700 border-green-300" :
                            entry.riskLevel === "low"    ? "bg-blue-100 text-blue-700 border-blue-300"    :
                            entry.riskLevel === "medium" ? "bg-yellow-100 text-yellow-700 border-yellow-300":
                            entry.riskLevel === "high"   ? "bg-orange-100 text-orange-700 border-orange-300":
                                                           "bg-red-100 text-red-700 border-red-300"
                          }`}>
                            {entry.riskLevel}
                          </span>
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
        </main>
      </div>

      <Footer />
    </div>
  );
};

// Used only in the empty-state message
const PII_CATEGORIES = ["Personal", "Financial", "Credential", "Network"];

export default PIILeakageDetector;
