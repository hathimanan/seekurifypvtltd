import React, { useState, useEffect } from 'react';
import { ArrowLeft, Eye, EyeOff, Mail, ShieldCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { API_BASE_URL } from '../services/api';
import { Logo } from './ui/logo';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const PASSWORD_RULES = [
  { label: 'At least 8 characters', test: (p: string) => p.length >= 8 },
  { label: 'One uppercase letter', test: (p: string) => /[A-Z]/.test(p) },
  { label: 'One lowercase letter', test: (p: string) => /[a-z]/.test(p) },
  { label: 'One number', test: (p: string) => /\d/.test(p) },
  { label: 'One special character (@$!%*?&)', test: (p: string) => /[@$!%*?&]/.test(p) },
];

const getResetCodeError = (value: string) => {
  const v = value.trim();
  if (!v) return 'Please enter the reset code';
  if (!/^\d+$/.test(v)) return 'Reset code must contain only numbers';
  if (v.length !== 6) return 'Reset code must be exactly 6 digits';
  return '';
};

export const ForgotPasswordForm: React.FC = () => {
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [confirmError, setConfirmError] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [step, setStep] = useState<'email' | 'sent' | 'reset'>('email');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [resendTimer, setResendTimer] = useState(30);
  const [canResend, setCanResend] = useState(false);
  const [serverMessage, setServerMessage] = useState('');

  const navigate = useNavigate();

  useEffect(() => {
    if (step === 'sent') {
      setCanResend(false);
      setResendTimer(30);
      const countdown = setInterval(() => {
        setResendTimer((prev) => {
          if (prev <= 1) { clearInterval(countdown); setCanResend(true); return 0; }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(countdown);
    }
  }, [step]);

  const passwordRuleResults = PASSWORD_RULES.map(r => ({ ...r, passed: r.test(newPassword) }));
  const allRulesPassed = passwordRuleResults.every(r => r.passed);

  const validateEmail = (val: string) => {
    if (!val.trim()) { setEmailError('Email address is required'); return false; }
    if (!EMAIL_REGEX.test(val.trim())) { setEmailError('Please enter a valid email address'); return false; }
    setEmailError('');
    return true;
  };

  const handleSendResetEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const trimmedEmail = email.trim().toLowerCase();
    if (!validateEmail(trimmedEmail)) return;

    setIsLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: trimmedEmail }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (data.errors && Array.isArray(data.errors)) {
          throw new Error(data.errors.map((e: any) => e.message).join(', '));
        }
        throw new Error(data.error || 'Failed to send reset email');
      }
      setServerMessage(data.message || 'If an account with this email exists, a reset code has been sent.');
      setEmail(trimmedEmail);
      setStep('sent');
    } catch (err: any) {
      setError(err.message || 'Failed to send reset email');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendCode = async () => {
    if (!canResend) return;
    setError('');
    try {
      const res = await fetch(`${API_BASE_URL}/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to resend code');
      setServerMessage(data.message || 'Reset code resent.');
      setCanResend(false);
      setResendTimer(30);
      const countdown = setInterval(() => {
        setResendTimer((prev) => {
          if (prev <= 1) { clearInterval(countdown); setCanResend(true); return 0; }
          return prev - 1;
        });
      }, 1000);
    } catch (err: any) {
      setError(err.message || 'Failed to resend code');
    }
  };

  const handleVerifyToken = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const trimmedToken = resetToken.trim();
    const codeError = getResetCodeError(trimmedToken);
    if (codeError) { setError(codeError); return; }

    setIsLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/auth/verify-reset-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, token: trimmedToken }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (data.errors && Array.isArray(data.errors)) {
          throw new Error(data.errors.map((e: any) => e.message).join(', '));
        }
        throw new Error(data.error || 'Invalid or expired code');
      }
      setStep('reset');
    } catch (err: any) {
      setError(err.message || 'Failed to verify code');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setConfirmError('');

    if (!allRulesPassed) {
      setError('Please satisfy all password requirements below');
      return;
    }
    if (newPassword !== confirmPassword) {
      setConfirmError('Passwords do not match');
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, token: resetToken, newPassword }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: 'Failed to reset password' }));
        if (data.errors && Array.isArray(data.errors)) {
          throw new Error(data.errors.map((e: any) => e.message).join(', '));
        }
        throw new Error(data.error || 'Failed to reset password');
      }
      setShowSuccessModal(true);
    } catch (err: any) {
      setError(err.message || 'Failed to reset password');
    } finally {
      setIsLoading(false);
    }
  };

  const cardClass = 'min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center px-4 py-10';
  const innerCard = 'w-full max-w-md bg-gray-800 border border-gray-700 rounded-2xl shadow-xl p-8';
  const inputClass = 'w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500 transition';
  const btnPrimary = 'w-full bg-amber-500 hover:bg-amber-400 text-slate-900 font-semibold py-3 px-4 rounded-lg text-base transition disabled:opacity-50 disabled:cursor-not-allowed';
  const errorBox = 'border border-red-500/40 bg-red-500/10 text-red-400 text-sm px-4 py-3 rounded-lg mb-4';

  /* ── Step: email ── */
  if (step === 'email') {
    return (
      <div className={cardClass}>
        <div className={innerCard}>
          <div className="text-center mb-6">
            <Logo />
            <h2 className="text-2xl font-bold text-white mt-4 mb-1">Forgot Password</h2>
            <p className="text-gray-400 text-sm">Enter your email to receive a reset code</p>
          </div>

          {error && <div className={errorBox}>{error}</div>}

          <form onSubmit={handleSendResetEmail} className="space-y-5" noValidate>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Email Address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); if (emailError) validateEmail(e.target.value); }}
                onBlur={(e) => validateEmail(e.target.value)}
                className={`${inputClass} ${emailError ? 'border-red-500 focus:border-red-500 focus:ring-red-500/30' : ''}`}
                placeholder="you@example.com"
                autoComplete="email"
              />
              {emailError && <p className="text-red-400 text-xs mt-1">{emailError}</p>}
            </div>

            <button type="submit" disabled={isLoading} className={btnPrimary}>
              {isLoading ? 'Sending...' : 'Send Reset Code'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <button onClick={() => navigate('/')} className="text-gray-400 hover:text-white text-sm flex items-center justify-center gap-1 mx-auto transition">
              <ArrowLeft className="w-4 h-4" /> Back to Login
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* ── Step: sent (enter code) ── */
  if (step === 'sent') {
    return (
      <div className={cardClass}>
        <div className={innerCard}>
          <div className="text-center mb-6">
            <Logo />
            <div className="w-14 h-14 rounded-full bg-amber-500/15 border border-amber-500/30 flex items-center justify-center mx-auto mt-4 mb-3">
              <Mail className="w-7 h-7 text-amber-400" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-1">Check Your Email</h2>
            <p className="text-gray-400 text-sm">{serverMessage || `A 6-digit code was sent to`}</p>
            <p className="text-amber-400 text-sm font-medium mt-1">{email}</p>
          </div>

          {error && <div className={errorBox}>{error}</div>}

          <form onSubmit={handleVerifyToken} className="space-y-5" noValidate>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1 text-center">Enter 6-digit code</label>
              <input
                type="text"
                value={resetToken}
                onChange={(e) => { setError(''); setResetToken(e.target.value.replace(/\D/g, '').slice(0, 6)); }}
                className={`${inputClass} text-center text-2xl font-mono tracking-[0.5em] ${resetToken.length === 6 ? 'border-amber-500 ring-2 ring-amber-500/20' : ''}`}
                placeholder="——————"
                maxLength={6}
                inputMode="numeric"
                autoComplete="one-time-code"
              />
            </div>

            <button type="submit" disabled={isLoading || resetToken.length !== 6} className={btnPrimary}>
              {isLoading ? 'Verifying...' : 'Verify Code'}
            </button>
          </form>

          <div className="mt-5 text-center text-sm text-gray-400">
            {canResend ? (
              <button onClick={handleResendCode} className="text-amber-400 hover:text-amber-300 font-medium transition">
                Resend Code
              </button>
            ) : (
              <span>Resend available in <span className="text-white font-medium">{resendTimer}s</span></span>
            )}
          </div>

          <div className="mt-4 text-center">
            <button onClick={() => { setStep('email'); setError(''); setResetToken(''); }} className="text-gray-500 hover:text-gray-300 text-sm transition">
              Try a different email
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* ── Step: reset (new password) ── */
  return (
    <>
      <div className={cardClass}>
        <div className={innerCard}>
          <div className="text-center mb-6">
            <Logo />
            <h2 className="text-2xl font-bold text-white mt-4 mb-1">Reset Password</h2>
            <p className="text-gray-400 text-sm">Choose a strong new password</p>
          </div>

          {error && <div className={errorBox}>{error}</div>}

          <form onSubmit={handleResetPassword} className="space-y-5" noValidate>
            {/* New Password */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">New Password</label>
              <div className="relative">
                <input
                  type={showNew ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => { setNewPassword(e.target.value); setError(''); }}
                  className={`${inputClass} pr-10`}
                  placeholder="Create a strong password"
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowNew(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-200 transition"
                  tabIndex={-1}
                >
                  {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              {/* Live password requirements */}
              {newPassword.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {passwordRuleResults.map((r) => (
                    <li key={r.label} className={`text-xs flex items-center gap-1.5 ${r.passed ? 'text-green-400' : 'text-gray-500'}`}>
                      <span className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center flex-shrink-0 ${r.passed ? 'bg-green-500 border-green-500' : 'border-gray-600'}`}>
                        {r.passed && <span className="text-white text-[9px] font-bold">✓</span>}
                      </span>
                      {r.label}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Confirm Password */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Confirm Password</label>
              <div className="relative">
                <input
                  type={showConfirm ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                    if (confirmError) setConfirmError(e.target.value === newPassword ? '' : 'Passwords do not match');
                  }}
                  onBlur={() => setConfirmError(confirmPassword && confirmPassword !== newPassword ? 'Passwords do not match' : '')}
                  className={`${inputClass} pr-10 ${confirmError ? 'border-red-500 focus:border-red-500 focus:ring-red-500/30' : confirmPassword && confirmPassword === newPassword ? 'border-green-500' : ''}`}
                  placeholder="Repeat your password"
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-200 transition"
                  tabIndex={-1}
                >
                  {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {confirmError && <p className="text-red-400 text-xs mt-1">{confirmError}</p>}
              {!confirmError && confirmPassword && confirmPassword === newPassword && (
                <p className="text-green-400 text-xs mt-1 flex items-center gap-1"><ShieldCheck className="w-3.5 h-3.5" /> Passwords match</p>
              )}
            </div>

            <button
              type="submit"
              disabled={isLoading || !allRulesPassed || !confirmPassword}
              className={btnPrimary}
            >
              {isLoading ? 'Resetting...' : 'Reset Password'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <button onClick={() => navigate('/')} className="text-gray-400 hover:text-white text-sm flex items-center justify-center gap-1 mx-auto transition">
              <ArrowLeft className="w-4 h-4" /> Back to Login
            </button>
          </div>
        </div>
      </div>

      {showSuccessModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 px-4">
          <div className="bg-gray-800 border border-gray-700 rounded-2xl p-8 max-w-sm w-full text-center shadow-2xl">
            <div className="w-14 h-14 rounded-full bg-green-500/15 border border-green-500/30 flex items-center justify-center mx-auto mb-4">
              <ShieldCheck className="w-7 h-7 text-green-400" />
            </div>
            <Logo />
            <h2 className="text-xl font-semibold text-white mt-3 mb-2">Password Reset</h2>
            <p className="text-gray-400 text-sm mb-6">Your password has been reset successfully. You can now log in with your new password.</p>
            <button
              onClick={() => { setShowSuccessModal(false); navigate('/'); }}
              className={btnPrimary}
            >
              Back to Login
            </button>
          </div>
        </div>
      )}
    </>
  );
};
