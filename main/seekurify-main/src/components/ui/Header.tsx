import React, { useState, useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import defaultProfileIcon from "../../assets/default-profile.png";
import { Bell } from "lucide-react";
import { API_BASE_URL } from "../../services/api";
import { jwtDecode } from "jwt-decode";
import { authService } from "../../services/authService";

interface HeaderProps {
  profileImage?: string;
  token: string;
  handleLogout: () => void | Promise<void>;
}


type TokenPayload = {
  id: string;
  role: "admin" | "user";
  exp: number;
};

const navItems = [
  { name: "Analyze Malware", path: "/malware-analysis" },
  { name: "Password Manager", path: "/dashboard" },
  { name: "SIEM Dashboard", path: "/siem-dashboard" },
  { name: "Security Awareness", path: "/securityAwareness" },
  { name: "Contact Us", path: "/contact" },
];

// Helper: Time formatter
const formatTimeAgo = (timestamp: string) => {
  const diff = Date.now() - new Date(timestamp).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
};

const Header: React.FC<HeaderProps> = ({
  profileImage,
  handleLogout,
}) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const notificationRef = useRef<HTMLDivElement>(null);


  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loadingNotifications, setLoadingNotifications] = useState(true);

  const fetchNotifications = async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) return;

      const res = await fetch(`${API_BASE_URL}/auth/notifications`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) throw new Error(`Failed to fetch notifications: ${res.status}`);

      const data = await res.json();
      const formatted = data.map((n: any) => ({
        _id: n._id,
        message: n.message,
        read: n.read,
        time: formatTimeAgo(n.createdAt),
      }));
      setNotifications(formatted);
    } catch (err) {
      console.error("Failed to fetch notifications:", err);
    } finally {
      setLoadingNotifications(false);
    }
  };

  // ✅ Fetch dynamic notifications
 useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 60000);
    return () => clearInterval(interval);
  }, []);



      const token = localStorage.getItem("token");

 useEffect(() => {
    if (!token) {
      setIsAdmin(false);
      return;
    }

   try {
        const decoded = jwtDecode<TokenPayload>(token);
    console.log(decoded);
        // token expired?
        if (decoded.exp * 1000 < Date.now()) {
          authService.notifySessionExpired('token_expired');
          return;
        }
  
        setIsAdmin(decoded.role === "admin");
      } catch {
        setIsAdmin(false);
      }
    }, [token]);


   const markAsRead = async (id: string) => {
    try {
      const token = localStorage.getItem("token");
      if (!token) return;

      const res = await fetch(`${API_BASE_URL}/auth/${id}/read`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) throw new Error("Failed to mark notification as read");

      setNotifications((prev) =>
        prev.map((n) => (n._id === id ? { ...n, read: true } : n))
      );
    } catch (err) {
      console.error(err);
    }
  };

  const markAllAsRead = async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) return;

      await Promise.all(
        notifications
          .filter((n) => !n.read)
          .map((n) =>
            fetch(`${API_BASE_URL}/auth/${n._id}/read`, {
              method: "PUT",
              headers: { Authorization: `Bearer ${token}` },
            })
          )
      );

      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    } catch (err) {
      console.error("Failed to mark all as read:", err);
    }
  };




  // 🧭 Protected Navigation
  const useProtectedNavigation = (path: string) => {
    const token = localStorage.getItem("token");
    token ? navigate(path) : navigate("/homepageBefore");
  };

  // 🧹 Click outside close
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node))
        setShowDropdown(false);
      if (notificationRef.current && !notificationRef.current.contains(event.target as Node))
        setShowNotifications(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const logout = async () => {
    await handleLogout();
  };

  return (
    <header className="relative bg-slate-900 border-b border-slate-700 px-6 text-white shadow-md z-50 h-16 flex items-center">
      {/* Logo — absolutely centred */}
      <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-2 pointer-events-none">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-7 w-7 text-amber-400"
          fill="transparent"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
          <line x1="12" y1="8" x2="12" y2="16" stroke="currentColor" strokeWidth="2" />
          <line x1="8" y1="12" x2="16" y2="12" stroke="currentColor" strokeWidth="2" />
          <circle cx="12" cy="12" r="1.5" fill="currentColor" />
        </svg>
        <a
          href="/"
          className="text-amber-400 font-bold text-xl tracking-wide hover:text-amber-300 transition-colors pointer-events-auto"
        >
          Seekurify
        </a>
      </div>

      {/* Right Section — pushed to far right with ml-auto */}
      <div className="ml-auto flex items-center space-x-4">
          {/* Notification Icon */}
<div className="relative" ref={notificationRef}>
      <button
        onClick={() => setShowNotifications((s) => !s)}
        className="relative p-2 rounded-full hover:bg-white/20 transition"
      >
        <Bell size={22} className="text-white" />
        {notifications.some((n) => !n.read) && (
          <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
        )}
      </button>

      {showNotifications && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="absolute right-0 top-12 w-80 bg-white text-gray-800 shadow-lg rounded-xl overflow-hidden z-50"
        >
          <div className="flex justify-between items-center px-4 py-2 border-b">
            <span className="font-semibold text-gray-700">Notifications</span>
            <button
              onClick={markAllAsRead}
              className="text-sm text-indigo-600 hover:underline"
            >
              Mark all as read
            </button>
          </div>

          <div className="max-h-64 overflow-y-auto">
            {loadingNotifications ? (
              <p className="text-gray-500 text-center py-4">Loading...</p>
            ) : notifications.length === 0 ? (
              <p className="text-gray-500 text-center py-4">No new notifications</p>
            ) : (
              notifications.map((n) => (
                <div
                  key={n._id}
                  className={`px-4 py-3 border-b hover:bg-indigo-50 cursor-pointer ${
                    n.read ? "bg-white" : "bg-indigo-50"
                  }`}
                  onClick={() => markAsRead(n._id)}
                >
                  <p className="text-sm">{n.message}</p>
                  <p className="text-xs text-gray-500">{n.time}</p>
                </div>
                    ))
                  )}
                </div>
              </motion.div>
            )}
          </div>

          {/* Profile Dropdown */}
          <div className="relative group" ref={dropdownRef}>
            <motion.img
              whileHover={{ scale: 1.1 }}
              src={profileImage || defaultProfileIcon}
              alt="Profile"
              onClick={() => setShowDropdown(!showDropdown)}
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).src = defaultProfileIcon;
              }}
              className="w-10 h-10 rounded-full border-2 border-white object-cover cursor-pointer shadow-md"
            />
            {showDropdown && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="absolute right-0 top-12 w-52 bg-white text-gray-700 shadow-lg rounded-xl overflow-hidden z-50"
              >
                {isAdmin === true && (
                  <>
                    <button
                      className="w-full px-4 py-2 hover:bg-red-50 text-left text-red-600 font-semibold flex items-center gap-2"
                      onClick={() => navigate("/feature-flags")}
                    >
                      <span>🛠</span> Admin Console
                    </button>
                    <div className="border-t border-gray-100" />
                  </>
                )}
                <button
                  className="w-full px-4 py-2 hover:bg-indigo-50 text-left"
                  onClick={() => useProtectedNavigation("/profile")}
                >
                  Profile
                </button>
                <button
                  className="w-full px-4 py-2 hover:bg-indigo-50 text-left"
                  onClick={() =>
                    useProtectedNavigation(
                      `/set-new-pin?token=${localStorage.getItem("token")}`
                    )
                  }
                >
                  Change PIN
                </button>
                <button
                  className="w-full px-4 py-2 hover:bg-indigo-50 text-left"
                  onClick={() => useProtectedNavigation("/change-password")}
                >
                  Change Password
                </button>
                <button
                  className="w-full px-4 py-2 text-red-600 hover:bg-red-50 text-left"
                  onClick={logout}
                >
                  Logout
                </button>
              </motion.div>
            )}
          </div>
        </div>
    </header>
  );
};

export default Header;

