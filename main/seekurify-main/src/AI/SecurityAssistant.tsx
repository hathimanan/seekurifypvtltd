// ============================================================
// Seekurify — Context-Aware Security Assistant Chat UI
// File: components/SecurityAssistant.tsx
// ============================================================

import { useState, useRef, useEffect } from "react";

interface SuggestedAction {
  label: string;
  action: string;
  priority: "low" | "medium" | "high";
}

interface AssistantMessage {
  role: "user" | "assistant";
  content: string;
  suggestedActions?: SuggestedAction[];
  urgencyLevel?: "none" | "low" | "medium" | "high" | "critical";
  timestamp: Date;
}

interface UserSecurityContext {
  securityScore: number;
  weakPasswords: number;
  reusedPasswords: number;
  breachedEmails: string[];
  recentAlerts: any[];
  recentPhishingScans: any[];
  recentLinkScans: any[];
  loginAnomalies: any[];
  twoFactorEnabled: boolean;
  lastPasswordChange?: string;
}

const urgencyConfig = {
  none: { color: "", label: "" },
  low: { color: "text-yellow-600", label: "⚠️ Low concern" },
  medium: { color: "text-orange-600", label: "⚠️ Attention needed" },
  high: { color: "text-red-600", label: "🔴 Urgent" },
  critical: { color: "text-red-700", label: "🚨 Critical" },
};

const actionPriorityColors = {
  low: "border-gray-300 text-gray-700 hover:bg-gray-50",
  medium: "border-orange-300 text-orange-700 hover:bg-orange-50",
  high: "border-red-400 text-red-700 hover:bg-red-50",
};

const QUICK_PROMPTS = [
  "Am I safe right now?",
  "What should I do first to improve my security?",
  "Explain my recent security alerts",
  "How strong are my passwords?",
  "What is phishing and how do I avoid it?",
];

interface Props {
  userContext: UserSecurityContext;
  sessionId: string;
  onActionClick?: (action: string, targetId?: string) => void;
}

