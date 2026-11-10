import {
  MANIFEST_FORMAT_VERSION,
  POOL_FORMAT_VERSION,
  POOL_ID_PATTERN,
  type ComposeItemRef,
  type EndpointSlot,
  type PoolEntity,
  type PoolIndex,
  type PoolResponseItem,
  type ScenarioManifest,
  type SlotAssignment,
  type SlotMatch,
  type SlotWrap,
} from '../../types/fixture-pool';

export function isValidPoolId(id: string): boolean {
  return typeof id === 'string' && POOL_ID_PATTERN.test(id);
}

export function validatePoolEntity(raw: unknown): string | null {
  if (!raw || typeof raw !== 'object') return 'Entity must be an object';
  const e = raw as Partial<PoolEntity>;
  if (!isValidPoolId(e.id ?? '')) return 'Entity id must match [a-zA-Z0-9_-]+';
  if (typeof e.entityType !== 'string' || !e.entityType.trim()) return 'entityType is required';
  if (typeof e.label !== 'string' || !e.label.trim()) return 'label is required';
  if (!('data' in e)) return 'data is required';
  return null;
}

export function validatePoolResponseItem(raw: unknown): string | null {
  if (!raw || typeof raw !== 'object') return 'Response fixture must be an object';
  const r = raw as Partial<PoolResponseItem>;
  if (!isValidPoolId(r.responseItemId ?? '')) return 'responseItemId must match [a-zA-Z0-9_-]+';
  if (!r.response || typeof r.response !== 'object') return 'response is required';
  if (typeof (r.response as { status?: unknown }).status !== 'number') {
    return 'response.status must be a number';
  }
  return null;
}

export function validatePoolIndex(raw: unknown): string | null {
  if (!raw || typeof raw !== 'object') return 'Pool index must be an object';
  const index = raw as Partial<PoolIndex>;
  if (typeof index.formatVersion !== 'number') return 'formatVersion is required';
  if (!Array.isArray(index.entities)) return 'entities must be an array';
  if (!Array.isArray(index.responses)) return 'responses must be an array';
  const entityIds = new Set<string>();
  for (const entry of index.entities) {
    if (!isValidPoolId(entry?.id ?? '')) return 'Invalid entity id in pool index';
    if (entityIds.has(entry.id)) return `Duplicate entity id in pool index: ${entry.id}`;
    entityIds.add(entry.id);
  }
  const responseIds = new Set<string>();
  for (const entry of index.responses) {
    if (!isValidPoolId(entry?.id ?? '')) return 'Invalid response id in pool index';
    if (responseIds.has(entry.id)) return `Duplicate response id in pool index: ${entry.id}`;
    responseIds.add(entry.id);
  }
  return null;
}

function validateWrap(wrap: SlotWrap | undefined, assignmentKind: 'entity' | 'compose'): string | null {
  if (assignmentKind === 'compose') {
    if (!wrap) return 'compose assignment requires wrap';
    if (wrap.mode !== 'bare' && wrap.mode !== 'object') {
      return 'wrap.mode must be bare or object (graphql wrap is not in v1)';
    }
    if (wrap.mode === 'object' && (!wrap.arrayPath || !wrap.arrayPath.trim())) {
      return 'compose with wrap.mode object requires arrayPath';
    }
    return null;
  }
  if (!wrap) return null;
  if (wrap.mode !== 'bare' && wrap.mode !== 'object') {
    return 'wrap.mode must be bare or object (graphql wrap is not in v1)';
  }
  return null;
}

function validateAssignment(
  assignment: SlotAssignment,
  expectsEntityType: string | undefined,
  entityTypesById: Map<string, string> | undefined
): string | null {
  if (!assignment || typeof assignment !== 'object' || !('kind' in assignment)) {
    return 'assignment.kind is required';
  }

  switch (assignment.kind) {
    case 'none':
      return null;
    case 'inline':
      if (!assignment.response || typeof assignment.response.status !== 'number') {
        return 'inline assignment requires response.status';
      }
      return null;
    case 'response':
      if (!isValidPoolId(assignment.responseItemId ?? '')) {
        return 'response assignment requires a valid responseItemId';
      }
      return null;
    case 'entity': {
      if (!isValidPoolId(assignment.entityId ?? '')) {
        return 'entity assignment requires a valid entityId';
      }
      const wrapError = validateWrap(assignment.wrap, 'entity');
      if (wrapError) return wrapError;
      if (expectsEntityType && entityTypesById) {
        const actual = entityTypesById.get(assignment.entityId);
        if (actual === undefined) return `Unknown entityId: ${assignment.entityId}`;
        if (actual !== expectsEntityType) {
          return `Entity ${assignment.entityId} has type "${actual}" but slot expects "${expectsEntityType}"`;
        }
      }
      return null;
    }
    case 'compose': {
      if (!Array.isArray(assignment.items)) return 'compose.items must be an array';
      const wrapError = validateWrap(assignment.wrap, 'compose');
      if (wrapError) return wrapError;
      for (const item of assignment.items as ComposeItemRef[]) {
        if (!isValidPoolId(item?.entityId ?? '')) {
          return 'Each compose item requires a valid entityId';
        }
        if (expectsEntityType && entityTypesById) {
          const actual = entityTypesById.get(item.entityId);
          if (actual === undefined) return `Unknown entityId: ${item.entityId}`;
          if (actual !== expectsEntityType) {
            return `Entity ${item.entityId} has type "${actual}" but slot expects "${expectsEntityType}"`;
          }
        }
      }
      return null;
    }
    default:
      return `Unknown assignment.kind: ${(assignment as { kind: string }).kind}`;
  }
}

