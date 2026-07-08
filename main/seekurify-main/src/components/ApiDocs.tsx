import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Code2, ChevronDown, ChevronRight, ArrowLeft, Copy, Check,
  KeyRound, Shield, FileSearch, Globe, Bot, Activity,
  Zap, Users, BarChart3,
} from "lucide-react";
import Header from "./ui/Header";
import Footer from "./ui/Footer";
import AppSidebar from "./ui/AppSidebar";

// ── Types ──────────────────────────────────────────────────────────────────────

interface Param {
  name: string;
  type: string;
  required: boolean;
  desc: string;
}

interface Endpoint {
  method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  path: string;
  auth: boolean;
  summary: string;
  params?: Param[];
  bodyParams?: Param[];
  responseExample?: string;
}

interface ApiGroup {
  id: string;
  icon: React.ReactElement;
  title: string;
  color: string;
  baseUrl: string;
  description: string;
  endpoints: Endpoint[];
}

// ── Method badge colours ───────────────────────────────────────────────────────

const METHOD_STYLE: Record<string, string> = {
  GET:    "bg-sky-900/60 text-sky-300 border-sky-700",
  POST:   "bg-emerald-900/60 text-emerald-300 border-emerald-700",
  PUT:    "bg-amber-900/60 text-amber-300 border-amber-700",
  DELETE: "bg-red-900/60 text-red-300 border-red-700",
  PATCH:  "bg-violet-900/60 text-violet-300 border-violet-700",
};

// ── API groups data ────────────────────────────────────────────────────────────

