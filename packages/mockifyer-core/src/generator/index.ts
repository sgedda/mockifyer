/**
 * Browser-safe mock data generator engine (SGE-70).
 *
 * Import from `@sgedda/mockifyer-core/generator` — no Node-only APIs
 * (fs, path, Node crypto, Node buffer) and no network.
 *
 * @packageDocumentation
 *
 * Extension points (typed on {@link GenerateOptions}, not yet implemented):
 * - SGE-71: `context`, `locale`, `currency` + related-field consistency
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
export { inferFieldKind, inferFields, normalizeOverridePath } from './infer';
export { generateValueForKind, generateUuid } from './values';
export { generate, infer } from './generate';
