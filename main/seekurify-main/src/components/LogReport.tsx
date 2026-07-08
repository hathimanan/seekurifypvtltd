import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  FileText, Filter, Download, RefreshCw, ChevronDown, ChevronUp,
  ShieldAlert, Shield, Wifi, Eye, Search, AlertTriangle,
  LogIn, Activity, XCircle, Info, CheckCircle, Loader2,
  FileCode, Calendar, BarChart2,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import jsPDF from "jspdf";
import AppSidebar from "./ui/AppSidebar";
import Header from "./ui/Header";
import Footer from "./ui/Footer";
import { API_BASE_URL } from "../services/api";

// ─── Types ────────────────────────────────────────────────────────────────────

type LogType     = "all" | "finding" | "incident" | "firewall" | "watch" | "scan" | "login" | "event";
type Severity    = "all" | "critical" | "high" | "medium" | "low" | "info";

interface LogEntry {
  id:        string;
  type:      string;
  timestamp: string;
  severity:  string;
  title:     string;
  summary:   string;
  meta:      Record<string, any>;
}

interface Stats {
  findings:       number;
  incidents:      number;
  firewallBlocks: number;
  watchAlerts:    number;
  scans:          number;
  failedLogins:   number;
  criticalFindings: number;
  openIncidents:  number;
}

// ─── Style maps ───────────────────────────────────────────────────────────────

const sevColor: Record<string, string> = {
  critical: "text-red-500",
  high:     "text-orange-500",
  medium:   "text-yellow-500",
  low:      "text-blue-400",
  info:     "text-gray-400",
};

const sevBadge: Record<string, string> = {
  critical: "bg-red-900/40 text-red-300 border border-red-700",
  high:     "bg-orange-900/40 text-orange-300 border border-orange-700",
  medium:   "bg-yellow-900/40 text-yellow-300 border border-yellow-700",
  low:      "bg-blue-900/40 text-blue-300 border border-blue-700",
  info:     "bg-gray-700/60 text-gray-300 border border-gray-600",
};

const typeLabel: Record<string, string> = {
  finding:  "Finding",
  incident: "Incident",
  firewall: "Firewall",
  watch:    "Watch",
  scan:     "Scan",
  login:    "Login",
  event:    "Event",
};

const typeIcon: Record<string, React.ReactNode> = {
  finding:  <ShieldAlert className="w-3.5 h-3.5" />,
  incident: <AlertTriangle className="w-3.5 h-3.5" />,
  firewall: <Shield className="w-3.5 h-3.5" />,
  watch:    <Eye className="w-3.5 h-3.5" />,
  scan:     <FileCode className="w-3.5 h-3.5" />,
  login:    <LogIn className="w-3.5 h-3.5" />,
  event:    <Activity className="w-3.5 h-3.5" />,
};

const typeBadge: Record<string, string> = {
  finding:  "bg-red-900/30 text-red-300",
  incident: "bg-orange-900/30 text-orange-300",
  firewall: "bg-teal-900/30 text-teal-300",
  watch:    "bg-purple-900/30 text-purple-300",
  scan:     "bg-cyan-900/30 text-cyan-300",
  login:    "bg-indigo-900/30 text-indigo-300",
  event:    "bg-gray-700/60 text-gray-300",
};

