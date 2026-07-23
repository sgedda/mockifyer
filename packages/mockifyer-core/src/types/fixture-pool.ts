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
 * Reusable domain object in the global fixture pool (inert until a slot references it).
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
export const POOL_ENTITIES_DIR = 'entities';
export const POOL_RESPONSES_DIR = 'responses';
export const SCENARIO_MANIFEST_FILENAME = 'scenario-manifest.json';
