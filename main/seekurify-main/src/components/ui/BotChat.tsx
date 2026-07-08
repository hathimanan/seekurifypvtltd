import React, { useEffect, useRef, useState, useMemo } from "react";
import axios from "axios";
import { motion, AnimatePresence } from "framer-motion";
import ReactMarkdown from "react-markdown";
import SecurityChatbotIcon from "./ChatbotIcon";
import defaultProfileIcon from "../../assets/default-profile.png";
import { MediaKey, mediaLibrary } from "../chatbot/richMediaLibrary";
import { Brain, AlertTriangle, Loader2, Sparkles } from "lucide-react";
import { API_BASE_URL } from "../../services/api";

// ─────────────────────────────────────────────
//  TYPES
// ─────────────────────────────────────────────

interface BotProps {
  profileImage?: string;
}

type Media = {
  type: "image" | "table";
  src?: string;
  caption?: string;
  headers?: ReadonlyArray<string>;
  rows?: ReadonlyArray<ReadonlyArray<string>>;
};

interface ChatSession {
  id: string;
  startedAt: string;
  messages: {
    question: string;
    answer: string;
    suggestions: string[];
    widgetType: "linkScanner" | "quiz" | "stepByStep" | null;
    widgetData: any;
    feedback: "up" | "down" | null;
    media?: Media;
    format?: "concise" | "detailed" | "bullet";
    isAI?: boolean;
  }[];
}

/** User's live security context pulled from Seekurify data */
interface UserSecurityContext {
  securityScore: number;
  securityStatus: "good" | "fair" | "poor" | "critical";
  weakPasswords: number;
  reusedPasswords: number;
  breachesFound: number;               // count of breached credentials
  failedAttemptsLast24h: number;
  recentBruteForce: boolean;
  recentAlerts: { type: string; message: string; timestamp: string }[];
  totalPasswords: number;
  lastChecked: string;
  aiRecommendations: {
    summary: string;
    recommendations: { priority: "high" | "medium" | "low"; action: string }[];
  } | null;
}


// ─────────────────────────────────────────────
//  FETCH USER SECURITY CONTEXT
//  Replace the endpoint below with your real API
// ─────────────────────────────────────────────

async function fetchUserSecurityContext(): Promise<UserSecurityContext | null> {
  const token = localStorage.getItem("token");
  if (!token) {
    console.warn("[BotChat] No token in localStorage — cannot fetch security context");
    return null;
  }
  try {
    const res = await fetch(`${API_BASE_URL}/auth/security-context`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error(`[BotChat] /auth/security-context returned ${res.status}: ${body}`);
      return null;
    }
    const data = await res.json();
    console.log("[BotChat] Security context loaded:", data);
    return data;
  } catch (err) {
    console.error("[BotChat] Failed to fetch security context:", err);
    return null;
  }
}

/** Build the context injection string for the LLM system prompt */
function buildContextPrompt(ctx: UserSecurityContext): string {
  const alertSummary = ctx.recentAlerts.length > 0
    ? ctx.recentAlerts.map(a => `- [${a.type}] ${a.message} (${a.timestamp})`).join("\n")
    : "- No recent alerts";

  return `
=== USER'S CURRENT SEEKURIFY SECURITY CONTEXT ===
Security Score: ${ctx.securityScore}/100
Security Status: ${ctx.securityStatus}
Weak Passwords: ${ctx.weakPasswords}
Reused Passwords: ${ctx.reusedPasswords}
Failed Login Attempts (24h): ${ctx.failedAttemptsLast24h}
Recent Brute Force Attempt: ${ctx.recentBruteForce ? "YES — HIGH PRIORITY" : "No"}
Total Passwords Managed: ${ctx.totalPasswords}

Recent Security Alerts:
${alertSummary}

${ctx.aiRecommendations ? `AI Security Summary: ${ctx.aiRecommendations.summary}` : ""}
=== END CONTEXT ===

When the user asks about their security, reference the above data for personalized advice.
Always prioritize the most urgent issues. Be warm, clear, and non-technical.`;
}

// ─────────────────────────────────────────────
//  CONTEXT-AWARE AI QUESTION
// ─────────────────────────────────────────────

/** Streams answer tokens from /ask/stream via SSE, calling onToken for each chunk.
 *  Resolves with the metadata sent in the final `done` event. */
