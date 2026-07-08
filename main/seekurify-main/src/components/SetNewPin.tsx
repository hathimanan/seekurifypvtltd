import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { jwtDecode } from "jwt-decode";
import { ArrowLeft } from "lucide-react";
import Header from "./ui/Header";
import Footer from "./ui/Footer";
import { API_BASE_URL } from "../services/api";

interface DecodedToken {
  email: string;
  exp: number;
  iat: number;
  newUser?: boolean;
}

interface UserProfile {
  name: string;
  email: string;
  username: string;
}

interface HeaderProps {
  token: string;
  handleLogout: () => void;
  profileImage?: string; // ✅ new prop
}

export const SetNewPin: React.FC = () => {
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [success, setSuccess] = useState("");
  const [user, setUser] = useState<UserProfile | null>(null);

  const [showPinModal, setShowPinModal] = useState(false);
  const [pinInput, setPinInput] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [profileImage, setProfileImage] = useState<string>(""); // ✅ state for header
const [sidebarExpanded,setSidebarExpanded] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const token = queryParams.get("token");

  useEffect(() => {
    const fetchUserProfile = async (decodedEmail: string) => {
      try {
        const res = await fetch(
          `${API_BASE_URL}/profile?email=${decodedEmail}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (!res.ok) return; // new users have no profile yet — fail silently
        const data = await res.json();
        setUser(data);
        if (data.profileImage) setProfileImage(data.profileImage);
      } catch {
        // non-critical — header image just won't show
      }
    };

    if (token) {
      try {
        const decoded = jwtDecode<DecodedToken>(token);

        if (decoded?.email) {
          setEmail(decoded.email);

          if (!decoded.newUser) {
            setShowPinModal(true);
          }

          fetchUserProfile(decoded.email);
        } else {
          setError("Invalid token. Please try again.");
        }
      } catch (err) {
        setError("Invalid or expired token.");
      }
    } else {
      setError("Token not found. Please check your email link.");
    }
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (newPin.length !== 4 || confirmPin.length !== 4) {
      setError("PIN must be 4 digits");
      return;
    }

    if (newPin !== confirmPin) {
      setError("PINs do not match");
      return;
    }

   try {
    setIsLoading(true);

const queryParams = new URLSearchParams(location.search);
const token = queryParams.get("token");
    const res = await fetch(`${API_BASE_URL}/auth/update-pin`, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,  // ✅ FIXED
      },
      body: JSON.stringify({ email, newPin }),
    });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to update PIN");
      }

      navigate("/login");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsLoading(false);
    }
  };

  const handleNumericInput = (
    e: React.ChangeEvent<HTMLInputElement>,
    setter: (val: string) => void
  ) => {
    const value = e.target.value;
    if (/^\d{0,4}$/.test(value)) {
      setter(value);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch(`${API_BASE_URL}/auth/logout`, {
        method: "POST",
        credentials: "include",
      });
    } catch (err) {
      console.error("Failed to call logout endpoint", err);
    } finally {
      localStorage.removeItem("token");
      navigate("/login");
    }
  };

  return (
    <div className="p-0">
      {/* <Header
        token={localStorage.getItem("token") || ""}
        handleLogout={handleLogout}
        profileImage={profileImage} // ✅ pass state
        sidebarExpanded={sidebarExpanded}
        setSidebarExpanded={setSidebarExpanded}
      /> */}


        <div className="flex flex-1 overflow-hidden">
    {/* Sidebar */}
    {/* <motion.aside
      initial={false}
  animate={{ width: sidebarExpanded ? "18rem" : "4rem" }}
      transition={{ type: "spring", stiffness: 260, damping: 30 }}
      className="bg-gradient-to-b from-gray-800 to-gray-900 text-white p-4 flex flex-col"
    >
      {[
        { label: "Analyze Malware", path: "/malware-analysis", icon: <FileSearch className="w-5 h-5" /> },
        { label: "Password Manager", path: "/dashboard", icon: <KeyRound className="w-5 h-5" /> },
        { label: "System Events Dashboard", path: "/siem-dashboard", icon: <BarChart3 className="w-5 h-5" /> },
        { label: "Security Awareness", path: "/securityAwareness", icon: <ShieldCheck className="w-5 h-5" /> },
        { label: "Contact Us", path: "/contact", icon: <Phone className="w-5 h-5" /> },
      ].map(({ label, path, icon }) => (
        <div
          key={path}
          onClick={() => navigate(path)}
          className="relative group flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-indigo-600 transition cursor-pointer"
        >
          {icon}
          {sidebarExpanded && <span className="truncate">{label}</span>}

          {!sidebarExpanded && (
            <span className="absolute left-full top-1/2 -translate-y-1/2 ml-2 whitespace-nowrap bg-gray-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity z-50">
              {label}
            </span>
          )}
        </div>
      ))} */}

      {/* Expand/Collapse */}
      {/* <div
        onClick={() => setSidebarExpanded((s) => !s)}
        className="flex items-center justify-center mt-auto cursor-pointer bg-white/10 hover:bg-white/20 px-2 py-2 rounded-md transition relative group"
      >
        {sidebarExpanded ? "Collapse" : "Expand"}
        {!sidebarExpanded && (
          <span className="absolute left-full top-1/2 -translate-y-1/2 ml-2 whitespace-nowrap bg-gray-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity z-50">
            {sidebarExpanded ? "Collapse Sidebar" : "Expand Sidebar"}
          </span>
        )}
      </div> */}
    {/* </motion.aside> */}

      <main className="flex-grow p-6 bg-gradient-to-br from-indigo-50 to-blue-100 rounded-lg">
        <div className="p-6 bg-gradient-to-br from-indigo-50 to-blue-100 min-h-screen rounded-lg">
          <div className="mb-6">
            <button
              onClick={() => navigate(-1)}
              className="flex items-center gap-2 text-white bg-gradient-to-r from-red-500 to-red-600 px-3 py-2 rounded-lg shadow-md hover:scale-105 transition transform duration-200"
            >
              <ArrowLeft className="w-5 h-5" /> Back
            </button>
          </div>

          <div className="flex items-center justify-center">
            <form
              onSubmit={handleSubmit}
              className="bg-white p-8 rounded shadow-md w-full max-w-md"
            >
              <h2 className="text-2xl font-bold mb-6 text-center text-gray-800">
                Set New PIN
              </h2>

             {!showPinModal && (
        <>
          <input
            type="password"
            inputMode="numeric"
            maxLength={4}
            placeholder="New PIN"
            className="w-full border p-2 rounded mb-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={newPin}
            onChange={(e) => handleNumericInput(e, setNewPin)}
            disabled={isLoading}
          />
          <input
            type="password"
            inputMode="numeric"
            maxLength={4}
            placeholder="Confirm New PIN"
            className="w-full border p-2 rounded mb-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={confirmPin}
            onChange={(e) => handleNumericInput(e, setConfirmPin)}
            disabled={isLoading}
          />

          {/* Error message for main inputs */}
          {error && <div className="text-red-600 mb-4">{error}</div>}

          <button
  type="submit" // ← submit the form
  className="w-full py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
  disabled={isLoading}
>
  {isLoading ? "Setting PIN..." : "Set PIN"}
</button>

        </>
      )}

      {/* PIN Verification Modal */}
      {showPinModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-md w-full max-w-sm">
            <h2 className="text-lg font-semibold mb-4">Verify PIN</h2>
            <input
              type="password"
              inputMode="numeric"
              pattern="\d*"
              maxLength={4}
              placeholder="Enter your PIN"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 mb-2"
              value={pinInput}
              onChange={(e) => handleNumericInput(e, setPinInput)}
            />

            {/* Error message inside modal */}
            {error && <div className="text-red-600 mb-2">{error}</div>}

            <div className="mt-4 flex justify-end space-x-2">
              <button
                type="submit"
                onClick={async () => {
                  if (pinInput.length !== 4) {
                    setError("PIN must be 4 digits.");
                    return;
                  }
                  setIsVerifying(true);
                  try {
                    const token = localStorage.getItem("token");
                    const res = await fetch(
                      `${API_BASE_URL}/auth/verify-pin`,
                      {
                        method: "POST",
                        headers: {
                          "Content-Type": "application/json",
                          Authorization: `Bearer ${token}`,
                        },
                        body: JSON.stringify({ email, pin: pinInput }),
                      }
                    );
                    const data = await res.json();
                    if (data.token) {
                      setShowPinModal(false);
                      setError(""); // clear error after success
                    } else {
                      setError("Incorrect PIN.");
                    }
                  } catch {
                    setError("Error verifying PIN.");
                  } finally {
                    setIsVerifying(false);
                  }
                }}
                disabled={isVerifying}
                className="px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
              >
                {isVerifying ? "Verifying..." : "Verify & Proceed"}
              </button>
            </div>
          </div>
          </div>
      )}
      </form>
      </div>
      </div>
      </main>
</div>
      <Footer />
    </div>
  );
};

