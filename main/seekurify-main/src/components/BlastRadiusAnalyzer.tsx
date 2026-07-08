import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Zap, Key, Users, Link2, Puzzle, AlertTriangle, CheckCircle, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';
import { API_BASE_URL } from '../services/api';
import AppSidebar from './ui/AppSidebar';
import Header from './ui/Header';
import Footer from './ui/Footer';

interface WorkspaceEntry  { id: string; name: string; isOwner: boolean; memberCount: number; yourRole: string; }
interface VaultEntry      { website: string; username: string; isBreached: boolean; strength: string; }
interface ShareEntry      { website: string; expiresAt: string; oneTime: boolean; }
interface IntegEntry      { type: string; name: string; }

interface BlastRadiusData {
  severity:      'low' | 'medium' | 'high' | 'critical';
  criticalAssets: string[];
  workspaces:    WorkspaceEntry[];
  vault:         { total: number; highRisk: number; credentials: VaultEntry[] };
  activeShares:  ShareEntry[];
  integrations:  IntegEntry[];
  reductionTips: string[];
}

const SEV_COLORS = {
  low:      { bg: 'bg-green-500/10',  border: 'border-green-500',  text: 'text-green-400',  label: 'Low'      },
  medium:   { bg: 'bg-yellow-500/10', border: 'border-yellow-500', text: 'text-yellow-400', label: 'Medium'   },
  high:     { bg: 'bg-orange-500/10', border: 'border-orange-500', text: 'text-orange-400', label: 'High'     },
  critical: { bg: 'bg-red-500/10',    border: 'border-red-500',    text: 'text-red-400',    label: 'Critical' },
};

