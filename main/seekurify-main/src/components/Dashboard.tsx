import React, { useState, useEffect, useMemo } from 'react';
import { io as socketIO } from 'socket.io-client';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { apiService } from '../services/api';
import { fetchWithAuth } from '../services/authService';
import { Button } from './ui/button';
import Header from "../components/ui/Header";
import Footer from "../components/ui/Footer";
import { API_BASE_URL } from '../services/api';
import { Logo } from './ui/logo';
// import  from "../components/ui/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "../components/ui/dialog";
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Edit, Trash2, Copy, FileSearch, BarChart3, KeyRound, ShieldCheck, Phone, ShieldAlert, ExternalLink, ArrowRight, X } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../components/ui/tooltip";
import { Eye, Pencil } from "lucide-react";

import { motion } from 'framer-motion';
import AppSidebar from './ui/AppSidebar';

interface PasswordEntry {
  _id: string;
  website: string;
  username: string;
  password: string;
  currentPassword?: string;
  category: string;
  notes: string;
  isFinancial?: boolean;
  daysLeft?: number;
  createdAt: string;
  lastChanged: string;
  updatedAt?: string;
  isExpired?: boolean;
  isBreached?: boolean;
  breachCount?: number;
  riskScore?: number;
  riskLevel?: 'critical' | 'high' | 'medium' | 'low' | 'safe';
  riskSummary?: string;
}

interface HeaderProps {
  token: string;
  handleLogout: () => void;
  profileImage?: string; // ✅ new prop
}



const toSafeString = (value: unknown) => typeof value === 'string' ? value : '';




// Website icons mapping
const getWebsiteIcon = (website: string) => {
  const name = website.toLowerCase();

  // Social Media
  if (name.includes("facebook")) return "f";
  if (name.includes("instagram")) return "📸";
  if (name.includes("twitter") || name.includes("x.com")) return "X";
  if (name.includes("linkedin")) return "in";

  // Email Services
  if (name.includes("gmail") || name.includes("google")) return "G";
  if (name.includes("outlook") || name.includes("microsoft")) return "O";
  if (name.includes("yahoo")) return "Y!";


  // Developer Platforms
  if (name.includes("github")) return "🐱";
  if (name.includes("gitlab")) return "🦊";

  // E-Commerce
  if (name.includes("amazon")) return "a";
  if (name.includes("flipkart")) return "F";

  // Finance / Payment Apps
  if (name.includes("paytm")) return "₹";
    if (name.includes("groww")) return "G";

  if (name.includes("phonepe")) return "P";

  // Streaming
  if (name.includes("netflix")) return "N";
  if (name.includes("hotstar")) return "H";



  // Default fallback
  return website.charAt(0).toUpperCase();
};


// Direct password-change URLs for the most common sites.
// Fallback: Google search query for everything else.
const CHANGE_PASSWORD_URLS: Record<string, string> = {
  'google.com':       'https://myaccount.google.com/signinoptions/password',
  'gmail.com':        'https://myaccount.google.com/signinoptions/password',
  'facebook.com':     'https://www.facebook.com/settings?tab=security',
  'instagram.com':    'https://www.instagram.com/accounts/password/change/',
  'twitter.com':      'https://twitter.com/settings/password',
  'x.com':            'https://twitter.com/settings/password',
  'github.com':       'https://github.com/settings/security',
  'gitlab.com':       'https://gitlab.com/-/user_settings/password/edit',
  'microsoft.com':    'https://account.microsoft.com/security',
  'outlook.com':      'https://account.microsoft.com/security',
  'hotmail.com':      'https://account.microsoft.com/security',
  'linkedin.com':     'https://www.linkedin.com/mypreferences/d/settings/sign-in-and-security',
  'amazon.com':       'https://www.amazon.com/gp/css/account/info/ref=ppx_ya_dt_b_account_security',
  'paypal.com':       'https://www.paypal.com/myaccount/security/password/change',
  'netflix.com':      'https://www.netflix.com/password',
  'apple.com':        'https://appleid.apple.com/account/manage',
  'yahoo.com':        'https://login.yahoo.com/account/security',
  'dropbox.com':      'https://www.dropbox.com/account/security',
  'slack.com':        'https://slack.com/account/settings',
  'reddit.com':       'https://www.reddit.com/settings/privacy',
  'discord.com':      'https://discord.com/settings/account',
  'twitch.tv':        'https://www.twitch.tv/settings/security',
  'spotify.com':      'https://www.spotify.com/account/change-password/',
  'adobe.com':        'https://account.adobe.com/',
  'notion.so':        'https://www.notion.so/profile',
  'figma.com':        'https://www.figma.com/settings',
  'shopify.com':      'https://accounts.shopify.com/account/security',
  'paytm.com':        'https://paytm.com/profile/security',
  'phonepe.com':      'https://phonepe.com/settings/security',
  'groww.in':         'https://groww.in/profile',
};

function getChangePasswordUrl(website: string): string {
  const domain = website.toLowerCase().replace(/^(https?:\/\/)?(www\.)?/, '');
  // Exact match first
  if (CHANGE_PASSWORD_URLS[domain]) return CHANGE_PASSWORD_URLS[domain];
  // Partial match (e.g. "chase.bank.com" → "chase.com")
  const match = Object.keys(CHANGE_PASSWORD_URLS).find(k => domain.includes(k) || k.includes(domain));
  if (match) return CHANGE_PASSWORD_URLS[match];
  // Fallback: Google search
  return `https://www.google.com/search?q=${encodeURIComponent(domain + ' change password')}`;
}

const getWebsiteColor = (website: string) => {
  const domain = website.toLowerCase();
  if (domain.includes('google')) return 'bg-gradient-to-br from-red-500 to-pink-500';
  if (domain.includes('facebook')) return 'bg-gradient-to-br from-blue-600 to-blue-400';
  if (domain.includes('yahoo')) return 'bg-gradient-to-br from-purple-600 to-violet-500';
  if (domain.includes('twitter') || domain.includes('x.com')) return 'bg-gradient-to-br from-gray-900 to-black';
  if (domain.includes('amazon')) return 'bg-gradient-to-br from-yellow-500 to-orange-500';
  return 'bg-gradient-to-br from-gray-600 to-gray-400';
};

type RiskLevel = 'critical' | 'high' | 'medium' | 'low' | 'safe';

const RISK_STYLES: Record<RiskLevel, { bg: string; text: string; label: string }> = {
  critical: { bg: 'bg-red-600',    text: 'text-white', label: 'Critical' },
  high:     { bg: 'bg-orange-500', text: 'text-white', label: 'High' },
  medium:   { bg: 'bg-yellow-400', text: 'text-gray-900', label: 'Medium' },
  low:      { bg: 'bg-lime-500',   text: 'text-white', label: 'Low' },
  safe:     { bg: 'bg-emerald-500',text: 'text-white', label: 'Safe' },
};