const sevIcon = (s: string) => {
  if (s === "critical") return <XCircle className="w-4 h-4 text-red-500" />;
  if (s === "high")     return <AlertTriangle className="w-4 h-4 text-orange-500" />;
  if (s === "medium")   return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
  if (s === "low")      return <Info className="w-4 h-4 text-blue-400" />;
  return <CheckCircle className="w-4 h-4 text-gray-400" />;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const token = () => localStorage.getItem("token") || "";

function fmtDate(ts: string) {
  return new Date(ts).toLocaleString(undefined, {
    year: "numeric", month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function fmtDateShort(ts: string) {
  return new Date(ts).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

// ─── PDF Export ───────────────────────────────────────────────────────────────

function exportPDF(entries: LogEntry[], filters: { type: string; severity: string; dateFrom: string; dateTo: string }) {
  const doc   = new jsPDF();
  const total = entries.length;

  doc.setFontSize(18);
  doc.setTextColor(79, 70, 229);
  doc.text("Seekurify — Security Log Report", 14, 18);

  doc.setFontSize(9);
  doc.setTextColor(120);
  doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 25);
  doc.text(`Filters: Type=${filters.type}  Severity=${filters.severity}  Date=${filters.dateFrom || "any"} → ${filters.dateTo || "any"}`, 14, 30);
  doc.text(`Total entries: ${total}`, 14, 35);
  doc.line(14, 38, 196, 38);

  // Summary table
  const typeCounts: Record<string, number> = {};
  const sevCounts: Record<string, number>  = {};
  entries.forEach(e => {
    typeCounts[e.type] = (typeCounts[e.type] || 0) + 1;
    sevCounts[e.severity] = (sevCounts[e.severity] || 0) + 1;
  });

  doc.setFontSize(11); doc.setTextColor(40);
  doc.text("Summary by Type", 14, 46);
  doc.setFontSize(9);  doc.setTextColor(80);
  let x = 14, y = 53;
  Object.entries(typeCounts).forEach(([k, v]) => {
    doc.text(`${typeLabel[k] || k}: ${v}`, x, y);
    x += 40; if (x > 170) { x = 14; y += 5; }
  });
  y += 8;
  doc.setFontSize(11); doc.setTextColor(40);
  doc.text("Summary by Severity", 14, y); y += 7;
  doc.setFontSize(9);  doc.setTextColor(80);
  x = 14;
  ["critical", "high", "medium", "low", "info"].forEach(s => {
    if (sevCounts[s]) { doc.text(`${s}: ${sevCounts[s]}`, x, y); x += 35; }
  });
  y += 10;
  doc.line(14, y, 196, y); y += 6;

  // Log entries
  doc.setFontSize(10); doc.setTextColor(40);
  doc.text("Log Entries", 14, y); y += 6;

  for (const e of entries) {
    if (y > 268) { doc.addPage(); y = 16; }
    const sevCol: [number, number, number] =
      e.severity === "critical" ? [220, 50, 50] :
      e.severity === "high"     ? [230, 100, 30] :
      e.severity === "medium"   ? [200, 160, 0]  :
      e.severity === "low"      ? [50, 120, 200]  : [120, 120, 120];

    doc.setFontSize(8);
    doc.setTextColor(...sevCol);
    doc.text(`[${e.severity.toUpperCase()}]`, 14, y);
    doc.setTextColor(60);
    doc.text(`[${typeLabel[e.type] || e.type}]`, 36, y);
    doc.setTextColor(100);
    doc.text(fmtDate(e.timestamp), 62, y);
    y += 4.5;

    doc.setFontSize(9); doc.setTextColor(30);
    const titleLines = doc.splitTextToSize(e.title, 178);
    doc.text(titleLines, 14, y);
    y += titleLines.length * 4;

    if (e.summary) {
      doc.setFontSize(8); doc.setTextColor(100);
      const sumLines = doc.splitTextToSize(e.summary, 175);
      doc.text(sumLines, 16, y);
      y += sumLines.length * 3.8;
    }
    y += 2;
  }

  doc.save(`seekurify-log-report-${Date.now()}.pdf`);
}

// ─── CSV Export ───────────────────────────────────────────────────────────────

function exportCSV(entries: LogEntry[]) {
  const header = ["timestamp", "type", "severity", "title", "summary"].join(",");
  const rows = entries.map(e =>
    [
      new Date(e.timestamp).toISOString(),
      e.type, e.severity,
      `"${e.title.replace(/"/g, '""')}"`,
      `"${e.summary.replace(/"/g, '""')}"`,
    ].join(",")
  );
  const csv  = [header, ...rows].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href = url; a.download = `seekurify-logs-${Date.now()}.csv`;
  a.click(); URL.revokeObjectURL(url);
}

// ─── Stat Card ────────────────────────────────────────────────────────────────

const StatCard: React.FC<{ label: string; value: number; icon: React.ReactNode; color: string }> = ({ label, value, icon, color }) => (
  <div className="bg-gray-800 border border-gray-700 rounded-xl p-4 flex items-center gap-3">
    <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${color}`}>
      {icon}
    </div>
    <div>
      <p className="text-2xl font-bold text-white">{value.toLocaleString()}</p>
      <p className="text-xs text-gray-400">{label}</p>
    </div>
  </div>
);

// ─── Log Row ──────────────────────────────────────────────────────────────────

const LogRow: React.FC<{ entry: LogEntry; index: number }> = ({ entry, index }) => {
  const [open, setOpen] = useState(false);
  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.015, 0.3) }}
      className="border-b border-gray-800 last:border-0"
    >
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-800/60 transition"
      >
        {/* Severity icon */}
        <span className="flex-shrink-0">{sevIcon(entry.severity)}</span>

        {/* Type badge */}
        <span className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${typeBadge[entry.type] || "bg-gray-700 text-gray-300"}`}>
          {typeIcon[entry.type]} {typeLabel[entry.type] || entry.type}
        </span>

        {/* Title */}
        <span className="flex-1 min-w-0 text-sm text-gray-200 truncate">{entry.title}</span>

        {/* Severity badge */}
        <span className={`text-xs px-2 py-0.5 rounded-full font-semibold flex-shrink-0 ${sevBadge[entry.severity] || ""}`}>
          {entry.severity.toUpperCase()}
        </span>

        {/* Timestamp */}
        <span className="text-xs text-gray-500 flex-shrink-0 hidden md:block w-36 text-right">
          {fmtDate(entry.timestamp)}
        </span>

        {/* Expand */}
        {open ? <ChevronUp className="w-4 h-4 text-gray-500 flex-shrink-0" /> : <ChevronDown className="w-4 h-4 text-gray-500 flex-shrink-0" />}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="overflow-hidden"
          >
            <div className="px-12 pb-4 space-y-2">
              <p className="text-xs text-gray-400 md:hidden">{fmtDate(entry.timestamp)}</p>
              {entry.summary && (
                <p className="text-sm text-gray-300">{entry.summary}</p>
              )}
              {Object.keys(entry.meta).length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-1 mt-2">
                  {Object.entries(entry.meta).filter(([, v]) => v !== null && v !== undefined && v !== "").map(([k, v]) => (
                    <div key={k} className="text-xs">
                      <span className="text-gray-500 capitalize">{k.replace(/([A-Z])/g, ' $1')}: </span>
                      <span className="text-gray-300">{String(v).slice(0, 80)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────

const LOG_TYPES: { value: LogType; label: string }[] = [
  { value: "all",      label: "All Types" },
  { value: "finding",  label: "Findings" },
  { value: "incident", label: "Incidents" },
  { value: "firewall", label: "Firewall" },
  { value: "watch",    label: "Watch Alerts" },
  { value: "scan",     label: "Scans" },
  { value: "login",    label: "Login Events" },
  { value: "event",    label: "App Events" },
];

const SEVERITIES: { value: Severity; label: string }[] = [
  { value: "all",      label: "All Severities" },
  { value: "critical", label: "Critical" },
  { value: "high",     label: "High" },
  { value: "medium",   label: "Medium" },
  { value: "low",      label: "Low" },
  { value: "info",     label: "Info" },
];

const PAGE_SIZE = 50;

export default function LogReport() {
  const navigate = useNavigate();
  const [sidebarExpanded, setSidebarExpanded] = useState(true);
  const [profileImage, setProfileImage]       = useState("");

  // Filters
  const [type,     setType]     = useState<LogType>("all");
  const [severity, setSeverity] = useState<Severity>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo,   setDateTo]   = useState("");
  const [search,   setSearch]   = useState("");
  const [page,     setPage]     = useState(1);

  // Data
  const [entries,  setEntries]  = useState<LogEntry[]>([]);
  const [total,    setTotal]    = useState(0);
  const [stats,    setStats]    = useState<Stats | null>(null);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState("");

  const handleLogout = () => { localStorage.removeItem("token"); navigate("/"); };

  // Profile image
  useEffect(() => {
    const tok = localStorage.getItem("token");
    if (!tok) return;
    fetch(`${API_BASE_URL}/profile`, { headers: { Authorization: `Bearer ${tok}` } })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.profileImage) setProfileImage(d.profileImage); })
      .catch(() => {});
  }, []);

  // Stats
  useEffect(() => {
    fetch(`${API_BASE_URL}/log-report/stats`, { headers: { Authorization: `Bearer ${token()}` } })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setStats(d); })
      .catch(() => {});
  }, []);

  // Fetch logs
  const fetchLogs = useCallback(async (pg = 1) => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({
        type, severity, search,
        limit: String(PAGE_SIZE),
        page:  String(pg),
      });
      if (dateFrom) params.set("dateFrom", dateFrom);
      if (dateTo)   params.set("dateTo",   dateTo);

      const res  = await fetch(`${API_BASE_URL}/log-report?${params}`, {
        headers: { Authorization: `Bearer ${token()}` },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as any).error || `Request failed (${res.status})`);
      }
      const data = await res.json();
      setEntries(data.entries);
      setTotal(data.total);
      setPage(pg);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [type, severity, search, dateFrom, dateTo]);

  useEffect(() => { fetchLogs(1); }, [type, severity, dateFrom, dateTo]);

  // Search with debounce
  useEffect(() => {
    const t = setTimeout(() => fetchLogs(1), 350);
    return () => clearTimeout(t);
  }, [search]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="min-h-screen flex flex-col bg-gray-950 text-white">
      <Header token={token()} handleLogout={handleLogout} profileImage={profileImage} />

      <div className="flex flex-1 overflow-hidden">
        <AppSidebar sidebarExpanded={sidebarExpanded} setSidebarExpanded={setSidebarExpanded} />

        <div className="flex-1 flex flex-col overflow-hidden">

          {/* Page header */}
          <div className="px-6 pt-6 pb-4 border-b border-gray-800 flex-shrink-0">
            <div className="flex items-center gap-3 mb-1">
              <div className="w-8 h-8 bg-violet-600 rounded-lg flex items-center justify-center">
                <FileText className="w-4 h-4 text-white" />
              </div>
              <h1 className="text-2xl font-bold text-white">Log Report</h1>
            </div>
            <p className="text-sm text-gray-400 ml-11">Trace security events across all modules and export PDF reports</p>
          </div>

          <main className="flex-1 overflow-y-auto p-6 space-y-6">

            {/* Stats row */}
            {stats && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <StatCard label="Security Findings"  value={stats.findings}       icon={<ShieldAlert className="w-4 h-4 text-white" />} color="bg-red-600" />
                <StatCard label="Open Incidents"     value={stats.openIncidents}  icon={<AlertTriangle className="w-4 h-4 text-white" />} color="bg-orange-600" />
                <StatCard label="Firewall Blocks"    value={stats.firewallBlocks} icon={<Shield className="w-4 h-4 text-white" />} color="bg-teal-600" />
                <StatCard label="Watch Alerts"       value={stats.watchAlerts}    icon={<Eye className="w-4 h-4 text-white" />} color="bg-purple-600" />
              </div>
            )}

            {/* Filters */}
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
              <div className="flex flex-wrap gap-3 items-end">

                {/* Search */}
                <div className="relative flex-1 min-w-48">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                  <input
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Search logs…"
                    className="w-full pl-9 pr-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-violet-500"
                  />
                </div>

                {/* Type */}
                <select
                  value={type}
                  onChange={e => setType(e.target.value as LogType)}
                  className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-violet-500"
                >
                  {LOG_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>

                {/* Severity */}
                <select
                  value={severity}
                  onChange={e => setSeverity(e.target.value as Severity)}
                  className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-violet-500"
                >
                  {SEVERITIES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>

                {/* Date from */}
                <div className="flex items-center gap-1">
                  <Calendar className="w-4 h-4 text-gray-500" />
                  <input
                    type="date"
                    value={dateFrom}
                    onChange={e => setDateFrom(e.target.value)}
                    className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-violet-500"
                  />
                </div>
                <span className="text-gray-500 text-sm">→</span>
                <input
                  type="date"
                  value={dateTo}
                  onChange={e => setDateTo(e.target.value)}
                  className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-violet-500"
                />

                {/* Actions */}
                <button
                  onClick={() => fetchLogs(page)}
                  className="flex items-center gap-1.5 px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm transition"
                >
                  <RefreshCw className="w-4 h-4" /> Refresh
                </button>

                <button
                  onClick={() => exportPDF(entries, { type, severity, dateFrom, dateTo })}
                  disabled={entries.length === 0}
                  className="flex items-center gap-1.5 px-3 py-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-40 rounded-lg text-sm font-medium transition"
                >
                  <Download className="w-4 h-4" /> PDF
                </button>

                <button
                  onClick={() => exportCSV(entries)}
                  disabled={entries.length === 0}
                  className="flex items-center gap-1.5 px-3 py-2 bg-gray-700 hover:bg-gray-600 disabled:opacity-40 rounded-lg text-sm transition"
                >
                  <BarChart2 className="w-4 h-4" /> CSV
                </button>
              </div>

              {(type !== "all" || severity !== "all" || dateFrom || dateTo || search) && (
                <button
                  onClick={() => { setType("all"); setSeverity("all"); setDateFrom(""); setDateTo(""); setSearch(""); }}
                  className="mt-3 text-xs text-violet-400 hover:text-violet-300 flex items-center gap-1"
                >
                  <XCircle className="w-3 h-3" /> Clear all filters
                </button>
              )}
            </div>

            {/* Log table */}
            <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">

              {/* Table header */}
              <div className="flex items-center gap-3 px-4 py-2.5 border-b border-gray-800 bg-gray-800/50">
                <span className="w-4" />
                <span className="text-xs font-semibold text-gray-400 w-20">Type</span>
                <span className="flex-1 text-xs font-semibold text-gray-400">Title</span>
                <span className="text-xs font-semibold text-gray-400 w-20 text-right">Severity</span>
                <span className="text-xs font-semibold text-gray-400 w-36 text-right hidden md:block">Timestamp</span>
                <span className="w-4" />
              </div>

              {loading ? (
                <div className="flex items-center justify-center gap-3 py-16 text-gray-400">
                  <Loader2 className="w-5 h-5 animate-spin" /> Loading logs…
                </div>
              ) : error ? (
                <div className="flex items-center justify-center gap-2 py-16 text-red-400 text-sm">
                  <XCircle className="w-5 h-5" /> {error}
                </div>
              ) : entries.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-gray-500">
                  <Filter className="w-10 h-10 mb-3 opacity-30" />
                  <p className="text-sm">No logs match the current filters.</p>
                </div>
              ) : (
                <div>
                  {entries.map((entry, i) => (
                    <LogRow key={entry.id} entry={entry} index={i} />
                  ))}
                </div>
              )}
            </div>

            {/* Pagination + count */}
            {!loading && total > 0 && (
              <div className="flex items-center justify-between text-sm text-gray-400">
                <span>{total.toLocaleString()} total entries (showing page {page} of {totalPages})</span>
                <div className="flex gap-2">
                  <button
                    disabled={page === 1}
                    onClick={() => fetchLogs(page - 1)}
                    className="px-3 py-1 rounded-lg bg-gray-800 hover:bg-gray-700 disabled:opacity-40 transition text-xs"
                  >
                    ← Prev
                  </button>
                  <button
                    disabled={page >= totalPages}
                    onClick={() => fetchLogs(page + 1)}
                    className="px-3 py-1 rounded-lg bg-gray-800 hover:bg-gray-700 disabled:opacity-40 transition text-xs"
                  >
                    Next →
                  </button>
                </div>
              </div>
            )}

          </main>
        </div>
      </div>
      <Footer />
    </div>
  );
}
