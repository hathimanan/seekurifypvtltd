import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Graph from "./Graph";
import Header from "../components/ui/Header";
import Footer from "../components/ui/Footer";
import { ArrowLeft, BarChart3, FileSearch, KeyRound, Phone, ShieldAlert, ShieldCheck,
  Zap, Bot, Database, ScanSearch, AlertTriangle, CheckCircle, Activity, TrendingUp } from "lucide-react";
import { API_BASE_URL } from "../services/api";
import { Button } from "./ui/button";
import { useAuth } from "../context/AuthContext";
import { Logo } from "./ui/logo";
import { motion } from "framer-motion";
import AppSidebar from "./ui/AppSidebar";
interface EventData {
  date: string;
  count: number;
  intervalStart?: string;
  category?: string;
  value: number;
  intervalend?: string;
}
interface passwordHealth {
  date: string;
  category: string;
  count: number;
}

interface DeviceInfo {
  deviceId: string;
  userId: string;
  success: boolean;
  deviceType: string;
  browser: string;
  os: string;
  lastLogin: string;
  ipAddress: string;
  location?: string;
  status: 'active' | 'inactive';
}

type ModalState = "none" | "pay" | "trial" | "onlyPay" | "verifyPin" | "reVerifyPin" | null;

const SystemEventsPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  // ---------- User & PIN ----------
  const [pinInput, setPinInput] = useState("");
  const [pinVerified, setPinVerified] = useState(false);
  const [pinError, setPinError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [infoMessage, setInfoMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [loading, setLoading] = useState(false);
  // ---------- Modal State ----------
  const [currentModal, setCurrentModal] = useState<ModalState>("none");

  // ---------- Dashboard Data ----------
  const [loginEvents, setLoginEvents] = useState<EventData[]>([]);
  const [passwordChanges, setPasswordChanges] = useState<EventData[]>([]);
  const [invalidLogins, setInvalidLogins] = useState<EventData[]>([]);
  const [passwordHealth, setPasswordHealth] = useState<passwordHealth[]>([]);
  const [profileImage, setProfileImage] = useState("");
  const [error, setError] = useState("");
  const [sidebarExpanded, setSidebarExpanded] = useState(true);
  const [deviceInfo, setDeviceInfo] = useState<DeviceInfo[]>([]);
const [pinVerificationSIEMEnabled, setPinVerificationSIEMEnabled] = useState<boolean | null>(null);
 const [phishingDetectorEnabled, setPhishingDetectorEnabled] = useState<boolean>(false);
  const [featuresLoaded, setFeaturesLoaded] = useState(false);

  // ---------- LLM SIEM ----------
  type LLMRisk = "safe" | "low" | "medium" | "high" | "critical";
  interface LLMEvent {
    _id: string; type: string; typeLabel: string; icon: string;
    riskLevel: LLMRisk; score: number; summary: string;
    findingCount: number | null; timestamp: string;
  }
  interface LLMStats {
    total: number;
    byType: { injection: number; exfil: number; rag: number; pii: number; finding: number; incident: number; [k: string]: number };
    byRisk: Record<string, number>;
    trend: { date: string; count: number }[];
    topThreatType: string | null;
  }
  const [llmEvents, setLlmEvents]       = useState<LLMEvent[]>([]);
  const [llmStats, setLlmStats]         = useState<LLMStats | null>(null);
  const [llmLoading, setLlmLoading]     = useState(false);
  const [llmError, setLlmError]         = useState<string | null>(null);



  useEffect(() => {
      const fetchFeatureFlags = async () => {
        try {
          const res = await fetch(`${API_BASE_URL}/feature-flags/read`);
          
          if (!res.ok) {
            throw new Error('Failed to fetch feature flags');
          }
          
          const data = await res.json();
          
          console.log('✅ Header feature flags loaded:', data);
          setPhishingDetectorEnabled(data.phishingDetectorEnabled === true);
          
        } catch (err) {
          console.error("❌ Failed to load header feature flags:", err);
          setPhishingDetectorEnabled(false); // Safe default
        } finally {
          setFeaturesLoaded(true);
        }
      };
  
      fetchFeatureFlags();
    }, []);
  

// Add this useEffect BEFORE the main fetchData useEffect
useEffect(() => {
  const fetchFeatureFlags = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/feature-flags/read`);
      
      if (!res.ok) {
        throw new Error('Failed to fetch feature flags');
      }
      
      const data = await res.json();
      
      console.log('✅ SIEM Feature flags loaded:', data);
      // Default to requiring PIN unless the flag is explicitly set to false
      setPinVerificationSIEMEnabled(data.pinVerificationSIEM !== false);

    } catch (err) {
      console.error("❌ Failed to load SIEM feature flags:", err);
      setPinVerificationSIEMEnabled(true); // Require PIN on flag-fetch failure
    }
  };

  fetchFeatureFlags();
}, []); // ✅ Run once on mount

// ==========================================
// 2️⃣ Fetch Data ONLY After Feature Flags Load
// ==========================================
useEffect(() => {
  // ✅ CRITICAL: Wait for feature flag to load
  if (pinVerificationSIEMEnabled === null) {
    console.log('⏳ Waiting for SIEM feature flags to load...');
    return;
  }

  const fetchData = async () => {
    try {
      const token = localStorage.getItem("token");
      console.log('Token for devices fetch:', token);

      const [resProfile, resEvents, resDevices] = await Promise.all([
        fetch(`${API_BASE_URL}/profile`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        fetch(`${API_BASE_URL}/siem-dashboard`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        fetch(`${API_BASE_URL}/auth/devices`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` }
        }),
      ]);

      console.log('Device fetch response:', {
        status: resDevices.status,
        statusText: resDevices.statusText
      });

      if (!resDevices.ok) {
        const errorText = await resDevices.text();
        console.error('Devices fetch failed:', errorText);
        setDeviceInfo([]);
      } else {
        const deviceData = await resDevices.json();
        console.log('Device data received:', deviceData);
        setDeviceInfo(deviceData.devices || []);
      }

      if (resProfile.ok) {
        const profileData = await resProfile.json();
        if (profileData?.profileImage) setProfileImage(profileData.profileImage);
      }

      if (resEvents.ok) {
        const eventsData = await resEvents.json();
        setLoginEvents(eventsData.loginEvents || []);
        setPasswordChanges(eventsData.passwordChanges || []);
        setInvalidLogins(eventsData.invalidLogins || []);
        setPasswordHealth(eventsData.passwordHealth || []);
      } else {
        setError("Failed to load SIEM events. Please refresh.");
      }

      // ---------- Determine Modal (with Feature Flag) ----------
      console.log('🔐 SIEM Modal Decision:', {
        pinVerified,
        pinVerificationSIEMEnabled,
      });

      // ✅ Check if PIN verification is enabled for SIEM
      if (pinVerificationSIEMEnabled === true) {
        console.log('🔒 PIN verification ENABLED for SIEM');
        
        if (pinError) {
          setCurrentModal("reVerifyPin");
        } else {
          setCurrentModal("verifyPin"); // PIN required regardless of payment status
        }
      } else {
        console.log('✅ PIN verification DISABLED for SIEM, skipping PIN modal');
        setPinVerified(true); // Auto-verify
        
        setCurrentModal("none"); // Full access — no paywall on SIEM
      }

    } catch (err) {
      console.error(err);
      setCurrentModal("none"); // Don't block access on fetch errors
      setError("Failed to fetch dashboard data");
    }
  };

  fetchData();
}, [pinVerificationSIEMEnabled]);


