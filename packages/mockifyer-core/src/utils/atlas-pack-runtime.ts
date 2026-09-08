import { ENV_VARS } from '../types';
import type { AtlasPack } from '../types/atlas-pack';
import {
  applyAtlasPackToData,
  type ApplyAtlasPackResult,
  extractOperationNameFromRequestBody,
  normalizeAtlasPack,
  validateAtlasPack,
} from './atlas-pack-apply';
import { getAtlasUsageContext } from './atlas-usage';

export interface AtlasPackRuntimeState {
  activePackId: string | null;
  packs: Map<string, AtlasPack>;
}

const runtime: AtlasPackRuntimeState = {
  activePackId: null,
  packs: new Map(),
};

/** Reset in-process pack registry (tests). */
export function resetAtlasPackRuntime(): void {
  runtime.activePackId = null;
  runtime.packs.clear();
}

/** Resolve active pack id: explicit runtime → env `MOCKIFYER_ATLAS_PACK`. */
export function resolveActiveAtlasPackId(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = typeof process !== 'undefined'
    ? process.env
    : {}
): string | null {
  if (runtime.activePackId != null) {
    const trimmed = runtime.activePackId.trim();
    return trimmed || null;
  }
  const fromEnv = env[ENV_VARS.MOCK_ATLAS_PACK]?.trim();
  return fromEnv || null;
}

/** Register or replace packs in memory (bundled JSON / dashboard hydrate). */
export function registerAtlasPacks(packs: AtlasPack[]): void {
  for (const raw of packs) {
    const err = validateAtlasPack(raw);
    if (err) {
      throw new Error(`Invalid atlas pack: ${err}`);
    }
    const pack = normalizeAtlasPack(raw);
    runtime.packs.set(pack.id, pack);
  }
}

/** Upsert one pack in the in-memory registry. */
export function upsertAtlasPack(pack: AtlasPack): AtlasPack {
  const err = validateAtlasPack(pack);
  if (err) throw new Error(`Invalid atlas pack: ${err}`);
  const normalized = normalizeAtlasPack(pack);
  runtime.packs.set(normalized.id, normalized);
  return normalized;
}

/** Remove a pack from memory (does not clear active if different id). */
export function removeAtlasPack(packId: string): boolean {
  const id = packId.trim();
  const removed = runtime.packs.delete(id);
  if (runtime.activePackId === id) {
    runtime.activePackId = null;
  }
  return removed;
}

/** List registered packs (sorted by id). */
export function listAtlasPacks(): AtlasPack[] {
  return [...runtime.packs.values()].sort((a, b) => a.id.localeCompare(b.id));
}

/** Get one pack from memory. */
export function getAtlasPack(packId: string): AtlasPack | undefined {
  return runtime.packs.get(packId.trim());
}

/**
 * Set the active pack id in-process (`null` clears).
 * Does not persist to disk — dashboard / app storage owns persistence.
 */
export function setActiveAtlasPack(packId: string | null): void {
  if (packId == null || !String(packId).trim()) {
    runtime.activePackId = null;
    return;
  }
  runtime.activePackId = String(packId).trim();
}

/** Active pack document, or null when unset / missing. */
export function getActiveAtlasPack(
  env?: NodeJS.ProcessEnv | Record<string, string | undefined>
): AtlasPack | null {
  const id = resolveActiveAtlasPackId(env);
  if (!id) return null;
  return runtime.packs.get(id) ?? null;
}

export interface ApplyActiveAtlasPackOptions {
  datasourceId?: string | null;
  operation?: string | null;
  /** Request body — used to infer GraphQL operationName when operation omitted. */
  requestBody?: unknown;
  /** Prefer ambient Atlas usage context for datasourceId when omitted. */
  useAmbientUsage?: boolean;
  getNow?: () => Date;
  refreshPins?: boolean;
}

/**
 * Apply the active Atlas pack to response data when one is registered and active.
 * Updates in-memory pack pins when live items refresh them.
 */
export function applyActiveAtlasPackToData(
  data: unknown,
  options: ApplyActiveAtlasPackOptions = {}
): ApplyAtlasPackResult & { packId: string | null } {
  const pack = getActiveAtlasPack();
  if (!pack) {
    return { data, appliedOverlayCount: 0, usedPinCount: 0, packId: null };
  }

  let datasourceId = options.datasourceId;
  let operation = options.operation;

  if (options.useAmbientUsage !== false) {
    const usage = getAtlasUsageContext();
    if (!datasourceId?.trim() && usage.datasourceId) {
      datasourceId = usage.datasourceId;
    }
  }
  if (!operation?.trim() && options.requestBody !== undefined) {
    operation = extractOperationNameFromRequestBody(options.requestBody);
  }

  const result = applyAtlasPackToData(data, pack, {
    datasourceId,
    operation,
    getNow: options.getNow,
    refreshPins: options.refreshPins,
  });

  if (result.pack) {
    runtime.packs.set(result.pack.id, result.pack);
  }

  return { ...result, packId: pack.id };
}

/** True when an active pack is resolved and present in memory. */
export function isAtlasPackReplayActive(
  env?: NodeJS.ProcessEnv | Record<string, string | undefined>
): boolean {
  return getActiveAtlasPack(env) != null;
}
