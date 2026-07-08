/**
 * TrackFindingButton
 * Drop this into any scan result page to let users convert a scan result
 * (or a specific finding within it) into a tracked Finding on the board.
 *
 * Usage examples:
 *   // Track whole scan result:
 *   <TrackFindingButton scanType="redteam" sourceScanId={scanLog._id} token={token} />
 *
 *   // Track a specific finding from the scan:
 *   <TrackFindingButton scanType="siteaudit" sourceScanId={scanLog._id} findingIndex={2} token={token} />
 */
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Flag, Check, Loader2, ExternalLink } from 'lucide-react';
import { API_BASE_URL } from '../services/api';
import { fetchWithAuth } from '../services/authService';

interface Props {
  scanType: 'redteam' | 'injection' | 'siteaudit' | 'pii' | 'aiagent';
  sourceScanId: string;
  findingIndex?: number;  // If omitted, tracks the whole scan summary
  token: string;
  /** Optional label override (defaults to "Track as Finding") */
  label?: string;
  /** Compact icon-only button */
  compact?: boolean;
}

type TrackState = 'idle' | 'loading' | 'done' | 'exists' | 'error';

const TrackFindingButton: React.FC<Props> = ({ scanType, sourceScanId, findingIndex, token, label = 'Track as Finding', compact = false }) => {
  const navigate = useNavigate();
  const [state, setState] = useState<TrackState>('idle');
  const [findingId, setFindingId] = useState<string | null>(null);

  async function handleClick() {
    if (state === 'done' || state === 'exists') {
      if (findingId) navigate('/findings');
      return;
    }
    setState('loading');
    try {
      const res = await fetchWithAuth(`${API_BASE_URL}/findings/from-scan`, { method: 'POST', body: JSON.stringify({ scanType, sourceScanId, findingIndex }),
      });
      const data = await res.json();
      if (res.status === 409) {
        setState('exists');
        setFindingId(data.findingId || null);
        return;
      }
      if (!res.ok) { setState('error'); return; }
      setState('done');
      setFindingId(data._id);
    } catch {
      setState('error');
    }
  }

  const isTracked = state === 'done' || state === 'exists';

  if (compact) {
    return (
      <button
        onClick={handleClick}
        title={isTracked ? 'View in Findings Board' : label}
        disabled={state === 'loading'}
        className={`p-1.5 rounded transition ${
          isTracked
            ? 'text-amber-400 hover:text-amber-300'
            : state === 'error'
            ? 'text-red-400'
            : 'text-gray-400 hover:text-amber-400'
        }`}
      >
        {state === 'loading' ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : isTracked ? (
          <Check className="w-4 h-4" />
        ) : (
          <Flag className="w-4 h-4" />
        )}
      </button>
    );
  }

  return (
    <button
      onClick={handleClick}
      disabled={state === 'loading'}
      className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border transition ${
        isTracked
          ? 'border-amber-500/40 bg-amber-500/10 text-amber-400 hover:bg-amber-500/20'
          : state === 'error'
          ? 'border-red-500/40 text-red-400'
          : 'border-gray-600 text-gray-400 hover:text-amber-400 hover:border-amber-500/40'
      }`}
    >
      {state === 'loading' ? (
        <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Tracking…</>
      ) : isTracked ? (
        <><Check className="w-3.5 h-3.5" /> {state === 'exists' ? 'Already tracked' : 'Tracked'} <ExternalLink className="w-3 h-3" /></>
      ) : state === 'error' ? (
        <><Flag className="w-3.5 h-3.5" /> Failed — retry</>
      ) : (
        <><Flag className="w-3.5 h-3.5" /> {label}</>
      )}
    </button>
  );
};

export default TrackFindingButton;
