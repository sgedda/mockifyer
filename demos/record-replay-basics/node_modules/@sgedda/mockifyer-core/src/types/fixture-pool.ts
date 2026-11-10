import type { MockData, MockResponseDateOverride, MockResponseFieldOverride, StoredResponse } from '../types';

/** Stable slug for pool entities and response fixtures. */
export const POOL_ID_PATTERN = /^[a-zA-Z0-9_-]+$/;

export type PoolEntitySourceKind = 'extracted' | 'manual' | 'forked' | 'fetched';

export interface PoolEntitySource {
  kind: PoolEntitySourceKind;
  scenario?: string;
  filename?: string;
  jsonPath?: string;
  /** When forked from another entity. */
  fromEntityId?: string;
}

/**
 * Reusable domain object in the global fixture pool (catalog / extract).
 * Serve-time activation for v1 is `$pool` on **response fixtures**, not entity slots.
 */
export interface PoolEntity {
  id: string;
  entityType: string;
  label: string;
  tags?: string[];
  data: unknown;
  source?: PoolEntitySource;
  createdAt?: string;
  updatedAt?: string;
}

export interface PoolEntityIndexEntry {
  id: string;
  label: string;
  entityType: string;
  tags?: string[];
  storageRef: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface PoolResponseIndexEntry {
  id: string;
  label: string;
  tags?: string[];
  storageRef: string;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Full HTTP response fixture (escape hatch when compose/wrap is insufficient).
 */
export interface PoolResponseItem {
  responseItemId: string;
  label?: string;
  tags?: string[];
  request?: MockData['request'];
  response: StoredResponse;
  timestamp?: string;
  responseFieldOverrides?: MockResponseFieldOverride[];
  responseDateOverrides?: MockResponseDateOverride[];
  sourceRecording?: {
    scenario?: string;
    filename?: string;
  };
  createdAt?: string;
  updatedAt?: string;
}

/** How a `$pool` ref materializes into scenario mock response data. */
export type PoolRefMode = 'document' | 'value';

/**
 * Select array elements by field equality. Output order follows {@link values}.
 */
export interface PoolRefSelect {
  field: string;
  values: Array<string | number | boolean>;
}

/**
 * Serve-time reference to a promoted pool response fixture.
 * Stored in scenario mock `response.data` as `{ "$pool": PoolRef }`.
 */
export interface PoolRef {
  /** {@link PoolResponseItem.responseItemId} in the global fixture pool. */
  id: string;
  /**
   * `document` (default): clone full pool body; filter only at {@link path}.
   * `value`: replace the `$pool` node with the selected subtree only.
   */
  mode?: PoolRefMode;
  /** Dot/JSONPath-lite into pool `response.data` (same family as extract `jsonPath`). */
  path?: string;
  /** Subset when the target at {@link path} (or root) is an array. Mutually exclusive with {@link indices}. */
  select?: PoolRefSelect;
  /** Positional pick when the target is an array. Mutually exclusive with {@link select}. */
  indices?: number[];
}

/** Wrapper node embedded in mock response JSON. */
export interface PoolRefNode {
  $pool: PoolRef;
}

export interface PoolIndex {
  formatVersion: number;
  updatedAt: string;
  entities: PoolEntityIndexEntry[];
  responses: PoolResponseIndexEntry[];
}

/** v1 wrap modes: bare + object. GraphQL wrap deferred. */
export type SlotWrapMode = 'bare' | 'object';

export interface SlotWrap {
  mode: SlotWrapMode;
  /**
   * For compose + object: path under the response root for the entity array (e.g. `trips`).
   * For entity + object: optional single field to nest entity data under.
   */
  arrayPath?: string;
  field?: string;
  /** Merged into the root object when mode is `object`. */
  template?: Record<string, unknown>;
}

export interface SlotItemOverrides {
  responseFieldOverrides?: MockResponseFieldOverride[];
  responseDateOverrides?: MockResponseDateOverride[];
}

export interface ComposeItemRef {
  entityId: string;
  itemOverrides?: SlotItemOverrides;
}

export type SlotAssignment =
  | { kind: 'none' }
  | {
      kind: 'entity';
      entityId: string;
      wrap?: SlotWrap;
      status?: number;
      headers?: Record<string, string>;
    }
  | {
      kind: 'compose';
      items: ComposeItemRef[];
      wrap: SlotWrap;
      status?: number;
      headers?: Record<string, string>;
    }
  | {
      kind: 'response';
      responseItemId: string;
    }
  | {
      kind: 'inline';
      response: StoredResponse;
      request?: MockData['request'];
    };

export type SlotMatchQuery = 'exact' | 'ignore' | { requiredParams: string[] };

export type SlotMatch =
  | {
      kind: 'rest';
      method: string;
      pathPattern: string;
      host?: string;
      matchQuery?: SlotMatchQuery;
    }
  | {
      kind: 'graphql';
      operationName?: string;
      /**
       * Stricter query identity. Prefer values from recording keys:
       * - normalized query string
       * - `gql:{normalizedQuery}:vars:{sortedVariablesJson}` (`buildGraphQLBodyKey`)
       * - `|body:gql:…:vars:…` (suffix of `generateRequestKey`)
       */
      queryHash?: string;
      variablesTemplate?: Record<string, unknown>;
    };

export interface EndpointSlot {
  id: string;
  label?: string;
  match: SlotMatch;
  /** Soft type check for entity / compose assignments. */
  expectsEntityType?: string;
  assignment: SlotAssignment;
  slotOverrides?: SlotItemOverrides;
  enabled?: boolean;
}

export interface ScenarioManifest {
  formatVersion: number;
  scenario: string;
  updatedAt: string;
  slots: EndpointSlot[];
}

export interface ResolvedSlotSource {
  slotId: string;
  assignmentKind: SlotAssignment['kind'];
  entityIds?: string[];
  responseItemId?: string;
}

export const POOL_FORMAT_VERSION = 2;
export const MANIFEST_FORMAT_VERSION = 2;

export const POOL_DIR_NAME = 'pool';
export const POOL_INDEX_FILENAME = 'pool-index.json';
/** Exclusive lock file for read-modify-write updates to {@link POOL_INDEX_FILENAME}. */
export const POOL_INDEX_LOCK_FILENAME = 'pool-index.json.lock';
export const POOL_ENTITIES_DIR = 'entities';
export const POOL_RESPONSES_DIR = 'responses';
export const SCENARIO_MANIFEST_FILENAME = 'scenario-manifest.json';
