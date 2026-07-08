import React, { FC } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import Footer from "./ui/FooterBeforeLogin";
import { ArrowLeft } from "lucide-react";
import {
  Lock,
  FileSearch,
  Bell,
  Bot,
  Syringe,
  Eye,
  ShieldCheck,
  Code2,
  Globe,
  ScanFace,
  Radar,
  BarChart3,
  Fish,
} from "lucide-react";

const features = [
  {
    title: "Password Manager",
    description:
      "Store, manage, and generate strong encrypted passwords protected by a secure PIN.",
    icon: <Lock className="w-10 h-10 text-amber-400" />,
    category: "Core Security",
  },
  {
    title: "Malware Analyzer",
    description:
      "Upload files or scan URLs to detect malware, viruses, and suspicious indicators.",
    icon: <FileSearch className="w-10 h-10 text-red-400" />,
    category: "Threat Detection",
  },
  {
    title: "Phishing Detector",
    description:
      "Analyze URLs and emails to identify phishing attempts and social engineering attacks.",
    icon: <Fish className="w-10 h-10 text-orange-400" />,
    category: "Threat Detection",
  },
  {
    title: "AI Agent Security Scanner",
    description:
      "Audit AI agents for vulnerabilities, unsafe behaviors, and alignment issues before deployment.",
    icon: <Bot className="w-10 h-10 text-sky-400" />,
    category: "AI Security",
  },
  {
    title: "AI Pipeline Red-Team Agent",
    description:
      "Autonomously red-team your AI pipelines to surface exploitable weaknesses and attack surfaces.",
    icon: <Radar className="w-10 h-10 text-rose-400" />,
    category: "AI Security",
  },
  {
    title: "AI Injection Scanner",
    description:
      "Detect prompt injection, jailbreak attempts, and adversarial inputs targeting LLM-based systems.",
    icon: <Syringe className="w-10 h-10 text-purple-400" />,
    category: "AI Security",
  },
  {
    title: "Privacy & PII Scanner",
    description:
      "Scan text and documents to identify personally identifiable information and privacy risks.",
    icon: <Eye className="w-10 h-10 text-emerald-400" />,
    category: "Privacy",
  },
  {
    title: "DeepFake Detector",
    description:
      "Analyze images and media to detect AI-generated deepfakes and synthetic content.",
    icon: <ScanFace className="w-10 h-10 text-pink-400" />,
    category: "AI Security",
  },
  {
    title: "CSP Builder",
    description:
      "Generate, validate, and fine-tune Content Security Policies to protect web applications from XSS.",
    icon: <Code2 className="w-10 h-10 text-yellow-400" />,
    category: "Web Security",
  },
  {
    title: "SiteShield Audit",
    description:
      "Run comprehensive security audits on websites to uncover misconfigurations and vulnerabilities.",
    icon: <Globe className="w-10 h-10 text-cyan-400" />,
    category: "Web Security",
  },
  {
    title: "WatchAgent",
    description:
      "Continuously monitor systems and services for anomalies, intrusions, and policy violations.",
    icon: <ShieldCheck className="w-10 h-10 text-lime-400" />,
    category: "Monitoring",
  },
  {
    title: "SIEM Dashboard",
    description:
      "Aggregate security events and logs into a unified view for real-time threat correlation.",
    icon: <BarChart3 className="w-10 h-10 text-indigo-400" />,
    category: "Monitoring",
  },
  {
    title: "Security Awareness",
    description:
      "Stay up to date with curated threat intelligence, best practices, and security education.",
    icon: <Bell className="w-10 h-10 text-amber-300" />,
    category: "Education",
  },
];

const categoryColors: Record<string, string> = {
  "AI Security": "text-sky-400 border-sky-700 bg-sky-900/20",
  "Threat Detection": "text-red-400 border-red-700 bg-red-900/20",
  "Core Security": "text-amber-400 border-amber-700 bg-amber-900/20",
  "Web Security": "text-cyan-400 border-cyan-700 bg-cyan-900/20",
  Privacy: "text-emerald-400 border-emerald-700 bg-emerald-900/20",
  Monitoring: "text-indigo-400 border-indigo-700 bg-indigo-900/20",
  Education: "text-yellow-400 border-yellow-700 bg-yellow-900/20",
};

export const FeaturesPage: FC = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
      {/* Hero Header */}
      <section className="py-16 px-6 text-center border-b border-slate-700/60">
        <div className="mb-6 flex justify-start max-w-6xl mx-auto">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-white bg-gradient-to-r from-red-500 to-red-600 px-4 py-2 rounded-lg shadow hover:scale-105 transition"
          >
            <ArrowLeft className="w-4 h-4" /> Back
          </button>
        </div>
        <h1 className="text-4xl sm:text-5xl font-extrabold mb-4 bg-clip-text text-transparent bg-gradient-to-r from-amber-300 to-white">
          Seekurify Features
        </h1>
        <p className="text-lg text-gray-400 max-w-2xl mx-auto">
          A comprehensive suite of AI-powered security tools to protect your digital infrastructure.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          {Object.keys(categoryColors).map((cat) => (
            <span
              key={cat}
              className={`text-xs font-semibold px-3 py-1 rounded-full border ${categoryColors[cat]}`}
            >
              {cat}
            </span>
          ))}
        </div>
      </section>

      {/* Features Grid */}
      <section className="flex-1 px-6 lg:px-16 py-12 max-w-6xl mx-auto w-full">
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, index) => (
            <motion.div
              key={index}
              whileHover={{ scale: 1.03 }}
              transition={{ type: "spring", stiffness: 300 }}
              className="bg-slate-800/80 border border-slate-700 p-6 rounded-2xl shadow-lg flex flex-col items-start gap-3"
            >
              <div className="p-2 rounded-xl bg-slate-700/50">{feature.icon}</div>
              <div>
                <span
                  className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${categoryColors[feature.category]}`}
                >
                  {feature.category}
                </span>
              </div>
              <h3 className="text-lg font-bold text-white">{feature.title}</h3>
              <p className="text-gray-400 text-sm leading-relaxed">{feature.description}</p>
            </motion.div>
          ))}
        </div>
      </section>

      <Footer />
    </div>
  );
};
