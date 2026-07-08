import React, { useState, useRef, useEffect } from 'react';
import { X, ShieldCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { API_BASE_URL } from '../services/api';
import { Logo } from './ui/logo';
import PasswordChangeModal from './PasswordChangeModal';

interface PINFormProps {
  email: string;
  onBack: () => void;
  onVerifyPIN?: (pin: string) => void;
}

interface VerifyPinResponse {
  token?: string;
  error?: string;
  shouldForcePasswordChange?: boolean;
}

export const PINForm: React.FC<PINFormProps> = ({ email, onBack }) => {
  const [pin, setPin] = useState(['', '', '', '']);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPasswordChangeModal, setShowPasswordChangeModal] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  const handleInputChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value) || value.length > 1) return;
    const newPin = [...pin];
    newPin[index] = value;
    setPin(newPin);
    setError('');
    if (value && index < 3) inputRefs.current[index + 1]?.focus();
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !pin[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 4);
    const newPin = [...pin];
    for (let i = 0; i < pastedData.length; i++) newPin[i] = pastedData[i];
    setPin(newPin);
    inputRefs.current[Math.min(pastedData.length, 3)]?.focus();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const fullPin = pin.join('');
    if (fullPin.length !== 4) return;

    setIsLoading(true);
    setError('');

    try {
      const response = await fetch(`${API_BASE_URL}/auth/verify-pin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, pin: fullPin }),
      });

      if (response.status === 204) throw new Error('Empty response from server');

      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) throw new Error('Invalid server response');

      const data: VerifyPinResponse = await response.json();

      if (!response.ok || !data.token) throw new Error(data.error || 'Invalid PIN');

      localStorage.setItem('token', data.token);

      if (data.shouldForcePasswordChange) {
        setShowPasswordChangeModal(true);
        return;
      }

      navigate('/homepageAfterLogin', { replace: true });
    } catch (err: any) {
      setError(err.message || 'Failed to verify PIN. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const isPinComplete = pin.join('').length === 4;

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
            <h1 className="text-2xl font-bold text-white mt-4">Enter Your PIN</h1>
            <p className="text-gray-400 text-sm mt-1.5 text-center">
              Enter your 4-digit security PIN to continue
            </p>
          </div>

          <form onSubmit={handleSubmit}>
            {/* PIN inputs */}
            <div className="flex justify-center gap-4 mb-8">
              {pin.map((digit, index) => (
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
                  className={`w-16 h-16 text-center text-2xl font-bold rounded-xl border transition-all duration-150 bg-gray-900 text-white outline-none
                    ${digit ? 'border-amber-500 ring-2 ring-amber-500/20' : 'border-gray-600'}
                    focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20`}
                />
              ))}
            </div>

            <button
              type="submit"
              disabled={isLoading || !isPinComplete}
              className="w-full bg-amber-500 hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed text-slate-900 font-semibold py-3 rounded-xl transition-all duration-200 shadow-md"
            >
              {isLoading ? 'Verifying…' : 'Confirm PIN'}
            </button>
          </form>

          {/* Hint */}
          <div className="mt-6 flex items-center justify-center gap-2 text-xs text-gray-500">
            <ShieldCheck className="w-3.5 h-3.5 text-amber-500/60" />
            Your PIN is encrypted and never stored in plain text
          </div>
        </div>

        {/* Back link */}
        <div className="mt-6 text-center">
          <button
            onClick={onBack}
            className="text-sm text-amber-400 hover:text-amber-300 transition font-medium hover:underline underline-offset-2"
          >
            ← Back to OTP
          </button>
        </div>
      </div>

      {showPasswordChangeModal && <PasswordChangeModal />}
    </div>
  );
};
