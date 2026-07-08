import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Settings, ArrowLeft, Users, UserPlus, Mail, Crown, Shield, KeyRound,
  Eye, Trash2, ChevronDown, AlertTriangle, Copy, Check, X, LogOut,
} from 'lucide-react';
import AppSidebar from './ui/AppSidebar';
import Header from './ui/Header';
import { API_BASE_URL } from '../services/api';
import { fetchWithAuth } from '../services/authService';

interface Member {
  userId: { _id: string; name: string; email: string; profileImage?: string };
  role: 'admin' | 'analyst' | 'viewer';
  addedAt: string;
}

interface PendingInvite {
  _id: string;
  invitedEmail: string;
  role: string;
  invitedBy: { name: string; email: string };
  expiresAt: string;
  token: string;
}

interface WorkspaceDetail {
  _id: string;
  name: string;
  owner: { _id: string; name: string; email: string };
  members: Member[];
  myRole: 'owner' | 'admin' | 'analyst' | 'viewer';
}

const ROLE_META: Record<string, { label: string; color: string; icon: React.ReactElement }> = {
  owner:   { label: 'Owner',   color: 'text-amber-400',  icon: <Crown    className="w-3.5 h-3.5" /> },
  admin:   { label: 'Admin',   color: 'text-sky-400',    icon: <Shield   className="w-3.5 h-3.5" /> },
  analyst: { label: 'Analyst', color: 'text-teal-400',   icon: <KeyRound className="w-3.5 h-3.5" /> },
  viewer:  { label: 'Viewer',  color: 'text-gray-400',   icon: <Eye      className="w-3.5 h-3.5" /> },
};

