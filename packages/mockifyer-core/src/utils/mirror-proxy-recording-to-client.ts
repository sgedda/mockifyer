import type { MockifyerConfig, MockData } from '../types';
import type { DatabaseProvider } from '../providers';
import type { MockifyerProxyRecordingMeta } from '../types/http-client';
import { ensureScenarioFolder, getScenarioFolderPath } from './scenario';
import { resolveRecordingExclusions } from './recording-exclusion';
import { shouldExcludeUrl } from './url-exclusion';
import { shouldExcludeRecording } from './recording-exclusion';
import { logger } from './logger';

let fs: typeof import('fs') | undefined;
let path: typeof import('path') | undefined;

try {
  fs = require('fs');
  path = require('path');
} catch {
  fs = undefined;
  path = undefined;
}

export interface MirrorProxyRecordingOptions {
  config: MockifyerConfig;
  mockDataPath: string;
  recording: MockifyerProxyRecordingMeta;
  databaseProvider?: DatabaseProvider;
  databaseProviderInitPromise?: Promise<void>;
  logPrefix?: string;
}

/**
 * When dashboard proxy records to Redis, optionally persist the same payload on the client filesystem or provider.
 */
export async function mirrorProxyRecordingToClient(options: MirrorProxyRecordingOptions): Promise<void> {
  const { config, mockDataPath, databaseProvider, databaseProviderInitPromise } = options;
  const logPrefix = options.logPrefix ?? 'Mockifyer';
  const rec = options.recording;
  if (!rec?.recordedToStore || !rec.storedMock) {
    return;
  }
  const hash = rec.hash?.trim();
  const scenarioName = rec.scenarioName?.trim();
  if (!hash || !scenarioName) {
    logger.warn(`[${logPrefix}] Proxy client mirror skipped: missing hash or scenario from proxy`);
    return;
  }
  const mockData = rec.storedMock as MockData;
  const url = mockData?.request?.url || '';
  if (shouldExcludeUrl(url, config.excludedUrls)) {
    return;
  }
  const recExclusions = resolveRecordingExclusions(config);
  if (shouldExcludeRecording(url, recExclusions, config.baseUrl)) {
    return;
  }

  if (databaseProviderInitPromise) {
    await databaseProviderInitPromise;
  }

  const providerType = config.databaseProvider?.type;
  if (databaseProvider && providerType && providerType !== 'memory') {
    try {
      const out = databaseProvider.save(mockData, {
        relativePath: `redis/${hash}.json`,
        scenario: scenarioName,
      });
      if (out instanceof Promise) {
        await out;
      }
      logger.info(
        `[${logPrefix}] Mirrored proxy recording (${providerType}): ${scenarioName}/redis/${hash}.json`
      );
    } catch (e) {
      logger.error(`[${logPrefix}] Proxy client mirror (provider) failed:`, e);
    }
    return;
  }

  if (fs && path) {
    try {
      ensureScenarioFolder(mockDataPath, scenarioName);
      const scenarioPath = getScenarioFolderPath(mockDataPath, scenarioName);
      const filePath = path.join(scenarioPath, 'redis', `${hash}.json`);
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      fs.writeFileSync(filePath, JSON.stringify(mockData, null, 2));
      logger.info(
        `[${logPrefix}] Mirrored proxy recording (filesystem): ${scenarioName}/redis/${hash}.json`
      );
    } catch (e) {
      logger.error(`[${logPrefix}] Proxy client mirror (Node fs) failed:`, e);
    }
  }
}
