/**
 * Chaos level → which edge-case variant kinds are enabled (SGE-72 / playground SGE-77).
 *
 * Accepts a named level or a numeric slider in `[0, 1]`. Same seed + level ⇒ same
 * variant set (selection is deterministic; content uses the seed in {@link variants}).
 */

/** Named chaos levels (playground slider labels). */
export type ChaosLevelName = 'realistic' | 'mild' | 'wild' | 'nightmare';

/** Named level or numeric intensity in `[0, 1]`. */
export type ChaosLevel = ChaosLevelName | number;

/**
 * Edge-case variant kinds produced by {@link variants}.
 */
export type VariantKind =
  | 'emptyLists'
  | 'missingOptional'
  | 'nulls'
  | 'longStrings'
  | 'unicode'
  | 'http400'
  | 'http401'
  | 'http404'
  | 'http500'
  | 'slow'
  | 'truncatedStream';

/** Stable display / scenario slug for each kind. */
export const VARIANT_KIND_SLUGS: Record<VariantKind, string> = {
  emptyLists: 'empty-lists',
  missingOptional: 'missing-optional',
  nulls: 'nulls',
  longStrings: 'long-strings',
  unicode: 'unicode',
  http400: 'http-400',
  http401: 'http-401',
  http404: 'http-404',
  http500: 'http-500',
  slow: 'slow',
  truncatedStream: 'truncated-stream',
};

/**
 * Minimum chaos intensity (0–1) required to include each kind.
 * Ordered roughly from common edge cases → catastrophic.
 */
export const VARIANT_KIND_THRESHOLDS: Record<VariantKind, number> = {
  emptyLists: 0.05,
  missingOptional: 0.15,
  nulls: 0.25,
  longStrings: 0.4,
  unicode: 0.45,
  http400: 0.55,
  http404: 0.6,
  slow: 0.65,
  http401: 0.8,
  http500: 0.9,
  truncatedStream: 0.95,
};

/** All kinds in threshold order (stable). */
export const ALL_VARIANT_KINDS: readonly VariantKind[] = (
  Object.keys(VARIANT_KIND_THRESHOLDS) as VariantKind[]
).sort((a, b) => VARIANT_KIND_THRESHOLDS[a] - VARIANT_KIND_THRESHOLDS[b]);

const NAMED_LEVEL_VALUES: Record<ChaosLevelName, number> = {
  realistic: 0.1,
  mild: 0.35,
  wild: 0.7,
  nightmare: 1,
};

/**
 * Resolve a chaos level to a numeric intensity in `[0, 1]`.
 */
export function resolveChaosLevel(level: ChaosLevel | undefined): number {
  if (level === undefined || level === null) {
    return NAMED_LEVEL_VALUES.mild;
  }
  if (typeof level === 'number') {
    if (!Number.isFinite(level)) {
      throw new Error(`chaosLevel must be finite, got ${level}`);
    }
    return Math.min(1, Math.max(0, level));
  }
  const named = NAMED_LEVEL_VALUES[level];
  if (named === undefined) {
    throw new Error(
      `Unknown chaosLevel "${level}". Use realistic|mild|wild|nightmare or a number in [0, 1].`
    );
  }
  return named;
}

/**
 * Kinds enabled at the given chaos intensity, optionally intersected with `allowlist`.
 */
export function selectVariantKinds(
  chaosLevel: ChaosLevel | undefined,
  allowlist?: readonly VariantKind[]
): VariantKind[] {
  const intensity = resolveChaosLevel(chaosLevel);
  const pool = allowlist && allowlist.length > 0 ? allowlist : ALL_VARIANT_KINDS;
  return pool.filter((kind) => VARIANT_KIND_THRESHOLDS[kind] <= intensity);
}
