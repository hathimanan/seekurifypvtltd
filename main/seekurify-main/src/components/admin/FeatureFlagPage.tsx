import { useEffect, useState } from "react";
import { jwtDecode } from "jwt-decode";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft, Home, ShieldCheck, Sparkles, ToggleLeft,
  User, Bot, Globe, ChevronDown, ChevronRight, Users, Search,
} from "lucide-react";
import { apiService } from "../../services/api";
import { API_BASE_URL } from "../../services/api";

const { getFlags, toggleFlag } = apiService;

// ── Types ─────────────────────────────────────────────────────────────────────

type FeatureFlag = {
  key: string;
  name: string;
  description?: string;
  enabled: boolean;
  rolloutPercentage: number;
  allowedRoles: string[];
};

type TokenPayload = {
  id: string;
  role: "admin" | "user";
  exp: number;
};

type UserType = {
  id: string;
  label: string;
  description: string;
  icon: React.ReactElement;
  textColor: string;
  borderColor: string;
  flags: string[] | "all";
};

// ── User type definitions ─────────────────────────────────────────────────────

const USER_TYPES: UserType[] = [
  {
    id: "individual",
    label: "Individual",
    description: "Personal credential security and security awareness.",
    icon: <User className="w-5 h-5" />,
    textColor: "text-sky-400",
    borderColor: "border-sky-500",
    flags: [
      "otp_verification", "pin_verification_password_manager",
      "security_chatbot", "security_awareness", "insights",
      "learn_secure_group",
    ],
  },
  {
    id: "ai_teams",
    label: "AI Teams",
    description: "Teams building or securing AI-powered workflows.",
    icon: <Bot className="w-5 h-5" />,
    textColor: "text-emerald-400",
    borderColor: "border-emerald-500",
    flags: [
      "otp_verification", "pin_verification_password_manager", "password_vault",
      "siem_dashboard", "security_chatbot", "ai_red_team", "ai_agent_scanner",
      "prompt_injection", "pii_detector", "malware_analyzer", "deepfake_detector",
      "ai_security_suite_group", "threat_detection_group",
    ],
  },
  {
    id: "security_professional",
    label: "Security Professional",
    description: "SOC analysts, pentesters, and security engineers.",
    icon: <ShieldCheck className="w-5 h-5" />,
    textColor: "text-orange-400",
    borderColor: "border-orange-500",
    flags: [
      "otp_verification", "pin_verification_password_manager", "pin_verification_siem",
      "password_vault", "siem_dashboard", "security_chatbot",
      "malware_analyzer", "deepfake_detector", "phishing_detector",
      "watch_agent", "csp_builder", "site_shield",
      "findings_board", "team_workspaces", "security_awareness",
      "insights", "threat_detection_group",
      "web_infra_group", "teams_group", "learn_secure_group",
    ],
  },
  {
    id: "enterprise",
    label: "Enterprise",
    description: "Full platform access — every feature enabled.",
    icon: <Globe className="w-5 h-5" />,
    textColor: "text-amber-400",
    borderColor: "border-amber-500",
    flags: "all",
  },
];

// ── Flag categories (for grouping within a user-type view) ────────────────────

const FLAG_CATEGORIES: Record<string, string[]> = {
  "Identity & Access":    ["password_vault", "siem_dashboard", "identity_access_group"],
  "Authentication":       ["otp_verification", "pin_verification_password_manager", "pin_verification_siem"],
  "Threat Detection":     ["malware_analyzer", "deepfake_detector", "phishing_detector", "threat_detection_group"],
  "AI Security":          ["ai_red_team", "ai_agent_scanner", "prompt_injection", "pii_detector", "ai_security_suite_group"],
  "Web & Infrastructure": ["watch_agent", "csp_builder", "site_shield", "web_infra_group"],
  "Team & Collaboration": ["findings_board", "team_workspaces", "teams_group"],
  "Learning & Awareness": ["security_awareness", "insights", "security_chatbot", "learn_secure_group"],
};

