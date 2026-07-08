import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertTriangle, ShieldAlert, ShieldCheck, Info, CheckCircle2,
  Clock, User, Plus, Filter, Search, BarChart3, ChevronDown,
  X, Flame, Zap, Flag, Eye, RefreshCw,
} from 'lucide-react';
import AppSidebar from './ui/AppSidebar';
import Header from './ui/Header';
import { API_BASE_URL } from '../services/api';
import { fetchWithAuth } from '../services/authService';
import FindingDetailPanel from './FindingDetailPanel';

// ─── Types ────────────────────────────────────────────────────────────────────
export interface Finding {
  _id: string;
  title: string;
  description?: string;
  evidence?: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  category?: string;
  status: 'open' | 'acknowledged' | 'in_progress' | 'to_be_retested' | 'resolved' | 'ignored';
  scanType: string;
  sourceUrl?: string;
  assignedTo?: { _id: string; name: string; email: string; profileImage?: string } | null;
  userId: { _id: string; name: string; email: string };
  remediationNotes?: string;
  fixSnippet?: string;
  dueDate?: string;
  resolvedAt?: string;
  createdAt: string;
  timeline: { action: string; from?: string; to?: string; note?: string; by: { name: string; email: string }; at: string }[];
}

interface Stats {
  total: number; open: number; acknowledged: number; in_progress: number; to_be_retested: number; resolved: number; ignored: number;
  critical: number; high: number; medium: number; low: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────
const SEVERITY_META: Record<string, { label: string; color: string; bg: string; icon: React.ReactElement }> = {
  critical: { label: 'Critical', color: 'text-red-400', bg: 'bg-red-400/10 border-red-500/30', icon: <Flame    className="w-3.5 h-3.5" /> },
  high:     { label: 'High',     color: 'text-orange-400', bg: 'bg-orange-400/10 border-orange-500/30', icon: <ShieldAlert className="w-3.5 h-3.5" /> },
  medium:   { label: 'Medium',   color: 'text-yellow-400', bg: 'bg-yellow-400/10 border-yellow-500/30', icon: <AlertTriangle className="w-3.5 h-3.5" /> },
  low:      { label: 'Low',      color: 'text-sky-400',    bg: 'bg-sky-400/10 border-sky-500/30',       icon: <Flag    className="w-3.5 h-3.5" /> },
  info:     { label: 'Info',     color: 'text-gray-400',   bg: 'bg-gray-400/10 border-gray-600',         icon: <Info    className="w-3.5 h-3.5" /> },
};

const STATUS_COLUMNS: { key: Finding['status']; label: string; color: string; icon: React.ReactElement }[] = [
  { key: 'open',         label: 'Open',        color: 'text-red-400',    icon: <ShieldAlert   className="w-4 h-4" /> },
  { key: 'acknowledged', label: 'Acknowledged',color: 'text-yellow-400', icon: <Eye           className="w-4 h-4" /> },
  { key: 'in_progress',  label: 'In Progress', color: 'text-sky-400',    icon: <RefreshCw     className="w-4 h-4" /> },
  { key: 'to_be_retested', label: 'To Be Re-Tested', color: 'text-violet-400', icon: <RefreshCw className="w-4 h-4" /> },
  { key: 'resolved',     label: 'Resolved',    color: 'text-green-400',  icon: <CheckCircle2  className="w-4 h-4" /> },
  { key: 'ignored',      label: 'Ignored',     color: 'text-gray-500',   icon: <X             className="w-4 h-4" /> },
];

const SCAN_TYPE_LABELS: Record<string, string> = {
  redteam: 'Red Team', injection: 'Injection', siteaudit: 'Site Audit',
  pii: 'PII', aiagent: 'AI Agent', manual: 'Manual',
};

// ─── Create Finding Modal ─────────────────────────────────────────────────────
const CreateFindingModal: React.FC<{ onClose: () => void; onCreate: (f: Finding) => void; token: string }> = ({ onClose, onCreate, token }) => {
  const [form, setForm] = useState({
    title: '', description: '', severity: 'medium', category: '', evidence: '', sourceUrl: '', remediationNotes: '', dueDate: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit() {
    if (!form.title.trim()) { setError('Title is required'); return; }
    setSaving(true);
    setError('');
    try {
      const res = await fetchWithAuth(`${API_BASE_URL}/findings`, { method: 'POST', body: JSON.stringify(form),
      });
      if (!res.ok) { const d = await res.json(); setError(d.error || 'Failed'); return; }
      onCreate(await res.json());
      onClose();
    } catch { setError('Network error'); } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }}
        className="bg-gray-800 border border-gray-700 rounded-2xl p-6 w-full max-w-lg"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-bold text-lg flex items-center gap-2"><Plus className="w-5 h-5 text-amber-400" /> New Finding</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white"><X className="w-5 h-5" /></button>
        </div>

        <div className="space-y-3">
          <input
            type="text" placeholder="Finding title *" value={form.title} maxLength={200}
            onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
            className="w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500"
          />
          <div className="grid grid-cols-2 gap-3">
            <select value={form.severity} onChange={e => setForm(p => ({ ...p, severity: e.target.value }))}
              className="bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500">
              {Object.entries(SEVERITY_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
            <input type="text" placeholder="Category (e.g. Missing HSTS)" value={form.category}
              onChange={e => setForm(p => ({ ...p, category: e.target.value }))}
              className="bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500" />
          </div>
          <textarea placeholder="Description" value={form.description} rows={3}
            onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
            className="w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500 resize-none" />
          <input type="text" placeholder="Evidence / payload (optional)" value={form.evidence}
            onChange={e => setForm(p => ({ ...p, evidence: e.target.value }))}
            className="w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500" />
          <input type="text" placeholder="Affected URL (optional)" value={form.sourceUrl}
            onChange={e => setForm(p => ({ ...p, sourceUrl: e.target.value }))}
            className="w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500" />
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-400 whitespace-nowrap">Due date</label>
            <input type="date" value={form.dueDate}
              onChange={e => setForm(p => ({ ...p, dueDate: e.target.value }))}
              className="bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500" />
          </div>
        </div>

        {error && <p className="text-red-400 text-xs mt-2">{error}</p>}

        <div className="flex gap-2 mt-5">
          <button onClick={handleSubmit} disabled={saving}
            className="flex-1 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-900 font-semibold py-2 rounded-lg text-sm transition">
            {saving ? 'Creating…' : 'Create Finding'}
          </button>
          <button onClick={onClose} className="px-4 py-2 text-gray-400 hover:text-white text-sm rounded-lg transition">Cancel</button>
        </div>
      </motion.div>
    </div>
  );
};

// ─── Finding Card ─────────────────────────────────────────────────────────────
const FindingCard: React.FC<{ finding: Finding; onClick: () => void }> = ({ finding, onClick }) => {
  const sev = SEVERITY_META[finding.severity] ?? SEVERITY_META.info;
  const overdue = finding.dueDate && !finding.resolvedAt && new Date(finding.dueDate) < new Date();

  return (
    <motion.div layout initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      onClick={onClick}
      className={`bg-gray-800 border rounded-xl p-4 cursor-pointer hover:border-amber-500/40 transition ${sev.bg}`}
    >
      <div className="flex items-start gap-2 mb-2">
        <span className={`flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full border ${sev.bg} ${sev.color} flex-shrink-0`}>
          {sev.icon} {sev.label}
        </span>
        {finding.category && (
          <span className="text-xs text-gray-500 bg-gray-700 px-2 py-0.5 rounded-full truncate">{finding.category}</span>
        )}
      </div>

      <p className="text-sm font-medium text-white leading-snug mb-2 line-clamp-2">{finding.title}</p>

      {finding.description && (
        <p className="text-xs text-gray-400 line-clamp-2 mb-3">{finding.description}</p>
      )}

      <div className="flex items-center justify-between gap-2 text-xs text-gray-500">
        <div className="flex items-center gap-2">
          <span className="bg-gray-700 px-1.5 py-0.5 rounded text-gray-400">
            {SCAN_TYPE_LABELS[finding.scanType] || finding.scanType}
          </span>
          {finding.assignedTo && (
            <span className="flex items-center gap-1">
              <User className="w-3 h-3" /> {finding.assignedTo.name || finding.assignedTo.email}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {overdue && <span className="text-red-400 flex items-center gap-0.5"><Clock className="w-3 h-3" /> Overdue</span>}
          {!overdue && finding.dueDate && !finding.resolvedAt && (
            <span className="flex items-center gap-0.5"><Clock className="w-3 h-3" /> {new Date(finding.dueDate).toLocaleDateString()}</span>
          )}
        </div>
      </div>
    </motion.div>
  );
};

// ─── Main Board ───────────────────────────────────────────────────────────────
const FindingsBoard: React.FC = () => {
  const navigate = useNavigate();
  const [findings, setFindings] = useState<Finding[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [severityFilter, setSeverityFilter] = useState<string>('');
  const [scanTypeFilter, setScanTypeFilter] = useState<string>('');
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<'kanban' | 'list'>('kanban');

  // Modals
  const [showCreate, setShowCreate] = useState(false);
  const [selectedFinding, setSelectedFinding] = useState<Finding | null>(null);

  const [sidebarExpanded, setSidebarExpanded] = useState(true);
  const [profileImage, setProfileImage] = useState('');

  const token = localStorage.getItem('token') || localStorage.getItem('googleToken') || '';

  const fetchAll = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set('status', statusFilter);
      if (severityFilter) params.set('severity', severityFilter);
      if (scanTypeFilter) params.set('scanType', scanTypeFilter);

      const [fRes, sRes] = await Promise.all([
        fetch(`${API_BASE_URL}/findings?${params}&limit=200`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_BASE_URL}/findings/stats`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      if (!fRes.ok) throw new Error();
      const [fd, sd] = await Promise.all([fRes.json(), sRes.ok ? sRes.json() : null]);
      setFindings(fd.findings);
      if (sd) setStats(sd);
    } catch {
      setError('Could not load findings.');
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter, severityFilter, scanTypeFilter]);

  useEffect(() => {
    fetchAll();
    fetch(`${API_BASE_URL}/profile`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(d => setProfileImage(d.profileImage || ''))
      .catch(() => {});
  }, [fetchAll]);

  function handleLogout() {
    localStorage.removeItem('token');
    localStorage.removeItem('googleToken');
    navigate('/login');
  }

  function handleFindingUpdated(updated: Finding) {
    setFindings(prev => prev.map(f => f._id === updated._id ? updated : f));
    if (selectedFinding?._id === updated._id) setSelectedFinding(updated);
    fetchAll();
  }

  function handleFindingDeleted(id: string) {
    setFindings(prev => prev.filter(f => f._id !== id));
    setSelectedFinding(null);
    fetchAll();
  }

  const filtered = findings.filter(f => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return f.title.toLowerCase().includes(q) ||
      f.category?.toLowerCase().includes(q) ||
      f.description?.toLowerCase().includes(q) ||
      f.sourceUrl?.toLowerCase().includes(q);
  });

  // Group by status for kanban
  const byStatus = Object.fromEntries(
    STATUS_COLUMNS.map(col => [col.key, filtered.filter(f => f.status === col.key)])
  ) as Record<Finding['status'], Finding[]>;

  return (
    <div className="flex h-screen bg-gray-950 text-white overflow-hidden">
      <AppSidebar sidebarExpanded={sidebarExpanded} setSidebarExpanded={setSidebarExpanded} />

      <div className="flex flex-col flex-1 overflow-hidden">
        <Header token={token} handleLogout={handleLogout} profileImage={profileImage} />

        <main className="flex-1 overflow-y-auto p-6">
          {/* Page header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <ShieldAlert className="w-6 h-6 text-amber-400" /> Findings
              </h1>
              <p className="text-gray-400 text-sm mt-1">Track, assign, and remediate security issues from all scans.</p>
            </div>
            <button
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-slate-900 font-semibold px-4 py-2 rounded-lg transition text-sm"
            >
              <Plus className="w-4 h-4" /> New Finding
            </button>
          </div>

          {/* Stats bar */}
          {stats && (
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3 mb-6">
              {[
                { label: 'Open',       value: stats.open,         color: 'text-red-400' },
                { label: 'In Progress',value: stats.in_progress,  color: 'text-sky-400' },
                { label: 'To Be Re-Tested', value: stats.to_be_retested, color: 'text-violet-400' },
                { label: 'Resolved',   value: stats.resolved,     color: 'text-green-400' },
                { label: 'Critical',   value: stats.critical,     color: 'text-red-400' },
                { label: 'High',       value: stats.high,         color: 'text-orange-400' },
                { label: 'Medium',     value: stats.medium,       color: 'text-yellow-400' },
                { label: 'Low',        value: stats.low,          color: 'text-sky-400' },
              ].map(s => (
                <div key={s.label} className="bg-gray-800 border border-gray-700 rounded-xl p-3 text-center">
                  <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
                </div>
              ))}
            </div>
          )}

          {/* Filter + view toggle bar */}
          <div className="flex flex-wrap gap-2 mb-5">
            <div className="relative flex-1 min-w-48">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input
                type="text" placeholder="Search findings…" value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:border-amber-500"
              />
            </div>

            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
              className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500">
              <option value="">All Statuses</option>
              {STATUS_COLUMNS.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
            </select>

            <select value={severityFilter} onChange={e => setSeverityFilter(e.target.value)}
              className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500">
              <option value="">All Severities</option>
              {Object.entries(SEVERITY_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>

            <select value={scanTypeFilter} onChange={e => setScanTypeFilter(e.target.value)}
              className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500">
              <option value="">All Scan Types</option>
              {Object.entries(SCAN_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>

            <div className="flex rounded-lg border border-gray-700 overflow-hidden">
              {(['kanban', 'list'] as const).map(m => (
                <button key={m} onClick={() => setViewMode(m)}
                  className={`px-3 py-2 text-sm transition ${viewMode === m ? 'bg-amber-500 text-slate-900 font-semibold' : 'bg-gray-800 text-gray-400 hover:text-white'}`}>
                  {m.charAt(0).toUpperCase() + m.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Content */}
          {isLoading ? (
            <div className="flex items-center justify-center h-48 text-gray-500">Loading…</div>
          ) : error ? (
            <div className="text-red-400 text-center mt-16">{error}</div>
          ) : findings.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-center">
              <ShieldCheck className="w-12 h-12 text-gray-600 mb-4" />
              <p className="text-gray-400 text-lg font-medium">No findings tracked yet</p>
              <p className="text-gray-500 text-sm mt-1">
                Create a finding manually or use "Track as Finding" from any scan result.
              </p>
              <button onClick={() => setShowCreate(true)}
                className="mt-4 flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-slate-900 font-semibold px-4 py-2 rounded-lg text-sm transition">
                <Plus className="w-4 h-4" /> Create First Finding
              </button>
            </div>
          ) : viewMode === 'kanban' ? (
            /* ── Kanban Board ── */
            <div className="flex gap-4 overflow-x-auto pb-4">
              {STATUS_COLUMNS.map(col => (
                <div key={col.key} className="flex-shrink-0 w-72">
                  <div className={`flex items-center gap-2 mb-3 ${col.color}`}>
                    {col.icon}
                    <span className="font-semibold text-sm">{col.label}</span>
                    <span className="ml-auto bg-gray-700 text-gray-300 text-xs px-2 py-0.5 rounded-full">
                      {byStatus[col.key].length}
                    </span>
                  </div>
                  <div className="space-y-3 min-h-16">
                    {byStatus[col.key].map(f => (
                      <FindingCard key={f._id} finding={f} onClick={() => setSelectedFinding(f)} />
                    ))}
                    {byStatus[col.key].length === 0 && (
                      <div className="border border-dashed border-gray-700 rounded-xl h-16 flex items-center justify-center text-gray-600 text-xs">
                        No findings
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            /* ── List View ── */
            <div className="space-y-2">
              {filtered.map(f => {
                const sev = SEVERITY_META[f.severity] ?? SEVERITY_META.info;
                const col = STATUS_COLUMNS.find(s => s.key === f.status);
                return (
                  <motion.div key={f._id} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                    onClick={() => setSelectedFinding(f)}
                    className="flex items-center gap-4 bg-gray-800 border border-gray-700 hover:border-amber-500/40 rounded-xl px-4 py-3 cursor-pointer transition"
                  >
                    <span className={`flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full border ${sev.bg} ${sev.color} flex-shrink-0`}>
                      {sev.icon} {sev.label}
                    </span>
                    <p className="font-medium text-sm text-white flex-1 truncate">{f.title}</p>
                    {f.category && <span className="text-xs text-gray-500 hidden sm:block">{f.category}</span>}
                    <span className="text-xs text-gray-500 hidden md:block">{SCAN_TYPE_LABELS[f.scanType] || f.scanType}</span>
                    <span className={`flex items-center gap-1 text-xs ${col?.color ?? 'text-gray-400'} flex-shrink-0`}>
                      {col?.icon} {col?.label}
                    </span>
                    {f.assignedTo && (
                      <span className="text-xs text-gray-400 flex items-center gap-1 flex-shrink-0 hidden lg:flex">
                        <User className="w-3 h-3" /> {f.assignedTo.name || f.assignedTo.email}
                      </span>
                    )}
                  </motion.div>
                );
              })}
            </div>
          )}
        </main>
      </div>

      {/* Create modal */}
      <AnimatePresence>
        {showCreate && (
          <CreateFindingModal
            token={token}
            onClose={() => setShowCreate(false)}
            onCreate={f => { setFindings(prev => [f, ...prev]); fetchAll(); }}
          />
        )}
      </AnimatePresence>

      {/* Detail panel */}
      <AnimatePresence>
        {selectedFinding && (
          <FindingDetailPanel
            finding={selectedFinding}
            token={token}
            onClose={() => setSelectedFinding(null)}
            onUpdated={handleFindingUpdated}
            onDeleted={handleFindingDeleted}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default FindingsBoard;
