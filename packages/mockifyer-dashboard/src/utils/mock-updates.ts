export type MockUpdateError = { error: string; details?: string };

const MOCK_UPDATE_FIELDS = ['responseData', 'responseDateOverrides', 'alwaysUseRealApi'] as const;

function hasOwnField(body: unknown, field: string): boolean {
  return !!body && typeof body === 'object' && Object.prototype.hasOwnProperty.call(body, field);
}

export function hasAnyMockUpdateField(body: unknown): boolean {
  return MOCK_UPDATE_FIELDS.some((field) => hasOwnField(body, field));
}

function applyResponseDataUpdate(existingData: any, body: any): MockUpdateError | null {
  if (!hasOwnField(body, 'responseData')) return null;

  let parsedResponseData: any;
  try {
    parsedResponseData =
      typeof body.responseData === 'string'
        ? JSON.parse(body.responseData)
        : body.responseData;
  } catch (e: any) {
    return { error: 'Invalid JSON', details: e.message };
  }

  if (!existingData.response) existingData.response = { status: 200, data: {}, headers: {} };
  existingData.response.data = parsedResponseData;
  return null;
}

function applyResponseDateOverridesUpdate(existingData: any, body: any): MockUpdateError | null {
  if (!hasOwnField(body, 'responseDateOverrides')) return null;

  const raw = body.responseDateOverrides;
  if (raw === null) {
    delete existingData.responseDateOverrides;
    return null;
  }

  if (!Array.isArray(raw)) {
    return { error: 'responseDateOverrides must be an array or null' };
  }

  for (const item of raw) {
    if (!item || typeof item !== 'object' || typeof item.path !== 'string' || !item.path.trim()) {
      return { error: 'Each responseDateOverrides entry must be an object with a non-empty path string' };
    }
    if (item.base !== undefined && item.base !== 'now' && item.base !== 'response') {
      return { error: "responseDateOverrides.base must be 'now' or 'response' when provided" };
    }
  }

  if (raw.length === 0) {
    delete existingData.responseDateOverrides;
  } else {
    existingData.responseDateOverrides = raw;
  }
  return null;
}

function applyAlwaysUseRealApiUpdate(existingData: any, body: any): MockUpdateError | null {
  if (!hasOwnField(body, 'alwaysUseRealApi')) return null;

  const value = body.alwaysUseRealApi;
  if (value === true) {
    existingData.alwaysUseRealApi = true;
    return null;
  }
  if (value === false || value === null) {
    delete existingData.alwaysUseRealApi;
    return null;
  }
  return { error: 'alwaysUseRealApi must be true, false, or null' };
}

export function applyMockUpdates(existingData: any, body: any): MockUpdateError | null {
  return (
    applyResponseDataUpdate(existingData, body) ||
    applyResponseDateOverridesUpdate(existingData, body) ||
    applyAlwaysUseRealApiUpdate(existingData, body)
  );
}