// ---------- LLM SIEM fetch (runs once pinVerified) ----------
useEffect(() => {
  if (!pinVerified) return;
  const token = localStorage.getItem("token");
  if (!token) return;
  setLlmLoading(true);
  setLlmError(null);
  Promise.all([
    fetch(`${API_BASE_URL}/llm-siem/events`, { headers: { Authorization: `Bearer ${token}` } }),
    fetch(`${API_BASE_URL}/llm-siem/stats`,  { headers: { Authorization: `Bearer ${token}` } }),
  ])
    .then(async ([evRes, stRes]) => {
      if (!evRes.ok || !stRes.ok) throw new Error("Failed to load LLM SIEM data");
      const [evData, stData] = await Promise.all([evRes.json(), stRes.json()]);
      setLlmEvents(Array.isArray(evData) ? evData : []);
      setLlmStats(stData);
    })
    .catch(err => setLlmError(err.message))
    .finally(() => setLlmLoading(false));
}, [pinVerified]);

  // ---------- PIN Verification ----------
  const handlePinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPinError("");

    if (!/^\d{4}$/.test(pinInput)) {
      setPinError("PIN must be exactly 4 digits");
      return;
    }

    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_BASE_URL}/auth/verify-pin`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ email: user?.email, pin: pinInput }),
      });

      const data = await res.json();
      if (res.ok && data.token) {
        localStorage.setItem("token", data.token);
        setPinVerified(true);
        setCurrentModal("none");
      } else {
        setPinError("Incorrect PIN. Try again.");
      }
    } catch (err) {
      console.error(err);
      setPinError("Server error. Try again.");
    }
  };

  // ---------- Logout ----------
  const handleLogout = async () => {
    try {
      await fetch(`${API_BASE_URL}/auth/logout`, { method: "POST", credentials: "include" });
    } finally {
      localStorage.removeItem("token");
      navigate("/login");
    }
  };

  // ---------- Render ----------

if (!pinVerified && currentModal === "verifyPin" && pinVerificationSIEMEnabled === true) {
      return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-b from-gray-900 to-gray-800 px-4">
        <title>System Events Dashboard</title>
        <div className="bg-gray-800 p-8 rounded-3xl shadow-2xl w-full max-w-md flex flex-col items-center">
          {/* Seekurify Icon */}
          <Logo />

          {/* Modal Title */}
          <h2 className="text-3xl font-extrabold mb-6 text-center text-white drop-shadow-md">
            🔒 Enter PIN
          </h2>
          <form onSubmit={handlePinSubmit} className="space-y-4">
            <input
              type="email"
              value={user?.email || ""}
              disabled
              className="w-full px-3 py-2 border border-gray-300 bg-gray-100 text-gray-500 rounded-md cursor-not-allowed"
            />
            <input
              type="password"
              value={pinInput}
              onChange={(e) => setPinInput(e.target.value.replace(/\D/g, ""))}
              maxLength={4}
              placeholder="Enter PIN"
              className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 ${pinError ? 'focus:ring-red-500' : 'focus:ring-blue-500'}`}
            />
            {pinError && <p className="text-red-600 text-sm">{pinError}</p>}
            <div className="flex justify-end">
              <Button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md">
                Verify
              </Button>
            </div>
          </form>
        </div>
      </div>
    );
  }


