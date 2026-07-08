import React, { FC } from "react";
import { useAuth } from "../../context/AuthContext";
import { useNavigate } from "react-router-dom";
import { HomePageAfter } from "../HomePageAfter/HomePageAfter";
import Footer from "../../components/ui/FooterBeforeLogin";
import dashboardPreview from "../../../src/assets/dashboard-preview.png";
import aiInjectionPreview from "../../../src/assets/ai-scanner.png";
import findings from "../../../src/assets/aiinjection-findings.png";
import {
  Activity,
  ArrowRight,
  Bot,
  CheckCircle2,
  FileCheck,
  Globe,
  Lock,
  ScanSearch,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Zap,
} from "lucide-react";

const platformPillars = [
  {
    title: "AI Red-Team Workflows",
    description: "Probe AI endpoints for jailbreaks, exfiltration, prompt injection, and unsafe tool behavior before attackers do.",
    icon: Zap,
  },
  {
    title: "Continuous Monitoring",
    description: "Track security posture changes across watched assets with alerts, scheduled checks, and historical visibility.",
    icon: Activity,
  },
  {
    title: "Operator-Friendly Dashboard",
    description: "Keep scanning, findings, alerts, and remediation work in one place instead of stitching together separate tools.",
    icon: ShieldCheck,
  },
];

const commercialStats = [
  { label: "Security workflows", value: "10+" },
  { label: "Monitoring-ready modules", value: "24/7" },
  { label: "From scan to remediation", value: "1 platform" },
];

const useCases = [
  "Secure AI chatbots and agentic APIs before release",
  "Monitor websites and digital assets for posture drift",
  "Run malware, phishing, deepfake, and prompt-risk checks in one workspace",
  "Give teams a single operating surface for practical cyber hygiene",
];

const featureCards = [
  {
    title: "AI Security Testing",
    description: "Red-team AI systems, inspect prompt leakage, and evaluate agent pipelines with practical attack simulations.",
    icon: Bot,
  },
  {
    title: "Website & Asset Monitoring",
    description: "Audit sites, watch URLs, and catch configuration or score regressions before they become incidents.",
    icon: Globe,
  },
  {
    title: "File & Threat Analysis",
    description: "Upload files, scan suspicious content, and surface threats with analyst-friendly result views.",
    icon: FileCheck,
  },
  {
    title: "Identity & Credential Safety",
    description: "Store credentials securely and improve everyday security operations without leaving the platform.",
    icon: Lock,
  },
];

const proofPoints = [
  "Unified AI red-teaming, watch monitoring, malware analysis, and prompt-risk detection in one security workspace",
  "Executive-friendly platform story with operator-level workflows, findings, and monitoring views in the same product",
  "Outcome-driven flows centered on risk findings, security scores, alerts, and remediation steps instead of isolated tools and reports",
];

