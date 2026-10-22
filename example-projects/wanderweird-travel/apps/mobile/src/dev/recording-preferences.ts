import type { MockifyerInstance } from '@sgedda/mockifyer-fetch/react-native';
import { sessionStore } from '../session-store';

const RECORD_MODE_KEY = 'wanderweird.mockifyer.recordMode';
const RECORD_BODIES_KEY = 'wanderweird.mockifyer.recordResponses';

let cachedRecordMode: boolean | null = null;
let cachedRecordBodies: boolean | null = null;

export function getCachedRecordModePreference(): boolean | null {
  return cachedRecordMode;
}

export function getCachedRecordBodiesPreference(): boolean | null {
  return cachedRecordBodies;
}

export async function loadRecordModePreference(): Promise<boolean> {
  if (cachedRecordMode !== null) {
    return cachedRecordMode;
  }
  try {
    const raw = await sessionStore.getItem(RECORD_MODE_KEY);
    cachedRecordMode = raw === '1' || raw === 'true';
  } catch {
    cachedRecordMode = false;
  }
  return cachedRecordMode;
}

export async function loadRecordBodiesPreference(): Promise<boolean> {
  if (cachedRecordBodies !== null) {
    return cachedRecordBodies;
  }
  try {
    const raw = await sessionStore.getItem(RECORD_BODIES_KEY);
    // Default false — request-only stubs (Redis/proxy default).
    cachedRecordBodies = raw === '1' || raw === 'true';
  } catch {
    cachedRecordBodies = false;
  }
  return cachedRecordBodies;
}

export async function saveRecordModePreference(enabled: boolean): Promise<void> {
  cachedRecordMode = enabled;
  try {
    if (enabled) {
      await sessionStore.setItem(RECORD_MODE_KEY, '1');
    } else {
      await sessionStore.deleteItem(RECORD_MODE_KEY);
    }
  } catch (error) {
    console.warn('[Wanderweird] Failed to persist record-mode preference', error);
  }
}

export async function saveRecordBodiesPreference(enabled: boolean): Promise<void> {
  cachedRecordBodies = enabled;
  try {
    if (enabled) {
      await sessionStore.setItem(RECORD_BODIES_KEY, '1');
    } else {
      await sessionStore.deleteItem(RECORD_BODIES_KEY);
    }
  } catch (error) {
    console.warn('[Wanderweird] Failed to persist record-bodies preference', error);
  }
}

export function applyRecordModeToInstance(
  instance: MockifyerInstance | null | undefined,
  enabled: boolean
): void {
  if (!instance || typeof instance.setRecordMode !== 'function') {
    return;
  }
  if (instance.isRecordMode() === enabled) {
    return;
  }
  instance.setRecordMode(enabled);
}

export function applyRecordBodiesToInstance(
  instance: MockifyerInstance | null | undefined,
  enabled: boolean
): void {
  if (!instance || typeof instance.setRecordResponses !== 'function') {
    return;
  }
  if (instance.isRecordResponses() === enabled) {
    return;
  }
  instance.setRecordResponses(enabled);
}
