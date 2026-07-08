import React, { useState, useRef, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ScanEye,
  Image as ImageIcon,
  Film,
  Mic,
  UploadCloud,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  Loader2,
  X,
  FileSearch,
  KeyRound,
  BarChart3,
  Shield,
  ShieldX,
  Phone,
  Zap,
  Eye,
  ChevronRight,
  Clock,
  BarChart2,
} from "lucide-react";
import { API_BASE_URL } from "../services/api";
import Header from "./ui/Header";
import Footer from "./ui/Footer";
import { useNavigate } from "react-router-dom";
import AppSidebar from "./ui/AppSidebar";

// ─── Types ─────────────────────────────────────────────────────────────────────

type Mode = "image" | "video" | "audio";
type Verdict = "DEEPFAKE" | "AUTHENTIC" | "UNCERTAIN" | null;

interface BreakdownItem { label: string; score: number; }

interface VideoMeta {
  avgConfidence: number;
  flaggedRate: number;
  maxConsecutiveRun: number;
  maxFakeScore?: number;
  totalFrames: number;
  fakeFrames: number;
  uncertainFrames: number;
  triggeredSignals: string[];
  isFakeByAvg: boolean;
  isFakeByRate: boolean;
  isFakeByConsecutive: boolean;
  confidenceStd?: number;
  isFakeByVariance?: boolean;
  isFakeByMaxScore?: boolean;
  hfAvailable?: boolean;
  analyzedFrames?: number;
}

interface ScanResult {
  verdict: "DEEPFAKE" | "AUTHENTIC" | "UNCERTAIN";
  confidence: number;   // 0-100, chance of being fake
  topLabel: string;
  breakdown: BreakdownItem[];
  videoMeta?: VideoMeta;
}

interface FrameResult {
  index: number;
  timeLabel: string;
  thumbnail: string;
  result: ScanResult | null;
  error?: string;
}

// ─── Nav ────────────────────────────────────────────────────────────────────────

const NAV_ITEMS = [
  { label: "Analyze Malware",         path: "/malware-analysis",  icon: <FileSearch  className="w-5 h-5" /> },
  { label: "Password Manager",         path: "/dashboard",         icon: <KeyRound    className="w-5 h-5" /> },
  { label: "System Events Dashboard",  path: "/siem-dashboard",    icon: <BarChart3   className="w-5 h-5" /> },
  { label: "Prompt Privacy Scanner",   path: "/prompt-scanner",    icon: <Shield      className="w-5 h-5" /> },
  { label: "AI Injection Scanner",     path: "/injection-scanner", icon: <Zap         className="w-5 h-5" /> },
  { label: "Watch Agent",              path: "/watch-agent",       icon: <Eye         className="w-5 h-5" /> },
  { label: "DeepFake Detector",        path: "/deepfake-detector", icon: <ScanEye     className="w-5 h-5" /> },
  { label: "Contact Us",               path: "/contact",           icon: <Phone       className="w-5 h-5" /> },
];

// ─── Confidence Meter ──────────────────────────────────────────────────────────

const ConfidenceMeter: React.FC<{ value: number; verdict: Verdict; animated?: boolean }> = ({
  value, verdict, animated = true
}) => {
  const [displayed, setDisplayed] = useState(animated ? 0 : value);
  useEffect(() => {
    if (!animated) { setDisplayed(value); return; }
    const start = Date.now();
    const duration = 1000;
    const from = 0;
    const raf = (cb: () => void) => requestAnimationFrame(cb);
    const step = () => {
      const elapsed = Date.now() - start;
      const progress = Math.min(elapsed / duration, 1);
      const ease = 1 - Math.pow(1 - progress, 3);
      setDisplayed(Math.round(from + (value - from) * ease));
      if (progress < 1) raf(step);
    };
    raf(step);
  }, [value, animated]);

  const R = 68;
  const circ = 2 * Math.PI * R;
  const fill = (displayed / 100) * circ;
  const offset = circ - fill;

  const color =
    verdict === "DEEPFAKE"  ? (displayed > 80 ? "#ef4444" : "#f97316") :
    verdict === "UNCERTAIN" ? "#f59e0b" :
    "#22c55e";

  const glowId = `glow-${verdict ?? "neutral"}`;

  return (
    <svg width="176" height="176" viewBox="0 0 176 176" className="mx-auto drop-shadow-xl">
      <defs>
        <filter id={glowId} x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="4" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>
      {/* Track */}
      <circle cx="88" cy="88" r={R} fill="none" stroke="#1f2937" strokeWidth="14" />
      {/* Arc */}
      <circle
        cx="88" cy="88" r={R}
        fill="none"
        stroke={color}
        strokeWidth="14"
        strokeLinecap="round"
        strokeDasharray={circ}
        strokeDashoffset={offset}
        transform="rotate(-90 88 88)"
        filter={`url(#${glowId})`}
        style={{ transition: animated ? "none" : undefined }}
      />
      {/* % text */}
      <text x="88" y="80" textAnchor="middle" fill="white" fontSize="30" fontWeight="700" fontFamily="sans-serif">
        {displayed}%
      </text>
      <text x="88" y="102" textAnchor="middle" fill={color} fontSize="11" fontWeight="600" fontFamily="sans-serif" letterSpacing="2">
        {verdict === "DEEPFAKE" ? "FAKE PROB." : verdict === "AUTHENTIC" ? "AUTHENTIC" : verdict === "UNCERTAIN" ? "UNCERTAIN" : "CONFIDENCE"}
      </text>
    </svg>
  );
};

