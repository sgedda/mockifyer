/**
 * Node-only helpers for `@sgedda/mockifyer-generator/node`.
 *
 * Writes generated variant mocks to a Mockifyer `mock-data` tree using the
 * same host/path/filename layout as `@sgedda/mockifyer-core` recordings so
 * filesystem replay finds them under the active scenario.
 * Do **not** import this entry from browser bundles (uses `fs` / `path`).
 */

import * as fs from 'fs';
import * as path from 'path';
import { serializeMock, type GeneratedMockData } from '../mock-format';
import type { NamedVariant } from '../variants';
import { getMockRelativeFile } from './file-naming';

export interface WriteVariantScenariosOptions {
  /** Root mock-data directory (contains scenario folders). */
  mockDataPath: string;
  /**
   * Relative path under each scenario for the mock file.
   * Default: core-compatible `{host}/{path…}/{METHOD}_{date}_{hash}.json`
   * derived from the mock request (see {@link getMockRelativeFile}).
   */
  relativeFile?: string;
}

export interface WrittenVariantScenario {
  kind: NamedVariant['kind'];
  name: string;
  scenario: string;
  filePath: string;
  /** Path relative to the scenario folder. */
  relativeFile: string;
}

/**
 * Persist each named variant as its own Mockifyer scenario folder.
 *
 * Default layout (mirrors core recordings):
 * ```
 * {mockDataPath}/{scenario}/{hostname}/{path…}/{METHOD}_{date}_{hash}.json
 * ```
 * where `scenario` comes from `mock.scenario` (set by {@link variants}).
 */
export function writeVariantScenarios(
  named: ReadonlyArray<NamedVariant>,
  options: WriteVariantScenariosOptions
): WrittenVariantScenario[] {
  if (!options.mockDataPath || typeof options.mockDataPath !== 'string') {
    throw new Error('writeVariantScenarios(): mockDataPath is required');
  }

  const written: WrittenVariantScenario[] = [];

  for (const item of named) {
    const scenario = item.mock.scenario ?? `generated-${item.name}`;
    const mock: GeneratedMockData = { ...item.mock, scenario, generated: true };
    const relative =
      options.relativeFile ?? getMockRelativeFile(mock).replace(/\\/g, '/');
    const filePath = path.join(options.mockDataPath, scenario, relative);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });

    fs.writeFileSync(filePath, serializeMock(mock), 'utf8');

    written.push({
      kind: item.kind,
      name: item.name,
      scenario,
      filePath,
      relativeFile: relative,
    });
  }

  return written;
}

export {
  formatDateStr,
  getMockFilePath,
  getMockRelativeFile,
  requestIdentityKey,
} from './file-naming';

export type { NamedVariant, GeneratedMockData };
