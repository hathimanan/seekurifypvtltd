import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  X, User, Clock, Tag, Link, ChevronDown, CheckCircle2,
  Trash2, Flame, ShieldAlert, AlertTriangle, Flag, Info,
  RefreshCw, Eye, Shield, Pencil, Check, FileText,
} from 'lucide-react';
import { Finding } from './FindingsBoard';
import { API_BASE_URL } from '../services/api';
import { fetchWithAuth } from '../services/authService';

interface Props {
  finding: Finding;
  token: string;
  onClose: () => void;
  onUpdated: (f: Finding) => void;
  onDeleted: (id: string) => void;
}

const SEVERITY_META: Record<string, { label: string; color: string; icon: React.ReactElement }> = {
  critical: { label: 'Critical', color: 'text-red-400',    icon: <Flame        className="w-3.5 h-3.5" /> },
  high:     { label: 'High',     color: 'text-orange-400', icon: <ShieldAlert  className="w-3.5 h-3.5" /> },
  medium:   { label: 'Medium',   color: 'text-yellow-400', icon: <AlertTriangle className="w-3.5 h-3.5" /> },
  low:      { label: 'Low',      color: 'text-sky-400',    icon: <Flag         className="w-3.5 h-3.5" /> },
  info:     { label: 'Info',     color: 'text-gray-400',   icon: <Info         className="w-3.5 h-3.5" /> },
};

const STATUS_META: Record<string, { label: string; color: string; icon: React.ReactElement }> = {
  open:         { label: 'Open',        color: 'text-red-400',    icon: <ShieldAlert   className="w-3.5 h-3.5" /> },
  acknowledged: { label: 'Acknowledged',color: 'text-yellow-400', icon: <Eye           className="w-3.5 h-3.5" /> },
  in_progress:  { label: 'In Progress', color: 'text-sky-400',    icon: <RefreshCw     className="w-3.5 h-3.5" /> },
  to_be_retested: { label: 'To Be Re-Tested', color: 'text-violet-400', icon: <RefreshCw className="w-3.5 h-3.5" /> },
  resolved:     { label: 'Resolved',    color: 'text-green-400',  icon: <CheckCircle2  className="w-3.5 h-3.5" /> },
  ignored:      { label: 'Ignored',     color: 'text-gray-500',   icon: <X             className="w-3.5 h-3.5" /> },
};

const TIMELINE_ACTION_LABELS: Record<string, string> = {
  created:          'Finding created',
  status_changed:   'Status changed',
  assigned:         'Assignment changed',
  severity_changed: 'Severity changed',
  note_added:       'Note added',
};