// ─── Verdict Badge ─────────────────────────────────────────────────────────────

const VERDICT_STYLES: Record<NonNullable<Verdict>, { bg: string; icon: React.ReactNode }> = {
  DEEPFAKE:  { bg: "bg-red-600/20 text-red-400 border border-red-500/40",      icon: <ShieldAlert   className="w-5 h-5" /> },
  UNCERTAIN: { bg: "bg-amber-600/20 text-amber-400 border border-amber-500/40", icon: <AlertTriangle className="w-5 h-5" /> },
  AUTHENTIC: { bg: "bg-green-600/20 text-green-400 border border-green-500/40", icon: <ShieldCheck   className="w-5 h-5" /> },
};

const VerdictBadge: React.FC<{ verdict: Verdict }> = ({ verdict }) => {
  if (!verdict) return null;
  const { bg, icon } = VERDICT_STYLES[verdict];
  return (
    <motion.div
      initial={{ scale: 0.7, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className={`inline-flex items-center gap-2 px-5 py-2 rounded-full font-bold text-base tracking-widest shadow-lg ${bg}`}
    >
      {icon}
      {verdict}
    </motion.div>
  );
};

// ─── Drop Zone ─────────────────────────────────────────────────────────────────

interface DropZoneProps {
  mode: Mode;
  onFile: (f: File) => void;
  accept: string;
  disabled?: boolean;
  children?: React.ReactNode;
}

const DropZone: React.FC<DropZoneProps> = ({ mode, onFile, accept, disabled, children }) => {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handle = (f: File | null) => { if (f && !disabled) onFile(f); };

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragging(false);
    handle(e.dataTransfer.files[0] ?? null);
  }, [disabled]);

  const icons = { image: <ImageIcon className="w-10 h-10" />, video: <Film className="w-10 h-10" />, audio: <Mic className="w-10 h-10" /> };

  return (
    <div
      onDragOver={e => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
      onClick={() => !disabled && inputRef.current?.click()}
      className={`relative cursor-pointer rounded-2xl border-2 border-dashed transition-all duration-300 p-10 flex flex-col items-center gap-3 text-center
        ${dragging ? "border-amber-400 bg-amber-900/20 scale-[1.01]" : "border-gray-600 hover:border-amber-500 bg-gray-900/40 hover:bg-amber-900/10"}
        ${disabled ? "opacity-50 cursor-not-allowed" : ""}
      `}
    >
      <input ref={inputRef} type="file" accept={accept} className="hidden" onChange={e => handle(e.target.files?.[0] ?? null)} disabled={disabled} />
      <div className="text-amber-400">{icons[mode]}</div>
      <p className="text-gray-300 font-medium">
        {children ?? <>Drag & drop or <span className="text-amber-400 underline">browse</span></>}
      </p>
      <p className="text-xs text-gray-500">
        {mode === "image" && "JPEG · PNG · WebP · GIF — up to 10 MB"}
        {mode === "video" && "MP4 · WebM · MOV — processed locally, frames sent for analysis"}
        {mode === "audio" && "WAV · MP3 · OGG · FLAC — up to 25 MB"}
      </p>
      {dragging && (
        <motion.div
          className="absolute inset-0 rounded-2xl border-2 border-amber-400 bg-amber-900/10 pointer-events-none"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }}
        />
      )}
    </div>
  );
};

// ─── Score Bar ────────────────────────────────────────────────────────────────

const ScoreBar: React.FC<{ label: string; score: number; isFake: boolean }> = ({ label, score, isFake }) => (
  <div className="flex items-center gap-3">
    <span className="text-xs text-gray-400 w-28 truncate">{label}</span>
    <div className="flex-1 bg-gray-700 rounded-full h-2 overflow-hidden">
      <motion.div
        className={`h-2 rounded-full ${isFake ? "bg-red-500" : "bg-green-500"}`}
        initial={{ width: 0 }}
        animate={{ width: `${score}%` }}
        transition={{ duration: 0.7, ease: "easeOut" }}
      />
    </div>
    <span className="text-xs text-gray-300 w-8 text-right">{score}%</span>
  </div>
);

// ─── Frame Timeline ───────────────────────────────────────────────────────────

