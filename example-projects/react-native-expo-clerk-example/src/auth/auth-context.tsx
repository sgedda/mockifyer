import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactElement,
  type ReactNode,
} from 'react';
import { clearStoredUser, loadStoredUser, saveStoredUser } from './session-storage';
import type { AuthUser } from './types';

interface AuthContextValue {
  hydrated: boolean;
  user: AuthUser | null;
  signOut: () => Promise<void>;
  signInDemo: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const DEMO_USER: AuthUser = {
  id: 'demo-user-local',
  email: 'demo@example.local',
  name: 'Demo user',
  provider: 'demo',
};

export function AuthProvider(props: { children: ReactNode }): ReactElement {
  const { children } = props;
  const [hydrated, setHydrated] = useState(false);
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const restored = await loadStoredUser();
      if (!cancelled) {
        setUser(restored);
        setHydrated(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const signOut = useCallback(async () => {
    await clearStoredUser();
    setUser(null);
  }, []);

  const signInDemo = useCallback(async () => {
    await saveStoredUser(DEMO_USER);
    setUser(DEMO_USER);
  }, []);

  const value = useMemo(
    (): AuthContextValue => ({
      hydrated,
      user,
      signOut,
      signInDemo,
    }),
    [hydrated, signInDemo, signOut, user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAppAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAppAuth must be used within AuthProvider');
  }
  return ctx;
}