const WorkspaceSettings: React.FC = () => {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const navigate = useNavigate();

  const [workspace, setWorkspace] = useState<WorkspaceDetail | null>(null);
  const [invites, setInvites] = useState<PendingInvite[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  // Invite form
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'admin' | 'analyst' | 'viewer'>('viewer');
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState('');
  const [latestInviteLink, setLatestInviteLink] = useState('');
  const [copiedLink, setCopiedLink] = useState(false);

  // Rename
  const [renaming, setRenaming] = useState(false);
  const [newName, setNewName] = useState('');
  const [renameError, setRenameError] = useState('');
  const [renameSaving, setRenameSaving] = useState(false);

  // Delete workspace confirm
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Leave confirm
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [leaving, setLeaving] = useState(false);

  const [sidebarExpanded, setSidebarExpanded] = useState(true);
  const [profileImage, setProfileImage] = useState('');

  const token = localStorage.getItem('token') || localStorage.getItem('googleToken') || '';

  useEffect(() => {
    if (!workspaceId) return;
    fetchAll();
    fetch(`${API_BASE_URL}/profile`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(d => setProfileImage(d.profileImage || ''))
      .catch(() => {});
  }, [workspaceId]);

  async function fetchAll() {
    setIsLoading(true);
    setError('');
    try {
      const [wsRes, invRes] = await Promise.all([
        fetch(`${API_BASE_URL}/workspaces/${workspaceId}`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_BASE_URL}/workspaces/${workspaceId}/invites`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      if (!wsRes.ok) throw new Error();
      const ws = await wsRes.json();
      setWorkspace(ws);
      setNewName(ws.name);
      if (invRes.ok) setInvites(await invRes.json());
    } catch {
      setError('Could not load workspace settings.');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleInvite() {
    if (!inviteEmail.trim()) { setInviteError('Email is required'); return; }
    setInviting(true);
    setInviteError('');
    setLatestInviteLink('');
    try {
      const res = await fetchWithAuth(`${API_BASE_URL}/workspaces/${workspaceId}/invites`, { method: 'POST', body: JSON.stringify({ email: inviteEmail.trim(), role: inviteRole }),
      });
      const data = await res.json();
      if (!res.ok) { setInviteError(data.error || 'Failed to invite'); return; }
      setInviteEmail('');
      const link = `${window.location.origin}${data.inviteLink}`;
      setLatestInviteLink(link);
      await fetchAll();
    } catch {
      setInviteError('Network error.');
    } finally {
      setInviting(false);
    }
  }

  async function handleRevokeInvite(inviteId: string) {
    try {
      await fetchWithAuth(`${API_BASE_URL}/workspaces/${workspaceId}/invites/${inviteId}`, { method: 'DELETE' });
      setInvites(prev => prev.filter(i => i._id !== inviteId));
    } catch { /* silent */ }
  }

  async function handleChangeRole(memberId: string, role: string) {
    try {
      const res = await fetchWithAuth(`${API_BASE_URL}/workspaces/${workspaceId}/members/${memberId}`, { method: 'PUT', body: JSON.stringify({ role }),
      });
      if (res.ok) await fetchAll();
    } catch { /* silent */ }
  }

  async function handleRemoveMember(memberId: string) {
    try {
      await fetchWithAuth(`${API_BASE_URL}/workspaces/${workspaceId}/members/${memberId}`, { method: 'DELETE' });
      await fetchAll();
    } catch { /* silent */ }
  }

  async function handleRename() {
    if (!newName.trim()) { setRenameError('Name is required'); return; }
    setRenameSaving(true);
    setRenameError('');
    try {
      const res = await fetchWithAuth(`${API_BASE_URL}/workspaces/${workspaceId}`, { method: 'PUT', body: JSON.stringify({ name: newName.trim() }),
      });
      if (!res.ok) { const d = await res.json(); setRenameError(d.error || 'Failed'); return; }
      setRenaming(false);
      await fetchAll();
    } catch {
      setRenameError('Network error.');
    } finally {
      setRenameSaving(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      await fetch(`${API_BASE_URL}/workspaces/${workspaceId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      navigate('/workspaces');
    } catch { setDeleting(false); }
  }

  async function handleLeave() {
    setLeaving(true);
    try {
      await fetch(`${API_BASE_URL}/workspaces/${workspaceId}/leave`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      navigate('/workspaces');
    } catch { setLeaving(false); }
  }

  function copyLink() {
    navigator.clipboard.writeText(latestInviteLink).then(() => {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 1500);
    });
  }

  function handleLogout() {
    localStorage.removeItem('token');
    localStorage.removeItem('googleToken');
    navigate('/login');
  }

  const canManage = workspace?.myRole === 'owner' || workspace?.myRole === 'admin';

  const allMembers: { id: string; name: string; email: string; role: string; isOwner: boolean }[] = workspace
    ? [
        { id: workspace.owner._id, name: workspace.owner.name, email: workspace.owner.email, role: 'owner', isOwner: true },
        ...workspace.members
          .filter(m => m.userId != null)
          .map(m => ({
            id: m.userId._id,
            name: m.userId.name,
            email: m.userId.email,
            role: m.role,
            isOwner: false,
          })),
      ]
    : [];

  return (
    <div className="flex h-screen bg-gray-950 text-white overflow-hidden">
      <AppSidebar sidebarExpanded={sidebarExpanded} setSidebarExpanded={setSidebarExpanded} />

      <div className="flex flex-col flex-1 overflow-hidden">
        <Header token={token} handleLogout={handleLogout} profileImage={profileImage} />

        <main className="flex-1 overflow-y-auto p-6 max-w-3xl w-full mx-auto">
          {/* Back header */}
          <div className="flex items-center gap-3 mb-8">
            <button onClick={() => navigate(`/workspaces/${workspaceId}/vault`)} className="text-gray-400 hover:text-white transition">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-xl font-bold flex items-center gap-2">
                <Settings className="w-5 h-5 text-amber-400" /> Workspace Settings
              </h1>
              {workspace && <p className="text-gray-400 text-sm mt-0.5">{workspace.name}</p>}
            </div>
          </div>

          {isLoading ? (
            <div className="flex flex-col items-center justify-center mt-16 gap-3">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-400" />
              <p className="text-gray-400 text-sm">Loading workspace settings…</p>
            </div>
          ) : error ? (
            <div className="mt-16 text-center space-y-3">
              <p className="text-red-400">{error}</p>
              <button onClick={fetchAll} className="text-sm text-amber-400 hover:text-amber-300 underline">Retry</button>
            </div>
          ) : (
            <div className="space-y-6">

              {/* Rename */}
              <section className="bg-gray-800 border border-gray-700 rounded-xl p-5">
                <h2 className="font-semibold mb-3">Workspace Name</h2>
                {renaming ? (
                  <div className="flex gap-2">
                    <input
                      autoFocus
                      type="text"
                      value={newName}
                      maxLength={80}
                      onChange={e => setNewName(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleRename()}
                      className="flex-1 bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500"
                    />
                    <button
                      onClick={handleRename}
                      disabled={renameSaving}
                      className="bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-900 font-semibold text-sm px-3 py-2 rounded-lg transition"
                    >
                      {renameSaving ? 'Saving…' : 'Save'}
                    </button>
                    <button onClick={() => { setRenaming(false); setNewName(workspace!.name); }} className="text-gray-400 hover:text-white px-3 py-2 rounded-lg text-sm">Cancel</button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <span className="text-gray-300">{workspace?.name}</span>
                    {canManage && (
                      <button onClick={() => setRenaming(true)} className="text-amber-400 hover:text-amber-300 text-sm transition">Rename</button>
                    )}
                  </div>
                )}
                {renameError && <p className="text-red-400 text-xs mt-1">{renameError}</p>}
              </section>

              {/* Invite member */}
              {canManage && (
                <section className="bg-gray-800 border border-gray-700 rounded-xl p-5">
                  <h2 className="font-semibold mb-4 flex items-center gap-2">
                    <UserPlus className="w-4 h-4 text-amber-400" /> Invite Member
                  </h2>
                  <div className="flex gap-2 flex-wrap">
                    <input
                      type="email"
                      placeholder="colleague@company.com"
                      value={inviteEmail}
                      onChange={e => setInviteEmail(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleInvite()}
                      className="flex-1 min-w-48 bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500"
                    />
                    <select
                      value={inviteRole}
                      onChange={e => setInviteRole(e.target.value as any)}
                      className="bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500"
                    >
                      <option value="viewer">Viewer — read only</option>
                      <option value="analyst">Analyst — read & write</option>
                      <option value="admin">Admin — full access</option>
                    </select>
                    <button
                      onClick={handleInvite}
                      disabled={inviting}
                      className="bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-900 font-semibold text-sm px-4 py-2 rounded-lg transition"
                    >
                      {inviting ? 'Sending…' : 'Send Invite'}
                    </button>
                  </div>
                  {inviteError && <p className="text-red-400 text-xs mt-2">{inviteError}</p>}

                  {latestInviteLink && (
                    <motion.div
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="mt-3 bg-gray-900 border border-gray-600 rounded-lg px-3 py-2.5 flex items-center gap-2"
                    >
                      <Mail className="w-4 h-4 text-amber-400 flex-shrink-0" />
                      <span className="text-xs text-gray-300 truncate flex-1">{latestInviteLink}</span>
                      <button onClick={copyLink} className="text-gray-400 hover:text-white flex-shrink-0">
                        {copiedLink ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                      </button>
                    </motion.div>
                  )}
                </section>
              )}

              {/* Pending invites */}
              {canManage && invites.length > 0 && (
                <section className="bg-gray-800 border border-gray-700 rounded-xl p-5">
                  <h2 className="font-semibold mb-3">Pending Invites ({invites.length})</h2>
                  <ul className="space-y-2">
                    {invites.map(inv => (
                      <li key={inv._id} className="flex items-center justify-between gap-3 bg-gray-900 rounded-lg px-3 py-2.5">
                        <div className="min-w-0">
                          <p className="text-sm text-white truncate">{inv.invitedEmail}</p>
                          <p className="text-xs text-gray-500 capitalize">{inv.role} · expires {new Date(inv.expiresAt).toLocaleDateString()}</p>
                        </div>
                        <button
                          onClick={() => handleRevokeInvite(inv._id)}
                          className="text-gray-400 hover:text-red-400 transition flex-shrink-0"
                          title="Revoke"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {/* Members list */}
              <section className="bg-gray-800 border border-gray-700 rounded-xl p-5">
                <h2 className="font-semibold mb-4 flex items-center gap-2">
                  <Users className="w-4 h-4 text-amber-400" /> Members ({allMembers.length})
                </h2>
                <ul className="space-y-2">
                  {allMembers.map(m => {
                    const meta = ROLE_META[m.role] ?? ROLE_META.viewer;
                    return (
                      <li key={m.id} className="flex items-center justify-between gap-3 bg-gray-900 rounded-lg px-3 py-2.5">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm text-white truncate">{m.name || m.email}</p>
                          <p className="text-xs text-gray-500 truncate">{m.email}</p>
                        </div>

                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className={`flex items-center gap-1 text-xs font-medium ${meta.color}`}>
                            {meta.icon} {meta.label}
                          </span>

                          {/* Role change dropdown — admins/owners on non-owner members */}
                          {canManage && !m.isOwner && workspace?.myRole === 'owner' && (
                            <select
                              value={m.role}
                              onChange={e => handleChangeRole(m.id, e.target.value)}
                              className="bg-gray-800 border border-gray-600 rounded text-xs px-1.5 py-1 focus:outline-none focus:border-amber-500 cursor-pointer"
                            >
                              <option value="viewer">Viewer</option>
                              <option value="analyst">Analyst</option>
                              <option value="admin">Admin</option>
                            </select>
                          )}

                          {/* Remove member */}
                          {canManage && !m.isOwner && (
                            <button
                              onClick={() => handleRemoveMember(m.id)}
                              className="text-gray-500 hover:text-red-400 transition"
                              title="Remove member"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </section>

              {/* Danger zone */}
              <section className="bg-gray-800 border border-red-500/30 rounded-xl p-5">
                <h2 className="font-semibold text-red-400 mb-4 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" /> Danger Zone
                </h2>

                {workspace?.myRole !== 'owner' && (
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="text-sm font-medium">Leave Workspace</p>
                      <p className="text-xs text-gray-400">You will lose access to all shared resources.</p>
                    </div>
                    {showLeaveConfirm ? (
                      <div className="flex gap-2">
                        <button onClick={handleLeave} disabled={leaving} className="bg-red-600 hover:bg-red-500 text-white text-xs px-3 py-1.5 rounded-lg transition">
                          {leaving ? 'Leaving…' : 'Confirm Leave'}
                        </button>
                        <button onClick={() => setShowLeaveConfirm(false)} className="text-gray-400 text-xs px-2 py-1.5">Cancel</button>
                      </div>
                    ) : (
                      <button onClick={() => setShowLeaveConfirm(true)} className="flex items-center gap-1 text-sm text-red-400 hover:text-red-300 border border-red-500/30 px-3 py-1.5 rounded-lg transition">
                        <LogOut className="w-3.5 h-3.5" /> Leave
                      </button>
                    )}
                  </div>
                )}

                {workspace?.myRole === 'owner' && (
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">Delete Workspace</p>
                      <p className="text-xs text-gray-400">Permanently deletes all passwords and member access.</p>
                    </div>
                    {showDeleteConfirm ? (
                      <div className="flex gap-2">
                        <button onClick={handleDelete} disabled={deleting} className="bg-red-600 hover:bg-red-500 text-white text-xs px-3 py-1.5 rounded-lg transition">
                          {deleting ? 'Deleting…' : 'Delete Forever'}
                        </button>
                        <button onClick={() => setShowDeleteConfirm(false)} className="text-gray-400 text-xs px-2 py-1.5">Cancel</button>
                      </div>
                    ) : (
                      <button onClick={() => setShowDeleteConfirm(true)} className="flex items-center gap-1 text-sm text-red-400 hover:text-red-300 border border-red-500/30 px-3 py-1.5 rounded-lg transition">
                        <Trash2 className="w-3.5 h-3.5" /> Delete
                      </button>
                    )}
                  </div>
                )}
              </section>

            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default WorkspaceSettings;