function validateMatch(match: SlotMatch): string | null {
  if (!match || typeof match !== 'object') return 'slot.match is required';
  if (match.kind === 'rest') {
    if (!match.method || typeof match.method !== 'string') return 'REST match requires method';
    if (!match.pathPattern || typeof match.pathPattern !== 'string') {
      return 'REST match requires pathPattern';
    }
    if (!match.pathPattern.startsWith('/')) return 'pathPattern must start with /';
    if (match.pathPattern.includes('**')) return 'pathPattern must not include ** in v1';
    return null;
  }
  if (match.kind === 'graphql') {
    if (!match.operationName && !match.queryHash) {
      return 'GraphQL match requires operationName or queryHash';
    }
    return null;
  }
  return `Unknown match.kind: ${(match as { kind: string }).kind}`;
}

export function validateEndpointSlot(
  raw: unknown,
  entityTypesById?: Map<string, string>
): string | null {
  if (!raw || typeof raw !== 'object') return 'Slot must be an object';
  const slot = raw as EndpointSlot;
  if (!isValidPoolId(slot.id ?? '')) return 'slot.id must match [a-zA-Z0-9_-]+';
  const matchError = validateMatch(slot.match);
  if (matchError) return matchError;
  return validateAssignment(slot.assignment, slot.expectsEntityType, entityTypesById);
}

export function validateScenarioManifest(
  raw: unknown,
  entityTypesById?: Map<string, string>
): string | null {
  if (!raw || typeof raw !== 'object') return 'Manifest must be an object';
  const m = raw as Partial<ScenarioManifest>;
  if (typeof m.formatVersion !== 'number') return 'formatVersion is required';
  if (typeof m.scenario !== 'string' || !m.scenario.trim()) return 'scenario is required';
  if (!Array.isArray(m.slots)) return 'slots must be an array';
  const ids = new Set<string>();
  for (const slot of m.slots) {
    const err = validateEndpointSlot(slot, entityTypesById);
    if (err) return err;
    if (ids.has(slot.id)) return `Duplicate slot id: ${slot.id}`;
    ids.add(slot.id);
  }
  return null;
}

export function emptyPoolIndex(now = new Date().toISOString()): PoolIndex {
  return {
    formatVersion: POOL_FORMAT_VERSION,
    updatedAt: now,
    entities: [],
    responses: [],
  };
}

export function emptyScenarioManifest(scenario: string, now = new Date().toISOString()): ScenarioManifest {
  return {
    formatVersion: MANIFEST_FORMAT_VERSION,
    scenario,
    updatedAt: now,
    slots: [],
  };
}

/**
 * Collect entity ids referenced by a manifest (for delete guards / bundle export).
 */
export function collectReferencedEntityIds(manifest: ScenarioManifest): string[] {
  const ids = new Set<string>();
  for (const slot of manifest.slots) {
    const a = slot.assignment;
    if (a.kind === 'entity') ids.add(a.entityId);
    if (a.kind === 'compose') {
      for (const item of a.items) ids.add(item.entityId);
    }
  }
  return [...ids];
}

export function collectReferencedResponseIds(manifest: ScenarioManifest): string[] {
  const ids = new Set<string>();
  for (const slot of manifest.slots) {
    if (slot.assignment.kind === 'response') ids.add(slot.assignment.responseItemId);
  }
  return [...ids];
}

export function buildEntityTypeMap(entities: Array<{ id: string; entityType: string }>): Map<string, string> {
  return new Map(entities.map((e) => [e.id, e.entityType]));
}
