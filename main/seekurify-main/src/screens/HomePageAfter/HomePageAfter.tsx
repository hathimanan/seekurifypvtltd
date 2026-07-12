import React, { JSX, useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { useNavigate } from "react-router-dom";
import { API_BASE_URL, apiService } from "../../services/api";
import { motion } from "framer-motion";
import Header from "../../components/ui/Header";
import Footer from "../../components/ui/Footer";
import {
  Shield, ShieldCheck, Bot,
  FileSearch, KeyRound, Globe,
  AlertTriangle, BookOpen, Lightbulb, ChevronRight,
  Activity, Lock
} from "lucide-react";

// ─── Security Tips ────────────────────────────────────────────────────────────
const SECURITY_TIPS = [
  { tip: "Use a unique password for every account. A password manager makes this effortless.", icon: KeyRound },
  { tip: "Enable multi-factor authentication (MFA) on all critical accounts.", icon: Shield },
  { tip: "Verify links before clicking — hover to preview the URL destination.", icon: Globe },
  { tip: "Keep software and OS updated; patches fix vulnerabilities attackers exploit.", icon: ShieldCheck },
  { tip: "Be cautious of unsolicited emails asking for credentials or personal data.", icon: AlertTriangle },
  { tip: "Scan files from unknown sources before opening them.", icon: FileSearch },
  { tip: "Use a VPN on public Wi-Fi to encrypt your traffic.", icon: Lock },
];

// ─── Tool Cards Config ────────────────────────────────────────────────────────
interface ToolCard {
  title: string;
  description: string;
  path: string;
  icon: React.ElementType;
  color: string;        // Tailwind bg color class
  badge?: string;       // optional badge text
  featureFlag?: boolean; // if false, hide the card
}

interface ToolGroup {
  id: string;
  label: string;
  description: string;
  icon: React.ElementType;
  accentColor: string;
  borderColor: string;
  bgColor: string;
  groupFlag?: boolean; // if false, hide the entire group
  tools: ToolCard[];
}

export const HomePageAfter = (): JSX.Element => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const token = localStorage.getItem("token");

  const [profileImage, setProfileImage] = useState<string>("");
  const [showPinModal, setShowPinModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [pinChecked, setPinChecked] = useState(false);
  const [showPasswordExpiryModal, setShowPasswordExpiryModal] = useState(false);
  const [expireAfterDays, setExpireAfterDays] = useState(null);
  const [sidebarExpanded, setSidebarExpanded] = useState(true);
  const [identityAccessEnabled, setIdentityAccessEnabled] = useState<boolean>(false);
  const [learnSecureEnabled, setLearnSecureEnabled] = useState<boolean>(false);

  // Greeting based on time of day
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 17) return "Good afternoon";
    return "Good evening";
  };

  const todayTip = SECURITY_TIPS[new Date().getDay() % SECURITY_TIPS.length];

  useEffect(() => {
    const fetchFeatureFlags = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/feature-flags/read`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!res.ok) throw new Error("Failed to fetch feature flags");
        const data = await res.json();
        setIdentityAccessEnabled(data.identityAccessEnabled !== false);
        setLearnSecureEnabled(data.learnSecureEnabled !== false);
      } catch (err) {
        console.error("❌ Failed to load feature flags:", err);
      }
    };
    fetchFeatureFlags();
  }, []);

  useEffect(() => {
    const fetchProfileImage = async () => {
      if (!token) return;
      try {
        const res = await fetch(`${API_BASE_URL}/profile`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.status === 204) return;
        const contentType = res.headers.get("content-type") || "";
        if (!contentType.includes("application/json")) return;
        if (!res.ok) throw new Error("Failed to fetch profile");
        const data = await res.json();
        if (data.profileImage) setProfileImage(data.profileImage);
        if (data.isPasswordExpired === true) {
          setExpireAfterDays(data.expireAfterDays);
          setShowPasswordExpiryModal(true);
        }
        if (data.expireAfterDays !== undefined && data.expireAfterDays <= 0) {
          setExpireAfterDays(data.expireAfterDays);
          setShowPasswordExpiryModal(true);
        }
      } catch (err) {
        console.error("Failed to load profile image:", err);
      }
    };
    fetchProfileImage();
  }, [token]);

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  const handleChangePin = () => {
    setShowPinModal(false);
    navigate(`/set-new-pin?token=${token}`);
  };

  const handleCloseModal = () => setShowPinModal(false);

  if (loading)
    return (
      <div className="min-h-screen flex items-center justify-center text-xl font-semibold">
        Loading...
      </div>
    );

  // ─── Build tool groups (feature-flag aware) ────────────────────────────────
  const toolGroups: ToolGroup[] = [
    {
      id: "identity",
      label: "Identity & Access Protection",
      description: "Manage credentials and monitor authentication events.",
      icon: KeyRound,
      accentColor: "text-sky-600 dark:text-sky-400",
      borderColor: "border-sky-400",
      bgColor: "bg-sky-50 dark:bg-sky-950/40",
      groupFlag: identityAccessEnabled,
      tools: [
        { title: "Password Vault", description: "Store and manage credentials in an encrypted vault.", path: "/dashboard", icon: KeyRound, color: "from-sky-600 to-sky-800" },
        { title: "Breach Control", description: "Check your credentials and email against known data breaches.", path: "/breach-control", icon: Shield, color: "from-slate-600 to-sky-700" },
      ],
    },
    {
      id: "learn",
      label: "Learn & Stay Secure",
      description: "Build security knowledge and get AI-powered guidance.",
      icon: BookOpen,
      accentColor: "text-lime-600 dark:text-lime-400",
      borderColor: "border-lime-500",
      bgColor: "bg-lime-50 dark:bg-lime-950/40",
      groupFlag: learnSecureEnabled,
      tools: [
        { title: "Security Awareness", description: "Stay informed with curated cybersecurity news and best practices.", path: "/securityAwareness", icon: BookOpen, color: "from-lime-600 to-lime-800" },
        { title: "Insights", description: "Analyse security trends and review your account's risk posture.", path: "/insights", icon: Activity, color: "from-slate-600 to-lime-700" },
        { title: "Ask Seekurify AI", description: "Chat with your security assistant for instant answers and guidance.", path: "/ask", icon: Bot, color: "from-lime-500 to-lime-800", badge: "AI" },
      ],
    },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-gray-50 to-blue-50 dark:from-gray-900 dark:to-gray-800">
      <title>Seekurify Home</title>

      {/* Password Expiry Modal */}
      {showPasswordExpiryModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white p-6 rounded-2xl shadow-xl max-w-sm w-full text-center"
          >
            <h2 className="text-2xl font-bold text-red-600 mb-3">Password Expired</h2>
            <p className="text-gray-700 mb-5">
              Your account password has expired. Please update it immediately to keep your account secure.
            </p>
            <button
              onClick={() => navigate("/change-password")}
              className="bg-indigo-600 text-white px-6 py-2 rounded-lg hover:bg-indigo-700 shadow"
            >
              Change Password
            </button>
            <div className="mt-3">
              <button
                onClick={() => setShowPasswordExpiryModal(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                Later
              </button>
            </div>
          </motion.div>
        </div>
      )}

      <Header
        token={token || ""}
        handleLogout={handleLogout}
        profileImage={profileImage}
      />

      {/* PIN Modal */}
      {showPinModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 px-4">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white p-6 rounded-2xl shadow-2xl text-center max-w-sm w-full"
          >
            <h2 className="text-2xl font-bold mb-4 text-gray-900">Set a New PIN</h2>
            <p className="text-gray-700 mb-6">
              You are using the default PIN. For your security, please change it.
            </p>
            <div className="flex justify-center gap-4">
              <button
                onClick={handleChangePin}
                className="bg-indigo-600 text-white px-5 py-2 rounded-lg hover:bg-indigo-700 shadow"
              >
                Change PIN
              </button>
              <button onClick={handleCloseModal} className="text-gray-500 hover:text-gray-700">
                Later
              </button>
            </div>
          </motion.div>
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        {/* ── Main Dashboard ────────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-8">

          {/* Welcome Banner */}
          <motion.div
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="relative bg-slate-900 rounded-2xl p-6 md:p-8 text-white shadow-xl overflow-hidden border border-slate-700"
          >
            {/* amber accent line */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500 via-amber-400 to-amber-600 rounded-t-2xl" />

            <div className="relative">
              <p className="text-amber-400 text-sm font-medium uppercase tracking-widest mb-1">
                {getGreeting()}
              </p>
              <h1 className="text-2xl md:text-3xl font-extrabold mb-2">
                {user?.username || user?.email?.split("@")[0] || ""}
              </h1>
              <p className="text-slate-400 text-sm md:text-base max-w-xl">
                Your security dashboard is ready. Scan, monitor, and protect your systems from one place.
              </p>
              <motion.button
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => navigate("/dashboard")}
                className="mt-4 inline-flex items-center gap-2 bg-amber-400 text-slate-900 font-semibold text-sm px-4 py-2 rounded-lg shadow hover:bg-amber-300 transition-colors"
              >
                <KeyRound className="w-4 h-4" /> Open Password Vault
              </motion.button>
            </div>
          </motion.div>

          {/* Security Tip of the Day */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
            className="flex items-start gap-4 bg-amber-50 border border-amber-200 rounded-xl px-5 py-4 shadow-sm"
          >
            <div className="flex-shrink-0 mt-0.5 bg-amber-100 rounded-full p-2">
              <Lightbulb className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-amber-600 mb-0.5">
                Security Tip of the Day
              </p>
              <p className="text-gray-800 text-sm leading-relaxed">{todayTip.tip}</p>
            </div>
          </motion.div>

          {/* Grouped Security Pillars */}
          {toolGroups.map((group) => {
            if (group.groupFlag === false) return null;
            const visibleTools = group.tools.filter(
              (t) => t.featureFlag === undefined || t.featureFlag === true
            );
            if (visibleTools.length === 0) return null;
            const GroupIcon = group.icon;
            return (
              <div key={group.id}>
                {/* Section Header */}
                <div className={`flex items-center gap-3 mb-4 pl-3 border-l-4 ${group.borderColor} ${group.bgColor} rounded-r-lg py-2 pr-4`}>
                  <GroupIcon className={`w-5 h-5 flex-shrink-0 ${group.accentColor}`} />
                  <div>
                    <h2 className={`text-sm font-bold ${group.accentColor} uppercase tracking-wider leading-none`}>
                      {group.label}
                    </h2>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{group.description}</p>
                  </div>
                </div>
                {/* Tools Sub-Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {visibleTools.map((tool, idx) => {
                    const Icon = tool.icon;
                    return (
                      <motion.button
                        key={tool.path}
                        initial={{ opacity: 0, y: 16 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3, delay: 0.05 * idx }}
                        whileHover={{ scale: 1.03, y: -2 }}
                        whileTap={{ scale: 0.97 }}
                        onClick={() => navigate(tool.path)}
                        className="group relative text-left bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-5 hover:shadow-md transition-all duration-200 overflow-hidden"
                      >
                        {/* gradient accent strip */}
                        <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${tool.color} rounded-t-2xl`} />

                        <div className="flex items-start justify-between mb-3 mt-1">
                          <div className={`p-2.5 rounded-xl bg-gradient-to-br ${tool.color} shadow-sm`}>
                            <Icon className="w-5 h-5 text-white" />
                          </div>
                          {tool.badge && (
                            <span className="text-xs font-bold bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 px-2 py-0.5 rounded-full">
                              {tool.badge}
                            </span>
                          )}
                        </div>

                        <h3 className="font-semibold text-gray-900 dark:text-gray-100 text-sm mb-1">{tool.title}</h3>
                        <p className="text-gray-500 dark:text-gray-400 text-xs leading-relaxed line-clamp-2">{tool.description}</p>

                        <div className="mt-3 flex items-center text-amber-600 dark:text-amber-400 text-xs font-semibold opacity-0 group-hover:opacity-100 transition-opacity">
                          Open <ChevronRight className="w-3 h-3 ml-0.5" />
                        </div>
                      </motion.button>
                    );
                  })}
                </div>
              </div>
            );
          })}

        </div>
      </div>

      <Footer />
    </div>
  );
};
