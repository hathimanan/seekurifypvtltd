import React, { useState, useEffect } from "react";
import { jsPDF } from "jspdf";
import { motion, AnimatePresence } from "framer-motion";
import {
  Lock,
  Globe,
  Server,
  Mail,
  FolderOpen,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Info,
  Loader2,
  Shield,
  ShieldCheck,
  ShieldAlert,
  MessageCircle,
  Search,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  FileSearch,
  Copy,
  CheckCheck,
  Wrench,
  RefreshCw,
  Cpu,
} from "lucide-react";
import { API_BASE_URL } from "../services/api";
import Header from "./ui/Header";
import Footer from "./ui/Footer";
import AppSidebar from "./ui/AppSidebar";
import { useNavigate } from "react-router-dom";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Finding {
  severity: "critical" | "warning" | "info";
  category: string;
  message: string;
  explain?: string;
  fix?: string | null;
}

interface SSLResult {
  valid?: boolean;
  subject?: string;
  issuer?: string;
  validTo?: string;
  daysLeft?: number;
  grade?: string;
  error?: string;
}

interface HeadersResult {
  csp?: boolean;
  hsts?: boolean;
  xFrameOptions?: boolean;
  xContentTypeOptions?: boolean;
  referrerPolicy?: boolean;
  permissionsPolicy?: boolean;
  raw?: Record<string, string | null>;
  error?: string;
}

interface BlacklistResult {
  blacklisted?: boolean;
  threats?: string[];
  skipped?: boolean;
  error?: string;
}

interface DNSResult {
  spf?: boolean;
  dmarc?: boolean;
  spfRecord?: string | null;
  dmarcRecord?: string | null;
  error?: string;
}

interface ExposedPath {
  path: string;
  status: number;
}

interface MixedElement {
  element: string;
  lineNumber: number;
  insecureUrl: string;
  fix: string;
}

interface MixedContentResult {
  hasMixedContent?: boolean;
  count?: number;
  error?: string;
  elements?: MixedElement[];
}

interface StackInfo {
  platform: "cloudflare" | "vercel" | "netlify" | "aws-cloudfront" | "nginx" | "apache" | "iis" | "unknown";
  server: string | null;
  confidence: "high" | "medium" | "low";
}

interface HeaderFix {
  name: string;
  value: string;
}

interface Fixes {
  missingHeaders: HeaderFix[];
  nginx: string | null;
  apache: string | null;
  vercel: string | null;
  netlify: string | null;
  cloudflare: string | null;
  dnsSpf: string | null;
  dnsDmarc: string | null;
}

interface VerifyItem { check: string; item: string; }
interface VerifyResult {
  url: string;
  timestamp: string;
  fixed: VerifyItem[];
  failing: VerifyItem[];
}