export const Dashboard: React.FC = () => {
  const { user, logout } = useAuth();
  const [passwords, setPasswords] = useState<PasswordEntry[]>([]);
  const [email, setEmail] = useState(user?.email);
  const [showAddForm, setShowAddForm] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [editingPassword, setEditingPassword] = useState<PasswordEntry | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [viewingPassword, setViewingPassword] = useState<PasswordEntry | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showViewingPassword, setShowViewingPassword] = useState(false);
  const [showReverifyPinModal, setShowReverifyPinModal] = useState(false);
  const [reverifyPinInput, setReverifyPinInput] = useState('');
  const [isReverified, setIsReverified] = useState(false);
  const [pinError, setPinError] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [prevRoute, setPrevRoute] = useState("/homePageAfterLogin"); // default route
  const [reverifyPinError, setReverifyPinError] = useState('');
  const [showReuseWarning, setShowReuseWarning] = useState(false);
  const location = useLocation();
  const [profileImage, setProfileImage] = useState<string>(""); // ✅ state for header
  const [pinAction, setPinAction] = useState<"view" | "edit" | "delete" | null>(null);
  const [showDeleteConfirmationModal, setShowDeleteConfirmationModal] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [showCopyModal, setShowCopyModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredPasswords, setFilteredPasswords] = useState(passwords);
  const [sidebarExpanded, setSidebarExpanded] = useState(true);

  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showExpiryModal, setShowExpiryModal] = useState(false);
  const [passwordToExpire, setPasswordToExpire] = useState<PasswordEntry | null>(null);
  const [showExpiryWarning, setShowExpiryWarning] = useState(false);
  const [selectedPassword, setSelectedPassword] = useState<any>(null);
  const [expiredPassword, setExpiredPassword] = useState<PasswordEntry | null>(null);
  const [editPasswordId, setEditPasswordId] = useState<string | null>(null);
  const [pinverificationEnabled, setPinVerificationEnabled] = useState<boolean | null>(null);
  const totalPasswords = filteredPasswords.length;
  const [phishingDetectorEnabled, setPhishingDetectorEnabled] = useState<boolean>(false);
  const [featuresLoaded, setFeaturesLoaded] = useState(false);
  const [isCheckingBreaches, setIsCheckingBreaches] = useState(false);
  const [breachCheckError, setBreachCheckError] = useState<string | null>(null);
  const [isScoringRisk, setIsScoringRisk] = useState(false);
  const [riskScoreError, setRiskScoreError] = useState<string | null>(null);
  const [suspiciousAlert, setSuspiciousAlert] = useState<{ type: string; ip: string; message: string; location?: string; at: string } | null>(null);

  const DAYS_90 = 90;
  const now = Date.now();

  const oldPasswords = filteredPasswords.filter(p => {
    if (!p.updatedAt) return false;  // skip if no timestamp
    const lastUpdated = new Date(p.updatedAt).getTime();
    const ageInDays = (now - lastUpdated) / (1000 * 60 * 60 * 24);
    return ageInDays > DAYS_90;
  }).length;

  const strongPasswords = filteredPasswords.filter(p => toSafeString(p.password).length > 15).length;
  const websiteCountMap: Record<string, number> = {};

  filteredPasswords.forEach(p => {
    if (p.website) {
      websiteCountMap[p.website] = (websiteCountMap[p.website] || 0) + 1;
    }
  });
  const mostUsedWebsites = Object.keys(websiteCountMap).length > 0
    ? Math.max(...Object.values(websiteCountMap))
    : 0;
  const weakPasswords = filteredPasswords.filter(p => toSafeString(p.password).length <= 5).length;

  const ninetyDaysAgo = now - 90 * 24 * 60 * 60 * 1000; // 90 days in ms

  // Password reuse map: plaintext → count across the full vault
  const reuseMap = useMemo(() => {
    const freq: Record<string, number> = {};
    passwords.forEach(p => {
      const password = toSafeString(p.password);
      if (password) freq[password] = (freq[password] ?? 0) + 1;
    });
    return freq;
  }, [passwords]);

  // Top-5 credentials ranked by risk score for the action queue
  const actionQueue = useMemo(() => {
    const scored = passwords.filter(p => p.riskScore != null);
    return [...scored]
      .sort((a, b) => (b.riskScore ?? 0) - (a.riskScore ?? 0))
      .slice(0, 5);
  }, [passwords]);

  const passwordsChanged90Days = filteredPasswords.filter(p => {
    if (!p.lastChanged) return false;

    let lastChangedTime: number;

    if (typeof p.lastChanged === "string") {
      const d = new Date(p.lastChanged);
      if (isNaN(d.getTime())) return false;
      lastChangedTime = d.getTime();
    } else if (typeof p.lastChanged === "number") {
      lastChangedTime = p.lastChanged;
    } else {
      // any other type is ignored
      return false;
    }

    return lastChangedTime >= ninetyDaysAgo && lastChangedTime <= now;
  }).length;




  const navigate = useNavigate();

  const handleReverifyPinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/auth/verify-pin`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          email: user?.email,
          pin: reverifyPinInput,
        }),
      });

      const data = await response.json();


      if (data.token) {
        setIsReverified(true);
        setShowReverifyPinModal(false);
        setPinError(false);
        setReverifyPinInput("");



        // ✅ Call handleViewPassword automatically if a password was requested
        if (confirmId) {
          if (pinAction === "view") {
            handleViewPassword(confirmId);
          } else if (pinAction === "edit") {
            const pwdToEdit = passwords.find(p => p._id === confirmId);
            if (pwdToEdit) {
              setEditingPassword(pwdToEdit);
              setPasswordFormData({
                website: pwdToEdit.website,
                username: pwdToEdit.username,
                // Do NOT pre-fill the "New Password" field for security UX
                password: '',
                category: pwdToEdit.category,
                notes: pwdToEdit.notes,
                isFinancial: pwdToEdit.isFinancial ?? false,
              });
              setCurrentPassword(''); // ensure current password input is cleared when opening edit
              setShowEditModal(true); // user can now edit and THEN call handleUpdatePassword on submit
            }
          }

          else if (pinAction === "delete") {

            setShowDeleteConfirmationModal(true);

          }
        }
        // optional: refresh full password list if needed
        await loadPasswords(Date.now());
      } else {
        setPinError(true);
      }
    } catch (error) {
      console.error("Error verifying PIN:", error);
      setPinError(true);
    }

  };




  // Form state
  const [passwordformData, setPasswordFormData] = useState({
    website: '',
    username: '',
    password: '',
    category: 'General',
    notes: '',
    isFinancial: false,
  });


  // ==========================================
// 1️⃣ Load Feature Flags FIRST (runs once)
// ==========================================
useEffect(() => {
  const fetchFeatureFlags = async () => {
    try {
      const res = await fetchWithAuth(`${API_BASE_URL}/feature-flags/read`);
      if (!res.ok) throw new Error('Failed to fetch feature flags');
      const data = await res.json();
      setPinVerificationEnabled(data.pinVerificationPasswordManager === true);
    } catch (err) {
      setPinVerificationEnabled(false);
    }
  };
  fetchFeatureFlags();
}, []);


useEffect(() => {
  const fetchFeatureFlags = async () => {
    try {
      const res = await fetchWithAuth(`${API_BASE_URL}/feature-flags/read`);
      if (!res.ok) throw new Error('Failed to fetch feature flags');
      const data = await res.json();
      setPhishingDetectorEnabled(data.phishingDetectorEnabled === true);
    } catch (err) {
      setPhishingDetectorEnabled(false);
    } finally {
      setFeaturesLoaded(true);
    }
  };
  fetchFeatureFlags();
}, []);


// ==========================================
// 2️⃣ Initialize App Data (runs once)
// ==========================================
useEffect(() => {
  let isMounted = true;

  const initialize = async () => {
    if (!isMounted) return;

    setIsLoading(true);

    try {
      // 1. Get token
      const token = localStorage.getItem("token");
      if (!token) {
        setIsLoading(false);
        return;
      }

      // 3. Fetch profile image
      try {
        const res = await fetchWithAuth(`${API_BASE_URL}/profile`);

        if (res.ok) {
          const data = await res.json();
          if (isMounted && data.profileImage) {
            setProfileImage(data.profileImage);
          }
        }
      } catch (err) {
        console.error("Failed to fetch profile image:", err);
      }

      // 4. Fetch passwords
      try {
        const res = await fetchWithAuth(`${API_BASE_URL}/passwords`);

        if (!res.ok) {
          throw new Error('Failed to fetch passwords');
        }

        const payload = await res.json();
        const data = Array.isArray(payload) ? payload : [];
        
        if (isMounted) {
          setPasswords(data);

          // Check if any password is expired
          const expired = data.find((p: PasswordEntry) => p.isExpired);
          if (expired) {
            setExpiredPassword(expired);
            setShowExpiryModal(true);
            setShowReverifyPinModal(false);
          }
        }
      } catch (err) {
        console.error("Failed to fetch passwords:", err);
        if (isMounted) setError("Failed to load passwords. Please refresh the page.");
      }
    } catch (err) {
      console.error("Initialization error:", err);
      if (isMounted) setError("Something went wrong loading your data. Please refresh.");
    } finally {
      if (isMounted) {
        setIsLoading(false);
      }
    }
  };

  initialize();

  return () => {
    isMounted = false;
  };
}, []); // ✅ Empty deps - run once on mount

// ==========================================
// 2.5 Refresh vault when tab regains focus
// (picks up passwords saved via extension on other sites)
// ==========================================
useEffect(() => {
  const onFocus = () => loadPasswords(Date.now());
  window.addEventListener('focus', onFocus);
  return () => window.removeEventListener('focus', onFocus);
}, []);

// ==========================================
// 3️⃣ Show PIN Modal When Ready
// ==========================================
useEffect(() => {
  // Wait until the feature flag has been resolved (null = still loading)
  if (pinverificationEnabled === null) return;
  // PIN not required for this user
  if (pinverificationEnabled !== true) return;
  // User already verified this session
  if (isReverified) return;
  // Expiry modal takes priority
  if (showExpiryModal) return;

  setShowReverifyPinModal(true);
}, [pinverificationEnabled, isReverified, showExpiryModal]);

// ==========================================
// 4️⃣ Update Form When Editing Password
// ==========================================
useEffect(() => {
  if (editingPassword) {
    setPasswordFormData({
      website: editingPassword.website || '',
      username: editingPassword.username || '',
      password: '', // 🔐 never prefill password
      category: editingPassword.category || '',
      notes: editingPassword.notes || '',
      isFinancial: editingPassword.isFinancial ?? false,
    });

    setCurrentPassword('');
    setShowCurrentPassword(false);
    setShowNewPassword(false);
  }
}, [editingPassword]);

// ==========================================
// 5️⃣ Filter Passwords Based on Search
// ==========================================
useEffect(() => {
  if (!searchQuery.trim()) {
    setFilteredPasswords(passwords);
  } else {
    const query = searchQuery.toLowerCase();
    const filtered = passwords.filter((p) =>
      toSafeString(p.website).toLowerCase().includes(query) ||
      toSafeString(p.username).toLowerCase().includes(query) ||
      toSafeString(p.notes).toLowerCase().includes(query)
    );
    setFilteredPasswords(filtered);
  }
}, [searchQuery, passwords]);

// ==========================================
// 6️⃣ Prevent Body Scroll When Modal Open
// ==========================================
useEffect(() => {
  const modalOpen =
    showPassword ||
    showEditModal ||
    showAddForm ||
    showReverifyPinModal ||
    showCopyModal ||
    showDeleteConfirmationModal ||
    showExpiryModal ||
    showReuseWarning;

  if (modalOpen) {
    document.body.style.overflow = 'hidden';
  } else {
    document.body.style.overflow = '';
  }

  return () => {
    document.body.style.overflow = '';
  };
}, [
  showPassword,
  showEditModal,
  showAddForm,
  showReverifyPinModal,
  showCopyModal,
  showDeleteConfirmationModal,
  showExpiryModal,
  showReuseWarning
]);


// ==========================================
// 8️⃣ Real-time suspicious login alerts
// ==========================================
useEffect(() => {
  if (!user?.id) return;
  // Socket.io needs an absolute URL — API_BASE_URL is a relative path for HTTP only.
  // In dev, connect directly to the backend port (Vite proxy handles /api HTTP but
  // socket.io handshake must reach the Express server directly).
  // In production the socket server is co-located with the web server.
  const SOCKET_URL = import.meta.env.DEV
    ? 'http://localhost:5000'
    : window.location.origin;
  const socket = socketIO(SOCKET_URL, { transports: ['websocket', 'polling'] });
  socket.on('connect', () => socket.emit('registerUser', String(user.id)));
  socket.on('suspiciousLogin', (data) => setSuspiciousAlert(data));
  socket.on('connect_error', (err) => console.warn('Socket connect error:', err.message));
  return () => { socket.disconnect(); };
}, [user?.id]);

// ==========================================
// Helper Functions
// ==========================================
const shouldRequirePin = () => {
  if (pinverificationEnabled === null) return false;
  return pinverificationEnabled === true && !isReverified;
};


// Current (correct name, correct implementation)
const toggleShowPassword = () => setShowViewingPassword((prev) => !prev);

  const validateReverifyPin = (e: React.FormEvent) => {
    e.preventDefault();
    setReverifyPinError('');

    if (!reverifyPinInput.trim()) {
      setReverifyPinError('PIN field cannot be empty.');
      return;
    }

    if (!/^\d+$/.test(reverifyPinInput)) {
      setReverifyPinError('PIN must contain only numeric values.');
      return;
    }

    handleReverifyPinSubmit(e);
  };


  const handleClose = () => {
    setShowPassword(false);
    setViewingPassword(null);
  };

  // ----------------------------
  // Load passwords
  // ----------------------------

  const loadPasswords = async (cacheBuster?: number) => {
    try {
      setIsLoading(true);
      const data = await apiService.getPasswords(cacheBuster);
      setPasswords(data as PasswordEntry[]);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load passwords');
    } finally {
      setIsLoading(false);
    }
  };





  const PasswordExpiryModal = ({
    password,
    onClose,
    onUpdate,
  }: {
    password: PasswordEntry;
    onClose: () => void;
    onUpdate: (password: PasswordEntry) => void;
  }) => {
    return (
      <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 animate-fadeIn">

          <h2 className="text-2xl font-bold text-red-600 text-center">
            Password Expired ⚠️
          </h2>

          <p className="mt-4 text-gray-700 text-center">
            The password for
            <span className="font-semibold"> {password.website}</span> has expired.
            Please update it to stay secure.
          </p>

          <div className="mt-6 flex gap-3">
            <button
              onClick={onClose}
              className="w-1/2 py-2 rounded-xl border border-gray-300 hover:bg-gray-100"
            >
              Later
            </button>

            <button
              onClick={() => {
                onClose();
                onUpdate(password); // 🔥 OPEN EDIT MODAL
              }}
              className="w-1/2 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white font-semibold"
            >
              Update Now
            </button>
          </div>

        </div>
      </div>
    );
  };


  const handleOpenEditPassword = (password: PasswordEntry) => {
    setEditingPassword(password);   // 🎯 exact password
    setShowEditModal(true);
  };





  // ----------------------------
  // Conditional rendering
  // ----------------------------
  if (showExpiryModal && expiredPassword) {
    return (
      <PasswordExpiryModal
        password={expiredPassword}
        onClose={() => setShowExpiryModal(false)}
        onUpdate={handleOpenEditPassword}
      />
    );
  }











  const handleAddPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (checkPasswordReuse(passwordformData.password)) {
      setShowReuseWarning(true); // 👈 open modal instead of alert
      return;
    }

    try {
      await apiService.addPassword(passwordformData);

      // setPasswords(prev => [password, ...prev]);
      setPasswordFormData({ website: '', username: '', password: '', category: 'General', notes: '', isFinancial: false });
      setShowAddForm(false);
      loadPasswords();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add password');
    }
  };





  const handleUpdatePassword = async (e: React.FormEvent) => {
    // const data = await apiService.getPasswords({ params: { t: Date.now() } });
    e.preventDefault();

    if (
      checkPasswordReuse(passwordformData.password) &&
      passwordformData.password !== currentPassword
    ) {
      setShowReuseWarning(true); // 👈 open modal instead of aler
      return;
    }

    if (!editingPassword) return;

    try {
      await apiService.updatePassword(editingPassword._id, {
        ...passwordformData,
        currentPassword,
      });

      setPasswords(prev =>
        prev.map(item =>
          item._id === editingPassword._id
            ? { ...item, ...passwordformData }
            : item
        )
      );

      // ✅ Instead of just updating state manually, fetch fresh data
      await loadPasswords(Date.now());
      setSuccessMessage('Password updated successfully!');
      setShowEditModal(false);
      setEditingPassword(null);

      setPasswordFormData({ website: '', username: '', password: '', category: '', notes: '', isFinancial: false });
    } catch (err: any) {
      if (err.response?.status === 403 && err.response?.data?.error?.includes("Current password does not match")) {
        setError("Incorrect current password. Please try again.");
      } else if (err.response?.status === 401) {
        setError("Your session has expired. Please log in again.");
        logout();
        navigate("/HomePageBeforeLogin");
      } else {
        setError(err instanceof Error ? err.message : 'Failed to update password');
      }
    }
  };




  const handleDeletePassword = async (_id: string) => {
    if (!_id) return;
    setIsDeleting(_id);
    try {
      await apiService.deletePassword(_id);

      // Optimistically update UI: remove from local state immediately to avoid stale display
      setPasswords((prev) => prev.filter((p) => p._id !== _id));
      setFilteredPasswords((prev) => prev.filter((p) => p._id !== _id));

      // If the currently viewing password was deleted, close the view modal
      if (viewingPassword && viewingPassword._id === _id) {
        setShowPassword(false);
        setViewingPassword(null);
      }

      // Refresh from server to ensure full consistency
      await loadPasswords(Date.now());
    } catch (err) {
      console.error('Error deleting password:', err);
      setError(err instanceof Error ? err.message : 'Failed to delete password');
    } finally {
      setIsDeleting(null);
      setConfirmId(null);
    }
  };



  const handleViewPassword = (passwordId: string) => {

    setConfirmId(passwordId); // store which password user wants to view
    // setShowReverifyPinModal(true); // open PIN modal
    const freshPassword = passwords.find(p => p._id === passwordId);
    if (freshPassword) {
      setViewingPassword(freshPassword);
      setShowPassword(true);               // open view modal
      setShowViewingPassword(false);       // start masked by default
    }
  };

  const handleScoreRisk = async () => {
    setIsScoringRisk(true);
    setRiskScoreError(null);
    try {
      const results = await apiService.scoreAllCredentials();
      if (!Array.isArray(results)) return;

      // Build an O(1) lookup map so the setPasswords update is O(n) not O(n²)
      const resultMap = new Map(results.map(r => [r._id, r]));

      setPasswords(prev =>
        prev.map(p => {
          const hit = resultMap.get(p._id);
          if (!hit) return p;
          return {
            ...p,
            riskScore:   hit.score,
            riskLevel:   hit.level as PasswordEntry['riskLevel'],
            riskSummary: hit.summary,
          };
        })
      );
    } catch (err: unknown) {
      setRiskScoreError(err instanceof Error ? err.message : 'Risk scoring failed');
    } finally {
      setIsScoringRisk(false);
    }
  };


  const handleCheckBreaches = async () => {
    setIsCheckingBreaches(true);
    setBreachCheckError(null);
    try {
      const results = await apiService.checkAllBreaches();
      setPasswords(prev =>
        prev.map(p => {
          const hit = results.find(r => r._id === p._id);
          return hit ? { ...p, isBreached: hit.isBreached, breachCount: hit.breachCount } : p;
        })
      );
    } catch (err: any) {
      setBreachCheckError(err.message || 'Breach check failed');
    } finally {
      setIsCheckingBreaches(false);
    }
  };

  const generatePassword = () => {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
    const length = 16;
    const buf = new Uint32Array(length);
    crypto.getRandomValues(buf);
    let password = '';
    for (let i = 0; i < length; i++) {
      password += alphabet[buf[i] % alphabet.length];
    }
    setPasswordFormData({ ...passwordformData, password });
  };

  // Inside your component

  const handleCopy = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(id); // store the copied card's ID
      setTimeout(() => setCopied(null), 2000); // hide after 2 seconds
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };



  // 🧩 Password Reuse Detection
  const checkPasswordReuse = (newPassword: string) => {
    if (!newPassword || !Array.isArray(passwords)) return false;
    return passwords.some(
      (entry) => toSafeString(entry.password).trim() === newPassword.trim()
    );
  };




  const handleLogout = async () => {
    try {
      // Call backend to clear cookies (if using httpOnly or session cookies)
      await fetch(`${API_BASE_URL}/auth/logout`, {
        method: 'POST',
        credentials: 'include', // important to include cookies
      });
    } catch (err) {
      console.error('Failed to call logout endpoint', err);
    } finally {
      // Remove token from localStorage
      localStorage.removeItem('token');
      localStorage.removeItem('googleToken');
      navigate('/');
    }
  };
  const cardCount = passwords.length;
  const gridColsClass = cardCount === 1
    ? 'grid-cols-1' // Base is 1
    : cardCount === 2
      ? 'lg:grid-cols-2' // Force 2 columns on large screens
      : 'lg:grid-cols-3'; // Default 3 columns
  const token = localStorage.getItem('token');
  const plan = localStorage.getItem('plan');

  return (

    <div className="flex flex-col min-h-screen bg-gradient-to-br from-blue-100 via-blue-200 to-blue-300 dark:from-gray-900 dark:via-gray-800 dark:to-gray-700">
      <title>Password Manager</title>

      <Header
        token={token || ""}
        handleLogout={handleLogout}
        profileImage={profileImage}
      />

      {suspiciousAlert && (
        <div className="bg-red-600 text-white px-4 py-3 flex items-center justify-between gap-4 z-50 shadow-lg">
          <div className="flex items-center gap-3 flex-wrap">
            <ShieldAlert className="w-5 h-5 flex-shrink-0" />
            <span className="text-sm font-semibold">{suspiciousAlert.message}</span>
            {suspiciousAlert.ip && (
              <span className="text-xs bg-red-800 px-2 py-0.5 rounded font-mono">IP: {suspiciousAlert.ip}</span>
            )}
            {suspiciousAlert.location && (
              <span className="text-xs opacity-80">{suspiciousAlert.location}</span>
            )}
          </div>
          <button onClick={() => setSuspiciousAlert(null)} className="hover:opacity-70 transition flex-shrink-0" aria-label="Dismiss">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <title> Password Manager </title>
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
          <br />
        </div>


        <main className="flex-1 px-6 py-4 md:py-6 lg:py-8">
          {/* Back Button */}



          {/* Header */}
          <div className="mt-6 mb-8">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white drop-shadow">
                  🔐 Password Manager
                </h1>
                <p className="text-gray-700 dark:text-gray-300 mt-1">Welcome, <span className="font-semibold">{user?.email}</span></p>
              </div>

            </div>
          </div>


          <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Total Passwords Stored */}
            <div className="bg-gradient-to-br from-blue-400 to-blue-600 rounded-xl p-6 flex flex-col items-center justify-center text-white shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105">
              <div className="text-4xl font-extrabold">{totalPasswords}</div>
              <div className="mt-2 text-lg font-medium">Total Passwords</div>
            </div>

            {/* Total Strong Passwords */}
            <div className="bg-gradient-to-br from-yellow-400 to-yellow-600 rounded-xl p-6 flex flex-col items-center justify-center text-white shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105">
              <div className="text-4xl font-extrabold">{strongPasswords}</div>
              <div className="mt-2 text-lg font-medium">Strong Passwords</div>
            </div>



            {/* Total Weak Passwords */}
            <div className="bg-gradient-to-br from-red-400 to-red-600 rounded-xl p-6 flex flex-col items-center justify-center text-white shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105">
              <div className="text-4xl font-extrabold">{weakPasswords}</div>
              <div className="mt-2 text-lg font-medium">Weak Passwords</div>
            </div>

            {/* Passwords Changed in Last 90 Days */}
            <div className="bg-gradient-to-br from-purple-400 to-purple-600 rounded-xl p-6 flex flex-col items-center justify-center text-white shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105">
              <div className="text-4xl font-extrabold">{passwordsChanged90Days}</div>
              <div className="mt-2 text-lg font-medium">Changed in 90 Days</div>
            </div>
          </div>
          {/* Plan Status Card */}




          {/* <div className={`bg-gradient-to-br ${plan === 'free'
            ? 'from-orange-400 to-orange-600'
            : 'from-emerald-400 to-emerald-600'
            } rounded-xl p-6 flex flex-col items-center justify-center text-white shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105`}>
            <div className="text-3xl font-extrabold">{plan === 'free' ? 'FREE' : 'PREMIUM'}</div>
            <div className="mt-1 text-sm font-medium opacity-90">
              {plan === 'free'
                ? 'FREE'
                : 'PREMIUM'
              }
            </div>
          </div> */}


          {/* ── Prioritized Action Queue ───────────────────────────── */}
          <div className="mt-8 bg-white dark:bg-gray-800 shadow-xl rounded-2xl p-6 border border-gray-200 dark:border-gray-700">
            <div className="flex items-start justify-between mb-5 flex-wrap gap-3">
              <div>
                <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
                  <ShieldAlert className="w-5 h-5 text-red-500" />
                  Fix These First
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                  Top credentials ranked by risk — highest impact actions first
                </p>
              </div>
              {actionQueue.filter(p => p.riskLevel === 'critical' || p.riskLevel === 'high').length > 0 && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-700 border border-red-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse inline-block" />
                  {actionQueue.filter(p => p.riskLevel === 'critical' || p.riskLevel === 'high').length} urgent
                </span>
              )}
            </div>

            {passwords.length === 0 ? (
              <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-6">
                No credentials in vault yet.
              </p>
            ) : actionQueue.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-8 text-center">
                <BarChart3 className="w-10 h-10 text-gray-300 dark:text-gray-600" />
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Run <span className="font-semibold text-violet-600">Score Risk</span> above to see your prioritized action list.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {actionQueue.map((p, idx) => {
                  const style = RISK_STYLES[p.riskLevel as RiskLevel] ?? RISK_STYLES.medium;
                  const ageInDays = p.lastChanged
                    ? Math.floor((Date.now() - new Date(p.lastChanged).getTime()) / 86_400_000)
                    : null;
                  const isReused = (reuseMap[p.password] ?? 0) > 1;
                  const isWeak = p.password.length <= 10;

                  const tags: { label: string; color: string; title: string }[] = [];
                  if (p.isBreached) tags.push({ label: 'Breached', color: 'bg-red-100 text-red-700', title: 'This password was found in a known data breach — it should be changed immediately' });
                  if (isReused) tags.push({ label: 'Reused', color: 'bg-orange-100 text-orange-700', title: 'Same password used on multiple sites — a breach on one exposes all of them' });
                  if (isWeak) tags.push({ label: 'Weak', color: 'bg-yellow-100 text-yellow-700', title: 'Password is 10 characters or fewer — use at least 12 with mixed symbols and digits' });
                  if (ageInDays && ageInDays > 180) tags.push({ label: `${ageInDays}d old`, color: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300', title: `Last changed ${ageInDays} days ago — passwords older than 180 days should be rotated` });
                  if (p.isFinancial) tags.push({ label: 'Financial', color: 'bg-amber-100 text-amber-700', title: 'This site handles financial data — apply extra scrutiny to its security posture' });

                  return (
                    <div
                      key={p._id}
                      className="flex items-center gap-4 p-4 rounded-xl border border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/40 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                    >
                      {/* Rank + score */}
                      <div className="flex flex-col items-center gap-1 shrink-0">
                        <span className="text-xs font-bold text-gray-400 dark:text-gray-500">#{idx + 1}</span>
                        <div className={`w-12 h-12 rounded-xl flex flex-col items-center justify-center shadow-sm ${style.bg} ${style.text} shrink-0`}>
                          <span className="text-sm font-bold leading-none">{p.riskScore}</span>
                          <span className="text-[9px] font-semibold leading-tight uppercase tracking-wide opacity-90">{style.label}</span>
                        </div>
                      </div>

                      {/* Site icon */}
                      <div className={`w-10 h-10 ${getWebsiteColor(p.website)} rounded-lg flex items-center justify-center text-white font-bold text-sm shadow shrink-0`}>
                        {getWebsiteIcon(p.website)}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-gray-800 dark:text-gray-100 truncate">{p.website}</span>
                          <span className="text-xs text-gray-400 dark:text-gray-500 truncate">{p.username}</span>
                        </div>
                        {p.riskSummary && (
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-1">{p.riskSummary}</p>
                        )}
                        {tags.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            {tags.map(t => (
                              <span key={t.label} title={t.title} className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold cursor-help ${t.color}`}>
                                {t.label}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Fix CTA */}
                      <a
                        href={getChangePasswordUrl(p.website)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="shrink-0 inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700 text-white shadow transition-all hover:shadow-md"
                      >
                        Fix <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  );
                })}

                {passwords.filter(q => q.riskScore != null).length > 5 && (
                  <p className="text-xs text-center text-gray-400 dark:text-gray-500 pt-1">
                    Showing top 5 of {passwords.filter(q => q.riskScore != null).length} scored credentials
                  </p>
                )}
              </div>
            )}
          </div>
          {/* ── End Action Queue ───────────────────────────────────── */}

          <br />

          {/* Saved Passwords */}
          <div className="bg-white dark:bg-gray-800 shadow-xl rounded-2xl p-6 border border-gray-200 dark:border-gray-700">
            <div className="flex justify-between items-center mb-6 flex-wrap gap-3">
              <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">Your Saved Passwords</h2>
              <div className="flex items-center gap-2 flex-wrap">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        onClick={handleCheckBreaches}
                        disabled={isCheckingBreaches || passwords.length === 0}
                        className="px-4 py-2 rounded-xl shadow-md transition bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                      >
                        <ShieldAlert className="w-4 h-4" />
                        {isCheckingBreaches ? 'Checking...' : 'Check Breaches'}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Check all passwords against Have I Been Pwned</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                {breachCheckError && (
                  <span className="text-xs text-red-500">{breachCheckError}</span>
                )}

                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        onClick={handleScoreRisk}
                        disabled={isScoringRisk || passwords.length === 0}
                        className="px-4 py-2 rounded-xl shadow-md transition bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700 text-white hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                      >
                        <BarChart3 className="w-4 h-4" />
                        {isScoringRisk ? 'Scoring...' : 'Score Risk'}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>AI risk score per credential (breach · age · reuse · strength)</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                {riskScoreError && (
                  <span className="text-xs text-red-500">{riskScoreError}</span>
                )}

                <Button
                  onClick={() => setShowAddForm(true)}
                  className="px-5 py-2 rounded-xl shadow-md transition bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white hover:shadow-lg"
                >
                  + Add New
                </Button>
              </div>
            </div>




            {/* 🔍 Search / Filter Bar */}
            <div className="mb-6">
              <input
                type="text"
                placeholder="Search passwords (by website, username, or notes)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full p-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-indigo-500 focus:outline-none shadow-sm"
              />
            </div>

            {isLoading ? (
              <div className="flex flex-col items-center py-10">
                <div className="animate-spin h-10 w-10 border-4 border-blue-500 border-t-transparent rounded-full"></div>
                <p className="mt-3 text-gray-600 dark:text-gray-400">Loading passwords...</p>
              </div>
            ) : filteredPasswords.length === 0 ? (
              <div className="bg-gray-50 dark:bg-gray-700/30 p-8 rounded-lg text-center border border-dashed border-gray-300 dark:border-gray-600">
                <p className="text-gray-500 dark:text-gray-400">
                  {searchQuery
                    ? `No results found for "${searchQuery}".`
                    : `No passwords yet. Click + Add New to get started!`}
                </p>
              </div>
            ) : (
              <div className={`grid gap-6 grid-cols-1 sm:grid-cols-2 ${gridColsClass}`}>
                {filteredPasswords.map((password) => (
                  <div
                    key={password._id}
                    className={`
        w-full 
        bg-gradient-to-br ${password.password.length <= 5
                        ? 'from-red-400 to-red-600'
                        : 'from-blue-400 to-blue-600'
                      }
        text-white 
        rounded-3xl 
        p-6 
        shadow-lg 
        hover:shadow-xl 
        hover:scale-105 
        transition-all 
        duration-300 
        transform 
        group
        ${cardCount === 1 ? 'col-span-full' : ''} 
      `}
                  >
                    <div className="flex items-center justify-between mb-5">
                      <div
                        className={`
            w-14 h-14
            ${getWebsiteColor(password.website)}
            rounded-xl
            flex items-center justify-center
            text-white font-semibold text-xl
            shadow-lg
          `}
                      >
                        {getWebsiteIcon(password.website)}
                      </div>

                      <div className="flex items-center gap-2">
                        {/* Risk score badge — always visible once scored */}
                        {password.riskScore != null && password.riskLevel && (() => {
                          const style = RISK_STYLES[password.riskLevel as RiskLevel] ?? RISK_STYLES.medium;
                          return (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div className={`flex flex-col items-center justify-center w-12 h-12 rounded-xl shadow ${style.bg} ${style.text} cursor-default select-none`}>
                                    <span className="text-sm font-bold leading-none">{password.riskScore}</span>
                                    <span className="text-[9px] font-semibold leading-tight opacity-90 uppercase tracking-wide">{style.label}</span>
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent side="bottom" className="max-w-[220px] text-center">
                                  <p className="font-semibold mb-1">Risk: {style.label} ({password.riskScore}/100)</p>
                                  {password.riskSummary && <p className="text-xs">{password.riskSummary}</p>}
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          );
                        })()}

                      <div className="flex gap-3 opacity-0 group-hover:opacity-100 transition">
                        <div className="flex gap-3">
                          {/* Copy Button with Tooltip */}

                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger>
                                <Button
                                  variant="outline"
                                  size="icon"
                                  className="hover:bg-blue-100 hover:text-blue-600 rounded-full transition"
                                  onClick={() => handleCopy(password.password, password._id)}                                >
                                  <Copy />
                                </Button>

                                {copied === password._id && (
                                  <div className="fixed inset-0 flex items-center justify-center bg-black/40 backdrop-blur-sm z-50">
                                    <div className="bg-white text-green-700 px-5 py-4 rounded-2xl shadow-2xl text-sm font-medium animate-fadeInOut">
                                      ✅ Password successfully copied to clipboard!
                                    </div>
                                  </div>
                                )}



                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Copy Password</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>

                <TooltipProvider>
  <Tooltip>
    <TooltipTrigger asChild>
      <Button
        variant="outline"
        size="icon"
        className="hover:bg-green-100 hover:text-green-600 rounded-full transition"
        onClick={() => {
          setConfirmId(password._id);
          setPinAction("view");

          if (shouldRequirePin()) {
            console.log('🔒 PIN required for viewing');
            setShowReverifyPinModal(true);
          } else {
            console.log('✅ No PIN required, showing password directly');
            handleViewPassword(password._id);
          }
        }}
      >
        <Eye className="w-4 h-4" />
      </Button>
    </TooltipTrigger>
    <TooltipContent>View Password</TooltipContent>
  </Tooltip>
</TooltipProvider>

  <TooltipProvider>
  <Tooltip>
    <TooltipTrigger asChild>
      <Button
        variant="outline"
        size="icon"
        className="hover:bg-yellow-100 hover:text-yellow-600 rounded-full transition"
        onClick={() => {
          setConfirmId(password._id);
          setPinAction("edit");

          if (shouldRequirePin()) {
            console.log('🔒 PIN required for editing');
            setShowReverifyPinModal(true);
          } else {
            console.log('✅ No PIN required, opening edit modal directly');
            const pwdToEdit = passwords.find(p => p._id === password._id);
            if (pwdToEdit) {
              setEditingPassword(pwdToEdit);
              setPasswordFormData({
                website: pwdToEdit.website,
                username: pwdToEdit.username,
                password: '', // Never prefill
                category: pwdToEdit.category,
                notes: pwdToEdit.notes,
                isFinancial: pwdToEdit.isFinancial ?? false,
              });
              setCurrentPassword('');
              setShowEditModal(true);
            }
          }
        }}
      >
        <Pencil className="w-4 h-4" />
      </Button>
    </TooltipTrigger>
    <TooltipContent>Edit Password</TooltipContent>
  </Tooltip>
</TooltipProvider>

                          {/* Delete Button */}
<TooltipProvider>
  <Tooltip>
    <TooltipTrigger asChild>
      <Button
        variant="outline"
        size="icon"
        className="hover:bg-red-100 hover:text-red-600 rounded-full transition"
        onClick={() => {
          setConfirmId(password._id);
          setPinAction("delete");

          if (shouldRequirePin()) {
            console.log('🔒 PIN required for deleting');
            setShowReverifyPinModal(true);
          } else {
            console.log('✅ No PIN required, showing delete confirmation directly');
            setShowDeleteConfirmationModal(true);
          }
        }}
      >
        <Trash2 className="w-4 h-4" />
      </Button>
    </TooltipTrigger>
    <TooltipContent>Delete Password</TooltipContent>
  </Tooltip>
</TooltipProvider>

                        </div>

                        <Dialog open={showCopyModal} onOpenChange={setShowCopyModal}>
                          <DialogContent className="sm:max-w-xs rounded-2xl shadow-lg border border-green-200 bg-green-50 p-6 text-center">
                            <DialogHeader>
                              <div className="flex flex-col items-center gap-3">
                                {/* ✅ Success Icon */}
                                <div className="w-12 h-12 flex items-center justify-center rounded-full bg-green-100">
                                  <span className="text-green-600 text-2xl">✅</span>
                                </div>

                                {/* Title */}
                                <DialogTitle className="text-lg font-semibold text-green-700">
                                  Password copied!
                                </DialogTitle>

                                {/* Subtext */}
                                <p className="text-sm text-gray-600">
                                  The password has been successfully copied to your clipboard.
                                </p>
                              </div>
                            </DialogHeader>
                          </DialogContent>
                        </Dialog>




                        {/* Delete confirmation hoisted to top-level to ensure consistent stacking and to prevent background interaction. */}
                      </div>
                      </div>{/* end flex items-center gap-2 */}
                    </div>

                    {/* Info */}
                    < div className="space-y-1" >
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold truncate">{password.website}</p>
                        {password.isFinancial && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                            Financial
                          </span>
                        )}
                        {password.isBreached && (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-700 cursor-default">
                                  <ShieldAlert className="w-3 h-3" />
                                  Breached{password.breachCount ? ` ×${password.breachCount.toLocaleString()}` : ''}
                                </span>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>This password appeared in {password.breachCount?.toLocaleString() ?? 'known'} data breach{(password.breachCount ?? 0) !== 1 ? 'es' : ''}. Change it immediately.</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                      </div>
                      <p className="text-sm opacity-80">Username</p>
                      <p className="font-semibold truncate">{password.username}</p>
                      {password.category && password.category !== 'General' && (
                        <p className="text-xs opacity-70">{password.category}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )
            }

            {/* Hoisted Delete Confirmation Modal (renders once at top-level, above other modals) */}
            {showDeleteConfirmationModal && confirmId && (
              <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-60">
                <div className="bg-white rounded-lg p-6 w-full max-w-sm shadow-lg">
                  <h3 className="text-lg font-bold mb-3">Confirm Delete</h3>
                  <p className="text-gray-600 mb-4">Are you sure you want to delete <strong>{passwords.find(p => p._id === confirmId)?.website || 'this password'}</strong>?</p>

                  <div className="flex justify-end gap-3">
                    <button
                      onClick={() => { setShowDeleteConfirmationModal(false); setConfirmId(null); }}
                      className="px-4 py-2 bg-gray-200 rounded-md hover:bg-gray-300"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={async () => {
                        if (confirmId) {
                          await handleDeletePassword(confirmId);
                          setShowDeleteConfirmationModal(false);
                          setShowReverifyPinModal(false);
                          setReverifyPinInput('');
                          setPinError(false);
                        }
                      }}
                      className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
                    >
                      {isDeleting === confirmId ? 'Deleting...' : 'Delete'}
                    </button>

                  </div>

                </div>
              </div>
            )}

            {
              showReverifyPinModal && !pinError && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                  <div className="bg-white p-6 rounded-2xl w-full max-w-sm shadow-lg flex flex-col items-center">

                    <Logo />
                    {/* Modal Title */}
                    <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4 text-center">
                      Re-enter PIN to Confirm
                    </h3>
                    <form onSubmit={validateReverifyPin} className="space-y-4">
                      <input
                        type="email"
                        value={user?.email || ""}
                        className="w-full px-3 py-2 border border-gray-300 bg-gray-100 text-gray-700 rounded-md cursor-not-allowed"
                        disabled
                      />

                      <div>
                        <input
                          type="password"
                          value={reverifyPinInput}
                          maxLength={4}

                          onChange={(e) => setReverifyPinInput(e.target.value.replace(/\D/g, ''))}
                          placeholder="Enter PIN"
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        {reverifyPinError && (
                          <p className="text-sm text-red-600 mt-1">{reverifyPinError}</p>
                        )}
                      </div>

                      <div className="flex justify-end">
                        <Button
                          type="submit"
                          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md"
                        >
                          Confirm
                        </Button>
                      </div>
                    </form>
                  </div>
                </div>
              )
            }



            <Dialog open={showReuseWarning} onOpenChange={setShowReuseWarning}>
              <DialogContent className="sm:max-w-md rounded-2xl shadow-lg border border-blue-300 bg-blue-50 p-6 text-center">
                <DialogHeader>
                  <div className="flex flex-col items-center gap-3">
                    {/* ⚠️ Warning Icon */}
                    <div className="w-12 h-12 flex items-center justify-center rounded-full bg-blue-100">
                      <span className="text-blue-600 text-2xl">⚠️</span>
                    </div>

                    {/* Title */}
                    <DialogTitle className="text-lg font-semibold text-blue-700">
                      Password Reuse Detected
                    </DialogTitle>

                    {/* Subtext */}
                    <p className="text-sm text-gray-700">
                      This password is already used for another account.
                      Please choose a unique password to enhance your security.
                    </p>

                    {/* Close Button */}
                    <div className="mt-5">
                      <Button
                        onClick={() => setShowReuseWarning(false)}
                        className="bg-blue-500 hover:bg-blue-600 text-white px-5 py-2 rounded-xl shadow-md transition"
                      >
                        Okay, Got it
                      </Button>
                    </div>
                  </div>
                </DialogHeader>
              </DialogContent>
            </Dialog>



            {
              showReverifyPinModal && pinError && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                  <div className="bg-white dark:bg-gray-900 p-6 rounded-2xl shadow-2xl w-full max-w-sm border border-red-200">

                    <Logo />

                    <h3 className="text-xl font-bold text-red-600 dark:text-red-400 mb-2 flex items-center gap-2">
                      ⚠️ Incorrect PIN
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
                      Please re-enter your PIN to confirm access.
                    </p>

                    <form onSubmit={validateReverifyPin} className="space-y-4">
                      <input
                        type="email"
                        value={user?.email || ""}
                        className="w-full px-3 py-2 border border-gray-300 bg-gray-100 text-gray-500 rounded-md cursor-not-allowed"
                        disabled
                      />

                      <div>
                        <input
                          type="password"
                          value={reverifyPinInput}
                          maxLength={4}
                          onChange={(e) => setReverifyPinInput(e.target.value.replace(/\D/g, ''))}
                          placeholder="Enter PIN"
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
                        />
                        {reverifyPinError && (
                          <p className="text-sm text-red-600 mt-1">{reverifyPinError}</p>
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
              )
            }



            {
              showPassword && viewingPassword && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                  <div className="bg-white dark:bg-gray-800 p-6 rounded-lg w-full max-w-md">

                    <Logo />
                    <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4">View Password Details</h3>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Website</label>
                        <input
                          type="text"
                          value={viewingPassword.website}
                          disabled
                          className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-100"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Username</label>
                        <input
                          type="text"
                          value={viewingPassword.username}
                          disabled
                          className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-100"
                        />
                      </div>
                      <div className="relative">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Password
                        </label>



                        <input
                          type={showViewingPassword ? "text" : "password"} // toggles mask/unmask for view modal only
                          value={viewingPassword?.password || ""}
                          disabled
                          className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-100 pr-12"
                        />

                        <button
                          type="button"
                          onClick={toggleShowPassword}
                          className="absolute right-3 top-1/2 transform -translate-y-1/2 text-sm text-blue-600 hover:text-blue-800 focus:outline-none"
                        >
                          {showViewingPassword ? "Hide" : "Show"}
                        </button>
                      </div>
                      {/* Close Button */}
                      <div className="flex justify-end mt-4">
                        <Button
                          onClick={() => {
                            setShowPassword(false);
                            setViewingPassword(null);
                          }}
                          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md"
                        >
                          Close
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              )
            }




            {showExpiryModal && expiredPassword && (
              <PasswordExpiryModal
                password={expiredPassword}
                onClose={() => setShowExpiryModal(false)}
                onUpdate={handleOpenEditPassword}
              />
            )}






            {
              showEditModal && (

                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                  <div className="bg-white dark:bg-gray-800 p-6 rounded-lg w-full max-w-md">

                    <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4">Edit Password</h3>

                    {successMessage && (
                      <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-2 rounded mb-4">
                        {successMessage}
                      </div>
                    )}
                    <form onSubmit={handleUpdatePassword} className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Website URL
                        </label>
                        <input
                          type="text"
                          value={passwordformData.website}
                          disabled
                          // onChange={(e) => setPasswordFormData({ ...passwordformData, website: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          required
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Username
                        </label>
                        <input
                          type="text"
                          value={passwordformData.username}
                          disabled
                          // onChange={(e) => setPasswordFormData({ ...passwordformData, username: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mt-4">
                          Current Password
                        </label>
                        <div className="relative">
                          <input
                            type={showCurrentPassword ? "text" : "password"}
                            className="mt-1 p-2 border w-full rounded pr-10 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            value={currentPassword}
                            onChange={(e) => setCurrentPassword(e.target.value)}
                            required
                            placeholder="Enter current password"
                          />
                          <button
                            type="button"
                            onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                            className="absolute inset-y-0 right-3 flex items-center text-gray-500 hover:text-gray-700"
                          >
                            {showCurrentPassword ? "Hide" : "Show"}
                          </button>
                        </div>
                      </div>

                      {/* New Password */}
                      <div className="mt-4">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          New Password
                        </label>

                        <div className="relative">
                          <input
                            type={showNewPassword ? "text" : "password"}
                            value={passwordformData.password || ""}
                            onChange={(e) =>
                              setPasswordFormData({ ...passwordformData, password: e.target.value })
                            }
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 pr-10"
                            placeholder="Enter new password"
                            autoComplete="new-password" // 🧠 prevents browser autofill
                          />

                          <button
                            type="button"
                            onClick={() => setShowNewPassword(!showNewPassword)}
                            className="absolute inset-y-0 right-3 flex items-center text-gray-500 hover:text-gray-700"
                          >
                            {showNewPassword ? "Hide" : "Show"}
                          </button>
                        </div>
                        {/* 
                        <Button
                          type="button"
                          onClick={() => {
                            generatePassword();
                          }}
                          className="bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded-md mt-2"
                        >
                          Generate
                        </Button> */}
                      </div>

                      <Button
                        type="button"
                        onClick={generatePassword}
                        className="bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded-md mt-2"
                      >
                        Generate
                      </Button>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Category
                        </label>
                        <select
                          value={passwordformData.category}
                          onChange={(e) => setPasswordFormData({ ...passwordformData, category: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700"
                        >
                          {['General', 'Social', 'Email', 'Finance', 'Shopping', 'Developer', 'Streaming', 'Work', 'Other'].map(c => (
                            <option key={c} value={c}>{c}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Notes
                        </label>
                        <textarea
                          value={passwordformData.notes}
                          onChange={(e) => setPasswordFormData({ ...passwordformData, notes: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          rows={3}
                        />
                      </div>

                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          id="isFinancialEdit"
                          checked={passwordformData.isFinancial}
                          onChange={(e) => setPasswordFormData({ ...passwordformData, isFinancial: e.target.checked })}
                          className="w-4 h-4 text-yellow-600 border-gray-300 rounded focus:ring-yellow-500"
                        />
                        <label htmlFor="isFinancialEdit" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                          Mark as Financial (banking, payments, investments)
                        </label>
                      </div>

                      <div className="flex justify-end gap-2 pt-4">
                        <Button
                          type="button"
                          onClick={() => {
                            setShowEditModal(false);
                            setEditingPassword(null);
                          }}
                          className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-md"
                        >
                          Cancel
                        </Button>
                        <Button
                          type="submit"
                          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md"
                        >
                          Update
                        </Button>
                      </div>
                    </form>
                  </div>
                </div>
              )
            }







            {/* Add Password Form */}
            {
              showAddForm && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                  <div className="bg-white dark:bg-gray-800 p-6 rounded-lg w-full max-w-md">
                    <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4">Add New Password</h3>
                    <form onSubmit={handleAddPassword} className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Website/Service
                        </label>

                        <select
                          value={passwordformData.website}
                          onChange={(e) =>
                            setPasswordFormData({
                              ...passwordformData,
                              website: e.target.value,
                            })
                          }
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                          required
                        >
                          <option value="">Select a website</option>
                          <option value="Facebook">Facebook</option>
                          <option value="Instagram">Instagram</option>
                          <option value="Twitter">Twitter</option>
                          <option value="LinkedIn">LinkedIn</option>
                          <option value="Gmail">Gmail</option>
                          <option value="Outlook">Outlook</option>
                          <option value="GitHub">GitHub</option>
                          <option value="GitLab">GitLab</option>
                          <option value="Amazon">Amazon</option>
                          <option value="Flipkart">Flipkart</option>

                          <option value="Groww.in">Groww.in</option>

                          <option value="Paytm">Paytm</option>
                          <option value="PhonePe">PhonePe</option>
                          <option value="Netflix">Netflix</option>
                          <option value="Hotstar">Hotstar</option>
                          <option value="Custom">Other (Enter manually)</option>
                        </select>

                        {/* Conditional input for "Other / Custom" */}
                        {passwordformData.website === "Custom" && (
                          <input
                            type="text"
                            placeholder="Enter website name"
                            onChange={(e) =>
                              setPasswordFormData({
                                ...passwordformData,
                                website: e.target.value,
                              })
                            }
                            className="mt-2 w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            required
                          />
                        )}
                      </div>


                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Username/Email
                        </label>
                        <input
                          type="text"
                          value={passwordformData.username}
                          onChange={(e) => setPasswordFormData({ ...passwordformData, username: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder='Enter your username'
                          required
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Password
                        </label>
                        <div className="flex space-x-2 items-center">
                          <div className="relative flex-1">
                            <input
                              type={showPassword ? "text" : "password"}
                              value={passwordformData.password}
                              onChange={(e) =>
                                setPasswordFormData({ ...passwordformData, password: e.target.value })
                              }
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 pr-10"
                              placeholder="Enter your password"
                              required
                            />
                            <button
                              type="button"
                              onClick={() => setShowPassword(!showPassword)}
                              className="absolute inset-y-0 right-2 flex items-center text-gray-500 hover:text-gray-700"
                            >
                              {showPassword ? "Hide" : "Show"}
                            </button>
                          </div>

                          <Button
                            type="button"
                            onClick={generatePassword}
                            className="bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded-md"
                          >
                            Generate
                          </Button>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Category
                          </label>
                          <select
                            value={passwordformData.category}
                            onChange={(e) => setPasswordFormData({ ...passwordformData, category: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700"
                          >
                            {['General', 'Social', 'Email', 'Finance', 'Shopping', 'Developer', 'Streaming', 'Work', 'Other'].map(c => (
                              <option key={c} value={c}>{c}</option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Notes
                          </label>
                          <textarea
                            value={passwordformData.notes}
                            onChange={(e) => setPasswordFormData({ ...passwordformData, notes: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            rows={3}
                          />
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          id="isFinancialAdd"
                          checked={passwordformData.isFinancial}
                          onChange={(e) => setPasswordFormData({ ...passwordformData, isFinancial: e.target.checked })}
                          className="w-4 h-4 text-yellow-600 border-gray-300 rounded focus:ring-yellow-500"
                        />
                        <label htmlFor="isFinancialAdd" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                          Mark as Financial (banking, payments, investments)
                        </label>
                      </div>



                      <div className="flex justify-end gap-2 pt-4">
                        <Button
                          type="button"
                          onClick={() => setShowAddForm(false)}
                          className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-md"
                        >
                          Cancel
                        </Button>
                        <Button
                          type="submit"
                          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md"
                        >
                          Save
                        </Button>
                      </div>
                    </form>
                  </div>
                </div>
              )
            }

            {
              error && (
                <div className="fixed bottom-4 right-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
                  {error}
                  <button
                    onClick={() => setError('')}
                    className="ml-2 text-red-500 hover:text-red-700"
                  >
                    ×
                  </button>
                </div>
              )
            }
          </div >
        </main >
      </div >








      <Footer />
    </div >
  );
};
