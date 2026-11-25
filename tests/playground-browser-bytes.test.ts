/**
 * Playground byte helpers must run without Node `Buffer` (Chromium / Railway tsc).
 */

describe('playground browser bytes without Buffer', () => {
  type GlobalBag = typeof globalThis & { Buffer?: BufferConstructor }
  const globalWithBuffer = globalThis as GlobalBag
  let savedBuffer: BufferConstructor | undefined

  beforeEach(() => {
    savedBuffer = globalWithBuffer.Buffer
    // Runtime-only: strip Buffer so helpers cannot fall back to Node APIs.
    Reflect.deleteProperty(globalWithBuffer, 'Buffer')
  })

  afterEach(() => {
    if (savedBuffer !== undefined) {
      Object.defineProperty(globalWithBuffer, 'Buffer', {
        value: savedBuffer,
        configurable: true,
        writable: true,
      })
    }
  })

  function loadModules() {
    jest.resetModules()
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const bytes = require('../mockifyer-web/frontend/src/lib/mock-data-generator/bytes') as typeof import('../mockifyer-web/frontend/src/lib/mock-data-generator/bytes')
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const sha256 = require('../mockifyer-web/frontend/src/lib/mock-data-generator/sha256') as typeof import('../mockifyer-web/frontend/src/lib/mock-data-generator/sha256')
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const share = require('../mockifyer-web/frontend/src/lib/mock-data-generator/share-state') as typeof import('../mockifyer-web/frontend/src/lib/mock-data-generator/share-state')
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const paths = require('../mockifyer-web/frontend/src/lib/mock-data-generator/mock-paths') as typeof import('../mockifyer-web/frontend/src/lib/mock-data-generator/mock-paths')
    return { ...bytes, ...sha256, ...share, ...paths }
  }

  it('does not see global Buffer while running', () => {
    expect(typeof globalWithBuffer.Buffer).toBe('undefined')
    loadModules()
  })

  it('utf8 + base64url round-trip without Buffer', () => {
    const { utf8Encode, toBase64Url, fromBase64Url } = loadModules()
    const sample = 'café · mockifyer 🧪'
    const encoded = toBase64Url(utf8Encode(sample))
    expect(encoded).not.toMatch(/[+/=]/)
    expect(fromBase64Url(encoded)).toEqual(utf8Encode(sample))
  })

  it('sha256Hex matches Node crypto oracle', () => {
    const { sha256Hex } = loadModules()
    const input = 'GET:https://example.invalid/api/orders'
    const digest = sha256Hex(input)
    expect(digest).toMatch(/^[0-9a-f]{64}$/)

    if (savedBuffer) {
      globalWithBuffer.Buffer = savedBuffer
    }
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const crypto = require('crypto') as typeof import('crypto')
    const expected = crypto.createHash('sha256').update(input, 'utf8').digest('hex')
    Reflect.deleteProperty(globalWithBuffer, 'Buffer')
    expect(digest).toBe(expected)
  })

  it('share hash encode/decode works without Buffer', () => {
    const { encodeShareHash, decodeShareHash } = loadModules()
    const encoded = encodeShareHash({
      input: '{"ok":true}',
      context: 'swedish users',
      seed: 42,
      count: 2,
      level: 'wild',
      checked: ['http-404'],
      overrides: { '$.email': 'email' },
    })
    expect(encoded.ok).toBe(true)
    if (!encoded.ok) return
    expect(decodeShareHash(encoded.hash)).toEqual({
      input: '{"ok":true}',
      context: 'swedish users',
      seed: 42,
      count: 2,
      level: 'wild',
      checked: ['http-404'],
      overrides: { '$.email': 'email' },
    })
  })

  it('mock relative paths still hash without Buffer', () => {
    const { getMockRelativeFile } = loadModules()
    const relative = getMockRelativeFile({
      request: {
        method: 'GET',
        url: 'https://api.example.com/v1/users',
        headers: {},
      },
      response: { status: 200, headers: {}, data: { id: 1 } },
      timestamp: '2024-01-01T00:00:00.000Z',
      scenario: 'generated-test',
      generated: true,
    })
    expect(relative).toMatch(/api\.example\.com/)
    expect(relative).toMatch(/_[0-9a-f]{12}\.json$/)
  })
})
