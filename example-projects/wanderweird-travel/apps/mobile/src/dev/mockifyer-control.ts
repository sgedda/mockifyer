import {
  getCurrentDate,
  getCurrentScenario,
  setRuntimeDateManipulation,
  setScenarioLaunchOverride,
} from '@sgedda/mockifyer-core';
import type { MockifyerInstance } from '@sgedda/mockifyer-fetch/react-native';
import {
  resolveDashboardBaseUrl,
  resolveMetroOrigin,
} from './mockifyer-env';
import { unpatchedFetch } from './unpatched-fetch';

export type { MockifyerBackend } from './mockifyer-env';
export {
  defaultDashboardOrigin,
  resolveDashboardBaseUrl,
  resolveDefaultClientId,
  resolveMetroOrigin,
} from './mockifyer-env';

export interface ScenarioSnapshot {
  currentScenario: string;
  scenarios: string[];
  source: 'dashboard' | 'metro' | 'local';
}

export interface DateSnapshot {
  fixedDate: string | null;
  currentDate: string;
  scenario: string;
  source: 'dashboard' | 'local';
  /** Lane fixed date when Redis client lanes are available. */
  clientFixedDate: string | null;
  clientLanesEnabled: boolean;
}

async function readJsonError(response: Response, fallback: string): Promise<string> {
  try {
    const body = (await response.json()) as { error?: string; message?: string; details?: string };
    const main = body.error || body.message || '';
    const details = body.details?.trim() ?? '';
    if (main && details && details !== main) {
      return `${main}: ${details}`;
    }
    if (main) {
      return main;
    }
  } catch {
    // ignore parse errors
  }
  return fallback;
}

async function dashboardFetch(path: string, init?: RequestInit): Promise<Response> {
  const base = resolveDashboardBaseUrl().replace(/\/+$/, '');
  const normalizedPath = path.replace(/^\/+/, '');
  return unpatchedFetch(`${base}/${normalizedPath}`, {
    ...init,
    headers: {
      Accept: 'application/json',
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...(init?.headers ?? {}),
    },
  });
}

/**
 * Load scenarios from the Mockifyer dashboard (filesystem or Redis).
 * Falls back to Metro current scenario when the dashboard is unreachable.
 */
export async function loadScenarioSnapshot(mockDataPath = 'mock-data'): Promise<ScenarioSnapshot> {
  try {
    const response = await dashboardFetch('api/scenario-config');
    if (response.ok) {
      const data = (await response.json()) as {
        currentScenario?: string;
        scenarios?: string[];
      };
      const scenarios = Array.isArray(data.scenarios) ? data.scenarios : [];
      return {
        currentScenario: data.currentScenario?.trim() || getCurrentScenario(mockDataPath),
        scenarios: scenarios.length > 0 ? scenarios : [getCurrentScenario(mockDataPath)],
        source: 'dashboard',
      };
    }
  } catch {
    // dashboard optional in hybrid
  }

  try {
    const metroUrl = `${resolveMetroOrigin()}/mockifyer-scenario-config?t=${Date.now()}`;
    const response = await unpatchedFetch(metroUrl, { cache: 'no-store' } as RequestInit);
    if (response.ok) {
      const data = (await response.json()) as { currentScenario?: string };
      const current = data.currentScenario?.trim() || getCurrentScenario(mockDataPath);
      return {
        currentScenario: current,
        scenarios: Array.from(new Set([current, 'default', '_scratch'])).sort(),
        source: 'metro',
      };
    }
  } catch {
    // metro optional
  }

  const current = getCurrentScenario(mockDataPath);
  return {
    currentScenario: current,
    scenarios: Array.from(new Set([current, 'default', '_scratch'])).sort(),
    source: 'local',
  };
}

/**
 * Activate a scenario for the app and persist via dashboard (preferred) or Metro.
 */
