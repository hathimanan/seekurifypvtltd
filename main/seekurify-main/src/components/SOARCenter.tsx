import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Zap, ShieldAlert, Plug, Clock } from 'lucide-react';
import AppSidebar from './ui/AppSidebar';
import Header from './ui/Header';
import Footer from './ui/Footer';
import { API_BASE_URL } from '../services/api';
import PlaybookList from './PlaybookList';
import IncidentDashboard from './IncidentDashboard';
import IntegrationHub from './IntegrationHub';
import ScheduledScans from './ScheduledScans';

type Tab = 'playbooks' | 'incidents' | 'integrations' | 'scans';

const TABS: { id: Tab; label: string; icon: React.ReactNode; description: string }[] = [
  { id: 'playbooks',    label: 'Playbooks',       icon: <Zap className="w-4 h-4" />,        description: 'Automated response workflows' },
  { id: 'incidents',    label: 'Incidents',       icon: <ShieldAlert className="w-4 h-4" />, description: 'Security incident management' },
  { id: 'integrations', label: 'Integrations',    icon: <Plug className="w-4 h-4" />,        description: 'Slack, Jira, and webhook connectors' },
  { id: 'scans',        label: 'Scheduled Scans', icon: <Clock className="w-4 h-4" />,       description: 'Automated breach and risk score scans' },
];

export default function SOARCenter() {
  const navigate = useNavigate();
  const token = localStorage.getItem("token");
  const [sidebarExpanded, setSidebarExpanded] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>('playbooks');
  const [profileImage, setProfileImage] = useState("");

  const handleLogout = () => { localStorage.removeItem("token"); navigate("/"); };

  useEffect(() => {
    if (!token) return;
    fetch(`${API_BASE_URL}/profile`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.profileImage) setProfileImage(d.profileImage); })
      .catch(() => {});
  }, [token]);

  return (
    <div className="min-h-screen flex flex-col bg-gray-950 text-white">
      <Header token={token || ""} handleLogout={handleLogout} profileImage={profileImage} />

      <div className="flex flex-1 overflow-hidden">
        <AppSidebar sidebarExpanded={sidebarExpanded} setSidebarExpanded={setSidebarExpanded} />

        <div className="flex-1 flex flex-col overflow-hidden">
        {/* Page header */}
        <div className="px-6 pt-6 pb-4 border-b border-gray-800 flex-shrink-0">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
              <Zap className="w-4 h-4 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-white">SOAR Center</h1>
          </div>
          <p className="text-sm text-gray-400 ml-11">Security Orchestration, Automation &amp; Response</p>
        </div>

        {/* Tab bar */}
        <div className="px-6 border-b border-gray-800 flex-shrink-0">
          <div className="flex gap-1">
            {TABS.map(tab => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-indigo-500 text-white'
                    : 'border-transparent text-gray-400 hover:text-gray-200'
                }`}>
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <main className="flex-1 overflow-y-auto p-6">
          {activeTab === 'playbooks'    && <PlaybookList />}
          {activeTab === 'incidents'    && <IncidentDashboard />}
          {activeTab === 'integrations' && <IntegrationHub />}
          {activeTab === 'scans'        && <ScheduledScans />}
        </main>
        </div>
      </div>
      <Footer />
    </div>
  );
}
