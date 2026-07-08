import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { jwtDecode } from 'jwt-decode';
import Header from './ui/Header';
import Footer from './ui/Footer';
import { ArrowLeft, Eye, EyeOff, ShieldCheck } from 'lucide-react';
import { API_BASE_URL } from '../services/api';
import { fetchWithAuth } from '../services/authService';
import AppSidebar from './ui/AppSidebar';

const ChangePasswordForm: React.FC = () => {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState('');
  const [currentPasswordError, setCurrentPasswordError] = useState('');
  const [newPasswordError, setNewPasswordError] = useState('');
  const [confirmPasswordError, setConfirmPasswordError] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [isPinVerified, setIsPinVerified] = useState(false);
  const [profileImage, setProfileImage] = useState<string>('');
  const [sidebarExpanded, setSidebarExpanded] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchUserProfile = async () => {
      try {
        const res = await fetchWithAuth(`${API_BASE_URL}/profile`);
        if (!res.ok) return;
        const data = await res.json();
        if (data?.profileImage) setProfileImage(data.profileImage);
      } catch { /* silent */ }
    };

    setIsPinVerified(false);
    fetchUserProfile();
  }, []);

  const handleVerifyPin = async (e: React.FormEvent) => {
    e.preventDefault();
    setPinError('');

    if (!pin) { setPinError('PIN cannot be empty'); return; }
    if (!/^\d{4}$/.test(pin)) { setPinError('PIN must be exactly 4 digits'); return; }

    const token = localStorage.getItem('token');
    if (!token) { navigate('/login'); return; }

    let email = '';
    try {
      const decoded: any = jwtDecode(token);
      email = decoded.email;
    } catch {
      setPinError('Invalid session');
      return;
    }

    try {
      const res = await fetchWithAuth(`${API_BASE_URL}/auth/verify-pin`, {
        method: 'POST',
        body: JSON.stringify({ email, pin }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'PIN verification failed');
      setIsPinVerified(true);
    } catch (err) {
      setPinError(err instanceof Error ? err.message : 'PIN verification failed');
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentPasswordError('');
    setNewPasswordError('');
    setConfirmPasswordError('');
    setError('');
    setSuccessMessage('');

    let hasError = false;
    if (!currentPassword) { setCurrentPasswordError('Current password cannot be empty'); hasError = true; }
    if (!newPassword) {
      setNewPasswordError('New password cannot be empty'); hasError = true;
    } else if (/^\d+$/.test(newPassword)) {
      setNewPasswordError('Password cannot be only numbers'); hasError = true;
    } else if (newPassword.length < 6) {
      setNewPasswordError('Password must be at least 6 characters'); hasError = true;
    }
    if (!confirmPassword) {
      setConfirmPasswordError('Please confirm your password'); hasError = true;
    } else if (newPassword !== confirmPassword) {
      setConfirmPasswordError('Passwords do not match'); hasError = true;
    }
    if (hasError) return;

    setIsLoading(true);
    try {
      const res = await fetchWithAuth(`${API_BASE_URL}/auth/change-password`, {
        method: 'POST',
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to change password');
      setSuccessMessage(data.message || 'Password changed successfully');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch(`${API_BASE_URL}/auth/logout`, { method: 'POST', credentials: 'include' });
    } catch { /* silent */ } finally {
      localStorage.removeItem('token');
      navigate('/login');
    }
  };

  const inputClass = 'w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500 transition';
  const errorText = 'text-red-400 text-xs mt-1';

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col">
      <Header
        token={localStorage.getItem('token') || ''}
        handleLogout={handleLogout}
        profileImage={profileImage}
      />

      <div className="flex flex-1 overflow-hidden">
        <AppSidebar sidebarExpanded={sidebarExpanded} setSidebarExpanded={setSidebarExpanded} />

        <main className="flex-1 bg-gray-950 p-6 overflow-auto">
          <div className="mb-6">
            <button
              onClick={() => navigate(-1)}
              className="flex items-center gap-2 text-gray-400 hover:text-white text-sm transition"
            >
              <ArrowLeft className="w-4 h-4" /> Back
            </button>
          </div>

          {/* PIN Modal */}
          {!isPinVerified && (
            <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 px-4">
              <div className="bg-gray-800 border border-gray-700 rounded-2xl p-8 w-full max-w-sm shadow-2xl">
                <div className="text-center mb-6">
                  <div className="w-12 h-12 rounded-full bg-amber-500/15 border border-amber-500/30 flex items-center justify-center mx-auto mb-3">
                    <ShieldCheck className="w-6 h-6 text-amber-400" />
                  </div>
                  <h2 className="text-xl font-bold text-white">Verify Your PIN</h2>
                  <p className="text-gray-400 text-sm mt-1">Enter your 4-digit PIN to continue</p>
                </div>

                {pinError && (
                  <div className="border border-red-500/40 bg-red-500/10 text-red-400 text-sm px-4 py-3 rounded-lg mb-4">
                    {pinError}
                  </div>
                )}

                <form onSubmit={handleVerifyPin} className="space-y-4">
                  <input
                    type="password"
                    inputMode="numeric"
                    value={pin}
                    onChange={(e) => { setPinError(''); setPin(e.target.value.replace(/\D/g, '').slice(0, 4)); }}
                    maxLength={4}
                    placeholder="• • • •"
                    className={`${inputClass} text-center text-2xl tracking-[0.5em]`}
                    autoFocus
                  />
                  <button
                    type="submit"
                    disabled={pin.length !== 4}
                    className="w-full bg-amber-500 hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed text-slate-900 font-semibold py-3 rounded-lg transition"
                  >
                    Verify PIN
                  </button>
                </form>
              </div>
            </div>
          )}

          {/* Change Password Form */}
          {isPinVerified && (
            <div className="flex items-start justify-center pt-8 px-4">
              <div className="w-full max-w-md bg-gray-800 border border-gray-700 rounded-2xl p-8 shadow-xl">
                <h2 className="text-2xl font-bold text-white mb-6">Change Password</h2>

                {error && (
                  <div className="border border-red-500/40 bg-red-500/10 text-red-400 text-sm px-4 py-3 rounded-lg mb-5">
                    {error}
                  </div>
                )}
                {successMessage && (
                  <div className="border border-green-500/40 bg-green-500/10 text-green-400 text-sm px-4 py-3 rounded-lg mb-5 flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 flex-shrink-0" /> {successMessage}
                  </div>
                )}

                <form onSubmit={handleChangePassword} className="space-y-5" noValidate>
                  {/* Current Password */}
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Current Password</label>
                    <div className="relative">
                      <input
                        type={showCurrent ? 'text' : 'password'}
                        value={currentPassword}
                        onChange={(e) => { setCurrentPassword(e.target.value); if (currentPasswordError) setCurrentPasswordError(''); }}
                        className={`${inputClass} pr-20 ${currentPasswordError ? 'border-red-500' : ''}`}
                        placeholder="Your current password"
                        autoComplete="current-password"
                        data-pwgen-right="60"
                      />
                      <button type="button" onClick={() => setShowCurrent(v => !v)} tabIndex={-1}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-200 transition">
                        {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    {currentPasswordError && <p className={errorText}>{currentPasswordError}</p>}
                  </div>

                  {/* New Password */}
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">New Password</label>
                    <div className="relative">
                      <input
                        type={showNew ? 'text' : 'password'}
                        value={newPassword}
                        onChange={(e) => { setNewPassword(e.target.value); if (newPasswordError) setNewPasswordError(''); }}
                        className={`${inputClass} pr-20 ${newPasswordError ? 'border-red-500' : ''}`}
                        placeholder="At least 6 characters"
                        autoComplete="new-password"
                        data-pwgen-right="60"
                      />
                      <button type="button" onClick={() => setShowNew(v => !v)} tabIndex={-1}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-200 transition">
                        {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    {newPasswordError && <p className={errorText}>{newPasswordError}</p>}
                  </div>

                  {/* Confirm Password */}
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Confirm New Password</label>
                    <div className="relative">
                      <input
                        type={showConfirm ? 'text' : 'password'}
                        value={confirmPassword}
                        onChange={(e) => { setConfirmPassword(e.target.value); if (confirmPasswordError) setConfirmPasswordError(''); }}
                        className={`${inputClass} pr-20 ${confirmPasswordError ? 'border-red-500' : confirmPassword && confirmPassword === newPassword ? 'border-green-500' : ''}`}
                        placeholder="Repeat your new password"
                        autoComplete="new-password"
                        data-pwgen-right="60"
                      />
                      <button type="button" onClick={() => setShowConfirm(v => !v)} tabIndex={-1}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-200 transition">
                        {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    {confirmPasswordError && <p className={errorText}>{confirmPasswordError}</p>}
                    {!confirmPasswordError && confirmPassword && confirmPassword === newPassword && (
                      <p className="text-green-400 text-xs mt-1 flex items-center gap-1">
                        <ShieldCheck className="w-3.5 h-3.5" /> Passwords match
                      </p>
                    )}
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full bg-amber-500 hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed text-slate-900 font-semibold py-3 rounded-lg transition mt-2"
                  >
                    {isLoading ? 'Changing...' : 'Change Password'}
                  </button>
                </form>
              </div>
            </div>
          )}
        </main>
      </div>
      <Footer />
    </div>
  );
};

export default ChangePasswordForm;
