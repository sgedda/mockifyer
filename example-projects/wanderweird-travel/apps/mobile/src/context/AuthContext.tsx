import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api } from '../api/client';
import { sessionStore } from '../session-store';
import type { UserProfile } from '../types';

const TOKEN_KEY = 'wanderweird_token';

interface AuthContextValue {
  user: UserProfile | null;
  token: string | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<string>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  updateProfile: (patch: Partial<UserProfile>) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      try {
        const stored = await sessionStore.getItem(TOKEN_KEY);
        if (!stored) {
          return;
        }
        const result = await api.me(stored);
        if (!cancelled) {
          setToken(stored);
          setUser(result.user);
        }
      } catch {
        await sessionStore.deleteItem(TOKEN_KEY);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void bootstrap();
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    const result = await api.login(username, password);
    await sessionStore.setItem(TOKEN_KEY, result.token);
    setToken(result.token);
    setUser(result.user);
    return result.welcomeMessage;
  }, []);

  const logout = useCallback(async () => {
    if (token) {
      try {
        await api.logout(token);
      } catch {
        // Ignore logout network errors — clear local session anyway.
      }
    }
    await sessionStore.deleteItem(TOKEN_KEY);
    setToken(null);
    setUser(null);
  }, [token]);

  const refreshProfile = useCallback(async () => {
    if (!token) {
      return;
    }
    const result = await api.me(token);
    setUser(result.user);
  }, [token]);

  const updateProfile = useCallback(
    async (patch: Partial<UserProfile>) => {
      if (!token) {
        throw new Error('Not signed in');
      }
      const result = await api.updateMe(token, patch);
      setUser(result.user);
    },
    [token]
  );

  const value = useMemo(
    () => ({
      user,
      token,
      loading,
      login,
      logout,
      refreshProfile,
      updateProfile,
    }),
    [user, token, loading, login, logout, refreshProfile, updateProfile]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}
