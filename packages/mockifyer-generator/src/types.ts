/**
 * Field kinds inferred from JSON keys/values for offline mock data generation.
 *
 * Extension: SGE-71 may add locale-sensitive kinds; keep this enum additive only.
 */
export enum FieldKind {
  Email = 'email',
  FirstName = 'firstName',
  LastName = 'lastName',
  FullName = 'fullName',
  Uuid = 'uuid',
  IntegerId = 'integerId',
  Money = 'money',
  Currency = 'currency',
  Date = 'date',
  IsoTimestamp = 'isoTimestamp',
  Enum = 'enum',
  Url = 'url',
  Phone = 'phone',
  Street = 'street',
  City = 'city',
  Zip = 'zip',
  Country = 'country',
  Boolean = 'boolean',
  FreeText = 'freeText',
  Number = 'number',
  Integer = 'integer',
  Null = 'null',
  /** Fallback when no more specific kind matches. */
  Unknown = 'unknown',
}

/**
 * Typed descriptor for one JSON path (e.g. `$.orders[*].status`).
 */
export interface FieldDescriptor {
  /** JSONPath-style path rooted at `$`. Array wildcards use `[*]`. */
  path: string;
  kind: FieldKind;
  /** 0–1 confidence from inference (overrides are always 1). */
  confidence: number;
  /** Observed sample values used for enum / length heuristics. */
  samples: unknown[];
  /** Distinct string values when kind is Enum (or candidate). */
  enumValues?: string[];
  /** Sample array length when this path points at an array container. */
  arrayLength?: number;
}

/**
 * User overrides: JSONPath → kind. Takes precedence over inference.
 * Paths may use either `$.foo.bar` or `foo.bar` form.
 */
export type FieldKindOverrides = Record<string, FieldKind | string>;

/**
 * Options for {@link generate}.
 *
 * SGE-71: `context`, `locale`, `currency` steer offline generation and
 * related-field consistency. Explicit `locale` / `currency` / `count` override
 * values parsed from `context`.
 *
 * Reserved for SGE-72 (accepted, not yet applied):
 * `chaosLevel`, `variants`, `markGenerated`, `scrubSecrets`.
 */
export interface GenerateOptions {
  /** Number of root records to produce (default 1; may also come from context). */
  count?: number;
  /** Seed for the PRNG; same seed + sample + options ⇒ identical output. */
  seed?: number | string;
  /** Path → kind overrides (highest precedence). */
  overrides?: FieldKindOverrides;

  // --- context-guided datasets (SGE-71) ---
  /**
   * Free-text context, e.g.
   * `"Swedish users, prices in SEK, 20 orders, mix of paid/refunded/failed"`.
   * Parsed offline via {@link parseContext}; no network/AI.
   */
  context?: string;
  /** Faker locale — name or code, e.g. `"Swedish"` / `"sv"` / `"sv-SE"`. */
  locale?: string;
  /** ISO currency code forced on currency fields, e.g. `"SEK"`. */
  currency?: string;

  // --- reserved extension points (SGE-72) ---
  /** @remarks Reserved for SGE-72 — chaos / nightmare intensity (0–1). */
  chaosLevel?: number;
  /** @remarks Reserved for SGE-72 — named edge-case variant ids. */
  variants?: string[];
  /** @remarks Reserved for SGE-72 — mark metadata as generated. */
  markGenerated?: boolean;
  /** @remarks Reserved for SGE-72 — scrub secrets/PII from output. */
  scrubSecrets?: boolean;
}

/**
 * Result of field-kind inference over a sample value.
 */
export interface InferResult {
  fields: FieldDescriptor[];
  /** True when the sample root is an array of records. */
  rootIsArray: boolean;
}

/**
 * Seeded pseudo-random number generator (browser-safe).
 */
export interface Prng {
  /** Next float in [0, 1). */
  next(): number;
  /** Next integer in [min, max] inclusive. */
  int(min: number, max: number): number;
  /** Pick one element from a non-empty array. */
  pick<T>(items: readonly T[]): T;
  /** Shuffle a copy of `items` (Fisher–Yates). */
  shuffle<T>(items: readonly T[]): T[];
}
