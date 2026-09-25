import type { NetworkEventUsage } from './network-event-types';

/**
 * Doc upsert hook. atlas-usage records usage without importing atlas-doc
 * (atlas-doc imports the HTML/HAR graph that used to import atlas-usage back).
 */
export interface AtlasDocUsageWrite {
  scenario?: string;
  screen?: string;
  component?: string;
  datasourceId?: string;
  dataRoot?: string;
  requestId?: string;
  cms?: {
    pageId?: string;
    nodeId?: string;
    type?: string;
    path?: string;
  };
  timestamp?: string;
}

type AtlasDocUsageWriter = (input: AtlasDocUsageWrite) => void;

let writer: AtlasDocUsageWriter | null = null;

export function registerAtlasDocUsageWriter(next: AtlasDocUsageWriter): void {
  writer = next;
}

export function writeAtlasDocFromUsage(input: AtlasDocUsageWrite): void {
  writer?.(input);
}
