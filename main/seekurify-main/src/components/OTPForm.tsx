import React, { useState, useRef, useEffect } from 'react';
import { X, Mail } from 'lucide-react';
import { apiService } from '../services/api';
import { Logo } from './ui/logo';

interface OTPFormProps {
  email: string;
  otpToken: string;
  onBack: () => void;
  onSuccess?: () => void;
}

export const OTPForm: React.FC<OTPFormProps> = ({ email, otpToken, onBack, onSuccess }) => {
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const isOtpValid = otp.every((digit) => /^\d$/.test(digit));

  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  const handleInputChange = (index: number, value: string) => {
    if (value.length > 1 || !/^\d*$/.test(value)) return;
    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);
    setError('');
    if (value && index < 5) inputRefs.current[index + 1]?.focus();
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    const newOtp = [...otp];
    for (let i = 0; i < pastedData.length && i < 6; i++) newOtp[i] = pastedData[i];
    setOtp(newOtp);
    inputRefs.current[Math.min(pastedData.length, 5)]?.focus();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpToken) {
      setError('Missing OTP token. Please log in again.');
      return;
    }
    const otpString = otp.join('');
    if (otpString.length !== 6) {
      setError('Please enter all 6 digits.');
      return;
    }
    setIsLoading(true);
    setError('');
    try {
      await apiService.onverifyOtp(email, otpString, otpToken);
      if (onSuccess) onSuccess();
    } catch (err: any) {
      setError(err?.message || 'Invalid OTP. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">

        {/* Error */}
        {error && (
          <div className="mb-5 rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="w-5 h-5 rounded-full bg-red-500 flex items-center justify-center flex-shrink-0">
                <span className="text-white text-xs font-bold">!</span>
              </div>
              <span className="text-red-400 text-sm">{error}</span>
            </div>
            <button onClick={() => setError('')} className="text-red-500 hover:text-red-300 transition ml-3">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Card */}
        <div className="bg-gray-800 border border-gray-700 rounded-2xl shadow-xl px-8 py-10">
          {/* Logo + header */}
          <div className="flex flex-col items-center mb-8">
            <Logo />
            <h1 className="text-2xl font-bold text-white mt-4">Email Verification</h1>
            <p className="text-gray-400 text-sm mt-1.5 text-center">
              We sent a 6-digit code to
            </p>
            <div className="flex items-center gap-1.5 mt-1">
              <Mail className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-amber-400 text-sm font-medium">{email}</span>
            </div>
          </div>

          <form onSubmit={handleSubmit}>
            {/* OTP inputs */}
            <div className="flex justify-center gap-3 mb-8">
              {otp.map((digit, index) => (
                <input
                  key={index}
                  ref={(el) => { inputRefs.current[index] = el; }}
                  type="password"
                  inputMode="numeric"
                  value={digit}
                  onChange={(e) => handleInputChange(index, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(index, e)}
                  onPaste={index === 0 ? handlePaste : undefined}
                  maxLength={1}
                  className={`w-12 h-12 text-center text-xl font-bold rounded-xl border transition-all duration-150 bg-gray-900 text-white outline-none
                    ${digit ? 'border-amber-500 ring-2 ring-amber-500/20' : 'border-gray-600'}
                    focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20`}
                />
              ))}
            </div>

            <button
              type="submit"
              disabled={isLoading || !isOtpValid}
              className="w-full bg-amber-500 hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed text-slate-900 font-semibold py-3 rounded-xl transition-all duration-200 shadow-md"
            >
              {isLoading ? 'Verifying…' : 'Verify Code'}
            </button>
          </form>
        </div>

        {/* Back link */}
        <div className="mt-6 text-center">
          <button
            onClick={onBack}
            className="text-sm text-amber-400 hover:text-amber-300 transition font-medium hover:underline underline-offset-2"
          >
            ← Back to login
          </button>
        </div>
      </div>
    </div>
  );
};
