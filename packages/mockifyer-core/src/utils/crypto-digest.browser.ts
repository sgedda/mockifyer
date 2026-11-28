/**
 * Optional browser entry for crypto-digest.
 *
 * The real `./crypto-digest` module is already cross-platform (pure SHA-256 +
 * Web Crypto, no top-level Node `crypto` import). It is **not** remapped via
 * the package.json `"browser"` field — Metro/RN must load the real module so
 * `sha256Hex` / `randomEventId` stay defined.
 *
 * This file re-exports the real helpers for tooling that imports the `.browser`
 * path explicitly.
 */
export {
  sha256Hex,
  randomEventId,
  utf8ByteLength,
  truncateUtf8,
} from './crypto-digest';