async function streamAnswer(
  userQuestion: string,
  format: "concise" | "detailed" | "bullet",
  securityContext: UserSecurityContext | null | undefined,
  onToken: (token: string) => void,
): Promise<{ suggestions: string[] }> {
  const contextPrompt = securityContext ? buildContextPrompt(securityContext) : undefined;

  const response = await fetch(`${API_BASE_URL}/ask/stream`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${localStorage.getItem("token")}`,
    },
    body: JSON.stringify({ userQuestion, userLevel: "Beginner", format, securityContext: contextPrompt }),
  });

  if (!response.ok || !response.body) {
    throw new Error(`Chatbot API error ${response.status}`);
  }

  const reader  = response.body.getReader();
  const decoder = new TextDecoder();
  let   buffer  = "";
  let   meta: { suggestions: string[] } = { suggestions: [] };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      try {
        const payload = JSON.parse(line.slice(6));
        if (payload.error) throw new Error(payload.error);
        if (payload.token) onToken(payload.token);
        if (payload.done)  meta = { suggestions: payload.suggestions ?? [] };
      } catch { /* malformed SSE line — skip */ }
    }
  }
  return meta;
}
 


// ─────────────────────────────────────────────
//  PREDEFINED QUESTIONS
// ─────────────────────────────────────────────

const predefinedQuestions = [
  "Am I safe right now?",
  "What are my biggest security risks?",
  "How do I create a strong password?",
  "What is phishing?",
  "Explain ransomware.",
  "What is two-factor authentication?",
  "How do I check if my email was breached?",
  "What is social engineering?",
];

// ─────────────────────────────────────────────
//  SECURITY CONTEXT PANEL (sidebar widget)
// ─────────────────────────────────────────────

const SecurityContextPanel: React.FC<{ ctx: UserSecurityContext; darkMode: boolean }> = ({ ctx, darkMode }) => {
  const scoreColor = ctx.securityScore >= 70 ? "text-emerald-500" : ctx.securityScore >= 40 ? "text-orange-400" : "text-red-500";
  const scoreBg    = ctx.securityScore >= 70 ? "bg-emerald-500" : ctx.securityScore >= 40 ? "bg-orange-400" : "bg-red-500";

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      className={`rounded-xl border p-3 mb-3 text-xs ${darkMode ? "bg-gray-800 border-gray-700 text-gray-200" : "bg-indigo-50 border-indigo-200 text-gray-700"}`}
    >
      <div className="flex items-center gap-1.5 font-bold text-indigo-500 mb-2">
        <Brain className="w-3 h-3" /> Your Security Context
        <span className="text-[10px] bg-indigo-100 text-indigo-600 px-1.5 py-0.5 rounded-full ml-auto font-semibold">LIVE</span>
      </div>

      {/* Score */}
      <div className="flex items-center gap-2 mb-2">
        <span className="text-gray-500">Score</span>
        <div className="flex-1 bg-gray-200 rounded-full h-1.5">
          <div className={`h-1.5 rounded-full ${scoreBg}`} style={{ width: `${ctx.securityScore}%` }} />
        </div>
        <span className={`font-black ${scoreColor}`}>{ctx.securityScore}/100</span>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-2 gap-1.5">
        {[
          { label: "Weak Passwords", value: ctx.weakPasswords, bad: ctx.weakPasswords > 0 },
          { label: "Reused Passwords", value: ctx.reusedPasswords, bad: ctx.reusedPasswords > 0 },
          { label: "Breaches Found", value: ctx.breachesFound, bad: ctx.breachesFound > 0 },
          { label: "Brute Force", value: ctx.recentBruteForce ? "⚠️ Yes" : "✅ No", bad: ctx.recentBruteForce },
        ].map((s) => (
          <div key={s.label} className={`p-1.5 rounded-lg ${s.bad ? (darkMode ? "bg-red-900/30" : "bg-red-50") : (darkMode ? "bg-emerald-900/20" : "bg-emerald-50")}`}>
            <div className="text-[10px] text-gray-400">{s.label}</div>
            <div className={`font-black text-sm ${s.bad ? "text-red-500" : "text-emerald-600"}`}>{s.value}</div>
          </div>
        ))}
      </div>

      {ctx.recentAlerts.length > 0 && (
        <div className="mt-2">
          <div className="text-[10px] font-bold text-gray-400 uppercase mb-1">Latest Alert</div>
          <div className={`text-[11px] p-1.5 rounded ${darkMode ? "bg-red-900/30 text-red-300" : "bg-red-50 text-red-700"}`}>
            {ctx.recentAlerts[0].message}
          </div>
        </div>
      )}
    </motion.div>
  );
};


// ─────────────────────────────────────────────
//  MAIN COMPONENT
// ─────────────────────────────────────────────

const BotChat: React.FC<BotProps> = ({ profileImage }) => {
  const [question, setQuestion]         = useState("");
  const [loading, setLoading]           = useState(false);
  const [useAI, setUseAI]               = useState(true); // toggle: AI vs legacy backend
  const [securityContext, setSecurityContext] = useState<UserSecurityContext | null>(null);
  const [contextLoading, setContextLoading]  = useState(false);

  const [_positiveCount, setPositiveCount] = useState<Record<string, number>>({});
  const [_negativeCount, setNegativeCount] = useState<Record<string, number>>({});
  const [thankYouMap, setThankYouMap]     = useState<Record<string, boolean>>({});
  const [feedback, setFeedbackMap]        = useState<{ [key: string]: "up" | "down" | null }>({});

  const [savedMessages, setSavedMessages] = useState<string[]>(() => {
    const stored = localStorage.getItem("savedMessages");
    return stored ? JSON.parse(stored) : [];
  });
  const [showSaved, setShowSaved]   = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [chatSessions, setChatSessions] = useState<ChatSession[]>(() => {
    const stored = localStorage.getItem("chatSessions");
    return stored ? JSON.parse(stored) : [];
  });
  const [expandedSession, setExpandedSession] = useState<string | null>(null);
  const [url, setUrl]               = useState("");
  const [status, setStatus]         = useState<string | null>(null);

  const [responseFormat, setResponseFormat] = useState<"concise" | "detailed" | "bullet">("detailed");

  const [chatHistory, setChatHistory] = useState<{
    question: string;
    answer: string;
    suggestions: string[];
    widgetType: "linkScanner" | "quiz" | "stepByStep" | null;
    widgetData: any;
    feedback: "up" | "down" | null;
    media?: Media;
    format?: "concise" | "detailed" | "bullet";
    isAI?: boolean;
  }[]>([]);

  // LLM message history for multi-turn context
  const llmHistory = useRef<{ role: "user" | "assistant"; content: string }[]>([]);

  const [darkMode, _setDarkMode] = useState<boolean>(() => {
    const saved = localStorage.getItem("darkMode");
    return saved ? JSON.parse(saved) : false;
  });
  const chatEndRef = useRef<HTMLDivElement>(null);
  const isInitialLoad = useRef(true);

  // Load/save chat history
  useEffect(() => {
    const saved = localStorage.getItem("chatHistory");
    if (saved) {
      setChatHistory(JSON.parse(saved));
    }
    // Mark initial load done after first render cycle
    requestAnimationFrame(() => { isInitialLoad.current = false; });
  }, []);
  useEffect(() => { localStorage.setItem("chatHistory",  JSON.stringify(chatHistory));  }, [chatHistory]);
  useEffect(() => { localStorage.setItem("chatSessions", JSON.stringify(chatSessions)); }, [chatSessions]);
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [chatHistory, loading]);
  useEffect(() => { localStorage.setItem("darkMode", JSON.stringify(darkMode)); }, [darkMode]);

  // Sync llmHistory ref from chatHistory on mount
  useEffect(() => {
    llmHistory.current = chatHistory.flatMap(item => [
      { role: "user" as const, content: item.question },
      { role: "assistant" as const, content: item.answer },
    ]);
  }, []);

  // Fetch user security context when AI mode is on
  useEffect(() => {
    if (!useAI) return;
    const token = localStorage.getItem("token");
    if (!token) return;
    setContextLoading(true);
    fetchUserSecurityContext()
      .then(ctx => setSecurityContext(ctx))
      .finally(() => setContextLoading(false));
  }, [useAI]);


  /** Convert single \n to markdown hard breaks; preserve existing \n\n paragraph gaps */
  const normalizeMarkdown = (text: string): string =>
    text.replace(/(?<!\n)\n(?!\n)/g, "  \n");

  const getRichMedia = (message: string): Media | null => {
    const key = Object.keys(mediaLibrary).find((term) =>
      message.toLowerCase().includes(term.toLowerCase())
    );
    if (!key) return null;
    const media = mediaLibrary[key as MediaKey];
    if (media.type === "image") return { type: "image", src: media.src, caption: media.caption };
    if (media.type === "table") return { type: "table", headers: media.headers as readonly string[], rows: media.rows as readonly (readonly string[])[] };
    return null;
  };

  // ── Ask bot ──────────────────────────────────
  const askBot = async (customQuestion?: string) => {
    const finalQuestion = (customQuestion || question).trim();
    if (!finalQuestion) return;

    setQuestion("");
    setLoading(true);

    // Add placeholder message immediately — user sees the bubble right away
    setChatHistory(prev => [...prev, {
      question: finalQuestion, answer: "", suggestions: [],
      widgetType: null, widgetData: {}, feedback: null,
      format: responseFormat, isAI: useAI,
    }]);

    try {
      if (useAI) {
        let fullAnswer = "";

        const { suggestions } = await streamAnswer(
          finalQuestion, responseFormat, securityContext,
          (token) => {
            fullAnswer += token;
            setChatHistory(prev => {
              const next = [...prev];
              next[next.length - 1] = { ...next[next.length - 1], answer: fullAnswer };
              return next;
            });
          }
        );

        const media = getRichMedia(fullAnswer);
        setChatHistory(prev => {
          const next = [...prev];
          next[next.length - 1] = { ...next[next.length - 1], suggestions, media: media || undefined };
          return next;
        });
        llmHistory.current = [
          ...llmHistory.current,
          { role: "user", content: finalQuestion },
          { role: "assistant", content: fullAnswer },
        ];
      } else {
        const res = await axios.post(`${API_BASE_URL}/ask`, {
          userQuestion: finalQuestion, userLevel: "Beginner", format: responseFormat,
        });
        const media = getRichMedia(res.data.answer || "");
        setChatHistory(prev => {
          const next = [...prev];
          next[next.length - 1] = {
            ...next[next.length - 1],
            answer: res.data.answer || "",
            suggestions: res.data.suggestions || [],
            widgetType: res.data.widgetType || null,
            widgetData: res.data.widgetData || {},
            media: media || undefined,
          };
          return next;
        });
      }
    } catch (error: any) {
      console.error("Error asking bot:", error);
      const fallback = error?.response?.data?.response;
      setChatHistory(prev => {
        const next = [...prev];
        next[next.length - 1] = {
          ...next[next.length - 1],
          answer: fallback?.answer || "Sorry, something went wrong. Please try again.",
          suggestions: fallback?.suggestions || [],
        };
        return next;
      });
    } finally {
      setLoading(false);
    }
  };

  /** Simple heuristic to generate follow-up suggestions */
  const generateSuggestions = (q: string, a: string): string[] => {
    const lower = (q + " " + a).toLowerCase();
    const suggestions: string[] = [];
    if (lower.includes("password"))    suggestions.push("How do I use a password manager?");
    if (lower.includes("phishing"))    suggestions.push("How do I report a phishing email?");
    if (lower.includes("breach"))      suggestions.push("What should I do after a data breach?");
    if (lower.includes("score"))       suggestions.push("How can I improve my security score?");
    if (lower.includes("brute force")) suggestions.push("How do I prevent brute force attacks?");
    if (suggestions.length === 0)      suggestions.push("What are the most common cyber threats?", "How do I stay safe online?");
    return suggestions.slice(0, 2);
  };

  // ── Feedback ─────────────────────────────────
  const handleFeedback = async (answer: string, type: "up" | "down") => {
    setFeedbackMap((prev) => ({ ...prev, [answer]: prev[answer] === type ? null : type }));
    if (type === "up") setPositiveCount((prev) => ({ ...prev, [answer]: (prev[answer] || 0) + 1 }));
    else setNegativeCount((prev) => ({ ...prev, [answer]: (prev[answer] || 0) + 1 }));
    setThankYouMap((prev) => ({ ...prev, [answer]: true }));
    setTimeout(() => setThankYouMap((prev) => ({ ...prev, [answer]: false })), 3000);
    try {
      await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answer, feedback: type }),
      });
    } catch {}
  };

  const handleSave = (message: string) => {
    setSavedMessages((prev) => {
      const updated = prev.includes(message) ? prev.filter((m) => m !== message) : [...prev, message];
      localStorage.setItem("savedMessages", JSON.stringify(updated));
      return updated;
    });
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); askBot(); }
  };

  const startNewChat = () => {
    if (chatHistory.length === 0) return;
    const session: ChatSession = {
      id: Date.now().toString(),
      startedAt: new Date().toISOString(),
      messages: chatHistory,
    };
    setChatSessions(prev => [session, ...prev]);
    setChatHistory([]);
    llmHistory.current = [];
    setShowHistory(false);
  };

  // ── Widgets (unchanged) ──────────────────────
  const steps = useMemo(() => {
    const lastStepItem = [...chatHistory].reverse().find((i) => i.widgetType === "stepByStep");
    return lastStepItem?.widgetData?.steps || ["Identify the suspicious email.", "Do not click on any links.", "Report it to your IT department."];
  }, [chatHistory]);

  const StepByStepWidget = ({ steps }: { steps: string[] }) => {
    const [currentStep, setCurrentStep] = useState(0);
    if (!steps?.length) return null;
    return (
      <div className="p-3 border rounded-lg bg-gray-100 dark:bg-gray-800">
        <div className="font-semibold mb-2">🧭 Step {currentStep + 1} of {steps.length}</div>
        <p className="text-sm mb-3">{steps[currentStep]}</p>
        <div className="flex justify-between">
          <button onClick={() => setCurrentStep((p) => Math.max(p - 1, 0))} disabled={currentStep === 0} className={`px-3 py-1 rounded ${currentStep === 0 ? "bg-gray-400 cursor-not-allowed" : "bg-gray-300 hover:bg-gray-400"}`}>◀ Previous</button>
          <button onClick={() => setCurrentStep((p) => Math.min(p + 1, steps.length - 1))} disabled={currentStep === steps.length - 1} className={`px-3 py-1 rounded ${currentStep === steps.length - 1 ? "bg-gray-400 cursor-not-allowed" : "bg-blue-600 text-white hover:bg-blue-700"}`}>Next ▶</button>
        </div>
      </div>
    );
  };

  const LinkScannerWidget = () => {
    const scanUrl = () => setStatus(url.includes("phishing") ? "⚠️ Suspicious link detected!" : "✅ Safe link detected.");
    return (
      <div className="p-3 border rounded-lg bg-gray-100">
        <input type="text" placeholder="Enter URL to scan..." value={url} onChange={(e) => setUrl(e.target.value)} className="w-full p-2 border rounded mb-2" />
        <button onClick={scanUrl} className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700">Scan</button>
        {status && <div className="mt-2 font-semibold">{status}</div>}
      </div>
    );
  };

  const QuizWidget = ({ question, options }: { question: string; options: string[] }) => {
    const [selected, setSelected] = useState<string | null>(null);
    return (
      <div className="p-3 border rounded-lg bg-gray-100">
        <div className="font-semibold mb-2">{question}</div>
        {options.map((opt, i) => (
          <button key={i} onClick={() => setSelected(opt)} className={`block w-full text-left px-3 py-1 rounded mb-1 ${selected === opt ? "bg-blue-600 text-white" : "bg-gray-200 hover:bg-blue-200"}`}>{opt}</button>
        ))}
        {selected && <div className="mt-2 text-sm">You selected: {selected}</div>}
      </div>
    );
  };


  // ─────────────────────────────────────────────
  //  RENDER
  // ─────────────────────────────────────────────
  return (
    <div className={`flex flex-col h-full transition-colors duration-300 ${darkMode ? "bg-gray-900 text-gray-100" : "bg-white text-gray-800"}`}>

      {/* ── Top bar ── */}
      <div className={`flex justify-between items-center p-2 border-b gap-2 ${darkMode ? "border-gray-700" : "border-gray-200"}`}>
        {/* AI Toggle */}
        <button
          onClick={() => setUseAI(!useAI)}
          className={`flex items-center gap-1.5 px-3 py-1 text-xs font-bold rounded-full transition ${
            useAI ? "bg-gradient-to-r from-indigo-600 to-violet-600 text-white" : (darkMode ? "bg-gray-700 text-gray-300" : "bg-gray-200 text-gray-600")
          }`}
        >
          <Brain className="w-3 h-3" />
          {useAI ? "AI Mode: ON" : "AI Mode: OFF"}
        </button>

        <div className="flex items-center gap-1.5 ml-auto">
          <button
            onClick={() => { setShowHistory(!showHistory); setShowSaved(false); }}
            className={`px-3 py-1 text-xs font-medium rounded transition ${showHistory ? (darkMode ? "bg-indigo-700 text-white" : "bg-indigo-100 text-indigo-700") : (darkMode ? "bg-gray-700 hover:bg-gray-600 text-gray-100" : "bg-gray-200 hover:bg-gray-300 text-gray-800")}`}
          >
            🕒 History{chatSessions.length > 0 && <span className="ml-1 bg-indigo-500 text-white text-[10px] px-1.5 py-0.5 rounded-full">{chatSessions.length}</span>}
          </button>
          <button
            onClick={() => { setShowSaved(!showSaved); setShowHistory(false); }}
            className={`px-3 py-1 text-xs font-medium rounded transition ${darkMode ? "bg-gray-700 hover:bg-blue-700 text-gray-100" : "bg-gray-200 hover:bg-blue-200 text-gray-800"}`}
          >
            {showSaved ? "📁 Hide Saved" : "⭐ Saved"}
          </button>
          <button
            onClick={startNewChat}
            disabled={chatHistory.length === 0}
            title="Save current chat and start fresh"
            className={`px-3 py-1 text-xs font-medium rounded transition ${chatHistory.length === 0 ? "opacity-40 cursor-not-allowed " : ""}${darkMode ? "bg-gray-700 hover:bg-emerald-700 text-gray-100" : "bg-gray-200 hover:bg-emerald-200 text-gray-800"}`}
          >
            + New Chat
          </button>
        </div>
      </div>

      {/* ── Security context panel (AI mode only) ── */}
      <AnimatePresence>
        {useAI && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="px-3 pt-2">
            {contextLoading ? (
              <div className={`text-xs flex items-center gap-2 p-2 rounded-xl ${darkMode ? "bg-gray-800 text-gray-400" : "bg-indigo-50 text-indigo-500"}`}>
                <Loader2 className="w-3 h-3 animate-spin" /> Loading your security context…
              </div>
            ) : securityContext ? (
              <SecurityContextPanel ctx={securityContext} darkMode={darkMode} />
            ) : (
              <div className={`text-xs p-2 rounded-xl flex items-center gap-2 ${darkMode ? "bg-gray-800 text-gray-400" : "bg-yellow-50 text-yellow-600"}`}>
                <AlertTriangle className="w-3 h-3" />
                Security context unavailable — Nick will answer based on general knowledge.
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Saved messages ── */}
      {showSaved && (
        <div className={`p-3 border-b max-h-[200px] overflow-y-auto ${darkMode ? "border-gray-700 bg-gray-800" : "border-gray-200 bg-gray-50"}`}>
          <h2 className="font-semibold text-sm mb-2">⭐ Saved Responses</h2>
          {savedMessages.length > 0 ? (
            <ul className="space-y-2">
              {savedMessages.map((msg, i) => (
                <li key={i} className={`p-2 rounded-lg text-sm ${darkMode ? "bg-gray-700" : "bg-gray-100"}`}>
                  <ReactMarkdown>{msg}</ReactMarkdown>
                </li>
              ))}
            </ul>
          ) : <p className="text-xs italic text-gray-400">No saved responses yet.</p>}
        </div>
      )}

      {/* ── Chat history panel ── */}
      {showHistory && (
        <div className={`border-b max-h-[320px] overflow-y-auto ${darkMode ? "border-gray-700 bg-gray-900" : "border-gray-200 bg-gray-50"}`}>
          <div className={`sticky top-0 flex items-center justify-between px-3 py-2 border-b ${darkMode ? "bg-gray-900 border-gray-700" : "bg-gray-50 border-gray-200"}`}>
            <span className="font-semibold text-sm">🕒 Chat History ({chatSessions.length})</span>
            {chatSessions.length > 0 && (
              <button
                onClick={() => { setChatSessions([]); setExpandedSession(null); }}
                className="text-[10px] text-red-400 hover:text-red-300 transition"
              >
                Clear all
              </button>
            )}
          </div>
          {chatSessions.length === 0 ? (
            <p className="text-xs italic text-gray-400 px-3 py-4">No saved conversations yet. Click <strong>+ New Chat</strong> to save the current one.</p>
          ) : (
            <ul className="divide-y divide-gray-700/30">
              {chatSessions.map(session => {
                const isOpen = expandedSession === session.id;
                const preview = session.messages[0]?.question ?? "Empty chat";
                const date    = new Date(session.startedAt);
                const label   = date.toLocaleDateString(undefined, { month: "short", day: "numeric" }) + " · " + date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
                return (
                  <li key={session.id}>
                    {/* Session header row */}
                    <button
                      onClick={() => setExpandedSession(isOpen ? null : session.id)}
                      className={`w-full flex items-start justify-between gap-2 px-3 py-2.5 text-left transition ${darkMode ? "hover:bg-gray-800" : "hover:bg-gray-100"}`}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold text-indigo-400 mb-0.5">{label}</p>
                        <p className={`text-xs truncate ${darkMode ? "text-gray-300" : "text-gray-700"}`}>{preview}</p>
                        <p className="text-[10px] text-gray-500 mt-0.5">{session.messages.length} message{session.messages.length !== 1 ? "s" : ""}</p>
                      </div>
                      <span className="text-gray-400 text-sm flex-shrink-0">{isOpen ? "▲" : "▼"}</span>
                    </button>

                    {/* Expanded session thread */}
                    {isOpen && (
                      <div className={`px-3 pb-3 space-y-2 ${darkMode ? "bg-gray-800/50" : "bg-white"}`}>
                        {session.messages.map((msg, mi) => (
                          <div key={mi} className="space-y-1">
                            <div className={`text-xs px-2 py-1.5 rounded-lg ${darkMode ? "bg-gray-700 text-gray-300" : "bg-gray-100 text-gray-700"}`}>
                              <span className="font-semibold text-gray-400 mr-1.5">You:</span>{msg.question}
                            </div>
                            <div className={`text-xs px-2 py-1.5 rounded-lg ${darkMode ? "bg-blue-900/50 text-blue-100" : "bg-blue-50 text-gray-700"}`}>
                              <span className="font-semibold text-indigo-400 mr-1.5">Nick:</span>
                              <ReactMarkdown components={{ p: ({ children }) => <span>{children} </span> }}>
                                {msg.answer.length > 200 ? msg.answer.slice(0, 200) + "…" : msg.answer}
                              </ReactMarkdown>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      {/* ── Format selector ── */}
      <div className="flex gap-2 px-3 py-2">
        {([["concise", "⚡ Concise"], ["detailed", "📖 Detailed"], ["bullet", "📌 Bullets"]] as const).map(([id, label]) => (
          <button
            key={id}
            onClick={() => setResponseFormat(id)}
            className={`px-2.5 py-1 text-xs rounded-full transition ${responseFormat === id ? "bg-indigo-600 text-white" : darkMode ? "bg-gray-700 text-gray-200 hover:bg-gray-600" : "bg-gray-200 text-gray-700 hover:bg-gray-300"}`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── Chat area ── */}
      <div className="flex-1 min-h-0 overflow-y-auto px-4 py-2 space-y-4">

        {/* Initial greeting */}
        {chatHistory.length === 0 && (
          <div className="flex justify-start mt-2">
            <div className="flex flex-col items-start space-y-1 max-w-[85%]">
              <div className="text-sm font-semibold text-gray-500 dark:text-gray-300">Nick (Seekurify Agent)</div>
              <div className="flex items-end space-x-2">
                <div className="w-10 h-10 overflow-hidden rounded-full shrink-0">
                  <SecurityChatbotIcon />
                </div>
                <div className={`p-3 rounded-lg text-sm ${darkMode ? "bg-blue-900 text-blue-100" : "bg-blue-50 border border-blue-100"}`}>
                  Hey there! 👋 I'm <b>Nick</b>, your AI-powered cybersecurity advisor.
                  {useAI && securityContext && (
                    <div className="mt-2 p-2 bg-white/30 rounded-lg text-xs">
                      <span className="font-bold flex items-center gap-1"><Sparkles className="w-3 h-3 text-yellow-400" /> I can see your Seekurify data!</span>
                      Ask me "Am I safe?" for a personalized assessment.
                    </div>
                  )}
                  <br />What would you like to know today?
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Chat messages */}
        {chatHistory.map((item, index) => (
          <div key={index} className="space-y-2">

            {/* User bubble */}
            <div className="flex items-start justify-end space-x-2 ml-auto">
              <div>
                <div className="text-xs text-right text-gray-500 font-semibold mb-0.5">You</div>
                <div className={`p-3 rounded-lg text-sm max-w-xs ${darkMode ? "bg-gray-800" : "bg-gray-100"}`}>{item.question}</div>
              </div>
              <motion.img whileHover={{ scale: 1.1 }} src={profileImage || defaultProfileIcon} alt="Profile" className="w-9 h-9 rounded-full border border-gray-300 shrink-0" />
            </div>

            {/* Nick bubble */}
            <div className="flex items-start space-x-2">
              <div className="flex flex-col max-w-[85%]">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 mb-0.5">
                  Nick (Seekurify Agent)
                  {item.isAI && (
                    <span className="flex items-center gap-0.5 bg-indigo-100 text-indigo-600 px-1.5 py-0.5 rounded-full text-[10px] font-bold">
                      <Brain className="w-2.5 h-2.5" /> AI
                    </span>
                  )}
                </div>
                <div className="flex items-start space-x-2">
                  <div className="w-9 h-9 overflow-hidden rounded-full shrink-0"><SecurityChatbotIcon /></div>
                  <div className={`relative p-3 rounded-lg text-sm ${darkMode ? "bg-blue-900 text-blue-100" : "bg-blue-50 border border-blue-100"}`}>
                    <div className="pr-7">
                      {index === chatHistory.length - 1 && loading && !item.answer ? (
                        <span className="flex items-center gap-1 text-xs text-gray-400">
                          <Loader2 className="w-3 h-3 animate-spin" /> Thinking…
                        </span>
                      ) : (
                        <>
                          <ReactMarkdown components={{
                            p:      ({ children }) => <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>,
                            h1:     ({ children }) => <h1 className="text-base font-bold mt-3 mb-1">{children}</h1>,
                            h2:     ({ children }) => <h2 className="text-sm font-bold mt-3 mb-1">{children}</h2>,
                            h3:     ({ children }) => <h3 className="text-sm font-semibold mt-2 mb-1">{children}</h3>,
                            strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
                            em:     ({ children }) => <em className="italic">{children}</em>,
                            ul:     ({ children }) => <ul className="list-none p-0 my-1 space-y-1">{children}</ul>,
                            ol:     ({ children }) => <ol className="list-decimal pl-4 my-1 space-y-1">{children}</ol>,
                            li:     ({ children }) => <li className="flex items-start gap-1.5"><span className="text-blue-500 mt-0.5 shrink-0">•</span><span className="flex-1">{children}</span></li>,
                            code:   ({ children }) => <code className={`px-1 py-0.5 rounded text-xs font-mono ${darkMode ? "bg-blue-950 text-blue-200" : "bg-blue-100 text-blue-800"}`}>{children}</code>,
                            blockquote: ({ children }) => <blockquote className={`border-l-2 pl-3 my-2 italic ${darkMode ? "border-blue-500 text-blue-300" : "border-blue-300 text-gray-600"}`}>{children}</blockquote>,
                          }}>
                            {normalizeMarkdown(item.answer)}
                          </ReactMarkdown>

                          {/* Rich media */}
                          {item.media?.type === "image" && item.media.src && (
                            <div className="flex flex-col items-center mt-3">
                              <img src={item.media.src} alt={item.media.caption || ""} className="rounded-xl shadow max-w-xs mb-1" onError={(e) => { e.currentTarget.style.display = "none"; }} />
                              {item.media.caption && <p className="text-xs italic text-gray-500">{item.media.caption}</p>}
                            </div>
                          )}
                          {item.media?.type === "table" && item.media.headers && item.media.rows && (
                            <table className="mt-3 border border-gray-300 rounded text-xs">
                              <thead className="bg-indigo-100"><tr>{item.media.headers.map((h, i) => <th key={i} className="px-3 py-1.5 border">{h}</th>)}</tr></thead>
                              <tbody>{item.media.rows.map((row, ri) => <tr key={ri}>{row.map((cell, ci) => <td key={ci} className="px-3 py-1.5 border">{cell}</td>)}</tr>)}</tbody>
                            </table>
                          )}
                        </>
                      )}
                      {/* Blinking cursor while streaming */}
                      {index === chatHistory.length - 1 && loading && item.answer && (
                        <span className="inline-block w-[2px] h-[14px] bg-current align-middle ml-0.5 animate-pulse" />
                      )}
                    </div>

                    {/* Save button */}
                    <button onClick={() => handleSave(item.answer)} className={`absolute top-2 right-2 text-xl transition ${savedMessages.includes(item.answer) ? "text-yellow-400" : "text-gray-300 hover:text-yellow-400"}`}>★</button>

                    {/* Feedback */}
                    <div className="flex items-center gap-2 mt-2 text-base">
                      <button onClick={() => handleFeedback(item.answer, "up")} className={`transition hover:scale-110 ${feedback[item.answer] === "up" ? "text-green-400" : "text-gray-300 hover:text-green-400"}`}>👍</button>
                      <button onClick={() => handleFeedback(item.answer, "down")} className={`transition hover:scale-110 ${feedback[item.answer] === "down" ? "text-red-400" : "text-gray-300 hover:text-red-400"}`}>👎</button>
                      {thankYouMap[item.answer] && <span className="text-xs text-gray-400 italic">Thanks!</span>}
                    </div>

                    {/* Widgets */}
                    {item.widgetType === "linkScanner"  && <LinkScannerWidget />}
                    {item.widgetType === "quiz"          && <QuizWidget question={item.widgetData?.question || "Which looks suspicious?"} options={item.widgetData?.options || ["support@paypal.com", "help@paypa1.com"]} />}
                    {item.widgetType === "stepByStep"    && <StepByStepWidget steps={steps} />}

                    {/* Suggestions */}
                    {item.suggestions?.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {item.suggestions.map((s, i) => (
                          <button key={i} onClick={() => askBot(s)} className={`px-2.5 py-1 text-xs rounded-full transition ${darkMode ? "bg-gray-700 hover:bg-indigo-700 text-gray-100" : "bg-white border border-blue-200 hover:bg-blue-100 text-blue-700"}`}>{s}</button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}

        {/* Typing indicator */}
        {loading && (
          <div className="flex items-start space-x-2">
            <div className="w-9 h-9 overflow-hidden rounded-full shrink-0"><SecurityChatbotIcon /></div>
            <div className={`p-3 rounded-lg flex items-center space-x-1 ${darkMode ? "bg-blue-900" : "bg-blue-50 border border-blue-100"}`}>
              <span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce"></span>
              <span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: "0.15s" }}></span>
              <span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: "0.3s" }}></span>
            </div>
          </div>
        )}

        <div ref={chatEndRef} />
      </div>

      {/* ── Predefined questions ── */}
      <div className={`flex flex-wrap gap-1.5 px-3 py-2 border-t ${darkMode ? "border-gray-700 bg-gray-800" : "border-gray-200 bg-gray-50"}`}>
        {predefinedQuestions.map((q, i) => (
          <button key={i} onClick={() => askBot(q)} className={`px-2.5 py-1 text-xs rounded-full transition ${darkMode ? "bg-gray-700 hover:bg-indigo-700 text-gray-100" : "bg-white border border-gray-200 hover:bg-indigo-100 text-gray-700"}`}>
            {q}
          </button>
        ))}
      </div>

      {/* ── Input ── */}
      <div className={`p-3 border-t ${darkMode ? "border-gray-700 bg-gray-800" : "border-gray-200 bg-white"}`}>
        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
          <textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={handleKeyPress}
            placeholder={useAI ? "Ask Nick anything about your security…" : "Type your message here..."}
            className={`flex-1 p-2 border rounded focus:outline-none focus:ring focus:border-indigo-400 resize-none text-sm ${darkMode ? "bg-gray-900 border-gray-700 text-gray-100" : "bg-white border-gray-200 text-gray-900"}`}
            rows={2}
          />
          <button
            onClick={() => askBot()}
            disabled={loading || !question.trim()}
            className={`px-4 py-2 rounded transition text-sm font-bold w-full sm:w-auto ${
              loading || !question.trim()
                ? "bg-gray-300 cursor-not-allowed text-gray-500"
                : useAI
                ? "bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white"
                : "bg-blue-600 hover:bg-blue-700 text-white"
            }`}
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : "Send"}
          </button>
        </div>
        {useAI && (
          <p className="text-[10px] text-gray-400 mt-1 flex items-center gap-1">
            <Brain className="w-3 h-3 text-indigo-400" /> Powered by Claude AI · Context-aware responses
          </p>
        )}
      </div>
    </div>
  );
};

export default BotChat;