function getCategoryForFlag(key: string): string {
  for (const [cat, keys] of Object.entries(FLAG_CATEGORIES)) {
    if (keys.includes(key)) return cat;
  }
  return "Other";
}

// ── FlagCard sub-component ────────────────────────────────────────────────────

function FlagCard({
  flag,
  recommended,
  onToggle,
  disabled = false,
}: {
  flag: FeatureFlag;
  recommended: boolean;
  onToggle: (flag: FeatureFlag) => void;
  disabled?: boolean;
}) {
  return (
    <div className="rounded-3xl border border-slate-700 bg-slate-800/90 p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-[0_18px_45px_rgba(2,6,23,0.35)]">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className="mb-2 flex flex-wrap items-center gap-3">
            <h2 className="text-lg font-bold text-white">{flag.name}</h2>
            <span className="rounded-full bg-slate-700 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-300">
              {flag.key}
            </span>
            <span
              className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${
                flag.enabled ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"
              }`}
            >
              {flag.enabled ? "Enabled" : "Disabled"}
            </span>
            {recommended && (
              <span className="inline-flex rounded-full bg-emerald-900/60 px-3 py-1 text-xs font-bold text-emerald-300 border border-emerald-700">
                Recommended
              </span>
            )}
          </div>
          <p className="max-w-3xl text-sm leading-6 text-slate-300">
            {flag.description || "No description provided."}
          </p>
          <div className="mt-4 flex flex-wrap gap-3 text-xs font-medium text-slate-300">
            <span className="rounded-full bg-slate-700 px-3 py-1">
              Rollout: {flag.rolloutPercentage}%
            </span>
            <span className="rounded-full bg-slate-700 px-3 py-1">
              Roles: {flag.allowedRoles?.join(", ") || "All"}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => !disabled && onToggle(flag)}
            disabled={disabled}
            className={`rounded-2xl px-5 py-2.5 text-sm font-semibold shadow-sm transition ${
              disabled
                ? "bg-slate-700 text-slate-500 cursor-not-allowed"
                : flag.enabled
                ? "text-white bg-rose-600 hover:bg-rose-700 hover:-translate-y-0.5"
                : "text-slate-900 bg-amber-500 hover:bg-amber-400 hover:-translate-y-0.5"
            }`}
          >
            {flag.enabled ? "Disable Flag" : "Enable Flag"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── User management types ─────────────────────────────────────────────────────

type UserRecord = {
  _id: string;
  email: string;
  username: string;
  name?: string;
  userType: string;
  ownedFeatureFlags: string[];
  role: string;
};

const USER_TYPE_LABELS: Record<string, { label: string; color: string }> = {
  individual:            { label: "Individual",            color: "bg-sky-900/60 text-sky-300 border-sky-700" },
  ai_teams:              { label: "AI Teams",              color: "bg-emerald-900/60 text-emerald-300 border-emerald-700" },
  security_professional: { label: "Security Professional", color: "bg-orange-900/60 text-orange-300 border-orange-700" },
  enterprise:            { label: "Enterprise",            color: "bg-amber-900/60 text-amber-300 border-amber-700" },
};

// ── Page ──────────────────────────────────────────────────────────────────────

export default function FeatureFlagPage() {
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [activeTab, setActiveTab] = useState<"flags" | "users">("flags");

  // Flag config state
  const [originalFlags, setOriginalFlags] = useState<FeatureFlag[]>([]);
  const [draftFlags, setDraftFlags] = useState<FeatureFlag[]>([]);
  const [hasChanges, setHasChanges] = useState(false);
  const [selectedUserType, setSelectedUserType] = useState<string | null>(null);
  const [notIncludedOpen, setNotIncludedOpen] = useState(false);

  // User type assignment state
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [userSearch, setUserSearch] = useState("");
  const [savingUserId, setSavingUserId] = useState<string | null>(null);
  const [assignError, setAssignError] = useState<{ userId: string; message: string } | null>(null);

  const token = localStorage.getItem("token");

  useEffect(() => {
    if (!token) { setIsAdmin(false); return; }
    try {
      const decoded = jwtDecode<TokenPayload>(token);
      if (decoded.exp * 1000 < Date.now()) {
        localStorage.removeItem("token");
        setIsAdmin(false);
        return;
      }
      setIsAdmin(decoded.role === "admin");
    } catch {
      setIsAdmin(false);
    }
  }, [token]);

  useEffect(() => {
    if (isAdmin) loadFlags();
  }, [isAdmin]);

  useEffect(() => {
    if (isAdmin && activeTab === "users" && users.length === 0) loadUsers();
  }, [isAdmin, activeTab]);

  const loadFlags = async () => {
    const data = await getFlags(token!);
    const flags = data.flags ?? data;
    setOriginalFlags(flags);
    setDraftFlags(flags);
    setHasChanges(false);
  };

  const loadUsers = async () => {
    setUsersLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/feature-flags/users`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) setUsers(data.users);
    } finally {
      setUsersLoading(false);
    }
  };

  const handleAssignUserType = async (userId: string, userType: string) => {
    setAssignError(null);
    setSavingUserId(userId);
    try {
      const res = await fetch(`${API_BASE_URL}/feature-flags/assign-user-type`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ userId, userType }),
      });
      const data = await res.json();
      if (data.success) {
        setUsers(prev =>
          prev.map(u => u._id === userId ? { ...u, userType: data.user.userType, ownedFeatureFlags: data.user.ownedFeatureFlags } : u)
        );
      } else {
        setAssignError({ userId, message: data.error });
      }
    } finally {
      setSavingUserId(null);
    }
  };

  const handleToggle = (flag: FeatureFlag) => {
    setDraftFlags(prev =>
      prev.map(f =>
        f.key === flag.key
          ? { ...f, enabled: !f.enabled, rolloutPercentage: !f.enabled ? 100 : 0 }
          : f
      )
    );
    setHasChanges(true);
  };

  const handleSave = async () => {
    for (const flag of draftFlags) {
      const original = originalFlags.find(f => f.key === flag.key);
      if (
        original &&
        (original.enabled !== flag.enabled || original.rolloutPercentage !== flag.rolloutPercentage)
      ) {
        await toggleFlag(token!, flag.key, {
          enabled: flag.enabled,
          rolloutPercentage: flag.rolloutPercentage,
        });
      }
    }
    setOriginalFlags(draftFlags);
    setHasChanges(false);
  };

  const handleCancel = () => {
    setDraftFlags(originalFlags);
    setHasChanges(false);
  };

  const handleApplyPreset = () => {
    const type = USER_TYPES.find(t => t.id === selectedUserType);
    if (!type) return;
    const allKeys = new Set(draftFlags.map(f => f.key));
    const included = type.flags === "all" ? allKeys : new Set(type.flags);
    setDraftFlags(prev =>
      prev.map(f => ({
        ...f,
        enabled: included.has(f.key),
        rolloutPercentage: included.has(f.key) ? 100 : 0,
      }))
    );
    setHasChanges(true);
  };

  // ── Derived data ────────────────────────────────────────────────────────────

  const enabledCount  = draftFlags.filter(f => f.enabled).length;
  const disabledCount = draftFlags.length - enabledCount;

  const activeType = USER_TYPES.find(t => t.id === selectedUserType) ?? null;
  const includedKeys: Set<string> = !activeType
    ? new Set()
    : activeType.flags === "all"
    ? new Set(draftFlags.map(f => f.key))
    : new Set(activeType.flags as string[]);

  const includedFlags    = draftFlags.filter(f => includedKeys.has(f.key));
  const notIncludedFlags = draftFlags.filter(f => !includedKeys.has(f.key));

  // Group included flags by category, in the order defined in FLAG_CATEGORIES
  const groupedIncluded: [string, FeatureFlag[]][] = Object.keys(FLAG_CATEGORIES)
    .map(cat => [cat, includedFlags.filter(f => getCategoryForFlag(f.key) === cat)] as [string, FeatureFlag[]])
    .filter(([, flags]) => flags.length > 0);

  // Access gate
  if (isAdmin === null) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-400" />
      </div>
    );
  }
  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-center">
          <p className="text-white text-xl font-bold mb-2">Access Denied</p>
          <p className="text-slate-400 text-sm mb-6">Admin privileges required.</p>
          <button
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-2 rounded-xl bg-amber-500 px-4 py-2.5 text-sm font-semibold text-slate-900 hover:bg-amber-400"
          >
            <ArrowLeft className="h-4 w-4" /> Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(245,158,11,0.16),_transparent_26%),radial-gradient(circle_at_top_right,_rgba(148,163,184,0.14),_transparent_24%),linear-gradient(180deg,_#0f172a_0%,_#1e293b_48%,_#0f172a_100%)] px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-7xl">
        <div className="relative overflow-hidden rounded-[28px] border border-slate-700/80 bg-slate-900/80 p-6 shadow-[0_24px_80px_rgba(2,6,23,0.45)] backdrop-blur md:p-8">
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(120deg,rgba(245,158,11,0.08),transparent_32%,rgba(148,163,184,0.08))]" />

          {/* ── Page header ── */}
          <div className="relative mb-8 flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-2xl">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-amber-300/30 bg-amber-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-amber-300">
                <Sparkles className="h-3.5 w-3.5" />
                Admin Control Center
              </div>
              <h1 className="text-4xl font-black tracking-tight text-white sm:text-5xl">
                Feature Flags
              </h1>
              <p className="mt-3 max-w-xl text-sm leading-6 text-slate-300 sm:text-base">
                Select a user type to view and configure the relevant feature set, then apply a preset or toggle flags individually.
              </p>
            </div>
            <div className="relative flex flex-wrap gap-3">
              <button
                onClick={() => navigate(-1)}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-600 bg-slate-800 px-4 py-2.5 text-sm font-medium text-slate-200 shadow-sm transition hover:-translate-y-0.5 hover:bg-slate-700"
              >
                <ArrowLeft className="h-4 w-4" /> Back
              </button>
              <button
                onClick={() => navigate("/homepageAfterLogin")}
                className="inline-flex items-center gap-2 rounded-xl bg-amber-500 px-4 py-2.5 text-sm font-semibold text-slate-900 shadow-sm transition hover:-translate-y-0.5 hover:bg-amber-400"
              >
                <Home className="h-4 w-4" /> Home Page
              </button>
            </div>
          </div>

          {/* ── Tab switcher ── */}
          <div className="relative mb-8 flex gap-2">
            {(["flags", "users"] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold transition ${
                  activeTab === tab
                    ? "bg-amber-500 text-slate-900"
                    : "border border-slate-600 bg-slate-800 text-slate-300 hover:bg-slate-700"
                }`}
              >
                {tab === "flags" ? <Sparkles className="h-4 w-4" /> : <Users className="h-4 w-4" />}
                {tab === "flags" ? "Flag Configuration" : "User Type Assignment"}
              </button>
            ))}
          </div>

          {activeTab === "flags" && <>
          {/* ── User Type Selector ── */}
          <div className="relative mb-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold uppercase tracking-widest text-slate-400">
                Select User Type
              </h2>
              {activeType && (
                <button
                  onClick={handleApplyPreset}
                  className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-emerald-500"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  Apply {activeType.label} Preset
                </button>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              {USER_TYPES.map(type => {
                const isSelected = selectedUserType === type.id;
                const flagCount  = type.flags === "all" ? "All" : (type.flags as string[]).length;
                return (
                  <button
                    key={type.id}
                    onClick={() => {
                      setSelectedUserType(isSelected ? null : type.id);
                      setNotIncludedOpen(false);
                    }}
                    className={`relative flex flex-col items-start gap-2 rounded-2xl border p-4 text-left transition hover:-translate-y-0.5 ${
                      isSelected
                        ? "border-amber-400 bg-amber-500/10"
                        : "border-slate-700 bg-slate-800/60 hover:border-slate-500"
                    }`}
                  >
                    <div className={`flex items-center gap-2 ${isSelected ? "text-amber-300" : type.textColor}`}>
                      {type.icon}
                      <span className="font-bold text-sm">{type.label}</span>
                    </div>
                    <p className="text-[11px] leading-4 text-slate-400">{type.description}</p>
                    <span className={`mt-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold border ${
                      isSelected
                        ? "bg-amber-900/50 text-amber-300 border-amber-700"
                        : "bg-slate-700 text-slate-300 border-slate-600"
                    }`}>
                      {flagCount} flag{flagCount !== 1 && flagCount !== "All" ? "s" : ""}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── Stats cards ── */}
          <div className="relative mb-8 grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50/80 p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">Enabled</p>
                  <p className="mt-2 text-3xl font-black text-emerald-900">{enabledCount}</p>
                </div>
                <ShieldCheck className="h-9 w-9 text-emerald-600" />
              </div>
            </div>
            <div className="rounded-2xl border border-rose-200 bg-rose-50/80 p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-rose-700">Disabled</p>
                  <p className="mt-2 text-3xl font-black text-rose-900">{disabledCount}</p>
                </div>
                <ToggleLeft className="h-9 w-9 text-rose-600" />
              </div>
            </div>
            <div className="rounded-2xl border border-amber-200 bg-amber-50/80 p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-700">Total Flags</p>
                  <p className="mt-2 text-3xl font-black text-amber-900">{draftFlags.length}</p>
                </div>
                <Sparkles className="h-9 w-9 text-amber-600" />
              </div>
            </div>
          </div>

          {/* ── Flag list ── */}
          <div className="relative">

            {/* No user type selected — flat list */}
            {!activeType && (
              <div className="space-y-4">
                {draftFlags.map(flag => (
                  <FlagCard key={flag.key} flag={flag} recommended={false} onToggle={handleToggle} />
                ))}
              </div>
            )}

            {/* User type selected — grouped view */}
            {activeType && (
              <div className="space-y-8">

                {/* Included section */}
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <span className={`text-xs font-bold uppercase tracking-widest ${activeType.textColor}`}>
                      Included for {activeType.label}
                    </span>
                    <span className="rounded-full bg-emerald-900/50 border border-emerald-700 px-2.5 py-0.5 text-[10px] font-bold text-emerald-300">
                      {includedFlags.length} flag{includedFlags.length !== 1 ? "s" : ""}
                    </span>
                  </div>

                  {groupedIncluded.length === 0 ? (
                    <p className="text-slate-500 text-sm">No flags loaded yet.</p>
                  ) : (
                    <div className="space-y-6">
                      {groupedIncluded.map(([category, flags]) => (
                        <div key={category}>
                          <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-500 mb-2 px-1">
                            {category}
                          </p>
                          <div className="space-y-3">
                            {flags.map(flag => (
                              <FlagCard key={flag.key} flag={flag} recommended onToggle={handleToggle} />
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Not included section — collapsible */}
                {notIncludedFlags.length > 0 && (
                  <div>
                    <button
                      onClick={() => setNotIncludedOpen(v => !v)}
                      className="flex items-center gap-2 mb-4 group"
                    >
                      {notIncludedOpen
                        ? <ChevronDown className="h-4 w-4 text-slate-500" />
                        : <ChevronRight className="h-4 w-4 text-slate-500" />}
                      <span className="text-xs font-bold uppercase tracking-widest text-slate-500 group-hover:text-slate-300 transition-colors">
                        Not included for {activeType.label}
                      </span>
                      <span className="rounded-full bg-slate-700 border border-slate-600 px-2.5 py-0.5 text-[10px] font-bold text-slate-400">
                        {notIncludedFlags.length} flag{notIncludedFlags.length !== 1 ? "s" : ""}
                      </span>
                    </button>

                    {notIncludedOpen && (
                      <div className="space-y-3 opacity-60">
                        {notIncludedFlags.map(flag => (
                          <FlagCard key={flag.key} flag={flag} recommended={false} onToggle={handleToggle} disabled />
                        ))}
                      </div>
                    )}
                  </div>
                )}

              </div>
            )}
          </div>

          {/* ── Sticky save bar ── */}
          {hasChanges && (
            <div className="sticky bottom-4 z-10 mt-8 rounded-2xl border border-slate-900 bg-slate-950/95 p-4 shadow-2xl backdrop-blur">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-white">Unsaved changes</p>
                  <p className="text-xs text-slate-300">
                    Review and apply your updated feature rollout configuration.
                  </p>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={handleCancel}
                    className="rounded-xl border border-slate-700 bg-transparent px-5 py-2.5 text-sm font-semibold text-slate-200 transition hover:bg-slate-800"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSave}
                    className="rounded-xl bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400"
                  >
                    Save Changes
                  </button>
                </div>
              </div>
            </div>
          )}
          </>}

          {/* ── User Type Assignment tab ── */}
          {activeTab === "users" && (
            <div className="relative">
              {/* Search bar */}
              <div className="relative mb-6">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                <input
                  type="text"
                  placeholder="Search by email or name…"
                  value={userSearch}
                  onChange={e => setUserSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 text-sm"
                />
              </div>

              {usersLoading ? (
                <div className="flex justify-center py-16">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-400" />
                </div>
              ) : (
                <div className="space-y-3">
                  {users
                    .filter(u =>
                      u.email.toLowerCase().includes(userSearch.toLowerCase()) ||
                      (u.name ?? "").toLowerCase().includes(userSearch.toLowerCase()) ||
                      u.username.toLowerCase().includes(userSearch.toLowerCase())
                    )
                    .map(user => {
                      const typeInfo = USER_TYPE_LABELS[user.userType] ?? { label: "Unknown", color: "bg-slate-700 text-slate-300 border-slate-600" };
                      const isSaving = savingUserId === user._id;
                      return (
                        <div
                          key={user._id}
                          className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between rounded-2xl border border-slate-700 bg-slate-800/90 px-5 py-4"
                        >
                          {/* User info */}
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2 mb-1">
                              <span className="text-white font-semibold text-sm truncate">
                                {user.name || user.username}
                              </span>
                              {user.role === "admin" && (
                                <span className="rounded-full bg-amber-900/50 border border-amber-700 px-2 py-0.5 text-[10px] font-bold text-amber-300">
                                  ADMIN
                                </span>
                              )}
                              <span className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold ${typeInfo.color}`}>
                                {typeInfo.label}
                              </span>
                            </div>
                            <p className="text-xs text-slate-400 truncate">{user.email}</p>
                            <p className="text-[11px] text-slate-500 mt-0.5">
                              {user.ownedFeatureFlags.length} flag{user.ownedFeatureFlags.length !== 1 ? "s" : ""} assigned
                            </p>
                          </div>

                          {/* Type selector */}
                          <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                            <div className="flex items-center gap-3">
                              <select
                                value={user.userType}
                                onChange={e => handleAssignUserType(user._id, e.target.value)}
                                disabled={isSaving}
                                className="rounded-xl border border-slate-600 bg-slate-700 text-white text-sm px-3 py-2 focus:outline-none focus:border-amber-500 disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                <option value="individual">Individual</option>
                                <option value="ai_teams">AI Teams</option>
                                <option value="security_professional">Security Professional</option>
                                <option value="enterprise">Enterprise</option>
                              </select>
                              {isSaving && (
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-amber-400 flex-shrink-0" />
                              )}
                            </div>
                            {assignError?.userId === user._id && (
                              <p className="text-[11px] text-rose-400 max-w-[220px] text-right">
                                {assignError.message}
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  {users.length === 0 && !usersLoading && (
                    <p className="text-center text-slate-500 text-sm py-12">No users found.</p>
                  )}
                </div>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
