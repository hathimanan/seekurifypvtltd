import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Shield, ShieldAlert, ShieldCheck, ScanEye, BarChart3, Clock,
  Plus, Edit2, Trash2, Loader2, AlertTriangle, CheckCircle, XCircle,
  Filter, ChevronLeft, ChevronRight, Activity, ToggleLeft, ToggleRight,
  AlertCircle,
} from 'lucide-react';
import AppSidebar from './ui/AppSidebar';
import Header from './ui/Header';
import Footer from './ui/Footer';
import { apiService, API_BASE_URL } from '../services/api';

// ── Types ──────────────────────────────────────────────────────────────────────
type FirewallTab = 'overview' | 'rules' | 'inspector' | 'events';

interface FirewallRule {
  _id: string;
  name: string;
  type: 'ip_block' | 'ip_allow' | 'url_pattern' | 'user_agent' | 'payload_pattern';
  action: 'block' | 'allow' | 'log';
  value: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  enabled: boolean;
  description?: string;
  hitCount: number;
  lastTriggeredAt?: string;
  createdAt: string;
}

interface FirewallEventDoc {
  _id: string;
  sourceIp?: string;
  targetUrl?: string;
  userAgent?: string;
  verdict: 'block' | 'allow' | 'monitor';
  matchedRuleName?: string;
  aiThreatType?: string;
  aiSeverity?: string;
  aiConfidence?: number;
  findingId?: string;
  createdAt: string;
}

interface InspectResult {
  matchedRules: Array<{ _id: string; name: string; type: string; action: string }>;
  aiAnalysis: {
    threatType: string | null;
    severity: string;
    confidence: number;
    recommendation: string;
    indicators?: string[];
  };
  verdict: 'block' | 'allow' | 'monitor';
  eventId: string;
  findingId?: string | null;
}

interface WAFStats {
  activeRules: number;
  eventsToday: number;
  blockedThreats: number;
  threatDistribution: Array<{ name: string; count: number }>;
}

interface RuleFormState {
  name: string;
  type: FirewallRule['type'];
  action: FirewallRule['action'];
  value: string;
  severity: FirewallRule['severity'];
  description: string;
  enabled: boolean;
}

const EMPTY_RULE_FORM: RuleFormState = {
  name: '', type: 'ip_block', action: 'block', value: '',
  severity: 'medium', description: '', enabled: true,
};

// ── Tab metadata ───────────────────────────────────────────────────────────────
const TABS: { id: FirewallTab; label: string; icon: React.ReactNode }[] = [
  { id: 'overview',   label: 'Overview',       icon: <BarChart3 className="w-4 h-4" /> },
  { id: 'rules',      label: 'Rules',          icon: <Shield className="w-4 h-4" /> },
  { id: 'inspector',  label: 'WAF Inspector',  icon: <ScanEye className="w-4 h-4" /> },
  { id: 'events',     label: 'Event Log',      icon: <Clock className="w-4 h-4" /> },
];

// ── Helpers ────────────────────────────────────────────────────────────────────
const SEVERITY_COLORS: Record<string, string> = {
  critical: 'bg-red-900/40 text-red-300 border border-red-700',
  high:     'bg-orange-900/40 text-orange-300 border border-orange-700',
  medium:   'bg-yellow-900/40 text-yellow-300 border border-yellow-700',
  low:      'bg-blue-900/40 text-blue-300 border border-blue-700',
  none:     'bg-gray-700 text-gray-300',
};

const VERDICT_COLORS: Record<string, string> = {
  block:   'bg-red-900/40 text-red-300 border border-red-700',
  monitor: 'bg-yellow-900/40 text-yellow-300 border border-yellow-700',
  allow:   'bg-green-900/40 text-green-300 border border-green-700',
};

const TYPE_LABELS: Record<string, string> = {
  ip_block:        'IP Block',
  ip_allow:        'IP Allow',
  url_pattern:     'URL Pattern',
  user_agent:      'User-Agent',
  payload_pattern: 'Payload',
};

function SeverityBadge({ s }: { s?: string }) {
  if (!s) return null;
  return <span className={`px-2 py-0.5 rounded text-xs font-medium ${SEVERITY_COLORS[s] ?? SEVERITY_COLORS.none}`}>{s}</span>;
}

function VerdictBadge({ v }: { v: string }) {
  return <span className={`px-2 py-0.5 rounded text-xs font-medium ${VERDICT_COLORS[v] ?? SEVERITY_COLORS.none}`}>{v}</span>;
}