const FindingDetailPanel: React.FC<Props> = ({ finding, token, onClose, onUpdated, onDeleted }) => {
  const [status, setStatus] = useState(finding.status);
  const [severity, setSeverity] = useState(finding.severity);
  const [assignedEmail, setAssignedEmail] = useState(finding.assignedTo?.email || '');
  const [remediationNotes, setRemediationNotes] = useState(finding.remediationNotes || '');
  const [fixSnippet, setFixSnippet] = useState(finding.fixSnippet || '');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [noteAdding, setNoteAdding] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [title, setTitle] = useState(finding.title);
  const [dirty, setDirty] = useState(false);

  // Track changes
  useEffect(() => {
    setDirty(
      status !== finding.status ||
      severity !== finding.severity ||
      remediationNotes !== (finding.remediationNotes || '') ||
      fixSnippet !== (finding.fixSnippet || '') ||
      assignedEmail !== (finding.assignedTo?.email || '')
    );
  }, [status, severity, remediationNotes, fixSnippet, assignedEmail, finding]);

  async function save(extra: object = {}) {
    setSaving(true);
    try {
      const body: Record<string, unknown> = { status, severity, remediationNotes, fixSnippet, ...extra };
      // Resolve assignedTo email to userId if changed
      if (assignedEmail !== (finding.assignedTo?.email || '')) {
        body.assignedToEmail = assignedEmail || null;
      }
      const res = await fetchWithAuth(`${API_BASE_URL}/findings/${finding._id}`, { method: 'PUT', body: JSON.stringify(body),
      });
      if (res.ok) onUpdated(await res.json());
    } catch { /* silent */ } finally { setSaving(false); }
  }

  async function saveTitle() {
    if (!title.trim()) return;
    const res = await fetchWithAuth(`${API_BASE_URL}/findings/${finding._id}`, { method: 'PUT', body: JSON.stringify({ title: title.trim() }),
    });
    if (res.ok) { onUpdated(await res.json()); setEditingTitle(false); }
  }

  async function addNote() {
    if (!note.trim()) return;
    setNoteAdding(true);
    const res = await fetchWithAuth(`${API_BASE_URL}/findings/${finding._id}`, { method: 'PUT', body: JSON.stringify({ note }),
    });
    if (res.ok) { onUpdated(await res.json()); setNote(''); }
    setNoteAdding(false);
  }

  async function handleDelete() {
    setDeleting(true);
    await fetch(`${API_BASE_URL}/findings/${finding._id}`, {
      method: 'DELETE', headers: { Authorization: `Bearer ${token}` },
    });
    onDeleted(finding._id);
  }

  const sev = SEVERITY_META[severity] ?? SEVERITY_META.info;
  const stat = STATUS_META[status] ?? STATUS_META.open;

  return (
    <>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 z-40"
        onClick={onClose}
      />

      {/* Side panel */}
      <motion.aside
        initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
        transition={{ type: 'spring', stiffness: 280, damping: 32 }}
        className="fixed right-0 top-0 h-full w-full max-w-xl bg-gray-900 border-l border-gray-700 z-50 flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-start gap-3 p-5 border-b border-gray-700">
          <div className="flex-1 min-w-0">
            {editingTitle ? (
              <div className="flex gap-2">
                <input autoFocus value={title} onChange={e => setTitle(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && saveTitle()}
                  className="flex-1 bg-gray-800 border border-gray-600 rounded px-2 py-1 text-sm focus:outline-none focus:border-amber-500"
                />
                <button onClick={saveTitle} className="text-green-400 hover:text-green-300"><Check className="w-4 h-4" /></button>
                <button onClick={() => { setTitle(finding.title); setEditingTitle(false); }} className="text-gray-400"><X className="w-4 h-4" /></button>
              </div>
            ) : (
              <div className="flex items-start gap-2 group">
                <h2 className="font-bold text-base text-white leading-snug">{finding.title}</h2>
                <button onClick={() => setEditingTitle(true)} className="opacity-0 group-hover:opacity-100 text-gray-500 hover:text-white mt-0.5 transition flex-shrink-0">
                  <Pencil className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
            <p className="text-xs text-gray-500 mt-1">
              Opened {new Date(finding.createdAt).toLocaleDateString()} · by {finding.userId?.name || finding.userId?.email}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white flex-shrink-0 mt-0.5">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">

          {/* Status + Severity quick-change */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Status</label>
              <select value={status} onChange={e => setStatus(e.target.value as Finding['status'])}
                className={`w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500 ${stat.color}`}>
                {Object.entries(STATUS_META).map(([k, v]) => (
                  <option key={k} value={k} className="text-white">{v.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Severity</label>
              <select value={severity} onChange={e => setSeverity(e.target.value as Finding['severity'])}
                className={`w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500 ${sev.color}`}>
                {Object.entries(SEVERITY_META).map(([k, v]) => (
                  <option key={k} value={k} className="text-white">{v.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Metadata grid */}
          <div className="bg-gray-800 rounded-xl p-4 space-y-2.5 text-sm">
            {finding.category && (
              <Row icon={<Tag className="w-3.5 h-3.5" />} label="Category" value={finding.category} />
            )}
            {finding.scanType && (
              <Row icon={<Shield className="w-3.5 h-3.5" />} label="Scan Type" value={finding.scanType} />
            )}
            {finding.sourceUrl && (
              <Row icon={<Link className="w-3.5 h-3.5" />} label="URL"
                value={<a href={finding.sourceUrl} target="_blank" rel="noreferrer"
                  className="text-amber-400 hover:underline truncate block max-w-xs">{finding.sourceUrl}</a>} />
            )}
            {finding.dueDate && (
              <Row icon={<Clock className="w-3.5 h-3.5" />} label="Due" value={new Date(finding.dueDate).toLocaleDateString()} />
            )}
            {finding.resolvedAt && (
              <Row icon={<CheckCircle2 className="w-3.5 h-3.5 text-green-400" />} label="Resolved"
                value={new Date(finding.resolvedAt).toLocaleDateString()} />
            )}
          </div>

          {/* Assign */}
          <div>
            <label className="text-xs text-gray-400 mb-1 block flex items-center gap-1"><User className="w-3.5 h-3.5" /> Assigned to (email)</label>
            <input type="email" value={assignedEmail} onChange={e => setAssignedEmail(e.target.value)}
              placeholder="colleague@company.com"
              className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500" />
            <p className="text-xs text-gray-600 mt-1">Assigned user must have a Seekurify account.</p>
          </div>

          {/* Description */}
          {finding.description && (
            <div>
              <p className="text-xs text-gray-400 mb-1">Description</p>
              <p className="text-sm text-gray-300 bg-gray-800 rounded-xl p-3 whitespace-pre-wrap">{finding.description}</p>
            </div>
          )}

          {/* Evidence */}
          {finding.evidence && (
            <div>
              <p className="text-xs text-gray-400 mb-1">Evidence</p>
              <pre className="text-xs text-gray-300 bg-gray-800 rounded-xl p-3 overflow-auto whitespace-pre-wrap font-mono">{finding.evidence}</pre>
            </div>
          )}

          {/* Remediation notes */}
          <div>
            <label className="text-xs text-gray-400 mb-1 block flex items-center gap-1">
              <FileText className="w-3.5 h-3.5" /> Remediation Notes
            </label>
            <textarea value={remediationNotes} onChange={e => setRemediationNotes(e.target.value)} rows={4}
              placeholder="Steps taken, decisions made, blockers…"
              className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500 resize-none" />
          </div>

          {/* Fix snippet */}
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Fix / Code Snippet</label>
            <textarea value={fixSnippet} onChange={e => setFixSnippet(e.target.value)} rows={3}
              placeholder="Paste config, code, or command to apply the fix…"
              className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500 resize-none font-mono" />
          </div>

          {/* Timeline */}
          {finding.timeline.length > 0 && (
            <div>
              <p className="text-xs text-gray-400 mb-3">Activity Timeline</p>
              <ol className="relative border-l border-gray-700 space-y-4 ml-2">
                {[...finding.timeline].reverse().map((t, i) => (
                  <li key={i} className="ml-4">
                    <span className="absolute -left-1.5 w-3 h-3 rounded-full bg-gray-600 border-2 border-gray-800 top-1" />
                    <p className="text-xs font-medium text-gray-300">
                      {TIMELINE_ACTION_LABELS[t.action] || t.action}
                      {t.from && t.to && t.action !== 'note_added' &&
                        <span className="text-gray-500"> ({t.from} → <span className="text-amber-400">{t.to}</span>)</span>}
                    </p>
                    {t.note && <p className="text-xs text-gray-400 mt-0.5 bg-gray-800 rounded px-2 py-1">{t.note}</p>}
                    <p className="text-xs text-gray-600 mt-0.5">
                      {t.by?.name || t.by?.email} · {new Date(t.at).toLocaleString()}
                    </p>
                  </li>
                ))}
              </ol>
            </div>
          )}

          {/* Add note */}
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Add Note</label>
            <div className="flex gap-2">
              <input type="text" value={note} onChange={e => setNote(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addNote()}
                placeholder="Type a note and press Enter…"
                className="flex-1 bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500" />
              <button onClick={addNote} disabled={noteAdding || !note.trim()}
                className="bg-gray-700 hover:bg-gray-600 disabled:opacity-50 text-white px-3 py-2 rounded-lg text-sm transition">
                {noteAdding ? '…' : 'Add'}
              </button>
            </div>
          </div>

          {/* Danger zone */}
          <div className="border border-red-500/20 rounded-xl p-4">
            {showDeleteConfirm ? (
              <div className="flex items-center gap-3">
                <p className="text-sm text-red-400 flex-1">Delete this finding permanently?</p>
                <button onClick={handleDelete} disabled={deleting}
                  className="bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white text-xs px-3 py-1.5 rounded-lg transition">
                  {deleting ? 'Deleting…' : 'Delete'}
                </button>
                <button onClick={() => setShowDeleteConfirm(false)} className="text-gray-400 text-xs">Cancel</button>
              </div>
            ) : (
              <button onClick={() => setShowDeleteConfirm(true)}
                className="flex items-center gap-2 text-sm text-red-400 hover:text-red-300 transition">
                <Trash2 className="w-4 h-4" /> Delete Finding
              </button>
            )}
          </div>
        </div>

        {/* Save footer */}
        <div className="p-4 border-t border-gray-700 flex gap-2">
          <button onClick={() => save()} disabled={saving || !dirty}
            className="flex-1 bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-slate-900 font-semibold py-2 rounded-lg text-sm transition">
            {saving ? 'Saving…' : dirty ? 'Save Changes' : 'Up to date'}
          </button>
          {/* Quick resolve */}
          {status !== 'resolved' && (
            <button onClick={() => { setStatus('resolved'); setTimeout(() => save({ status: 'resolved' }), 0); }}
              className="flex items-center gap-1.5 bg-green-700/40 hover:bg-green-700/60 text-green-400 border border-green-700/40 px-3 py-2 rounded-lg text-sm transition">
              <CheckCircle2 className="w-4 h-4" /> Resolve
            </button>
          )}
        </div>
      </motion.aside>
    </>
  );
};

function Row({ icon, label, value }: { icon: React.ReactElement; label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-gray-500 flex-shrink-0">{icon}</span>
      <span className="text-gray-500 w-24 flex-shrink-0">{label}</span>
      <span className="text-gray-300 truncate">{value}</span>
    </div>
  );
}

export default FindingDetailPanel;
