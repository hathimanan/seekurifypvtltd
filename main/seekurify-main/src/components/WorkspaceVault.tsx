import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  KeyRound, Plus, Trash2, Eye, EyeOff, Copy, Search,
  ArrowLeft, Settings, Crown, Shield, Lock, Pencil, Check, X,
} from 'lucide-react';
import AppSidebar from './ui/AppSidebar';
import Header from './ui/Header';
import { API_BASE_URL } from '../services/api';
import { fetchWithAuth } from '../services/authService';

interface PasswordEntry {
  _id: string;
  website: string;
  username: string;
  password: string;
  category: string;
  notes: string;
  isExpired?: boolean;
  daysLeft?: number;
  userId: { _id: string; name: string; email: string };
  createdAt: string;
}

interface WorkspaceInfo {
  _id: string;
  name: string;
  myRole: 'owner' | 'admin' | 'analyst' | 'viewer';
}

const ROLE_CAN_WRITE = (role: string) => ['owner', 'admin', 'analyst'].includes(role);

const WorkspaceVault: React.FC = () => {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const navigate = useNavigate();

  const [workspace, setWorkspace] = useState<WorkspaceInfo | null>(null);
  const [passwords, setPasswords] = useState<PasswordEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  // Add form
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState({ website: '', username: '', password: '', category: 'General', notes: '' });
  const [addError, setAddError] = useState('');
  const [adding, setAdding] = useState(false);
  const [showAddPwd, setShowAddPwd] = useState(false);

  // Reveal per entry
  const [revealedIds, setRevealedIds] = useState<Set<string>>(new Set());

  // Edit
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ website: '', username: '', password: '', category: '', notes: '' });
  const [editError, setEditError] = useState('');
  const [saving, setSaving] = useState(false);

  // Delete
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [sidebarExpanded, setSidebarExpanded] = useState(true);
  const [profileImage, setProfileImage] = useState('');
  const [copied, setCopied] = useState<string | null>(null);

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
      const [wsRes, pwdRes] = await Promise.all([
        fetch(`${API_BASE_URL}/workspaces/${workspaceId}`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_BASE_URL}/workspaces/${workspaceId}/passwords`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      if (!wsRes.ok || !pwdRes.ok) throw new Error();
      const [ws, pwds] = await Promise.all([wsRes.json(), pwdRes.json()]);
      setWorkspace({ _id: ws._id, name: ws.name, myRole: ws.myRole });
      setPasswords(pwds);
    } catch {
      setError('Could not load vault. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleAdd() {
    const { website, username, password } = addForm;
    if (!website.trim() || !username.trim() || !password.trim()) {
      setAddError('Website, username, and password are required.');
      return;
    }
    setAdding(true);
    setAddError('');
    try {
      const res = await fetchWithAuth(`${API_BASE_URL}/workspaces/${workspaceId}/passwords`, { method: 'POST', body: JSON.stringify(addForm),
      });
      if (!res.ok) {
        const d = await res.json();
        setAddError(d.error || 'Failed to add');
        return;
      }
      const entry = await res.json();
      setPasswords(prev => [entry, ...prev]);
      setAddForm({ website: '', username: '', password: '', category: 'General', notes: '' });
      setShowAdd(false);
    } catch {
      setAddError('Network error.');
    } finally {
      setAdding(false);
    }
  }

  async function handleSave() {
    if (!editingId) return;
    setSaving(true);
    setEditError('');
    try {
      const res = await fetchWithAuth(`${API_BASE_URL}/workspaces/${workspaceId}/passwords/${editingId}`, { method: 'PUT', body: JSON.stringify(editForm),
      });
      if (!res.ok) {
        const d = await res.json();
        setEditError(d.error || 'Failed to save');
        return;
      }
      await fetchAll();
      setEditingId(null);
    } catch {
      setEditError('Network error.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    try {
      await fetch(`${API_BASE_URL}/workspaces/${workspaceId}/passwords/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      setPasswords(prev => prev.filter(p => p._id !== id));
    } catch {
      /* silent */
    } finally {
      setDeletingId(null);
    }
  }

  function copyToClipboard(text: string, id: string) {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(id);
      setTimeout(() => setCopied(null), 1500);
    });
  }

  function startEdit(entry: PasswordEntry) {
    setEditingId(entry._id);
    setEditForm({
      website: entry.website,
      username: entry.username,
      password: entry.password,
      category: entry.category,
      notes: entry.notes,
    });
    setEditError('');
  }

  function handleLogout() {
    localStorage.removeItem('token');
    localStorage.removeItem('googleToken');
    navigate('/login');
  }

  const canWrite = workspace ? ROLE_CAN_WRITE(workspace.myRole) : false;

  const filtered = passwords.filter(p =>
    !search.trim() ||
    p.website.toLowerCase().includes(search.toLowerCase()) ||
    p.username.toLowerCase().includes(search.toLowerCase()) ||
    p.category.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex h-screen bg-gray-950 text-white overflow-hidden">
      <AppSidebar sidebarExpanded={sidebarExpanded} setSidebarExpanded={setSidebarExpanded} />

      <div className="flex flex-col flex-1 overflow-hidden">
        <Header token={token} handleLogout={handleLogout} profileImage={profileImage} />

        <main className="flex-1 overflow-y-auto p-6">
          {/* Back + header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <button onClick={() => navigate('/workspaces')} className="text-gray-400 hover:text-white transition">
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <h1 className="text-xl font-bold flex items-center gap-2">
                  <KeyRound className="w-5 h-5 text-amber-400" />
                  {workspace?.name ?? 'Workspace Vault'}
                </h1>
                {workspace && (
                  <p className="text-xs text-gray-400 mt-0.5 capitalize">
                    Your role: <span className="text-amber-400">{workspace.myRole}</span>
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              {workspace && (workspace.myRole === 'owner' || workspace.myRole === 'admin') && (
                <button
                  onClick={() => navigate(`/workspaces/${workspaceId}/settings`)}
                  className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-white border border-gray-700 hover:border-gray-500 px-3 py-1.5 rounded-lg transition"
                >
                  <Settings className="w-4 h-4" /> Settings
                </button>
              )}
              {canWrite && (
                <button
                  onClick={() => setShowAdd(true)}
                  className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-400 text-slate-900 font-semibold text-sm px-4 py-1.5 rounded-lg transition"
                >
                  <Plus className="w-4 h-4" /> Add Password
                </button>
              )}
            </div>
          </div>

          {/* Add form */}
          <AnimatePresence>
            {showAdd && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mb-6 bg-gray-800 border border-gray-700 rounded-xl p-5 overflow-hidden"
              >
                <h2 className="font-semibold mb-4 flex items-center gap-2">
                  <Plus className="w-4 h-4 text-amber-400" /> Add Shared Password
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                  {(['website', 'username', 'category'] as const).map(field => (
                    <input
                      key={field}
                      type="text"
                      placeholder={field.charAt(0).toUpperCase() + field.slice(1)}
                      value={addForm[field]}
                      onChange={e => setAddForm(prev => ({ ...prev, [field]: e.target.value }))}
                      className="bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500"
                    />
                  ))}
                  <div className="relative">
                    <input
                      type={showAddPwd ? 'text' : 'password'}
                      placeholder="Password"
                      value={addForm.password}
                      onChange={e => setAddForm(prev => ({ ...prev, password: e.target.value }))}
                      className="w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 pr-10 text-sm focus:outline-none focus:border-amber-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowAddPwd(p => !p)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                    >
                      {showAddPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <textarea
                  placeholder="Notes (optional)"
                  value={addForm.notes}
                  onChange={e => setAddForm(prev => ({ ...prev, notes: e.target.value }))}
                  rows={2}
                  className="w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500 resize-none mb-3"
                />
                {addError && <p className="text-red-400 text-xs mb-2">{addError}</p>}
                <div className="flex gap-2">
                  <button
                    onClick={handleAdd}
                    disabled={adding}
                    className="bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-900 font-semibold px-4 py-2 rounded-lg text-sm transition"
                  >
                    {adding ? 'Adding…' : 'Add Password'}
                  </button>
                  <button
                    onClick={() => { setShowAdd(false); setAddError(''); }}
                    className="text-gray-400 hover:text-white px-4 py-2 rounded-lg text-sm transition"
                  >
                    Cancel
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Search bar */}
          {passwords.length > 0 && (
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input
                type="text"
                placeholder="Search passwords…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:border-amber-500"
              />
            </div>
          )}

          {/* Password list */}
          {isLoading ? (
            <div className="flex items-center justify-center h-48 text-gray-500">Loading…</div>
          ) : error ? (
            <div className="text-red-400 text-center mt-16">{error}</div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-center">
              <Lock className="w-10 h-10 text-gray-600 mb-3" />
              <p className="text-gray-400">{search ? 'No matching passwords.' : 'No passwords in this vault yet.'}</p>
              {canWrite && !search && (
                <button
                  onClick={() => setShowAdd(true)}
                  className="mt-3 flex items-center gap-1.5 text-amber-400 hover:text-amber-300 text-sm transition"
                >
                  <Plus className="w-4 h-4" /> Add the first one
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map(entry => {
                const revealed = revealedIds.has(entry._id);
                const isEditing = editingId === entry._id;

                return (
                  <motion.div
                    key={entry._id}
                    layout
                    className={`bg-gray-800 border rounded-xl p-4 transition ${
                      entry.isExpired ? 'border-red-500/40' : 'border-gray-700 hover:border-gray-600'
                    }`}
                  >
                    {isEditing ? (
                      /* ── Edit mode ── */
                      <div className="space-y-3">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {(['website', 'username', 'category'] as const).map(f => (
                            <input
                              key={f}
                              type="text"
                              value={editForm[f]}
                              onChange={e => setEditForm(prev => ({ ...prev, [f]: e.target.value }))}
                              placeholder={f}
                              className="bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500"
                            />
                          ))}
                          <input
                            type="text"
                            value={editForm.password}
                            onChange={e => setEditForm(prev => ({ ...prev, password: e.target.value }))}
                            placeholder="Password"
                            className="bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500"
                          />
                        </div>
                        <textarea
                          value={editForm.notes}
                          onChange={e => setEditForm(prev => ({ ...prev, notes: e.target.value }))}
                          rows={2}
                          placeholder="Notes"
                          className="w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500 resize-none"
                        />
                        {editError && <p className="text-red-400 text-xs">{editError}</p>}
                        <div className="flex gap-2">
                          <button
                            onClick={handleSave}
                            disabled={saving}
                            className="flex items-center gap-1 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-900 font-semibold text-sm px-3 py-1.5 rounded-lg transition"
                          >
                            <Check className="w-3.5 h-3.5" /> {saving ? 'Saving…' : 'Save'}
                          </button>
                          <button
                            onClick={() => setEditingId(null)}
                            className="flex items-center gap-1 text-gray-400 hover:text-white text-sm px-3 py-1.5 rounded-lg transition"
                          >
                            <X className="w-3.5 h-3.5" /> Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      /* ── View mode ── */
                      <div className="flex items-center justify-between gap-4">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="font-semibold text-white truncate">{entry.website}</span>
                            <span className="text-xs text-gray-500 bg-gray-700 px-1.5 py-0.5 rounded">
                              {entry.category}
                            </span>
                            {entry.isExpired && (
                              <span className="text-xs text-red-400 bg-red-400/10 px-1.5 py-0.5 rounded">Expired</span>
                            )}
                          </div>
                          <p className="text-gray-400 text-sm truncate">{entry.username}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-gray-500 text-xs font-mono">
                              {revealed ? entry.password : '••••••••••••'}
                            </span>
                          </div>
                          <p className="text-gray-600 text-xs mt-1">
                            Added by {entry.userId?.name || entry.userId?.email || 'Unknown'}
                          </p>
                        </div>

                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <button
                            onClick={() => {
                              setRevealedIds(prev => {
                                const next = new Set(prev);
                                next.has(entry._id) ? next.delete(entry._id) : next.add(entry._id);
                                return next;
                              });
                            }}
                            className="p-1.5 text-gray-400 hover:text-white rounded transition"
                            title={revealed ? 'Hide' : 'Show'}
                          >
                            {revealed ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                          <button
                            onClick={() => copyToClipboard(entry.password, entry._id)}
                            className="p-1.5 text-gray-400 hover:text-white rounded transition"
                            title="Copy password"
                          >
                            {copied === entry._id
                              ? <Check className="w-4 h-4 text-green-400" />
                              : <Copy className="w-4 h-4" />}
                          </button>
                          {canWrite && (
                            <button
                              onClick={() => startEdit(entry)}
                              className="p-1.5 text-gray-400 hover:text-amber-400 rounded transition"
                              title="Edit"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                          )}
                          {canWrite && (
                            <button
                              onClick={() => handleDelete(entry._id)}
                              disabled={deletingId === entry._id}
                              className="p-1.5 text-gray-400 hover:text-red-400 disabled:opacity-50 rounded transition"
                              title="Delete"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    )}
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

export default WorkspaceVault;
