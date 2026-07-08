import React from "react";
import { useState } from "react";
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, BarChart3, FileSearch, KeyRound, Phone, ShieldAlert, ShieldCheck } from "lucide-react";
import Header from "../components/ui/Header";
import Footer from "../components/ui/Footer";
import { API_BASE_URL } from '../services/api';
import { motion } from "framer-motion";

interface HeaderProps {
  token: string;
  handleLogout: () => void;
  profileImage?: string; // ✅ new prop
}


const TermsAndConditions: React.FC = () => {
  const navigate = useNavigate();
const [sidebarExpanded, setSidebarExpanded] = React.useState(false);
  const [profileImage, setProfileImage] = React.useState<string | undefined>(undefined); // ✅ state for profile image
  const token = localStorage.getItem("token") || "";

 const [phishingDetectorEnabled, setPhishingDetectorEnabled] = useState<boolean>(false);
  const [featuresLoaded, setFeaturesLoaded] = useState(false);

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
  
      useEffect(() => {
        let isMounted = true; // prevent state updates after unmount
    
  
        // Fetch profile image safely
        const fetchProfileImage = async () => {
          try {
            const token = localStorage.getItem("token");
            if (!token) return;
    
            const res = await fetch(`${API_BASE_URL}/profile`, {
              headers: { Authorization: `Bearer ${token}` },
            });
    
            if (!res.ok) {
              console.error("Failed to fetch profile:", res.status, res.statusText);
              return;
            }
    
            const data = await res.json();
            if (isMounted && data?.profileImage) {
              setProfileImage(data.profileImage); // ✅ update state safely
            }
          } catch (err) {
            console.error("Error fetching profile image:", err);
          }
        };
    
        fetchProfileImage();
    
        return () => {
          isMounted = false;
        };
      }, []); // no token dependency needed, read it directly inside effect
    
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
    // Redirect to login
    navigate('/login');
  }
};


  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-blue-50 to-purple-100 flex flex-col">
            <title> Terms & Conditions </title>
      {/* Header */}
      <Header
        token={localStorage.getItem("token") || ""}
        handleLogout={handleLogout}
        profileImage={profileImage} // ✅ pass state
        sidebarExpanded={sidebarExpanded}
        setSidebarExpanded={setSidebarExpanded}
      />


   <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <motion.aside
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
...(phishingDetectorEnabled ? [
      { label: "Phishing Detector", path: "/detect-attacker", icon: <ShieldAlert className="w-5 h-5" /> }
    ] : [])
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
          ))}

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
        </motion.aside>



<div className="w-full max-w-lg mb-6 ml-4 sm:ml-6 mt-4 sm:mt-6">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-white bg-gradient-to-r from-red-500 to-red-600 px-4 py-2 rounded-lg shadow-md hover:scale-105 transition-transform duration-200"
          >
            <ArrowLeft className="w-5 h-5" /> Back
          </button>
        </div>
      {/* Main Content */}
<main className="flex flex-col items-center justify-center px-6 py-6 min-h-screen">
        {/* Back Button */}


        {/* Terms and Conditions Content */}
  <div className="w-full max-w-4xl bg-white rounded-3xl shadow-2xl ring-1 ring-gray-100 p-8 border border-gray-200">
  <h1 className="text-3xl font-extrabold text-gray-800 mb-4">Terms & Conditions</h1>

  <p className="text-gray-700 mb-4">
    Welcome to <strong>Seekurify</strong>. By accessing or using our platform, you agree to comply with and be bound by these Terms & Conditions and our Privacy Policy. If you do not agree, please do not use our services.
  </p>

  <h2 className="text-xl font-semibold text-gray-800 mt-4 mb-2">Platform Overview</h2>
  <p className="text-gray-700 mb-4">
    Seekurify is an all-in-one cybersecurity platform designed to provide users with tools and knowledge to enhance digital security. Key features include:
  </p>
  <ul className="list-disc list-inside text-gray-700 mb-4">
    <li><strong>Secure Password Manager:</strong> Store, manage, and generate strong passwords in a secure, encrypted environment.</li>
    <li><strong>Link Checker:</strong> Verify URLs for safety before visiting.</li>
    <li><strong>File & Malware Scanner:</strong> Detect potential threats in uploaded files.</li>
    <li><strong>System Information & Event Log Dashboard:</strong> Monitor system events and potential security threats.</li>
    <li><strong>Educational Content & Real-Time Alerts:</strong> Stay informed about cybersecurity threats and best practices.</li>
  </ul>

  <h2 className="text-xl font-semibold text-gray-800 mt-4 mb-2">User Accounts</h2>
  <p className="text-gray-700 mb-4">
    Users may be required to create an account to access certain features. You are responsible for maintaining the confidentiality of your account credentials and for all activities performed under your account. Please notify us immediately of any unauthorized use.
  </p>

  <h2 className="text-xl font-semibold text-gray-800 mt-4 mb-2">Security & Data Protection</h2>
  <p className="text-gray-700 mb-4">
    All passwords are hashed and encrypted to ensure maximum protection. While Seekurify implements multiple security measures, no system is completely secure. Users acknowledge and accept the inherent risks of using online services.
  </p>

  <h2 className="text-xl font-semibold text-gray-800 mt-4 mb-2">User Responsibilities</h2>
  <p className="text-gray-700 mb-4">
    Users agree to use Seekurify in compliance with applicable laws, not attempt unauthorized access, and accept responsibility for any files or links scanned using the platform.
  </p>

  <h2 className="text-xl font-semibold text-gray-800 mt-4 mb-2">Intellectual Property</h2>
  <p className="text-gray-700 mb-4">
    All content, software, trademarks, and services provided by Seekurify are the intellectual property of Seekurify or its licensors. Users may not reproduce, distribute, or create derivative works without prior written consent.
  </p>

  <h2 className="text-xl font-semibold text-gray-800 mt-4 mb-2">Third-Party Services</h2>
  <p className="text-gray-700 mb-4">
    Some features may rely on third-party APIs or services for malware detection, file scanning, or link checking. Seekurify is not responsible for the performance or accuracy of these third-party services.
  </p>

  <h2 className="text-xl font-semibold text-gray-800 mt-4 mb-2">Limitation of Liability</h2>
  <p className="text-gray-700 mb-4">
    Seekurify provides tools and educational content “as-is.” We are not liable for any damages, losses, or security breaches arising from your use of the platform. Users acknowledge that no cybersecurity tool can guarantee absolute protection.
  </p>

  <h2 className="text-xl font-semibold text-gray-800 mt-4 mb-2">Changes to Terms</h2>
  <p className="text-gray-700 mb-4">
    Seekurify may update these Terms & Conditions from time to time. Your continued use of the platform constitutes acceptance of the updated terms.
  </p>

  <h2 className="text-xl font-semibold text-gray-800 mt-4 mb-2">Contact Us</h2>
  <p className="text-gray-700">
    For questions or support regarding these Terms & Conditions, please contact us at <strong>support@seekurify.com</strong>.
  </p>
</div>

      </main>
      </div>

      {/* Footer */}
      <Footer />
    </div>
  );
};

export default TermsAndConditions;
