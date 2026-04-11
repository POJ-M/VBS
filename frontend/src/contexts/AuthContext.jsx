import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { authAPI } from '../services/api';
import toast from 'react-hot-toast';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser]         = useState(null);
  const [loading, setLoading]   = useState(true);
  // freshLogin: true only when the user explicitly called login().
  // false on page-refresh token restore — prevents mustChangePassword
  // redirect from firing on every page load.
  const [freshLogin, setFreshLogin] = useState(false);

  // Use a ref to track mount state and avoid setState after unmount
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const initAuth = useCallback(async () => {
    const token = localStorage.getItem('accessToken');
    if (!token) {
      if (mountedRef.current) setLoading(false);
      return;
    }
    try {
      const { data } = await authAPI.me();
      if (mountedRef.current) {
        // Token restore: set user but do NOT set freshLogin.
        // This ensures mustChangePassword redirect only fires after
        // an explicit login() call, not on every page refresh.
        setUser(data.data);
      }
    } catch {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, []);

  // Run once on mount — stable reference via useCallback
  useEffect(() => {
    initAuth();
  }, [initAuth]);

  const login = useCallback(async (userID, password) => {
    const { data } = await authAPI.login({ userID, password });
    localStorage.setItem('accessToken', data.data.accessToken);
    localStorage.setItem('refreshToken', data.data.refreshToken);
    const loggedInUser = data.data.user;
    setUser(loggedInUser);
    setFreshLogin(true); // Mark as explicit login — enables redirect logic
    return loggedInUser;
  }, []);

  const logout = useCallback(async () => {
    try {
      const refreshToken = localStorage.getItem('refreshToken');
      await authAPI.logout(refreshToken);
    } catch { /* ignore logout API errors */ }
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    setUser(null);
    setFreshLogin(false);
    toast.success('Logged out successfully');
  }, []);

  // Called after password change redirect to clear the flag
  const clearMustChangePassword = useCallback(() => {
    setUser(prev => prev ? { ...prev, mustChangePassword: false } : prev);
    setFreshLogin(false);
  }, []);

  const updateUser = useCallback((updates) => {
    setUser(prev => prev ? { ...prev, ...updates } : prev);
  }, []);

  // Stable context value — only rebuilds when state actually changes
  const value = React.useMemo(
    () => ({ user, loading, freshLogin, login, logout, updateUser, clearMustChangePassword }),
    [user, loading, freshLogin, login, logout, updateUser, clearMustChangePassword]
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};