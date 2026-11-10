/**
 * Cross-platform digest helpers (Node.js + React Native / Metro).
 * Avoids top-level `import 'crypto'` so RN bundles do not fail module resolution.
 */

function tryNodeSha256Hex(input: string): string | undefined {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const nodeCrypto = require('crypto') as typeof import('crypto');
    if (nodeCrypto?.createHash) {
      return nodeCrypto.createHash('sha256').update(input).digest('hex');
    }
  } catch {
    // Not Node or crypto unavailable in this runtime
  }
  return undefined;
}

/** Minimal SHA-256 for environments without Node `crypto` (e.g. React Native). */
function pureSha256Hex(input: string): string {
  const utf8 = unescape(encodeURIComponent(input));
  const bytes: number[] = [];
  for (let i = 0; i < utf8.length; i += 1) {
    bytes.push(utf8.charCodeAt(i));
  }

  const K = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ];

  const rotr = (n: number, x: number): number => (x >>> n) | (x << (32 - n));
  const ch = (x: number, y: number, z: number): number => (x & y) ^ (~x & z);
  const maj = (x: number, y: number, z: number): number => (x & y) ^ (x & z) ^ (y & z);
  const sigma0 = (x: number): number => rotr(2, x) ^ rotr(13, x) ^ rotr(22, x);
  const sigma1 = (x: number): number => rotr(6, x) ^ rotr(11, x) ^ rotr(25, x);
  const gamma0 = (x: number): number => rotr(7, x) ^ rotr(18, x) ^ (x >>> 3);
  const gamma1 = (x: number): number => rotr(17, x) ^ rotr(19, x) ^ (x >>> 10);

  const l = bytes.length;
  bytes.push(0x80);
  while (bytes.length % 64 !== 56) {
    bytes.push(0);
  }
  const bitLen = l * 8;
  for (let i = 7; i >= 0; i -= 1) {
    bytes.push((bitLen >>> (i * 8)) & 0xff);
  }

  let h0 = 0x6a09e667;
  let h1 = 0xbb67ae85;
  let h2 = 0x3c6ef372;
  let h3 = 0xa54ff53a;
  let h4 = 0x510e527f;
  let h5 = 0x9b05688c;
  let h6 = 0x1f83d9ab;
  let h7 = 0x5be0cd19;

  for (let i = 0; i < bytes.length; i += 64) {
    const w = new Array<number>(64);
    for (let t = 0; t < 16; t += 1) {
      const j = i + t * 4;
      w[t] =
        ((bytes[j] << 24) | (bytes[j + 1] << 16) | (bytes[j + 2] << 8) | bytes[j + 3]) >>> 0;
    }
    for (let t = 16; t < 64; t += 1) {
      w[t] = (gamma1(w[t - 2]) + w[t - 7] + gamma0(w[t - 15]) + w[t - 16]) >>> 0;
    }

    let a = h0;
    let b = h1;
    let c = h2;
    let d = h3;
    let e = h4;
    let f = h5;
    let g = h6;
    let h = h7;

    for (let t = 0; t < 64; t += 1) {
      const t1 = (h + sigma1(e) + ch(e, f, g) + K[t] + w[t]) >>> 0;
      const t2 = (sigma0(a) + maj(a, b, c)) >>> 0;
      h = g;
      g = f;
      f = e;
      e = (d + t1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (t1 + t2) >>> 0;
    }

    h0 = (h0 + a) >>> 0;
    h1 = (h1 + b) >>> 0;
    h2 = (h2 + c) >>> 0;
    h3 = (h3 + d) >>> 0;
    h4 = (h4 + e) >>> 0;
    h5 = (h5 + f) >>> 0;
    h6 = (h6 + g) >>> 0;
    h7 = (h7 + h) >>> 0;
  }

  return [h0, h1, h2, h3, h4, h5, h6, h7]
    .map((v) => v.toString(16).padStart(8, '0'))
    .join('');
}

/** SHA-256 hex digest — Node `crypto` when available, pure JS fallback in RN. */
export function sha256Hex(input: string): string {
  return tryNodeSha256Hex(input) ?? pureSha256Hex(input);
}

function fallbackRandomId(): string {
  const hex = (): string =>
    Math.floor(Math.random() * 0x10000)
      .toString(16)
      .padStart(4, '0');
  return `${hex()}${hex()}-${hex()}-4${hex().slice(1)}-a${hex().slice(1)}-${hex()}${hex()}${hex()}`;
}

/** Random event id — Web Crypto / Node when available. */
export function randomEventId(): string {
  const webCrypto = globalThis.crypto;
  if (webCrypto && typeof webCrypto.randomUUID === 'function') {
    return webCrypto.randomUUID();
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const nodeCrypto = require('crypto') as typeof import('crypto');
    if (typeof nodeCrypto.randomUUID === 'function') {
      return nodeCrypto.randomUUID();
    }
  } catch {
    // ignore
  }
  return fallbackRandomId();
}

/** UTF-8 byte length without Node `Buffer`. */
export function utf8ByteLength(text: string): number {
  return new TextEncoder().encode(text).length;
}

/** Truncate UTF-8 text to at most `maxBytes` bytes. */
export function truncateUtf8(text: string, maxBytes: number): string {
  const bytes = new TextEncoder().encode(text);
  if (bytes.length <= maxBytes) {
    return text;
  }
  return `${new TextDecoder().decode(bytes.slice(0, maxBytes))}…[truncated]`;
}
