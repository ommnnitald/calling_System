import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { User } from '../types';
import { api, getStoredToken, setStoredToken, removeStoredToken } from '../services/api';

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; message?: string }>;
  register: (name: string, email: string, password: string) => Promise<{ success: boolean; message?: string }>;
  logout: () => void;
  updateUser: (updatedUser: User) => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(getStoredToken());
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Load authenticated user on mount if token exists
  useEffect(() => {
    const initAuth = async () => {
      const stored = getStoredToken();
      if (!stored) {
        setIsLoading(false);
        return;
      }
      try {
        const res = await api.getMe();
        if (res.success && res.data?.user) {
          setUser(res.data.user);
          setToken(stored);
        } else {
          removeStoredToken();
          setToken(null);
          setUser(null);
        }
      } catch (err) {
        console.warn('[Auth] Failed to restore session:', err);
      } finally {
        setIsLoading(false);
      }
    };

    initAuth();
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res = await api.login(email, password);
    if (res.success && res.data) {
      setStoredToken(res.data.token);
      setToken(res.data.token);
      setUser(res.data.user);
      return { success: true, message: res.data.message };
    }
    return { success: false, message: res.message || 'Login failed.' };
  }, []);

  const register = useCallback(async (name: string, email: string, password: string) => {
    const res = await api.register(name, email, password);
    if (res.success && res.data) {
      setStoredToken(res.data.token);
      setToken(res.data.token);
      setUser(res.data.user);
      return { success: true, message: res.data.message };
    }
    return { success: false, message: res.message || 'Registration failed.' };
  }, []);

  const logout = useCallback(() => {
    removeStoredToken();
    setToken(null);
    setUser(null);
  }, []);

  const updateUser = useCallback((updatedUser: User) => {
    setUser(updatedUser);
  }, []);

  const refreshUser = useCallback(async () => {
    if (!token) return;
    try {
      const res = await api.getMe();
      if (res.success && res.data?.user) {
        setUser(res.data.user);
      }
    } catch (_) {}
  }, [token]);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        isAuthenticated: Boolean(user),
        login,
        register,
        logout,
        updateUser,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
