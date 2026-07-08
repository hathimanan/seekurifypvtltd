import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, Play, ChevronDown, ChevronRight, Loader2, CheckCircle, AlertCircle, ShieldAlert, KeyRound, RefreshCw } from 'lucide-react';
import { apiService } from '../services/api';

interface ScanFinding {
  passwordId: string;
  website: string;
  username: string;
  type: 'breach' | 'risk_score';
  level?: string;
  score?: number;
  breachCount?: number;
}

interface ScanSummary {
  credentialsChecked: number;
  breachedFound: number;
  criticalFound: number;
  highFound: number;
  mediumFound: number;
  playbooksTriggered: number;
}

interface ScanJob {
  _id: string;
  type: string;
  trigger: 'scheduled' | 'manual';
  status: 'running' | 'completed' | 'failed';
  startedAt: string;
  completedAt?: string;
  durationMs?: number;
  summary: ScanSummary;
  findings: ScanFinding[];
  error?: string;
  createdAt: string;
}

const STATUS_COLOR: Record<string, string> = {
  completed: 'text-green-400',
  running:   'text-blue-400',
  failed:    'text-red-400',
};

const LEVEL_COLOR: Record<string, string> = {
  critical: 'bg-red-500/20 text-red-300 border-red-500/30',
  high:     'bg-orange-500/20 text-orange-300 border-orange-500/30',
  medium:   'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
  low:      'bg-gray-500/20 text-gray-300 border-gray-500/30',
};

export default function ScheduledScans() {
  const [jobs, setJobs] = useState<ScanJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [total, setTotal] = useState(0);

  const load = async () => {
    try {
      setLoading(true);
      const data = await apiService.getScanJobs();
      setJobs(data.jobs || []);
      setTotal(data.total || 0);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleManualRun = async () => {
    setRunning(true);
    try {
      await apiService.runScanJob();
      await load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">Scheduled Scans</h2>
          <p className="text-sm text-gray-400 mt-1">Automated breach + risk score scans run every 6 hours · {total} total runs</p>
        </div>
        <button onClick={handleManualRun} disabled={running}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
          {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
          Run Now
        </button>
      </div>

      {error && <div className="bg-red-900/30 border border-red-500/30 text-red-300 px-4 py-3 rounded-lg text-sm">{error}</div>}

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 text-indigo-400 animate-spin" /></div>
      ) : jobs.length === 0 ? (
        <div className="text-center py-16 border border-gray-700 rounded-xl">
          <Clock className="w-10 h-10 text-gray-600 mx-auto mb-3" />
          <p className="text-gray-400 font-medium">No scans run yet</p>
          <p className="text-gray-500 text-sm mt-1">Scans run automatically every 6 hours, or click "Run Now" to trigger one immediately</p>
        </div>
      ) : (
        <div className="space-y-3">
          {jobs.map(job => {
            const findings = job.findings || [];
            const breachFindings = findings.filter(f => f.type === 'breach');
            const riskFindings = findings.filter(f => f.type === 'risk_score');

            return (
              <motion.div key={job._id} layout className="bg-gray-800 border border-gray-700 rounded-xl overflow-hidden">
                <div className="px-5 py-4 flex items-start gap-4">
                  <div className="mt-0.5 flex-shrink-0">
                    {job.status === 'running'   && <Loader2 className="w-5 h-5 text-blue-400 animate-spin" />}
                    {job.status === 'completed' && <CheckCircle className="w-5 h-5 text-green-400" />}
                    {job.status === 'failed'    && <AlertCircle className="w-5 h-5 text-red-400" />}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-sm font-semibold ${STATUS_COLOR[job.status]}`}>
                        {job.status.charAt(0).toUpperCase() + job.status.slice(1)}
                      </span>
                      <span className="text-xs bg-gray-700 text-gray-300 px-2 py-0.5 rounded-full">
                        {job.trigger === 'manual' ? 'Manual' : 'Scheduled'}
                      </span>
                      {job.durationMs != null && (
                        <span className="text-xs text-gray-500">{(job.durationMs / 1000).toFixed(1)}s</span>
                      )}
                    </div>

                    <p className="text-xs text-gray-400 mt-0.5">
                      {new Date(job.startedAt).toLocaleString()}
                    </p>

                    {job.status === 'completed' && job.summary && (
                      <div className="flex flex-wrap gap-3 mt-2">
                        <Stat label="Checked" value={job.summary.credentialsChecked} />
                        <Stat label="Breached" value={job.summary.breachedFound} color="text-red-400" />
                        <Stat label="Critical" value={job.summary.criticalFound} color="text-red-400" />
                        <Stat label="High" value={job.summary.highFound} color="text-orange-400" />
                        <Stat label="Medium" value={job.summary.mediumFound} color="text-yellow-400" />
                        <Stat label="Playbooks fired" value={job.summary.playbooksTriggered} color="text-indigo-400" />
                      </div>
                    )}

                    {job.status === 'failed' && job.error && (
                      <p className="text-xs text-red-400 mt-1">{job.error}</p>
                    )}
                  </div>

                  {findings.length > 0 && (
                    <button onClick={() => setExpandedId(expandedId === job._id ? null : job._id)}
                      className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors flex-shrink-0">
                      {expandedId === job._id ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                    </button>
                  )}
                </div>

                <AnimatePresence>
                  {expandedId === job._id && findings.length > 0 && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                      className="border-t border-gray-700 overflow-hidden">
                      <div className="px-5 py-3 space-y-4">
                        {breachFindings.length > 0 && (
                          <div>
                            <p className="text-xs font-medium text-red-400 flex items-center gap-1 mb-2">
                              <ShieldAlert className="w-3.5 h-3.5" /> Breached Credentials ({breachFindings.length})
                            </p>
                            <div className="space-y-1">
                              {breachFindings.map((f, i) => (
                                <div key={i} className="flex items-center justify-between text-xs bg-red-900/10 border border-red-500/20 rounded-lg px-3 py-2">
                                  <span className="text-white font-medium">{f.website || 'Unknown'}</span>
                                  <span className="text-gray-400">{f.username}</span>
                                  <span className="text-red-300">{(f.breachCount ?? 0).toLocaleString()} breaches</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {riskFindings.length > 0 && (
                          <div>
                            <p className="text-xs font-medium text-orange-400 flex items-center gap-1 mb-2">
                              <KeyRound className="w-3.5 h-3.5" /> High-Risk Credentials ({riskFindings.length})
                            </p>
                            <div className="space-y-1">
                              {riskFindings.map((f, i) => (
                                <div key={i} className="flex items-center justify-between text-xs bg-orange-900/10 border border-orange-500/20 rounded-lg px-3 py-2">
                                  <span className="text-white font-medium">{f.website || 'Unknown'}</span>
                                  <span className="text-gray-400">{f.username}</span>
                                  <span className="text-gray-400">Score: <span className="text-white">{f.score}</span></span>
                                  <span className={`px-2 py-0.5 rounded-full border text-[10px] font-medium ${LEVEL_COLOR[f.level ?? ''] || 'text-gray-400'}`}>
                                    {f.level}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, color = 'text-white' }: { label: string; value: number; color?: string }) {
  return (
    <div className="flex items-center gap-1 text-xs">
      <span className="text-gray-500">{label}:</span>
      <span className={`font-semibold ${color}`}>{value}</span>
    </div>
  );
}
