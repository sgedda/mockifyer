/**
 * Node-only helpers for `@sgedda/mockifyer-generator/node`.
 *
 * Writes generated variant mocks to a Mockifyer `mock-data` tree.
 * Do **not** import this entry from browser bundles (uses `fs` / `path`).
 */

import * as fs from 'fs';
import * as path from 'path';
import { serializeMock, type GeneratedMockData } from '../mock-format';
import type { NamedVariant } from '../variants';

export interface WriteVariantScenariosOptions {
  /** Root mock-data directory (contains scenario folders). */
  mockDataPath: string;
  /**
   * Relative path under each scenario for the mock file
   * (default `generated/VARIANT.json`).
   */
  relativeFile?: string;
}

export interface WrittenVariantScenario {
  kind: NamedVariant['kind'];
  name: string;
  scenario: string;
  filePath: string;
}

/**
 * Persist each named variant as its own Mockifyer scenario folder.
 *
 * Layout:
 * ```
 * {mockDataPath}/{scenario}/generated/{name}.json
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
    const relative =
      options.relativeFile ?? path.join('generated', `${item.name}.json`);
    const filePath = path.join(options.mockDataPath, scenario, relative);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });

    const mock: GeneratedMockData = { ...item.mock, scenario, generated: true };
    fs.writeFileSync(filePath, serializeMock(mock), 'utf8');

    written.push({
      kind: item.kind,
      name: item.name,
      scenario,
      filePath,
    });
  }

  return written;
}

export type { NamedVariant, GeneratedMockData };
