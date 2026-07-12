import React, { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import {
  KeyRound, ShieldCheck, Phone,
  Shield, ShieldOff,
  BookOpen, Code2,
} from "lucide-react";
import { API_BASE_URL } from "../../services/api";

interface AppSidebarProps {
  sidebarExpanded: boolean;
  setSidebarExpanded: (v: boolean) => void;
}

const AppSidebar: React.FC<AppSidebarProps> = ({ sidebarExpanded, setSidebarExpanded }) => {
  const navigate  = useNavigate();
  const location  = useLocation();

  const [identityAccessEnabled, setIdentityAccessEnabled]   = useState(false);
  const [learnSecureEnabled, setLearnSecureEnabled]         = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("token");
    fetch(`${API_BASE_URL}/feature-flags/read`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(d => {
        setIdentityAccessEnabled(d.identityAccessEnabled !== false);
        setLearnSecureEnabled(d.learnSecureEnabled !== false);
      })
      .catch(() => {});
  }, []);

  interface NavItem { label: string; path: string; icon: React.ReactElement; }
  interface NavGroup { id: string; label: string; groupIcon: React.ReactElement; accentColor: string; groupFlag?: boolean; items: NavItem[]; }

  const navGroups: NavGroup[] = [
    {
      id: "identity", label: "Identity & Access",
      groupIcon: <KeyRound className="w-3.5 h-3.5 flex-shrink-0" />, accentColor: "text-sky-400", groupFlag: identityAccessEnabled,
      items: [
        { label: "Password Manager",        path: "/dashboard",        icon: <KeyRound  className="w-5 h-5 flex-shrink-0" /> },
        { label: "Breach Control",          path: "/breach-control",   icon: <ShieldOff className="w-5 h-5 flex-shrink-0" /> },
      ],
    },
    {
      id: "learn", label: "Learn & Stay Secure",
      groupIcon: <Shield className="w-3.5 h-3.5 flex-shrink-0" />, accentColor: "text-lime-400", groupFlag: learnSecureEnabled,
      items: [
        { label: "Security Awareness", path: "/securityAwareness", icon: <ShieldCheck className="w-5 h-5 flex-shrink-0" /> },
      ],
    },
    {
      id: "resources", label: "Resources",
      groupIcon: <BookOpen className="w-3.5 h-3.5 flex-shrink-0" />, accentColor: "text-indigo-400",
      items: [
        { label: "User Guide", path: "/user-guide", icon: <BookOpen className="w-5 h-5 flex-shrink-0" /> },
        { label: "API Docs",   path: "/api-docs",   icon: <Code2    className="w-5 h-5 flex-shrink-0" /> },
      ],
    },
    {
      id: "misc", label: "More",
      groupIcon: <Phone className="w-3.5 h-3.5 flex-shrink-0" />, accentColor: "text-gray-400",
      items: [
        { label: "Contact Us",             path: "/contact",        icon: <Phone  className="w-5 h-5 flex-shrink-0" /> },
      ],
    },
  ];

  return (
    <motion.aside
      initial={false}
      animate={{ width: sidebarExpanded ? "18rem" : "4rem" }}
      transition={{ type: "spring", stiffness: 260, damping: 30 }}
      className="bg-gradient-to-b from-gray-800 to-gray-900 text-white p-4 flex flex-col flex-shrink-0 overflow-hidden"
    >
      {/* Toggle button */}
      <button
        onClick={() => setSidebarExpanded(!sidebarExpanded)}
        className="mb-4 self-end text-gray-400 hover:text-white transition focus:outline-none"
        title={sidebarExpanded ? "Collapse sidebar" : "Expand sidebar"}
      >
        <motion.div
          animate={{ rotate: sidebarExpanded ? 0 : 180 }}
          transition={{ duration: 0.2 }}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
          </svg>
        </motion.div>
      </button>

      <nav className="flex flex-col gap-1 overflow-y-auto overflow-x-hidden">
        {navGroups.map((group, groupIdx) => {
          if (group.groupFlag === false) return null;
          if (group.items.length === 0) return null;
          return (
            <div key={group.id} className={groupIdx > 0 ? "mt-3" : ""}>
              {sidebarExpanded && (
                <div className={`flex items-center gap-1.5 px-2 mb-1 ${group.accentColor}`}>
                  {group.groupIcon}
                  <span className="text-[10px] font-bold uppercase tracking-widest truncate">{group.label}</span>
                </div>
              )}
              {!sidebarExpanded && groupIdx > 0 && (
                <div className="border-t border-gray-700 my-1 mx-2" />
              )}
              {group.items.map(({ label, path, icon }) => {
                const active = location.pathname === path;
                return (
                  <div
                    key={path}
                    onClick={() => navigate(path)}
                    className={`relative group flex items-center gap-3 px-2 py-2 rounded-lg transition cursor-pointer ${
                      active
                        ? "bg-amber-500 text-slate-900 font-semibold"
                        : "hover:bg-amber-500 hover:text-slate-900 text-gray-300"
                    }`}
                  >
                    {icon}
                    {sidebarExpanded && (
                      <span className="truncate text-sm">{label}</span>
                    )}
                    {!sidebarExpanded && (
                      <span className="absolute left-full top-1/2 -translate-y-1/2 ml-2 whitespace-nowrap bg-gray-900 text-white text-xs px-2 py-1 rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity z-50 pointer-events-none">
                        {label}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}
      </nav>
    </motion.aside>
  );
};

export default AppSidebar;
