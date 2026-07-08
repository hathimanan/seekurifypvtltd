import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ShieldOff, Lock, Unlock, RefreshCw, AlertTriangle, CheckCircle,
  ChevronDown, ChevronUp, ExternalLink, Copy,
} from 'lucide-react';
import { API_BASE_URL } from '../services/api';
import AppSidebar from './ui/AppSidebar';
import Header from './ui/Header';
import Footer from './ui/Footer';

interface QueueEntry {
  _id: string;
  website: string;
  username: string;
  isBreached: boolean;
  breachCount: number;
  quarantineReason: string;
  quarantinedAt: string;
}

interface ReuseChain {
  _id: string;
  website: string;
  username: string;
  isBreached: boolean;
  quarantined: boolean;
}

interface BreachControlData {
  stats: {
    total: number;
    quarantined: number;
    breached: number;
    reuseChains: number;
    resolved: number;
  };
  queue: QueueEntry[];
  reuseChains: ReuseChain[][];
}

const BreachControl: React.FC = () => {
  const [data, setData]         = useState<BreachControlData | null>(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);
  const [reuseOpen, setReuseOpen]           = useState(false);
  const [sidebarExpanded, setSidebarExpanded] = useState(true);
  const [resolving, setResolving]           = useState<Record<string, boolean>>({});
  const [copied, setCopied]                 = useState<string | null>(null);

  const navigate     = useNavigate();
  const profileImage = localStorage.getItem('profileImage') || '';
  const handleLogout = () => { localStorage.removeItem('token'); navigate('/login'); };
  const token        = () => localStorage.getItem('token') || '';

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/passwords/breach-control`, {
        headers: { Authorization: `Bearer ${token()}` },
      });
      if (!res.ok) throw new Error('Failed to load breach control data');
      setData(await res.json());
    } catch (e: any) {
      setError(e.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const resolveEntry = async (id: string) => {
    setResolving(r => ({ ...r, [id]: true }));
    try {
      const res = await fetch(`${API_BASE_URL}/passwords/${id}/unquarantine`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
      });
      if (!res.ok) throw new Error('Failed to resolve');
      await fetchData();
    } catch {
      // leave entry in place on failure
    } finally {
      setResolving(r => ({ ...r, [id]: false }));
    }
  };

  const copyUsername = (username: string) => {
    navigator.clipboard.writeText(username).catch(() => {});
    setCopied(username);
    setTimeout(() => setCopied(null), 2000);
  };

  const progress = data
    ? Math.round(((data.stats.total - data.stats.quarantined) / Math.max(data.stats.total, 1)) * 100)
    : 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex flex-col">
      <Header
        token={token()}
        handleLogout={handleLogout}
        profileImage={profileImage}
      />

      <div className="flex flex-1 overflow-hidden">
        <AppSidebar sidebarExpanded={sidebarExpanded} setSidebarExpanded={setSidebarExpanded} />

        <div className="flex-1 p-6 overflow-y-auto text-white">
          {loading && (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-400" />
            </div>
          )}
          {!loading && (error || !data) && (
            <div className="flex items-center justify-center h-64 text-red-400">
              {error || 'No data available'}
            </div>
          )}
          {!loading && data && (
            <div className="max-w-5xl mx-auto space-y-6">

              {/* Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <ShieldOff className="w-7 h-7 text-red-400" />
                  <div>
                    <h1 className="text-2xl font-bold">Breach Control Center</h1>
                    <p className="text-slate-400 text-sm mt-0.5">Quarantine, track, and remediate compromised credentials</p>
                  </div>
                </div>
                <button onClick={fetchData} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-sm transition">
                  <RefreshCw className="w-4 h-4" /> Refresh
                </button>
              </div>

              {/* Stats grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: 'Quarantined', value: data.stats.quarantined, color: 'text-red-400',    bg: 'bg-red-500/10',    border: 'border-red-500/30' },
                  { label: 'Breached',    value: data.stats.breached,    color: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/30' },
                  { label: 'Reuse Chains',value: data.stats.reuseChains, color: 'text-yellow-400', bg: 'bg-yellow-500/10', border: 'border-yellow-500/30' },
                  { label: 'Safe',        value: data.stats.resolved,    color: 'text-green-400',  bg: 'bg-green-500/10',  border: 'border-green-500/30' },
                ].map(({ label, value, color, bg, border }) => (
                  <div key={label} className={`${bg} border ${border} rounded-xl p-4`}>
                    <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">{label}</p>
                    <p className={`text-3xl font-bold ${color}`}>{value}</p>
                  </div>
                ))}
              </div>

              {/* Remediation progress */}
              <div className="bg-slate-800 rounded-xl p-5 border border-slate-700">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-400" />
                    <span className="font-semibold text-sm">Remediation Progress</span>
                  </div>
                  <span className={`text-sm font-bold ${progress === 100 ? 'text-green-400' : progress >= 50 ? 'text-yellow-400' : 'text-red-400'}`}>
                    {progress}%
                  </span>
                </div>
                <div className="w-full bg-slate-700 rounded-full h-3">
                  <div
                    className={`h-3 rounded-full transition-all duration-700 ${
                      progress === 100 ? 'bg-green-500' : progress >= 50 ? 'bg-yellow-500' : 'bg-red-500'
                    }`}
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <p className="text-xs text-slate-500 mt-2">
                  {data.stats.total - data.stats.quarantined} of {data.stats.total} credentials are safe
                </p>
              </div>

              {/* Quarantine queue */}
              <div className="bg-slate-800 rounded-xl border border-slate-700">
                <div className="p-5 border-b border-slate-700 flex items-center gap-2">
                  <Lock className="w-4 h-4 text-red-400" />
                  <h2 className="font-semibold">Quarantine Queue</h2>
                  <span className="ml-auto bg-red-500/20 text-red-400 text-xs font-bold px-2 py-0.5 rounded-full">
                    {data.queue.length} pending
                  </span>
                </div>

                {data.queue.length === 0 ? (
                  <div className="flex items-center gap-3 p-5 text-green-400">
                    <CheckCircle className="w-5 h-5" />
                    <span className="text-sm">No quarantined credentials — you're clear!</span>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-700/50">
                    {data.queue.map(entry => (
                      <div key={entry._id} className="p-4 flex items-start gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-sm truncate max-w-xs">{entry.website}</span>
                            {entry.isBreached && (
                              <span className="px-2 py-0.5 bg-red-500/20 text-red-400 text-xs rounded-full">
                                {entry.breachCount > 0 ? `${(entry.breachCount / 1000).toFixed(0)}k breaches` : 'Breached'}
                              </span>
                            )}
                            <span className="px-2 py-0.5 bg-orange-500/20 text-orange-400 text-xs rounded-full">Quarantined</span>
                          </div>
                          <div className="flex items-center gap-1.5 mt-1">
                            <span className="text-slate-400 text-xs font-mono truncate">{entry.username}</span>
                            <button
                              onClick={() => copyUsername(entry.username)}
                              className="text-slate-500 hover:text-slate-300 transition"
                              title="Copy username"
                            >
                              {copied === entry.username
                                ? <CheckCircle className="w-3 h-3 text-green-400" />
                                : <Copy className="w-3 h-3" />}
                            </button>
                          </div>
                          <p className="text-xs text-slate-500 mt-0.5 truncate">{entry.quarantineReason}</p>
                          {entry.quarantinedAt && (
                            <p className="text-[10px] text-slate-600 mt-0.5">
                              Quarantined {new Date(entry.quarantinedAt).toLocaleDateString()}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <a
                            href={entry.website.startsWith('http') ? entry.website : `https://${entry.website}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 px-2.5 py-1.5 bg-slate-700 hover:bg-slate-600 rounded-lg text-xs transition"
                          >
                            <ExternalLink className="w-3 h-3" /> Visit
                          </a>
                          <button
                            onClick={() => resolveEntry(entry._id)}
                            disabled={resolving[entry._id]}
                            className="flex items-center gap-1 px-2.5 py-1.5 bg-green-600/20 hover:bg-green-600/30 text-green-400 rounded-lg text-xs transition disabled:opacity-50"
                          >
                            <Unlock className="w-3 h-3" />
                            {resolving[entry._id] ? 'Resolving…' : 'Mark Resolved'}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Reuse chains */}
              {data.reuseChains.length > 0 && (
                <div className="bg-slate-800 rounded-xl border border-slate-700">
                  <button
                    onClick={() => setReuseOpen(v => !v)}
                    className="w-full flex items-center justify-between p-5 text-left"
                  >
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-yellow-400" />
                      <span className="font-semibold">Password Reuse Chains ({data.reuseChains.length})</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-yellow-400 bg-yellow-500/10 px-2 py-0.5 rounded-full">
                        One compromised password affects multiple accounts
                      </span>
                      {reuseOpen ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                    </div>
                  </button>
                  {reuseOpen && (
                    <div className="border-t border-slate-700 divide-y divide-slate-700/50">
                      {data.reuseChains.map((chain, ci) => (
                        <div key={ci} className="p-4">
                          <p className="text-xs text-yellow-400 font-semibold mb-2 uppercase tracking-wide">
                            Chain {ci + 1} — {chain.length} accounts share this password
                          </p>
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                            {chain.map(c => (
                              <div key={String(c._id)} className={`px-3 py-2 rounded-lg border text-sm ${
                                c.isBreached || c.quarantined
                                  ? 'bg-red-500/10 border-red-500/30'
                                  : 'bg-slate-700 border-slate-600'
                              }`}>
                                <p className="font-medium truncate">{c.website}</p>
                                <p className="text-xs text-slate-400 truncate">{c.username}</p>
                                {(c.isBreached || c.quarantined) && (
                                  <span className="text-[10px] text-red-400">⚠ At risk</span>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* How to respond guide */}
              <div className="bg-slate-800 rounded-xl p-5 border border-slate-700">
                <div className="flex items-center gap-2 mb-4">
                  <CheckCircle className="w-4 h-4 text-cyan-400" />
                  <h2 className="font-semibold">How to Resolve a Quarantined Credential</h2>
                </div>
                <ol className="space-y-3">
                  {[
                    'Click "Visit" to open the site in a new tab.',
                    'Log in using your current (breached) password — this is the last time.',
                    'Navigate to the site\'s account settings and change your password to a new, unique one.',
                    'Update the saved credential in your Seekurify Password Manager.',
                    'Return here and click "Mark Resolved" to unquarantine the entry.',
                    'Repeat for every credential in the queue — including reuse chain entries.',
                  ].map((step, i) => (
                    <li key={i} className="flex items-start gap-3 text-sm text-slate-300">
                      <span className="w-5 h-5 rounded-full bg-cyan-500/20 text-cyan-400 flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">
                        {i + 1}
                      </span>
                      {step}
                    </li>
                  ))}
                </ol>
              </div>

            </div>
          )}
        </div>
      </div>

      <Footer />
    </div>
  );
};

export default BreachControl;
