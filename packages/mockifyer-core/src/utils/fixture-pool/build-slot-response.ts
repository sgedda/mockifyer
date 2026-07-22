import type { MockData, MockResponseDateOverride, MockResponseFieldOverride } from '../../types';
import type {
  ComposeItemRef,
  PoolEntity,
  PoolResponseItem,
  SlotAssignment,
  SlotItemOverrides,
  SlotWrap,
} from '../../types/fixture-pool';
import { applyResponseDateOverridesToData } from '../mock-response-date-overrides';
import { applyResponseFieldOverridesToData } from '../mock-response-field-overrides';
import { cloneJsonValue } from './extract';

export interface BuildSlotResponseContext {
  getEntity: (id: string) => PoolEntity | undefined;
  getResponseItem: (id: string) => PoolResponseItem | undefined;
  getNow?: () => Date;
  slotOverrides?: SlotItemOverrides;
  /** Synthetic request echoed on the built MockData for editors/traces. */
  request: MockData['request'];
}

export interface BuiltSlotMock {
  mockData: MockData;
  filename: string;
  filePath: string;
  entityIds: string[];
  responseItemId?: string;
}

/**
 * Apply field then date overrides to a cloned data value.
 */
export function applyOverlaysToData(
  data: unknown,
  overlays: SlotItemOverrides | undefined,
  getNow?: () => Date
): unknown {
  if (!overlays) return data;
  let next = data;
  if (overlays.responseFieldOverrides?.length) {
    next = applyResponseFieldOverridesToData(next, overlays.responseFieldOverrides);
  }
  if (overlays.responseDateOverrides?.length) {
    next = applyResponseDateOverridesToData(
      next,
      overlays.responseDateOverrides,
      getNow ?? (() => new Date())
    );
  }
  return next;
}

function wrapEntityData(data: unknown, wrap: SlotWrap | undefined): unknown {
  const mode = wrap?.mode ?? 'bare';
  if (mode === 'bare') return data;
  const template = wrap?.template ? cloneJsonValue(wrap.template) : {};
  const field = wrap?.field?.trim();
  if (field) {
    return { ...template, [field]: data };
  }
  return { ...template, ...(typeof data === 'object' && data !== null && !Array.isArray(data)
    ? (data as Record<string, unknown>)
    : { value: data }) };
}

function wrapComposeItems(items: unknown[], wrap: SlotWrap): unknown {
  if (wrap.mode === 'bare') return items;
  const template = wrap.template ? cloneJsonValue(wrap.template) : {};
  const arrayPath = wrap.arrayPath!.trim();
  // Support single-segment arrayPath in v1 (e.g. "trips"). Nested paths can be added later.
  if (arrayPath.includes('.')) {
    const root: Record<string, unknown> = { ...template };
    setNestedArray(root, arrayPath.split('.'), items);
    return root;
  }
  return { ...template, [arrayPath]: items };
}

function setNestedArray(root: Record<string, unknown>, segments: string[], items: unknown[]): void {
  let cur: Record<string, unknown> = root;
  for (let i = 0; i < segments.length - 1; i++) {
    const key = segments[i]!;
    if (!cur[key] || typeof cur[key] !== 'object') cur[key] = {};
    cur = cur[key] as Record<string, unknown>;
  }
  cur[segments[segments.length - 1]!] = items;
}

function buildComposeBody(
  items: ComposeItemRef[],
  wrap: SlotWrap,
  getEntity: (id: string) => PoolEntity | undefined,
  getNow?: () => Date
): { body: unknown; entityIds: string[] } | { error: string } {
  const entityIds: string[] = [];
  const builtItems: unknown[] = [];

  for (const item of items) {
    const entity = getEntity(item.entityId);
    if (!entity) return { error: `Unknown entityId: ${item.entityId}` };
    entityIds.push(entity.id);
    let data = cloneJsonValue(entity.data);
    data = applyOverlaysToData(data, item.itemOverrides, getNow);
    builtItems.push(data);
  }

  return { body: wrapComposeItems(builtItems, wrap), entityIds };
}

/**
 * Build a synthetic MockData from a slot assignment.
 */
export function buildMockFromSlotAssignment(
  slotId: string,
  assignment: SlotAssignment,
  context: BuildSlotResponseContext
): BuiltSlotMock | { error: string } {
  const now = new Date().toISOString();
  const getNow = context.getNow;

  if (assignment.kind === 'none') {
    return { error: 'Cannot build mock from assignment.kind none' };
  }

  if (assignment.kind === 'inline') {
    let data = cloneJsonValue(assignment.response.data);
    data = applyOverlaysToData(data, context.slotOverrides, getNow);
    return {
      mockData: {
        request: assignment.request ?? context.request,
        response: {
          status: assignment.response.status,
          data,
          headers: { ...(assignment.response.headers ?? {}) },
        },
        timestamp: now,
      },
      filename: `inline:${slotId}`,
      filePath: `slot:${slotId}`,
      entityIds: [],
    };
  }

  if (assignment.kind === 'response') {
    const fixture = context.getResponseItem(assignment.responseItemId);
    if (!fixture) return { error: `Unknown responseItemId: ${assignment.responseItemId}` };
    const fieldOverrides: MockResponseFieldOverride[] = [
      ...(fixture.responseFieldOverrides ?? []),
      ...(context.slotOverrides?.responseFieldOverrides ?? []),
    ];
    const dateOverrides: MockResponseDateOverride[] = [
      ...(fixture.responseDateOverrides ?? []),
      ...(context.slotOverrides?.responseDateOverrides ?? []),
    ];
    let data = cloneJsonValue(fixture.response.data);
    data = applyOverlaysToData(
      data,
      { responseFieldOverrides: fieldOverrides, responseDateOverrides: dateOverrides },
      getNow
    );
    return {
      mockData: {
        request: fixture.request ?? context.request,
        response: {
          status: fixture.response.status,
          data,
          headers: { ...(fixture.response.headers ?? {}) },
        },
        timestamp: fixture.timestamp ?? now,
        // Overlays already applied to `data` — do not re-attach for prepareMockResponseBody.
      },
      filename: `response:${fixture.responseItemId}`,
      filePath: `slot:${slotId}`,
      entityIds: [],
      responseItemId: fixture.responseItemId,
    };
  }

  if (assignment.kind === 'entity') {
    const entity = context.getEntity(assignment.entityId);
    if (!entity) return { error: `Unknown entityId: ${assignment.entityId}` };
    let data = cloneJsonValue(entity.data);
    data = applyOverlaysToData(data, context.slotOverrides, getNow);
    data = wrapEntityData(data, assignment.wrap);
    return {
      mockData: {
        request: context.request,
        response: {
          status: assignment.status ?? 200,
          data,
          headers: { ...(assignment.headers ?? {}) },
        },
        timestamp: now,
      },
      filename: `entity:${entity.id}`,
      filePath: `slot:${slotId}`,
      entityIds: [entity.id],
    };
  }

  // compose
  const composed = buildComposeBody(assignment.items, assignment.wrap, context.getEntity, getNow);
  if ('error' in composed) return composed;
  let data = composed.body;
  data = applyOverlaysToData(data, context.slotOverrides, getNow);
  return {
    mockData: {
      request: context.request,
      response: {
        status: assignment.status ?? 200,
        data,
        headers: { ...(assignment.headers ?? {}) },
      },
      timestamp: now,
    },
    filename: `compose:${slotId}`,
    filePath: `slot:${slotId}`,
    entityIds: composed.entityIds,
  };
}
