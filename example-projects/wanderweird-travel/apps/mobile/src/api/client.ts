import { Platform } from 'react-native';
import type {
  CmsContentChild,
  CmsNavigation,
  CmsTabNode,
  DestinationOption,
  DiscoverPayload,
  LuggageLotteryPayload,
  PassportPayload,
  Trip,
  UserProfile,
} from '../types';

function defaultGatewayOrigin(): string {
  if (Platform.OS === 'android') {
    return 'http://10.0.2.2:4200';
  }
  return 'http://127.0.0.1:4200';
}

const GATEWAY_BASE = (
  process.env.EXPO_PUBLIC_GATEWAY_URL ?? defaultGatewayOrigin()
).replace(/\/$/, '');

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${GATEWAY_BASE}${path}`, {
    ...init,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });

  const payload: unknown = await response.json().catch(async () => ({
    error: await response.text(),
  }));

  if (!response.ok) {
    const message =
      typeof payload === 'object' &&
      payload !== null &&
      'error' in payload &&
      typeof (payload as { error: unknown }).error === 'string'
        ? (payload as { error: string }).error
        : `Request failed (${response.status})`;
    throw new Error(message);
  }

  return payload as T;
}

export const api = {
  gatewayBase: GATEWAY_BASE,

  login(username: string, password: string) {
    return request<{ token: string; user: UserProfile; welcomeMessage: string }>(
      '/api/auth/login',
      {
        method: 'POST',
        body: JSON.stringify({ username, password }),
      }
    );
  },

  me(token: string) {
    return request<{ user: UserProfile }>('/api/auth/me', {
      headers: { Authorization: `Bearer ${token}` },
    });
  },

  updateMe(token: string, body: Partial<UserProfile>) {
    return request<{ user: UserProfile }>('/api/auth/me', {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });
  },

  logout(token: string) {
    return request<{ ok: boolean }>('/api/auth/logout', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
  },

  listTrips(userId: string) {
    return request<{ trips: Trip[] }>(`/api/trips?userId=${encodeURIComponent(userId)}`);
  },

  getTrip(id: string) {
    return request<{ trip: Trip }>(`/api/trips/${encodeURIComponent(id)}`);
  },

  destinations() {
    return request<{ destinations: DestinationOption[] }>('/api/trips/destinations');
  },

  createTrip(body: Record<string, unknown>) {
    return request<{ trip: Trip }>('/api/trips', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },

  updateTrip(id: string, body: Record<string, unknown>) {
    return request<{ trip: Trip }>(`/api/trips/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    });
  },

  deleteTrip(id: string) {
    return request<{ ok: boolean }>(`/api/trips/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
  },

  chaosDice(id: string) {
    return request<{ roll: number; event: string; narration: string; trip: Trip }>(
      `/api/trips/${encodeURIComponent(id)}/chaos-dice`,
      { method: 'POST' }
    );
  },

  passport(userId: string) {
    return request<PassportPayload>(`/api/passport/${encodeURIComponent(userId)}`);
  },

  discover(destinationKey?: string) {
    const qs = destinationKey ? `?destinationKey=${encodeURIComponent(destinationKey)}` : '';
    return request<DiscoverPayload>(`/api/discover${qs}`);
  },

  luggageLottery() {
    return request<LuggageLotteryPayload>('/api/luggage-lottery');
  },

  cmsNavigation() {
    return request<CmsNavigation>('/api/cms/navigation');
  },

  cmsTab(screenKey: string) {
    return request<{ app: CmsNavigation['app']; tab: CmsTabNode; source: CmsNavigation['source'] }>(
      `/api/cms/tabs/${encodeURIComponent(screenKey)}`
    );
  },

  cmsPage(screenKey: string, slugPath: string) {
    const encoded = slugPath
      .split('/')
      .filter(Boolean)
      .map((part) => encodeURIComponent(part))
      .join('/');
    return request<{
      app: CmsNavigation['app'];
      tab: { id: string; screenKey: string; title: string };
      page: CmsContentChild;
      path: string[];
      breadcrumbs: Array<{ slug: string; title: string; slugPath: string }>;
      stackDepth: number;
      descendantCount: number;
      source: CmsNavigation['source'];
    }>(`/api/cms/tabs/${encodeURIComponent(screenKey)}/pages/${encoded}`);
  },
};
