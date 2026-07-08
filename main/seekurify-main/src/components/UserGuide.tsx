import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  BookOpen, KeyRound, ShieldCheck, FileSearch, Globe, Eye, Bot, Target,
  Zap, Shield, Activity, ShieldOff, Users, BarChart3, ScanEye,
  ChevronDown, ChevronRight, ExternalLink, Puzzle, CreditCard,
  FileText, Code2, AlertTriangle, Search, Info,
} from "lucide-react";
import Header from "./ui/Header";
import Footer from "./ui/Footer";
import AppSidebar from "./ui/AppSidebar";

// ── Types ──────────────────────────────────────────────────────────────────────

interface Section {
  id: string;
  icon: React.ReactElement;
  title: string;
  color: string;
  badge?: string;
  content: React.ReactElement;
}

// ── Helper sub-components ──────────────────────────────────────────────────────

function Tip({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-sky-900/30 border border-sky-700/50 rounded-lg p-3 flex gap-2">
      <Info className="w-4 h-4 text-sky-400 flex-shrink-0 mt-0.5" />
      <p className="text-gray-300 text-sm">{children}</p>
    </div>
  );
}

function Warning({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-red-900/20 border border-red-700/40 rounded-lg p-3 flex gap-2">
      <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
      <p className="text-gray-300 text-sm">{children}</p>
    </div>
  );
}

function Steps({ items }: { items: string[] }) {
  return (
    <ol className="space-y-2">
      {items.map((item, i) => (
        <li key={i} className="flex gap-3 text-sm text-gray-300">
          <span className="flex-shrink-0 w-5 h-5 rounded-full bg-gray-700 text-gray-300 text-xs flex items-center justify-center font-bold mt-0.5">{i + 1}</span>
          <span dangerouslySetInnerHTML={{ __html: item }} />
        </li>
      ))}
    </ol>
  );
}

function Cards({ items }: { items: { label: string; desc: string }[] }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {items.map(c => (
        <div key={c.label} className="bg-gray-800 rounded-lg p-3 border border-gray-700">
          <p className="text-white text-sm font-semibold">{c.label}</p>
          <p className="text-gray-400 text-xs mt-1 leading-relaxed">{c.desc}</p>
        </div>
      ))}
    </div>
  );
}

function Tag({ children, color = "bg-gray-700 text-gray-300" }: { children: React.ReactNode; color?: string }) {
  return <span className={`inline-block px-2 py-0.5 rounded text-xs font-mono font-semibold ${color}`}>{children}</span>;
}

// ── Section data ───────────────────────────────────────────────────────────────

