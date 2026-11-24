/**
 * Browser-safe UTF-8 / base64 helpers (no Node `Buffer`).
 */

const textEncoder = new TextEncoder()
const textDecoder = new TextDecoder()

/** UTF-8 encode a string. */
export function utf8Encode(text: string): Uint8Array {
  return textEncoder.encode(text)
}

/** UTF-8 byte length of a string. */
export function utf8ByteLength(text: string): number {
  return utf8Encode(text).length
}

/** UTF-8 decode bytes (possibly a truncated view). */
export function utf8Decode(bytes: Uint8Array): string {
  return textDecoder.decode(bytes)
}

const BASE64_ALPHABET =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'

/** Encode bytes as standard base64 (no Buffer / btoa dependency). */
export function bytesToBase64(bytes: Uint8Array): string {
  let out = ''
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i]!
    const b = i + 1 < bytes.length ? bytes[i + 1]! : 0
    const c = i + 2 < bytes.length ? bytes[i + 2]! : 0
    const triple = (a << 16) | (b << 8) | c
    out += BASE64_ALPHABET[(triple >> 18) & 63]
    out += BASE64_ALPHABET[(triple >> 12) & 63]
    out += i + 1 < bytes.length ? BASE64_ALPHABET[(triple >> 6) & 63] : '='
    out += i + 2 < bytes.length ? BASE64_ALPHABET[triple & 63] : '='
  }
  return out
}

function base64Index(char: string): number {
  if (char === '=') return 0
  const idx = BASE64_ALPHABET.indexOf(char)
  return idx >= 0 ? idx : 0
}

/** Decode standard base64 to bytes (no Buffer / atob dependency). */
export function base64ToBytes(b64: string): Uint8Array {
  const cleaned = b64.replace(/[^A-Za-z0-9+/=]/g, '')
  const padLen = (4 - (cleaned.length % 4)) % 4
  const input = cleaned + '='.repeat(padLen)
  const paddingCount = (input.match(/=+$/)?.[0].length ?? 0)
  const out = new Uint8Array((input.length / 4) * 3 - paddingCount)
  let outIndex = 0
  for (let i = 0; i < input.length; i += 4) {
    const n =
      (base64Index(input[i]!) << 18) |
      (base64Index(input[i + 1]!) << 12) |
      (base64Index(input[i + 2]!) << 6) |
      base64Index(input[i + 3]!)
    if (outIndex < out.length) out[outIndex++] = (n >> 16) & 255
    if (outIndex < out.length) out[outIndex++] = (n >> 8) & 255
    if (outIndex < out.length) out[outIndex++] = n & 255
  }
  return out
}

/** Base64url (no padding) from bytes. */
export function toBase64Url(bytes: Uint8Array): string {
  return bytesToBase64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

/** Decode base64url (with or without padding) to bytes. */
export function fromBase64Url(text: string): Uint8Array {
  const padded = text.replace(/-/g, '+').replace(/_/g, '/')
  const padLen = (4 - (padded.length % 4)) % 4
  return base64ToBytes(padded + '='.repeat(padLen))
}
