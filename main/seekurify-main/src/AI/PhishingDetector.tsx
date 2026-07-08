// ============================================================
// Seekurify — Phishing Detection UI Component
// File: components/PhishingDetector.tsx
// ============================================================

import { useState } from "react";

interface PhishingIndicator {
  type: string;
  description: string;
  severity: "low" | "medium" | "high" | "critical";
}

interface PhishingResult {
  phishingProbability: number;
  verdict: "safe" | "suspicious" | "phishing";
  confidenceLevel: "low" | "medium" | "high";
  indicators: PhishingIndicator[];
  senderAnalysis: {
    displayNameMismatch: boolean;
    domainReputation: string;
    spoofingDetected: boolean;
  };
  urlAnalysis: {
    suspiciousUrls: string[];
    typosquattingDetected: boolean;
  };
  explanation: string;
  recommendations: string[];
}

const severityColors = {
  low: "bg-yellow-100 text-yellow-800 border-yellow-200",
  medium: "bg-orange-100 text-orange-800 border-orange-200",
  high: "bg-red-100 text-red-800 border-red-200",
  critical: "bg-red-200 text-red-900 border-red-400",
};

const verdictConfig = {
  safe: {
    color: "text-green-600",
    bg: "bg-green-50 border-green-200",
    icon: "✅",
    label: "Safe",
  },
  suspicious: {
    color: "text-orange-600",
    bg: "bg-orange-50 border-orange-200",
    icon: "⚠️",
    label: "Suspicious",
  },
  phishing: {
    color: "text-red-600",
    bg: "bg-red-50 border-red-200",
    icon: "🚨",
    label: "Phishing Detected",
  },
};