const API_GROUPS: ApiGroup[] = [
  {
    id: "auth",
    icon: <KeyRound className="w-5 h-5" />,
    title: "Authentication",
    color: "text-sky-400",
    baseUrl: "/api/auth",
    description: "Register, log in, and manage user sessions. Most protected endpoints require a Bearer token returned from login.",
    endpoints: [
      {
        method: "POST", path: "/api/auth/signup", auth: false,
        summary: "Create a new user account.",
        bodyParams: [
          { name: "email", type: "string", required: true, desc: "User email address" },
          { name: "password", type: "string", required: true, desc: "Password (min 8 characters)" },
          { name: "name", type: "string", required: false, desc: "Display name" },
        ],
        responseExample: `{ "message": "User created", "token": "<jwt>" }`,
      },
      {
        method: "POST", path: "/api/login", auth: false,
        summary: "Authenticate and receive a JWT.",
        bodyParams: [
          { name: "email", type: "string", required: true, desc: "Registered email" },
          { name: "password", type: "string", required: true, desc: "Account password" },
        ],
        responseExample: `{ "token": "<jwt>", "user": { "_id": "…", "email": "…" } }`,
      },
      {
        method: "POST", path: "/api/auth/forgot-password", auth: false,
        summary: "Send a password-reset email.",
        bodyParams: [{ name: "email", type: "string", required: true, desc: "Email of the account to reset" }],
        responseExample: `{ "message": "Reset email sent" }`,
      },
    ],
  },
  {
    id: "passwords",
    icon: <KeyRound className="w-5 h-5" />,
    title: "Password Vault",
    color: "text-sky-400",
    baseUrl: "/api/passwords",
    description: "CRUD operations for the encrypted password vault. All routes require authentication.",
    endpoints: [
      {
        method: "GET", path: "/api/passwords", auth: true,
        summary: "List all passwords for the authenticated user.",
        responseExample: `[{ "_id": "…", "website": "github.com", "username": "user@example.com", "riskScore": 72 }]`,
      },
      {
        method: "POST", path: "/api/passwords", auth: true,
        summary: "Add a new password entry.",
        bodyParams: [
          { name: "website", type: "string", required: true, desc: "Domain or site name" },
          { name: "username", type: "string", required: true, desc: "Login username or email" },
          { name: "password", type: "string", required: true, desc: "Plaintext password (encrypted server-side)" },
          { name: "isFinancial", type: "boolean", required: false, desc: "Mark as a financial account" },
        ],
        responseExample: `{ "_id": "…", "website": "github.com", "createdAt": "…" }`,
      },
      {
        method: "PUT", path: "/api/passwords/:id", auth: true,
        summary: "Update an existing password entry.",
        params: [{ name: "id", type: "string", required: true, desc: "Password document ID" }],
        bodyParams: [
          { name: "website", type: "string", required: false, desc: "Updated site name" },
          { name: "password", type: "string", required: false, desc: "New password" },
        ],
        responseExample: `{ "message": "Updated" }`,
      },
      {
        method: "DELETE", path: "/api/passwords/:id", auth: true,
        summary: "Delete a password entry.",
        params: [{ name: "id", type: "string", required: true, desc: "Password document ID" }],
        responseExample: `{ "message": "Deleted" }`,
      },
      {
        method: "POST", path: "/api/passwords/share", auth: true,
        summary: "Generate a time-limited share link for a password.",
        bodyParams: [
          { name: "passwordId", type: "string", required: true, desc: "ID of the password to share" },
          { name: "pin", type: "string", required: true, desc: "PIN to protect the share link" },
          { name: "expiresIn", type: "number", required: false, desc: "TTL in minutes (default: 60)" },
        ],
        responseExample: `{ "shareUrl": "https://…/share/<token>" }`,
      },
    ],
  },
  {
    id: "malware",
    icon: <FileSearch className="w-5 h-5" />,
    title: "Malware Analysis",
    color: "text-red-400",
    baseUrl: "/api/malware-analysis",
    description: "Submit files or code snippets for malware scanning. Requires authentication.",
    endpoints: [
      {
        method: "POST", path: "/api/malware-analysis/scan", auth: true,
        summary: "Scan a file for malware. Send as multipart/form-data.",
        bodyParams: [
          { name: "file", type: "file", required: true, desc: "File to analyze (max 10 MB)" },
        ],
        responseExample: `{ "verdict": "suspicious", "indicators": ["Obfuscated JS detected", "eval() with encoded string"], "score": 68 }`,
      },
      {
        method: "POST", path: "/api/malware-analysis/scan-text", auth: true,
        summary: "Scan a code or text snippet.",
        bodyParams: [
          { name: "content", type: "string", required: true, desc: "Text or code to scan" },
          { name: "language", type: "string", required: false, desc: "Hint: 'javascript', 'powershell', 'python'" },
        ],
        responseExample: `{ "verdict": "clean", "indicators": [], "score": 0 }`,
      },
    ],
  },
  {
    id: "site-audit",
    icon: <Globe className="w-5 h-5" />,
    title: "Site Audit",
    color: "text-teal-400",
    baseUrl: "/api",
    description: "Audit a domain's security posture. No authentication required.",
    endpoints: [
      {
        method: "POST", path: "/api/site-audit", auth: false,
        summary: "Run a full security audit on a domain.",
        bodyParams: [
          { name: "url", type: "string", required: true, desc: "Domain or URL to audit (e.g. example.com)" },
        ],
        responseExample: `{ "grade": "B", "ssl": true, "headers": false, "blacklist": true, "dns": { "spf": true, "dmarc": false } }`,
      },
    ],
  },
  {
    id: "ai-security",
    icon: <Bot className="w-5 h-5" />,
    title: "AI Security Suite",
    color: "text-cyan-400",
    baseUrl: "/api/ai",
    description: "AI-driven threat analysis endpoints. Require authentication.",
    endpoints: [
      {
        method: "POST", path: "/api/ai/injection-scan", auth: true,
        summary: "Scan text for prompt injection, SQLi, XSS, and shell injection patterns.",
        bodyParams: [
          { name: "text", type: "string", required: true, desc: "Text to scan" },
          { name: "platform", type: "string", required: false, desc: "AI platform context (e.g. 'ChatGPT')" },
        ],
        responseExample: `{ "findings": [{ "type": "ignore_instr", "label": "Ignore instructions", "severity": "critical" }] }`,
      },
      {
        method: "POST", path: "/api/ai/pii-scan", auth: true,
        summary: "Detect PII (SSN, credit cards, passport numbers, etc.) in text.",
        bodyParams: [
          { name: "text", type: "string", required: true, desc: "Text to check for PII" },
        ],
        responseExample: `{ "hasPii": true, "types": ["Credit Card", "SSN"], "count": 2 }`,
      },
      {
        method: "POST", path: "/api/ai/red-team", auth: true,
        summary: "Run an AI red-team simulation against a target.",
        bodyParams: [
          { name: "target", type: "string", required: true, desc: "Target URL" },
          { name: "attackType", type: "string", required: true, desc: "Attack category: 'sqli' | 'xss' | 'ssrf' | 'lfi'" },
        ],
        responseExample: `{ "results": [{ "payload": "…", "response": "…", "vulnerable": false }] }`,
      },
    ],
  },
  {
    id: "risk-score",
    icon: <Activity className="w-5 h-5" />,
    title: "Risk Scoring",
    color: "text-sky-400",
    baseUrl: "/api/risk-score",
    description: "Compute and retrieve credential risk scores. Requires authentication.",
    endpoints: [
      {
        method: "POST", path: "/api/risk-score/compute", auth: true,
        summary: "Re-compute risk scores for all passwords of the authenticated user.",
        responseExample: `{ "scored": 12, "results": [{ "_id": "…", "score": 85, "level": "critical", "summary": "Breached and reused" }] }`,
      },
    ],
  },
  {
    id: "hibp",
    icon: <Shield className="w-5 h-5" />,
    title: "Breach Lookup (HIBP)",
    color: "text-sky-400",
    baseUrl: "/api/hibp",
    description: "Check email addresses and passwords against Have I Been Pwned. Uses k-anonymity — only the first 5 characters of a hashed value are transmitted.",
    endpoints: [
      {
        method: "POST", path: "/api/hibp/check-email", auth: false,
        summary: "Check if an email appears in any known breach.",
        bodyParams: [{ name: "email", type: "string", required: true, desc: "Email address to check" }],
        responseExample: `{ "breached": true, "breaches": [{ "Name": "LinkedIn", "BreachDate": "2012-05-05", "PwnCount": 164611595 }] }`,
      },
      {
        method: "POST", path: "/api/hibp/check-password", auth: false,
        summary: "Check if a password hash prefix appears in HIBP (k-anonymous).",
        bodyParams: [{ name: "password", type: "string", required: true, desc: "Plaintext password (hashed locally before transmission)" }],
        responseExample: `{ "pwned": true, "count": 3456 }`,
      },
    ],
  },
  {
    id: "findings",
    icon: <Zap className="w-5 h-5" />,
    title: "Findings & SOAR",
    color: "text-amber-400",
    baseUrl: "/api",
    description: "Manage security findings, incidents, and playbooks. All routes require authentication.",
    endpoints: [
      {
        method: "GET", path: "/api/findings", auth: true,
        summary: "List all findings for the authenticated user or workspace.",
        responseExample: `[{ "_id": "…", "title": "High-risk password detected", "severity": "high", "status": "open" }]`,
      },
      {
        method: "POST", path: "/api/findings", auth: true,
        summary: "Create a new finding manually.",
        bodyParams: [
          { name: "title", type: "string", required: true, desc: "Short finding title" },
          { name: "severity", type: "string", required: true, desc: "'critical' | 'high' | 'medium' | 'low'" },
          { name: "description", type: "string", required: false, desc: "Detailed description" },
        ],
        responseExample: `{ "_id": "…", "title": "…", "createdAt": "…" }`,
      },
      {
        method: "GET", path: "/api/incidents", auth: true,
        summary: "List all incidents.",
        responseExample: `[{ "_id": "…", "title": "…", "status": "open", "severity": "critical" }]`,
      },
      {
        method: "POST", path: "/api/incidents", auth: true,
        summary: "Create a new incident.",
        bodyParams: [
          { name: "title", type: "string", required: true, desc: "Incident title" },
          { name: "severity", type: "string", required: true, desc: "'critical' | 'high' | 'medium' | 'low'" },
          { name: "type", type: "string", required: false, desc: "Incident type category" },
        ],
        responseExample: `{ "_id": "…", "status": "open" }`,
      },
      {
        method: "GET", path: "/api/playbooks", auth: true,
        summary: "List all playbooks.",
        responseExample: `[{ "_id": "…", "name": "Password Breach Response", "steps": 4 }]`,
      },
      {
        method: "POST", path: "/api/playbook-runs", auth: true,
        summary: "Trigger a playbook run against an incident.",
        bodyParams: [
          { name: "playbookId", type: "string", required: true, desc: "Playbook to execute" },
          { name: "incidentId", type: "string", required: true, desc: "Target incident" },
        ],
        responseExample: `{ "runId": "…", "status": "running" }`,
      },
    ],
  },
  {
    id: "workspaces",
    icon: <Users className="w-5 h-5" />,
    title: "Team Workspaces",
    color: "text-amber-400",
    baseUrl: "/api",
    description: "Create and manage shared team workspaces. Requires authentication.",
    endpoints: [
      {
        method: "GET", path: "/api/workspaces", auth: true,
        summary: "List all workspaces the current user belongs to.",
        responseExample: `[{ "_id": "…", "name": "Security Team", "role": "admin" }]`,
      },
      {
        method: "POST", path: "/api/workspaces", auth: true,
        summary: "Create a new workspace.",
        bodyParams: [{ name: "name", type: "string", required: true, desc: "Workspace name" }],
        responseExample: `{ "_id": "…", "name": "…", "inviteCode": "…" }`,
      },
      {
        method: "POST", path: "/api/workspaces/invite", auth: true,
        summary: "Invite a user to a workspace by email.",
        bodyParams: [
          { name: "workspaceId", type: "string", required: true, desc: "Target workspace" },
          { name: "email", type: "string", required: true, desc: "Email to invite" },
          { name: "role", type: "string", required: false, desc: "'admin' | 'editor' | 'viewer' (default: viewer)" },
        ],
        responseExample: `{ "message": "Invite sent" }`,
      },
    ],
  },
];

