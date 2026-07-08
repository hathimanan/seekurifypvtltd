import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, Monitor, AlertTriangle, CheckCircle, Clock, MapPin, Key, RefreshCw } from 'lucide-react';
import { API_BASE_URL } from '../services/api';
import AppSidebar from './ui/AppSidebar';
import Header from './ui/Header';
import Footer from './ui/Footer';

interface Device {
  label: string;
  userAgent: string;
  firstSeen: string;
  lastSeen: string;
  isNew: boolean;
}

interface LoginEntry {
  success: boolean;
  ip: string;
  location: string | null;
  userAgent: string;
  at: string;
}

interface PasswordHealth {
  total: number;
  breached: number;
  weak: number;
  reused: number;
}

interface IdentityRiskData {
  riskScore: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  devices: Device[];
  knownCountries: string[];
  lastLoginAt: string | null;
  lastLoginCountry: string | null;
  failedAttemptsLast24h: number;
  recentLogins: LoginEntry[];
  passwordHealth: PasswordHealth;
}

const RISK_COLORS = {
  low:      { bg: 'bg-green-500/20',  border: 'border-green-500',  text: 'text-green-400',  label: 'Low Risk'      },
  medium:   { bg: 'bg-yellow-500/20', border: 'border-yellow-500', text: 'text-yellow-400', label: 'Medium Risk'   },
  high:     { bg: 'bg-orange-500/20', border: 'border-orange-500', text: 'text-orange-400', label: 'High Risk'     },
  critical: { bg: 'bg-red-500/20',    border: 'border-red-500',    text: 'text-red-400',    label: 'Critical Risk' },
};