export default function PhishingDetector() {
  const [form, setForm] = useState({
    senderDisplayName: "",
    senderEmail: "",
    emailSubject: "",
    emailHeader: "",
    emailBody: "",
    urls: "",
  });
  const [result, setResult] = useState<PhishingResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAnalyze = async () => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const payload = {
        senderDisplayName: form.senderDisplayName || undefined,
        senderEmail: form.senderEmail || undefined,
        emailSubject: form.emailSubject || undefined,
        emailHeader: form.emailHeader || undefined,
        emailBody: form.emailBody || undefined,
        urls: form.urls
          ? form.urls.split("\n").map((u) => u.trim()).filter(Boolean)
          : undefined,
      };

      const res = await fetch("/api/ai/phishing/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Analysis failed");
      setResult(data.data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const probColor =
    result?.phishingProbability != null
      ? result.phishingProbability >= 70
        ? "text-red-600"
        : result.phishingProbability >= 40
        ? "text-orange-500"
        : "text-green-600"
      : "";

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900">
          AI Phishing Detector
        </h2>
        <p className="text-gray-500 text-sm mt-1">
          Paste any combination of email fields below. The AI will analyze all
          provided data together.
        </p>
      </div>

      {/* Input Form */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4 shadow-sm">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Sender Display Name
            </label>
            <input
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder='e.g. "PayPal Support"'
              value={form.senderDisplayName}
              onChange={(e) =>
                setForm({ ...form, senderDisplayName: e.target.value })
              }
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Sender Email
            </label>
            <input
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g. support@paypa1.com"
              value={form.senderEmail}
              onChange={(e) =>
                setForm({ ...form, senderEmail: e.target.value })
              }
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Email Subject
          </label>
          <input
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="e.g. Urgent: Your account has been suspended"
            value={form.emailSubject}
            onChange={(e) =>
              setForm({ ...form, emailSubject: e.target.value })
            }
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Email Body
          </label>
          <textarea
            rows={5}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Paste the full email body here..."
            value={form.emailBody}
            onChange={(e) => setForm({ ...form, emailBody: e.target.value })}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            URLs Found in Email{" "}
            <span className="text-gray-400">(one per line)</span>
          </label>
          <textarea
            rows={3}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="https://suspicious-link.com/login"
            value={form.urls}
            onChange={(e) => setForm({ ...form, urls: e.target.value })}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Email Headers{" "}
            <span className="text-gray-400">(optional, raw headers)</span>
          </label>
          <textarea
            rows={3}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Received: from mail.example.com..."
            value={form.emailHeader}
            onChange={(e) =>
              setForm({ ...form, emailHeader: e.target.value })
            }
          />
        </div>

        <button
          onClick={handleAnalyze}
          disabled={loading}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-semibold py-2.5 rounded-lg transition-colors"
        >
          {loading ? "Analyzing with AI..." : "Analyze Email"}
        </button>

        {error && (
          <p className="text-red-600 text-sm bg-red-50 p-3 rounded-lg">
            {error}
          </p>
        )}
      </div>

      {/* Results */}
      {result && (
        <div className="space-y-4">
          {/* Verdict Banner */}
          <div
            className={`rounded-xl border-2 p-5 ${verdictConfig[result.verdict].bg}`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-3xl">
                  {verdictConfig[result.verdict].icon}
                </span>
                <div>
                  <p
                    className={`text-xl font-bold ${verdictConfig[result.verdict].color}`}
                  >
                    {verdictConfig[result.verdict].label}
                  </p>
                  <p className="text-sm text-gray-500">
                    Confidence: {result.confidenceLevel}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className={`text-4xl font-black ${probColor}`}>
                  {result.phishingProbability}%
                </p>
                <p className="text-xs text-gray-500">Phishing Probability</p>
              </div>
            </div>

            {/* Probability Bar */}
            <div className="mt-4 h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  result.phishingProbability >= 70
                    ? "bg-red-500"
                    : result.phishingProbability >= 40
                    ? "bg-orange-400"
                    : "bg-green-500"
                }`}
                style={{ width: `${result.phishingProbability}%` }}
              />
            </div>
          </div>

          {/* Plain English Explanation */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
            <p className="text-sm font-semibold text-blue-800 mb-1">
              💡 What this means
            </p>
            <p className="text-sm text-blue-700">{result.explanation}</p>
          </div>

          {/* Indicators */}
          {result.indicators.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
              <h3 className="font-semibold text-gray-900 mb-3">
                Threat Indicators ({result.indicators.length})
              </h3>
              <div className="space-y-2">
                {result.indicators.map((ind, i) => (
                  <div
                    key={i}
                    className={`rounded-lg border px-3 py-2 text-sm ${severityColors[ind.severity]}`}
                  >
                    <span className="font-semibold uppercase text-xs tracking-wide">
                      {ind.severity} · {ind.type}
                    </span>
                    <p className="mt-0.5">{ind.description}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Sender + URL Analysis */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
              <h3 className="font-semibold text-gray-900 mb-2 text-sm">
                Sender Analysis
              </h3>
              <ul className="space-y-1 text-sm">
                <li className="flex justify-between">
                  <span className="text-gray-500">Display Name Mismatch</span>
                  <span
                    className={
                      result.senderAnalysis.displayNameMismatch
                        ? "text-red-600 font-medium"
                        : "text-green-600"
                    }
                  >
                    {result.senderAnalysis.displayNameMismatch ? "Yes ⚠️" : "No ✅"}
                  </span>
                </li>
                <li className="flex justify-between">
                  <span className="text-gray-500">Spoofing Detected</span>
                  <span
                    className={
                      result.senderAnalysis.spoofingDetected
                        ? "text-red-600 font-medium"
                        : "text-green-600"
                    }
                  >
                    {result.senderAnalysis.spoofingDetected ? "Yes ⚠️" : "No ✅"}
                  </span>
                </li>
                <li className="flex justify-between">
                  <span className="text-gray-500">Domain Reputation</span>
                  <span className="capitalize font-medium">
                    {result.senderAnalysis.domainReputation}
                  </span>
                </li>
              </ul>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
              <h3 className="font-semibold text-gray-900 mb-2 text-sm">
                URL Analysis
              </h3>
              <ul className="space-y-1 text-sm">
                <li className="flex justify-between">
                  <span className="text-gray-500">Typosquatting</span>
                  <span
                    className={
                      result.urlAnalysis.typosquattingDetected
                        ? "text-red-600 font-medium"
                        : "text-green-600"
                    }
                  >
                    {result.urlAnalysis.typosquattingDetected
                      ? "Detected ⚠️"
                      : "None ✅"}
                  </span>
                </li>
                <li className="flex justify-between">
                  <span className="text-gray-500">Suspicious URLs</span>
                  <span
                    className={
                      result.urlAnalysis.suspiciousUrls.length > 0
                        ? "text-red-600 font-medium"
                        : "text-green-600"
                    }
                  >
                    {result.urlAnalysis.suspiciousUrls.length > 0
                      ? `${result.urlAnalysis.suspiciousUrls.length} found ⚠️`
                      : "None ✅"}
                  </span>
                </li>
              </ul>
              {result.urlAnalysis.suspiciousUrls.length > 0 && (
                <div className="mt-2 space-y-1">
                  {result.urlAnalysis.suspiciousUrls.map((url, i) => (
                    <p
                      key={i}
                      className="text-xs text-red-700 bg-red-50 rounded px-2 py-1 font-mono truncate"
                    >
                      {url}
                    </p>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Recommendations */}
          {result.recommendations.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
              <h3 className="font-semibold text-gray-900 mb-3">
                Recommended Actions
              </h3>
              <ul className="space-y-2">
                {result.recommendations.map((rec, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <span className="text-blue-500 mt-0.5">→</span>
                    <span className="text-gray-700">{rec}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
