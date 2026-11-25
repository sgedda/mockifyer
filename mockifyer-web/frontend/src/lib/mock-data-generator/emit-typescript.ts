/**
 * Back-compat re-exports — prefer emit-types.ts for multi-language emit.
 */

export {
  emitTypeScript,
  emitTypes,
  singularizeKey,
  TYPE_LANGUAGES,
  DEFAULT_TYPES_LANGUAGE,
  isTypesLanguage,
  parseTypesLanguage,
  typesLanguageLabel,
  type EmitTypesOptions,
  type TypesLanguage,
} from './emit-types'