const SECTIONS: Section[] = [
  // ── 1. Getting Started ──────────────────────────────────────────────────────
  {
    id: "getting-started",
    icon: <BookOpen className="w-5 h-5" />,
    title: "Getting Started",
    color: "text-sky-400",
    content: (
      <div className="space-y-5">
        <p className="text-gray-300">Seekurify is an all-in-one cybersecurity platform: password vault, threat detection, AI-powered analysis, incident response, and a browser extension — all in one place. This guide walks through every feature so you can get the most out of it.</p>

        <div>
          <h4 className="text-white font-semibold mb-3">Initial setup</h4>
          <Steps items={[
            'Go to <span class="text-sky-400">/signup</span>, enter your email and a strong password (12+ characters, mixed case, digits, symbols), then click Create Account.',
            'Check your inbox and verify your email address.',
            'You will be redirected to set a <strong class="text-white">4-digit vault PIN</strong>. This PIN encrypts your saved passwords client-side and is never stored on our servers. Do not forget it — it cannot be recovered.',
            'After PIN setup you land on the <strong class="text-white">login page</strong>. Enter your email and password to log in.',
            '<strong class="text-white">OTP verification</strong> — a one-time passcode is sent to your registered email address. Enter the 6-digit code on the OTP screen. The code expires in 10 minutes; click <strong class="text-white">Resend OTP</strong> if it does not arrive. This step confirms it is really you logging in, even if your password is compromised.',
            '<strong class="text-white">PIN verification</strong> — after OTP, you are prompted for your 4-digit vault PIN. This PIN is the encryption key for your saved passwords. It is never stored on our servers — only you know it. Enter it correctly to unlock your vault and proceed.',
            'You now land on the main dashboard. Explore the left sidebar to navigate to any feature.',
            'Install the <strong class="text-white">Seekurify browser extension</strong> from the Chrome Web Store for real-time protection in your browser.',
          ]} />
        </div>

        <Tip>If you sign in with Google, you still need to set a vault PIN. Your Google account handles identity — your PIN handles encryption. They are independent.</Tip>

        <div>
          <h4 className="text-white font-semibold mb-3">Navigation overview</h4>
          <p className="text-gray-300 text-sm mb-3">The left sidebar groups all features by category. Click the toggle arrow at the top of the sidebar to collapse it to icon-only mode. Hover any icon when collapsed to see its label.</p>
          <Cards items={[
            { label: "Identity & Access", desc: "Password Manager, SIEM, Identity Risk, Blast Radius, Breach Control" },
            { label: "Threat Detection", desc: "Malware Analyzer, DeepFake Detector" },
            { label: "AI Security Suite", desc: "Red-Team Agent, AI Agent Scanner, Injection Scanner" },
            { label: "Web & Infrastructure", desc: "AI Firewall, Watch Agent, CSP Builder, SiteShield Audit" },
            { label: "Learn & Stay Secure", desc: "Security Awareness training and tips" },
            { label: "Team Workspaces", desc: "Findings Board, SOAR Center, shared Workspaces" },
            { label: "Resources", desc: "User Guide (this page), API Docs" },
          ]} />
        </div>
      </div>
    ),
  },

  // ── 2. Password Manager ─────────────────────────────────────────────────────
  {
    id: "password-manager",
    icon: <KeyRound className="w-5 h-5" />,
    title: "Password Manager",
    color: "text-sky-400",
    content: (
      <div className="space-y-5">
        <p className="text-gray-300">The Password Manager is your encrypted credential vault. Every password is encrypted before it leaves your browser and stored server-side in hashed form.</p>

        <div>
          <h4 className="text-white font-semibold mb-3">Adding a password</h4>
          <Steps items={[
            'Navigate to <strong class="text-white">Password Manager</strong> in the sidebar.',
            'Click <Tag>+ Add Password</Tag>.',
            'Fill in Website URL, Username / Email, and Password.',
            'Optionally tick <strong class="text-white">Financial account</strong> — this applies higher scrutiny during risk scoring.',
            'Click <strong class="text-white">Save</strong>. The password is encrypted with your PIN before being sent.',
          ]} />
        </div>

        <div>
          <h4 className="text-white font-semibold mb-3">Editing and deleting</h4>
          <p className="text-gray-300 text-sm">Click the pencil icon on any entry to edit it. Click the trash icon to delete. Deletion is permanent — there is no recycle bin.</p>
        </div>

        <div>
          <h4 className="text-white font-semibold mb-3">Automated risk scoring</h4>
          <p className="text-gray-300 text-sm mb-3">Each saved password is scored 0–100 based on five risk factors. The "At-Risk Passwords" widget on the dashboard shows your top 5 highest-risk entries.</p>
          <div className="space-y-2 text-sm">
            {[
              { tag: "Breached", color: "bg-red-900/60 text-red-300", desc: "This password appears in a known public data breach, verified via the HIBP k-anonymous API. Change it immediately." },
              { tag: "Reused", color: "bg-orange-900/60 text-orange-300", desc: "The same password is used on more than one site. A breach at one site exposes all the others." },
              { tag: "Weak", color: "bg-yellow-900/60 text-yellow-300", desc: "The password is 10 characters or fewer. Use at least 12 characters with mixed case, digits, and symbols." },
              { tag: "Old", color: "bg-gray-700 text-gray-300", desc: "The password has not been changed in more than 180 days. Rotate it to reduce exposure window." },
              { tag: "Financial", color: "bg-amber-900/60 text-amber-300", desc: "This account handles financial data. Extra scrutiny is applied during scoring." },
            ].map(r => (
              <div key={r.tag} className="flex gap-3">
                <span className={`inline-block px-2 py-0.5 rounded text-xs font-bold flex-shrink-0 ${r.color}`}>{r.tag}</span>
                <p className="text-gray-400">{r.desc}</p>
              </div>
            ))}
          </div>
        </div>

        <div>
          <h4 className="text-white font-semibold mb-3">Breach check</h4>
          <p className="text-gray-300 text-sm">Click <strong className="text-white">Check Breaches</strong> on the dashboard to run a k-anonymous HIBP lookup on all stored passwords. Only the first 5 characters of the SHA-1 hash are transmitted — your actual password never leaves your device.</p>
        </div>

        <div>
          <h4 className="text-white font-semibold mb-3">Password generator</h4>
          <p className="text-gray-300 text-sm">The browser extension includes a built-in password generator accessible from the extension popup. Adjust length (8–64 characters), toggle uppercase, digits, and symbols, then copy the generated password directly into any form field. A strength indicator shows Very Weak / Weak / Fair / Good / Strong as you change settings.</p>
        </div>

        <Tip>After saving a new password, click <strong>Run Risk Scan</strong> on the dashboard to immediately score it without waiting for the next scheduled scan.</Tip>
      </div>
    ),
  },

  // ── 4. Malware Analyzer ─────────────────────────────────────────────────────
  {
    id: "malware-analyzer",
    icon: <FileSearch className="w-5 h-5" />,
    title: "Malware Analyzer",
    color: "text-red-400",
    content: (
      <div className="space-y-5">
        <p className="text-gray-300">The Malware Analyzer scans files and code snippets for malicious patterns, obfuscated payloads, and known malware signatures using static analysis and AI-assisted heuristics.</p>

        <div>
          <h4 className="text-white font-semibold mb-3">Scanning a file</h4>
          <Steps items={[
            'Navigate to <strong class="text-white">Analyze Malware</strong> in the sidebar.',
            'Click <strong class="text-white">Upload File</strong> and select the file (max 10 MB).',
            'The analyzer processes the file and returns a verdict within seconds.',
            'Review the verdict card, matched indicators, and severity breakdown.',
            'If flagged, click <strong class="text-white">Create Finding</strong> to log it to your Findings Board.',
          ]} />
        </div>

        <div>
          <h4 className="text-white font-semibold mb-3">Supported formats</h4>
          <Cards items={[
            { label: "Scripts", desc: "JavaScript (.js), PowerShell (.ps1), Python (.py), Bash (.sh), VBScript (.vbs)" },
            { label: "Documents", desc: "Office macros (.docm, .xlsm), PDFs with embedded scripts" },
            { label: "Executables", desc: "PE files (.exe, .dll), ELF binaries" },
            { label: "Archives", desc: ".zip, .tar, .7z — contents extracted and scanned individually" },
          ]} />
        </div>

        <div>
          <h4 className="text-white font-semibold mb-3">Verdict levels</h4>
          <div className="space-y-2 text-sm">
            <div className="flex gap-3"><span className="px-2 py-0.5 rounded bg-green-900/60 text-green-300 text-xs font-bold flex-shrink-0">CLEAN</span><p className="text-gray-400">No malicious indicators found. File is safe to open.</p></div>
            <div className="flex gap-3"><span className="px-2 py-0.5 rounded bg-yellow-900/60 text-yellow-300 text-xs font-bold flex-shrink-0">SUSPICIOUS</span><p className="text-gray-400">Patterns that are often used maliciously but could also be legitimate (e.g. eval() in JS). Treat with caution.</p></div>
            <div className="flex gap-3"><span className="px-2 py-0.5 rounded bg-red-900/60 text-red-300 text-xs font-bold flex-shrink-0">MALICIOUS</span><p className="text-gray-400">High-confidence malicious indicators detected. Do not open or execute this file.</p></div>
          </div>
        </div>

        <Warning>Never open or run a file before scanning it. Upload it to Seekurify first to get a verdict.</Warning>
      </div>
    ),
  },

  // ── 5. SIEM Dashboard ───────────────────────────────────────────────────────
  {
    id: "siem",
    icon: <BarChart3 className="w-5 h-5" />,
    title: "System Events Dashboard (SIEM)",
    color: "text-sky-400",
    content: (
      <div className="space-y-5">
        <p className="text-gray-300">The System Events Dashboard (SIEM) gives you a centralized view of all security-relevant events across your account: login activity, password changes, scan results, and threat detections — plotted over time.</p>

        <div>
          <h4 className="text-white font-semibold mb-3">What it shows</h4>
          <Cards items={[
            { label: "Login Events", desc: "Every successful and failed login attempt, with device type, browser, OS, IP address, and geolocation." },
            { label: "Password Health Trend", desc: "Time-series graph of your password risk scores — see whether your overall security posture is improving." },
            { label: "Threat Detection Events", desc: "Phishing scan results, malware detections, and injection alerts logged over time." },
            { label: "Device Sessions", desc: "List of active and recent device sessions. Revoke any device you do not recognize." },
            { label: "Event Categories", desc: "Filter by event type (Auth, Password, Scan, Threat) to focus on specific activity." },
            { label: "Export", desc: "Download event data as CSV for external SIEM integration or compliance reporting." },
          ]} />
        </div>

        <div>
          <h4 className="text-white font-semibold mb-2">Reading the graphs</h4>
          <p className="text-gray-300 text-sm">The main chart plots event count vs. time. Hover any data point to see the exact count and timestamp. Use the date range picker to zoom into a specific window. Spikes in failed logins or scan events may indicate an active attack or compromised credential.</p>
        </div>

        <Tip>If you see login events from an IP or location you do not recognize, immediately change your password and revoke that device session from the Device Sessions panel.</Tip>
      </div>
    ),
  },

  // ── 6. Identity Risk & Blast Radius ────────────────────────────────────────
  {
    id: "identity-risk",
    icon: <Activity className="w-5 h-5" />,
    title: "Identity Risk & Blast Radius",
    color: "text-sky-400",
    content: (
      <div className="space-y-5">
        <p className="text-gray-300">Two complementary tools that map how exposed your digital identity is and how far damage could spread from a single compromised credential.</p>

        <div>
          <h4 className="text-white font-semibold mb-3">Identity Risk Dashboard</h4>
          <p className="text-gray-300 text-sm mb-3">Aggregates risk signals from all your stored credentials — breach status, reuse patterns, password age, and strength — into a single overall identity risk score. The dashboard shows:</p>
          <ul className="list-disc list-inside text-gray-300 text-sm space-y-1.5 ml-2">
            <li>Overall identity risk score (0–100) with trend vs. last scan</li>
            <li>Breakdown by risk category: Breach Exposure, Password Hygiene, Account Age Risk</li>
            <li>Top 5 highest-risk accounts with one-click remediation links</li>
            <li>Risk distribution chart across all credentials</li>
          </ul>
        </div>

        <div>
          <h4 className="text-white font-semibold mb-3">Blast Radius Analyzer</h4>
          <p className="text-gray-300 text-sm mb-3">Enter an email address or account to model how far a compromise could propagate. The analyzer maps:</p>
          <ul className="list-disc list-inside text-gray-300 text-sm space-y-1.5 ml-2">
            <li><strong className="text-white">Shared password graph</strong> — all accounts using the same password as the target</li>
            <li><strong className="text-white">Linked accounts</strong> — accounts connected via "Sign in with Google/GitHub/Facebook"</li>
            <li><strong className="text-white">Privilege escalation paths</strong> — if the compromised account has admin access to shared workspaces</li>
            <li><strong className="text-white">Blast radius score</strong> — estimated number of accounts at risk from a single breach</li>
          </ul>
        </div>

        <Tip>Use the Blast Radius Analyzer before rotating a password to understand the full scope of what needs to change.</Tip>
      </div>
    ),
  },

  // ── 7. Breach Control ───────────────────────────────────────────────────────
  {
    id: "breach-control",
    icon: <ShieldOff className="w-5 h-5" />,
    title: "Breach Control",
    color: "text-sky-400",
    content: (
      <div className="space-y-5">
        <p className="text-gray-300">Breach Control monitors your email addresses against the Have I Been Pwned (HIBP) database and gives you actionable remediation steps when a breach is found.</p>

        <div>
          <h4 className="text-white font-semibold mb-3">How to use it</h4>
          <Steps items={[
            'Open <strong class="text-white">Breach Control</strong> from the sidebar under Identity & Access.',
            'The page loads automatically — it reads all passwords stored in your vault and checks each one against breach databases. No manual input is needed.',
            'The <strong class="text-white">stats grid</strong> at the top gives you an instant summary: how many credentials are Quarantined, Breached, involved in Reuse Chains, and how many are Safe.',
            'The <strong class="text-white">Remediation Progress bar</strong> shows what percentage of your total credentials are currently clean. Work towards 100%.',
            'The <strong class="text-white">Quarantine Queue</strong> lists every flagged credential with the site name, username, the reason it was quarantined (e.g. found in a known breach, reused password), and the date it was quarantined.',
            'For each quarantined entry, click <strong class="text-white">Visit</strong> to open the site and change your password there. Once changed, come back and click <strong class="text-white">Mark Resolved</strong> to remove it from the queue.',
            'Click <strong class="text-white">Refresh</strong> at the top right to re-run the check after making changes.',
          ]} />
        </div>

        <div>
          <h4 className="text-white font-semibold mb-2">Understanding the quarantine reason</h4>
          <div className="space-y-2 text-sm">
            {[
              { tag: "Found in breach", color: "bg-red-900/50 text-red-300", desc: "This exact password appears in a known public data breach, verified via a k-anonymous HIBP lookup. It must be changed immediately." },
              { tag: "Password reused", color: "bg-orange-900/50 text-orange-300", desc: "The same password is used on multiple sites. If any one of those sites is breached, all the others are exposed." },
            ].map(r => (
              <div key={r.tag} className="flex gap-3">
                <span className={`inline-block px-2 py-0.5 rounded text-xs font-bold flex-shrink-0 ${r.color}`}>{r.tag}</span>
                <p className="text-gray-400">{r.desc}</p>
              </div>
            ))}
          </div>
        </div>

        <div>
          <h4 className="text-white font-semibold mb-2">Remediation checklist</h4>
          <ol className="list-decimal list-inside text-gray-300 text-sm space-y-1.5 ml-2">
            <li>Click <strong className="text-white">Visit</strong> on the quarantined entry to open the site</li>
            <li>Change the password to a new, unique one — use the extension's password generator if needed</li>
            <li>Update the password in your Seekurify vault to match</li>
            <li>Return to Breach Control and click <strong className="text-white">Mark Resolved</strong> to remove it from the queue</li>
            <li>Enable MFA on the account if you haven't already</li>
          </ol>
        </div>
      </div>
    ),
  },

  // ── 8. DeepFake Detector ────────────────────────────────────────────────────
  {
    id: "deepfake-detector",
    icon: <ScanEye className="w-5 h-5" />,
    title: "DeepFake Detector",
    color: "text-red-400",
    content: (
      <div className="space-y-5">
        <p className="text-gray-300">The DeepFake Detector analyzes images and video frames for signs of AI-generated or manipulated media — protecting you from synthetic identity fraud and social engineering via fabricated media.</p>

        <div>
          <h4 className="text-white font-semibold mb-3">How to use it</h4>
          <Steps items={[
            'Navigate to <strong class="text-white">DeepFake Detector</strong> in the Threat Detection group.',
            'Upload an image (JPG, PNG, WebP) or paste an image URL.',
            'Click <strong class="text-white">Analyze</strong>.',
            'Review the authenticity score and detection signals.',
          ]} />
        </div>

        <div>
          <h4 className="text-white font-semibold mb-3">What it detects</h4>
          <Cards items={[
            { label: "GAN Artifacts", desc: "Texture inconsistencies and frequency-domain anomalies typical of GAN-generated faces." },
            { label: "Face Swap Seams", desc: "Boundary artifacts where a face has been digitally overlaid onto another body." },
            { label: "Metadata Inconsistencies", desc: "EXIF data mismatches that suggest post-processing or AI generation." },
            { label: "Compression Patterns", desc: "Unusual compression signatures from diffusion-model generated images." },
          ]} />
        </div>

        <div>
          <h4 className="text-white font-semibold mb-2">Result confidence levels</h4>
          <p className="text-gray-300 text-sm">Results are expressed as a probability: <strong className="text-green-400">0–30% = Likely Authentic</strong>, <strong className="text-yellow-400">31–69% = Uncertain</strong>, <strong className="text-red-400">70–100% = Likely Synthetic</strong>. No detection is 100% certain — use results as one signal among others.</p>
        </div>

        <Warning>A "Likely Authentic" result does not guarantee the media is real. Context, source, and corroborating evidence should always be considered.</Warning>
      </div>
    ),
  },

  // ── 9. AI Security Suite ────────────────────────────────────────────────────
  {
    id: "ai-security",
    icon: <Bot className="w-5 h-5" />,
    title: "AI Security Suite",
    color: "text-cyan-400",
    badge: "3 tools",
    content: (
      <div className="space-y-5">
        <p className="text-gray-300">Three AI-powered tools built for security teams that work with AI systems or need adversarial testing capabilities.</p>

        <div className="space-y-4">
          {/* Red Team */}
          <div className="bg-gray-800 border border-gray-700 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <Target className="w-4 h-4 text-cyan-400" />
              <h4 className="text-white font-semibold">AI Red-Team Agent</h4>
            </div>
            <p className="text-gray-300 text-sm mb-3">Simulates adversarial attacks against a target URL to identify exploitable vulnerabilities. The agent generates payloads, tests them, and reports exploitable paths.</p>
            <div className="space-y-2">
              <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider">Attack categories</p>
              <div className="flex flex-wrap gap-1.5">
                {["SQL Injection", "XSS", "SSRF", "LFI / Path Traversal", "Command Injection", "Auth Bypass", "CSRF"].map(a => (
                  <span key={a} className="px-2 py-0.5 bg-gray-900 border border-gray-600 text-gray-300 text-xs rounded">{a}</span>
                ))}
              </div>
            </div>
            <Warning>Only use the Red-Team Agent on systems you own or have explicit written authorization to test. Unauthorized use is illegal.</Warning>
          </div>

          {/* Agent Scanner */}
          <div className="bg-gray-800 border border-gray-700 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <Bot className="w-4 h-4 text-cyan-400" />
              <h4 className="text-white font-semibold">AI Agent Scanner</h4>
            </div>
            <p className="text-gray-300 text-sm mb-3">Audits AI agents and LLM-connected pipelines for security vulnerabilities specific to agentic systems.</p>
            <Cards items={[
              { label: "Prompt Injection", desc: "Tests whether malicious prompts can override the agent's system instructions." },
              { label: "Tool Misuse", desc: "Checks if the agent can be manipulated into calling dangerous tools unexpectedly." },
              { label: "Data Leakage", desc: "Tests whether the agent leaks its system prompt, training data, or user context." },
              { label: "Over-Permission", desc: "Identifies tools or APIs the agent has access to that it should not need." },
            ]} />
          </div>

          {/* Injection Scanner */}
          <div className="bg-gray-800 border border-gray-700 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <Zap className="w-4 h-4 text-cyan-400" />
              <h4 className="text-white font-semibold">AI Injection Scanner</h4>
            </div>
            <p className="text-gray-300 text-sm mb-3">Scan any text for injection patterns before submitting it to an AI system. Useful for validating user-supplied inputs in your own AI applications.</p>
            <Cards items={[
              { label: "SQL Injection", desc: "UNION attacks, DROP/TRUNCATE statements, tautologies, stacked queries." },
              { label: "Prompt Injection", desc: "\"Ignore previous instructions\", role overrides, jailbreak patterns." },
              { label: "Shell Injection", desc: "Shell commands, subshell execution ($(...)), piped commands." },
              { label: "Other", desc: "XSS, path traversal, LDAP injection, template injection." },
            ]} />
          </div>
        </div>
      </div>
    ),
  },

  // ── 10. AI Firewall (WAF) ───────────────────────────────────────────────────
  {
    id: "firewall",
    icon: <Shield className="w-5 h-5" />,
    title: "AI Firewall (WAF)",
    color: "text-teal-400",
    content: (
      <div className="space-y-5">
        <p className="text-gray-300">The AI Firewall acts as a Web Application Firewall (WAF) that inspects inbound requests and blocks malicious traffic before it reaches your application. Rules can be managed manually or generated by the AI based on observed attack patterns.</p>

        <div>
          <h4 className="text-white font-semibold mb-3">How it works</h4>
          <Steps items={[
            'Open <strong class="text-white">AI Firewall (WAF)</strong> in the sidebar.',
            'Review the <strong class="text-white">Events</strong> tab — all traffic is logged with method, path, IP, and matched rule.',
            'Go to <strong class="text-white">Rules</strong> to create custom allow/block rules by IP range, URL path, HTTP method, request header, or body pattern.',
            'Use <strong class="text-white">AI Suggest</strong> to have the AI generate rules based on recent attack patterns in your event log.',
          ]} />
        </div>

        <div>
          <h4 className="text-white font-semibold mb-3">What it detects automatically</h4>
          <Cards items={[
            { label: "SQL Injection", desc: "UNION SELECT, DROP TABLE, stacked queries, tautologies in any request parameter." },
            { label: "XSS", desc: "<script> tags, javascript: URIs, and event handler injection." },
            { label: "Path Traversal", desc: "../../etc/passwd patterns and encoded variants." },
            { label: "Command Injection", desc: "Shell metacharacters and command chaining in form inputs." },
            { label: "Prompt Injection", desc: "AI-targeted payload patterns for applications using LLMs." },
            { label: "Rate Abuse", desc: "Abnormally high request rates from a single IP or user agent." },
          ]} />
        </div>

        <div>
          <h4 className="text-white font-semibold mb-2">Firewall Events feed</h4>
          <p className="text-gray-300 text-sm">Every blocked request is logged with: timestamp, client IP, matched rule, HTTP method, path, and the matched payload. Use this feed to understand attack patterns and tune your rules. Critical events are escalated to the Findings Board automatically.</p>
        </div>
      </div>
    ),
  },

  // ── 11. SiteShield Audit ────────────────────────────────────────────────────
  {
    id: "site-shield",
    icon: <Globe className="w-5 h-5" />,
    title: "SiteShield Audit",
    color: "text-teal-400",
    content: (
      <div className="space-y-5">
        <p className="text-gray-300">SiteShield audits any public website's security posture across four dimensions and returns a letter grade (A–F) with per-check explanations.</p>

        <div>
          <h4 className="text-white font-semibold mb-3">How to run an audit</h4>
          <Steps items={[
            'Open <strong class="text-white">SiteShield Audit</strong> from the Web & Infrastructure group.',
            'Enter a domain or URL (e.g. <code class="font-mono text-sky-300">example.com</code> or <code class="font-mono text-sky-300">https://example.com</code>).',
            'Click <strong class="text-white">Scan</strong> — results appear within 5–10 seconds.',
            'Review the grade, per-check results, and remediation suggestions.',
            'Click <strong class="text-white">Add to Watchlist</strong> to monitor this domain continuously via Watch Agent.',
          ]} />
        </div>

        <div>
          <h4 className="text-white font-semibold mb-3">The four checks</h4>
          <Cards items={[
            { label: "SSL/TLS", desc: "Verifies HTTPS is enforced, the certificate is valid, not expired, and the chain is trusted." },
            { label: "Security Headers", desc: "Checks for Content-Security-Policy (CSP), HTTP Strict Transport Security (HSTS), X-Frame-Options, and X-Content-Type-Options." },
            { label: "Blacklist", desc: "Cross-references the domain against known malware and phishing threat intelligence feeds." },
            { label: "DNS Auth (SPF / DMARC)", desc: "Checks for SPF and DMARC DNS records that prevent email spoofing from the domain." },
          ]} />
        </div>

        <div>
          <h4 className="text-white font-semibold mb-2">Grade formula</h4>
          <p className="text-gray-300 text-sm">Each of the four checks contributes equally. All pass = A. One fail = B/C depending on severity. Two or more fails = D/F. A blacklisted domain always results in an F regardless of other checks.</p>
        </div>

        <Tip>Run SiteShield Audit on your own domains and on every third-party vendor or SaaS tool you share credentials with.</Tip>
      </div>
    ),
  },

  // ── 12. Watch Agent ─────────────────────────────────────────────────────────
  {
    id: "watch-agent",
    icon: <Eye className="w-5 h-5" />,
    title: "Watch Agent",
    color: "text-teal-400",
    content: (
      <div className="space-y-5">
        <p className="text-gray-300">Watch Agent continuously monitors a list of domains and alerts you when their security posture degrades — certificate expiry, removed security headers, new blacklist entries, or DNS record changes.</p>

        <div>
          <h4 className="text-white font-semibold mb-3">Setting up monitoring</h4>
          <Steps items={[
            'Open <strong class="text-white">Watch Agent</strong> from the sidebar.',
            'Click <strong class="text-white">Add Domain</strong> and enter the URL to monitor.',
            'Set a scan frequency: Hourly, Daily, or Weekly.',
            'Optionally configure alert thresholds — e.g. only alert on grade drops of two or more levels.',
            'The first scan runs immediately to establish a baseline.',
          ]} />
        </div>

        <div>
          <h4 className="text-white font-semibold mb-3">Triggers that create alerts</h4>
          <ul className="list-disc list-inside text-gray-300 text-sm space-y-1.5 ml-2">
            <li>SSL certificate expiring within 14 days</li>
            <li>A security header that was present is now missing (e.g. CSP removed)</li>
            <li>Domain newly appears on a threat intelligence blacklist</li>
            <li>SPF or DMARC record removed or changed</li>
            <li>Overall grade drops by one or more levels since last scan</li>
          </ul>
        </div>

        <div>
          <h4 className="text-white font-semibold mb-2">Alerts and findings</h4>
          <p className="text-gray-300 text-sm">Each triggered alert creates a Finding in your Findings Board with full diff details: what changed, when, and the previous vs. current value. High-severity regressions (blacklist, cert expiry) also send a notification if you have notifications enabled.</p>
        </div>
      </div>
    ),
  },

  // ── 13. CSP Builder ─────────────────────────────────────────────────────────
  {
    id: "csp-builder",
    icon: <Code2 className="w-5 h-5" />,
    title: "CSP Builder",
    color: "text-teal-400",
    content: (
      <div className="space-y-5">
        <p className="text-gray-300">The Content Security Policy (CSP) Builder helps you generate a correctly formatted CSP header for your web application — preventing XSS, clickjacking, and data injection attacks.</p>

        <div>
          <h4 className="text-white font-semibold mb-3">What is a CSP?</h4>
          <p className="text-gray-300 text-sm">A Content Security Policy is an HTTP response header that tells the browser which sources of content are allowed to load on your page. Without it, attackers can inject malicious scripts that run in your users' browsers. It is one of the most effective defenses against XSS.</p>
        </div>

        <div>
          <h4 className="text-white font-semibold mb-3">How to build your policy</h4>
          <Steps items={[
            'Open <strong class="text-white">CSP Builder</strong> from the Web & Infrastructure group.',
            'Enter your site\'s domain to auto-detect existing content sources.',
            'Toggle each directive on or off: <code class="font-mono text-sky-300">script-src</code>, <code class="font-mono text-sky-300">style-src</code>, <code class="font-mono text-sky-300">img-src</code>, <code class="font-mono text-sky-300">connect-src</code>, etc.',
            'Add custom allowed origins for each directive (e.g. CDN domains, analytics scripts).',
            'Preview the generated header string at the bottom.',
            'Copy the header and add it to your web server configuration.',
          ]} />
        </div>

        <div>
          <h4 className="text-white font-semibold mb-2">Key directives explained</h4>
          <div className="space-y-2 text-sm">
            {[
              { d: "default-src", e: "Fallback for all content types not explicitly specified." },
              { d: "script-src", e: "Controls which JavaScript sources are allowed to execute." },
              { d: "style-src", e: "Controls which CSS sources are allowed." },
              { d: "connect-src", e: "Restricts which URLs can be loaded via fetch, XHR, WebSocket." },
              { d: "frame-ancestors", e: "Prevents your page from being embedded in iframes (replaces X-Frame-Options)." },
              { d: "report-uri", e: "URL where the browser sends CSP violation reports." },
            ].map(r => (
              <div key={r.d} className="flex gap-3">
                <code className="text-sky-300 font-mono text-xs flex-shrink-0 w-36">{r.d}</code>
                <p className="text-gray-400">{r.e}</p>
              </div>
            ))}
          </div>
        </div>

        <Tip>Start with <code className="font-mono text-sky-300">Content-Security-Policy-Report-Only</code> mode first. It logs violations without blocking anything, letting you tune the policy safely before enforcing it.</Tip>
      </div>
    ),
  },

  // ── 14. Prompt Privacy Scanner ──────────────────────────────────────────────
  {
    id: "prompt-scanner",
    icon: <Search className="w-5 h-5" />,
    title: "Prompt Privacy Scanner",
    color: "text-cyan-400",
    content: (
      <div className="space-y-5">
        <p className="text-gray-300">The Prompt Privacy Scanner detects Personally Identifiable Information (PII) in text you are about to send to an AI system — preventing accidental data exposure to third-party AI platforms.</p>

        <div>
          <h4 className="text-white font-semibold mb-3">How to use it</h4>
          <Steps items={[
            'Navigate to <strong class="text-white">Prompt Privacy Scanner</strong> in the sidebar.',
            'Paste the text you intend to send to an AI platform into the input field.',
            'Click <strong class="text-white">Scan for PII</strong>.',
            'Any detected PII is highlighted with category labels.',
            'Remove or redact the flagged data before submitting to the AI platform.',
          ]} />
        </div>

        <div>
          <h4 className="text-white font-semibold mb-3">PII types detected</h4>
          <Cards items={[
            { label: "Financial", desc: "Credit card numbers (all major card types), bank account numbers, IBAN." },
            { label: "Government IDs", desc: "Social Security Numbers (SSN), passport numbers, national ID numbers." },
            { label: "Contact Info", desc: "Phone numbers (international formats), physical addresses." },
            { label: "Credentials", desc: "API keys, passwords in plaintext, private keys, tokens." },
            { label: "Health", desc: "Medical record numbers, health insurance IDs." },
            { label: "Personal", desc: "Date of birth, full name combined with other identifiers." },
          ]} />
        </div>

        <div>
          <h4 className="text-white font-semibold mb-2">Browser extension auto-detection</h4>
          <p className="text-gray-300 text-sm">With the extension installed, the PII Detector runs automatically on AI platforms (ChatGPT, Claude, Gemini, Copilot, Perplexity, Character.AI) as you type. A warning banner appears at the bottom of the screen before you submit, listing the detected PII types. AI platforms may log and train on your inputs — remove sensitive data before submitting.</p>
        </div>
      </div>
    ),
  },

  // ── 15. SOAR & Incident Response ────────────────────────────────────────────
  {
    id: "soar",
    icon: <Zap className="w-5 h-5" />,
    title: "SOAR & Incident Response",
    color: "text-amber-400",
    content: (
      <div className="space-y-5">
        <p className="text-gray-300">The SOAR (Security Orchestration, Automation, and Response) Center connects your detection findings to a structured response workflow: detect → triage → contain → remediate → resolve.</p>

        <div>
          <h4 className="text-white font-semibold mb-3">Incidents</h4>
          <p className="text-gray-300 text-sm mb-3">An incident is a structured record of a security event that requires action. Incidents can be created manually or auto-generated when correlated findings exceed a severity threshold.</p>
          <Cards items={[
            { label: "Statuses", desc: "Open → In Progress → Resolved. Each transition is timestamped for SLA tracking." },
            { label: "Severity levels", desc: "Critical / High / Medium / Low — determines escalation priority." },
            { label: "Linked findings", desc: "Attach one or more Findings Board entries to give an incident full context." },
            { label: "Incident timeline", desc: "Auto-generated audit trail of every action taken on the incident." },
          ]} />
        </div>

        <div>
          <h4 className="text-white font-semibold mb-3">Playbooks</h4>
          <p className="text-gray-300 text-sm mb-3">Playbooks are predefined step-by-step response procedures. Build them in the Playbook Builder — each step can be manual (requires human action) or automated (triggers an API call or integration action).</p>
          <Steps items={[
            'Open <strong class="text-white">SOAR</strong> → <strong class="text-white">Playbooks</strong> → <strong class="text-white">New Playbook</strong>.',
            'Name the playbook and set a trigger type (manual, auto on incident type).',
            'Add steps in order. Each step has a name, description, type (manual/automated), and optional timeout.',
            'Save the playbook. It now appears in the incident action menu.',
            'To run it: open an incident → click <strong class="text-white">Run Playbook</strong> → select the playbook.',
          ]} />
        </div>

        <div>
          <h4 className="text-white font-semibold mb-3">Integrations</h4>
          <p className="text-gray-300 text-sm mb-2">Connect Seekurify to external tools to automate notification and ticketing workflows.</p>
          <Cards items={[
            { label: "Slack", desc: "Post incident alerts to a Slack channel automatically when an incident is created or escalated." },
            { label: "PagerDuty", desc: "Trigger PagerDuty alerts for Critical incidents to wake on-call engineers." },
            { label: "Jira", desc: "Auto-create Jira tickets from incidents, syncing status changes back to Seekurify." },
            { label: "Webhooks", desc: "Send incident payloads to any HTTP endpoint for custom integrations." },
          ]} />
        </div>
      </div>
    ),
  },

  // ── 16. Findings Board ──────────────────────────────────────────────────────
  {
    id: "findings",
    icon: <ShieldCheck className="w-5 h-5" />,
    title: "Findings Board",
    color: "text-amber-400",
    content: (
      <div className="space-y-5">
        <p className="text-gray-300">The Findings Board is a central log of all security issues detected across Seekurify — from malware scans, watch agent alerts, firewall events, and manual entries. It is the starting point for triage and remediation.</p>

        <div>
          <h4 className="text-white font-semibold mb-3">Finding lifecycle</h4>
          <div className="flex items-center gap-2 text-sm text-gray-300 flex-wrap">
            {["Open", "→", "Acknowledged", "→", "In Progress", "→", "Resolved", "→", "Closed"].map((s, i) => (
              <span key={i} className={s === "→" ? "text-gray-600" : "px-2 py-0.5 bg-gray-800 border border-gray-700 rounded text-xs font-semibold"}>{s}</span>
            ))}
          </div>
        </div>

        <div>
          <h4 className="text-white font-semibold mb-3">Working with findings</h4>
          <ul className="list-disc list-inside text-gray-300 text-sm space-y-1.5 ml-2">
            <li>Filter by severity, status, source (scanner, manual, watch agent, firewall), and date range</li>
            <li>Click a finding to see full detail: description, source, evidence, affected asset, and history</li>
            <li>Assign a finding to a team member (in workspace context)</li>
            <li>Escalate to an incident via the <strong className="text-white">Create Incident</strong> button</li>
            <li>Add notes and close with a resolution summary for audit trail purposes</li>
          </ul>
        </div>

        <Tip>Set up Watch Agent and AI Firewall alerts to feed findings automatically — manually logging every issue is error-prone and unsustainable at scale.</Tip>
      </div>
    ),
  },

  // ── 17. Team Workspaces ─────────────────────────────────────────────────────
  {
    id: "workspaces",
    icon: <Users className="w-5 h-5" />,
    title: "Team Workspaces",
    color: "text-amber-400",
    content: (
      <div className="space-y-5">
        <p className="text-gray-300">Workspaces let your security team collaborate on a shared credential vault, findings board, and incident response — all with role-based access control.</p>

        <div>
          <h4 className="text-white font-semibold mb-3">Creating a workspace</h4>
          <Steps items={[
            'Open <strong class="text-white">Workspaces</strong> from the sidebar.',
            'Click <strong class="text-white">New Workspace</strong> and enter a name.',
            'Copy the invite link or enter team member email addresses to send invites.',
            'Assign roles as members accept invites.',
          ]} />
        </div>

        <div>
          <h4 className="text-white font-semibold mb-3">Roles</h4>
          <div className="space-y-2 text-sm">
            {[
              { role: "Admin", color: "text-red-300", desc: "Full access: manage members, roles, workspace settings, vault, findings, and incidents. Can delete the workspace." },
              { role: "Editor", color: "text-orange-300", desc: "Can create and edit vault entries, findings, and incidents. Cannot manage members or workspace settings." },
              { role: "Viewer", color: "text-sky-300", desc: "Read-only access to vault entries, findings, and incidents. Cannot make changes." },
            ].map(r => (
              <div key={r.role} className="flex gap-3">
                <span className={`font-bold w-16 flex-shrink-0 ${r.color}`}>{r.role}</span>
                <p className="text-gray-400">{r.desc}</p>
              </div>
            ))}
          </div>
        </div>

        <div>
          <h4 className="text-white font-semibold mb-2">Workspace Vault vs. Personal Vault</h4>
          <p className="text-gray-300 text-sm">Your personal vault is private to you. The Workspace Vault is shared among all workspace members with Editor or Admin roles. Credentials added to the Workspace Vault are encrypted with a workspace key, not your personal PIN.</p>
        </div>
      </div>
    ),
  },

  // ── 18. Log Report ──────────────────────────────────────────────────────────
  {
    id: "log-report",
    icon: <FileText className="w-5 h-5" />,
    title: "Log Report",
    color: "text-gray-400",
    content: (
      <div className="space-y-5">
        <p className="text-gray-300">The Log Report page provides a downloadable, filterable view of all activity logs across your account — suitable for compliance reporting, audits, or forensic investigation.</p>

        <div>
          <h4 className="text-white font-semibold mb-3">Log categories</h4>
          <Cards items={[
            { label: "Authentication Logs", desc: "All login and logout events, including failed attempts, IP addresses, and device fingerprints." },
            { label: "Password Events", desc: "Every add, edit, delete, view, and share operation on vault entries, with timestamps." },
            { label: "Scan Logs", desc: "Results from phishing scans, malware analyses, site audits, and injection scans." },
            { label: "Admin Actions", desc: "Workspace member changes, role updates, and settings modifications." },
            { label: "Threat Events", desc: "Firewall blocks, watch agent alerts, and SOAR incident actions." },
          ]} />
        </div>

        <div>
          <h4 className="text-white font-semibold mb-3">Filtering and exporting</h4>
          <ul className="list-disc list-inside text-gray-300 text-sm space-y-1.5 ml-2">
            <li>Filter by log category, severity, date range, user, and IP address</li>
            <li>Search by keyword across log messages</li>
            <li>Export filtered results as <strong className="text-white">CSV</strong> or <strong className="text-white">JSON</strong> for external SIEM ingestion</li>
          </ul>
        </div>

        <Tip>For compliance purposes, export monthly log reports and store them in a secure, access-controlled location outside Seekurify.</Tip>
      </div>
    ),
  },

  // ── 19. Security Awareness ──────────────────────────────────────────────────
  {
    id: "security-awareness",
    icon: <ShieldCheck className="w-5 h-5" />,
    title: "Security Awareness",
    color: "text-lime-400",
    content: (
      <div className="space-y-5">
        <p className="text-gray-300">The Security Awareness module provides educational content, tips, and best-practice guidance to help you and your team build lasting secure habits.</p>

        <Cards items={[
          { label: "Strong Passwords", desc: "Why length beats complexity, how to use a passphrase, and what makes a password truly strong." },
          { label: "Two-Factor Authentication", desc: "The difference between SMS OTP, authenticator apps, and hardware keys — and why MFA is non-negotiable." },
          { label: "Phishing Awareness", desc: "How to spot phishing emails, smishing, vishing, and QR code phishing — with real examples." },
          { label: "Safe Browsing", desc: "How to verify URLs before clicking, recognize HTTPS, and avoid malicious redirects." },
          { label: "Public Wi-Fi Risks", desc: "Why public networks are dangerous and how to stay protected with a VPN." },
          { label: "Data Backup", desc: "The 3-2-1 backup rule and how to recover from ransomware without paying." },
          { label: "Device Security", desc: "Keeping OS and apps updated, full-disk encryption, and screen lock policies." },
          { label: "AI Prompt Safety", desc: "Risks of sharing sensitive data with AI platforms and how the Seekurify extension protects you." },
        ]} />
      </div>
    ),
  },

  // ── 20. Browser Extension ───────────────────────────────────────────────────
  {
    id: "extension",
    icon: <Puzzle className="w-5 h-5" />,
    title: "Browser Extension",
    color: "text-lime-400",
    badge: "5 monitors",
    content: (
      <div className="space-y-6">
        <p className="text-gray-300">The Seekurify browser extension runs five real-time security monitors silently in the background. It injects contextual warnings and tooltips directly into the pages you visit — no switching tabs, no copy-pasting, no manual scanning.</p>

        {/* Installation */}
        <div>
          <h4 className="text-white font-semibold mb-3">Installation</h4>
          <Steps items={[
            'Open Chrome and go to the <strong class="text-white">Chrome Web Store</strong>. Search for <strong class="text-white">Seekurify</strong>.',
            'Click <strong class="text-white">Add to Chrome</strong>, then confirm by clicking <strong class="text-white">Add extension</strong> in the dialog.',
            'Once installed, click the puzzle-piece icon in the Chrome toolbar and pin Seekurify so it stays visible.',
            'Click the Seekurify shield icon to open the popup. All five monitors are enabled by default.',
          ]} />
          <Tip>The extension works entirely in your browser. None of your typed text, passwords, or visited URLs are uploaded — all scanning happens locally unless you explicitly trigger an AI-assisted scan.</Tip>
        </div>

        {/* Popup overview */}
        <div>
          <h4 className="text-white font-semibold mb-3">Extension popup overview</h4>
          <p className="text-gray-300 text-sm mb-3">Clicking the Seekurify icon opens the popup, which has three sections:</p>
          <div className="space-y-2">
            {[
              { label: "Site Audit Panel", desc: "Shows the security grade of the current website in real time — SSL, security headers, blacklist status, and DNS authentication (SPF/DMARC). Each check shows a pass/fail icon and a one-line explanation of the result." },
              { label: "Breach Checker", desc: "Enter an email address to run a Have I Been Pwned lookup without leaving the page. Results show every breach the email appears in, with the breach date and exposed data types." },
              { label: "Monitor Toggles", desc: "Enable or disable each of the five monitors individually. Changes take effect immediately — no restart required." },
            ].map(c => (
              <div key={c.label} className="bg-gray-800 border border-gray-700 rounded-lg p-3">
                <p className="text-white text-sm font-semibold">{c.label}</p>
                <p className="text-gray-400 text-xs mt-1 leading-relaxed">{c.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Monitor 1 — Link Scanner */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-3">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-orange-400 flex-shrink-0" />
            <h4 className="text-orange-300 font-semibold">Monitor 1 — Link Scanner</h4>
          </div>
          <p className="text-gray-300 text-sm">The Link Scanner evaluates every hyperlink on every webpage you visit. Hover any link to see a risk tooltip appear below it.</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
            {[
              { verdict: "SAFE", color: "text-green-400 bg-green-900/30 border-green-800", desc: "No threat signals detected." },
              { verdict: "SUSPICIOUS", color: "text-orange-400 bg-orange-900/30 border-orange-800", desc: "One or more risk flags — proceed with caution." },
              { verdict: "MALICIOUS", color: "text-red-400 bg-red-900/30 border-red-800", desc: "High-confidence threat. Do not visit." },
            ].map(v => (
              <div key={v.verdict} className={`rounded-lg border p-2 ${v.color}`}>
                <p className="font-bold tracking-wide">{v.verdict}</p>
                <p className="mt-0.5 opacity-80">{v.desc}</p>
              </div>
            ))}
          </div>
          <div>
            <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider mb-2">What triggers a flag</p>
            <ul className="space-y-1 text-xs text-gray-300">
              {[
                ["Data URI link", "95 pts — Link encodes an entire page inline, used to hide phishing pages from URL scanners."],
                ["Credentials in URL authority", "75 pts — Username:password embedded in the URL (e.g. https://user:pass@evil.com)."],
                ["Brand spoofed in non-official domain", "85 pts — e.g. paypal-secure.com contains \"paypal\" but isn't paypal.com."],
                ["Internationalized domain (homograph)", "40 pts — Uses look-alike Unicode characters (e.g. Cyrillic \"а\" instead of Latin \"a\")."],
                ["IP address as hostname", "35 pts — Legitimate sites use domain names, not raw IPs (e.g. http://192.168.1.1/login)."],
                ["URL shortener", "25 pts — Destination is hidden behind a shortener (bit.ly, tinyurl, etc.)."],
                ["High-risk free TLD", "35 pts — Domain uses .tk, .ml, .ga, .xyz, .click, or other frequently-abused free TLDs."],
                ["Nested redirect", "40 pts — URL contains another full URL inside it, used to bypass filters."],
              ].map(([flag, reason]) => (
                <li key={flag} className="flex gap-2">
                  <span className="text-orange-400 font-semibold flex-shrink-0">{flag}</span>
                  <span className="text-gray-400">{reason}</span>
                </li>
              ))}
            </ul>
          </div>
          <p className="text-gray-400 text-xs">Score = sum of all matched flag weights, capped at 100. The tooltip also shows the risk bar, the primary reason, and an AI badge if the result was verified server-side.</p>
        </div>

        {/* Monitor 2 — Phishing Checker */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-3">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-red-400 flex-shrink-0" />
            <h4 className="text-red-300 font-semibold">Monitor 2 — Phishing Checker</h4>
          </div>
          <p className="text-gray-300 text-sm">Automatically scans the body of every email you open — no copy-pasting required. A warning banner slides in above the email if phishing signals are found.</p>
          <div>
            <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider mb-2">Supported email platforms</p>
            <div className="flex flex-wrap gap-1.5">
              {["Gmail", "Outlook (live.com)", "Outlook (office.com / office365.com)", "Yahoo Mail", "ProtonMail"].map(p => (
                <span key={p} className="text-xs bg-gray-800 border border-gray-700 text-gray-300 px-2 py-0.5 rounded">{p}</span>
              ))}
            </div>
          </div>
          <div>
            <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider mb-2">What appears in the warning banner</p>
            <ul className="text-xs text-gray-300 space-y-1 list-disc list-inside ml-1">
              <li>Risk score badge (e.g. <span className="text-red-300 font-semibold">87/100 · CRITICAL</span>) with color coding</li>
              <li>Pill tags for each triggered signal (e.g. <span className="text-orange-300">Urgency pressure</span>, <span className="text-red-300">Credential request</span>)</li>
              <li>Score formula note: Critical +35 pts, High +20, Medium +10, Low +5 — so you understand how the score was reached</li>
              <li><span className="text-sky-300">Verified by Seekurify AI</span> badge when the AI backend has confirmed the result</li>
            </ul>
          </div>
          <div>
            <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider mb-2">Spear phishing banner (separate)</p>
            <p className="text-gray-300 text-xs">For substantial emails (150+ characters), the extension also runs an AI spear phishing check. If the AI detects targeting signals, a second pink banner appears below the first showing: targeting level (Generic / Targeted / Highly Targeted), AI-written probability %, attack vector (Credential Harvest / Wire Transfer / etc.), suspicious absences (red flags that are <em>missing</em> — itself suspicious), and any lookalike domains found in the email body.</p>
          </div>
          <Tip>The phishing checker rescans each time you open a new email. It does not persist banners between messages — dismiss or ignore a banner and it clears when you move to the next email.</Tip>
        </div>

        {/* Monitor 3 — PII Detector */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-3">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-yellow-400 flex-shrink-0" />
            <h4 className="text-yellow-300 font-semibold">Monitor 3 — PII Detector</h4>
          </div>
          <p className="text-gray-300 text-sm">Watches the AI chat input box as you type. If it detects Personally Identifiable Information (PII), a warning banner appears at the bottom of the screen before you submit — giving you a chance to remove or redact it first.</p>
          <div>
            <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider mb-2">Supported AI platforms</p>
            <div className="flex flex-wrap gap-1.5">
              {["ChatGPT / chatgpt.com", "Claude / claude.ai", "Gemini / gemini.google.com", "Microsoft Copilot", "Bing AI", "Perplexity", "Character.AI"].map(p => (
                <span key={p} className="text-xs bg-gray-800 border border-gray-700 text-gray-300 px-2 py-0.5 rounded">{p}</span>
              ))}
            </div>
          </div>
          <div>
            <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider mb-2">PII categories detected</p>
            <div className="grid grid-cols-2 gap-1.5 text-xs">
              {[
                ["SSN", "Social Security Numbers — formats like 123-45-6789"],
                ["Credit Card", "Visa, Mastercard, Amex, Discover — all major card types"],
                ["Passport", "International passport number formats"],
                ["Phone Number", "US and international number formats"],
                ["API Key / Token", "Common patterns for AWS, GitHub, Stripe, and generic bearer tokens"],
                ["Private Key", "PEM-format private keys (RSA, EC, OpenSSH)"],
                ["Date of Birth", "Explicit DOB patterns combined with other identifiers"],
                ["Medical ID", "Health insurance and medical record number patterns"],
              ].map(([type, desc]) => (
                <div key={type} className="bg-gray-800 rounded p-2">
                  <p className="text-yellow-300 font-semibold">{type}</p>
                  <p className="text-gray-400 mt-0.5">{desc}</p>
                </div>
              ))}
            </div>
          </div>
          <div>
            <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider mb-1">How the banner works</p>
            <p className="text-gray-300 text-xs">The banner appears at the bottom of the screen after a 700 ms typing pause. It shows a pill tag for each PII type detected. Dismiss the banner, remove the sensitive data from your prompt, then re-type — the banner will disappear once no PII is detected. The banner also fires on submit (Enter key or send button click) as a final gate.</p>
          </div>
          <Warning>AI platforms like ChatGPT and Claude may log and train on your prompts. Even if a session is marked "temporary", the platform's data retention policy governs what is stored. Remove all real credentials, SSNs, and personal identifiers before submitting.</Warning>
        </div>

        {/* Monitor 4 — Injection Checker */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-3">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-cyan-400 flex-shrink-0" />
            <h4 className="text-cyan-300 font-semibold">Monitor 4 — Injection Checker</h4>
          </div>
          <p className="text-gray-300 text-sm">Runs on the same AI platforms as the PII Detector. Detects injection attack patterns in your prompt before you submit — protecting you from accidentally sending test payloads, and helping developers validate inputs in real time.</p>
          <div>
            <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider mb-2">Injection categories detected</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              {[
                { cat: "SQL Injection", color: "text-red-300", examples: "UNION SELECT, DROP TABLE, DELETE FROM, stacked queries (;SELECT), SQL tautologies (OR 1=1), comment bypasses (-- , /**/, #)" },
                { cat: "Prompt Injection / Jailbreak", color: "text-orange-300", examples: '"Ignore all previous instructions", "override your safety guidelines", "DAN mode", "act as [unrestricted AI]", context wipe ("forget everything")' },
                { cat: "Shell / Command Injection", color: "text-yellow-300", examples: "; ls, && curl, | bash, subshell execution $(...), piped shell commands" },
                { cat: "Other Injections", color: "text-sky-300", examples: "XSS (<script>, javascript:), path traversal (../../etc), template injection ({{...}}, ${...}), LDAP injection, token manipulation" },
              ].map(c => (
                <div key={c.cat} className="bg-gray-800 rounded-lg p-3">
                  <p className={`font-semibold mb-1 ${c.color}`}>{c.cat}</p>
                  <p className="text-gray-400 leading-relaxed">{c.examples}</p>
                </div>
              ))}
            </div>
          </div>
          <div>
            <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider mb-1">Severity levels</p>
            <div className="flex gap-3 text-xs flex-wrap">
              <span className="px-2 py-0.5 rounded bg-red-900/50 text-red-300 border border-red-800">Critical — blocks or manipulates AI/DB directly</span>
              <span className="px-2 py-0.5 rounded bg-orange-900/50 text-orange-300 border border-orange-800">High — significant risk of misuse</span>
              <span className="px-2 py-0.5 rounded bg-yellow-900/50 text-yellow-300 border border-yellow-800">Medium — context-dependent risk</span>
            </div>
          </div>
          <p className="text-gray-300 text-xs">The banner (top of screen) shows the highest-severity finding first, with pill tags for all detected patterns. An AI backend scan runs 3 seconds after you stop typing to catch patterns the local regex may have missed — if it finds more, the banner updates with a "Verified by Seekurify AI" badge.</p>
        </div>

        {/* Monitor 5 — Password Generator */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-3">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-lime-400 flex-shrink-0" />
            <h4 className="text-lime-300 font-semibold">Monitor 5 — Password Generator</h4>
          </div>
          <p className="text-gray-300 text-sm">A full-featured password generator built into the extension popup. Accessible on any page without leaving the tab.</p>
          <Steps items={[
            'Click the Seekurify icon in your toolbar to open the popup.',
            'Navigate to the <strong class="text-white">Generator</strong> tab.',
            'Set the password length using the slider (8–64 characters).',
            'Toggle character sets: <strong class="text-white">Uppercase</strong>, <strong class="text-white">Digits</strong>, <strong class="text-white">Symbols</strong>.',
            'The strength bar and label (Very Weak / Weak / Fair / Good / Strong) update in real time.',
            'Click <strong class="text-white">Copy</strong> to copy the password to your clipboard, then paste it into the signup or password-change form.',
          ]} />
          <div>
            <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider mb-2">Strength scoring</p>
            <p className="text-gray-300 text-xs">Strength is scored on 5 criteria (1 point each): length ≥ 12, length ≥ 16, contains uppercase, contains digits, contains symbols. The label and bar color reflect the score: Very Weak (0–1) → red, Weak (2) → orange, Fair (3) → yellow, Good (4) → blue, Strong (5) → green.</p>
          </div>
        </div>

        {/* Disabling / Enabling */}
        <div>
          <h4 className="text-white font-semibold mb-3">Enabling and disabling monitors</h4>
          <p className="text-gray-300 text-sm mb-3">Each monitor can be toggled independently from the popup. Toggles persist across browser sessions — you only need to configure them once.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-gray-300">
            {[
              { toggle: "Link Scanning", storage: "link_scan_enabled" },
              { toggle: "Phishing Detection", storage: "phishing_monitoring_enabled" },
              { toggle: "PII Detection", storage: "pii_monitoring_enabled" },
              { toggle: "Injection Detection", storage: "injection_monitoring_enabled" },
            ].map(t => (
              <div key={t.toggle} className="flex items-center justify-between bg-gray-800 rounded-lg px-3 py-2 border border-gray-700">
                <span className="font-semibold">{t.toggle}</span>
                <code className="text-gray-500 font-mono">{t.storage}</code>
              </div>
            ))}
          </div>
        </div>

        <Tip>All five monitors run independently. Disabling one (e.g. Injection Detection on a non-AI site) does not affect the others. Re-enable at any time from the popup.</Tip>
      </div>
    ),
  },

  // ── 21. Pricing ─────────────────────────────────────────────────────────────
  {
    id: "pricing",
    icon: <CreditCard className="w-5 h-5" />,
    title: "Pricing & Plans",
    color: "text-gray-400",
    content: (
      <div className="space-y-5">
        <p className="text-gray-300">Seekurify offers tiered plans for individuals, teams, and enterprises. Feature access is controlled by your plan level.</p>

        <Cards items={[
          { label: "Free", desc: "Password Manager (up to 10 entries), basic phishing rule scan, breach check (3 lookups/day), browser extension." },
          { label: "Pro", desc: "Unlimited password entries, AI phishing + spear phishing scan, malware analyzer, SIEM dashboard, SiteShield audit, Watch Agent (5 domains)." },
          { label: "Premium", desc: "Everything in Pro plus AI Security Suite (Red-Team, Agent Scanner, Injection Scanner), AI Firewall, SOAR Center, unlimited Watch Agent domains, Log Reports." },
          { label: "Enterprise", desc: "Everything in Premium plus Team Workspaces, custom integrations, SSO, audit log export, dedicated support, and SLA." },
        ]} />

        <p className="text-gray-300 text-sm">Feature flags control which sections of the app are visible based on your plan. If you see a feature in the sidebar but cannot access it, your current plan does not include it — visit the <strong className="text-white">Pricing</strong> page to upgrade.</p>

        <div>
          <h4 className="text-white font-semibold mb-2">Free trial</h4>
          <p className="text-gray-300 text-sm">Most paid features offer a 14-day free trial. Click <strong className="text-white">Try Free</strong> on any locked feature to activate the trial. No credit card required for the trial period.</p>
        </div>
      </div>
    ),
  },
];

// ── Page component ─────────────────────────────────────────────────────────────

const UserGuide: React.FC = () => {
  const navigate = useNavigate();
  const [open, setOpen] = useState<string | null>("getting-started");
  const [search, setSearch] = useState("");
  const [sidebarExpanded, setSidebarExpanded] = useState(true);
  const token = localStorage.getItem("token") || "";
  const isLoggedIn = !!token;

  const filtered = SECTIONS.filter(s =>
    s.title.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="bg-gradient-to-br from-gray-900 via-black to-gray-800 min-h-screen flex flex-col text-white">
      {isLoggedIn && (
        <Header
          token={token}
          handleLogout={() => {
            localStorage.removeItem("token");
            navigate("/login");
          }}
        />
      )}

      <div className="flex flex-1 overflow-hidden">
        {isLoggedIn && (
          <AppSidebar sidebarExpanded={sidebarExpanded} setSidebarExpanded={setSidebarExpanded} />
        )}

        <main className="flex-1 overflow-y-auto">
          <div className="max-w-4xl mx-auto px-6 py-10">

            {/* Page header */}
            <div className="mb-8">
              <div className="flex items-center gap-3 mb-2">
                <BookOpen className="w-8 h-8 text-sky-400" />
                <h1 className="text-3xl font-bold text-white">User Guide</h1>
              </div>
              <p className="text-gray-400">Complete documentation for every Seekurify feature — {SECTIONS.length} sections.</p>
            </div>

            {/* Quick nav pills */}
            <div className="flex flex-wrap gap-2 mb-6">
              {SECTIONS.map(s => (
                <button
                  key={s.id}
                  onClick={() => { setSearch(""); setOpen(s.id); setTimeout(() => document.getElementById(`section-${s.id}`)?.scrollIntoView({ behavior: "smooth", block: "start" }), 50); }}
                  className="text-xs px-2.5 py-1 rounded-full bg-gray-800 border border-gray-700 text-gray-300 hover:border-sky-500 hover:text-white transition-colors"
                >
                  {s.title}
                </button>
              ))}
            </div>

            {/* Search */}
            <div className="relative mb-6">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input
                type="text"
                placeholder="Search sections…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 rounded-lg bg-gray-800 border border-gray-700 text-white placeholder-gray-500 focus:outline-none focus:border-sky-500 text-sm"
              />
            </div>

            {/* Accordion */}
            <div className="space-y-2">
              {filtered.length === 0 && (
                <p className="text-gray-500 text-sm text-center py-12">No sections match "{search}"</p>
              )}
              {filtered.map(section => (
                <div
                  key={section.id}
                  id={`section-${section.id}`}
                  className="bg-gray-900/80 border border-gray-800 rounded-xl overflow-hidden"
                >
                  <button
                    onClick={() => setOpen(open === section.id ? null : section.id)}
                    className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-gray-800/60 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <span className={section.color}>{section.icon}</span>
                      <span className="text-white font-semibold">{section.title}</span>
                      {section.badge && (
                        <span className="text-[10px] px-1.5 py-0.5 bg-gray-800 border border-gray-600 text-gray-400 rounded">{section.badge}</span>
                      )}
                    </div>
                    {open === section.id
                      ? <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />
                      : <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />}
                  </button>
                  {open === section.id && (
                    <div className="px-5 pb-6 pt-2 border-t border-gray-800">
                      {section.content}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Footer CTA */}
            <div className="mt-10 bg-gray-900 border border-gray-700 rounded-xl p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <p className="text-white font-semibold">Still have questions?</p>
                <p className="text-gray-400 text-sm mt-0.5">Our support team is ready to help.</p>
              </div>
              <button
                onClick={() => navigate("/contact")}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-sm font-semibold transition-colors"
              >
                Contact Support <ExternalLink className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <Footer />
        </main>
      </div>
    </div>
  );
};

export default UserGuide;