export async function selectScenario(options: {
  scenario: string;
  instance: MockifyerInstance | null;
  mockDataPath?: string;
}): Promise<void> {
  const scenario = options.scenario.trim();
  if (!scenario) {
    throw new Error('Scenario name is required');
  }

  let persisted = false;

  try {
    const response = await dashboardFetch('api/scenario-config/set', {
      method: 'POST',
      body: JSON.stringify({ scenario }),
    });
    if (response.ok) {
      persisted = true;
    } else {
      throw new Error(await readJsonError(response, 'Failed to set scenario on dashboard'));
    }
  } catch (error) {
    if (persisted) {
      throw error;
    }
    // Fall through to Metro for hybrid without dashboard
  }

  if (!persisted) {
    const response = await unpatchedFetch(`${resolveMetroOrigin()}/mockifyer-scenario-config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        currentScenario: scenario,
        updatedAt: new Date().toISOString(),
      }),
    });
    if (!response.ok) {
      throw new Error(
        'Could not set scenario. Start the Mockifyer dashboard (`npm run dashboard`) or ensure Metro is running.'
      );
    }
  }

  // Immediate in-process switch (wins over scenario-config until cleared)
  setScenarioLaunchOverride(scenario);

  if (options.instance) {
    await options.instance.reloadMockData(true);
  }
}

/**
 * Create a scenario folder / Redis lane via dashboard, optionally derived from another scenario.
 */
export async function createScenario(options: {
  scenario: string;
  deriveFrom?: string | null;
}): Promise<ScenarioSnapshot> {
  const scenario = options.scenario.trim();
  if (!scenario) {
    throw new Error('Scenario name is required');
  }

  const response = await dashboardFetch('api/scenario-config/create', {
    method: 'POST',
    body: JSON.stringify({
      scenario,
      deriveFrom: options.deriveFrom?.trim() || null,
    }),
  });

  if (!response.ok) {
    throw new Error(
      `${await readJsonError(response, 'Failed to create scenario')}. Is the dashboard running?`
    );
  }

  const data = (await response.json()) as {
    currentScenario?: string;
    scenarios?: string[];
  };

  return {
    currentScenario: data.currentScenario?.trim() || scenario,
    scenarios: Array.isArray(data.scenarios) ? data.scenarios : [scenario],
    source: 'dashboard',
  };
}

/**
 * Load scenario + optional client-lane date config from the dashboard.
 */
export async function loadDateSnapshot(options: {
  scenario: string;
  clientId?: string;
}): Promise<DateSnapshot> {
  const scenario = options.scenario.trim();
  let fixedDate: string | null = null;
  let currentDate = getCurrentDate({ scenario }).toISOString();
  let source: DateSnapshot['source'] = 'local';
  let clientFixedDate: string | null = null;
  let clientLanesEnabled = false;

  try {
    const qs = scenario ? `?scenario=${encodeURIComponent(scenario)}` : '';
    const response = await dashboardFetch(`api/date-config${qs}`);
    if (response.ok) {
      const data = (await response.json()) as {
        dateManipulation?: { fixedDate?: string | null };
        currentDate?: string;
      };
      const fromConfig = data.dateManipulation?.fixedDate;
      fixedDate =
        typeof fromConfig === 'string' && fromConfig.trim() !== '' ? fromConfig.trim() : null;
      if (typeof data.currentDate === 'string' && data.currentDate.trim() !== '') {
        currentDate = data.currentDate;
      }
      source = 'dashboard';
    }
  } catch {
    // keep local fallback
  }

  const clientId = options.clientId?.trim();
  if (clientId) {
    try {
      const lanesResponse = await dashboardFetch('api/client-lanes');
      if (lanesResponse.ok) {
        const lanesData = (await lanesResponse.json()) as {
          enabled?: boolean;
          lanes?: Array<{ clientId: string; fixedDate?: string | null }>;
        };
        clientLanesEnabled = lanesData.enabled === true;
        const lane = lanesData.lanes?.find((row) => row.clientId === clientId);
        const laneDate = lane?.fixedDate;
        clientFixedDate =
          typeof laneDate === 'string' && laneDate.trim() !== '' ? laneDate.trim() : null;
      }
    } catch {
      // client lanes require redis/sqlite dashboard
    }
  }

  return {
    fixedDate,
    currentDate,
    scenario,
    source,
    clientFixedDate,
    clientLanesEnabled,
  };
}

/**
 * Set the scenario-level (global) fixed date used by getCurrentDate() for that scenario.
 */
export async function setScenarioDate(options: {
  scenario: string;
  fixedDate: string | null;
}): Promise<DateSnapshot> {
  const scenario = options.scenario.trim();
  const response = await dashboardFetch('api/date-config', {
    method: 'POST',
    body: JSON.stringify({
      scenario,
      fixedDate: options.fixedDate,
    }),
  });

  if (!response.ok) {
    throw new Error(
      `${await readJsonError(response, 'Failed to update scenario date')}. Is the dashboard running?`
    );
  }

  const data = (await response.json()) as {
    dateManipulation?: { fixedDate?: string | null };
    currentDate?: string;
  };

  const fixed =
    typeof data.dateManipulation?.fixedDate === 'string' &&
    data.dateManipulation.fixedDate.trim() !== ''
      ? data.dateManipulation.fixedDate.trim()
      : null;

  // Keep in-process getCurrentDate() aligned until the next dashboard poll.
  setRuntimeDateManipulation(
    fixed ? { fixedDate: fixed } : {},
    scenario
  );

  return {
    fixedDate: fixed,
    currentDate: data.currentDate ?? getCurrentDate({ scenario }).toISOString(),
    scenario,
    source: 'dashboard',
    clientFixedDate: null,
    clientLanesEnabled: false,
  };
}

/**
 * Set a client-lane fixed date (overrides scenario date for that lane on Redis/sqlite).
 * When lanes are unavailable, applies a local runtime date for this app process.
 */
export async function setClientDate(options: {
  clientId: string;
  scenario: string;
  fixedDate: string | null;
  instance: MockifyerInstance | null;
}): Promise<{ mode: 'lane' | 'local'; fixedDate: string | null }> {
  const clientId = options.clientId.trim();
  if (!clientId) {
    throw new Error('clientId is required');
  }

  if (options.instance) {
    options.instance.setClientId(clientId);
  }

  try {
    const response = await dashboardFetch(
      `api/client-lanes/${encodeURIComponent(clientId)}/date`,
      {
        method: 'PUT',
        body: JSON.stringify({ fixedDate: options.fixedDate }),
      }
    );
    if (response.ok) {
      setRuntimeDateManipulation(
        options.fixedDate ? { fixedDate: options.fixedDate } : {},
        options.scenario
      );
      return { mode: 'lane', fixedDate: options.fixedDate };
    }
    // 400 when provider is filesystem — fall through to local
  } catch {
    // fall through
  }

  setRuntimeDateManipulation(
    options.fixedDate ? { fixedDate: options.fixedDate } : {},
    options.scenario
  );
  return { mode: 'local', fixedDate: options.fixedDate };
}

/** Normalize a date-only or datetime string to ISO for the dashboard. */
export function toIsoFixedDate(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) {
    throw new Error('Date is required');
  }
  // Allow YYYY-MM-DD shorthand
  const candidate = /^\d{4}-\d{2}-\d{2}$/.test(trimmed)
    ? `${trimmed}T12:00:00.000Z`
    : trimmed;
  const parsed = new Date(candidate);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error('Invalid date. Use YYYY-MM-DD or full ISO 8601.');
  }
  return parsed.toISOString();
}
