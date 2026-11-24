/**
 * Browser-safe mock data generator engine (SGE-70 / SGE-71 / SGE-72).
 *
 * Import from `@sgedda/mockifyer-generator` — no Node-only APIs
 * (fs, path, Node crypto, Node buffer) and no network.
 *
 * Values come from seeded `@faker-js/faker` locale entry points: `en` is
 * statically bundled; `sv` / `de` / `fr` / `es` load on demand via
 * {@link loadLocale} / {@link generateAsync}. Structure uses Mulberry32.
 * Related-field consistency and free-text context parsing are offline (SGE-71).
 * Edge-case variants, chaos level, `generated: true`, and secret scrub: SGE-72.
 *
 * Node-only scenario writing: `@sgedda/mockifyer-generator/node`.
 *
 * @packageDocumentation
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
export {
  createSeededFaker,
  loadLocale,
  isLocaleLoaded,
  __resetLoadedLocalesForTests,
} from './faker';
export {
  inferFieldKind,
  inferFields,
  normalizeOverridePath,
  isLineItemProductNamePath,
} from './infer';
export { generateValueForKind, weightedPick } from './values';
export type { ValueHints } from './values';
export { generate, generateAsync, infer, resolveGenerateSettings } from './generate';
export {
  parseContext,
  resolveLocaleCode,
  tryResolveLocale,
  defaultSampleForEntity,
  DEFAULT_ENTITY_SAMPLES,
  SUPPORTED_LOCALES,
  LOCALE_DEFAULT_CURRENCY,
  LOCALE_DEFAULT_COUNTRY,
} from './context';
export type {
  EnumMix,
  ParsedContext,
  SupportedLocale,
  ContextEntity,
  PhoneFormat,
} from './context';
export {
  applyRelatedFieldConsistency,
  emailLocalPartFromName,
} from './consistency';

// --- SGE-72: edge-case variants, chaos, mock format, secret scrub ---
export {
  resolveChaosLevel,
  selectVariantKinds,
  ALL_VARIANT_KINDS,
  VARIANT_KIND_SLUGS,
  VARIANT_KIND_THRESHOLDS,
} from './chaos';
export type { ChaosLevel, ChaosLevelName, VariantKind } from './chaos';

export { variants, resolveScrambleIds } from './variants';
export type { NamedVariant, VariantsOptions } from './variants';
export { isIdentifierField, isIdentifierKeyName } from './identifiers';

export {
  isMockDataLike,
  normalizeToMockData,
  serializeMock,
  toScenarioMap,
  deepClone,
} from './mock-format';
export type {
  GeneratedMockData,
  StoredRequest,
  StoredResponse,
  StoredResponseStream,
  StoredStreamChunk,
  StreamKind,
} from './mock-format';

export {
  scrubObjectSecrets,
  scrubUrlSecrets,
  scrubHeaders,
  scrubValue,
  collectSensitiveLiterals,
  findSecretLeaks,
  isSecretParamName,
} from './scrub';
