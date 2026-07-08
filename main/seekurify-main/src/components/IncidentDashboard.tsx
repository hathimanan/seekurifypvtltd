import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, ShieldAlert, X, Loader2, ChevronRight, User, Clock, AlertTriangle } from 'lucide-react';
import { apiService } from '../services/api';
import type { Incident, IncidentStats, CreateIncidentPayload } from '../types/soar';

const STATUS_COLORS: Record<string, string> = {
  open:          'bg-red-500/20 text-red-300 border-red-500/30',
  investigating: 'bg-orange-500/20 text-orange-300 border-orange-500/30',
  contained:     'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
  resolved:      'bg-green-500/20 text-green-300 border-green-500/30',
  closed:        'bg-gray-500/20 text-gray-400 border-gray-500/30',
};

const SEV_COLORS: Record<string, string> = {
  critical: 'text-red-400',
  high:     'text-orange-400',
  medium:   'text-yellow-400',
  low:      'text-blue-400',
};

const ALL_STATUSES = ['open', 'investigating', 'contained', 'resolved', 'closed'];
const ALL_SEVERITIES = ['critical', 'high', 'medium', 'low'];

export default function IncidentDashboard() {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [stats, setStats] = useState<IncidentStats>({ open: 0, investigating: 0, contained: 0, resolved: 0, closed: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [severityFilter, setSeverityFilter] = useState('');
  const [selected, setSelected] = useState<Incident | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState<CreateIncidentPayload>({ title: '', severity: 'high', description: '' });
  const [creating, setCreating] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [addNoteText, setAddNoteText] = useState('');

  const load = async () => {
    try {
      setLoading(true);
      const [iData, sData] = await Promise.all([
        apiService.getIncidents({ status: statusFilter || undefined, severity: severityFilter || undefined }),
        apiService.getIncidentStats(),
      ]);
      setIncidents(iData.incidents || []);
      setStats(sData);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [statusFilter, severityFilter]);

  const handleCreate = async () => {
    if (!createForm.title.trim()) return;
    setCreating(true);
    try {
      await apiService.createIncident(createForm);
      setShowCreate(false);
      setCreateForm({ title: '', severity: 'high', description: '' });
      await load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setCreating(false);
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    if (!selected) return;
    setUpdatingStatus(true);
    try {
      const updated = await apiService.updateIncident(selected._id, { status: newStatus });
      setSelected(updated);
      await load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleAddNote = async () => {
    if (!selected || !addNoteText.trim()) return;
    try {
      const updated = await apiService.updateIncident(selected._id, { note: addNoteText });
      setSelected(updated);
      setAddNoteText('');
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await apiService.deleteIncident(id);
      if (selected?._id === id) setSelected(null);
      await load();
    } catch (e: any) {
      setError(e.message);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">Incidents</h2>
          <p className="text-sm text-gray-400 mt-1">Security incidents auto-created or manually opened for investigation</p>
        </div>
        <button onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
          <Plus className="w-4 h-4" /> New Incident
        </button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-5 gap-3">
        {ALL_STATUSES.map(s => (
          <button key={s} onClick={() => setStatusFilter(statusFilter === s ? '' : s)}
            className={`rounded-xl p-3 text-center transition-colors border ${statusFilter === s ? 'bg-indigo-600/20 border-indigo-500/40' : 'bg-gray-800 border-gray-700 hover:border-gray-600'}`}>
            <div className="text-2xl font-bold text-white">{(stats as any)[s] ?? 0}</div>
            <div className="text-xs text-gray-400 capitalize mt-0.5">{s}</div>
          </button>
        ))}
      </div>

      {error && <div className="bg-red-900/30 border border-red-500/30 text-red-300 px-4 py-3 rounded-lg text-sm">{error}</div>}

      {/* Filters */}
      <div className="flex gap-3">
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          className="bg-gray-800 border border-gray-700 text-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500">
          <option value="">All statuses</option>
          {ALL_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={severityFilter} onChange={e => setSeverityFilter(e.target.value)}
          className="bg-gray-800 border border-gray-700 text-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500">
          <option value="">All severities</option>
          {ALL_SEVERITIES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {/* Incident table */}
      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 text-indigo-400 animate-spin" /></div>
      ) : incidents.length === 0 ? (
        <div className="text-center py-16 border border-gray-700 rounded-xl">
          <ShieldAlert className="w-10 h-10 text-gray-600 mx-auto mb-3" />
          <p className="text-gray-400 font-medium">No incidents</p>
          <p className="text-gray-500 text-sm mt-1">Incidents are created automatically when playbooks detect threats, or manually here</p>
        </div>
      ) : (
        <div className="border border-gray-700 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-800 text-gray-400 text-xs">
                <th className="text-left px-4 py-3 font-medium">Title</th>
                <th className="text-left px-4 py-3 font-medium">Severity</th>
                <th className="text-left px-4 py-3 font-medium">Status</th>
                <th className="text-left px-4 py-3 font-medium hidden md:table-cell">Category</th>
                <th className="text-left px-4 py-3 font-medium hidden lg:table-cell">Findings</th>
                <th className="text-left px-4 py-3 font-medium hidden lg:table-cell">Created</th>
                <th className="w-8" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {incidents.map(inc => (
                <tr key={inc._id} onClick={() => setSelected(inc)}
                  className="hover:bg-gray-800/50 cursor-pointer transition-colors">
                  <td className="px-4 py-3 text-white font-medium max-w-xs truncate">{inc.title}</td>
                  <td className="px-4 py-3">
                    <span className={`font-semibold text-xs ${SEV_COLORS[inc.severity]}`}>{inc.severity}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full border ${STATUS_COLORS[inc.status]}`}>{inc.status}</span>
                  </td>
                  <td className="px-4 py-3 text-gray-400 hidden md:table-cell">{inc.category || '—'}</td>
                  <td className="px-4 py-3 text-gray-400 hidden lg:table-cell">{inc.findingCount ?? (inc.findingIds?.length ?? 0)}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs hidden lg:table-cell">{new Date(inc.createdAt).toLocaleDateString()}</td>
                  <td className="px-4 py-3"><ChevronRight className="w-4 h-4 text-gray-600" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Detail panel */}
      <AnimatePresence>
        {selected && (
          <motion.div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={e => { if (e.target === e.currentTarget) setSelected(null); }}>
            <motion.div className="bg-gray-900 border-l border-gray-700 w-full max-w-xl flex flex-col h-full overflow-hidden"
              initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'spring', damping: 25 }}>
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700">
                <h3 className="text-white font-bold truncate pr-4">{selected.title}</h3>
                <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-white p-1 rounded flex-shrink-0"><X className="w-5 h-5" /></button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-5">
                {/* Status + Severity */}
                <div className="flex gap-3">
                  <div className="flex-1">
                    <label className="text-xs text-gray-400 mb-1 block">Status</label>
                    <select value={selected.status} onChange={e => handleStatusChange(e.target.value)} disabled={updatingStatus}
                      className="w-full bg-gray-800 border border-gray-600 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500">
                      {ALL_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 mb-1 block">Severity</label>
                    <span className={`block px-3 py-2 text-sm font-semibold ${SEV_COLORS[selected.severity]}`}>{selected.severity}</span>
                  </div>
                </div>

                {/* Assigned to */}
                {selected.assignedTo && (
                  <div className="flex items-center gap-2 text-sm text-gray-300">
                    <User className="w-4 h-4 text-gray-500" />
                    Assigned to: {(selected.assignedTo as any).name || (selected.assignedTo as any).email}
                  </div>
                )}

                {/* Description */}
                {selected.description && (
                  <div>
                    <p className="text-xs text-gray-400 mb-1">Description</p>
                    <p className="text-sm text-gray-300">{selected.description}</p>
                  </div>
                )}

                {/* Linked findings */}
                {(selected.findingIds?.length > 0) && (
                  <div>
                    <p className="text-xs text-gray-400 mb-2">Linked Findings ({selected.findingIds.length})</p>
                    <div className="space-y-1">
                      {selected.findingIds.map((f: any) => (
                        <div key={f._id || f} className="flex items-center gap-2 bg-gray-800 px-3 py-2 rounded-lg text-sm">
                          <AlertTriangle className="w-3.5 h-3.5 text-orange-400 flex-shrink-0" />
                          <span className="text-gray-300 truncate">{f.title || String(f._id || f)}</span>
                          {f.severity && <span className={`text-xs ml-auto flex-shrink-0 ${SEV_COLORS[f.severity]}`}>{f.severity}</span>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Trigger info */}
                {selected.triggerEventType && (
                  <div className="bg-gray-800 rounded-lg px-3 py-2 text-xs">
                    <span className="text-gray-400">Triggered by: </span>
                    <span className="text-indigo-300">{selected.triggerEventType}</span>
                  </div>
                )}

                {/* Add note */}
                <div>
                  <p className="text-xs text-gray-400 mb-2">Add Note</p>
                  <div className="flex gap-2">
                    <input value={addNoteText} onChange={e => setAddNoteText(e.target.value)} placeholder="Investigation note…"
                      className="flex-1 bg-gray-800 border border-gray-600 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500" />
                    <button onClick={handleAddNote} disabled={!addNoteText.trim()}
                      className="px-3 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-900 text-white rounded-lg text-sm transition-colors">Add</button>
                  </div>
                </div>

                {/* Timeline */}
                {selected.timeline?.length > 0 && (
                  <div>
                    <p className="text-xs text-gray-400 mb-2">Timeline</p>
                    <div className="space-y-2">
                      {[...selected.timeline].reverse().map((entry, i) => (
                        <div key={i} className="flex items-start gap-2 text-xs">
                          <Clock className="w-3.5 h-3.5 text-gray-500 mt-0.5 flex-shrink-0" />
                          <div>
                            <span className="text-gray-300 capitalize">{entry.action.replace(/_/g, ' ')}</span>
                            {entry.note && <span className="text-gray-400"> — {entry.note}</span>}
                            {(entry.from || entry.to) && <span className="text-gray-500"> {entry.from} → {entry.to}</span>}
                            <div className="text-gray-500 mt-0.5">{new Date(entry.at).toLocaleString()}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="px-6 py-4 border-t border-gray-700">
                <button onClick={() => handleDelete(selected._id)}
                  className="w-full text-red-400 hover:text-red-300 hover:bg-red-900/20 py-2 rounded-lg text-sm transition-colors">
                  Delete Incident
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Create modal */}
      <AnimatePresence>
        {showCreate && (
          <motion.div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-full max-w-md mx-4"
              initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}>
              <h3 className="text-white font-bold text-lg mb-5">New Incident</h3>
              <div className="space-y-4">
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">Title *</label>
                  <input value={createForm.title} onChange={e => setCreateForm(f => ({ ...f, title: e.target.value }))}
                    placeholder="Describe the incident"
                    className="w-full bg-gray-800 border border-gray-600 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500" />
                </div>
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">Severity</label>
                  <select value={createForm.severity} onChange={e => setCreateForm(f => ({ ...f, severity: e.target.value as any }))}
                    className="w-full bg-gray-800 border border-gray-600 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500">
                    {ALL_SEVERITIES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">Description (optional)</label>
                  <textarea value={createForm.description} onChange={e => setCreateForm(f => ({ ...f, description: e.target.value }))}
                    rows={3} placeholder="Context, affected systems, initial observations…"
                    className="w-full bg-gray-800 border border-gray-600 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 resize-none" />
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <button onClick={handleCreate} disabled={creating || !createForm.title.trim()}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-900 text-white py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2">
                  {creating && <Loader2 className="w-4 h-4 animate-spin" />} Create Incident
                </button>
                <button onClick={() => setShowCreate(false)} className="px-4 py-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg text-sm transition-colors">Cancel</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