// ── Sub-components ─────────────────────────────────────────────────────────────

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
      className="p-1 rounded text-gray-500 hover:text-gray-300 transition-colors"
      title="Copy"
    >
      {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  );
}

function EndpointCard({ ep }: { ep: Endpoint }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-gray-800 rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left bg-gray-900 hover:bg-gray-800/60 transition-colors"
      >
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${METHOD_STYLE[ep.method]} font-mono`}>{ep.method}</span>
        <code className="text-gray-200 text-sm font-mono flex-1 min-w-0 truncate">{ep.path}</code>
        {ep.auth && (
          <span className="text-[10px] bg-amber-900/50 text-amber-300 border border-amber-700 px-1.5 py-0.5 rounded font-semibold flex-shrink-0">AUTH</span>
        )}
        {open ? <ChevronDown className="w-4 h-4 text-gray-500 flex-shrink-0" /> : <ChevronRight className="w-4 h-4 text-gray-500 flex-shrink-0" />}
      </button>

      {open && (
        <div className="px-4 py-4 border-t border-gray-800 bg-gray-950 space-y-4">
          <p className="text-gray-300 text-sm">{ep.summary}</p>

          {ep.auth && (
            <div className="bg-amber-900/20 border border-amber-800/40 rounded-lg px-3 py-2 text-xs text-amber-300">
              Requires <code className="font-mono">Authorization: Bearer &lt;token&gt;</code> header.
            </div>
          )}

          {ep.params && ep.params.length > 0 && (
            <div>
              <p className="text-gray-400 text-xs font-semibold uppercase tracking-widest mb-2">Path Parameters</p>
              <ParamTable params={ep.params} />
            </div>
          )}

          {ep.bodyParams && ep.bodyParams.length > 0 && (
            <div>
              <p className="text-gray-400 text-xs font-semibold uppercase tracking-widest mb-2">Request Body (JSON)</p>
              <ParamTable params={ep.bodyParams} />
            </div>
          )}

          {ep.responseExample && (
            <div>
              <p className="text-gray-400 text-xs font-semibold uppercase tracking-widest mb-2">Response Example</p>
              <div className="relative bg-gray-900 border border-gray-700 rounded-lg p-3 font-mono text-xs text-emerald-300 overflow-x-auto">
                <div className="absolute top-2 right-2">
                  <CopyButton text={ep.responseExample} />
                </div>
                <pre className="whitespace-pre-wrap pr-6">{ep.responseExample}</pre>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ParamTable({ params }: { params: Param[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr className="text-left text-gray-500 border-b border-gray-800">
            <th className="pb-1.5 pr-4 font-semibold">Name</th>
            <th className="pb-1.5 pr-4 font-semibold">Type</th>
            <th className="pb-1.5 pr-4 font-semibold">Required</th>
            <th className="pb-1.5 font-semibold">Description</th>
          </tr>
        </thead>
        <tbody>
          {params.map(p => (
            <tr key={p.name} className="border-b border-gray-800/60 last:border-0">
              <td className="py-1.5 pr-4 font-mono text-sky-300">{p.name}</td>
              <td className="py-1.5 pr-4 text-gray-400">{p.type}</td>
              <td className="py-1.5 pr-4">
                {p.required
                  ? <span className="text-red-400 font-semibold">Yes</span>
                  : <span className="text-gray-600">No</span>}
              </td>
              <td className="py-1.5 text-gray-300">{p.desc}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────

const ApiDocs: React.FC = () => {
  const navigate = useNavigate();
  const [openGroup, setOpenGroup] = useState<string | null>("auth");
  const [search, setSearch] = useState("");
  const [sidebarExpanded, setSidebarExpanded] = useState(true);
  const token = localStorage.getItem("token") || "";
  const isLoggedIn = !!localStorage.getItem("token");

  const filtered = API_GROUPS.filter(g =>
    g.title.toLowerCase().includes(search.toLowerCase()) ||
    g.endpoints.some(e =>
      e.path.toLowerCase().includes(search.toLowerCase()) ||
      e.summary.toLowerCase().includes(search.toLowerCase())
    )
  );

  const BASE_URL = "https://www.seekurify.com";

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
      <div className="max-w-5xl mx-auto px-6 py-10">
        {/* Page header */}
        <div className="mb-8">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-white mb-4 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Back
          </button>
          <div className="flex items-center gap-3 mb-2">
            <Code2 className="w-7 h-7 text-cyan-400" />
            <h1 className="text-3xl font-bold text-white">API Documentation</h1>
          </div>
          <p className="text-gray-400">Reference for all Seekurify REST API endpoints.</p>
        </div>

        {/* Base URL + Auth info */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
          <div className="bg-gray-900 border border-gray-700 rounded-xl p-4">
            <p className="text-gray-400 text-xs font-semibold uppercase tracking-widest mb-2">Base URL</p>
            <div className="flex items-center gap-2">
              <code className="text-cyan-300 font-mono text-sm flex-1 truncate">{BASE_URL}</code>
              <CopyButton text={BASE_URL} />
            </div>
          </div>
          <div className="bg-gray-900 border border-gray-700 rounded-xl p-4">
            <p className="text-gray-400 text-xs font-semibold uppercase tracking-widest mb-2">Authentication</p>
            <code className="text-amber-300 font-mono text-sm">Authorization: Bearer &lt;token&gt;</code>
            <p className="text-gray-500 text-xs mt-1">Obtain a token from <code className="font-mono">POST /api/login</code>.</p>
          </div>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-3 mb-6">
          {(["GET","POST","PUT","DELETE"] as const).map(m => (
            <span key={m} className={`text-[10px] font-bold px-2.5 py-0.5 rounded border font-mono ${METHOD_STYLE[m]}`}>{m}</span>
          ))}
          <span className="text-[10px] bg-amber-900/50 text-amber-300 border border-amber-700 px-2.5 py-0.5 rounded font-semibold">AUTH — requires Bearer token</span>
        </div>

        {/* Search */}
        <input
          type="text"
          placeholder="Search endpoints or groups…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full mb-6 px-4 py-2.5 rounded-lg bg-gray-800 border border-gray-700 text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500 text-sm"
        />

        {/* Groups */}
        <div className="space-y-3">
          {filtered.length === 0 && (
            <p className="text-gray-500 text-sm text-center py-8">No endpoints match "{search}"</p>
          )}
          {filtered.map(group => {
            const groupOpen = openGroup === group.id;
            const groupEndpoints = search
              ? group.endpoints.filter(e =>
                  e.path.toLowerCase().includes(search.toLowerCase()) ||
                  e.summary.toLowerCase().includes(search.toLowerCase()) ||
                  group.title.toLowerCase().includes(search.toLowerCase())
                )
              : group.endpoints;

            return (
              <div key={group.id} className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
                <button
                  onClick={() => setOpenGroup(groupOpen ? null : group.id)}
                  className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-gray-800/60 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className={group.color}>{group.icon}</span>
                    <div className="min-w-0">
                      <span className="text-white font-semibold">{group.title}</span>
                      <span className="ml-2 text-[10px] bg-gray-800 text-gray-400 border border-gray-700 px-1.5 py-0.5 rounded font-mono">{group.baseUrl}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500">{group.endpoints.length} endpoint{group.endpoints.length !== 1 ? "s" : ""}</span>
                    {groupOpen
                      ? <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />
                      : <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />}
                  </div>
                </button>

                {groupOpen && (
                  <div className="px-5 pb-5 pt-1 border-t border-gray-800 space-y-3">
                    <p className="text-gray-400 text-sm mb-3">{group.description}</p>
                    {groupEndpoints.map(ep => (
                      <EndpointCard key={ep.method + ep.path} ep={ep} />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Rate limits note */}
        <div className="mt-10 bg-gray-900 border border-gray-700 rounded-xl p-5 text-sm text-gray-400">
          <p className="text-white font-semibold mb-2">Rate Limits</p>
          <ul className="list-disc list-inside space-y-1">
            <li>General API: <span className="text-white">100 requests / 15 minutes</span> per IP</li>
            <li>Auth endpoints (<code className="font-mono">/api/auth</code>, <code className="font-mono">/api/login</code>): <span className="text-white">20 requests / 15 minutes</span> per IP</li>
            <li>Exceeding limits returns <span className="text-red-400 font-mono">429 Too Many Requests</span></li>
          </ul>
        </div>
      </div>

          <Footer />
        </main>
      </div>
    </div>
  );
};

export default ApiDocs;
