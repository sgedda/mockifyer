import { ENV_VARS, type MockifyerActivationMode, type MockifyerConfig } from '../types';

/** Canonical outbound header: presence (non-empty) gates Mockifyer when `activationMode` is `client_id_header`. */
export const MOCKIFYER_CLIENT_ID_HEADER = 'x-mockifyer-client-id';

/**
 * Reads `X-Mockifyer-Client-Id` from axios/fetch-style headers (plain object, AxiosHeaders, or Headers-like).
 */
export function getOutboundMockifyerClientIdHeader(headers: unknown): string | undefined {
  if (!headers || typeof headers !== 'object') {
    return undefined;
  }
  const h = headers as Record<string, unknown> & {
    get?: (name: string) => unknown;
    forEach?: (fn: (value: string, key: string) => void) => void;
  };

  if (typeof h.get === 'function') {
    const v =
      h.get('X-Mockifyer-Client-Id') ??
      h.get('x-mockifyer-client-Id') ??
      h.get('x-mockifyer-client-id');
    if (v == null) {
      return undefined;
    }
    const s = String(v).trim();
    return s.length > 0 ? s : undefined;
  }

  if (typeof h.forEach === 'function') {
    let found: string | undefined;
    h.forEach((value: string, key: string) => {
      if (key && key.toLowerCase() === MOCKIFYER_CLIENT_ID_HEADER && value != null) {
        const s = String(value).trim();
        if (s) {
          found = s;
        }
      }
    });
    return found;
  }

  for (const [k, v] of Object.entries(h)) {
    if (k && k.toLowerCase() === MOCKIFYER_CLIENT_ID_HEADER && v != null) {
      const s = String(v).trim();
      if (s) {
        return s;
      }
    }
  }
  return undefined;
}

export interface ShouldApplyMockifyerOptions {
  /**
   * When `activationMode` is `client_id_header`, requests routed through the dashboard proxy
   * with a resolved lane id still opt in: the client sends `X-Mockifyer-Client-Id` on the proxy
   * POST, not necessarily on per-URL headers inside the body.
   */
  useProxyLane?: {
    proxyBaseUrl?: string;
    resolvedClientId?: string;
  };
}

export function shouldApplyMockifyer(
  mode: MockifyerActivationMode,
  requestHeaders: unknown,
  options?: ShouldApplyMockifyerOptions
): boolean {
  if (mode === 'off') {
    return false;
  }
  if (mode === 'always') {
    return true;
  }
  if (getOutboundMockifyerClientIdHeader(requestHeaders) !== undefined) {
    return true;
  }
  const lane = options?.useProxyLane;
  if (
    lane?.proxyBaseUrl &&
    typeof lane.resolvedClientId === 'string' &&
    lane.resolvedClientId.trim().length > 0
  ) {
    return true;
  }
  return false;
}

/**
 * Resolves activation mode: env `MOCKIFYER_ACTIVATION_MODE` wins, then `config.activationMode`, then `always`.
 */
export function resolveActivationMode(config: Pick<MockifyerConfig, 'activationMode'>): MockifyerActivationMode {
  const raw =
    typeof process !== 'undefined' && process.env?.[ENV_VARS.MOCK_ACTIVATION_MODE]
      ? String(process.env[ENV_VARS.MOCK_ACTIVATION_MODE]).trim()
      : undefined;
  if (raw === 'always' || raw === 'client_id_header' || raw === 'off') {
    return raw;
  }
  const c = config.activationMode;
  if (c === 'always' || c === 'client_id_header' || c === 'off') {
    return c;
  }
  if (c !== undefined && c !== null && String(c).trim() !== '') {
    console.warn(
      `[Mockifyer] Unknown activationMode "${String(c)}", defaulting to "always". ` +
        `Valid: always | client_id_header | off`
    );
  }
  return 'always';
}
