import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Zap, Play, Trash2, Edit2, ChevronDown, ChevronRight, Loader2, CheckCircle, AlertCircle, Clock } from 'lucide-react';
import { apiService } from '../services/api';
import type { Playbook, PlaybookRun } from '../types/soar';
import PlaybookBuilder from './PlaybookBuilder';

const EVENT_LABELS: Record<string, string> = {
  breach_detected:     'Breach',
  risk_score_critical: 'Risk Score',
  login_anomaly:       'Login Anomaly',
  site_degraded:       'Site Degraded',
  finding_opened:      'Finding Opened',
};

const STATUS_COLORS: Record<string, string> = {
  success: 'text-green-400',
  partial: 'text-yellow-400',
  failed:  'text-red-400',
  running: 'text-blue-400',
};

const STATUS_ICONS: Record<string, React.ReactNode> = {
  success: <CheckCircle className="w-3.5 h-3.5" />,
  partial: <AlertCircle className="w-3.5 h-3.5" />,
  failed:  <AlertCircle className="w-3.5 h-3.5" />,
  running: <Loader2 className="w-3.5 h-3.5 animate-spin" />,
};

export default function PlaybookList() {
  const [playbooks, setPlaybooks] = useState<Playbook[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showBuilder, setShowBuilder] = useState(false);
  const [editingPlaybook, setEditingPlaybook] = useState<Playbook | undefined>(undefined);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [runsMap, setRunsMap] = useState<Record<string, PlaybookRun[]>>({});
  const [runningId, setRunningId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const load = async () => {
    try {
      setLoading(true);
      const data = await apiService.getPlaybooks();
      setPlaybooks(data.playbooks || []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleSave = async (p: Playbook) => {
    setShowBuilder(false);
    setEditingPlaybook(undefined);
    await load();
  };

  const handleToggle = async (p: Playbook) => {
    setTogglingId(p._id);
    try {
      await apiService.togglePlaybook(p._id, !p.enabled);
      await load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setTogglingId(null);
    }
  };

  const handleRun = async (p: Playbook) => {
    setRunningId(p._id);
    try {
      await apiService.runPlaybook(p._id, {});
      await load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setRunningId(null);
    }
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await apiService.deletePlaybook(id);
      setPlaybooks(ps => ps.filter(p => p._id !== id));
    } catch (e: any) {
      setError(e.message);
    } finally {
      setDeletingId(null);
    }
  };

  const toggleExpand = async (p: Playbook) => {
    if (expandedId === p._id) { setExpandedId(null); return; }
    setExpandedId(p._id);
    if (!runsMap[p._id]) {
      try {
        const data = await apiService.getRunsForPlaybook(p._id, 5);
        setRunsMap(m => ({ ...m, [p._id]: data.runs || [] }));
      } catch {}
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">Playbooks</h2>
          <p className="text-sm text-gray-400 mt-1">Automated response workflows triggered by security events</p>
        </div>
        <button onClick={() => { setEditingPlaybook(undefined); setShowBuilder(true); }}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
          <Plus className="w-4 h-4" /> New Playbook
        </button>
      </div>

      {error && <div className="bg-red-900/30 border border-red-500/30 text-red-300 px-4 py-3 rounded-lg text-sm">{error}</div>}

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 text-indigo-400 animate-spin" /></div>
      ) : playbooks.length === 0 ? (
        <div className="text-center py-16 border border-gray-700 rounded-xl">
          <Zap className="w-10 h-10 text-gray-600 mx-auto mb-3" />
          <p className="text-gray-400 font-medium">No playbooks yet</p>
          <p className="text-gray-500 text-sm mt-1">Create a playbook to automatically respond to security events</p>
          <button onClick={() => setShowBuilder(true)} className="mt-4 bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg text-sm transition-colors">
            Create First Playbook
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {playbooks.map(p => (
            <motion.div key={p._id} layout className="bg-gray-800 border border-gray-700 rounded-xl overflow-hidden">
              <div className="px-5 py-4 flex items-center gap-4">
                {/* Enable toggle */}
                <button onClick={() => handleToggle(p)} disabled={togglingId === p._id}
                  className={`relative w-10 h-5 rounded-full transition-colors flex-shrink-0 ${p.enabled ? 'bg-indigo-600' : 'bg-gray-600'}`}>
                  <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${p.enabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
                </button>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-white font-semibold text-sm truncate">{p.name}</span>
                    <span className="bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-xs px-2 py-0.5 rounded-full">
                      {EVENT_LABELS[p.trigger?.eventType] || p.trigger?.eventType}
                    </span>
                    <span className="text-gray-500 text-xs">{(p.stepCount ?? p.steps?.length ?? 0)} steps</span>
                  </div>
                  {p.lastRunAt && (
                    <div className={`flex items-center gap-1 text-xs mt-0.5 ${STATUS_COLORS[p.lastRunStatus || 'running'] || 'text-gray-500'}`}>
                      {STATUS_ICONS[p.lastRunStatus || 'running']}
                      Last run: {new Date(p.lastRunAt).toLocaleDateString()} · {p.runCount} total
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-1 flex-shrink-0">
                  <button onClick={() => handleRun(p)} disabled={runningId === p._id}
                    title="Manual run" className="p-2 text-gray-400 hover:text-green-400 hover:bg-gray-700 rounded-lg transition-colors">
                    {runningId === p._id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                  </button>
                  <button onClick={() => { setEditingPlaybook(p); setShowBuilder(true); }}
                    className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors">
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button onClick={() => handleDelete(p._id)} disabled={deletingId === p._id}
                    className="p-2 text-gray-400 hover:text-red-400 hover:bg-gray-700 rounded-lg transition-colors">
                    {deletingId === p._id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                  </button>
                  <button onClick={() => toggleExpand(p)} className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors">
                    {expandedId === p._id ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Run history panel */}
              <AnimatePresence>
                {expandedId === p._id && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                    className="border-t border-gray-700 overflow-hidden">
                    <div className="px-5 py-3">
                      <p className="text-xs text-gray-400 mb-2 font-medium">Recent Runs</p>
                      {!runsMap[p._id] ? (
                        <div className="flex items-center gap-2 text-xs text-gray-500"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading…</div>
                      ) : runsMap[p._id].length === 0 ? (
                        <p className="text-xs text-gray-500">No runs yet — click the play button to test</p>
                      ) : (
                        <div className="space-y-2">
                          {runsMap[p._id].map(run => (
                            <div key={run._id} className="text-xs space-y-1">
                              <div className="flex items-center gap-3">
                                <span className={`flex items-center gap-1 ${STATUS_COLORS[run.status]}`}>
                                  {STATUS_ICONS[run.status]} {run.status}
                                </span>
                                <span className="text-gray-400">{run.triggerEventType}</span>
                                <span className="text-gray-500 ml-auto">{new Date(run.startedAt).toLocaleString()}</span>
                                {run.durationMs != null && <span className="text-gray-500">{run.durationMs}ms</span>}
                              </div>
                              {run.stepResults?.filter(s => s.status === 'failed').map((s, i) => (
                                <div key={i} className="ml-4 flex items-start gap-2 text-red-400 bg-red-900/20 border border-red-500/20 rounded px-2 py-1">
                                  <AlertCircle className="w-3 h-3 mt-0.5 flex-shrink-0" />
                                  <span><span className="font-medium">{s.label || s.action}:</span> {s.error || 'unknown error'}</span>
                                </div>
                              ))}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </div>
      )}

      <AnimatePresence>
        {showBuilder && (
          <PlaybookBuilder
            playbook={editingPlaybook}
            onSave={handleSave}
            onClose={() => { setShowBuilder(false); setEditingPlaybook(undefined); }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
