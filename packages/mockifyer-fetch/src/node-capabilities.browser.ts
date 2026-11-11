/**
 * Browser implementation of NodeCapabilities.
 * Uses Web Crypto API and provides no-ops for fs-based features.
 */

import { NodeCapabilities } from './node-capabilities';

// Pure-JS SHA-256 implementation (from crypto-digest.ts)
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

  // Padding
  const len = bytes.length;
  const bitLen = len * 8;
  bytes.push(0x80);
  while ((bytes.length % 64) !== 56) {
    bytes.push(0);
  }
  for (let i = 7; i >= 0; i -= 1) {
    bytes.push((bitLen >>> (i * 8)) & 0xff);
  }

  // Initial hash
  let H = [
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
    0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ];

  // Process blocks
  for (let offset = 0; offset < bytes.length; offset += 64) {
    const W: number[] = [];
    for (let t = 0; t < 16; t += 1) {
      W[t] =
        (bytes[offset + t * 4] << 24) |
        (bytes[offset + t * 4 + 1] << 16) |
        (bytes[offset + t * 4 + 2] << 8) |
        bytes[offset + t * 4 + 3];
    }
    for (let t = 16; t < 64; t += 1) {
      W[t] = (gamma1(W[t - 2]) + W[t - 7] + gamma0(W[t - 15]) + W[t - 16]) >>> 0;
    }

    let [a, b, c, d, e, f, g, h] = H;
    for (let t = 0; t < 64; t += 1) {
      const T1 = (h + sigma1(e) + ch(e, f, g) + K[t] + W[t]) >>> 0;
      const T2 = (sigma0(a) + maj(a, b, c)) >>> 0;
      h = g;
      g = f;
      f = e;
      e = (d + T1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (T1 + T2) >>> 0;
    }
    H = [
      (H[0] + a) >>> 0,
      (H[1] + b) >>> 0,
      (H[2] + c) >>> 0,
      (H[3] + d) >>> 0,
      (H[4] + e) >>> 0,
      (H[5] + f) >>> 0,
      (H[6] + g) >>> 0,
      (H[7] + h) >>> 0,
    ];
  }

  return H.map((n) => n.toString(16).padStart(8, '0')).join('');
}

export const browserCapabilities: NodeCapabilities = {
  digest(input: string): string {
    // Use pure-JS implementation (Web Crypto is async, we need sync)
    return pureSha256Hex(input);
  },

  getCurrentScenario(_mockDataPath: string, _clientId?: string): string {
    // Browser: use env var only, or default
    return (typeof process !== 'undefined' && process.env?.MOCKIFYER_SCENARIO) || 'default';
  },

  getScenarioFolderPath(mockDataPath: string, _scenario: string): string {
    // Browser: return mock path as-is (no filesystem resolution)
    return mockDataPath;
  },

  ensureScenarioFolder(_mockDataPath: string, _scenario: string): void {
    // Browser: no-op (no filesystem)
  },

  // Optional features not supported in browser
  mirrorProxyRecording: undefined,
  spillBodyToDisk: undefined,
  readSpilledBody: undefined,
  applyRequestCorrelation: undefined,
  generateAtlasHtml: undefined,
};
