import {
  validateResponseFieldOverrides,
  type MockData,
  type MockResponseFieldOverride,
} from '@sgedda/mockifyer-core';

/** True when a PUT/PATCH body includes `responseFieldOverrides`. */
export function bodyHasFieldOverrides(body: Record<string, unknown> | null | undefined): boolean {
  return Boolean(body) && Object.prototype.hasOwnProperty.call(body, 'responseFieldOverrides');
}

/**
 * Applies `responseFieldOverrides` from a dashboard PUT body onto mock data.
 * Empty array or `null` clears the stored overlays.
 *
 * @returns Validation error message, or null when applied / skipped.
 */
export function applyFieldOverridesFromBody(
  mockData: MockData,
  body: Record<string, unknown>
): string | null {
  if (!bodyHasFieldOverrides(body)) return null;

  const raw = body.responseFieldOverrides;
  if (raw === null) {
    delete mockData.responseFieldOverrides;
    return null;
  }
  if (!Array.isArray(raw)) {
    return 'responseFieldOverrides must be an array or null';
  }

  const validationError = validateResponseFieldOverrides(raw);
  if (validationError) return validationError;

  if (raw.length === 0) {
    delete mockData.responseFieldOverrides;
    return null;
  }

  mockData.responseFieldOverrides = raw as MockResponseFieldOverride[];
  return null;
}