export const HomePageBefore: FC = () => {
  const { isAuthenticated, isLoading } = useAuth();
  const navigate = useNavigate();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-cyan-400 mx-auto mb-4" />
          <p className="text-slate-300 text-lg">Loading...</p>
        </div>
      </div>
    );
  }

  if (isAuthenticated) {
    return <HomePageAfter />;
  }

  return (
    <div className="min-h-screen bg-[#07111f] text-white overflow-x-hidden">
      <div className="relative isolate overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(34,211,238,0.18),_transparent_28%),radial-gradient(circle_at_80%_20%,_rgba(250,204,21,0.12),_transparent_24%),linear-gradient(180deg,_#0b1730_0%,_#07111f_55%,_#08101b_100%)]" />
        <div className="absolute inset-x-0 top-0 h-px bg-white/10" />

        <header className="relative z-10 max-w-7xl mx-auto px-6 lg:px-10 pt-6">
          <div className="flex items-center justify-between rounded-full border border-white/10 bg-white/5 backdrop-blur-xl px-5 py-3">
            <button
              onClick={() => navigate("/")}
              className="flex items-center gap-3 text-left"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-cyan-400/15 border border-cyan-300/20">
                <ShieldCheck className="h-5 w-5 text-cyan-300" />
              </div>
              <div>
                <p className="text-sm font-semibold tracking-[0.2em] uppercase text-slate-300">Seekurify</p>
                <p className="text-xs text-slate-400">AI Security Platform</p>
              </div>
            </button>

            <div className="hidden md:flex items-center gap-8 text-sm text-slate-300">
              <button onClick={() => navigate("/features")} className="hover:text-white transition-colors">Platform</button>
              <button onClick={() => navigate("/insights")} className="hover:text-white transition-colors">Insights</button>
              <button onClick={() => navigate("/user-guide")} className="hover:text-white transition-colors">User Guide</button>
              <button onClick={() => navigate("/contact-public")} className="hover:text-white transition-colors">Contact</button>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate("/login")}
                className="px-4 py-2 text-sm font-medium text-slate-200 hover:text-white transition-colors"
              >
                Login
              </button>
              <button
                onClick={() => navigate("/signup")}
                className="rounded-full bg-amber-400 text-slate-950 px-5 py-2.5 text-sm font-semibold hover:bg-amber-300 transition-colors"
              >
                Start Free
              </button>
            </div>
          </div>
        </header>

        <section className="relative z-10 max-w-7xl mx-auto px-6 lg:px-10 pt-16 pb-20 lg:pt-24 lg:pb-28">
          <div className="grid gap-14 lg:grid-cols-[1.1fr_0.9fr] items-center">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-400/10 px-4 py-2 text-sm text-cyan-200">
                <Sparkles className="h-4 w-4" />
                Commercial-grade security operations for modern AI products
              </div>

              <h1 className="mt-7 max-w-4xl text-5xl sm:text-6xl xl:text-7xl font-black leading-[0.95] tracking-tight">
                Ship faster with
                <span className="block text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-amber-200 to-white">
                  practical AI security testing
                </span>
              </h1>

              <p className="mt-6 max-w-2xl text-lg sm:text-xl text-slate-300 leading-8">
                Seekurify gives teams a single platform to red-team AI systems, monitor digital assets, scan suspicious content, and turn findings into action.
              </p>

              <div className="mt-10 flex flex-wrap gap-4">
                <button
                  onClick={() => navigate("/signup")}
                  className="inline-flex items-center gap-2 rounded-full bg-amber-400 px-7 py-4 text-base font-semibold text-slate-950 hover:bg-amber-300 transition-colors"
                >
                  Start Free
                  <ArrowRight className="h-4 w-4" />
                </button>
                <button
                  onClick={() => navigate("/features")}
                  className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-7 py-4 text-base font-semibold text-white hover:bg-white/10 transition-colors"
                >
                  Explore Platform
                </button>
              </div>

              <div className="mt-8 grid gap-3 sm:grid-cols-2">
                {useCases.map((item) => (
                  <div key={item} className="flex items-start gap-3 text-sm text-slate-300">
                    <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0 text-cyan-300" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="relative">
              <div className="absolute -inset-6 rounded-[2rem] bg-cyan-400/10 blur-3xl" />
              <div className="relative rounded-[2rem] border border-white/10 bg-white/6 backdrop-blur-2xl p-5 shadow-2xl shadow-cyan-950/30">
                <div className="grid gap-4 sm:grid-cols-3">
                  {commercialStats.map((stat) => (
                    <div key={stat.label} className="rounded-2xl border border-white/10 bg-slate-950/45 p-4">
                      <p className="text-3xl font-black text-white">{stat.value}</p>
                      <p className="mt-2 text-xs uppercase tracking-[0.18em] text-slate-400">{stat.label}</p>
                    </div>
                  ))}
                </div>

                <div className="mt-5 rounded-[1.75rem] border border-white/10 bg-[#08101b] overflow-hidden">
                  <img src={dashboardPreview} alt="Seekurify dashboard preview" className="w-full h-full object-cover" />
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>

      <section className="border-y border-white/8 bg-white/[0.03]">
        <div className="max-w-7xl mx-auto px-6 lg:px-10 py-5">
          <div className="flex flex-wrap items-center gap-x-10 gap-y-3 text-sm uppercase tracking-[0.22em] text-slate-400">
            <span>OWASP-aware workflows</span>
            <span>AI attack simulation</span>
            <span>Continuous watch monitoring</span>
            <span>Operator-ready dashboards</span>
          </div>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-6 lg:px-10 py-24">
        <div className="max-w-2xl">
          <p className="text-sm uppercase tracking-[0.22em] text-cyan-300">Platform</p>
          <h2 className="mt-4 text-4xl sm:text-5xl font-black tracking-tight text-white">
            Built to look like one product, not a pile of disconnected tools
          </h2>
          <p className="mt-5 text-lg text-slate-300 leading-8">
            The homepage now presents Seekurify like a commercial platform: clear narrative, product framing, visual proof, and conversion-focused sections.
          </p>
        </div>

        <div className="mt-14 grid gap-6 lg:grid-cols-3">
          {platformPillars.map((pillar) => {
            const Icon = pillar.icon;
            return (
              <div
                key={pillar.title}
                className="rounded-[1.75rem] border border-white/10 bg-gradient-to-b from-white/8 to-white/[0.03] p-7 shadow-xl shadow-black/10"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-400/10 border border-cyan-300/20">
                  <Icon className="h-6 w-6 text-cyan-300" />
                </div>
                <h3 className="mt-6 text-2xl font-semibold text-white">{pillar.title}</h3>
                <p className="mt-3 text-slate-300 leading-7">{pillar.description}</p>
              </div>
            );
          })}
        </div>
      </section>

      <section className="bg-[#091321] border-y border-white/8">
        <div className="max-w-7xl mx-auto px-6 lg:px-10 py-24 grid gap-12 lg:grid-cols-[0.95fr_1.05fr] items-center">
          <div>
            <p className="text-sm uppercase tracking-[0.22em] text-amber-200">Proof of value</p>
              <h2 className="mt-4 text-4xl sm:text-5xl font-black tracking-tight">
                Seekurify provides AI Red Teaming solutions for your teams to safeguard your systems
              </h2>
            <p className="mt-5 text-lg text-slate-300 leading-8">
              Seekurify helps security teams run AI red-teaming workflows, surface meaningful findings, and strengthen system defenses with clearer visibility into risks.
            </p>

            <div className="mt-8 space-y-4">
              {proofPoints.map((point) => (
                <div key={point} className="flex items-start gap-3 rounded-2xl border border-white/8 bg-white/[0.04] p-4">
                  <TrendingUp className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-200" />
                  <span className="text-slate-200">{point}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-5">
            <div className="rounded-[1.75rem] overflow-hidden border border-white/10 shadow-xl shadow-black/20">
              <img src={aiInjectionPreview} alt="AI injection scanner preview" className="w-full h-full object-cover" />
            </div>
            <div className="rounded-[1.75rem] overflow-hidden border border-white/10 shadow-xl shadow-black/20">
              <img src={findings} alt="AI injection findings preview" className="w-full h-full object-cover" />
            </div>
          </div>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-6 lg:px-10 py-24">
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-8 mb-12">
          <div className="max-w-2xl">
            <p className="text-sm uppercase tracking-[0.22em] text-cyan-300">Capabilities</p>
            <h2 className="mt-4 text-4xl sm:text-5xl font-black tracking-tight text-white">
              Core workflows that make the platform commercially legible
            </h2>
          </div>
          <button
            onClick={() => navigate("/insights")}
            className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-6 py-3 font-semibold text-white hover:bg-white/10 transition-colors"
          >
            Visit Insights
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>

        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
          {featureCards.map((feature) => {
            const Icon = feature.icon;
            return (
              <div
                key={feature.title}
                className="rounded-[1.6rem] border border-white/10 bg-white/[0.04] p-6 hover:bg-white/[0.06] transition-colors"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-400/10 border border-sky-300/20">
                  <Icon className="h-6 w-6 text-sky-300" />
                </div>
                <h3 className="mt-5 text-xl font-semibold text-white">{feature.title}</h3>
                <p className="mt-3 text-sm leading-7 text-slate-300">{feature.description}</p>
              </div>
            );
          })}
        </div>
      </section>

      <section className="px-6 lg:px-10 pb-24">
        <div className="max-w-7xl mx-auto rounded-[2rem] border border-cyan-300/15 bg-[linear-gradient(135deg,_rgba(34,211,238,0.14),_rgba(15,23,42,0.72)_45%,_rgba(245,158,11,0.12))] p-8 md:p-12">
          <div className="grid gap-8 lg:grid-cols-[1fr_auto] lg:items-center">
            <div className="max-w-3xl">
              <p className="text-sm uppercase tracking-[0.22em] text-cyan-200">Get started</p>
              <h2 className="mt-4 text-4xl sm:text-5xl font-black tracking-tight text-white">
                Seekurify helps your team find AI and security risks earlier, respond faster, and ship with more confidence
              </h2>
              <p className="mt-5 text-lg text-slate-200 leading-8">
                Seekurify brings AI red-teaming, monitoring, threat analysis, and actionable findings into one platform so teams can evaluate risk fast and move directly into adoption.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-4">
              <button
                onClick={() => navigate("/signup")}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-7 py-4 text-base font-semibold text-slate-950 hover:bg-slate-100 transition-colors"
              >
                Create Account
                <ArrowRight className="h-4 w-4" />
              </button>
              <button
                onClick={() => navigate("/contact-public")}
                className="inline-flex items-center justify-center gap-2 rounded-full border border-white/20 px-7 py-4 text-base font-semibold text-white hover:bg-white/10 transition-colors"
              >
                Talk to Us
              </button>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};
