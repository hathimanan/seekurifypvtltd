import React, { createContext, useContext, useState, useEffect, ReactNode, useRef, useCallback } from 'react';
import { apiService } from '../services/api';
import { authService, SESSION_EXPIRED_EVENT } from '../services/authService';
import { useNavigate } from 'react-router-dom';

interface User {
  id: string;
  email: string;
  username?: string;
  pin?: string;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  verifyOtp: (email: string, otp: string, otpToken: string) => Promise<void>;
  verifyPin: (email: string, pin: string) => Promise<void>;
  signup: (email: string, username: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function base64UrlDecode(str: string): string {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) str += '=';
  return atob(str);
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const navigate = useNavigate();
  const expiryTimeoutRef = useRef<number | null>(null);

  const clearExpiryTimeout = useCallback(() => {
    if (expiryTimeoutRef.current !== null) {
      window.clearTimeout(expiryTimeoutRef.current);
      expiryTimeoutRef.current = null;
    }
  }, []);

  const parseTokenPayload = useCallback((token: string | null) => {
    if (!token) return null;
    try {
      const base64Payload = token.split('.')[1];
      const decodedPayload = base64UrlDecode(base64Payload);
      return JSON.parse(decodedPayload);
    } catch (err) {
      console.error('Failed to parse token payload:', err);
      return null;
    }
  }, []);

  const logout = useCallback(() => {
    clearExpiryTimeout();
    authService.clearSession();
    localStorage.removeItem('googleToken');
    setUser(null);
    navigate('/HomePageBefore', { replace: true });
  }, [clearExpiryTimeout, navigate]);

  const scheduleTokenExpiry = useCallback((token: string) => {
    clearExpiryTimeout();
    const payload = parseTokenPayload(token);
    if (!payload?.exp) {
      logout();
      return;
    }

    const expiresAt = payload.exp * 1000;
    const msUntilExpiry = expiresAt - Date.now();
    if (msUntilExpiry <= 0) {
      logout();
      return;
    }

    expiryTimeoutRef.current = window.setTimeout(() => {
      console.warn('Token expired during active session');
      authService.notifySessionExpired('token_expired');
    }, msUntilExpiry);
  }, [clearExpiryTimeout, logout, parseTokenPayload]);

  useEffect(() => {
    const token = localStorage.getItem('token');

    if (token) {
      const payload = parseTokenPayload(token);
      if (!payload?.exp || payload.exp * 1000 <= Date.now()) {
        console.warn('Token expired on load, logging out');
        logout();
        setIsLoading(false);
        return;
      }

      try {
        setUser({ id: payload.id || payload._id, email: payload.email });
        scheduleTokenExpiry(token);
      } catch (error) {
        console.error('Invalid token structure:', error);
        logout();
      }
    }

    setIsLoading(false);

    const handleSessionExpired = () => {
      logout();
    };

    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === 'token' && !event.newValue) {
        logout();
      }
    };

    window.addEventListener(SESSION_EXPIRED_EVENT, handleSessionExpired);
    window.addEventListener('storage', handleStorageChange);

    return () => {
      clearExpiryTimeout();
      window.removeEventListener(SESSION_EXPIRED_EVENT, handleSessionExpired);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [clearExpiryTimeout, logout, parseTokenPayload, scheduleTokenExpiry]);

  const login = async (email: string, password: string) => {
    await apiService.login({ email, password });
  };

  const verifyOtp = async (email: string, otp: string, otpToken: string) => {
    await apiService.onverifyOtp(email, otp, otpToken);
  };

  const verifyPin = async (email: string, pin: string) => {
    setIsLoading(true);
    try {
      const response = await apiService.verifyPin(email, pin);

      const token = response.token;
      localStorage.setItem('token', token); // <-- FIX: store token

      const payload = parseTokenPayload(token);
      if (!payload?.email) {
        throw new Error('Invalid token received from server.');
      }

      setUser({ id: payload.id || payload._id, email: payload.email });
      scheduleTokenExpiry(token);
    } finally {
      setIsLoading(false);
    }
  };

  const signup = async (email: string, username: string, password: string) => {
    await apiService.signup({ email, username, password });
  };

  const value = {
    user,
    isAuthenticated: !!user,
    isLoading,
    login,
    verifyOtp,
    verifyPin,
    signup,
    logout
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