function ActionBadge({ a }: { a: string }) {
  const colors: Record<string, string> = {
    block: 'bg-red-900/30 text-red-300',
    allow: 'bg-green-900/30 text-green-300',
    log:   'bg-gray-700 text-gray-300',
  };
  return <span className={`px-2 py-0.5 rounded text-xs font-medium ${colors[a] ?? 'bg-gray-700 text-gray-300'}`}>{a}</span>;
}

function fmtDate(iso?: string) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function Firewall() {
  const navigate = useNavigate();
  const token = localStorage.getItem("token");
  const [profileImage, setProfileImage] = useState("");
  const [sidebarExpanded, setSidebarExpanded] = useState(true);
  const [activeTab, setActiveTab] = useState<FirewallTab>('overview');

  const handleLogout = () => { localStorage.removeItem("token"); navigate("/"); };

  useEffect(() => {
    if (!token) return;
    fetch(`${API_BASE_URL}/profile`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.profileImage) setProfileImage(d.profileImage); })
      .catch(() => {});
  }, [token]);

  // Overview
  const [stats, setStats]             = useState<WAFStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [statsError, setStatsError]   = useState('');

  // Rules
  const [rules, setRules]           = useState<FirewallRule[]>([]);
  const [rulesLoading, setRulesLoading] = useState(false);
  const [showModal, setShowModal]   = useState(false);
  const [editingRule, setEditingRule] = useState<FirewallRule | null>(null);
  const [ruleForm, setRuleForm]     = useState<RuleFormState>(EMPTY_RULE_FORM);
  const [ruleSaving, setRuleSaving] = useState(false);
  const [ruleError, setRuleError]   = useState('');

  // Inspector
  const [inspectForm, setInspectForm] = useState({
    sourceIp: '', targetUrl: '', userAgent: '', requestBody: '', headers: '',
  });
  const [inspecting, setInspecting] = useState(false);
  const [inspectResult, setInspectResult] = useState<InspectResult | null>(null);
  const [inspectError, setInspectError]   = useState('');

  // Events
  const [events, setEvents]         = useState<FirewallEventDoc[]>([]);
  const [eventsTotal, setEventsTotal] = useState(0);
  const [eventsPage, setEventsPage] = useState(1);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [verdictFilter, setVerdictFilter] = useState('');
  const [severityFilter, setSeverityFilter] = useState('');

  // ── Data loaders ─────────────────────────────────────────────────────────────
  const loadStats = useCallback(async () => {
    setStatsLoading(true); setStatsError('');
    try {
      const data = await apiService.getFirewallStats();
      setStats(data);
    } catch (e: unknown) {
      setStatsError(e instanceof Error ? e.message : 'Failed to load stats');
    } finally { setStatsLoading(false); }
  }, []);

  const loadRules = useCallback(async () => {
    setRulesLoading(true);
    try {
      const data = await apiService.getFirewallRules();
      setRules(data.rules ?? []);
    } catch { /* silently ignore */ }
    finally { setRulesLoading(false); }
  }, []);

  const loadEvents = useCallback(async (page = 1) => {
    setEventsLoading(true);
    try {
      const data = await apiService.getFirewallEvents({
        verdict:  verdictFilter  || undefined,
        severity: severityFilter || undefined,
        page,
      });
      setEvents(data.events ?? []);
      setEventsTotal(data.total ?? 0);
      setEventsPage(page);
    } catch { /* silently ignore */ }
    finally { setEventsLoading(false); }
  }, [verdictFilter, severityFilter]);

  useEffect(() => { if (activeTab === 'overview') loadStats(); }, [activeTab, loadStats]);
  useEffect(() => { if (activeTab === 'rules') loadRules(); }, [activeTab, loadRules]);
  useEffect(() => { if (activeTab === 'events') loadEvents(1); }, [activeTab, verdictFilter, severityFilter, loadEvents]);

  // ── Rule CRUD handlers ────────────────────────────────────────────────────────
  function openCreateModal() {
    setEditingRule(null);
    setRuleForm(EMPTY_RULE_FORM);
    setRuleError('');
    setShowModal(true);
  }

  function openBlockIpModal(ip: string) {
    setEditingRule(null);
    setRuleForm({
      ...EMPTY_RULE_FORM,
      name: `Block ${ip}`,
      type: 'ip_block',
      action: 'block',
      value: ip,
      severity: 'high',
    });
    setRuleError('');
    setActiveTab('rules');
    setShowModal(true);
  }

  function openEditModal(rule: FirewallRule) {
    setEditingRule(rule);
    setRuleForm({
      name: rule.name, type: rule.type, action: rule.action, value: rule.value,
      severity: rule.severity, description: rule.description ?? '', enabled: rule.enabled,
    });
    setRuleError('');
    setShowModal(true);
  }

  async function saveRule() {
    setRuleSaving(true); setRuleError('');
    try {
      if (editingRule) {
        const updated = await apiService.updateFirewallRule(editingRule._id, ruleForm as unknown as Record<string, unknown>);
        setRules(prev => prev.map(r => r._id === editingRule._id ? updated : r));
      } else {
        const created = await apiService.createFirewallRule(ruleForm as unknown as Record<string, unknown>);
        setRules(prev => [created, ...prev]);
      }
      setShowModal(false);
    } catch (e: unknown) {
      setRuleError(e instanceof Error ? e.message : 'Failed to save rule');
    } finally { setRuleSaving(false); }
  }

  async function toggleRule(rule: FirewallRule) {
    const next = !rule.enabled;
    setRules(prev => prev.map(r => r._id === rule._id ? { ...r, enabled: next } : r));
    try {
      await apiService.toggleFirewallRule(rule._id, next);
    } catch {
      setRules(prev => prev.map(r => r._id === rule._id ? { ...r, enabled: rule.enabled } : r));
    }
  }

  async function deleteRule(rule: FirewallRule) {
    if (!confirm(`Delete rule "${rule.name}"?`)) return;
    setRules(prev => prev.filter(r => r._id !== rule._id));
    try {
      await apiService.deleteFirewallRule(rule._id);
    } catch {
      setRules(prev => [rule, ...prev]);
    }
  }

  // ── Inspect handler ───────────────────────────────────────────────────────────
  async function runInspect() {
    if (!inspectForm.sourceIp.trim() || !inspectForm.targetUrl.trim()) {
      setInspectError('Source IP and Target URL are required.');
      return;
    }

    let parsedHeaders: Record<string, unknown> = {};
    if (inspectForm.headers.trim()) {
      try {
        parsedHeaders = JSON.parse(inspectForm.headers);
      } catch {
        setInspectError('Headers must be valid JSON — e.g. {"Content-Type": "application/json"}');
        return;
      }
    }

    setInspecting(true); setInspectError(''); setInspectResult(null);
    try {
      const result = await apiService.inspectRequest({
        sourceIp:    inspectForm.sourceIp,
        targetUrl:   inspectForm.targetUrl,
        userAgent:   inspectForm.userAgent,
        requestBody: inspectForm.requestBody,
        headers:     parsedHeaders,
      });
      setInspectResult(result);
    } catch (e: unknown) {
      setInspectError(e instanceof Error ? e.message : 'Inspection failed');
    } finally { setInspecting(false); }
  }

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex flex-col bg-gray-950 text-white">
      <Header token={token || ""} handleLogout={handleLogout} profileImage={profileImage} />

      <div className="flex flex-1 overflow-hidden">
        <AppSidebar sidebarExpanded={sidebarExpanded} setSidebarExpanded={setSidebarExpanded} />

        <div className="flex-1 flex flex-col overflow-hidden">
        {/* Page header */}
        <div className="px-6 pt-6 pb-4 border-b border-gray-800 flex-shrink-0">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-8 h-8 bg-cyan-600 rounded-lg flex items-center justify-center">
              <Shield className="w-4 h-4 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-white">AI Firewall</h1>
          </div>
          <p className="text-sm text-gray-400 ml-11">AI-powered Web Application Firewall — rules, inspection &amp; event logging</p>
        </div>

        {/* Tab bar */}
        <div className="px-6 border-b border-gray-800 flex-shrink-0">
          <div className="flex gap-1">
            {TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-cyan-500 text-white'
                    : 'border-transparent text-gray-400 hover:text-gray-200'
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-y-auto">
          {activeTab === 'overview'  && <OverviewTab stats={stats} loading={statsLoading} error={statsError} onRefresh={loadStats} />}
          {activeTab === 'rules'     && (
            <RulesTab
              rules={rules} loading={rulesLoading}
              onAdd={openCreateModal} onEdit={openEditModal}
              onToggle={toggleRule} onDelete={deleteRule}
            />
          )}
          {activeTab === 'inspector' && (
            <InspectorTab
              form={inspectForm} setForm={setInspectForm}
              onRun={runInspect} loading={inspecting}
              result={inspectResult} error={inspectError}
              onBlockIp={openBlockIpModal}
            />
          )}
          {activeTab === 'events' && (
            <EventsTab
              events={events} total={eventsTotal} page={eventsPage} loading={eventsLoading}
              verdictFilter={verdictFilter} setVerdictFilter={setVerdictFilter}
              severityFilter={severityFilter} setSeverityFilter={setSeverityFilter}
              onPageChange={loadEvents}
              onBlockIp={openBlockIpModal}
            />
          )}
        </div>
        </div>
      </div>

      {/* Rule modal */}
      {showModal && (
        <RuleModal
          editing={!!editingRule}
          form={ruleForm} setForm={setRuleForm}
          saving={ruleSaving} error={ruleError}
          onSave={saveRule} onClose={() => setShowModal(false)}
        />
      )}
      <Footer />
    </div>
  );
}

