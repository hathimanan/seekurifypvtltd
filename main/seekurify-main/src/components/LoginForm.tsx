import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';
import { OTPForm } from './OTPForm';
import { ForgotPasswordForm } from './ForgotPasswordForm';
import { PINForm } from './PINForm';
// import { GoogleSignInButton } from './GoogleSignInButton';
import { useNavigate } from 'react-router-dom';
import { apiService, API_BASE_URL } from '../services/api';
import { ArrowLeft } from 'lucide-react';
import { Logo } from './ui/logo';


interface LoginFormProps {
  onToggleMode: () => void;
}

export const LoginForm: React.FC<LoginFormProps> = ({ onToggleMode }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [otpPayload, setOtpPayload] = useState<{ email: string; otpToken: string } | null>(null);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [showPIN, setShowPIN] = useState(false);
const [otpEnabled, setOtpEnabled] = useState<boolean | null>(null);
  const [success, setSuccess] = useState(false);
  const { login, verifyPin } = useAuth();
  const navigate = useNavigate();

  // Step 1: Handle Login
const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  setError('');
  setEmailError('');
  setPasswordError('');

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  let hasError = false;

  if (!email.trim()) {
    setEmailError('Email is required');
    hasError = true;
  } else if (!emailRegex.test(email)) {
    setEmailError('Invalid email format');
    hasError = true;
  }

  if (!password.trim()) {
    setPasswordError('Password is required');
    hasError = true;
  } else if (password.length < 6) {
    setPasswordError('Password length is too small');
    hasError = true;
  } else if (password.length > 18) {
    setPasswordError('Password length is too large');
    hasError = true;
  }

  if (hasError) return;

  setIsLoading(true);

  try {
    // 🔹 Step 1: Login
    const loginRes = await apiService.login({ email, password });

    if (loginRes.status === "suspicious") {
      navigate("/warning", {
        state: {
          email,
          ip: loginRes.details?.ip,
          location: loginRes.details?.location,
          reason: loginRes.details?.reason,
        },
      });
      return;
    }

    // Only store token if backend sends it
    if (loginRes.token) {
      localStorage.setItem('token', loginRes.token);
    }




    if (otpEnabled === null) {
  setError("Loading security configuration. Please wait...");
  setIsLoading(false);
  return;
}

if (otpEnabled === false) {
  
  // OTP disabled → go to PIN
  setShowPIN(true);
  setOtpPayload({ email, otpToken: '' });
  setIsLoading(false);
  return;
}

// OTP enabled → send OTP




    // 🔹 Step 2: Request OTP
    const otpRes = await fetch(`${API_BASE_URL}/auth/send-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });

    if (!otpRes.ok) {
      const contentType = otpRes.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const errorData = await otpRes.json();
        throw new Error(errorData.error || 'Failed to send OTP.');
      }
      const text = await otpRes.text();
      throw new Error(text.trim() || 'Failed to send OTP.');
    }

    const otpContentType = otpRes.headers.get('content-type') || '';
    if (!otpContentType.includes('application/json')) {
      throw new Error('Invalid OTP response from server.');
    }

    const { otpToken } = await otpRes.json();
    setOtpPayload({ email, otpToken });

  } catch (err: any) {
    const message =
      err?.message ||
      'Login failed. Please try again.';
    setError(message);
  } finally {
    setIsLoading(false);
  }
};


  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => {
        navigate('/homepageAfterLogin');
      }, 2000);
      return () => clearTimeout(timer);
    }


   const fetchOtpFlag = async () => {
  try {
    const res = await fetch(`${API_BASE_URL}/feature-flags/read`);
    const contentType = res.headers.get('content-type') || '';
    if (!res.ok || !contentType.includes('application/json')) {
      throw new Error('Invalid feature flag response');
    }
    const data = await res.json();

    setOtpEnabled(data.otpEnabled); // <-- MongoDB value
  } catch (err) {
    setOtpEnabled(true); // secure default
  }
};


    fetchOtpFlag();
  },[]);

  // Step 3: Handle PIN Verification
  const handleVerifyPIN = async (pin: string) => {
    try {
      await verifyPin(otpPayload?.email ?? '', pin); // updates AuthContext
      // Immediately navigate after successful verify
      navigate('/homepageAfterLogin', { replace: true });
    } catch (err: any) {
      setError(err?.message || 'Incorrect PIN');
    }
  };

  const handleBackToLogin = () => {
    setOtpPayload(null);
    setShowPIN(false);
    setShowForgotPassword(false);
    setError('');
  };

  const handleBackToHome = () => {
    navigate('/');
  };

  // OTP screen
  if (otpPayload && !showPIN) {
    return (
      <OTPForm
        email={otpPayload.email}
        otpToken={otpPayload.otpToken}
        onBack={handleBackToLogin}
        onSuccess={() => {
          setShowPIN(true);
        }}
      />
    );
  }

  // PIN screen
  if (showPIN && otpPayload) {
    return (
      <PINForm
        email={otpPayload.email}
        onBack={handleBackToLogin}
        onVerifyPIN={handleVerifyPIN}
      />
    );
  }

  // Forgot Password
  if (showForgotPassword) {
    return <ForgotPasswordForm />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        {success && (
          <div className="mb-6 rounded-xl border border-green-400 bg-green-50 px-4 py-3 flex items-center justify-between shadow-md animate-bounce">
            <div className="flex items-center space-x-3">
              <div className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center animate-pulse">
                <span className="text-white text-sm font-bold">✓</span>
              </div>
              <span className="text-green-800 font-medium">Login successful! Redirecting...</span>
            </div>
          </div>
        )}

        {!success && (
          <Card className="bg-white/90 backdrop-blur-xl rounded-2xl shadow-xl border border-gray-200 transition hover:shadow-2xl">
            <CardContent className="p-8">
              <div className="text-center mb-6">
               <Logo />
                <h1 className="text-4xl font-extrabold text-amber-400 drop-shadow-sm">
                  Login to Seekurify
                </h1>
                <p className="text-gray-500 mt-1">Sign in to your Seekurify account</p>
              </div>

                                    <div className="mt-6 text-center">
          <button
            onClick={handleBackToHome}
            className="text-gray-600 hover:text-gray-800 flex items-center justify-center space-x-1"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to home</span>
          </button>
        </div>
        <br></br>

              {error && (
                <div className="flex items-start space-x-2 text-sm text-red-700 bg-red-50 border border-red-300 rounded-xl px-4 py-3 mb-6 shadow-sm">
                  <svg
                    className="h-5 w-5 mt-0.5 text-red-500 animate-shake"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path d="M18 10c0 4.418-3.582 8-8 8s-8-3.582-8-8 3.582-8 8-8 8 3.582 8 8zm-8-1V5h2v4h-2zm0 4v-2h2v2h-2z"/>
                  </svg>
                  <span>{error}</span>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <label htmlFor="email" className="block text-sm font-semibold text-gray-700 mb-1">
                    Email Address
                  </label>
                  <input
                    type="text"
                    id="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-md bg-white/80 text-gray-900 focus:outline-none focus:ring-2 focus:ring-amber-400 transition shadow-sm"
                    placeholder='Enter your email here'
                  />
                  {emailError && <p className="text-red-600 text-sm mt-1">{emailError}</p>}
                </div>

                <div>
                  <label htmlFor="password" className="block text-sm font-semibold text-gray-700 mb-1">
                    Password
                  </label>
                  <input
                    type="password"
                    id="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="off"
                    
                    className="w-full px-4 py-3 border border-gray-300 rounded-md bg-white/80 text-gray-900 focus:outline-none focus:ring-2 focus:ring-amber-400 transition shadow-sm"
                    placeholder='Enter your password here'
                  />
                  <div className="text-right mt-2">
                    <button
                      type="button"
                      onClick={() => setShowForgotPassword(true)}
                      className="text-sm text-amber-400 hover:text-amber-300 transition underline"
                    >
                      Forgot Password?
                    </button>
                  </div>
                  {passwordError && <p className="text-red-600 text-sm mt-1">{passwordError}</p>}
                </div>

                <Button
                  type="submit"
  disabled={isLoading || otpEnabled === null}
                    className="w-full bg-amber-500 hover:bg-amber-400 text-slate-900 font-semibold py-3 px-4 rounded-md text-lg shadow-md hover:shadow-lg transition transform hover:scale-[1.02] disabled:opacity-50"
                >
             {otpEnabled === null
    ? "Loading security..."
    : isLoading
    ? "Authenticating..."
    : "Login"}
                </Button>
              </form>

              <div className="mt-6 space-y-3">
                {/* <GoogleSignInButton
                  onSuccess={() => {
                    setSuccess(true);
                  }}
                /> */}

                {/* <Button
                  type="button"
                  className="w-full bg-gray-200 hover:bg-gray-300 text-gray-800 py-3 px-4 rounded-md font-medium flex items-center justify-center space-x-2 transition shadow-sm hover:shadow-md"
                >
                  <span>Sign In with Microsoft</span>
                  <span className="text-xl">⊞</span>
                </Button> */}
              </div>

              <div className="mt-6 text-center">
                <p className="text-sm text-gray-600">
                  Don’t have an account?{' '}
                  <button
                    onClick={onToggleMode}
                    className="text-amber-400 hover:text-amber-300 font-semibold transition"
                  >
                    Create one
                  </button>
                </p>
              </div>



            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};
