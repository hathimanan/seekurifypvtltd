import {
  ArrowLeft, Shield, ShieldCheck, Target, Eye, ScanEye, Bot,
  FileSearch, BarChart3, Fingerprint, Cpu, Globe, Lock,
  CheckCircle2, Pencil, Save, X, KeyRound, Camera
} from "lucide-react";
import React, { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import Header from "./ui/Header";
import Footer from "./ui/Footer";
import { API_BASE_URL } from "../services/api";
import { motion } from "framer-motion";
import AppSidebar from "./ui/AppSidebar";

interface UserProfile {
  name: string;
  email: string;
  username: string;
  profileImage?: string;
}

// ─── Analyst skill tags ───────────────────────────────────────────────────────
const SKILLS = [
  "Threat Detection",
  "Red Team Testing",
  "Prompt Injection",
  "Malware Analysis",
  "Deepfake Detection",
  "SIEM Monitoring",
  "PII Auditing",
  "CSP Hardening",
];

// ─── Clearance levels (purely visual) ────────────────────────────────────────
const CLEARANCE = "PLATFORM ACCESS — LEVEL 3";

const Profile: React.FC = () => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [editableUser, setEditableUser] = useState<UserProfile | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [showPinModal, setShowPinModal] = useState(false);
  const [pinInput, setPinInput] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [profileImage, setProfileImage] = useState<string | undefined>(undefined);
  const [sidebarExpanded, setSidebarExpanded] = useState(false);

  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // ── Fetch Profile ──────────────────────────────────────────────────────────
  useEffect(() => {
    let isMounted = true;
    const fetchProfile = async () => {
      const token = localStorage.getItem("token");
      if (!token) { navigate("/login"); return; }
      try {
        const res = await fetch(`${API_BASE_URL}/profile`, {
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error("Unauthorized");
        const data: UserProfile = await res.json();
        if (isMounted && data?.profileImage) setProfileImage(data.profileImage);
        setUser(data);
        setEditableUser(data);
      } catch {
        navigate("/login");
      } finally {
        setIsLoading(false);
      }
    };
    fetchProfile();
    return () => { isMounted = false; };
  }, [navigate]);

  // ── Save Profile ───────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!editableUser) return;
    const token = localStorage.getItem("token");
    if (!token) { navigate("/login"); return; }
    try {
      const res = await fetch(`${API_BASE_URL}/profile`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(editableUser),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update profile");
      setUser(data);
      setEditableUser(data);
      setIsEditing(false);
      setError("");
      setSuccessMessage("Profile updated successfully.");
      setTimeout(() => setSuccessMessage(""), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update profile");
    }
  };

  // ── Logout ─────────────────────────────────────────────────────────────────
  const handleLogout = async () => {
    try {
      await fetch(`${API_BASE_URL}/auth/logout`, { method: "POST", credentials: "include" });
    } catch { /* ignore */ }
    finally { localStorage.removeItem("token"); navigate("/login"); }
  };

  // ── Image Upload ───────────────────────────────────────────────────────────
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.[0]) return;
    const file = e.target.files[0];
    const reader = new FileReader();
    reader.onloadend = () => {
      const imgData = reader.result as string;
      setProfileImage(imgData);
      setEditableUser((prev) => prev ? { ...prev, profileImage: imgData } : prev);
    };
    reader.readAsDataURL(file);
    const formData = new FormData();
    formData.append("profileImage", file);
    const token = localStorage.getItem("token");
    await fetch(`${API_BASE_URL}/profile/upload-image`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });
  };

  // ── PIN Verify ─────────────────────────────────────────────────────────────
  const handleVerifyPin = async () => {
    setError("");
    if (!pinInput.trim()) { setError("PIN field cannot be empty."); return; }
    if (!/^\d+$/.test(pinInput)) { setError("PIN must contain only numeric values."); return; }
    setIsVerifying(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_BASE_URL}/auth/verify-pin`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ email: user?.email, pin: pinInput }),
      });
      const data = await res.json();
      if (data.token) { setShowPinModal(false); navigate("/change-password"); }
      else setError("Incorrect PIN. Please try again.");
    } catch { setError("Error verifying PIN."); }
    finally { setIsVerifying(false); }
  };

  if (isLoading)
    return <p className="text-center mt-20 text-gray-500">Loading analyst profile…</p>;

  const initials = user?.name
    ? user.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
    : "SA";

  const analystId = `SA-${(user?.username || user?.email || "unknown")
    .replace(/[^a-z0-9]/gi, "")
    .toUpperCase()
    .slice(0, 8)
    .padEnd(8, "0")}`;

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col">
      <Header
        token={localStorage.getItem("token") || ""}
        handleLogout={handleLogout}
        profileImage={profileImage}
      />

      <div className="flex flex-1 overflow-hidden">
        <AppSidebar sidebarExpanded={sidebarExpanded} setSidebarExpanded={setSidebarExpanded} />

        <div className="flex-1 overflow-y-auto bg-gray-950 p-6 md:p-10">
          {/* Back */}
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-gray-400 hover:text-white text-sm mb-8 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Back
          </button>

          <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6">

            {/* ── LEFT: Identity Card ──────────────────────────────────────── */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.4 }}
              className="lg:col-span-1 flex flex-col gap-4"
            >
              {/* Card */}
              <div className="relative bg-gradient-to-b from-gray-900 to-gray-800 border border-gray-700 rounded-2xl overflow-hidden shadow-2xl">
                {/* Cyber header strip */}
                <div className="h-24 bg-gradient-to-r from-slate-700 via-slate-800 to-amber-700 relative">
                  <div className="absolute inset-0 opacity-20"
                    style={{ backgroundImage: "repeating-linear-gradient(0deg,transparent,transparent 4px,rgba(255,255,255,.07) 4px,rgba(255,255,255,.07) 5px),repeating-linear-gradient(90deg,transparent,transparent 4px,rgba(255,255,255,.07) 4px,rgba(255,255,255,.07) 5px)" }}
                  />
                  {/* Status badge */}
                  <div className="absolute top-3 right-3 flex items-center gap-1.5 bg-black/40 backdrop-blur-sm text-green-400 text-xs font-bold px-2.5 py-1 rounded-full border border-green-500/40">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                    ONLINE
                  </div>
                </div>

                {/* Avatar — overlaps header */}
                <div className="flex flex-col items-center -mt-12 pb-6 px-6">
                  <div className="relative group">
                    {profileImage ? (
                      <img
                        src={editableUser?.profileImage || profileImage}
                        alt="Analyst Avatar"
                        className="w-24 h-24 rounded-full object-cover ring-4 ring-gray-800 shadow-xl"
                      />
                    ) : (
                      <div className="w-24 h-24 rounded-full ring-4 ring-gray-800 shadow-xl bg-gradient-to-br from-slate-700 to-amber-600 flex items-center justify-center text-white text-2xl font-black">
                        {initials}
                      </div>
                    )}
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="absolute inset-0 rounded-full bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"
                    >
                      <Camera className="w-6 h-6 text-white" />
                    </button>
                    <input type="file" accept="image/*" ref={fileInputRef} className="hidden" onChange={handleImageUpload} />
                  </div>

                  {/* Name & Role */}
                  <h2 className="mt-3 text-white text-xl font-extrabold tracking-tight text-center">
                    {user?.name || user?.username || "Analyst"}
                  </h2>
                  <div className="mt-1 flex items-center gap-1.5 bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs font-semibold px-3 py-1 rounded-full">
                    <Shield className="w-3 h-3" /> AI Security Analyst
                  </div>

                  {/* Analyst ID */}
                  <p className="mt-3 font-mono text-gray-500 text-xs tracking-widest">{analystId}</p>

                  {/* Clearance */}
                  <div className="mt-2 text-center">
                    <span className="inline-block text-[10px] font-bold tracking-[0.2em] text-amber-400/80 bg-amber-400/10 border border-amber-400/20 px-3 py-0.5 rounded-sm uppercase">
                      {CLEARANCE}
                    </span>
                  </div>
                </div>

                {/* Divider */}
                <div className="border-t border-gray-700/60 mx-6" />

                {/* Skills */}
                <div className="px-6 py-4">
                  <p className="text-gray-500 text-xs font-semibold uppercase tracking-widest mb-3">Capabilities</p>
                  <div className="flex flex-wrap gap-2">
                    {SKILLS.map((s) => (
                      <span key={s} className="text-xs bg-gray-700/60 text-gray-300 border border-gray-600/50 px-2.5 py-1 rounded-md">
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Quick-links */}
              <div className="bg-gray-900 border border-gray-700 rounded-2xl p-4">
                <p className="text-gray-500 text-xs font-semibold uppercase tracking-widest mb-3">Quick Access</p>
                <div className="space-y-1">
                  {[
                    { label: "AI Red-Team Agent", icon: Target, path: "/red-team" },
                    { label: "SIEM Dashboard", icon: BarChart3, path: "/siem-dashboard" },
                    { label: "Watch Agent", icon: Eye, path: "/watch-agent" },
                    { label: "Malware Analyzer", icon: FileSearch, path: "/malware-analysis" },
                  ].map(({ label, icon: Icon, path }) => (
                    <button
                      key={path}
                      onClick={() => navigate(path)}
                      className="w-full flex items-center gap-3 text-gray-400 hover:text-white hover:bg-gray-800 text-sm px-3 py-2 rounded-lg transition-colors"
                    >
                      <Icon className="w-4 h-4 flex-shrink-0 text-amber-400" />
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>

            {/* ── RIGHT: Edit Panel ────────────────────────────────────────── */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.4, delay: 0.1 }}
              className="lg:col-span-2 flex flex-col gap-4"
            >
              {/* Header row */}
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-white text-2xl font-extrabold">Analyst Profile</h1>
                  <p className="text-gray-500 text-sm mt-0.5">Manage your identity and security credentials</p>
                </div>
                {!isEditing ? (
                  <button
                    onClick={() => setIsEditing(true)}
                    className="flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-slate-900 text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
                  >
                    <Pencil className="w-4 h-4" /> Edit
                  </button>
                ) : (
                  <div className="flex gap-2">
                    <button
                      onClick={handleSave}
                      className="flex items-center gap-2 bg-green-600 hover:bg-green-500 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
                    >
                      <Save className="w-4 h-4" /> Save
                    </button>
                    <button
                      onClick={() => { setEditableUser(user); setIsEditing(false); setError(""); }}
                      className="flex items-center gap-2 bg-gray-700 hover:bg-gray-600 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
                    >
                      <X className="w-4 h-4" /> Cancel
                    </button>
                  </div>
                )}
              </div>

              {/* Info Card */}
              <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 space-y-5">
                <p className="text-gray-500 text-xs font-semibold uppercase tracking-widest pb-1 border-b border-gray-700">
                  Identity
                </p>

                {/* Full Name */}
                <div>
                  <label className="block text-gray-400 text-xs font-semibold uppercase tracking-wider mb-1.5">Full Name</label>
                  {isEditing ? (
                    <input
                      type="text"
                      value={editableUser?.name || ""}
                      onChange={(e) => setEditableUser((p) => p ? { ...p, name: e.target.value } : p)}
                      className="w-full bg-gray-800 border border-gray-600 text-white rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                    />
                  ) : (
                    <p className="text-white font-semibold">{user?.name || "—"}</p>
                  )}
                </div>

                {/* Username */}
                <div>
                  <label className="block text-gray-400 text-xs font-semibold uppercase tracking-wider mb-1.5">Username</label>
                  {isEditing ? (
                    <input
                      type="text"
                      value={editableUser?.username || ""}
                      onChange={(e) => setEditableUser((p) => p ? { ...p, username: e.target.value } : p)}
                      className="w-full bg-gray-800 border border-gray-600 text-white rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                    />
                  ) : (
                    <p className="text-white font-semibold font-mono">@{user?.username || "—"}</p>
                  )}
                </div>

                {/* Email — read-only */}
                <div>
                  <label className="block text-gray-400 text-xs font-semibold uppercase tracking-wider mb-1.5">Email Address</label>
                  <p className="text-gray-300 font-medium">{user?.email}</p>
                  <p className="text-gray-600 text-xs mt-0.5">Email cannot be changed here.</p>
                </div>

                {/* Alerts */}
                {error && (
                  <div className="flex items-center gap-2 bg-red-900/40 border border-red-500/40 text-red-300 px-4 py-2.5 rounded-lg text-sm">
                    <X className="w-4 h-4 flex-shrink-0" /> {error}
                  </div>
                )}
                {successMessage && (
                  <div className="flex items-center gap-2 bg-green-900/40 border border-green-500/40 text-green-300 px-4 py-2.5 rounded-lg text-sm">
                    <CheckCircle2 className="w-4 h-4 flex-shrink-0" /> {successMessage}
                  </div>
                )}
              </div>

              {/* Security Card */}
              <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 space-y-4">
                <p className="text-gray-500 text-xs font-semibold uppercase tracking-widest pb-1 border-b border-gray-700">
                  Security
                </p>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-amber-500/10 rounded-lg border border-amber-500/20">
                      <Lock className="w-5 h-5 text-amber-300" />
                    </div>
                    <div>
                      <p className="text-white text-sm font-semibold">Password</p>
                      <p className="text-gray-500 text-xs font-mono tracking-widest mt-0.5">••••••••••••</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowPinModal(true)}
                    className="text-amber-400 hover:text-amber-300 text-sm font-semibold flex items-center gap-1 transition-colors"
                  >
                    Change <ArrowLeft className="w-3 h-3 rotate-180" />
                  </button>
                </div>

                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-green-500/10 rounded-lg border border-green-500/20">
                    <ShieldCheck className="w-5 h-5 text-green-400" />
                  </div>
                  <div>
                    <p className="text-white text-sm font-semibold">PIN Protection</p>
                    <p className="text-gray-500 text-xs mt-0.5">Required before changing password</p>
                  </div>
                  <span className="ml-auto text-xs bg-green-500/10 border border-green-500/30 text-green-400 px-2.5 py-1 rounded-full font-semibold">
                    Active
                  </span>
                </div>
              </div>

            </motion.div>
          </div>
        </div>
      </div>

      <Footer />

      {/* PIN Modal */}
      {showPinModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-full max-w-sm shadow-2xl"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-amber-500/10 rounded-lg border border-amber-500/20">
                <KeyRound className="w-5 h-5 text-amber-300" />
              </div>
              <h2 className="text-white font-bold text-lg">Verify PIN</h2>
            </div>
            <p className="text-gray-400 text-sm mb-4">Enter your PIN to proceed to password change.</p>
            <input
              type="password"
              placeholder="Enter your PIN"
              value={pinInput}
              onChange={(e) => setPinInput(e.target.value.replace(/\D/g, ""))}
              className="w-full bg-gray-800 border border-gray-600 text-white rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 mb-3"
            />
            {error && <p className="text-red-400 text-sm mb-3">{error}</p>}
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => { setShowPinModal(false); setPinInput(""); setError(""); }}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white text-sm rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleVerifyPin}
                disabled={isVerifying}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-900 text-sm font-semibold rounded-lg transition-colors disabled:opacity-50"
              >
                {isVerifying ? "Verifying…" : "Verify & Continue"}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default Profile;