const BlastRadiusAnalyzer: React.FC = () => {
  const [data, setData]         = useState<BlastRadiusData | null>(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);
  const [vaultOpen, setVaultOpen]           = useState(false);
  const [sidebarExpanded, setSidebarExpanded] = useState(true);

  const navigate     = useNavigate();
  const profileImage = localStorage.getItem('profileImage') || '';
  const handleLogout = () => { localStorage.removeItem('token'); navigate('/login'); };

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('token');
      const res   = await fetch(`${API_BASE_URL}/blast-radius`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to load blast radius data');
      setData(await res.json());
    } catch (e: any) {
      setError(e.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const sev = data ? (SEV_COLORS[data.severity] || SEV_COLORS.low) : SEV_COLORS.low;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex flex-col">
      <Header
        token={localStorage.getItem('token') || ''}
        handleLogout={handleLogout}
        profileImage={profileImage}
      />

      <div className="flex flex-1 overflow-hidden">
        <AppSidebar sidebarExpanded={sidebarExpanded} setSidebarExpanded={setSidebarExpanded} />

        <div className="flex-1 p-6 overflow-y-auto text-white">
          {loading && (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-400" />
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
            <Zap className="w-7 h-7 text-cyan-400" />
            <div>
              <h1 className="text-2xl font-bold">Blast Radius Analyzer</h1>
              <p className="text-slate-400 text-sm mt-0.5">If your identity is compromised, an attacker inherits…</p>
            </div>
          </div>
          <button onClick={fetchData} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-sm transition">
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
        </div>

        {/* Severity banner */}
        <div className={`rounded-2xl border ${sev.border} ${sev.bg} p-6`}>
          <div className="flex items-start justify-between">
            <div>
              <p className="text-slate-400 text-sm font-medium uppercase tracking-wide mb-1">Blast Radius Severity</p>
              <p className={`text-3xl font-bold ${sev.text}`}>{sev.label}</p>
              {data.criticalAssets.length > 0 && (
                <p className="text-slate-300 mt-2 text-sm">
                  Access to: {data.criticalAssets.join(' · ')}
                </p>
              )}
            </div>
            <AlertTriangle className={`w-10 h-10 ${sev.text} opacity-60 flex-shrink-0`} />
          </div>
        </div>

        {/* Asset grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { icon: <Key className="w-5 h-5" />,     label: 'Vault Creds',   value: data.vault.total,           sub: `${data.vault.highRisk} high-risk` },
            { icon: <Users className="w-5 h-5" />,   label: 'Workspaces',    value: data.workspaces.length,     sub: data.workspaces.map(w => w.yourRole).filter((v,i,a)=>a.indexOf(v)===i).join(', ') || '—' },
            { icon: <Link2 className="w-5 h-5" />,   label: 'Active Shares', value: data.activeShares.length,   sub: 'expiring links' },
            { icon: <Puzzle className="w-5 h-5" />,  label: 'Integrations',  value: data.integrations.length,   sub: data.integrations.length > 0 ? data.integrations.map(i=>i.type).join(', ') : 'none' },
          ].map(({ icon, label, value, sub }) => (
            <div key={label} className="bg-slate-800 rounded-xl p-4 border border-slate-700">
              <div className="flex items-center gap-2 text-cyan-400 mb-2">{icon}<span className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</span></div>
              <p className="text-2xl font-bold">{value}</p>
              <p className="text-xs text-slate-500 mt-0.5 truncate">{sub}</p>
            </div>
          ))}
        </div>

        {/* Vault credentials (collapsible) */}
        {data.vault.total > 0 && (
          <div className="bg-slate-800 rounded-xl border border-slate-700">
            <button
              onClick={() => setVaultOpen(v => !v)}
              className="w-full flex items-center justify-between p-5 text-left"
            >
              <div className="flex items-center gap-2">
                <Key className="w-4 h-4 text-cyan-400" />
                <span className="font-semibold">Password Vault ({data.vault.total} credentials, {data.vault.highRisk} high-risk)</span>
              </div>
              {vaultOpen ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
            </button>
            {vaultOpen && (
              <div className="border-t border-slate-700 divide-y divide-slate-700/50">
                {data.vault.credentials.map((c, i) => (
                  <div key={i} className="flex items-center justify-between px-5 py-3 text-sm">
                    <div>
                      <span className="font-medium">{c.website || '—'}</span>
                      <span className="text-slate-500 ml-2">{c.username}</span>
                    </div>
                    <div className="flex gap-2">
                      {c.isBreached && <span className="px-2 py-0.5 bg-red-500/20 text-red-400 rounded text-xs">Breached</span>}
                      {c.strength === 'weak' && <span className="px-2 py-0.5 bg-orange-500/20 text-orange-400 rounded text-xs">Weak</span>}
                      {!c.isBreached && c.strength !== 'weak' && <span className="px-2 py-0.5 bg-green-500/20 text-green-400 rounded text-xs">OK</span>}
                    </div>
                  </div>
                ))}
                {data.vault.total > 20 && (
                  <p className="px-5 py-3 text-xs text-slate-500">+ {data.vault.total - 20} more credentials</p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Workspaces */}
        {data.workspaces.length > 0 && (
          <div className="bg-slate-800 rounded-xl p-5 border border-slate-700">
            <div className="flex items-center gap-2 mb-4">
              <Users className="w-4 h-4 text-cyan-400" />
              <h2 className="font-semibold">Workspace Access</h2>
            </div>
            <div className="space-y-2">
              {data.workspaces.map(w => (
                <div key={String(w.id)} className="flex items-center justify-between py-2 border-b border-slate-700 last:border-0">
                  <div>
                    <p className="text-sm font-medium">{w.name}</p>
                    <p className="text-xs text-slate-500">{w.memberCount} member{w.memberCount !== 1 ? 's' : ''}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {w.isOwner && <span className="px-2 py-0.5 bg-amber-500/20 text-amber-400 rounded text-xs">Owner</span>}
                    <span className="px-2 py-0.5 bg-slate-700 text-slate-300 rounded text-xs capitalize">{w.yourRole}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Integrations */}
        {data.integrations.length > 0 && (
          <div className="bg-slate-800 rounded-xl p-5 border border-slate-700">
            <div className="flex items-center gap-2 mb-4">
              <Puzzle className="w-4 h-4 text-cyan-400" />
              <h2 className="font-semibold">Connected Integrations</h2>
            </div>
            <div className="flex flex-wrap gap-2">
              {data.integrations.map((integ, i) => (
                <span key={i} className="px-3 py-1.5 bg-slate-700 rounded-lg text-sm flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-cyan-400 inline-block" />
                  <span className="capitalize">{integ.type}</span>
                  {integ.name && <span className="text-slate-400">· {integ.name}</span>}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Reduction tips */}
        {data.reductionTips.length > 0 && (
          <div className="bg-slate-800 rounded-xl p-5 border border-slate-700">
            <div className="flex items-center gap-2 mb-4">
              <CheckCircle className="w-4 h-4 text-green-400" />
              <h2 className="font-semibold">Reduce Your Blast Radius</h2>
            </div>
            <ul className="space-y-2">
              {data.reductionTips.map((tip, i) => (
                <li key={i} className="flex items-start gap-2.5 text-sm text-slate-300">
                  <span className="w-5 h-5 rounded-full bg-cyan-500/20 text-cyan-400 flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">{i + 1}</span>
                  {tip}
                </li>
              ))}
            </ul>
          </div>
        )}

      </div>
          )}
        </div>{/* /flex-1 */}
      </div>{/* /flex */}

      <Footer />
    </div>
  );
};

export default BlastRadiusAnalyzer;
