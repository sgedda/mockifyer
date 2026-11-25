/**
 * Multi-language type emit from nested JSON (arrays + optional fields).
 */
import {
  TYPE_LANGUAGES,
  emitTypes,
  emitTypeScript,
  parseTypesLanguage,
  singularizeKey,
  type TypesLanguage,
} from '../mockifyer-web/frontend/src/lib/mock-data-generator/emit-types'
import {
  decodeShareHash,
  encodeShareHash,
} from '../mockifyer-web/frontend/src/lib/mock-data-generator/share-state'

/** Nested sample: array of users with nested address; nickname optional across items. */
const NESTED_SAMPLE = {
  users: [
    {
      id: 1,
      email: 'a@example.com',
      nickname: 'alpha',
      tags: ['admin', 'beta'],
      address: { city: 'Stockholm', zip: '11122' },
    },
    {
      id: 2,
      email: 'b@example.com',
      tags: ['guest'],
      address: { city: 'Oslo', zip: '0150' },
    },
  ],
}

describe('singularizeKey', () => {
  it('singularizes common plurals', () => {
    expect(singularizeKey('users')).toBe('User')
    expect(singularizeKey('addresses')).toBe('Address')
    expect(singularizeKey('entries')).toBe('Entry')
  })
})

describe('emitTypes languages', () => {
  it('lists the supported languages', () => {
    expect(TYPE_LANGUAGES.map((item) => item.id)).toEqual([
      'typescript',
      'zod',
      'json-schema',
      'csharp',
      'kotlin',
      'swift',
      'python',
      'go',
    ])
  })

  it('defaults unknown language ids to typescript', () => {
    expect(parseTypesLanguage('nope')).toBe('typescript')
  })

  it.each(TYPE_LANGUAGES.map((item) => item.id) as TypesLanguage[])(
    'emits %s for a nested sample with arrays and optional fields',
    (language) => {
      const out = emitTypes(NESTED_SAMPLE, { rootName: 'Root', language })
      expect(out.length).toBeGreaterThan(40)
      // Optional nickname (present on only one array item)
      if (language === 'typescript') {
        expect(out).toMatch(/nickname\?:/)
        expect(out).toContain('export interface User')
        expect(out).toContain('export interface Address')
        expect(out).toContain('tags: string[]')
      }
      if (language === 'zod') {
        expect(out).toContain("from 'zod'")
        expect(out).toContain('nickname:')
        expect(out).toContain('.optional()')
        expect(out).toContain('z.array(z.string())')
      }
      if (language === 'json-schema') {
        const parsed = JSON.parse(out) as {
          $defs?: Record<string, { required?: string[]; properties?: Record<string, unknown> }>
        }
        expect(parsed.$defs?.User).toBeTruthy()
        expect(parsed.$defs?.Address).toBeTruthy()
        expect(parsed.$defs?.User?.required ?? []).not.toContain('nickname')
        expect(parsed.$defs?.User?.properties?.tags).toBeTruthy()
      }
      if (language === 'csharp') {
        expect(out).toContain('public sealed record User')
        expect(out).toContain('string? Nickname')
        expect(out).toContain('List<string> Tags')
      }
      if (language === 'kotlin') {
        expect(out).toContain('data class User')
        expect(out).toContain('val nickname: String? = null')
        expect(out).toContain('List<String>')
      }
      if (language === 'swift') {
        expect(out).toContain('struct User: Codable')
        expect(out).toContain('let nickname: String?')
        expect(out).toContain('[String]')
      }
      if (language === 'python') {
        expect(out).toContain('class User(TypedDict)')
        expect(out).toContain('NotRequired[str]')
        expect(out).toContain('list[str]')
      }
      if (language === 'go') {
        expect(out).toContain('type User struct')
        expect(out).toContain('*string')
        expect(out).toContain('json:"nickname,omitempty"')
        expect(out).toContain('[]string')
      }
    }
  )

  it('emitTypeScript matches emitTypes typescript', () => {
    expect(emitTypeScript(NESTED_SAMPLE, { rootName: 'Root' })).toBe(
      emitTypes(NESTED_SAMPLE, { rootName: 'Root', language: 'typescript' })
    )
  })
})

describe('share state typesLanguage', () => {
  it('round-trips a non-default types language', () => {
    const encoded = encodeShareHash({
      input: '{"a":1}',
      context: '',
      seed: 1,
      count: 1,
      level: 'mild',
      checked: [],
      typesLanguage: 'go',
    })
    expect(encoded.ok).toBe(true)
    if (!encoded.ok) return
    const decoded = decodeShareHash(encoded.hash)
    expect(decoded?.typesLanguage).toBe('go')
  })

  it('omits default typescript from the payload', () => {
    const encoded = encodeShareHash({
      input: '{"a":1}',
      context: '',
      seed: 1,
      count: 1,
      level: 'mild',
      checked: [],
      typesLanguage: 'typescript',
    })
    expect(encoded.ok).toBe(true)
    if (!encoded.ok) return
    const decoded = decodeShareHash(encoded.hash)
    expect(decoded?.typesLanguage).toBeUndefined()
  })
})
