import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import type { AuthUser } from './types';

const SESSION_KEY = 'mockifyer-expo-auth-session';

/** Web-only key/value without pulling full DOM lib typings into RN `tsc`. */
interface WebStorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

function webLocalStorage(): WebStorageLike | undefined {
  if (typeof globalThis === 'object' && globalThis !== null && 'localStorage' in globalThis) {
    return (globalThis as { localStorage?: WebStorageLike }).localStorage;
  }
  return undefined;
}

export async function loadStoredUser(): Promise<AuthUser | null> {
  try {
    if (Platform.OS === 'web') {
      const storage = webLocalStorage();
      if (!storage) {
        return null;
      }
      const raw = storage.getItem(SESSION_KEY);
      if (!raw?.trim()) {
        return null;
      }
      return parseUser(raw);
    }
    const raw = await SecureStore.getItemAsync(SESSION_KEY);
    if (!raw?.trim()) {
      return null;
    }
    return parseUser(raw);
  } catch {
    return null;
  }
}

export async function saveStoredUser(user: AuthUser): Promise<void> {
  const raw = JSON.stringify(user);
  if (Platform.OS === 'web') {
    const storage = webLocalStorage();
    if (storage) {
      storage.setItem(SESSION_KEY, raw);
    }
    return;
  }
  await SecureStore.setItemAsync(SESSION_KEY, raw, {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
}

export async function clearStoredUser(): Promise<void> {
  try {
    if (Platform.OS === 'web') {
      const storage = webLocalStorage();
      if (storage) {
        storage.removeItem(SESSION_KEY);
      }
      return;
    }
    await SecureStore.deleteItemAsync(SESSION_KEY);
  } catch {
    /* ignore */
  }
}

function parseUser(raw: string): AuthUser | null {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') {
      return null;
    }
    const o = parsed as Record<string, unknown>;
    const id = typeof o.id === 'string' ? o.id : '';
    const email = typeof o.email === 'string' ? o.email : '';
    const name = typeof o.name === 'string' ? o.name : '';
    /** Drop legacy Clerk/OAuth-shaped sessions — this example is demo-only. */
    if (o.provider !== 'demo') {
      return null;
    }
    if (!id) {
      return null;
    }
    return { id, email, name, provider: 'demo' };
  } catch {
    return null;
  }
}
