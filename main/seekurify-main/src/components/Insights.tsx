import React from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ShieldAlert, AlertTriangle, Lock, Globe, Activity,
  TrendingUp, Zap, Eye, Brain, Clock, DollarSign,
  Mail, KeyRound, Server, Users, Building2, GraduationCap,
  Landmark, ShoppingCart, ChevronRight, ArrowLeft, Home,
} from "lucide-react";

// ─── Data ────────────────────────────────────────────────────────────────────

const GLOBAL_STATS = [
  {
    icon: Zap,
    color: "text-red-500",
    bg: "bg-red-50 dark:bg-red-950/40",
    border: "border-red-200 dark:border-red-800",
    number: "11s",
    label: "A cyberattack occurs every",
    sub: "seconds globally",
  },
  {
    icon: DollarSign,
    color: "text-amber-500",
    bg: "bg-amber-50 dark:bg-amber-950/40",
    border: "border-amber-200 dark:border-amber-800",
    number: "$4.45M",
    label: "Average data breach cost",
    sub: "IBM Cost of a Data Breach 2024",
  },
  {
    icon: AlertTriangle,
    color: "text-orange-500",
    bg: "bg-orange-50 dark:bg-orange-950/40",
    border: "border-orange-200 dark:border-orange-800",
    number: "80%",
    label: "Breaches involve",
    sub: "human error or misuse",
  },
  {
    icon: Mail,
    color: "text-blue-500",
    bg: "bg-blue-50 dark:bg-blue-950/40",
    border: "border-blue-200 dark:border-blue-800",
    number: "3.4B",
    label: "Phishing emails sent",
    sub: "every single day",
  },
  {
    icon: Globe,
    color: "text-indigo-500",
    bg: "bg-indigo-50 dark:bg-indigo-950/40",
    border: "border-indigo-200 dark:border-indigo-800",
    number: "2,200+",
    label: "Attacks happen",
    sub: "daily worldwide",
  },
  {
    icon: Lock,
    color: "text-purple-500",
    bg: "bg-purple-50 dark:bg-purple-950/40",
    border: "border-purple-200 dark:border-purple-800",
    number: "328M",
    label: "Unique malware samples",
    sub: "identified in 2024",
  },
];

const ATTACK_VECTORS = [
  { label: "Phishing & Social Engineering", pct: 36, color: "bg-red-500" },
  { label: "Ransomware", pct: 24, color: "bg-orange-500" },
  { label: "Credential Theft & Stuffing", pct: 18, color: "bg-amber-500" },
  { label: "Supply Chain Compromise", pct: 12, color: "bg-blue-500" },
  { label: "Zero-Day Exploits", pct: 10, color: "bg-purple-500" },
];

const TARGETED_INDUSTRIES = [
  { label: "Healthcare", icon: Building2, pct: 35, color: "bg-rose-500" },
  { label: "Financial Services", icon: Landmark, pct: 28, color: "bg-amber-500" },
  { label: "Education", icon: GraduationCap, pct: 22, color: "bg-blue-500" },
  { label: "Government", icon: Building2, pct: 18, color: "bg-indigo-500" },
  { label: "Retail & E-Commerce", icon: ShoppingCart, pct: 15, color: "bg-emerald-500" },
];

