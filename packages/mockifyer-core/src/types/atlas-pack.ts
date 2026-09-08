import type { MockResponseDateOverride, MockResponseFieldOverride } from '../types';

/** Select array elements by field equality (order follows {@link values}). */
export interface AtlasPackSelect {
  field: string;
  values: Array<string | number | boolean>;
}

/**
 * Last-good copy of one selected array item (fallback when live response no longer has this id).
 */
export interface AtlasPackItemPin {
  /** Value of {@link AtlasPackSelect.field} for this item. */
  id: string | number | boolean;
  /** Full item object snapshot. */
  data: unknown;
  /** When this pin was last refreshed from a live match. */
  updatedAt?: string;
}

/**
 * One overlay targeting a datasource (or GraphQL operation) on live/stored responses.
 *
 * Prefer {@link datasourceId} (Atlas usage / cache). {@link operation} is a fallback match
 * (GraphQL `operationName` or a path/operation hint).
 */
export interface AtlasPackOverlay {
  /** Ambient Atlas usage / cache datasource id (preferred match). */
  datasourceId?: string;
  /** GraphQL operationName or REST hint when datasourceId is unknown. */
  operation?: string;
  /**
   * Dot path to the array (or object) under response data, e.g. `trips` or `data.bookings`.
   * Empty / omitted = apply root-level field/date overrides only.
   */
  path?: string;
  /**
   * Keep / order items by id. Missing live items are filled from {@link pins}.
   * Without select, only field/date overrides at `path` or root are applied.
   */
  select?: AtlasPackSelect;
  /**
   * Field overrides. Paths are relative to each selected item when `select` is set;
   * otherwise relative to {@link path} (or response root when path is empty).
   */
  fieldOverrides?: MockResponseFieldOverride[];
  /**
   * Date overrides with the same path relativity as {@link fieldOverrides}.
   */
  dateOverrides?: MockResponseDateOverride[];
  /** Pinned items for select fallback (id → last-good object). */
  pins?: AtlasPackItemPin[];
}

/**
 * Named Atlas pack — scenario-like switch for overlays + pins only (not a full mock corpus).
 */
export interface AtlasPack {
  id: string;
  label: string;
  updatedAt: string;
  overlays: AtlasPackOverlay[];
}

/** Active pack pointer (filesystem / dashboard config). */
export interface AtlasPackConfig {
  currentPack: string | null;
  updatedAt?: string;
}

/** Stable slug for pack ids. */
export const ATLAS_PACK_ID_PATTERN = /^[a-zA-Z0-9_-]+$/;

/** Directory under mockDataPath for pack JSON files. */
export const ATLAS_PACKS_DIR_NAME = '_atlas';
export const ATLAS_PACKS_SUBDIR = 'packs';
export const ATLAS_PACK_CONFIG_FILENAME = 'pack-config.json';