export default function SecurityAssistant({
  userContext,
  sessionId,
  onActionClick,
}: Props) {
  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async (text: string) => {
    if (!text.trim()) return;

    const userMsg: AssistantMessage = {
      role: "user",
      content: text.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/ai/assistant/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text.trim(),
          sessionId,
          userContext,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to get response");

      const assistantMsg: AssistantMessage = {
        role: "assistant",
        content: data.data.message,
        suggestedActions: data.data.suggestedActions,
        urgencyLevel: data.data.urgencyLevel,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Sorry, I couldn't process that. Please try again.",
          timestamp: new Date(),
          urgencyLevel: "none",
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const loadSummary = async () => {
    setSummaryLoading(true);
    try {
      const res = await fetch("/api/ai/assistant/summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userContext }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      const msg: AssistantMessage = {
        role: "assistant",
        content: data.data.message,
        suggestedActions: data.data.suggestedActions,
        urgencyLevel: data.data.urgencyLevel,
        timestamp: new Date(),
      };

      setMessages([msg]);
    } catch {
      /* silently fail */
    } finally {
      setSummaryLoading(false);
    }
  };

  const clearSession = async () => {
    await fetch(`/api/ai/assistant/session/${sessionId}`, {
      method: "DELETE",
    });
    setMessages([]);
  };

  return (
    <div className="flex flex-col h-full max-h-screen bg-gray-50 rounded-xl border border-gray-200 overflow-hidden shadow-sm">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-5 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-blue-600 flex items-center justify-center text-white text-lg">
            🛡️
          </div>
          <div>
            <p className="font-semibold text-gray-900 text-sm">
              Seekurify AI Assistant
            </p>
            <p className="text-xs text-gray-400">
              Knows your security context · Security Score:{" "}
              <span
                className={
                  userContext.securityScore >= 70
                    ? "text-green-600 font-semibold"
                    : userContext.securityScore >= 40
                    ? "text-orange-500 font-semibold"
                    : "text-red-600 font-semibold"
                }
              >
                {userContext.securityScore}/100
              </span>
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={loadSummary}
            disabled={summaryLoading}
            className="text-xs text-blue-600 hover:text-blue-800 border border-blue-200 rounded-lg px-3 py-1.5 disabled:opacity-50 transition-colors"
          >
            {summaryLoading ? "Loading..." : "Security Summary"}
          </button>
          {messages.length > 0 && (
            <button
              onClick={clearSession}
              className="text-xs text-gray-400 hover:text-gray-600 border border-gray-200 rounded-lg px-3 py-1.5 transition-colors"
            >
              Clear Chat
            </button>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center py-10">
            <div className="text-5xl mb-3">🛡️</div>
            <p className="text-gray-600 font-medium">
              Your AI Security Assistant
            </p>
            <p className="text-gray-400 text-sm mt-1 mb-6">
              I know your security history. Ask me anything.
            </p>
            <div className="flex flex-wrap gap-2 justify-center max-w-md mx-auto">
              {QUICK_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  onClick={() => sendMessage(prompt)}
                  className="text-xs bg-white border border-gray-200 text-gray-600 hover:border-blue-300 hover:text-blue-600 rounded-full px-3 py-1.5 transition-colors"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[80%] ${msg.role === "user" ? "order-2" : "order-1"}`}
            >
              {/* Message Bubble */}
              <div
                className={`rounded-2xl px-4 py-3 text-sm ${
                  msg.role === "user"
                    ? "bg-blue-600 text-white rounded-br-sm"
                    : "bg-white border border-gray-200 text-gray-800 rounded-bl-sm shadow-sm"
                }`}
              >
                {/* Urgency indicator for assistant */}
                {msg.role === "assistant" &&
                  msg.urgencyLevel &&
                  msg.urgencyLevel !== "none" && (
                    <p
                      className={`text-xs font-semibold mb-2 ${urgencyConfig[msg.urgencyLevel].color}`}
                    >
                      {urgencyConfig[msg.urgencyLevel].label}
                    </p>
                  )}
                <p className="whitespace-pre-wrap leading-relaxed">
                  {msg.content}
                </p>
              </div>

              {/* Suggested Actions */}
              {msg.role === "assistant" &&
                msg.suggestedActions &&
                msg.suggestedActions.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {msg.suggestedActions.map((action, j) => (
                      <button
                        key={j}
                        onClick={() =>
                          onActionClick?.(action.action, action.targetId)
                        }
                        className={`text-xs border rounded-lg px-3 py-1.5 font-medium transition-colors ${actionPriorityColors[action.priority]}`}
                      >
                        {action.label}
                      </button>
                    ))}
                  </div>
                )}

              {/* Timestamp */}
              <p className="text-xs text-gray-400 mt-1 px-1">
                {msg.timestamp.toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            </div>
          </div>
        ))}

        {/* Loading indicator */}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-white border border-gray-200 rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm">
              <div className="flex gap-1 items-center h-4">
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Quick prompts (shown after first message) */}
      {messages.length > 0 && messages.length < 4 && (
        <div className="px-4 pb-2 flex gap-2 overflow-x-auto">
          {QUICK_PROMPTS.slice(0, 3).map((prompt) => (
            <button
              key={prompt}
              onClick={() => sendMessage(prompt)}
              disabled={loading}
              className="text-xs whitespace-nowrap bg-white border border-gray-200 text-gray-600 hover:border-blue-300 hover:text-blue-600 rounded-full px-3 py-1.5 transition-colors disabled:opacity-50"
            >
              {prompt}
            </button>
          ))}
        </div>
      )}

      {/* Input Area */}
      <div className="bg-white border-t border-gray-200 px-4 py-3">
        <div className="flex gap-2 items-end">
          <textarea
            rows={1}
            className="flex-1 resize-none rounded-xl border border-gray-300 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 max-h-32"
            placeholder="Ask about your security..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                sendMessage(input);
              }
            }}
          />
          <button
            onClick={() => sendMessage(input)}
            disabled={loading || !input.trim()}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors"
          >
            Send
          </button>
        </div>
        <p className="text-xs text-gray-400 mt-1.5 px-1">
          Press Enter to send · Shift+Enter for new line
        </p>
      </div>
    </div>
  );
}