if (!pinVerified && currentModal === "reVerifyPin" && pinVerificationSIEMEnabled === true) {
    return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-gray-900 p-6 rounded-2xl shadow-2xl w-full max-w-sm border border-red-200">

        <Logo />

        <h3 className="text-xl font-bold text-red-600 dark:text-red-400 mb-2 flex items-center gap-2">
          ⚠️ Incorrect PIN
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
          Please re-enter your PIN to confirm access.
        </p>

        <form onSubmit={handlePinSubmit} className="space-y-4">
          <input
            type="email"
            value={user?.email || ""}
            className="w-full px-3 py-2 border border-gray-300 bg-gray-100 text-gray-500 rounded-md cursor-not-allowed"
            disabled
          />

          <div>
            <input
              type="password"
              value={pinInput}
              maxLength={4}
              onChange={(e) => setPinInput(e.target.value.replace(/\D/g, ''))}
              placeholder="Enter PIN"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
            />
            {error && (
              <p className="text-sm text-red-600 mt-1">{error}</p>
            )}
          </div>

          <div className="flex justify-end gap-3">
            <Button
              type="submit"
              className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-md shadow-md transition"
            >
              Confirm
            </Button>
          </div>
        </form>
      </div>
    </div>
  );

  }
  // ---------- Dashboard ----------
  return (
    <div className="bg-gradient-to-br from-gray-900 via-black to-gray-800 min-h-screen flex flex-col text-white">
      <Header token={localStorage.getItem("token") || ""} handleLogout={handleLogout} profileImage={profileImage} />
      <title> System Events Dashboard</title>
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
           <AppSidebar sidebarExpanded={sidebarExpanded} setSidebarExpanded={setSidebarExpanded} />


        <div className="mt-6 ml-6 mb-6">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-white bg-gradient-to-r from-red-500 to-red-600 px-6 py-3 rounded-lg shadow-md hover:scale-105 transition-transform duration-200"
          >
            <ArrowLeft className="w-5 h-5" /> Back
          </button>
        </div>


        <main className="flex-grow px-6 py-4">

          <h1 className="text-3xl md:text-4xl font-extrabold mb-8 text-center bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 to-orange-600 drop-shadow-md">
            ⚡ System Event Management Dashboard ⚡
          </h1>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4">
            {/* Login Events */}
            <div className="bg-gray-800 rounded-2xl shadow-lg p-6 flex flex-col hover:scale-105 transition-transform duration-200">
              <h3 className="text-white font-semibold mb-4 text-lg flex items-center gap-2">🔑 Login Events</h3>
              <Graph
                title="Login Events"
                data={loginEvents.map(e => ({ date: e.date, value: e.count }))}
              />
            </div>

            {/* Password Changes */}
            <div className="bg-gray-800 rounded-2xl shadow-lg p-4 flex flex-col hover:scale-105 transition-transform duration-200">
              <h3 className="text-white font-semibold mb-3 text-lg flex items-center gap-2">🔄 Password Changes</h3>

              <Graph
                title="Password Changes"
                data={passwordChanges.map(e => ({ date: e.date, value: e.count }))}
              />
            </div>

            <div className="bg-gray-800 rounded-2xl shadow-lg p-6 flex flex-col hover:scale-105 transition-transform duration-200">
              <h3 className="text-white font-semibold mb-4 text-lg flex items-center gap-2">⚠️ Invalid Logins</h3>
              <Graph
                title="Invalid Logins"
                data={invalidLogins
                  .filter(e => e.intervalStart) // remove undefined/null entries
                  .map(e => ({
                    date: new Date(e.intervalStart ?? "").toLocaleString(), // fallback to ""
                    value: e.count
                  }))}
              />
            </div>

            <div className="bg-gray-800 rounded-2xl shadow-lg p-6 flex flex-col hover:scale-105 transition-transform duration-200">
              <h3 className="text-white font-semibold mb-4 text-lg flex items-center gap-2">🔐 Password Health</h3>
       <Graph
  title="Password Health"
  type="bar"
  xKey="category"
  yKey="value"
  data={passwordHealth.map(e => ({
    category: e.category,
    value: e.count
  }))}
/>


            </div>

            {/* ── LLM SIEM Panel ── */}
            <div className="col-span-2 bg-gray-800 rounded-2xl shadow-lg p-6 space-y-5">
              <h3 className="text-white font-semibold text-lg flex items-center gap-2">
                <Activity className="w-5 h-5 text-cyan-400" /> 🤖 LLM Security Events
              </h3>

              {llmLoading && (
                <p className="text-gray-400 text-sm animate-pulse">Loading LLM SIEM data…</p>
              )}
              {llmError && (
                <p className="text-red-400 text-sm">{llmError}</p>
              )}

              {llmStats && !llmLoading && (
                <>
                  {/* Stats row */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                    {[
                      { label: "Total Events",    value: llmStats.total,                                                   color: "text-cyan-300" },
                      { label: "Critical / High", value: (llmStats.byRisk.critical ?? 0) + (llmStats.byRisk.high ?? 0),   color: "text-red-400" },
                      { label: "Injection Scans", value: llmStats.byType.injection ?? 0,                                  color: "text-yellow-300" },
                      { label: "PII Detections",  value: llmStats.byType.pii ?? 0,                                        color: "text-purple-300" },
                      { label: "Findings",        value: llmStats.byType.finding ?? 0,                                    color: "text-orange-300" },
                      { label: "Incidents",       value: llmStats.byType.incident ?? 0,                                   color: "text-rose-400" },
                    ].map(({ label, value, color }) => (
                      <div key={label} className="bg-gray-700 rounded-xl p-4 text-center">
                        <div className={`text-3xl font-extrabold ${color}`}>{value}</div>
                        <div className="text-xs text-gray-400 mt-1">{label}</div>
                      </div>
                    ))}
                  </div>

                  {/* 7-day trend bar chart */}
                  <div>
                    <p className="text-xs text-gray-400 flex items-center gap-1 mb-2">
                      <TrendingUp className="w-4 h-4 text-cyan-400" /> Events — last 7 days
                    </p>
                    <div className="flex items-end gap-1 h-14">
                      {llmStats.trend.map(({ date, count }) => {
                        const maxCount = Math.max(...llmStats.trend.map(t => t.count), 1);
                        const pct = Math.max((count / maxCount) * 100, count > 0 ? 8 : 0);
                        return (
                          <div key={date} className="flex-1 flex flex-col items-center gap-1" title={`${date}: ${count}`}>
                            <div
                              className="w-full rounded-t bg-cyan-500 transition-all duration-500"
                              style={{ height: `${pct}%` }}
                            />
                            <span className="text-gray-500 text-[10px]">{date.slice(5)}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Risk breakdown pills */}
                  <div className="flex flex-wrap gap-2">
                    {[
                      { key: "critical", label: "Critical", cls: "bg-red-500/20 text-red-300 border border-red-500/40" },
                      { key: "high",     label: "High",     cls: "bg-orange-500/20 text-orange-300 border border-orange-500/40" },
                      { key: "medium",   label: "Medium",   cls: "bg-yellow-500/20 text-yellow-300 border border-yellow-500/40" },
                      { key: "low",      label: "Low",      cls: "bg-blue-500/20 text-blue-300 border border-blue-500/40" },
                      { key: "safe",     label: "Safe",     cls: "bg-green-500/20 text-green-300 border border-green-500/40" },
                    ].filter(r => (llmStats.byRisk[r.key] ?? 0) > 0).map(({ key, label, cls }) => (
                      <span key={key} className={`text-xs font-semibold px-3 py-1 rounded-full ${cls}`}>
                        {label}: {llmStats.byRisk[key]}
                      </span>
                    ))}
                    {llmStats.topThreatType && (
                      <span className="text-xs font-semibold px-3 py-1 rounded-full bg-red-900/30 text-red-300 border border-red-700/40 flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" /> Top threat: {llmStats.topThreatType}
                      </span>
                    )}
                  </div>
                </>
              )}

              {/* Event feed */}
              {!llmLoading && llmEvents.length > 0 && (
                <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                  {llmEvents.slice(0, 20).map(ev => {
                    const IconMap: Record<string, React.ReactNode> = {
                      zap:           <Zap        className="w-4 h-4 flex-shrink-0 text-yellow-400" />,
                      bot:           <Bot        className="w-4 h-4 flex-shrink-0 text-cyan-400" />,
                      database:      <Database   className="w-4 h-4 flex-shrink-0 text-purple-400" />,
                      scan:          <ScanSearch className="w-4 h-4 flex-shrink-0 text-pink-400" />,
                      'file-search': <FileSearch className="w-4 h-4 flex-shrink-0 text-orange-400" />,
                      'shield-alert':<ShieldAlert className="w-4 h-4 flex-shrink-0 text-rose-400" />,
                    };
                    const riskCls: Record<string, string> = {
                      critical: "text-red-400 border-red-600/40 bg-red-900/20",
                      high:     "text-orange-400 border-orange-600/40 bg-orange-900/20",
                      medium:   "text-yellow-400 border-yellow-600/40 bg-yellow-900/20",
                      low:      "text-blue-300 border-blue-600/40 bg-blue-900/20",
                      safe:     "text-green-400 border-green-600/40 bg-green-900/20",
                    };
                    return (
                      <motion.div
                        key={ev._id}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        className={`flex items-center gap-3 rounded-lg border px-3 py-2 ${riskCls[ev.riskLevel] ?? "text-gray-400 border-gray-600 bg-gray-700/30"}`}
                      >
                        {IconMap[ev.icon] ?? <Activity className="w-4 h-4 flex-shrink-0" />}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-bold uppercase tracking-wide">{ev.typeLabel}</span>
                            <span className="text-xs opacity-70 truncate">{ev.summary}</span>
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <div className="text-xs font-bold uppercase">{ev.riskLevel}</div>
                          <div className="text-[10px] text-gray-500">{new Date(ev.timestamp).toLocaleDateString()}</div>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}

              {!llmLoading && !llmError && llmEvents.length === 0 && (
                <div className="flex flex-col items-center py-8 text-gray-500 gap-2">
                  <CheckCircle className="w-8 h-8 text-green-500" />
                  <p className="text-sm">No LLM security events yet. Run a scan to populate this feed.</p>
                </div>
              )}
            </div>

            {/* Device Info Card - New Addition */}
            <div className="col-span-2 bg-gray-800 rounded-2xl shadow-lg p-6 hover:scale-105 transition-transform duration-200">
              <h3 className="text-white font-semibold mb-4 text-lg flex items-center gap-2">
                💻 Devices Login Info
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {deviceInfo.map((device) => (
                  <div
                    key={device.deviceId}
                    className="bg-gray-700 rounded-lg p-4 border border-gray-600"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div className="text-lg font-medium text-white">
                        {device.deviceType}
                      </div>
                      <span className={`px-2 py-1 rounded text-xs ${device.status === 'active'
                          ? 'bg-green-500/20 text-green-300'
                          : 'bg-gray-500/20 text-gray-300'
                        }`}>
                        {device.status}
                      </span>
                    </div>
                    <div className="space-y-1 text-sm text-gray-300">
                      <p>🌐 Browser: {device.browser}</p>
                      <p>🖥️ OS: {device.os}</p>
                      <p>🕒 Last Active: {new Date(device.lastLogin).toLocaleString()}</p>
                      <p>🌍 IP: {device.ipAddress}</p>
                      {device.location && <p>📍 Location: {device.location}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

        </main>
      </div>

      <Footer />
    </div>
  );
};




export default SystemEventsPage;


