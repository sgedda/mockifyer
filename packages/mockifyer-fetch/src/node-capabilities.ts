/**
 * Platform-specific capabilities for Mockifyer.
 * Node entry provides full implementations; browser/RN provide limited or no-op versions.
 */

export interface NodeCapabilities {
  /**
   * SHA-256 digest for cache keys and request hashing.
   * Node: crypto.createHash. Browser: Web Crypto or pure-JS fallback.
   */
  digest(input: string): string;

  /**
   * Get current scenario name from filesystem or env.
   * Node: reads from disk/env. Browser: returns default or env-only.
   */
  getCurrentScenario(mockDataPath: string, clientId?: string): string;

  /**
   * Get filesystem path for scenario folder.
   * Node: resolves paths. Browser: returns mock path (no fs operations).
   */
  getScenarioFolderPath(mockDataPath: string, scenario: string): string;

  /**
   * Ensure scenario directory exists.
   * Node: creates directory. Browser: no-op.
   */
  ensureScenarioFolder(mockDataPath: string, scenario: string): void;

  /**
   * Mirror proxy recording to client filesystem.
   * Node: writes to disk. Browser: no-op or error.
   */
  mirrorProxyRecording?(mockData: any, scenario: string, hash: string): Promise<void>;

  /**
   * Spill large response bodies to disk.
   * Node: writes file. Browser: keeps in memory or errors.
   */
  spillBodyToDisk?(body: unknown, spillPath: string): void;

  /**
   * Read spilled body from disk.
   * Node: reads file. Browser: returns undefined.
   */
  readSpilledBody?(spillPath: string): unknown;

  /**
   * HTTP request correlation (for distributed tracing).
   * Node: uses http/https modules. Browser: header-only or no-op.
   */
  applyRequestCorrelation?(request: any, context: any): void;

  /**
   * Generate Atlas HTML documentation.
   * Node: full HTML generation. Browser: not supported.
   */
  generateAtlasHtml?(data: any): string | undefined;
}