// ── Overview Tab ───────────────────────────────────────────────────────────────
function OverviewTab({ stats, loading, error, onRefresh }: {
  stats: WAFStats | null; loading: boolean; error: string; onRefresh: () => void;
}) {
  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-6 h-6 animate-spin text-cyan-400" /></div>;
  if (error)   return <div className="p-6 text-red-400 flex items-center gap-2"><AlertCircle className="w-5 h-5" />{error}</div>;

  const cards = [
    { label: 'Active Rules',     value: stats?.activeRules ?? 0,    icon: <Shield className="w-5 h-5 text-cyan-400" />,      color: 'border-cyan-700' },
    { label: 'Events Today',     value: stats?.eventsToday ?? 0,    icon: <Activity className="w-5 h-5 text-blue-400" />,    color: 'border-blue-700' },
    { label: 'Blocked Threats',  value: stats?.blockedThreats ?? 0, icon: <ShieldAlert className="w-5 h-5 text-red-400" />,  color: 'border-red-700' },
    { label: 'Threat Types',     value: stats?.threatDistribution?.length ?? 0, icon: <BarChart3 className="w-5 h-5 text-orange-400" />, color: 'border-orange-700' },
  ];

  return (
    <div className="p-6 space-y-6">
      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map(c => (
          <div key={c.label} className={`bg-gray-900 rounded-xl p-5 border ${c.color}`}>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs text-gray-400 uppercase tracking-wider">{c.label}</span>
              {c.icon}
            </div>
            <div className="text-3xl font-bold text-white">{c.value}</div>
          </div>
        ))}
      </div>

      {/* Threat distribution */}
      <div className="bg-gray-900 rounded-xl p-5 border border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-gray-200">Threat Distribution</h3>
          <button onClick={onRefresh} className="text-xs text-cyan-400 hover:text-cyan-300">Refresh</button>
        </div>
        {(!stats?.threatDistribution?.length) ? (
          <p className="text-gray-500 text-sm text-center py-8">No threat data yet. Run WAF inspections to see threat patterns.</p>
        ) : (
          <div className="space-y-3">
            {stats.threatDistribution.map(item => {
              const max = Math.max(...stats.threatDistribution.map(d => d.count));
              const pct = max > 0 ? Math.round((item.count / max) * 100) : 0;
              return (
                <div key={item.name} className="flex items-center gap-3">
                  <span className="text-xs text-gray-400 w-32 truncate">{item.name}</span>
                  <div className="flex-1 bg-gray-800 rounded-full h-2">
                    <div
                      className="bg-cyan-500 h-2 rounded-full transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="text-xs text-gray-300 w-8 text-right">{item.count}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Tips */}
      <div className="bg-gray-900 rounded-xl p-5 border border-gray-700">
        <h3 className="text-sm font-semibold text-gray-200 mb-3 flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-green-400" /> Getting Started
        </h3>
        <ul className="space-y-2 text-sm text-gray-400">
          <li>1. Go to <strong className="text-gray-200">Rules</strong> and create your first firewall rule (e.g., block a known malicious IP or SQLmap user-agent).</li>
          <li>2. Use the <strong className="text-gray-200">WAF Inspector</strong> to test HTTP requests against your rules and AI threat detection.</li>
          <li>3. Review the <strong className="text-gray-200">Event Log</strong> to track blocked and monitored requests.</li>
          <li>4. Blocked critical threats automatically create <strong className="text-gray-200">Findings</strong> and can trigger <strong className="text-gray-200">Playbooks</strong>.</li>
        </ul>
      </div>
    </div>
  );
}

// ── Rules Tab ──────────────────────────────────────────────────────────────────
function RulesTab({ rules, loading, onAdd, onEdit, onToggle, onDelete }: {
  rules: FirewallRule[]; loading: boolean;
  onAdd: () => void;
  onEdit: (r: FirewallRule) => void;
  onToggle: (r: FirewallRule) => void;
  onDelete: (r: FirewallRule) => void;
}) {
  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-gray-300">{rules.length} rule{rules.length !== 1 ? 's' : ''}</h2>
        <button
          onClick={onAdd}
          className="flex items-center gap-2 px-3 py-1.5 bg-cyan-600 hover:bg-cyan-700 rounded-lg text-sm font-medium transition-colors"
        >
          <Plus className="w-4 h-4" /> New Rule
        </button>
      </div>

      {loading && <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-cyan-400" /></div>}

      {!loading && rules.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-gray-500">
          <Shield className="w-12 h-12 mb-3 opacity-30" />
          <p className="text-sm">No rules yet. Create your first rule to start filtering traffic.</p>
        </div>
      )}

      {!loading && rules.length > 0 && (
        <div className="space-y-2">
          {rules.map(rule => (
            <div key={rule._id} className={`bg-gray-900 rounded-xl p-4 border ${rule.enabled ? 'border-gray-700' : 'border-gray-800 opacity-60'} flex items-center gap-4`}>
              {/* Toggle */}
              <button onClick={() => onToggle(rule)} className="text-gray-400 hover:text-white transition-colors flex-shrink-0">
                {rule.enabled
                  ? <ToggleRight className="w-5 h-5 text-cyan-400" />
                  : <ToggleLeft  className="w-5 h-5" />}
              </button>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium text-white truncate">{rule.name}</span>
                  <span className="px-1.5 py-0.5 rounded text-xs bg-gray-700 text-gray-300">{TYPE_LABELS[rule.type] ?? rule.type}</span>
                  <ActionBadge a={rule.action} />
                  <SeverityBadge s={rule.severity} />
                </div>
                <div className="text-xs text-gray-500 mt-1 font-mono truncate" title={rule.value}>{rule.value}</div>
                {rule.description && <div className="text-xs text-gray-500 mt-0.5">{rule.description}</div>}
              </div>

              {/* Stats */}
              <div className="hidden sm:flex flex-col items-end text-xs text-gray-500 flex-shrink-0">
                <span>{rule.hitCount} hit{rule.hitCount !== 1 ? 's' : ''}</span>
                {rule.lastTriggeredAt && <span className="text-gray-600">Last: {fmtDate(rule.lastTriggeredAt)}</span>}
              </div>

              {/* Actions */}
              <div className="flex gap-1 flex-shrink-0">
                <button onClick={() => onEdit(rule)} className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors">
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => onDelete(rule)} className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-gray-700 rounded transition-colors">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Inspector Tab ──────────────────────────────────────────────────────────────
function InspectorTab({ form, setForm, onRun, loading, result, error, onBlockIp }: {
  form: { sourceIp: string; targetUrl: string; userAgent: string; requestBody: string; headers: string };
  setForm: React.Dispatch<React.SetStateAction<typeof form>>;
  onRun: () => void;
  loading: boolean;
  result: InspectResult | null;
  error: string;
  onBlockIp: (ip: string) => void;
}) {
  function field(key: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm(prev => ({ ...prev, [key]: e.target.value }));
  }

  const verdictIcon = result
    ? result.verdict === 'block'
      ? <XCircle className="w-6 h-6 text-red-400" />
      : result.verdict === 'monitor'
      ? <AlertTriangle className="w-6 h-6 text-yellow-400" />
      : <CheckCircle className="w-6 h-6 text-green-400" />
    : null;

  return (
    <div className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Input form */}
      <div className="space-y-4">
        <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">Request Details</h2>

        <div className="space-y-1">
          <label className="text-xs text-gray-400">Source IP <span className="text-red-400">*</span></label>
          <input
            value={form.sourceIp} onChange={field('sourceIp')} placeholder="192.168.1.100"
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500"
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs text-gray-400">Target URL <span className="text-red-400">*</span></label>
          <input
            value={form.targetUrl} onChange={field('targetUrl')} placeholder="https://api.example.com/users?id=1"
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500"
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs text-gray-400">User-Agent</label>
          <input
            value={form.userAgent} onChange={field('userAgent')} placeholder="Mozilla/5.0 ... or sqlmap/1.7"
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500"
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs text-gray-400">Request Body</label>
          <textarea
            value={form.requestBody} onChange={field('requestBody')} rows={4}
            placeholder={"username=admin' OR 1=1--&password=x"}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500 resize-none font-mono"
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs text-gray-400">Headers (JSON)</label>
          <textarea
            value={form.headers} onChange={field('headers')} rows={3}
            placeholder={'{"X-Forwarded-For": "10.0.0.1", "Content-Type": "application/json"}'}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500 resize-none font-mono"
          />
        </div>

        {error && (
          <div className="flex items-center gap-2 text-red-400 text-sm">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />{error}
          </div>
        )}

        <button
          onClick={onRun} disabled={loading}
          className="w-full flex items-center justify-center gap-2 py-2.5 bg-cyan-600 hover:bg-cyan-700 disabled:opacity-60 rounded-lg text-sm font-medium transition-colors"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ScanEye className="w-4 h-4" />}
          {loading ? 'Analyzing…' : 'Analyze Request'}
        </button>
      </div>

      {/* Results */}
      <div className="space-y-4">
        <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">Analysis Results</h2>

        {!result && !loading && (
          <div className="flex flex-col items-center justify-center py-20 text-gray-600 border border-dashed border-gray-700 rounded-xl">
            <ScanEye className="w-10 h-10 mb-2 opacity-40" />
            <p className="text-sm">Submit a request to see WAF analysis</p>
          </div>
        )}

        {loading && (
          <div className="flex flex-col items-center justify-center py-20 text-gray-500">
            <Loader2 className="w-8 h-8 animate-spin text-cyan-400 mb-2" />
            <p className="text-sm">Running AI analysis…</p>
          </div>
        )}

        {result && !loading && (
          <div className="space-y-4">
            {/* Verdict */}
            <div className={`rounded-xl p-4 border ${
              result.verdict === 'block'   ? 'bg-red-950/30 border-red-700'    :
              result.verdict === 'monitor' ? 'bg-yellow-950/30 border-yellow-700' :
              'bg-green-950/30 border-green-700'
            }`}>
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  {verdictIcon}
                  <div>
                    <div className="text-lg font-bold uppercase tracking-wider">
                      {result.verdict === 'block' ? 'BLOCKED' : result.verdict === 'monitor' ? 'MONITOR' : 'ALLOWED'}
                    </div>
                    <div className="text-xs text-gray-400">
                      {result.verdict === 'block'   ? 'This request would be blocked by the firewall.' :
                       result.verdict === 'monitor' ? 'This request is flagged for monitoring.'        :
                       'No threats detected. Request would be allowed.'}
                    </div>
                  </div>
                </div>
                {form.sourceIp.trim() && result.verdict !== 'allow' && (
                  <button
                    onClick={() => onBlockIp(form.sourceIp.trim())}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-red-700 hover:bg-red-600 rounded-lg text-xs font-medium text-white transition-colors flex-shrink-0"
                  >
                    <ShieldAlert className="w-3.5 h-3.5" />
                    Block IP
                  </button>
                )}
              </div>
            </div>

            {/* Matched rules */}
            {result.matchedRules.length > 0 && (
              <div className="bg-gray-900 rounded-xl p-4 border border-gray-700">
                <h3 className="text-xs font-semibold text-gray-400 uppercase mb-3">Matched Rules</h3>
                <div className="space-y-2">
                  {result.matchedRules.map(r => (
                    <div key={r._id} className="flex items-center gap-2 text-sm">
                      <Shield className="w-3.5 h-3.5 text-cyan-400 flex-shrink-0" />
                      <span className="text-white font-medium">{r.name}</span>
                      <span className="text-gray-500">·</span>
                      <span className="text-gray-400 text-xs">{TYPE_LABELS[r.type] ?? r.type}</span>
                      <ActionBadge a={r.action} />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* AI analysis */}
            <div className="bg-gray-900 rounded-xl p-4 border border-gray-700">
              <h3 className="text-xs font-semibold text-gray-400 uppercase mb-3">AI Threat Analysis</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-400">Threat Type</span>
                  <span className="text-sm font-medium text-white">{result.aiAnalysis.threatType ?? 'None detected'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-400">Severity</span>
                  <SeverityBadge s={result.aiAnalysis.severity} />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-400">Confidence</span>
                  <div className="flex items-center gap-2">
                    <div className="w-24 bg-gray-700 rounded-full h-1.5">
                      <div
                        className="bg-cyan-500 h-1.5 rounded-full"
                        style={{ width: `${Math.round((result.aiAnalysis.confidence ?? 0) * 100)}%` }}
                      />
                    </div>
                    <span className="text-xs text-gray-300">{Math.round((result.aiAnalysis.confidence ?? 0) * 100)}%</span>
                  </div>
                </div>
                {result.aiAnalysis.recommendation && (
                  <div className="pt-2 border-t border-gray-800">
                    <p className="text-xs text-gray-400 mb-1">Recommendation</p>
                    <p className="text-sm text-gray-300">{result.aiAnalysis.recommendation}</p>
                  </div>
                )}
                {result.aiAnalysis.indicators && result.aiAnalysis.indicators.length > 0 && (
                  <div className="pt-2 border-t border-gray-800">
                    <p className="text-xs text-gray-400 mb-2">Indicators</p>
                    <div className="flex flex-wrap gap-1">
                      {result.aiAnalysis.indicators.map((ind, i) => (
                        <span key={i} className="px-2 py-0.5 bg-gray-800 text-gray-300 rounded text-xs font-mono">{ind}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Finding link */}
            {result.findingId && (
              <a
                href={`/findings`}
                className="flex items-center gap-2 text-sm text-cyan-400 hover:text-cyan-300 transition-colors"
              >
                <AlertCircle className="w-4 h-4" />
                Finding auto-created — view in Findings Board
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Events Tab ─────────────────────────────────────────────────────────────────
function EventsTab({ events, total, page, loading, verdictFilter, setVerdictFilter, severityFilter, setSeverityFilter, onPageChange, onBlockIp }: {
  events: FirewallEventDoc[]; total: number; page: number; loading: boolean;
  verdictFilter: string; setVerdictFilter: (v: string) => void;
  severityFilter: string; setSeverityFilter: (v: string) => void;
  onPageChange: (p: number) => void;
  onBlockIp: (ip: string) => void;
}) {
  const pageSize = 20;
  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="p-6 space-y-4">
      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <Filter className="w-4 h-4 text-gray-400" />
        <select
          value={verdictFilter} onChange={e => setVerdictFilter(e.target.value)}
          className="bg-gray-800 border border-gray-700 text-sm text-white rounded-lg px-3 py-1.5 focus:outline-none focus:border-cyan-500"
        >
          <option value="">All Verdicts</option>
          <option value="block">Block</option>
          <option value="monitor">Monitor</option>
          <option value="allow">Allow</option>
        </select>
        <select
          value={severityFilter} onChange={e => setSeverityFilter(e.target.value)}
          className="bg-gray-800 border border-gray-700 text-sm text-white rounded-lg px-3 py-1.5 focus:outline-none focus:border-cyan-500"
        >
          <option value="">All Severities</option>
          <option value="critical">Critical</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
        <span className="text-xs text-gray-500 ml-auto">{total} event{total !== 1 ? 's' : ''}</span>
      </div>

      {loading && <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-cyan-400" /></div>}

      {!loading && events.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-gray-500">
          <Clock className="w-10 h-10 mb-2 opacity-30" />
          <p className="text-sm">No events yet. Run inspections to see them here.</p>
        </div>
      )}

      {!loading && events.length > 0 && (
        <>
          <div className="space-y-2">
            {events.map(ev => (
              <div key={ev._id} className="bg-gray-900 rounded-xl p-4 border border-gray-700 flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <VerdictBadge v={ev.verdict} />
                    {ev.aiSeverity && <SeverityBadge s={ev.aiSeverity} />}
                    {ev.aiThreatType && <span className="text-xs text-gray-400">{ev.aiThreatType}</span>}
                    {ev.matchedRuleName && (
                      <span className="text-xs text-gray-500">Rule: <span className="text-gray-300">{ev.matchedRuleName}</span></span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-gray-500 flex-wrap">
                    {ev.sourceIp  && <span>IP: <span className="text-gray-300 font-mono">{ev.sourceIp}</span></span>}
                    {ev.targetUrl && <span className="truncate max-w-xs" title={ev.targetUrl}>URL: <span className="text-gray-300">{ev.targetUrl}</span></span>}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {ev.sourceIp && (
                    <button
                      onClick={() => onBlockIp(ev.sourceIp!)}
                      className="flex items-center gap-1 px-2 py-1 bg-red-900/40 hover:bg-red-700 border border-red-700 rounded text-xs text-red-300 hover:text-white transition-colors"
                    >
                      <ShieldAlert className="w-3 h-3" />
                      Block IP
                    </button>
                  )}
                  {ev.findingId && (
                    <a href="/findings" className="text-xs text-cyan-400 hover:text-cyan-300">Finding ↗</a>
                  )}
                  <span className="text-xs text-gray-600">{fmtDate(ev.createdAt)}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                onClick={() => onPageChange(page - 1)} disabled={page <= 1}
                className="p-1.5 text-gray-400 hover:text-white disabled:opacity-40 hover:bg-gray-700 rounded transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-xs text-gray-400">{page} / {totalPages}</span>
              <button
                onClick={() => onPageChange(page + 1)} disabled={page >= totalPages}
                className="p-1.5 text-gray-400 hover:text-white disabled:opacity-40 hover:bg-gray-700 rounded transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── Rule Modal ─────────────────────────────────────────────────────────────────
function RuleModal({ editing, form, setForm, saving, error, onSave, onClose }: {
  editing: boolean;
  form: RuleFormState;
  setForm: React.Dispatch<React.SetStateAction<RuleFormState>>;
  saving: boolean;
  error: string;
  onSave: () => void;
  onClose: () => void;
}) {
  function f(key: keyof RuleFormState) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm(prev => ({ ...prev, [key]: e.target.value }));
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-full max-w-md mx-4 space-y-4 shadow-2xl">
        <h2 className="text-lg font-semibold text-white">{editing ? 'Edit Rule' : 'New Rule'}</h2>

        <div className="space-y-3">
          <div>
            <label className="text-xs text-gray-400 block mb-1">Rule Name</label>
            <input value={form.name} onChange={f('name')} placeholder="e.g. Block SQLmap scanner"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-400 block mb-1">Type</label>
              <select value={form.type} onChange={f('type')}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500">
                <option value="ip_block">IP Block</option>
                <option value="ip_allow">IP Allow</option>
                <option value="url_pattern">URL Pattern</option>
                <option value="user_agent">User-Agent</option>
                <option value="payload_pattern">Payload Pattern</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-400 block mb-1">Action</label>
              <select value={form.action} onChange={f('action')}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500">
                <option value="block">Block</option>
                <option value="allow">Allow</option>
                <option value="log">Log</option>
              </select>
            </div>
          </div>

          <div>
            {form.type === 'ip_block' || form.type === 'ip_allow' ? (
              <>
                <label className="text-xs text-gray-400 block mb-1">
                  IP Address <span className="text-gray-500">— single IP or CIDR range</span>
                </label>
                <input
                  value={form.value} onChange={f('value')}
                  placeholder="e.g.  203.0.113.42  or  10.0.0.0/24"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 font-mono focus:outline-none focus:border-cyan-500"
                />
                <p className="text-xs text-gray-600 mt-1">
                  Suspicious IPs from the WAF Inspector or Event Log can be pasted here to block all future requests.
                </p>
              </>
            ) : (
              <>
                <label className="text-xs text-gray-400 block mb-1">
                  Pattern <span className="text-gray-500">(regex)</span>
                </label>
                <input value={form.value} onChange={f('value')}
                  placeholder="e.g. (?i)(union select|drop table)"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 font-mono focus:outline-none focus:border-cyan-500" />
              </>
            )}
          </div>

          <div>
            <label className="text-xs text-gray-400 block mb-1">Severity</label>
            <select value={form.severity} onChange={f('severity')}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500">
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>

          <div>
            <label className="text-xs text-gray-400 block mb-1">Description (optional)</label>
            <input value={form.description} onChange={f('description')} placeholder="Why this rule exists"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500" />
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.enabled}
              onChange={e => setForm(prev => ({ ...prev, enabled: e.target.checked }))}
              className="accent-cyan-500" />
            <span className="text-sm text-gray-300">Enable rule immediately</span>
          </label>
        </div>

        {error && (
          <div className="flex items-center gap-2 text-red-400 text-sm">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />{error}
          </div>
        )}

        <div className="flex gap-3 pt-2">
          <button onClick={onClose} className="flex-1 py-2 border border-gray-600 text-gray-300 rounded-lg text-sm hover:border-gray-500 transition-colors">
            Cancel
          </button>
          <button onClick={onSave} disabled={saving}
            className="flex-1 py-2 bg-cyan-600 hover:bg-cyan-700 disabled:opacity-60 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {saving ? 'Saving…' : editing ? 'Update Rule' : 'Create Rule'}
          </button>
        </div>
      </div>
    </div>
  );
}