interface AuditResult {
  url: string;
  hostname: string;
  timestamp: string;
  score: number;
  grade: string;
  findings: Finding[];
  ssl: SSLResult;
  headers: HeadersResult;
  blacklist: BlacklistResult;
  dns: DNSResult;
  exposedPaths: ExposedPath[];
  mixedContent: MixedContentResult;
  stack?: StackInfo;
  fixes?: Fixes | null;
  cspSuggestion?: string | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const gradeColor = (grade: string) => {
  switch (grade) {
    case "A": return "text-green-600 dark:text-green-400";
    case "B": return "text-blue-600 dark:text-blue-400";
    case "C": return "text-yellow-600 dark:text-yellow-400";
    case "D": return "text-orange-600 dark:text-orange-400";
    default:  return "text-red-600 dark:text-red-400";
  }
};

const gradeBg = (grade: string) => {
  switch (grade) {
    case "A": return "bg-green-100 dark:bg-green-900/30 border-green-300 dark:border-green-700";
    case "B": return "bg-blue-100 dark:bg-blue-900/30 border-blue-300 dark:border-blue-700";
    case "C": return "bg-yellow-100 dark:bg-yellow-900/30 border-yellow-300 dark:border-yellow-700";
    case "D": return "bg-orange-100 dark:bg-orange-900/30 border-orange-300 dark:border-orange-700";
    default:  return "bg-red-100 dark:bg-red-900/30 border-red-300 dark:border-red-700";
  }
};

const severityIcon = (severity: Finding["severity"]) => {
  switch (severity) {
    case "critical": return <XCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />;
    case "warning":  return <AlertTriangle className="w-4 h-4 text-yellow-500 flex-shrink-0 mt-0.5" />;
    default:         return <Info className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />;
  }
};

const severityBadge = (severity: Finding["severity"]) => {
  switch (severity) {
    case "critical": return "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300";
    case "warning":  return "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300";
    default:         return "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300";
  }
};

// Scan steps shown during loading
const SCAN_STEPS = [
  { icon: <Lock className="w-4 h-4" />, label: "SSL/TLS Certificate" },
  { icon: <Shield className="w-4 h-4" />, label: "Security Headers" },
  { icon: <Globe className="w-4 h-4" />, label: "Blacklist Status" },
  { icon: <Mail className="w-4 h-4" />, label: "DNS Records (SPF / DMARC)" },
  { icon: <FolderOpen className="w-4 h-4" />, label: "Exposed Sensitive Paths" },
  { icon: <Server className="w-4 h-4" />, label: "Mixed Content" },
];

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatusBadge({ ok, trueLabel = "Pass", falseLabel = "Fail" }: { ok: boolean; trueLabel?: string; falseLabel?: string }) {
  return ok ? (
    <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300">
      <CheckCircle className="w-3 h-3" /> {trueLabel}
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300">
      <XCircle className="w-3 h-3" /> {falseLabel}
    </span>
  );
}

function SectionCard({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-md border border-gray-200 dark:border-gray-700 overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-gray-50 dark:hover:bg-gray-700/50 transition"
      >
        <div className="flex items-center gap-2 font-semibold text-gray-800 dark:text-gray-100">
          <span className="text-amber-500">{icon}</span>
          {title}
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="content"
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
}

function HeaderRow({ label, value, present }: { label: string; value: string | null; present: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2 border-b border-gray-100 dark:border-gray-700 last:border-0">
      <span className="text-sm text-gray-700 dark:text-gray-300 font-mono">{label}</span>
      <div className="flex items-center gap-2 text-right">
        <StatusBadge ok={present} trueLabel="Present" falseLabel="Missing" />
        {value && (
          <span className="text-xs text-gray-400 dark:text-gray-500 font-mono max-w-xs truncate hidden md:block" title={value}>
            {value}
          </span>
        )}
      </div>
    </div>
  );
}

// ─── PDF Report Generator ─────────────────────────────────────────────────────

function downloadAuditPDF(result: AuditResult): void {
  const doc = new jsPDF({ unit: "mm", format: "a4" });

  const pageW  = 210;
  const pageH  = 297;
  const margin = 14;
  const cW     = pageW - margin * 2; // 182 mm
  let y        = 0;

  // ── helpers ──────────────────────────────────────────────────────────────
  const checkPage = (need = 10) => {
    if (y + need > pageH - 14) { doc.addPage(); y = 18; }
  };

  const sectionHeader = (title: string) => {
    checkPage(14);
    y += 5;
    doc.setFillColor(245, 243, 255);
    doc.rect(margin, y, cW, 8, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(109, 40, 217);
    doc.text(title, margin + 3, y + 5.5);
    y += 11;
  };

  const labelValue = (label: string, value: string, pass?: boolean) => {
    checkPage(7);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(75, 85, 99);
    doc.text(label, margin + 3, y);
    if (pass === true)  doc.setTextColor(21, 128, 61);
    else if (pass === false) doc.setTextColor(185, 28, 28);
    else doc.setTextColor(17, 24, 39);
    const wrapped = doc.splitTextToSize(value, cW - 62);
    doc.text(wrapped, margin + 60, y);
    y += Math.max(6, wrapped.length * 4.5);
  };

  const codeBlock = (text: string, color: [number, number, number] = [30, 41, 59]) => {
    doc.setFont("courier", "normal");
    doc.setFontSize(7);

    const lineH   = 4.5;   // mm per line
    const padLeft = 4;
    const accentW = 1.2;   // violet left-border strip

    const lines = doc.splitTextToSize(text, cW - padLeft - 3) as string[];

    y += 2; // top gap before block

    for (const line of lines) {
      checkPage(lineH + 3); // ensure room for this line + a little breathing room

      // per-line background stripe (avoids one giant rect that overflows page boundary)
      doc.setFillColor(248, 250, 252);
      doc.rect(margin, y - 1, cW, lineH, "F");

      // violet left accent bar
      doc.setFillColor(124, 58, 237);
      doc.rect(margin, y - 1, accentW, lineH, "F");

      // text
      doc.setTextColor(color[0], color[1], color[2]);
      doc.text(line, margin + padLeft, y + lineH - 1.5);

      y += lineH;
    }

    y += 4; // bottom gap after block
  };

  // ── HEADER BAR ────────────────────────────────────────────────────────────
  doc.setFillColor(79, 70, 229);
  doc.rect(0, 0, pageW, 34, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(17);
  doc.setTextColor(255, 255, 255);
  doc.text("SiteShield Audit Report", margin, 13);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(199, 210, 254);
  doc.text("Powered by Seekurify", margin, 20);

  const urlLabel = result.url.length > 52 ? result.url.slice(0, 52) + "..." : result.url;
  doc.setFontSize(7.5);
  doc.setTextColor(224, 231, 255);
  doc.text(urlLabel, pageW - margin, 13, { align: "right" });
  doc.text("Scanned: " + new Date(result.timestamp).toLocaleString(), pageW - margin, 20, { align: "right" });

  y = 42;

  // ── SCORE CARD ────────────────────────────────────────────────────────────
  const gradeRGB: Record<string, [number, number, number]> = {
    A: [22, 163, 74], B: [37, 99, 235], C: [202, 138, 4], D: [234, 88, 12], F: [220, 38, 38],
  };
  const [gr, gg, gb] = gradeRGB[result.grade] ?? gradeRGB["F"];
  doc.setDrawColor(gr, gg, gb);
  doc.setLineWidth(0.7);
  doc.rect(margin, y, 28, 22);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.setTextColor(gr, gg, gb);
  doc.text(result.grade, margin + 14, y + 15, { align: "center" });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(17, 24, 39);
  doc.text(`${result.score} / 100`, margin + 34, y + 8);

  const crit = result.findings.filter(f => f.severity === "critical").length;
  const warn = result.findings.filter(f => f.severity === "warning").length;
  const info = result.findings.filter(f => f.severity === "info").length;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(75, 85, 99);
  doc.text(`${crit} Critical   ${warn} Warning   ${info} Info`, margin + 34, y + 17);
  y += 30;

  // ── FINDINGS ─────────────────────────────────────────────────────────────
  sectionHeader("Findings");
  if (result.findings.length === 0) {
    doc.setFont("helvetica", "normal"); doc.setFontSize(8.5);
    doc.setTextColor(21, 128, 61);
    doc.text("No issues found — all checks passed.", margin + 3, y); y += 7;
  } else {
    const sevRGB: Record<string, [number, number, number]> = {
      critical: [220, 38, 38], warning: [202, 138, 4], info: [37, 99, 235],
    };
    const sevLabel: Record<string, string> = { critical: "CRIT", warning: "WARN", info: "INFO" };
    for (const f of result.findings) {
      checkPage(9);
      const [sr, sg, sb] = sevRGB[f.severity];
      doc.setFillColor(sr, sg, sb);
      doc.rect(margin, y - 4, 14, 5.5, "F");
      doc.setFont("helvetica", "bold"); doc.setFontSize(6);
      doc.setTextColor(255, 255, 255);
      doc.text(sevLabel[f.severity], margin + 1, y);

      doc.setFont("helvetica", "bold"); doc.setFontSize(8);
      doc.setTextColor(75, 85, 99);
      doc.text(f.category, margin + 16, y);

      doc.setFont("helvetica", "normal"); doc.setFontSize(8);
      doc.setTextColor(17, 24, 39);
      const msgLines = doc.splitTextToSize(f.message, cW - 56);
      doc.text(msgLines, margin + 56, y);
      y += Math.max(7, msgLines.length * 4.5 + 2);
    }
  }

  // ── SSL/TLS ───────────────────────────────────────────────────────────────
  sectionHeader("SSL / TLS Certificate");
  if (result.ssl.error) {
    labelValue("Error", result.ssl.error, false);
  } else {
    labelValue("Valid",     result.ssl.valid ? "Yes" : "No",           result.ssl.valid);
    labelValue("Grade",     result.ssl.grade ?? "—");
    labelValue("Issued to", result.ssl.subject ?? "—");
    labelValue("Issuer",    result.ssl.issuer  ?? "—");
    labelValue("Expires",   result.ssl.validTo ?? "—");
    labelValue("Days left", result.ssl.daysLeft !== undefined ? String(result.ssl.daysLeft) : "—",
      (result.ssl.daysLeft ?? 0) > 30);
  }

  // ── SECURITY HEADERS ─────────────────────────────────────────────────────
  sectionHeader("Security Headers");
  if (!result.headers.error) {
    labelValue("Content-Security-Policy",   result.headers.raw?.csp ?? "Missing",                        !!result.headers.csp);
    labelValue("Strict-Transport-Security", result.headers.raw?.hsts ?? "Missing",                       !!result.headers.hsts);
    labelValue("X-Frame-Options",           result.headers.raw?.xFrameOptions ?? "Missing",              !!result.headers.xFrameOptions);
    labelValue("X-Content-Type-Options",    result.headers.raw?.xContentTypeOptions ?? "Missing",        !!result.headers.xContentTypeOptions);
    labelValue("Referrer-Policy",           result.headers.raw?.referrerPolicy ?? "Missing",             !!result.headers.referrerPolicy);
    labelValue("Permissions-Policy",        result.headers.permissionsPolicy ? "Present" : "Missing",   !!result.headers.permissionsPolicy);
  }

  // ── DNS ────────────────────────────────────────────────────────────────────
  sectionHeader("DNS — SPF & DMARC");
  if (!result.dns.error) {
    labelValue("SPF Record",   result.dns.spfRecord   ?? (result.dns.spf   ? "Found" : "Not found"), !!result.dns.spf);
    labelValue("DMARC Record", result.dns.dmarcRecord ?? (result.dns.dmarc ? "Found" : "Not found"), !!result.dns.dmarc);
  }

  // ── EXPOSED PATHS ─────────────────────────────────────────────────────────
  sectionHeader("Exposed Sensitive Paths");
  if (Array.isArray(result.exposedPaths) && result.exposedPaths.length > 0) {
    for (const ep of result.exposedPaths) {
      checkPage(6);
      doc.setFont("courier", "normal"); doc.setFontSize(8);
      doc.setTextColor(185, 28, 28);
      doc.text(`  ${ep.path}   HTTP ${ep.status}`, margin + 3, y); y += 5.5;
    }
  } else {
    doc.setFont("helvetica", "normal"); doc.setFontSize(8.5);
    doc.setTextColor(21, 128, 61);
    doc.text("No exposed paths detected.", margin + 3, y); y += 6;
  }

  // ── MIXED CONTENT ─────────────────────────────────────────────────────────
  sectionHeader("Mixed Content");
  doc.setFont("helvetica", "normal"); doc.setFontSize(8.5);
  if (result.mixedContent.hasMixedContent) {
    doc.setTextColor(185, 28, 28);
    doc.text(`${result.mixedContent.count} insecure resource(s) loaded over HTTP on this HTTPS page.`, margin + 3, y);
  } else {
    doc.setTextColor(21, 128, 61);
    doc.text("No mixed content detected.", margin + 3, y);
  }
  y += 7;

  // ── PATCHPATH ─────────────────────────────────────────────────────────────
  if (result.fixes && result.stack) {
    sectionHeader("PatchPath — Generated Fixes");

    doc.setFont("helvetica", "bold"); doc.setFontSize(8.5);
    doc.setTextColor(109, 40, 217);
    doc.text(`Detected stack: ${result.stack.server ?? result.stack.platform}`, margin + 3, y);
    y += 7;

    if (result.fixes.missingHeaders.length > 0) {
      doc.setFont("helvetica", "bold"); doc.setFontSize(8.5);
      doc.setTextColor(17, 24, 39);
      doc.text("Missing headers to add:", margin + 3, y); y += 5;
      for (const hd of result.fixes.missingHeaders) {
        checkPage(6);
        doc.setFont("courier", "normal"); doc.setFontSize(7.5);
        doc.setTextColor(55, 65, 81);
        const lines = doc.splitTextToSize(`${hd.name}: ${hd.value}`, cW - 8);
        doc.text(lines, margin + 5, y);
        y += lines.length * 4.5 + 1;
      }
      y += 3;

      // Platform config snippet (show detected platform or nginx as default)
      const platformKey = (["nginx","apache","vercel","netlify","cloudflare"] as const)
        .find(k => k === result.stack?.platform) ?? "nginx";
      const snippet = result.fixes[platformKey];
      if (snippet) {
        doc.setFont("helvetica", "bold"); doc.setFontSize(8.5);
        doc.setTextColor(109, 40, 217);
        doc.text(`Ready-to-paste config (${platformKey.toUpperCase()}):`, margin + 3, y); y += 5;
        codeBlock(snippet, [30, 41, 59]);
      }
    }

    if (result.fixes.dnsSpf || result.fixes.dnsDmarc) {
      doc.setFont("helvetica", "bold"); doc.setFontSize(8.5);
      doc.setTextColor(17, 24, 39);
      doc.text("DNS records to add:", margin + 3, y); y += 5;
      if (result.fixes.dnsSpf)   codeBlock(result.fixes.dnsSpf,   [6,  95, 70]);
      if (result.fixes.dnsDmarc) codeBlock(result.fixes.dnsDmarc, [6,  95, 70]);
    }
  }

  // ── FOOTER on every page ──────────────────────────────────────────────────
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal"); doc.setFontSize(7);
    doc.setTextColor(156, 163, 175);
    doc.text(
      "Generated by Seekurify SiteShield Audit  \u00B7  " + new Date().toLocaleString(),
      margin, pageH - 6
    );
    doc.text(`Page ${i} / ${totalPages}`, pageW - margin, pageH - 6, { align: "right" });
  }

  doc.save(`seekurify-audit-${result.hostname}-${new Date().toISOString().split("T")[0]}.pdf`);
}

// ─── FindingCard: explain + fix per finding ───────────────────────────────────

function FindingCard({ finding: f }: { finding: Finding }) {
  const [open, setOpen] = React.useState(false);
  const [copied, setCopied] = React.useState(false);

  const copyFix = () => {
    if (!f.fix) return;
    navigator.clipboard.writeText(f.fix);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={`rounded-xl border transition ${open ? "border-indigo-300 dark:border-indigo-600" : "border-gray-200 dark:border-gray-700"}`}>
      {/* Summary row */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-start gap-2.5 px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-700/40 transition rounded-xl"
      >
        <span className="mt-0.5 flex-shrink-0">{severityIcon(f.severity)}</span>
        <div className="flex-1 min-w-0">
          <span className={`text-xs font-semibold px-1.5 py-0.5 rounded mr-2 ${severityBadge(f.severity)}`}>
            {f.category}
          </span>
          <span className="text-sm text-gray-700 dark:text-gray-300">{f.message}</span>
        </div>
        {(f.explain || f.fix) && (
          <span className="flex-shrink-0 mt-0.5">
            {open
              ? <ChevronUp className="w-4 h-4 text-gray-400" />
              : <ChevronDown className="w-4 h-4 text-gray-400" />}
          </span>
        )}
      </button>

      {/* Expanded: explain + fix */}
      <AnimatePresence initial={false}>
        {open && (f.explain || f.fix) && (
          <motion.div
            key="detail"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 pt-1 space-y-3 border-t border-gray-100 dark:border-gray-700">
              {/* Plain-English explanation */}
              {f.explain && (
                <div className="flex items-start gap-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg px-3 py-2.5">
                  <Info className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-blue-800 dark:text-blue-200">{f.explain}</p>
                </div>
              )}

              {/* Actionable fix */}
              {f.fix && (
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide flex items-center gap-1">
                      <Wrench className="w-3 h-3" /> Fix
                    </span>
                    <button
                      onClick={copyFix}
                      className="flex items-center gap-1 text-xs px-2 py-0.5 rounded bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 transition"
                    >
                      {copied ? <CheckCheck className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
                      {copied ? "Copied!" : "Copy"}
                    </button>
                  </div>
                  <pre className="bg-gray-900 text-green-300 text-xs rounded-xl p-3 overflow-x-auto leading-relaxed whitespace-pre-wrap font-mono">
                    {f.fix}
                  </pre>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── WebhookManager ───────────────────────────────────────────────────────────

interface WebhookEntry {
  _id: string;
  name: string;
  targetUrl: string;
  webhookType: string;
  threshold: number;
  lastScore?: number;
  lastGrade?: string;
  lastStatus?: string;
  lastRunAt?: string;
  token: string;
}

function WebhookManager({ apiBase, token: authToken }: { apiBase: string; token: string }) {
  const [open,     setOpen]     = React.useState(false);
  const [webhooks, setWebhooks] = React.useState<WebhookEntry[]>([]);
  const [loading,  setLoading]  = React.useState(false);
  const [creating, setCreating] = React.useState(false);
  const [newWh, setNewWh] = React.useState({ name: "", targetUrl: "", webhookUrl: "", webhookType: "slack", threshold: 70 });
  const [created, setCreated] = React.useState<{ triggerUrl: string; curlCommand: string; githubStep: string } | null>(null);
  const [copiedKey, setCopiedKey] = React.useState<string | null>(null);

  const headers = { "Content-Type": "application/json", ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}) };

  const copyText = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${apiBase}/webhooks`, { headers });
      if (res.ok) setWebhooks((await res.json()).webhooks || []);
    } finally { setLoading(false); }
  }, [apiBase, authToken]);

  React.useEffect(() => { if (open) load(); }, [open]);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    try {
      const res = await fetch(`${apiBase}/webhooks`, { method: "POST", headers, body: JSON.stringify(newWh) });
      const data = await res.json();
      if (res.ok) { setCreated(data); load(); }
    } finally { setCreating(false); }
  };

  const remove = async (id: string) => {
    await fetch(`${apiBase}/webhooks/${id}`, { method: "DELETE", headers });
    setWebhooks(ws => ws.filter(w => w._id !== id));
  };

  const statusColor = (s?: string) =>
    s === "passed" ? "text-green-600 dark:text-green-400" :
    s === "failed" ? "text-red-500 dark:text-red-400" : "text-gray-400";

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-md border border-gray-200 dark:border-gray-700 overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition"
      >
        <div className="flex items-center gap-2 font-semibold text-gray-800 dark:text-gray-100">
          <Cpu className="w-5 h-5 text-amber-500" />
          CI/CD Webhooks
          <span className="text-xs font-normal text-gray-400 ml-1">— scan on every deploy</span>
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div key="wh" initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="px-5 pb-5 border-t border-gray-100 dark:border-gray-700 pt-4 space-y-5">

              {/* Existing webhooks */}
              {loading && <p className="text-sm text-gray-400">Loading…</p>}
              {webhooks.map(wh => (
                <div key={wh._id} className="flex items-start justify-between gap-3 p-3 rounded-xl bg-gray-50 dark:bg-gray-700/40 border border-gray-200 dark:border-gray-600">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-sm text-gray-800 dark:text-gray-100 truncate">{wh.name}</p>
                    <p className="text-xs text-gray-400 truncate">{wh.targetUrl}</p>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-xs text-gray-400">threshold {wh.threshold}</span>
                      {wh.lastStatus && (
                        <span className={`text-xs font-semibold ${statusColor(wh.lastStatus)}`}>
                          Last: {wh.lastGrade ?? "—"} ({wh.lastScore ?? "—"}/100)
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={() => copyText(`curl -X POST ${apiBase.replace('/api','')}/api/webhooks/trigger/${wh.token}`, wh._id)}
                      className="text-xs px-2 py-1 rounded bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 transition flex items-center gap-1"
                    >
                      {copiedKey === wh._id ? <CheckCheck className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />} curl
                    </button>
                    <button onClick={() => remove(wh._id)} className="text-xs text-red-500 hover:text-red-700 transition px-1">✕</button>
                  </div>
                </div>
              ))}

              {/* Created confirmation */}
              {created && (
                <div className="p-4 rounded-xl bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 space-y-3">
                  <p className="text-sm font-semibold text-green-700 dark:text-green-300 flex items-center gap-2">
                    <CheckCircle className="w-4 h-4" /> Webhook created! Add this to your deploy pipeline:
                  </p>
                  <div className="relative">
                    <div className="absolute top-2 right-2">
                      <button onClick={() => copyText(created.curlCommand, "curl")} className="text-xs px-2 py-0.5 rounded bg-gray-700 text-gray-200 hover:bg-gray-600 flex items-center gap-1">
                        {copiedKey === "curl" ? <CheckCheck className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />} copy
                      </button>
                    </div>
                    <pre className="bg-gray-900 text-green-300 text-xs rounded-lg p-3 pr-16 overflow-x-auto font-mono">{created.curlCommand}</pre>
                  </div>
                  <details className="text-xs">
                    <summary className="cursor-pointer text-green-700 dark:text-green-400 font-medium">GitHub Actions step</summary>
                    <div className="relative mt-2">
                      <div className="absolute top-2 right-2">
                        <button onClick={() => copyText(created.githubStep, "gh")} className="text-xs px-2 py-0.5 rounded bg-gray-700 text-gray-200 hover:bg-gray-600 flex items-center gap-1">
                          {copiedKey === "gh" ? <CheckCheck className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />} copy
                        </button>
                      </div>
                      <pre className="bg-gray-900 text-cyan-300 text-xs rounded-lg p-3 pr-16 overflow-x-auto font-mono">{created.githubStep}</pre>
                    </div>
                  </details>
                  <button onClick={() => setCreated(null)} className="text-xs text-gray-400 hover:text-gray-600">Dismiss</button>
                </div>
              )}

              {/* Create form */}
              <form onSubmit={create} className="space-y-3 border-t border-gray-100 dark:border-gray-700 pt-4">
                <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">Add new webhook</p>
                <div className="grid grid-cols-2 gap-3">
                  <input required value={newWh.name} onChange={e => setNewWh(p => ({ ...p, name: e.target.value }))}
                    placeholder="Name (e.g. Production)" className="col-span-2 px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-amber-400" />
                  <input required value={newWh.targetUrl} onChange={e => setNewWh(p => ({ ...p, targetUrl: e.target.value }))}
                    placeholder="Site URL to scan" className="col-span-2 px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-amber-400" />
                  <input required value={newWh.webhookUrl} onChange={e => setNewWh(p => ({ ...p, webhookUrl: e.target.value }))}
                    placeholder="Slack / custom webhook URL" className="col-span-2 px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-amber-400" />
                  <select value={newWh.webhookType} onChange={e => setNewWh(p => ({ ...p, webhookType: e.target.value }))}
                    className="px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-amber-400">
                    <option value="slack">Slack</option>
                    <option value="github">GitHub</option>
                    <option value="custom">Custom JSON</option>
                  </select>
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">Fail if score &lt;</label>
                    <input type="number" min={0} max={100} value={newWh.threshold} onChange={e => setNewWh(p => ({ ...p, threshold: Number(e.target.value) }))}
                      className="w-20 px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-amber-400" />
                  </div>
                </div>
                <button type="submit" disabled={creating}
                  className="flex items-center gap-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-900 text-sm font-semibold px-4 py-2 rounded-lg transition">
                  {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                  {creating ? "Creating…" : "Create Webhook"}
                </button>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── PatchPath Panel ──────────────────────────────────────────────────────────

const PLATFORM_LABELS: Record<string, string> = {
  cloudflare:      "Cloudflare",
  vercel:          "Vercel",
  netlify:         "Netlify",
  "aws-cloudfront":"AWS CloudFront",
  nginx:           "Nginx",
  apache:          "Apache",
  iis:             "IIS",
  unknown:         "Unknown",
};

const PLATFORM_COLORS: Record<string, string> = {
  cloudflare:      "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300",
  vercel:          "bg-gray-100  text-gray-700  dark:bg-gray-700       dark:text-gray-200",
  netlify:         "bg-teal-100  text-teal-700  dark:bg-teal-900/40    dark:text-teal-300",
  "aws-cloudfront":"bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300",
  nginx:           "bg-green-100 text-green-700 dark:bg-green-900/40   dark:text-green-300",
  apache:          "bg-red-100   text-red-700   dark:bg-red-900/40     dark:text-red-300",
  iis:             "bg-blue-100  text-blue-700  dark:bg-blue-900/40    dark:text-blue-300",
  unknown:         "bg-gray-100  text-gray-500  dark:bg-gray-700       dark:text-gray-400",
};

type TabKey = "nginx" | "apache" | "vercel" | "netlify" | "cloudflare";
const TABS: { key: TabKey; label: string }[] = [
  { key: "nginx",      label: "Nginx"      },
  { key: "apache",     label: "Apache"     },
  { key: "vercel",     label: "vercel.json"},
  { key: "netlify",    label: "_headers"   },
  { key: "cloudflare", label: "Cloudflare" },
];

function CopyButton({ text }: { text: string }) {
  const [done, setDone] = React.useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setDone(true);
      setTimeout(() => setDone(false), 2000);
    });
  };
  return (
    <button
      onClick={copy}
      className="flex items-center gap-1 text-xs px-2 py-1 rounded bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 transition"
    >
      {done ? <CheckCheck className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
      {done ? "Copied!" : "Copy"}
    </button>
  );
}

function PatchPathPanel({ fixes, stack, url, apiBase }: {
  fixes: Fixes;
  stack: StackInfo;
  url: string;
  apiBase: string;
}) {
  const defaultTab: TabKey =
    stack.platform === "nginx"   ? "nginx"   :
    stack.platform === "apache"  ? "apache"  :
    stack.platform === "vercel"  ? "vercel"  :
    stack.platform === "netlify" ? "netlify" :
    stack.platform === "cloudflare" ? "cloudflare" : "nginx";

  const [activeTab, setActiveTab] = React.useState<TabKey>(defaultTab);
  const [verifying, setVerifying] = React.useState(false);
  const [verifyResult, setVerifyResult] = React.useState<VerifyResult | null>(null);
  const [verifyError, setVerifyError] = React.useState<string | null>(null);

  const currentSnippet: string | null = fixes[activeTab];

  const runVerify = async () => {
    setVerifying(true);
    setVerifyResult(null);
    setVerifyError(null);
    try {
      const res = await fetch(`${apiBase}/site-audit/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, checks: ["headers", "dns", "ssl"] }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Verify failed");
      setVerifyResult(data as VerifyResult);
    } catch (e: unknown) {
      setVerifyError(e instanceof Error ? e.message : "Verify failed");
    } finally {
      setVerifying(false);
    }
  };

  const hasHeaderFixes = fixes.missingHeaders.length > 0;
  const hasDnsFixes    = !!(fixes.dnsSpf || fixes.dnsDmarc);

  return (
    <div className="rounded-2xl border-2 border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/30 overflow-hidden shadow-md">
      {/* Header */}
      <div className="px-5 py-4 bg-amber-100 dark:bg-amber-900/40 flex flex-col md:flex-row md:items-center gap-3">
        <div className="flex items-center gap-2">
          <Wrench className="w-5 h-5 text-amber-600 dark:text-amber-400" />
          <span className="font-bold text-amber-900 dark:text-amber-100 text-lg">PatchPath</span>
          <span className="text-xs text-amber-600 dark:text-amber-400 font-medium">— exact fixes for your stack</span>
        </div>
        <div className="md:ml-auto flex items-center gap-2">
          <Cpu className="w-4 h-4 text-amber-500" />
          <span className="text-xs text-amber-700 dark:text-amber-300 font-medium">Detected stack:</span>
          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${PLATFORM_COLORS[stack.platform]}`}>
            {stack.server || PLATFORM_LABELS[stack.platform]}
          </span>
          {stack.confidence === "low" && (
            <span className="text-xs text-gray-400">(undetected — showing Nginx defaults)</span>
          )}
        </div>
      </div>

      <div className="px-5 pb-5 pt-4 space-y-5">

        {/* ── Header Fix Snippets ── */}
        {hasHeaderFixes && (
          <div>
            <p className="text-sm font-semibold text-amber-800 dark:text-amber-200 mb-3">
              Missing security headers — paste the config for your platform:
            </p>
            {/* Tab bar */}
            <div className="flex gap-1 flex-wrap mb-3">
              {TABS.filter(t => fixes[t.key] !== null).map(t => (
                <button
                  key={t.key}
                  onClick={() => setActiveTab(t.key)}
                  className={`text-xs px-3 py-1.5 rounded-lg font-mono font-semibold transition ${
                    activeTab === t.key
                      ? "bg-amber-500 text-slate-900 shadow"
                    : "bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-600 hover:border-amber-400"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
            {/* Code block */}
            {currentSnippet && (
              <div className="relative">
                <div className="absolute top-2 right-2 z-10">
                  <CopyButton text={currentSnippet} />
                </div>
                <pre className="bg-gray-900 text-green-300 text-xs rounded-xl p-4 pr-20 overflow-x-auto leading-relaxed whitespace-pre-wrap">
                  {currentSnippet}
                </pre>
              </div>
            )}
          </div>
        )}

        {/* ── DNS Fix Snippets ── */}
        {hasDnsFixes && (
          <div>
            <p className="text-sm font-semibold text-amber-800 dark:text-amber-200 mb-3">
              DNS records to add (email spoofing protection):
            </p>
            <div className="space-y-3">
              {fixes.dnsSpf && (
                <div className="relative">
                  <div className="absolute top-2 right-2 z-10"><CopyButton text={fixes.dnsSpf} /></div>
                  <pre className="bg-gray-900 text-cyan-300 text-xs rounded-xl p-4 pr-20 overflow-x-auto leading-relaxed whitespace-pre-wrap">
                    {fixes.dnsSpf}
                  </pre>
                </div>
              )}
              {fixes.dnsDmarc && (
                <div className="relative">
                  <div className="absolute top-2 right-2 z-10"><CopyButton text={fixes.dnsDmarc} /></div>
                  <pre className="bg-gray-900 text-cyan-300 text-xs rounded-xl p-4 pr-20 overflow-x-auto leading-relaxed whitespace-pre-wrap">
                    {fixes.dnsDmarc}
                  </pre>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Verify Fix Button ── */}
        <div className="border-t border-violet-200 dark:border-violet-800 pt-4">
          <div className="flex flex-col md:flex-row md:items-center gap-3">
            <div className="flex-1">
              <p className="text-sm font-semibold text-amber-800 dark:text-amber-200">Applied the fix?</p>
              <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">
                Re-scan only the failing items to confirm they're resolved.
              </p>
            </div>
            <button
              onClick={runVerify}
              disabled={verifying}
              className="flex items-center gap-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-900 font-semibold px-5 py-2.5 rounded-xl shadow transition hover:scale-105 active:scale-95 flex-shrink-0"
            >
              {verifying
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Verifying…</>
                : <><RefreshCw className="w-4 h-4" /> Verify Fix</>}
            </button>
          </div>

          {/* Verify result */}
          {verifyError && (
            <div className="mt-3 p-3 rounded-xl bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 text-red-600 dark:text-red-400 text-sm flex items-center gap-2">
              <XCircle className="w-4 h-4 flex-shrink-0" /> {verifyError}
            </div>
          )}
          {verifyResult && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-3 grid md:grid-cols-2 gap-3"
            >
              {verifyResult.fixed.length > 0 && (
                <div className="p-3 rounded-xl bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700">
                  <p className="text-xs font-bold text-green-700 dark:text-green-300 mb-2 flex items-center gap-1">
                    <CheckCheck className="w-4 h-4" /> Fixed ({verifyResult.fixed.length})
                  </p>
                  {verifyResult.fixed.map((item, i) => (
                    <div key={i} className="text-xs text-green-700 dark:text-green-400 flex items-center gap-1.5">
                      <CheckCircle className="w-3 h-3 flex-shrink-0" />
                      <span className="font-mono">{item.item}</span>
                    </div>
                  ))}
                </div>
              )}
              {verifyResult.failing.length > 0 && (
                <div className="p-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700">
                  <p className="text-xs font-bold text-red-700 dark:text-red-300 mb-2 flex items-center gap-1">
                    <XCircle className="w-4 h-4" /> Still failing ({verifyResult.failing.length})
                  </p>
                  {verifyResult.failing.map((item, i) => (
                    <div key={i} className="text-xs text-red-600 dark:text-red-400 flex items-center gap-1.5">
                      <AlertTriangle className="w-3 h-3 flex-shrink-0" />
                      <span className="font-mono">{item.item}</span>
                    </div>
                  ))}
                </div>
              )}
              {verifyResult.fixed.length === 0 && verifyResult.failing.length === 0 && (
                <p className="text-sm text-gray-500 dark:text-gray-400 col-span-2">No checkable items in the verify scope.</p>
              )}
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

const SiteShieldAudit: React.FC = () => {
  const navigate = useNavigate();
  const token = localStorage.getItem("token");

  const [url, setUrl] = useState("");
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<AuditResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [stepsDone, setStepsDone] = useState<number>(0);
  const [profileImage] = useState("");
  const [sidebarExpanded, setSidebarExpanded] = useState(true);
  const [history, setHistory] = useState<AuditResult[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [expandedHistoryId, setExpandedHistoryId] = useState<string | null>(null);
  const [pdfGenerating, setPdfGenerating] = useState(false);


  const fetchHistory = async () => {
    setHistoryLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/site-audit/history`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.ok) {
        const data = await res.json();
        setHistory(data.logs || []);
      }
    } catch (_) {}
    finally { setHistoryLoading(false); }
  };

  useEffect(() => { fetchHistory(); }, []);

  // Animate steps progressing while waiting for the backend
  useEffect(() => {
    if (!scanning) { setStepsDone(0); return; }
    setStepsDone(0);
    const interval = setInterval(() => {
      setStepsDone((prev) => {
        if (prev >= SCAN_STEPS.length - 1) { clearInterval(interval); return prev; }
        return prev + 1;
      });
    }, 900);
    return () => clearInterval(interval);
  }, [scanning]);

  const handleAudit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;

    setScanning(true);
    setResult(null);
    setError(null);

    try {
      const res = await fetch(`${API_BASE_URL}/site-audit`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ url: url.trim() }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Audit failed. Please try again.");
      } else {
        setResult(data as AuditResult);
        fetchHistory();
      }
    } catch (err) {
      setError("Could not reach the server. Please check your connection.");
    } finally {
      setScanning(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    navigate("/");
  };

  const criticalCount = result?.findings.filter((f) => f.severity === "critical").length ?? 0;
  const warningCount  = result?.findings.filter((f) => f.severity === "warning").length ?? 0;
  const infoCount     = result?.findings.filter((f) => f.severity === "info").length ?? 0;

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <title>SiteShield Audit — Seekurify</title>

      <Header
        token={token || ""}
        handleLogout={handleLogout}
        profileImage={profileImage}
      />

      <div className="flex flex-1 overflow-hidden">
        <AppSidebar sidebarExpanded={sidebarExpanded} setSidebarExpanded={setSidebarExpanded} />

        {/* Scrollable main content */}
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-4xl mx-auto px-6 py-10">
        {/* Page title */}
        <motion.div
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <div className="inline-flex items-center gap-3 mb-3">
            <ShieldCheck className="w-10 h-10 text-amber-400" />
            <h1 className="text-4xl font-extrabold text-white">SiteShield Audit</h1>
          </div>
          <p className="text-gray-400 text-lg">
            One-click website security scan — SSL, headers, blacklists, DNS, exposed paths & more.
          </p>
        </motion.div>

        {/* URL input */}
        <motion.form
          onSubmit={handleAudit}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="flex gap-3 mb-8"
        >
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="example.com or https://example.com"
              disabled={scanning}
              className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-sm focus:outline-none focus:ring-2 focus:ring-amber-400 disabled:opacity-60 transition"
            />
          </div>
          <button
            type="submit"
            disabled={scanning || !url.trim()}
            className="flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-slate-900 font-semibold px-6 py-3 rounded-xl shadow-md disabled:opacity-50 transition hover:scale-105 active:scale-95"
          >
            {scanning ? <Loader2 className="w-5 h-5 animate-spin" /> : <ShieldAlert className="w-5 h-5" />}
            {scanning ? "Scanning…" : "Run Audit"}
          </button>
        </motion.form>

        {/* Error */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mb-6 p-4 rounded-xl bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 text-red-700 dark:text-red-300 flex items-center gap-2"
            >
              <XCircle className="w-5 h-5 flex-shrink-0" />
              {error}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Scanning animation */}
        <AnimatePresence>
          {scanning && (
            <motion.div
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 p-8 mb-8"
            >
              <div className="flex items-center gap-3 mb-6">
                <Loader2 className="w-6 h-6 text-amber-500 animate-spin" />
                <span className="text-lg font-semibold text-gray-800 dark:text-gray-100">
                  Auditing <span className="text-amber-500 font-mono">{url}</span>…
                </span>
              </div>
              <div className="space-y-3">
                {SCAN_STEPS.map((step, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.15 }}
                    className="flex items-center gap-3"
                  >
                    <div className={`transition-colors duration-300 ${i <= stepsDone ? "text-amber-500" : "text-gray-300 dark:text-gray-600"}`}>
                      {i < stepsDone ? <CheckCircle className="w-5 h-5 text-green-500" /> : i === stepsDone ? <Loader2 className="w-5 h-5 animate-spin" /> : step.icon}
                    </div>
                    <span className={`text-sm transition-colors duration-300 ${i <= stepsDone ? "text-gray-800 dark:text-gray-200" : "text-gray-400 dark:text-gray-500"}`}>
                      {step.label}
                    </span>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Results */}
        <AnimatePresence>
          {result && !scanning && (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="space-y-6"
            >
              {/* Score header */}
              <div className={`rounded-2xl border-2 p-6 flex flex-col md:flex-row items-center gap-6 ${gradeBg(result.grade)}`}>
                {/* Grade circle */}
                <div className="flex-shrink-0 text-center">
                  <div className={`text-7xl font-black leading-none ${gradeColor(result.grade)}`}>
                    {result.grade}
                  </div>
                  <div className="text-2xl font-bold text-gray-700 dark:text-gray-300 mt-1">
                    {result.score} / 100
                  </div>
                </div>

                {/* Summary */}
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <ExternalLink className="w-4 h-4 text-gray-500" />
                    <a
                      href={result.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-amber-500 dark:text-amber-400 font-semibold hover:underline break-all"
                    >
                      {result.url}
                    </a>
                  </div>
                  <p className="text-xs text-gray-400 mb-4">
                    Audited {new Date(result.timestamp).toLocaleString()}
                  </p>

                  <div className="flex flex-wrap gap-3">
                    {criticalCount > 0 && (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300 text-sm font-semibold">
                        <XCircle className="w-4 h-4" /> {criticalCount} Critical
                      </span>
                    )}
                    {warningCount > 0 && (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300 text-sm font-semibold">
                        <AlertTriangle className="w-4 h-4" /> {warningCount} Warning
                      </span>
                    )}
                    {infoCount > 0 && (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 text-sm font-semibold">
                        <Info className="w-4 h-4" /> {infoCount} Info
                      </span>
                    )}
                    {result.findings.length === 0 && (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300 text-sm font-semibold">
                        <ShieldCheck className="w-4 h-4" /> No issues found
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 flex-shrink-0">
                  {/* Download PDF */}
                  <button
                    onClick={() => {
                      setPdfGenerating(true);
                      try { downloadAuditPDF(result); }
                      finally { setPdfGenerating(false); }
                    }}
                    disabled={pdfGenerating}
                    className="flex items-center gap-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-900 font-semibold px-5 py-2.5 rounded-xl shadow transition hover:scale-105 active:scale-95"
                  >
                    {pdfGenerating
                      ? <Loader2 className="w-4 h-4 animate-spin" />
                      : <FileSearch className="w-4 h-4" />}
                    {pdfGenerating ? "Generating…" : "Download Report"}
                  </button>

                  {/* Ask Nick button */}
                  <button
                    onClick={() => navigate("/ask")}
                    className="flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-slate-900 font-semibold px-5 py-2.5 rounded-xl shadow transition hover:scale-105"
                  >
                    <MessageCircle className="w-4 h-4" />
                    Ask Nick
                  </button>
                </div>
              </div>

              {/* Findings list — with explain + fix */}
              {result.findings.length > 0 && (
                <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-md border border-gray-200 dark:border-gray-700 p-5">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="font-bold text-gray-800 dark:text-gray-100 text-lg">All Findings</h2>
                    <button
                      onClick={() => navigate("/csp-builder")}
                      className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 hover:bg-amber-200 dark:hover:bg-amber-800/50 transition"
                    >
                      <Shield className="w-3.5 h-3.5" /> CSP Builder
                    </button>
                  </div>
                  <div className="space-y-3">
                    {result.findings.map((f, i) => (
                      <FindingCard key={i} finding={f} />
                    ))}
                  </div>
                </div>
              )}

              {/* PatchPath: stack-aware fix generator */}
              {result.fixes && result.stack && (
                <PatchPathPanel
                  fixes={result.fixes}
                  stack={result.stack}
                  url={result.url}
                  apiBase={API_BASE_URL}
                />
              )}

              {/* SSL/TLS */}
              <SectionCard title="SSL / TLS Certificate" icon={<Lock className="w-5 h-5" />}>
                <div className="pt-4 space-y-3">
                  {result.ssl.error ? (
                    <p className="text-red-500 text-sm">{result.ssl.error}</p>
                  ) : (
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <span className="text-gray-500 dark:text-gray-400">Valid</span>
                        <div className="mt-1"><StatusBadge ok={!!result.ssl.valid} /></div>
                      </div>
                      <div>
                        <span className="text-gray-500 dark:text-gray-400">Grade</span>
                        <div className={`mt-1 text-2xl font-black ${gradeColor(result.ssl.grade || "F")}`}>{result.ssl.grade}</div>
                      </div>
                      <div>
                        <span className="text-gray-500 dark:text-gray-400">Issued to</span>
                        <div className="mt-1 font-mono text-gray-800 dark:text-gray-200 text-xs">{result.ssl.subject || "—"}</div>
                      </div>
                      <div>
                        <span className="text-gray-500 dark:text-gray-400">Issuer</span>
                        <div className="mt-1 font-mono text-gray-800 dark:text-gray-200 text-xs">{result.ssl.issuer || "—"}</div>
                      </div>
                      <div>
                        <span className="text-gray-500 dark:text-gray-400">Expires</span>
                        <div className="mt-1 text-gray-800 dark:text-gray-200 text-xs">{result.ssl.validTo || "—"}</div>
                      </div>
                      <div>
                        <span className="text-gray-500 dark:text-gray-400">Days left</span>
                        <div className={`mt-1 font-bold text-sm ${(result.ssl.daysLeft ?? 0) < 30 ? "text-red-500" : "text-green-600 dark:text-green-400"}`}>
                          {result.ssl.daysLeft !== undefined ? result.ssl.daysLeft : "—"}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </SectionCard>

              {/* Security Headers */}
              <SectionCard title="Security Headers" icon={<Shield className="w-5 h-5" />}>
                <div className="pt-4">
                  {result.headers.error ? (
                    <p className="text-red-500 text-sm">{result.headers.error}</p>
                  ) : (
                    <div>
                      <HeaderRow label="Content-Security-Policy" value={result.headers.raw?.csp ?? null} present={!!result.headers.csp} />
                      <HeaderRow label="Strict-Transport-Security" value={result.headers.raw?.hsts ?? null} present={!!result.headers.hsts} />
                      <HeaderRow label="X-Frame-Options" value={result.headers.raw?.xFrameOptions ?? null} present={!!result.headers.xFrameOptions} />
                      <HeaderRow label="X-Content-Type-Options" value={result.headers.raw?.xContentTypeOptions ?? null} present={!!result.headers.xContentTypeOptions} />
                      <HeaderRow label="Referrer-Policy" value={result.headers.raw?.referrerPolicy ?? null} present={!!result.headers.referrerPolicy} />
                      <HeaderRow label="Permissions-Policy" value={null} present={!!result.headers.permissionsPolicy} />
                    </div>
                  )}
                </div>
              </SectionCard>

              {/* Blacklist */}
              <SectionCard title="Blacklist / Safe Browsing" icon={<Globe className="w-5 h-5" />}>
                <div className="pt-4">
                  {result.blacklist.skipped ? (
                    <p className="text-sm text-gray-400 dark:text-gray-500">
                      Google Safe Browsing check skipped — add <span className="font-mono">GOOGLE_SAFE_BROWSING_API_KEY</span> to enable.
                    </p>
                  ) : result.blacklist.error ? (
                    <p className="text-yellow-600 dark:text-yellow-400 text-sm">{result.blacklist.error}</p>
                  ) : (
                    <div className="flex items-center gap-3">
                      <StatusBadge ok={!result.blacklist.blacklisted} trueLabel="Clean" falseLabel="Flagged" />
                      {result.blacklist.blacklisted && result.blacklist.threats && (
                        <span className="text-sm text-red-600 dark:text-red-400">
                          {result.blacklist.threats.join(", ")}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </SectionCard>

              {/* DNS */}
              <SectionCard title="DNS — SPF & DMARC" icon={<Mail className="w-5 h-5" />}>
                <div className="pt-4 space-y-4">
                  <div>
                    <div className="flex items-center gap-3 mb-1">
                      <span className="font-mono text-sm text-gray-700 dark:text-gray-300">SPF</span>
                      <StatusBadge ok={!!result.dns.spf} />
                    </div>
                    {result.dns.spfRecord && (
                      <p className="text-xs font-mono text-gray-400 dark:text-gray-500 break-all">{result.dns.spfRecord}</p>
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-3 mb-1">
                      <span className="font-mono text-sm text-gray-700 dark:text-gray-300">DMARC</span>
                      <StatusBadge ok={!!result.dns.dmarc} />
                    </div>
                    {result.dns.dmarcRecord && (
                      <p className="text-xs font-mono text-gray-400 dark:text-gray-500 break-all">{result.dns.dmarcRecord}</p>
                    )}
                  </div>
                </div>
              </SectionCard>

              {/* Exposed Paths */}
              <SectionCard title="Exposed Sensitive Paths" icon={<FolderOpen className="w-5 h-5" />}>
                <div className="pt-4">
                  {Array.isArray(result.exposedPaths) && result.exposedPaths.length === 0 ? (
                    <div className="flex items-center gap-2 text-green-600 dark:text-green-400 text-sm">
                      <CheckCircle className="w-4 h-4" /> No exposed paths detected.
                    </div>
                  ) : (
                    <div className="space-y-1">
                      {(result.exposedPaths as ExposedPath[]).map((ep, i) => (
                        <div key={i} className="flex items-center gap-2 text-sm">
                          <XCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                          <span className="font-mono text-red-600 dark:text-red-400">{ep.path}</span>
                          <span className="text-gray-400 text-xs">HTTP {ep.status}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </SectionCard>

              {/* Mixed Content */}
              <SectionCard title="Mixed Content" icon={<Server className="w-5 h-5" />}>
                <div className="pt-4">
                  {result.mixedContent.error ? (
                    <p className="text-yellow-600 dark:text-yellow-400 text-sm">{result.mixedContent.error}</p>
                  ) : result.mixedContent.hasMixedContent ? (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-red-600 dark:text-red-400 text-sm">
                        <AlertTriangle className="w-4 h-4" />
                        {result.mixedContent.count} insecure resource(s) loaded over HTTP on this HTTPS page.
                      </div>
                      {result.mixedContent.elements && result.mixedContent.elements.length > 0 && (
                        <div className="space-y-1.5 mt-2">
                          {result.mixedContent.elements.map((el, i) => (
                            <div key={i} className="bg-red-50 dark:bg-red-900/20 rounded-lg px-3 py-2 text-xs font-mono">
                              <span className="text-gray-400 mr-2">Line {el.lineNumber}:</span>
                              <span className="text-red-600 dark:text-red-400 break-all">{el.element.slice(0, 120)}</span>
                              <div className="text-green-600 dark:text-green-400 mt-0.5">→ {el.fix}</div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-green-600 dark:text-green-400 text-sm">
                      <CheckCircle className="w-4 h-4" /> No mixed content detected.
                    </div>
                  )}
                </div>
              </SectionCard>

              {/* Ask Nick CTA */}
              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-2xl p-5 flex flex-col md:flex-row items-center gap-4">
                <div className="flex-1">
                  <p className="font-semibold text-amber-800 dark:text-amber-200">Not sure what these findings mean?</p>
                  <p className="text-sm text-amber-600 dark:text-amber-400 mt-1">
                    Ask Nick — Seekurify's AI assistant — for plain-English explanations and step-by-step fixes.
                  </p>
                </div>
                <button
                  onClick={() => navigate("/ask")}
                  className="flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-slate-900 font-semibold px-5 py-2.5 rounded-xl shadow transition hover:scale-105 flex-shrink-0"
                >
                  <MessageCircle className="w-4 h-4" />
                  Ask Nick
                </button>
              </div>

              {/* CI/CD Webhooks */}
              <WebhookManager apiBase={API_BASE_URL} token={token || ""} />
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Audit History ─────────────────────────────────────────────── */}
        {(history.length > 0 || historyLoading) && (
          <div className="mt-12">
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <Server className="w-5 h-5 text-amber-500" />
              Audit History
            </h2>

            {historyLoading && history.length === 0 ? (
              <div className="flex items-center gap-2 text-gray-400 text-sm py-4">
                <Loader2 className="w-4 h-4 animate-spin" /> Loading history…
              </div>
            ) : (
              <div className="space-y-3">
                {(history as any[]).map((log: any) => {
                  const id = log._id ?? log.id ?? log.createdAt;
                  const isExpanded = expandedHistoryId === id;
                  const critical = (log.findings ?? []).filter((f: any) => f.severity === "critical").length;
                  const warning  = (log.findings ?? []).filter((f: any) => f.severity === "warning").length;

                  return (
                    <div
                      key={id}
                      className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden"
                    >
                      {/* Row */}
                      <button
                        onClick={() => setExpandedHistoryId(isExpanded ? null : id)}
                        className="w-full flex items-center gap-4 px-5 py-4 text-left hover:bg-gray-50 dark:hover:bg-gray-700/40 transition"
                      >
                        {/* Grade badge */}
                        <span className={`text-2xl font-black w-8 text-center flex-shrink-0 ${gradeColor(log.grade)}`}>
                          {log.grade}
                        </span>

                        {/* Score bar */}
                        <div className="flex-shrink-0 w-16">
                          <div className="text-xs text-gray-400 mb-0.5 text-right">{log.score}/100</div>
                          <div className="h-1.5 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
                            <div
                              className={`h-full rounded-full ${
                                log.score >= 75 ? "bg-green-500" : log.score >= 50 ? "bg-yellow-500" : "bg-red-500"
                              }`}
                              style={{ width: `${log.score}%` }}
                            />
                          </div>
                        </div>

                        {/* URL */}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-800 dark:text-gray-100 truncate">{log.url}</p>
                          <p className="text-xs text-gray-400">
                            {new Date(log.createdAt).toLocaleString()}
                          </p>
                        </div>

                        {/* Severity chips */}
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {critical > 0 && (
                            <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300 font-semibold">
                              <XCircle className="w-3 h-3" />{critical}
                            </span>
                          )}
                          {warning > 0 && (
                            <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300 font-semibold">
                              <AlertTriangle className="w-3 h-3" />{warning}
                            </span>
                          )}
                          {critical === 0 && warning === 0 && (
                            <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300 font-semibold">
                              <CheckCircle className="w-3 h-3" /> Clean
                            </span>
                          )}
                        </div>

                        {/* Chevron */}
                        {isExpanded
                          ? <ChevronUp className="w-4 h-4 text-gray-400 flex-shrink-0" />
                          : <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />}
                      </button>

                      {/* Expanded findings */}
                      <AnimatePresence initial={false}>
                        {isExpanded && (
                          <motion.div
                            key="hist-detail"
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="overflow-hidden"
                          >
                            <div className="px-5 pb-5 border-t border-gray-100 dark:border-gray-700 pt-4 space-y-2">
                              {log.findings.length === 0 ? (
                                <p className="text-sm text-green-600 dark:text-green-400 flex items-center gap-1">
                                  <CheckCircle className="w-4 h-4" /> No issues found in this audit.
                                </p>
                              ) : (
                                log.findings.map((f: any, i: number) => (
                                  <div key={i} className="flex items-start gap-2 text-sm">
                                    {severityIcon(f.severity)}
                                    <span className={`text-xs font-semibold px-1.5 py-0.5 rounded mr-1 flex-shrink-0 ${severityBadge(f.severity)}`}>
                                      {f.category}
                                    </span>
                                    <span className="text-gray-700 dark:text-gray-300">{f.message}</span>
                                  </div>
                                ))
                              )}

                              {/* Quick SSL / Blacklist badges */}
                              <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-100 dark:border-gray-700 mt-2">
                                {log.ssl && (
                                  <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${log.ssl.valid ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300" : "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300"}`}>
                                    SSL {log.ssl.grade ?? (log.ssl.valid ? "✓" : "✗")}
                                    {log.ssl.daysLeft !== undefined ? ` · ${log.ssl.daysLeft}d left` : ""}
                                  </span>
                                )}
                                {log.blacklist && !log.blacklist.skipped && (
                                  <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${log.blacklist.blacklisted ? "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300" : "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300"}`}>
                                    Blacklist {log.blacklist.blacklisted ? "⚠ Flagged" : "✓ Clean"}
                                  </span>
                                )}
                              </div>
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

          </div>{/* inner content wrapper */}
        </main>
      </div>{/* flex row: sidebar + main */}

      <Footer />
    </div>
  );
};

export default SiteShieldAudit;
