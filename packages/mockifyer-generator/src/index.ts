/**
 * Browser-safe mock data generator engine (SGE-70 / SGE-71).
 *
 * Import from `@sgedda/mockifyer-generator` — no Node-only APIs
 * (fs, path, Node crypto, Node buffer) and no network.
 *
 * Values come from a seeded `@faker-js/faker` instance (selected locales only:
 * en, sv, de, fr, es). Structure (counts, picks, shuffles) uses Mulberry32.
 * Related-field consistency and free-text context parsing are offline (SGE-71).
 *
 * @packageDocumentation
 *
 * Extension points still reserved on {@link GenerateOptions}:
 * - SGE-72: `chaosLevel`, `variants`, `markGenerated`, `scrubSecrets`
 */

export { FieldKind } from './types';
export type {
  FieldDescriptor,
  FieldKindOverrides,
  GenerateOptions,
  InferResult,
  Prng,
} from './types';

export { createMulberry32, hashSeed } from './prng';
export { createSeededFaker } from './faker';
export { inferFieldKind, inferFields, normalizeOverridePath } from './infer';
export { generateValueForKind, weightedPick } from './values';
export type { ValueHints } from './values';
export { generate, infer, resolveGenerateSettings } from './generate';
export {
  parseContext,
  resolveLocaleCode,
  SUPPORTED_LOCALES,
} from './context';
export type { EnumMix, ParsedContext, SupportedLocale } from './context';
export { applyRelatedFieldConsistency } from './consistency';
