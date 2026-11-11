/**
 * Node.js implementation of NodeCapabilities.
 * Imports real utilities from mockifyer-core that use fs/path/crypto.
 */

import { NodeCapabilities } from './node-capabilities';
import {
  getCurrentScenario,
  getScenarioFolderPath,
  ensureScenarioFolder,
} from '@sgedda/mockifyer-core';

// Import crypto digest directly from source (works in both Jest and production)
const cryptoDigest = require('@sgedda/mockifyer-core/utils/crypto-digest');
const sha256Hex = cryptoDigest.sha256Hex;

export const nodeCapabilities: NodeCapabilities = {
  digest(input: string): string {
    return sha256Hex(input);
  },

  getCurrentScenario(mockDataPath: string, clientId?: string): string {
    return getCurrentScenario(mockDataPath, clientId);
  },

  getScenarioFolderPath(mockDataPath: string, scenario: string): string {
    return getScenarioFolderPath(mockDataPath, scenario);
  },

  ensureScenarioFolder(mockDataPath: string, scenario: string): void {
    ensureScenarioFolder(mockDataPath, scenario);
  },

  // Optional capabilities - lazily loaded when needed
  mirrorProxyRecording: undefined, // Loaded on demand
  spillBodyToDisk: undefined,
  readSpilledBody: undefined,
  applyRequestCorrelation: undefined,
  generateAtlasHtml: undefined,
};
