import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';
import { ArrowLeft } from 'lucide-react';
import { Logo } from './ui/logo';
import { InformationCircleIcon } from "@heroicons/react/24/solid";


export const SignupForm: React.FC = () => {
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  const [emailError, setEmailError] = useState('');
const [usernameError, setUsernameError] = useState('');
const [passwordError, setPasswordError] = useState('');
const [confirmPasswordError, setConfirmPasswordError] = useState('');
const [passwordStrength, setPasswordStrength] = useState<'weak' | 'medium' | 'strong' | ''>('');

  const { signup } = useAuth();
  const navigate = useNavigate();

const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  setError('');
  setSuccessMessage('');

  let hasError = false;

  // Email validation
  if (!email.trim()) {
    setEmailError('Email is required');
    hasError = true;
  } else {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setEmailError('Enter a valid email address');
      hasError = true;
    } else {
      setEmailError('');
    }
  }

  // Username validation
  if (!username.trim()) {
    setUsernameError('Username is required');
    hasError = true;
  } else {
    setUsernameError('');
  }

  // Password validation
  if (!password.trim()) {
    setPasswordError('Password is required');
    hasError = true;
  } else if (password.length < 8 || password.length > 16) {
    setPasswordError('Password must be 8–16 characters long');
    hasError = true;
  } else if (!/[A-Z]/.test(password)) {
    setPasswordError('Password must contain at least one uppercase letter');
    hasError = true;
  } else if (!/[a-z]/.test(password)) {
    setPasswordError('Password must contain at least one lowercase letter');
    hasError = true;
  } else if (!/[0-9]/.test(password)) {
    setPasswordError('Password must contain at least one number');
    hasError = true;
  } else if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    setPasswordError('Password must contain at least one symbol');
    hasError = true;
  } else {
    setPasswordError('');
  }

  // Confirm password validation
  if (!confirmPassword.trim()) {
    setConfirmPasswordError('Confirm Password is required');
    hasError = true;
  } else if (confirmPassword !== password) {
    setConfirmPasswordError('Passwords do not match');
    hasError = true;
  } else {
    setConfirmPasswordError('');
  }

  if (hasError) return; // stop submission if any field fails

  setIsLoading(true);

  try {
    await signup(email, username, password);
    setSuccessMessage(`A verification email has been sent to ${email}`);
    setTimeout(() => window.close(), 3000);
  } catch (err) {
    setError(err instanceof Error ? err.message : 'Signup failed');
  }

  setIsLoading(false);
};

const handleBackToHome = () => {
    navigate('/');
  };

const checkPasswordStrength = (pwd: string) => {
  if (!pwd) return '';
  if (pwd.length < 8) return 'weak';

  const hasNumbers = /\d/.test(pwd);
  const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(pwd);
  const hasUpper = /[A-Z]/.test(pwd);

  if (pwd.length >= 12 && hasNumbers && hasSpecial && hasUpper) {
    return 'strong';
  }
  return 'medium';
};


  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center px-4 py-10">
      <Card className="w-full max-w-md bg-white shadow-xl rounded-2xl border border-gray-100">
        <CardContent className="p-8">
 <div className="text-center mb-6">
          <Logo />
                <h1 className="text-4xl font-extrabold text-amber-500 drop-shadow-sm">
                  Join Seekurify
                </h1>
                <p className="text-gray-500 mt-1">Sign Up to your Seekurify account</p>
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

          {/* <h2 className="text-3xl font-extrabold text-center text-gray-800 mb-6">
            Create Account
          </h2> */}

          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-md mb-4 animate-fadeIn">
              {error}
            </div>
          )}

          {successMessage && (
            <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded-md mb-4 animate-fadeIn">
              {successMessage} <br />
              You can now close this tab.
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Email */}
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Email
              </label>
              <input
                type="text"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@example.com"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400 transition duration-200"
                
              />
                {emailError && <p className="text-red-500 text-sm mt-1">{emailError}</p>}
            </div>

            {/* Username */}
            <div>
              <label
                htmlFor="username"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Username
              </label>
              <input
                type="text"
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter your username"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400 transition duration-200"
                
              />

                {usernameError && <p className="text-red-500 text-sm mt-1">{usernameError}</p>}
            </div>

            {/* Password */}
            <div>
            <label
    htmlFor="password"
    className="flex items-center justify-between text-sm font-medium text-gray-700 mb-1"
  >
                <span>Password</span>

    <div className="relative flex items-center group cursor-pointer">
  {/* Heroicon */}
  <InformationCircleIcon className="h-5 w-5 text-gray-500 group-hover:text-amber-500 transition" />

  {/* Tooltip */}
  <div className="absolute right-0 top-full mt-2 z-50 w-72 p-3 bg-white border border-gray-300 
    rounded-lg shadow-lg text-sm text-gray-700 opacity-0 group-hover:opacity-100 
    transition-opacity duration-200 pointer-events-none">
    
    <p className="mb-1 font-medium">Password Requirements:</p>
    <ul className="list-disc list-inside text-gray-600 space-y-1">
      <li>Must be 8–16 characters long</li>
      <li>At least one uppercase letter (A–Z)</li>
      <li>At least one lowercase letter (a–z)</li>
      <li>At least one number (0–9)</li>
      <li>At least one symbol (!@#$%^&* etc.)</li>
    </ul>
  </div>

</div>


              </label>
              <input
                type="password"
                id="password"
                value={password}
                onChange={(e) => { setPassword(e.target.value);
                  setPasswordStrength(checkPasswordStrength(e.target.value));}}
                placeholder="At least 6 characters"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400 transition duration-200"
                
              />
{/* Icon Wrapper */}



                {passwordError && <p className="text-red-500 text-sm mt-1">{passwordError}</p>}

                  {password && (
    <div className="mt-2 h-2 w-full bg-gray-200 rounded">
      <div
        className={`h-2 rounded ${
          passwordStrength === 'weak'
            ? 'bg-red-500 w-1/3'
            : passwordStrength === 'medium'
            ? 'bg-yellow-400 w-2/3'
            : passwordStrength === 'strong'
            ? 'bg-green-500 w-full'
            : ''
        }`}
      ></div>
    </div>
  )}
            </div>

            {/* Confirm Password */}
            <div>
              <label
                htmlFor="confirmPassword"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Confirm Password
              </label>
              <input
                type="password"
                id="confirmPassword"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repeat your password"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400 transition duration-200"
                
              />
                {confirmPasswordError && <p className="text-red-500 text-sm mt-1">{confirmPasswordError}</p>}
            </div>

            <Button
              type="submit"
              disabled={isLoading}
              className="w-full bg-amber-500 hover:bg-amber-400 text-slate-900 py-2 rounded-lg font-semibold transition-all duration-200"
            >
              {isLoading ? 'Creating Account...' : 'Sign Up'}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-gray-600">
              Already have an account?{' '}
              <button
                onClick={() => navigate('/login')}
                className="text-amber-400 hover:text-amber-300 font-medium transition-colors duration-200"
              >
                Login
              </button>
            </p>
          </div>


 
        </CardContent>
      </Card>
    </div>
  );
};
