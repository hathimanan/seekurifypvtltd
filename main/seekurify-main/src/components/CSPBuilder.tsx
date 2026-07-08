import React, { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Shield, ShieldCheck, Search, Loader2, Copy, CheckCheck,
  AlertTriangle, CheckCircle, Info, ChevronDown, ChevronUp,
  Code2, Globe, Zap, Lock,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { API_BASE_URL } from "../services/api";
import Header from "./ui/Header";
import Footer from "./ui/Footer";
import AppSidebar from "./ui/AppSidebar";

// ─── Types ────────────────────────────────────────────────────────────────────
interface CSPSources {
  "script-src":  string[];
  "style-src":   string[];
  "img-src":     string[];
  "font-src":    string[];
  "frame-src":   string[];
  "connect-src": string[];
  "media-src":   string[];
}

interface Recommendation {
  directive: string;
  level: "success" | "warning" | "info";
  note: string;
}

interface CSPResult {
  url: string;
  hostname: string;
  sources: CSPSources;
  hasInlineScript: boolean;
  hasInlineStyle: boolean;
  policy: string;
  analysis: {
    recommendations: Recommendation[];
    riskLevel: "strict" | "moderate" | "permissive";
  };
}

interface PolicyOptions {
  unsafeInline: boolean;
  unsafeEval:   boolean;
  strictDynamic:boolean;
  reportOnly:   boolean;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
const DIRECTIVE_LABELS: Record<string, string> = {
  "script-src":  "Scripts",
  "style-src":   "Stylesheets",
  "img-src":     "Images",
  "font-src":    "Fonts",
  "frame-src":   "Iframes",
  "connect-src": "Fetch / XHR",
  "media-src":   "Media",
};

const RISK_COLORS = {
  strict:      "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
  moderate:    "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300",
  permissive:  "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
};

const REC_ICONS = {
  success: <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />,
  warning: <AlertTriangle className="w-4 h-4 text-yellow-500 flex-shrink-0" />,
  info:    <Info className="w-4 h-4 text-blue-500 flex-shrink-0" />,
};

type PlatformKey = "nginx" | "apache" | "vercel" | "netlify" | "cloudflare" | "meta";

function buildDeploySnippets(headerName: string, policy: string): Record<PlatformKey, string> {
  return {
    nginx:      `# Nginx — paste inside server {} block\nadd_header ${headerName} "${policy}" always;`,
    apache:     `# Apache — .htaccess or httpd.conf\n<IfModule mod_headers.c>\n    Header always set ${headerName} "${policy}"\n</IfModule>`,
    vercel:     JSON.stringify({ headers: [{ source: "/(.*)", headers: [{ key: headerName, value: policy }] }] }, null, 2),
    netlify:    `# _headers file\n/*\n  ${headerName}: ${policy}`,
    cloudflare: `# Cloudflare → Rules → Transform Rules → Response Header Modification\nSet: ${headerName} = "${policy}"`,
    meta:       `<!-- HTML <head> fallback (limited browser support) -->\n<meta http-equiv="${headerName}"\n      content="${policy}">`,
  };
}

function CopyBtn({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); setDone(true); setTimeout(() => setDone(false), 2000); }}
      className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 transition"
    >
      {done ? <CheckCheck className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
      {done ? "Copied!" : "Copy"}
    </button>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
const CSPBuilder: React.FC = () => {
  const navigate  = useNavigate();
  const token     = localStorage.getItem("token");
  const [profileImage] = useState("");
  const [sidebarExpanded, setSidebarExpanded] = useState(true);

  const [url,        setUrl]        = useState("");
  const [loading,    setLoading]    = useState(false);
  const [result,     setResult]     = useState<CSPResult | null>(null);
  const [error,      setError]      = useState<string | null>(null);
  const [opts,       setOpts]       = useState<PolicyOptions>({ unsafeInline: false, unsafeEval: false, strictDynamic: false, reportOnly: false });
  const [livePolicy, setLivePolicy] = useState<string>("");
  const [activeTab,  setActiveTab]  = useState<PlatformKey>("nginx");
  const [openSources, setOpenSources] = useState(false);

  const handleLogout = () => { localStorage.removeItem("token"); navigate("/"); };

  const runBuild = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;
    setLoading(true); setResult(null); setError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/csp-builder`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim(), options: opts }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Build failed");
      setResult(data as CSPResult);
      setLivePolicy(data.policy);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Build failed");
    } finally {
      setLoading(false);
    }
  };

  const recomputePolicy = useCallback(async (newOpts: PolicyOptions) => {
    if (!result) return;
    try {
      const res = await fetch(`${API_BASE_URL}/csp-builder/policy`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sources: result.sources, pageOrigin: `https://${result.hostname}`, options: newOpts }),
      });
      const data = await res.json();
      if (data.policy) setLivePolicy(data.policy);
    } catch (_) {}
  }, [result]);

  const toggleOpt = (key: keyof PolicyOptions) => {
    const next = { ...opts, [key]: !opts[key] };
    setOpts(next);
    recomputePolicy(next);
  };

  const headerName = opts.reportOnly ? "Content-Security-Policy-Report-Only" : "Content-Security-Policy";
  const deploySnippets = livePolicy ? buildDeploySnippets(headerName, livePolicy) : null;

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <title>CSP Builder — Seekurify</title>
      <Header token={token || ""} handleLogout={handleLogout} profileImage={profileImage} />


      <div className="flex flex-1 overflow-hidden">
        <AppSidebar sidebarExpanded={sidebarExpanded} setSidebarExpanded={setSidebarExpanded} />
        <main className="flex-1 overflow-y-auto max-w-3xl mx-auto w-full px-6 py-10">

        {/* Hero */}
        <motion.div initial={{ opacity: 0, y: -14 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-10">
          <div className="inline-flex items-center gap-3 mb-3">
            <ShieldCheck className="w-11 h-11 text-amber-400" />
            <h1 className="text-4xl font-extrabold text-white">CSP Builder</h1>
          </div>
          <p className="text-gray-400 text-lg max-w-xl mx-auto">
            Paste a URL. We crawl every script, style, font, and frame your page actually loads,
            then generate a <strong>Content-Security-Policy that won't break your site</strong>.
          </p>
          <div className="flex justify-center gap-6 mt-4 text-sm text-gray-500">
            <span className="flex items-center gap-1"><Globe className="w-4 h-4" /> Passive — no install</span>
            <span className="flex items-center gap-1"><Zap className="w-4 h-4" /> Live toggle sandbox</span>
            <span className="flex items-center gap-1"><Lock className="w-4 h-4" /> Platform-specific deploy code</span>
          </div>
        </motion.div>

        {/* URL Form */}
        <form onSubmit={runBuild} className="flex gap-3 mb-8">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input type="text" value={url} onChange={e => setUrl(e.target.value)}
              placeholder="https://yoursite.com" disabled={loading}
              className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-sm focus:outline-none focus:ring-2 focus:ring-amber-400 disabled:opacity-60 transition" />
          </div>
          <button type="submit" disabled={loading || !url.trim()}
            className="flex items-center gap-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-900 font-semibold px-6 py-3 rounded-xl shadow-md transition hover:scale-105 active:scale-95">
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Code2 className="w-5 h-5" />}
            {loading ? "Building…" : "Build CSP"}
          </button>
        </form>

        {error && (
          <div className="mb-6 p-4 rounded-xl bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 text-red-700 dark:text-red-300 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 flex-shrink-0" /> {error}
          </div>
        )}

        <AnimatePresence>
        {result && (
          <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-6">

            {/* ── Policy Output + Toggles ── */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-md border border-violet-200 dark:border-violet-800 overflow-hidden">
              <div className="px-5 py-4 bg-amber-50 dark:bg-amber-900/30 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Shield className="w-5 h-5 text-amber-600" />
                  <span className="font-bold text-amber-900 dark:text-amber-100">Generated Policy</span>
                </div>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${RISK_COLORS[result.analysis.riskLevel]}`}>
                  {result.analysis.riskLevel.toUpperCase()} restriction
                </span>
              </div>

              <div className="px-5 py-4 space-y-4">
                {/* Policy string */}
                <div className="relative">
                  <div className="absolute top-2 right-2 z-10"><CopyBtn text={livePolicy} /></div>
                  <pre className="bg-gray-900 text-green-300 text-xs rounded-xl p-4 pr-20 overflow-x-auto leading-relaxed whitespace-pre-wrap font-mono">
                    {headerName}: {livePolicy}
                  </pre>
                </div>

                {/* Toggle sandbox */}
                <div>
                  <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-3 uppercase tracking-wide">Sandbox — toggle directives live</p>
                  <div className="grid grid-cols-2 gap-3">
                    {([
                      { key: "unsafeInline",  label: "'unsafe-inline'",  desc: "Required if page has inline <script> or style= tags" },
                      { key: "unsafeEval",    label: "'unsafe-eval'",    desc: "Required by Angular, some bundlers, or eval() calls" },
                      { key: "strictDynamic", label: "'strict-dynamic'", desc: "Best practice for nonce-based policies (ignores allowlists)" },
                      { key: "reportOnly",    label: "Report-Only mode",  desc: "Use CSP-Report-Only header — monitor without blocking" },
                    ] as { key: keyof PolicyOptions; label: string; desc: string }[]).map(({ key, label, desc }) => (
                      <button key={key} onClick={() => toggleOpt(key)}
                        className={`text-left p-3 rounded-xl border-2 transition ${opts[key] ? "border-amber-500 bg-amber-50 dark:bg-amber-900/30" : "border-gray-200 dark:border-gray-600 hover:border-amber-300"}`}>
                        <div className="flex items-center justify-between mb-0.5">
                          <span className="text-xs font-mono font-bold text-gray-800 dark:text-gray-200">{label}</span>
                          <span className={`w-4 h-4 rounded-full border-2 flex-shrink-0 ${opts[key] ? "bg-amber-500 border-amber-500" : "border-gray-300"}`} />
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{desc}</p>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* ── Source Breakdown ── */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-md border border-gray-200 dark:border-gray-700 overflow-hidden">
              <button onClick={() => setOpenSources(o => !o)}
                className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition">
                <div className="flex items-center gap-2 font-semibold text-gray-800 dark:text-gray-100">
                  <Globe className="w-4 h-4 text-amber-500" />
                  Sources detected on {result.hostname}
                </div>
                {openSources ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
              </button>
              <AnimatePresence initial={false}>
              {openSources && (
                <motion.div key="src" initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                  <div className="px-5 pb-5 border-t border-gray-100 dark:border-gray-700 pt-4 space-y-3">
                    {(Object.entries(result.sources) as [string, string[]][])
                      .filter(([, srcs]) => srcs.length > 0)
                      .map(([directive, srcs]) => (
                        <div key={directive}>
                          <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">
                            {DIRECTIVE_LABELS[directive] ?? directive}
                          </p>
                          <div className="flex flex-wrap gap-1.5">
                            {srcs.map(s => (
                              <span key={s} className="text-xs font-mono px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                                {s}
                              </span>
                            ))}
                          </div>
                        </div>
                      ))}
                    {result.hasInlineScript && (
                      <p className="text-xs text-yellow-600 dark:text-yellow-400 flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" /> Inline &lt;script&gt; tags detected — consider nonce-based CSP for production
                      </p>
                    )}
                    {result.hasInlineStyle && (
                      <p className="text-xs text-blue-600 dark:text-blue-400 flex items-center gap-1">
                        <Info className="w-3 h-3" /> Inline styles detected — 'unsafe-inline' may be needed in style-src
                      </p>
                    )}
                    {Object.values(result.sources).every(s => s.length === 0) && (
                      <p className="text-sm text-green-600 dark:text-green-400 flex items-center gap-2">
                        <CheckCircle className="w-4 h-4" /> No external sources detected — this page can use a very strict policy.
                      </p>
                    )}
                  </div>
                </motion.div>
              )}
              </AnimatePresence>
            </div>

            {/* ── Recommendations ── */}
            {result.analysis.recommendations.length > 0 && (
              <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-md border border-gray-200 dark:border-gray-700 p-5">
                <h3 className="font-bold text-gray-800 dark:text-gray-100 mb-3 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-amber-500" /> Recommendations
                </h3>
                <div className="space-y-3">
                  {result.analysis.recommendations.map((r, i) => (
                    <div key={i} className="flex items-start gap-2">
                      {REC_ICONS[r.level]}
                      <p className="text-sm text-gray-700 dark:text-gray-300">{r.note}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── Deploy Instructions ── */}
            {deploySnippets && (
              <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-md border border-gray-200 dark:border-gray-700 overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700">
                  <h3 className="font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
                    <Code2 className="w-4 h-4 text-amber-500" /> Deploy to your platform
                  </h3>
                </div>
                <div className="px-5 py-4">
                  <div className="flex gap-1.5 flex-wrap mb-4">
                    {(["nginx","apache","vercel","netlify","cloudflare","meta"] as PlatformKey[]).map(k => (
                      <button key={k} onClick={() => setActiveTab(k)}
                        className={`text-xs px-3 py-1.5 rounded-lg font-mono font-semibold transition ${activeTab === k ? "bg-amber-500 text-slate-900 shadow" : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:border-amber-400 border border-transparent"}`}>
                        {k}
                      </button>
                    ))}
                  </div>
                  <div className="relative">
                    <div className="absolute top-2 right-2 z-10"><CopyBtn text={deploySnippets[activeTab]} /></div>
                    <pre className="bg-gray-900 text-green-300 text-xs rounded-xl p-4 pr-20 overflow-x-auto leading-relaxed whitespace-pre-wrap font-mono">
                      {deploySnippets[activeTab]}
                    </pre>
                  </div>
                </div>
              </div>
            )}

          </motion.div>
        )}
        </AnimatePresence>
      </main>
      </div>
      <Footer />
    </div>
  );
};

export default CSPBuilder;
