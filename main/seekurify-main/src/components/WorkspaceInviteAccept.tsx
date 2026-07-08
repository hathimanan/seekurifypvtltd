import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Users, Check, AlertTriangle, LogIn, Loader2 } from 'lucide-react';
import { API_BASE_URL } from '../services/api';

interface InviteInfo {
  workspaceName: string;
  invitedEmail: string;
  role: string;
  invitedBy: string;
  expiresAt: string;
}

const WorkspaceInviteAccept: React.FC = () => {
  const { token: inviteToken } = useParams<{ token: string }>();
  const navigate = useNavigate();

  const [info, setInfo] = useState<InviteInfo | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'invalid' | 'accepting' | 'done' | 'error'>('loading');
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const authToken = localStorage.getItem('token') || localStorage.getItem('googleToken') || '';

  useEffect(() => {
    if (!inviteToken) { setStatus('invalid'); return; }
    fetch(`${API_BASE_URL}/workspace-invite/${inviteToken}`)
      .then(r => r.ok ? r.json() : r.json().then(d => Promise.reject(d.error || 'Invalid')))
      .then(d => { setInfo(d); setStatus('ready'); })
      .catch(e => { setErrorMsg(typeof e === 'string' ? e : 'Invite not found or expired.'); setStatus('invalid'); });
  }, [inviteToken]);

  async function handleAccept() {
    if (!authToken) {
      // Redirect to login, then back here
      localStorage.setItem('pendingInviteToken', inviteToken!);
      navigate(`/login?redirect=/workspace-invite/${inviteToken}`);
      return;
    }
    setStatus('accepting');
    try {
      const res = await fetch(`${API_BASE_URL}/workspace-invite/${inviteToken}/accept`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || 'Failed to accept invite.');
        setStatus('error');
        return;
      }
      setSuccessMsg(`You've joined "${data.workspaceName}"!`);
      setStatus('done');
      setTimeout(() => navigate(`/workspaces/${data.workspaceId}/vault`), 2000);
    } catch {
      setErrorMsg('Network error. Please try again.');
      setStatus('error');
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gray-800 border border-gray-700 rounded-2xl p-8 w-full max-w-md text-white"
      >
        <div className="flex flex-col items-center text-center mb-6">
          <div className="w-14 h-14 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mb-4">
            <Users className="w-7 h-7 text-amber-400" />
          </div>
          <h1 className="text-xl font-bold">Team Workspace Invite</h1>
        </div>

        {status === 'loading' && (
          <div className="flex flex-col items-center gap-3 text-gray-400">
            <Loader2 className="w-6 h-6 animate-spin" />
            <p className="text-sm">Loading invite details…</p>
          </div>
        )}

        {status === 'invalid' && (
          <div className="flex flex-col items-center gap-3 text-center">
            <AlertTriangle className="w-8 h-8 text-red-400" />
            <p className="text-red-400 font-medium">Invite Invalid or Expired</p>
            <p className="text-gray-400 text-sm">{errorMsg}</p>
            <button onClick={() => navigate('/workspaces')} className="mt-4 text-amber-400 hover:text-amber-300 text-sm transition">
              Go to Workspaces →
            </button>
          </div>
        )}

        {(status === 'ready' || status === 'accepting') && info && (
          <div className="space-y-4">
            <div className="bg-gray-900 rounded-xl p-4 space-y-2">
              <Row label="Workspace" value={info.workspaceName} />
              <Row label="Invited as" value={<span className="capitalize text-amber-400">{info.role}</span>} />
              <Row label="Invited by" value={info.invitedBy} />
              <Row label="For email" value={info.invitedEmail} />
              <Row label="Expires" value={new Date(info.expiresAt).toLocaleDateString()} />
            </div>

            <div className="text-xs text-gray-400 bg-gray-900/50 rounded-lg p-3">
              <strong>Role permissions:</strong>
              <ul className="mt-1 space-y-0.5 list-disc list-inside">
                <li><span className="text-gray-300">Viewer</span> — read passwords</li>
                <li><span className="text-gray-300">Analyst</span> — add & edit passwords</li>
                <li><span className="text-gray-300">Admin</span> — manage members & all passwords</li>
              </ul>
            </div>

            {!authToken && (
              <p className="text-xs text-amber-400 bg-amber-400/10 rounded-lg p-3 text-center">
                You need to be logged in to accept this invite. You'll be redirected to sign in first.
              </p>
            )}

            <button
              onClick={handleAccept}
              disabled={status === 'accepting'}
              className="w-full flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-60 text-slate-900 font-semibold py-3 rounded-xl transition"
            >
              {status === 'accepting' ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Joining…</>
              ) : authToken ? (
                <><Check className="w-4 h-4" /> Accept & Join Workspace</>
              ) : (
                <><LogIn className="w-4 h-4" /> Sign In to Accept</>
              )}
            </button>
          </div>
        )}

        {status === 'done' && (
          <div className="flex flex-col items-center gap-3 text-center">
            <div className="w-12 h-12 rounded-full bg-green-500/10 border border-green-500/30 flex items-center justify-center">
              <Check className="w-6 h-6 text-green-400" />
            </div>
            <p className="text-green-400 font-semibold">{successMsg}</p>
            <p className="text-gray-400 text-sm">Redirecting to vault…</p>
          </div>
        )}

        {status === 'error' && (
          <div className="flex flex-col items-center gap-3 text-center mt-4">
            <AlertTriangle className="w-6 h-6 text-red-400" />
            <p className="text-red-400 text-sm">{errorMsg}</p>
            <button onClick={() => setStatus('ready')} className="text-amber-400 hover:text-amber-300 text-sm transition">
              Try again
            </button>
          </div>
        )}
      </motion.div>
    </div>
  );
};

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-gray-500 text-sm">{label}</span>
      <span className="text-gray-200 text-sm font-medium text-right">{value}</span>
    </div>
  );
}

export default WorkspaceInviteAccept;