const IdentityRiskDashboard: React.FC = () => {
  const [data, setData]       = useState<IdentityRiskData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const [sidebarExpanded, setSidebarExpanded] = useState(true);

  const navigate     = useNavigate();
  const profileImage = localStorage.getItem('profileImage') || '';
  const handleLogout = () => { localStorage.removeItem('token'); navigate('/login'); };

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('token');
      const res   = await fetch(`${API_BASE_URL}/identity-risk`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to load identity risk data');
      setData(await res.json());
    } catch (e: any) {
      setError(e.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const risk     = data ? (RISK_COLORS[data.riskLevel] || RISK_COLORS.low) : RISK_COLORS.low;
  const scoreArc = data ? Math.round((data.riskScore / 100) * 251) : 0;

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
            <Shield className="w-7 h-7 text-cyan-400" />
            <h1 className="text-2xl font-bold">Identity Risk Dashboard</h1>
          </div>
          <button
            onClick={fetchData}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-sm transition"
          >
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
        </div>

        {/* Risk Score card */}
        <div className={`rounded-2xl border ${risk.border} ${risk.bg} p-6 flex items-center gap-8`}>
          {/* Circular progress */}
          <div className="relative flex-shrink-0 w-28 h-28">
            <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
              <circle cx="50" cy="50" r="40" fill="none" stroke="#1e293b" strokeWidth="12" />
              <circle
                cx="50" cy="50" r="40" fill="none"
                stroke="currentColor"
                strokeWidth="12"
                strokeDasharray={`${scoreArc} 251`}
                className={risk.text}
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className={`text-2xl font-bold ${risk.text}`}>{data.riskScore}</span>
              <span className="text-xs text-slate-400">/100</span>
            </div>
          </div>

          <div>
            <p className={`text-xl font-semibold ${risk.text}`}>{risk.label}</p>
            <p className="text-slate-400 text-sm mt-1">Based on login anomalies, device trust, and password health</p>
            <div className="mt-3 flex flex-wrap gap-3 text-sm">
              <span className="text-slate-300">{data.failedAttemptsLast24h} failed login{data.failedAttemptsLast24h !== 1 ? 's' : ''} (24h)</span>
              <span className="text-slate-300">{data.devices.length} known device{data.devices.length !== 1 ? 's' : ''}</span>
              {data.knownCountries.length > 0 && (
                <span className="text-slate-300">{data.knownCountries.join(', ')}</span>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Password Health */}
          <div className="bg-slate-800 rounded-xl p-5 border border-slate-700">
            <div className="flex items-center gap-2 mb-4">
              <Key className="w-4 h-4 text-cyan-400" />
              <h2 className="font-semibold text-sm uppercase tracking-wide text-slate-400">Password Health</h2>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-400">Total credentials</span>
                <span className="font-medium">{data.passwordHealth.total}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Breached</span>
                <span className={data.passwordHealth.breached > 0 ? 'text-red-400 font-semibold' : 'text-green-400'}>
                  {data.passwordHealth.breached}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Weak</span>
                <span className={data.passwordHealth.weak > 0 ? 'text-orange-400' : 'text-green-400'}>
                  {data.passwordHealth.weak}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Reused</span>
                <span className={data.passwordHealth.reused > 0 ? 'text-yellow-400' : 'text-green-400'}>
                  {data.passwordHealth.reused}
                </span>
              </div>
            </div>
          </div>

          {/* Last Login */}
          <div className="bg-slate-800 rounded-xl p-5 border border-slate-700">
            <div className="flex items-center gap-2 mb-4">
              <Clock className="w-4 h-4 text-cyan-400" />
              <h2 className="font-semibold text-sm uppercase tracking-wide text-slate-400">Last Login</h2>
            </div>
            {data.lastLoginAt ? (
              <div className="space-y-2 text-sm">
                <p className="text-white">{new Date(data.lastLoginAt).toLocaleString()}</p>
                {data.lastLoginCountry && (
                  <div className="flex items-center gap-1.5 text-slate-400">
                    <MapPin className="w-3.5 h-3.5" />
                    <span>{data.lastLoginCountry}</span>
                  </div>
                )}
                <p className={`font-medium ${data.failedAttemptsLast24h >= 5 ? 'text-red-400' : data.failedAttemptsLast24h >= 2 ? 'text-yellow-400' : 'text-green-400'}`}>
                  {data.failedAttemptsLast24h} failed attempt{data.failedAttemptsLast24h !== 1 ? 's' : ''} in last 24h
                </p>
              </div>
            ) : (
              <p className="text-slate-500 text-sm">No login history yet</p>
            )}
          </div>

          {/* Location history */}
          <div className="bg-slate-800 rounded-xl p-5 border border-slate-700">
            <div className="flex items-center gap-2 mb-4">
              <MapPin className="w-4 h-4 text-cyan-400" />
              <h2 className="font-semibold text-sm uppercase tracking-wide text-slate-400">Known Locations</h2>
            </div>
            {data.knownCountries.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {data.knownCountries.slice(0, 8).map(c => (
                  <span key={c} className="px-2 py-1 bg-slate-700 rounded text-xs text-slate-300">{c}</span>
                ))}
              </div>
            ) : (
              <p className="text-slate-500 text-sm">Building location baseline…</p>
            )}
          </div>
        </div>

        {/* Known Devices */}
        <div className="bg-slate-800 rounded-xl p-5 border border-slate-700">
          <div className="flex items-center gap-2 mb-4">
            <Monitor className="w-4 h-4 text-cyan-400" />
            <h2 className="font-semibold">Known Devices</h2>
          </div>
          {data.devices.length === 0 ? (
            <p className="text-slate-500 text-sm">No device history yet — devices are recorded on each login.</p>
          ) : (
            <div className="space-y-2">
              {data.devices.map((d, i) => (
                <div key={i} className="flex items-center justify-between py-2 border-b border-slate-700 last:border-0">
                  <div className="flex items-center gap-3">
                    <Monitor className="w-4 h-4 text-slate-400 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-medium flex items-center gap-2">
                        {d.label}
                        {d.isNew && <span className="px-1.5 py-0.5 bg-yellow-500/20 text-yellow-400 text-xs rounded">New</span>}
                      </p>
                      <p className="text-xs text-slate-500">Last seen {new Date(d.lastSeen).toLocaleDateString()}</p>
                    </div>
                  </div>
                  <span className="text-xs text-slate-500">First: {new Date(d.firstSeen).toLocaleDateString()}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Login Activity */}
        <div className="bg-slate-800 rounded-xl p-5 border border-slate-700">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="w-4 h-4 text-cyan-400" />
            <h2 className="font-semibold">Recent Login Activity</h2>
          </div>
          {data.recentLogins.length === 0 ? (
            <p className="text-slate-500 text-sm">No recent login events.</p>
          ) : (
            <div className="space-y-1.5">
              {data.recentLogins.map((e, i) => (
                <div key={i} className={`flex items-center justify-between px-3 py-2 rounded-lg ${e.success ? 'bg-slate-700/50' : 'bg-red-900/20'}`}>
                  <div className="flex items-center gap-2.5">
                    {e.success
                      ? <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0" />
                      : <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />}
                    <span className="text-sm">{e.success ? 'Successful login' : 'Failed attempt'}</span>
                    {e.ip && <span className="text-xs text-slate-500 font-mono">{e.ip}</span>}
                    {e.location && <span className="text-xs text-slate-500">{e.location}</span>}
                  </div>
                  <span className="text-xs text-slate-500">{new Date(e.at).toLocaleString()}</span>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
          )}
        </div>{/* /flex-1 */}
      </div>{/* /flex */}

      <Footer />
    </div>
  );
};

export default IdentityRiskDashboard;