const AI_THREATS = [
  {
    icon: Brain,
    color: "from-rose-500 to-pink-600",
    title: "AI-Generated Phishing",
    stat: "+856% YoY",
    desc: "LLMs are being used to craft hyper-personalised phishing emails that bypass traditional spam filters with near-perfect grammar and context.",
  },
  {
    icon: Eye,
    color: "from-orange-500 to-amber-600",
    title: "Deepfake Fraud",
    stat: "+3,000% YoY",
    desc: "Synthetic audio and video deepfakes are being used to impersonate executives in fraud calls and bypass KYC verification systems.",
  },
  {
    icon: ShieldAlert,
    color: "from-purple-500 to-indigo-600",
    title: "Prompt Injection Attacks",
    stat: "Fastest growing",
    desc: "Adversarial inputs embedded in external content manipulate LLM-powered agents into leaking data, bypassing guardrails, or executing unintended actions.",
  },
  {
    icon: Server,
    color: "from-blue-500 to-cyan-600",
    title: "AI-Powered Credential Stuffing",
    stat: "40B attempts/day",
    desc: "Attackers are using ML models to prioritise credential pairs most likely to succeed, dramatically increasing breach rates on reused passwords.",
  },
  {
    icon: Users,
    color: "from-emerald-500 to-teal-600",
    title: "Synthetic Identity Fraud",
    stat: "$6B annual loss",
    desc: "AI-generated identities combining real and fabricated data are used to open accounts, pass verification, and commit financial fraud at scale.",
  },
  {
    icon: KeyRound,
    color: "from-red-500 to-rose-600",
    title: "LLM Data Exfiltration",
    stat: "Critical severity",
    desc: "Attackers are manipulating RAG pipelines and agentic systems to extract sensitive training data, system prompts, and internal knowledge bases.",
  },
];

const RESPONSE_METRICS = [
  {
    label: "Mean Time to Detect (MTTD)",
    value: "204 days",
    sub: "Industry average to identify a breach",
    color: "text-red-500",
    bg: "bg-red-50 dark:bg-red-950/40",
    border: "border-l-4 border-red-400",
  },
  {
    label: "Mean Time to Respond (MTTR)",
    value: "73 days",
    sub: "After detection to full containment",
    color: "text-orange-500",
    bg: "bg-orange-50 dark:bg-orange-950/40",
    border: "border-l-4 border-orange-400",
  },
  {
    label: "Cost Reduction with AI Detection",
    value: "−30%",
    sub: "Lower breach cost vs. manual detection",
    color: "text-emerald-500",
    bg: "bg-emerald-50 dark:bg-emerald-950/40",
    border: "border-l-4 border-emerald-400",
  },
  {
    label: "Organisations with MFA Enabled",
    value: "57%",
    sub: "Less than 6 in 10 use basic 2FA",
    color: "text-blue-500",
    bg: "bg-blue-50 dark:bg-blue-950/40",
    border: "border-l-4 border-blue-400",
  },
  {
    label: "Employees Reuse Passwords",
    value: "65%",
    sub: "Across personal and work accounts",
    color: "text-amber-500",
    bg: "bg-amber-50 dark:bg-amber-950/40",
    border: "border-l-4 border-amber-400",
  },
  {
    label: "Breaches via Compromised Credentials",
    value: "86%",
    sub: "Stolen or weak passwords remain #1 vector",
    color: "text-purple-500",
    bg: "bg-purple-50 dark:bg-purple-950/40",
    border: "border-l-4 border-purple-400",
  },
];

const BEST_PRACTICES = [
  {
    title: "Enable MFA everywhere",
    desc: "MFA blocks 99.9% of automated account attacks. Start with email and password manager.",
    action: "Go to Profile",
    path: "/profile",
    color: "text-indigo-500",
    bg: "bg-indigo-50 dark:bg-indigo-950/40",
  },
  {
    title: "Scan files before opening",
    desc: "Malware is commonly delivered via email attachments. Always scan unknown files.",
    action: "Malware Analyzer",
    path: "/malware-analysis",
    color: "text-red-500",
    bg: "bg-red-50 dark:bg-red-950/40",
  },
  {
    title: "Audit your website headers",
    desc: "Missing security headers (CSP, HSTS, X-Frame-Options) expose users to XSS and clickjacking.",
    action: "Site Shield",
    path: "/site-shield",
    color: "text-emerald-500",
    bg: "bg-emerald-50 dark:bg-emerald-950/40",
  },
  {
    title: "Red-team your AI systems",
    desc: "Every AI integration is a new attack surface. Test for prompt injection before attackers do.",
    action: "Red-Team Agent",
    path: "/red-team",
    color: "text-rose-500",
    bg: "bg-rose-50 dark:bg-rose-950/40",
  },
];

