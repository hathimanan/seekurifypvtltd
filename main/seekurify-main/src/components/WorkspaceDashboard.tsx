import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Users, Plus, Settings, KeyRound, ChevronRight, Crown, Shield, Eye } from 'lucide-react';
import AppSidebar from './ui/AppSidebar';
import Header from './ui/Header';
import { API_BASE_URL } from '../services/api';
import { fetchWithAuth } from '../services/authService';

interface WorkspaceMember {
  userId: { _id: string; name: string; email: string };
  role: 'admin' | 'analyst' | 'viewer';
}

interface Workspace {
  _id: string;
  name: string;
  owner: { _id: string; name: string; email: string };
  members: WorkspaceMember[];
  myRole: 'owner' | 'admin' | 'analyst' | 'viewer';
  createdAt: string;
}

const ROLE_META: Record<string, { label: string; color: string; icon: React.ReactElement }> = {
  owner:   { label: 'Owner',   color: 'text-amber-400 bg-amber-400/10',  icon: <Crown   className="w-3 h-3" /> },
  admin:   { label: 'Admin',   color: 'text-sky-400 bg-sky-400/10',      icon: <Shield  className="w-3 h-3" /> },
  analyst: { label: 'Analyst', color: 'text-teal-400 bg-teal-400/10',    icon: <KeyRound className="w-3 h-3" /> },
  viewer:  { label: 'Viewer',  color: 'text-gray-400 bg-gray-400/10',    icon: <Eye     className="w-3 h-3" /> },
};

const WorkspaceDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');
  const [sidebarExpanded, setSidebarExpanded] = useState(true);
  const [profileImage, setProfileImage] = useState('');

  const token = localStorage.getItem('token') || localStorage.getItem('googleToken') || '';

  useEffect(() => {
    fetchWorkspaces();
    // Load profile image
    fetch(`${API_BASE_URL}/profile`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(d => setProfileImage(d.profileImage || ''))
      .catch(() => {});
  }, []);

  async function fetchWorkspaces() {
    setIsLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE_URL}/workspaces`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to load');
      setWorkspaces(await res.json());
    } catch {
      setError('Could not load workspaces. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleCreate() {
    if (!newName.trim()) return;
    setCreating(true);
    setCreateError('');
    try {
      const res = await fetchWithAuth(`${API_BASE_URL}/workspaces`, { method: 'POST', body: JSON.stringify({ name: newName.trim() }),
      });
      if (!res.ok) {
        const data = await res.json();
        setCreateError(data.error || 'Failed to create');
        return;
      }
      const ws = await res.json();
      setWorkspaces(prev => [{ ...ws, myRole: 'owner' }, ...prev]);
      setNewName('');
      setShowCreate(false);
    } catch {
      setCreateError('Network error. Please try again.');
    } finally {
      setCreating(false);
    }
  }

  function handleLogout() {
    localStorage.removeItem('token');
    localStorage.removeItem('googleToken');
    navigate('/login');
  }

  return (
    <div className="flex h-screen bg-gray-950 text-white overflow-hidden">
      <AppSidebar sidebarExpanded={sidebarExpanded} setSidebarExpanded={setSidebarExpanded} />

      <div className="flex flex-col flex-1 overflow-hidden">
        <Header token={token} handleLogout={handleLogout} profileImage={profileImage} />

        <main className="flex-1 overflow-y-auto p-6">
          {/* Page header */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <Users className="w-6 h-6 text-amber-400" /> Team Workspaces
              </h1>
              <p className="text-gray-400 mt-1 text-sm">
                Collaborate on shared password vaults and security findings with your team.
              </p>
            </div>
            <button
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-slate-900 font-semibold px-4 py-2 rounded-lg transition"
            >
              <Plus className="w-4 h-4" /> New Workspace
            </button>
          </div>

          {/* Create workspace inline form */}
          {showCreate && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-6 bg-gray-800 border border-gray-700 rounded-xl p-5"
            >
              <h2 className="font-semibold mb-3">Create New Workspace</h2>
              <div className="flex gap-3">
                <input
                  autoFocus
                  type="text"
                  placeholder="e.g. Acme Security Team"
                  value={newName}
                  maxLength={80}
                  onChange={e => setNewName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleCreate()}
                  className="flex-1 bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500"
                />
                <button
                  onClick={handleCreate}
                  disabled={creating || !newName.trim()}
                  className="bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-900 font-semibold px-4 py-2 rounded-lg text-sm transition"
                >
                  {creating ? 'Creating…' : 'Create'}
                </button>
                <button
                  onClick={() => { setShowCreate(false); setNewName(''); setCreateError(''); }}
                  className="text-gray-400 hover:text-white px-3 py-2 rounded-lg text-sm transition"
                >
                  Cancel
                </button>
              </div>
              {createError && <p className="text-red-400 text-xs mt-2">{createError}</p>}
            </motion.div>
          )}

          {/* Content */}
          {isLoading ? (
            <div className="flex items-center justify-center h-48 text-gray-500">Loading…</div>
          ) : error ? (
            <div className="text-red-400 text-center mt-16">{error}</div>
          ) : workspaces.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-center">
              <Users className="w-12 h-12 text-gray-600 mb-4" />
              <p className="text-gray-400 text-lg font-medium">No workspaces yet</p>
              <p className="text-gray-500 text-sm mt-1">
                Create one to share passwords and findings with your team.
              </p>
              <button
                onClick={() => setShowCreate(true)}
                className="mt-4 flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-slate-900 font-semibold px-4 py-2 rounded-lg transition"
              >
                <Plus className="w-4 h-4" /> Create Workspace
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {workspaces.map(ws => {
                const roleMeta = ROLE_META[ws.myRole] ?? ROLE_META.viewer;
                const totalMembers = 1 + ws.members.length; // owner + members
                return (
                  <motion.div
                    key={ws._id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-gray-800 border border-gray-700 rounded-xl p-5 hover:border-amber-500/40 transition flex flex-col gap-4"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-white truncate">{ws.name}</h3>
                        <p className="text-gray-400 text-xs mt-0.5">
                          {totalMembers} member{totalMembers !== 1 ? 's' : ''}
                        </p>
                      </div>
                      <span className={`flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${roleMeta.color}`}>
                        {roleMeta.icon} {roleMeta.label}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 mt-auto">
                      <button
                        onClick={() => navigate(`/workspaces/${ws._id}/vault`)}
                        className="flex-1 flex items-center justify-center gap-1.5 bg-gray-700 hover:bg-amber-500 hover:text-slate-900 text-gray-300 text-sm font-medium py-2 rounded-lg transition"
                      >
                        <KeyRound className="w-4 h-4" /> Vault
                      </button>
                      {(ws.myRole === 'owner' || ws.myRole === 'admin') && (
                        <button
                          onClick={() => navigate(`/workspaces/${ws._id}/settings`)}
                          className="flex items-center justify-center gap-1.5 bg-gray-700 hover:bg-gray-600 text-gray-300 px-3 py-2 rounded-lg transition"
                          title="Settings"
                        >
                          <Settings className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        onClick={() => navigate(`/workspaces/${ws._id}/vault`)}
                        className="flex items-center justify-center bg-gray-700 hover:bg-gray-600 text-gray-300 px-2 py-2 rounded-lg transition"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default WorkspaceDashboard;