const FrameTimeline: React.FC<{ frames: FrameResult[] }> = ({ frames }) => {
  const [hovered, setHovered] = useState<number | null>(null);
  if (frames.length === 0) return null;

  // Find longest consecutive DEEPFAKE run for highlighting
  let maxRun = 0, maxStart = -1, maxEnd = -1;
  let curRun = 0, curStart = -1;
  for (let i = 0; i < frames.length; i++) {
    if (frames[i].result?.verdict === "DEEPFAKE") {
      if (curRun === 0) curStart = i;
      curRun++;
      if (curRun > maxRun) { maxRun = curRun; maxStart = curStart; maxEnd = i; }
    } else {
      curRun = 0;
    }
  }
  const hasLongRun = maxRun >= 3 && maxStart !== -1;

  const frameColor = (f: FrameResult): string => {
    if (!f.result || f.error) return f.error ? "#6b7280" : "#374151";
    const conf = f.result.confidence ?? 50;
    const opacity = 0.4 + (conf / 100) * 0.6;
    if (f.result.verdict === "DEEPFAKE")  return `rgba(239,68,68,${opacity})`;
    if (f.result.verdict === "UNCERTAIN") return `rgba(245,158,11,${opacity})`;
    return `rgba(34,197,94,${opacity})`;
  };

  const thumbBorder = (f: FrameResult, i: number): string => {
    const inRun = hasLongRun && i >= maxStart && i <= maxEnd;
    if (!f.result && !f.error) return "border-gray-600 opacity-50";
    if (f.error) return "border-gray-500";
    if (f.result?.verdict === "DEEPFAKE")  return inRun ? "border-red-400 shadow shadow-red-500/40" : "border-red-500";
    if (f.result?.verdict === "UNCERTAIN") return "border-amber-500";
    return "border-green-500";
  };

  return (
    <div className="mt-6">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-semibold text-gray-400 flex items-center gap-2">
          <Clock className="w-4 h-4" /> Frame-by-frame analysis
          <span className="text-gray-600 font-normal">({frames.length} frames)</span>
        </p>
        {hasLongRun && (
          <span className="text-xs bg-red-900/30 border border-red-500/40 text-red-400 px-2 py-0.5 rounded-full font-medium animate-pulse">
            ⚠ {maxRun} consecutive frames flagged
          </span>
        )}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mb-3 text-xs text-gray-500">
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block" />Deepfake</span>
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block" />Uncertain</span>
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-green-500 inline-block" />Authentic</span>
      </div>

      {/* Colour bar */}
      <div className="flex rounded-xl overflow-hidden h-4 mb-1">
        {frames.map((f, i) => (
          <motion.div
            key={i}
            className="flex-1 cursor-pointer"
            style={{ background: frameColor(f) }}
            initial={{ scaleY: 0 }} animate={{ scaleY: 1 }}
            transition={{ delay: i * 0.04 }}
            onMouseEnter={() => setHovered(i)}
            onMouseLeave={() => setHovered(null)}
          />
        ))}
      </div>

      {/* Consecutive run underline */}
      {hasLongRun && (
        <div className="relative h-1.5 mb-3">
          <div className="absolute h-full bg-gray-800 rounded-full inset-0" />
          <motion.div
            className="absolute h-full bg-red-500/70 rounded-full"
            initial={{ width: 0 }}
            animate={{
              left:  `${(maxStart / frames.length) * 100}%`,
              width: `${((maxEnd - maxStart + 1) / frames.length) * 100}%`,
            }}
            transition={{ delay: 0.3, duration: 0.4 }}
          />
        </div>
      )}

      {/* Thumbnails */}
      <div className="flex gap-2 overflow-x-auto pb-2 mt-3">
        {frames.map((f, i) => {
          const pending = !f.result && !f.error;
          const inRun = hasLongRun && i >= maxStart && i <= maxEnd;
          return (
            <div
              key={i}
              className="flex-shrink-0 relative"
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(null)}
            >
              {inRun && (
                <div className="absolute -inset-0.5 rounded-lg bg-red-500/20 border border-red-500/50 pointer-events-none z-10" />
              )}
              <div className={`w-20 h-14 rounded-lg overflow-hidden border-2 transition-all ${thumbBorder(f, i)}`}>
                {f.thumbnail ? (
                  <img src={f.thumbnail} alt={`frame-${i}`} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-gray-800 flex items-center justify-center">
                    {pending ? <Loader2 className="w-4 h-4 animate-spin text-gray-500" /> : <X className="w-4 h-4 text-gray-500" />}
                  </div>
                )}
                {!pending && f.result && (
                  <div className={`absolute inset-0 rounded-lg flex items-end justify-center pb-1 text-xs font-bold ${
                    f.result.verdict === "DEEPFAKE"  ? "text-red-300"   :
                    f.result.verdict === "UNCERTAIN" ? "text-amber-300" : "text-green-300"
                  }`}>
                    <span className="bg-black/70 px-1 rounded">{f.result.confidence}%</span>
                  </div>
                )}
              </div>
              <p className="text-center text-xs text-gray-500 mt-0.5">{f.timeLabel}</p>

              <AnimatePresence>
                {hovered === i && f.result && (
                  <motion.div
                    initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 4 }}
                    className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 z-20 bg-gray-900 border border-gray-700 rounded-xl p-2 w-36 shadow-xl text-center"
                  >
                    <p className={`text-xs font-bold ${
                      f.result.verdict === "DEEPFAKE"  ? "text-red-400"   :
                      f.result.verdict === "UNCERTAIN" ? "text-amber-400" : "text-green-400"
                    }`}>
                      {f.result.verdict}
                    </p>
                    <p className="text-xs text-gray-400">{f.result.confidence}% fake prob.</p>
                    {inRun && <p className="text-xs text-orange-400 mt-0.5">Part of consecutive run</p>}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>

      {/* Bar chart */}
      <div className="mt-4 flex items-end gap-1 h-16">
        {frames.map((f, i) => {
          const conf = f.result?.confidence ?? 0;
          const inRun = hasLongRun && i >= maxStart && i <= maxEnd;
          const bg =
            !f.result          ? "bg-gray-700/40" :
            f.result.verdict === "DEEPFAKE"  ? (inRun ? "bg-red-400/90" : "bg-red-500/70") :
            f.result.verdict === "UNCERTAIN" ? "bg-amber-500/70" :
            "bg-green-500/70";
          return (
            <motion.div
              key={i}
              className={`flex-1 rounded-t ${bg}`}
              initial={{ height: 0 }} animate={{ height: `${Math.max(conf, 4)}%` }}
              transition={{ delay: i * 0.05, duration: 0.5 }}
              title={`Frame ${i + 1}: ${conf}%`}
            />
          );
        })}
      </div>
      <p className="text-xs text-gray-600 text-center mt-1">Fake probability per frame</p>
    </div>
  );
};

// ─── Video Insight Panel ──────────────────────────────────────────────────────

const VideoInsightPanel: React.FC<{ meta: VideoMeta }> = ({ meta }) => {
  const signals = [
    {
      label: "Avg Confidence",
      value: `${meta.avgConfidence}%`,
      threshold: "threshold ≥ 38%",
      triggered: meta.isFakeByAvg,
      desc: `Mean fake probability across ${meta.analyzedFrames ?? meta.totalFrames} frames`,
    },
    {
      label: "Frame Flag Rate",
      value: `${meta.flaggedRate}%`,
      threshold: "threshold ≥ 20%",
      triggered: meta.isFakeByRate,
      desc: `${meta.fakeFrames} of ${meta.analyzedFrames ?? meta.totalFrames} frames DEEPFAKE`,
    },
    {
      label: "Max Consecutive",
      value: `${meta.maxConsecutiveRun} frames`,
      threshold: "threshold ≥ 5",
      triggered: meta.isFakeByConsecutive,
      desc: "Longest streak of flagged frames in sequence",
    },
    ...(meta.confidenceStd !== undefined ? [{
      label: "Conf. Oscillation",
      value: `±${meta.confidenceStd}pts`,
      threshold: "threshold > 12pts",
      triggered: meta.isFakeByVariance ?? false,
      desc: "Confidence std dev — face-swaps oscillate as swap quality varies with head pose & lighting",
    }] : []),
    ...(meta.maxFakeScore !== undefined ? [{
      label: "Peak Frame",
      value: `${meta.maxFakeScore}%`,
      threshold: "threshold ≥ 60%",
      triggered: meta.isFakeByMaxScore ?? false,
      desc: "Single highest-scoring frame — one heavily manipulated frame is enough to flag",
    }] : []),
  ];

  const cols = signals.length >= 5 ? "grid-cols-5" : signals.length === 4 ? "grid-cols-4" : "grid-cols-3";
  const hfUnavailable = meta.hfAvailable === false;

  return (
    <div className="mt-2 bg-gray-800/40 rounded-xl border border-gray-700 p-4">

      {/* HF unavailability banner */}
      {hfUnavailable && (
        <div className="flex items-start gap-2 bg-amber-900/20 border border-amber-600/40 rounded-lg p-3 mb-3">
          <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-semibold text-amber-300">Neural model unavailable — result is unreliable</p>
            <p className="text-xs text-amber-500/80 mt-0.5">
              Face-swap deepfakes require the HF neural model. Add <code className="bg-gray-800 px-1 rounded">HF_API_TOKEN</code> to your <code className="bg-gray-800 px-1 rounded">.env</code>, then retry. Free tokens at huggingface.co/settings/tokens.
            </p>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-semibold text-gray-400 flex items-center gap-1.5">
          <BarChart3 className="w-3.5 h-3.5" /> Video Detection Signals
          {meta.analyzedFrames !== undefined && meta.analyzedFrames < meta.totalFrames && (
            <span className="text-gray-600 font-normal">({meta.analyzedFrames}/{meta.totalFrames} frames analyzed)</span>
          )}
        </p>
        {!hfUnavailable && <span className="text-xs text-gray-600">ANY signal triggered → DEEPFAKE</span>}
      </div>

      {!hfUnavailable && (
        <div className={`grid ${cols} gap-2`}>
          {signals.map(sig => (
            <div
              key={sig.label}
              className={`rounded-lg p-3 border transition-all ${
                sig.triggered
                  ? "border-red-500/50 bg-red-900/15"
                  : "border-gray-700/80 bg-gray-900/40"
              }`}
            >
              <p className="text-xs text-gray-500 mb-1">{sig.label}</p>
              <p className={`text-base font-bold leading-none mb-1 ${sig.triggered ? "text-red-400" : "text-gray-200"}`}>
                {sig.value}
              </p>
              <p className="text-xs text-gray-600">{sig.threshold}</p>
              <p className="text-xs text-gray-600 mt-1 leading-tight">{sig.desc}</p>
              {sig.triggered && (
                <span className="inline-block mt-1.5 text-xs font-semibold text-red-400 bg-red-900/30 px-1.5 py-0.5 rounded">
                  TRIGGERED
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {!hfUnavailable && meta.triggeredSignals.length > 0 && (
        <p className="text-xs text-gray-600 mt-2 border-t border-gray-700/50 pt-2">
          <span className="text-red-400 font-medium">Triggered: </span>
          {meta.triggeredSignals.join(" · ")}
        </p>
      )}
      {!hfUnavailable && meta.triggeredSignals.length === 0 && (
        <p className="text-xs text-green-500/70 mt-2 flex items-center gap-1">
          <ShieldCheck className="w-3.5 h-3.5" /> No signals exceeded detection thresholds
        </p>
      )}
      <p className="text-xs text-gray-700 mt-2">
        Each frame: 4 neural views (full frame + centre/left/right face crops, 224×224) — weighted-max ensemble. Thresholds calibrated for YouTube H.264 compression (FF++, MesoNet, DeepFake-TIMIT).
      </p>
    </div>
  );
};

// ─── Main Component ────────────────────────────────────────────────────────────

const DeepFakeDetector: React.FC = () => {
  const navigate   = useNavigate();
  const token      = localStorage.getItem("token");
  const [sidebarExpanded, setSidebarExpanded] = useState(true);
  const [profileImage,     setProfileImage]    = useState("");

  // Detection state
  const [mode,         setMode]         = useState<Mode>("image");
  const [file,         setFile]         = useState<File | null>(null);
  const [preview,      setPreview]      = useState<string | null>(null);
  const [analyzing,    setAnalyzing]    = useState(false);
  const [result,       setResult]       = useState<ScanResult | null>(null);
  const [frames,       setFrames]       = useState<FrameResult[]>([]);
  const [error,        setError]        = useState<string | null>(null);
  const [status,       setStatus]       = useState<string>("");
  const [progress,     setProgress]     = useState(0);   // 0-100 for video

  const handleLogout = () => { localStorage.removeItem("token"); navigate("/"); };

  // Profile
  useEffect(() => {
    if (!token) return;
    fetch(`${API_BASE_URL}/profile`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.profileImage) setProfileImage(d.profileImage); })
      .catch(() => {});
  }, [token]);

  // ── Reset on mode change ──────────────────────────────────────────────────────
  const resetState = () => {
    setFile(null);
    setPreview(null);
    setResult(null);
    setFrames([]);
    setError(null);
    setStatus("");
    setProgress(0);
  };

  const switchMode = (m: Mode) => { setMode(m); resetState(); };

  // ── File selection ────────────────────────────────────────────────────────────
  const handleFile = (f: File) => {
    resetState();
    setFile(f);
    if (mode === "image") {
      const reader = new FileReader();
      reader.onload = e => setPreview(e.target?.result as string);
      reader.readAsDataURL(f);
    } else if (mode === "video") {
      setPreview(URL.createObjectURL(f));
    } else {
      setPreview(URL.createObjectURL(f));
    }
  };

  // ── Call backend image endpoint ───────────────────────────────────────────────
  const analyzeImageBlob = async (blob: Blob): Promise<ScanResult> => {
    const fd = new FormData();
    fd.append("file", blob, "frame.jpg");

    const res  = await fetch(`${API_BASE_URL}/deepfake/image`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: fd,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Analysis failed.");
    return data as ScanResult;
  };

  // ── Extract video frames & batch-analyse via /deepfake/video ─────────────────
  const analyzeVideo = async (videoFile: File) => {
    const video  = document.createElement("video");
    const canvas = document.createElement("canvas");
    const ctx    = canvas.getContext("2d")!;

    await new Promise<void>((resolve, reject) => {
      video.src = URL.createObjectURL(videoFile);
      video.onloadedmetadata = () => resolve();
      video.onerror = () => reject(new Error("Could not load video."));
      setTimeout(reject, 15_000, new Error("Video load timed out."));
    });

    canvas.width  = Math.min(video.videoWidth,  640);
    canvas.height = Math.min(video.videoHeight, 360);
    const duration = video.duration;

    const FRAME_COUNT =
      duration < 30  ? 10 :
      duration < 180 ? 16 :
      duration < 600 ? 24 : 30;

    // Show skeleton immediately so the timeline appears as extraction starts
    setFrames(Array.from({ length: FRAME_COUNT }, (_, i) => ({
      index: i,
      timeLabel: formatTime((i / Math.max(FRAME_COUNT - 1, 1)) * duration),
      thumbnail: "",
      result: null,
    })));

    // ── Phase 1: Extract frames (0–50% progress) ─────────────────────────────
    const frameBlobs: Blob[]   = [];
    const thumbs:     string[] = [];
    const timesLabel: string[] = [];

    for (let i = 0; i < FRAME_COUNT; i++) {
      const t = (i / Math.max(FRAME_COUNT - 1, 1)) * duration;
      setStatus(`Extracting frame ${i + 1} / ${FRAME_COUNT}…`);
      setProgress(Math.round((i / FRAME_COUNT) * 50));

      await new Promise<void>(resolve => {
        video.currentTime = t;
        video.onseeked = () => resolve();
      });

      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const thumbnail = canvas.toDataURL("image/jpeg", 0.75);
      const blob = await new Promise<Blob>(resolve =>
        canvas.toBlob(b => resolve(b!), "image/jpeg", 0.85)
      );

      frameBlobs.push(blob);
      thumbs.push(thumbnail);
      timesLabel.push(formatTime(t));

      // Show thumbnail immediately — result arrives in Phase 2
      setFrames(prev => prev.map((f, idx) =>
        idx === i ? { ...f, thumbnail } : f
      ));
    }

    URL.revokeObjectURL(video.src);

    // ── Phase 2: Batch neural analysis (50–100% progress) ───────────────────
    setStatus(`Sending ${FRAME_COUNT} frames to neural model — first run may warm up for 30–50 s…`);
    setProgress(55);

    const fd = new FormData();
    frameBlobs.forEach((b, i) => fd.append("frames", b, `frame-${i}.jpg`));

    const res = await fetch(`${API_BASE_URL}/deepfake/video`, {
      method:  "POST",
      headers: { Authorization: `Bearer ${token}` },
      body:    fd,
    });

    setProgress(90);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Video analysis failed.");
    setProgress(100);

    // Map backend frame results → FrameResult[] (keeps FrameTimeline working)
    const mapped: FrameResult[] = (data.frames ?? []).map((f: any) => ({
      index:     f.index,
      timeLabel: timesLabel[f.index] ?? "",
      thumbnail: thumbs[f.index]    ?? "",
      result: f.error ? null : {
        verdict:    f.verdict,
        confidence: f.confidence,
        topLabel:   `Full: ${f.views?.full ?? "?"}% · Face: ${f.views?.face ?? "?"}%`,
        breakdown:  [
          ...(f.views?.full != null ? [{ label: "Full frame (224×224)", score: f.views.full }] : []),
          ...(f.views?.face != null ? [{ label: "Face crop (224×224)",  score: f.views.face }] : []),
        ],
      },
      error: f.error,
    }));
    setFrames(mapped);

    const t_ = data.temporal ?? {};
    const videoMeta: VideoMeta = {
      avgConfidence:       t_.avgConfidence        ?? 0,
      flaggedRate:         t_.flaggedRate           ?? 0,
      maxConsecutiveRun:   t_.maxConsecutiveRun     ?? 0,
      maxFakeScore:        t_.maxFakeScore,
      totalFrames:         t_.totalFrames           ?? mapped.length,
      analyzedFrames:      t_.analyzedFrames,
      fakeFrames:          t_.fakeFrames            ?? 0,
      uncertainFrames:     t_.uncertainFrames       ?? 0,
      isFakeByAvg:         t_.isFakeByAvg           ?? false,
      isFakeByRate:        t_.isFakeByRate          ?? false,
      isFakeByConsecutive: t_.isFakeByConsecutive   ?? false,
      triggeredSignals:    t_.triggeredSignals       ?? [],
      confidenceStd:       t_.confidenceStd,
      isFakeByVariance:    t_.isFakeByVariance,
      isFakeByMaxScore:    t_.isFakeByMaxScore,
      hfAvailable:         t_.hfAvailable           ?? true,
    };

    return {
      verdict:    data.verdict,
      confidence: data.confidence,
      topLabel:   data.topLabel,
      breakdown:  data.breakdown ?? [],
      videoMeta,
    };
  };

  // ── Call backend audio endpoint ───────────────────────────────────────────────
  const analyzeAudio = async (audioFile: File): Promise<ScanResult> => {
    const fd = new FormData();
    fd.append("file", audioFile);

    const res  = await fetch(`${API_BASE_URL}/deepfake/audio`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: fd,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Audio analysis failed.");
    return data as ScanResult;
  };

  // ── Run analysis ──────────────────────────────────────────────────────────────
  const handleAnalyze = async () => {
    if (!file) return;
    setAnalyzing(true);
    setResult(null);
    setError(null);
    setFrames([]);
    setProgress(0);

    try {
      let scanResult: ScanResult;

      if (mode === "image") {
        setStatus("Scanning image for manipulation…");
        const blob = await file.arrayBuffer().then(b => new Blob([b], { type: file.type }));
        scanResult = await analyzeImageBlob(blob);

      } else if (mode === "video") {
        setStatus("Extracting frames…");
        scanResult = await analyzeVideo(file);

      } else {
        setStatus("Analysing audio…");
        scanResult = await analyzeAudio(file);
      }

      setResult(scanResult);
      setStatus("");
    } catch (e: any) {
      setError(e.message ?? "Analysis failed.");
      setStatus("");
    } finally {
      setAnalyzing(false);
    }
  };

  // ── Helpers ───────────────────────────────────────────────────────────────────
  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const acceptMap: Record<Mode, string> = {
    image: "image/jpeg,image/png,image/webp,image/gif",
    video: "video/mp4,video/webm,video/quicktime",
    audio: "audio/wav,audio/mpeg,audio/ogg,audio/flac,.wav,.mp3,.ogg,.flac",
  };

  // ─── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex flex-col bg-[#0d1117] text-gray-100">
      <Header
        token={token || ""}
        handleLogout={handleLogout}
        profileImage={profileImage}
      />

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <AppSidebar sidebarExpanded={sidebarExpanded} setSidebarExpanded={setSidebarExpanded} />


        {/* Main */}
        <div className="flex-1 overflow-y-auto p-6 md:p-8">

          {/* Page header */}
          <div className="mb-8">
            <h1 className="text-3xl font-extrabold text-amber-400 flex items-center gap-2">
              <ScanEye className="w-8 h-8" /> DeepFake Detector
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              AI-powered authenticity analysis for images, videos, and audio — powered by Hugging Face models.
            </p>
          </div>

          {/* Mode tabs */}
          <div className="flex gap-1 mb-6 bg-gray-900 border border-gray-800 p-1 rounded-xl w-fit">
            {(["image", "video", "audio"] as Mode[]).map(m => (
              <button
                key={m}
                onClick={() => switchMode(m)}
                className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold transition capitalize ${
                  mode === m
                    ? "bg-amber-500 text-slate-900 shadow"
                    : "text-gray-400 hover:text-white hover:bg-gray-800"
                }`}
              >
                {m === "image" && <ImageIcon className="w-4 h-4" />}
                {m === "video" && <Film className="w-4 h-4" />}
                {m === "audio" && <Mic className="w-4 h-4" />}
                {m}
              </button>
            ))}
          </div>

          <div className="grid gap-6 lg:grid-cols-2">

            {/* ── Left: Upload + preview ── */}
            <div className="flex flex-col gap-4">
              <DropZone
                mode={mode}
                onFile={handleFile}
                accept={acceptMap[mode]}
                disabled={analyzing}
              />

              {/* Preview */}
              <AnimatePresence mode="wait">
                {preview && (
                  <motion.div
                    key={preview}
                    initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                    className="relative rounded-2xl overflow-hidden border border-gray-700 bg-gray-900"
                  >
                    {mode === "image" && (
                      <img src={preview} alt="preview" className="w-full max-h-80 object-contain" />
                    )}
                    {mode === "video" && (
                      <video src={preview} controls className="w-full max-h-72" />
                    )}
                    {mode === "audio" && (
                      <div className="p-4 flex flex-col items-center gap-3">
                        <Mic className="w-12 h-12 text-amber-400 opacity-60" />
                        <p className="text-sm text-gray-400 truncate max-w-full">{file?.name}</p>
                        <audio src={preview} controls className="w-full" />
                      </div>
                    )}
                    {/* File name overlay */}
                    <div className="absolute top-2 right-2 flex gap-2">
                      <span className="bg-black/70 text-xs text-gray-300 px-2 py-1 rounded-lg truncate max-w-xs">
                        {file?.name}
                      </span>
                      <button
                        onClick={resetState}
                        className="bg-black/70 hover:bg-red-600/80 text-gray-400 hover:text-white p-1 rounded-lg transition"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Analyse button */}
              {file && (
                <button
                  onClick={handleAnalyze}
                  disabled={analyzing}
                  className="flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed text-slate-900 font-bold px-6 py-3 rounded-xl shadow-lg shadow-amber-900/20 transition"
                >
                  {analyzing
                    ? <><Loader2 className="w-5 h-5 animate-spin" /> {status || "Analysing…"}</>
                    : <><ScanEye className="w-5 h-5" /> Analyse {mode}</>
                  }
                </button>
              )}

              {/* Video progress bar */}
              {mode === "video" && analyzing && (
                <div className="space-y-1">
                  <div className="w-full bg-gray-800 rounded-full h-1.5">
                    <motion.div
                      className="h-1.5 rounded-full bg-amber-500"
                      animate={{ width: `${progress}%` }}
                      transition={{ duration: 0.3 }}
                    />
                  </div>
                  <p className="text-xs text-gray-500 text-center">{progress}%</p>
                </div>
              )}

              {/* Error */}
              <AnimatePresence>
                {error && (
                  <motion.div
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className="flex items-start gap-2 bg-red-900/20 border border-red-700/40 text-red-400 rounded-xl p-3 text-sm"
                  >
                    <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    {error}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* ── Right: Results ── */}
            <div className="flex flex-col gap-4">
              <AnimatePresence mode="wait">
                {!result && !analyzing && (
                  <motion.div
                    key="idle"
                    initial={{ opacity: 0 }} animate={{ opacity: 0.6 }} exit={{ opacity: 0 }}
                    className="flex flex-col items-center justify-center py-20 text-gray-600"
                  >
                    <ScanEye className="w-16 h-16 mb-4 opacity-30" />
                    <p className="text-lg font-medium">Upload a file to begin</p>
                    <p className="text-sm mt-1">Results will appear here</p>
                  </motion.div>
                )}

                {analyzing && !result && (
                  <motion.div
                    key="scanning"
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className="flex flex-col items-center justify-center py-16 gap-4"
                  >
                    {/* Pulsing scanner ring */}
                    <div className="relative w-36 h-36">
                      <motion.div
                        className="absolute inset-0 rounded-full border-4 border-indigo-500/30"
                        animate={{ scale: [1, 1.15, 1], opacity: [0.5, 0.1, 0.5] }}
                        transition={{ duration: 2, repeat: Infinity }}
                      />
                      <motion.div
                        className="absolute inset-4 rounded-full border-4 border-indigo-400/50"
                        animate={{ scale: [1, 1.1, 1], opacity: [0.7, 0.2, 0.7] }}
                        transition={{ duration: 2, repeat: Infinity, delay: 0.3 }}
                      />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <ScanEye className="w-10 h-10 text-amber-400 animate-pulse" />
                      </div>
                    </div>
                    <p className="text-amber-300 font-semibold">{status || "Analysing…"}</p>
                    <p className="text-xs text-gray-500">Hugging Face models may take 20–30 s on first run</p>
                  </motion.div>
                )}

                {result && (
                  <motion.div
                    key="result"
                    initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
                    className="bg-gray-900 border border-gray-800 rounded-2xl p-6 flex flex-col gap-5"
                  >
                    {/* Verdict */}
                    <div className="flex flex-col items-center gap-3">
                      <ConfidenceMeter value={result.confidence} verdict={result.verdict} />
                      <VerdictBadge verdict={result.verdict} />
                      <p className="text-xs text-gray-500 text-center">{result.topLabel}</p>
                    </div>

                    {/* Contextual verdict message */}
                    {result.verdict === "DEEPFAKE" && (
                      <div className="flex items-start gap-2 bg-red-900/20 border border-red-700/30 rounded-xl p-3">
                        <ShieldX className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                        <p className="text-xs text-red-300">
                          Strong indicators of AI manipulation detected (&gt;72% fake probability).
                          Treat with caution and verify through trusted sources.
                        </p>
                      </div>
                    )}
                    {result.verdict === "UNCERTAIN" && (
                      <div className="flex items-start gap-2 bg-amber-900/20 border border-amber-700/30 rounded-xl p-3">
                        <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                        <p className="text-xs text-amber-300">
                          The model is not confident enough to reach a verdict (35–72% range).
                          This can happen with heavily compressed, filtered, or low-resolution {mode}s.
                          Consider using a higher-quality source.
                        </p>
                      </div>
                    )}
                    {result.verdict === "AUTHENTIC" && (
                      <div className="flex items-start gap-2 bg-green-900/20 border border-green-700/30 rounded-xl p-3">
                        <ShieldCheck className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />
                        <p className="text-xs text-green-300">
                          No significant signs of AI-generated manipulation detected (&lt;35% fake probability).
                        </p>
                      </div>
                    )}
                    {/* Accuracy disclaimer */}
                    <p className="text-xs text-gray-600 italic border-t border-gray-800 pt-2">
                      These models can produce false positives on real media. Results should be treated as
                      one signal, not a definitive determination.
                    </p>

                    {/* Breakdown bars */}
                    {result.breakdown.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-gray-500 mb-2 flex items-center gap-1">
                          <BarChart2 className="w-3.5 h-3.5" /> Model breakdown
                        </p>
                        <div className="flex flex-col gap-2">
                          {result.breakdown.map((b, i) => (
                            <ScoreBar
                              key={i}
                              label={b.label}
                              score={b.score}
                              isFake={/fake/i.test(b.label) || (mode === "video" && i === 0)}
                            />
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Confidence interpretation */}
                    <div className="text-xs text-gray-600 border-t border-gray-800 pt-3">
                      <ChevronRight className="w-3 h-3 inline" />
                      {result.confidence >= 80
                        ? " High confidence — model is strongly certain about this verdict."
                        : result.confidence >= 50
                        ? " Moderate confidence — some uncertainty; consider additional verification."
                        : " Low confidence — model is uncertain. This result may be unreliable."}
                    </div>

                    {/* Video 3-signal insight panel */}
                    {mode === "video" && result.videoMeta && (
                      <VideoInsightPanel meta={result.videoMeta} />
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Video frame timeline (full width below grid) */}
          {mode === "video" && frames.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
              className="mt-6 bg-gray-900 border border-gray-800 rounded-2xl p-6"
            >
              <FrameTimeline frames={frames} />
            </motion.div>
          )}

          {/* Info cards */}
          <div className="mt-8 grid gap-4 sm:grid-cols-3 text-sm">
            {[
              {
                icon: <ImageIcon className="w-5 h-5 text-amber-400" />,
                title: "Image Forensics",
                desc: "Three independent signals: Error Level Analysis (ELA) detects recompression inconsistencies, noise uniformity flags AI's unnaturally smooth textures, and metadata inspection checks for AI tool signatures and suspicious structure.",
              },
              {
                icon: <Film className="w-5 h-5 text-purple-400" />,
                title: "Video Analysis",
                desc: "Extracts 10–30 frames and runs 4 neural views per frame: full frame + 3 face-crop positions (centre/left/right) at 224×224, ensemble via weighted-max. Aggregates via 4-signal temporal hybrid: avg confidence ≥38%, flag rate ≥20%, consecutive run ≥5, and confidence oscillation >12pts std.",
              },
              {
                icon: <Mic className="w-5 h-5 text-cyan-400" />,
                title: "Audio Analysis",
                desc: "Uses a dedicated voice cloning / speech synthesis detection model via Hugging Face, with automatic fallback to a backup model if the primary is unavailable.",
              },
            ].map(({ icon, title, desc }) => (
              <div key={title} className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex flex-col gap-2">
                {icon}
                <p className="font-semibold text-gray-300">{title}</p>
                <p className="text-gray-500 text-xs leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>

        </div>
      </div>
      <Footer />
    </div>
  );
};

export default DeepFakeDetector;