// ─── Component ────────────────────────────────────────────────────────────────
const Insights: React.FC = () => {
  const navigate = useNavigate();

  const fadeUp = (delay = 0) => ({
    initial: { opacity: 0, y: 16 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.35, delay },
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 dark:from-gray-900 dark:to-gray-800">
      <title>Cybersecurity Insights — Seekurify</title>

        <div className="max-w-7xl mx-auto p-6 md:p-8 space-y-10">

          {/* ── Navigation Buttons ──────────────────────────────────────── */}
          <div className="mt-4 flex items-center gap-3">
            <button
              onClick={() => navigate(-1)}
              className="flex items-center gap-2 text-white bg-gradient-to-r from-red-500 to-red-600 px-4 py-2 rounded-lg shadow hover:scale-105 transition text-sm"
            >
              <ArrowLeft className="w-4 h-4" /> Back
            </button>
            <button
              onClick={() => navigate("/homepageAfterLogin")}
              className="flex items-center gap-2 bg-amber-400 text-slate-900 font-semibold bg-gradient-to-r from-amber-400 to-amber-500 px-4 py-2 rounded-lg shadow hover:scale-105 transition text-sm"
            >
              <Home className="w-4 h-4" /> Home
            </button>
          </div>

          {/* ── Page Header ─────────────────────────────────────────────── */}
          <motion.div {...fadeUp()}>
            <div className="flex items-center gap-3 mb-1">
              <div className="p-2.5 rounded-xl bg-gradient-to-br from-slate-800 to-amber-600 shadow-sm">
                <Activity className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-extrabold text-gray-900 dark:text-white leading-none">
                  Cybersecurity Insights
                </h1>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  Global threat landscape · 2024–2025 data
                </p>
              </div>
            </div>
          </motion.div>

          {/* ── Global Threat Pulse ──────────────────────────────────────── */}
          <section>
            <SectionHeader icon={Globe} label="Global Threat Pulse" color="text-indigo-500" />
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-4">
              {GLOBAL_STATS.map((s, i) => {
                const Icon = s.icon;
                return (
                  <motion.div
                    key={s.number}
                    {...fadeUp(0.04 * i)}
                    className={`rounded-2xl border ${s.border} ${s.bg} p-4 flex flex-col items-center text-center`}
                  >
                    <Icon className={`w-7 h-7 mb-2 ${s.color}`} />
                    <span className={`text-2xl font-extrabold ${s.color}`}>{s.number}</span>
                    <p className="text-xs text-gray-600 dark:text-gray-300 mt-1 leading-snug">{s.label}</p>
                    <p className="text-[10px] text-gray-400 mt-0.5">{s.sub}</p>
                  </motion.div>
                );
              })}
            </div>
          </section>

          {/* ── Attack Vectors + Targeted Industries ─────────────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

            {/* Attack Vectors */}
            <motion.section {...fadeUp(0.1)}>
              <SectionHeader icon={ShieldAlert} label="Top Attack Vectors (2024)" color="text-red-500" />
              <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-5 space-y-4">
                {ATTACK_VECTORS.map((v, i) => (
                  <div key={v.label}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="font-medium text-gray-700 dark:text-gray-300">{v.label}</span>
                      <span className="font-bold text-gray-900 dark:text-white">{v.pct}%</span>
                    </div>
                    <div className="w-full h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                      <motion.div
                        className={`h-2 rounded-full ${v.color}`}
                        initial={{ width: 0 }}
                        animate={{ width: `${v.pct}%` }}
                        transition={{ duration: 0.6, delay: 0.1 * i }}
                      />
                    </div>
                  </div>
                ))}
                <p className="text-[10px] text-gray-400 pt-1">Source: Verizon DBIR 2024</p>
              </div>
            </motion.section>

            {/* Targeted Industries */}
            <motion.section {...fadeUp(0.15)}>
              <SectionHeader icon={Building2} label="Most Targeted Industries" color="text-amber-500" />
              <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-5 space-y-4">
                {TARGETED_INDUSTRIES.map((ind, i) => {
                  const Icon = ind.icon;
                  return (
                    <div key={ind.label}>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <div className="flex items-center gap-1.5">
                          <Icon className="w-3.5 h-3.5 text-gray-400" />
                          <span className="font-medium text-gray-700 dark:text-gray-300">{ind.label}</span>
                        </div>
                        <span className="font-bold text-gray-900 dark:text-white">{ind.pct}%</span>
                      </div>
                      <div className="w-full h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                        <motion.div
                          className={`h-2 rounded-full ${ind.color}`}
                          initial={{ width: 0 }}
                          animate={{ width: `${ind.pct}%` }}
                          transition={{ duration: 0.6, delay: 0.1 * i }}
                        />
                      </div>
                    </div>
                  );
                })}
                <p className="text-[10px] text-gray-400 pt-1">Source: CrowdStrike Global Threat Report 2024</p>
              </div>
            </motion.section>
          </div>

          {/* ── AI-Powered Threat Trends ─────────────────────────────────── */}
          <section>
            <SectionHeader icon={Brain} label="AI-Powered Threat Trends" color="text-rose-500" badge="Emerging" />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {AI_THREATS.map((t, i) => {
                const Icon = t.icon;
                return (
                  <motion.div
                    key={t.title}
                    {...fadeUp(0.05 * i)}
                    className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-5 hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-start gap-3 mb-3">
                      <div className={`p-2 rounded-xl bg-gradient-to-br ${t.color} shadow-sm flex-shrink-0`}>
                        <Icon className="w-4 h-4 text-white" />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-gray-900 dark:text-white leading-tight">{t.title}</h3>
                        <span className="text-xs font-semibold text-rose-500">{t.stat}</span>
                      </div>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">{t.desc}</p>
                  </motion.div>
                );
              })}
            </div>
          </section>

          {/* ── Detection & Response Benchmarks ─────────────────────────── */}
          <section>
            <SectionHeader icon={Clock} label="Detection & Response Benchmarks" color="text-blue-500" />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {RESPONSE_METRICS.map((m, i) => (
                <motion.div
                  key={m.label}
                  {...fadeUp(0.05 * i)}
                  className={`rounded-2xl p-4 ${m.bg} ${m.border}`}
                >
                  <p className={`text-2xl font-extrabold ${m.color}`}>{m.value}</p>
                  <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 mt-1">{m.label}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{m.sub}</p>
                </motion.div>
              ))}
            </div>
          </section>

          {/* ── Actionable Recommendations ───────────────────────────────── */}
          <section>
            <SectionHeader icon={TrendingUp} label="What You Can Do Now" color="text-emerald-500" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {BEST_PRACTICES.map((p, i) => (
                <motion.div
                  key={p.title}
                  {...fadeUp(0.05 * i)}
                  className={`rounded-2xl p-4 ${p.bg} flex items-start justify-between gap-4`}
                >
                  <div>
                    <h3 className={`text-sm font-bold ${p.color} mb-1`}>{p.title}</h3>
                    <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed">{p.desc}</p>
                  </div>
                  <button
                    onClick={() => navigate(p.path)}
                    className={`flex-shrink-0 flex items-center gap-1 text-xs font-bold ${p.color} hover:underline mt-0.5`}
                  >
                    {p.action} <ChevronRight className="w-3 h-3" />
                  </button>
                </motion.div>
              ))}
            </div>
          </section>

          {/* ── Source Note ──────────────────────────────────────────────── */}
          <p className="text-xs text-gray-400 dark:text-gray-500 text-center pb-4">
            Data sourced from IBM X-Force Threat Intelligence Index, Verizon DBIR, CrowdStrike Global Threat Report, and Gartner — 2024–2025.
          </p>

        </div>
    </div>
  );
};

// ─── Section Header Helper ────────────────────────────────────────────────────
const SectionHeader: React.FC<{
  icon: React.FC<{ className?: string }>;
  label: string;
  color: string;
  badge?: string;
}> = ({ icon: Icon, label, color, badge }) => (
  <div className="flex items-center gap-2 mb-4">
    <Icon className={`w-5 h-5 ${color}`} />
    <h2 className={`text-sm font-bold ${color} uppercase tracking-wider`}>{label}</h2>
    {badge && (
      <span className="text-[10px] font-bold bg-rose-100 dark:bg-rose-900/40 text-rose-600 dark:text-rose-400 px-2 py-0.5 rounded-full">
        {badge}
      </span>
    )}
  </div>
);

export default Insights;
