import type {
  NetworkEvent,
  MockData,
} from '@sgedda/mockifyer-core';
import {
  parseResponseDataPath,
  resolveNetworkRequestTrace,
} from '@sgedda/mockifyer-core';
import { createNetworkLogStore } from './network-log-store';
import { hydrateResponsePreviewsForDashboard } from './network-event-response-hydration';
import type { DashboardContextConfig } from './dashboard-context';
import { getAtlasStore } from './atlas-store';
import { createDashboardMockStore } from './create-dashboard-mock-store';
import { isCentralizedDashboardProvider } from './dashboard-provider';
import path from 'path';
import fs from 'fs';

interface ExplainValueInput {
  scenario: string;
  requestId?: string;
  url?: string;
  path?: string;
  fieldPath?: string;
  value?: unknown;
  clientId?: string;
}

interface FieldModification {
  type: 'field_override' | 'date_override' | 'lane_override' | 'pool_ref';
  source: string;
  path: string;
  originalValue?: unknown;
  effectiveValue?: unknown;
  details?: Record<string, unknown>;
}

interface ExplainValueResult {
  scenario: string;
  lookup: {
    requestId?: string;
    url?: string;
    path?: string;
    fieldPath?: string;
    value?: unknown;
  };
  origin: {
    mockFile?: string;
    mockFilePath?: string;
    jsonPath?: string;
    upstreamRequest?: {
      method: string;
      url: string;
      status?: number;
    };
  };
  modifications: FieldModification[];
  trace?: {
    hopCount: number;
    rootRequestId?: string;
    hops: Array<{
      index: number;
      method: string;
      url: string;
      source: string;
      status?: number;
    }>;
  };
  siblingFields?: Record<string, unknown>;
  notes?: string[];
}

function getAtPath(data: unknown, pathStr: string): unknown {
  const segments = parseResponseDataPath(pathStr);
  let cur: unknown = data;
  for (const seg of segments) {
    if (cur === null || cur === undefined) return undefined;
    if (Array.isArray(cur)) {
      if (typeof seg !== 'number') return undefined;
      cur = cur[seg];
    } else if (typeof cur === 'object') {
      cur = (cur as Record<string, unknown>)[seg as string];
    } else {
      return undefined;
    }
  }
  return cur;
}

function getSiblingFields(data: unknown, pathStr: string, maxFields = 10): Record<string, unknown> {
  if (!pathStr) return {};
  
  const segments = parseResponseDataPath(pathStr);
  if (segments.length === 0) {
    if (typeof data === 'object' && data !== null && !Array.isArray(data)) {
      const entries = Object.entries(data as Record<string, unknown>).slice(0, maxFields);
      return Object.fromEntries(entries);
    }
    return {};
  }
  
  const parentSegments = segments.slice(0, -1);
  let parent: unknown = data;
  for (const seg of parentSegments) {
    if (parent === null || parent === undefined) return {};
    if (Array.isArray(parent)) {
      if (typeof seg !== 'number') return {};
      parent = parent[seg];
    } else if (typeof parent === 'object') {
      parent = (parent as Record<string, unknown>)[seg as string];
    } else {
      return {};
    }
  }
  
  if (typeof parent === 'object' && parent !== null && !Array.isArray(parent)) {
    const entries = Object.entries(parent as Record<string, unknown>).slice(0, maxFields);
    return Object.fromEntries(entries);
  }
  
  return {};
}

function findMockByRequestId(
  events: NetworkEvent[],
  requestId: string
): { event: NetworkEvent; mockFile?: string } | null {
  for (const event of events) {
    if (event.requestId === requestId) {
      return { event };
    }
  }
  return null;
}

async function findMockByUrl(
  mockDataPath: string,
  scenario: string,
  urlOrPath: string,
  config: DashboardContextConfig
): Promise<{ mockFile: string; mockData: MockData } | null> {
  const isFullUrl = urlOrPath.startsWith('http://') || urlOrPath.startsWith('https://');
  const searchPath = isFullUrl || urlOrPath.startsWith('/') ? urlOrPath : `/${urlOrPath}`;
  
  if (isCentralizedDashboardProvider(config.provider)) {
    const store = createDashboardMockStore(config, mockDataPath);
    try {
      const { items } = await store.search(scenario, [searchPath], 10);
      for (const item of items) {
        if (item.mockData.request?.url && item.mockData.request.url.includes(searchPath)) {
          return {
            mockFile: `redis/${item.hash}.json`,
            mockData: item.mockData,
          };
        }
      }
    } finally {
      await store.close().catch(() => undefined);
    }
    return null;
  }
  
  const scenarioPath = path.join(mockDataPath, scenario);
  if (!fs.existsSync(scenarioPath)) return null;
  
  try {
    const files = fs.readdirSync(scenarioPath, { recursive: true });
    for (const file of files) {
      const filePath = path.join(scenarioPath, file.toString());
      if (!filePath.endsWith('.json')) continue;
      if (!fs.statSync(filePath).isFile()) continue;
      
      try {
        const content = fs.readFileSync(filePath, 'utf-8');
        const mockData = JSON.parse(content) as MockData;
        if (mockData.request?.url && mockData.request.url.includes(searchPath)) {
          return {
            mockFile: path.relative(scenarioPath, filePath),
            mockData,
          };
        }
      } catch {
        continue;
      }
    }
  } catch {
    return null;
  }
  
  return null;
}

function extractModifications(
  mockData: MockData,
  fieldPath?: string
): FieldModification[] {
  const modifications: FieldModification[] = [];
  
  if (mockData.responseFieldOverrides && mockData.responseFieldOverrides.length > 0) {
    for (const override of mockData.responseFieldOverrides) {
      if (!fieldPath || override.path === fieldPath || override.path.startsWith(`${fieldPath}.`)) {
        const originalValue = mockData.response?.data
          ? getAtPath(mockData.response.data, override.path)
          : undefined;
        
        modifications.push({
          type: 'field_override',
          source: 'mock_file',
          path: override.path,
          originalValue,
          effectiveValue: override.value,
          details: {
            mode: override.mode || 'replace',
          },
        });
      }
    }
  }
  
  if (mockData.responseDateOverrides && mockData.responseDateOverrides.length > 0) {
    for (const override of mockData.responseDateOverrides) {
      if (!fieldPath || override.path === fieldPath || override.path.startsWith(`${fieldPath}.`)) {
        modifications.push({
          type: 'date_override',
          source: 'mock_file',
          path: override.path,
          details: {
            offsetDays: override.offsetDays,
            offsetHours: override.offsetHours,
            offsetMinutes: override.offsetMinutes,
            offsetMs: override.offsetMs,
            format: override.format,
          },
        });
      }
    }
  }
  
  return modifications;
}

export async function explainValue(
  input: ExplainValueInput,
  config: DashboardContextConfig,
  mockDataPath: string
): Promise<ExplainValueResult> {
  const result: ExplainValueResult = {
    scenario: input.scenario,
    lookup: {
      requestId: input.requestId,
      url: input.url,
      path: input.path,
      fieldPath: input.fieldPath,
      value: input.value,
    },
    origin: {},
    modifications: [],
    notes: [],
  };
  
  const store = createNetworkLogStore(config);
  let mockFile: string | undefined;
  let mockData: MockData | undefined;
  let traceEvents: NetworkEvent[] = [];
  
  try {
    if (input.requestId) {
      const { events: stored } = await store.list({
        scenario: input.scenario,
        clientId: input.clientId,
        limit: 5000,
      });
      traceEvents = await hydrateResponsePreviewsForDashboard(
        stored,
        config,
        mockDataPath,
        input.scenario
      );
      
      const found = findMockByRequestId(traceEvents, input.requestId);
      if (found) {
        result.origin.upstreamRequest = {
          method: found.event.method,
          url: found.event.url,
          status: found.event.status,
        };
        
        if (found.event.source === 'mock-hit' && found.event.url) {
          const mockSearch = await findMockByUrl(mockDataPath, input.scenario, found.event.url, config);
          if (mockSearch) {
            mockFile = mockSearch.mockFile;
            mockData = mockSearch.mockData;
          }
        }
      }
      
      const trace = resolveNetworkRequestTrace(traceEvents, {
        by: 'requestId',
        value: input.requestId,
        scenario: input.scenario,
      });
      
      if (trace) {
        result.trace = {
          hopCount: trace.hopCount,
          rootRequestId: trace.rootRequestId ?? undefined,
          hops: trace.hops.map((hop) => ({
            index: hop.index,
            method: hop.method,
            url: hop.url,
            source: hop.source,
            status: hop.status,
          })),
        };
      }
    } else if (input.url || input.path) {
      const searchPath = input.url || input.path!;
      const mockSearch = await findMockByUrl(mockDataPath, input.scenario, searchPath, config);
      if (mockSearch) {
        mockFile = mockSearch.mockFile;
        mockData = mockSearch.mockData;
      }
    }
    
    if (mockFile && mockData) {
      result.origin.mockFile = mockFile;
      result.origin.mockFilePath = path.join(mockDataPath, input.scenario, mockFile);
      
      if (input.fieldPath) {
        result.origin.jsonPath = input.fieldPath;
      }
      
      const modifications = extractModifications(mockData, input.fieldPath);
      result.modifications.push(...modifications);
      
      if (mockData.response?.data && input.fieldPath) {
        const siblingFields = getSiblingFields(mockData.response.data, input.fieldPath);
        if (Object.keys(siblingFields).length > 0) {
          result.siblingFields = siblingFields;
        }
      }
      
      if (modifications.length === 0) {
        result.notes?.push('No field or date overrides found for this value');
      }
      
      if (mockData.alwaysUseRealApi) {
        result.notes?.push('Mock is set to always use real API (passthrough mode)');
      }
      
      if (mockData.responsePending) {
        result.notes?.push('Response is pending - no captured data yet');
      }
    } else {
      result.notes?.push('Mock file not found for the given request');
    }
    
    const atlasStore = getAtlasStore();
    if (input.requestId) {
      const usageList = atlasStore.listUsage(input.scenario);
      const usage = usageList.find((u) => u.requestId === input.requestId);
      if (usage) {
        result.notes?.push(
          `Used in: ${usage.usage.screen || usage.usage.component || 'unknown screen'}`
        );
      }
    }
  } finally {
    await store.close().catch(() => undefined);
  }
  
  return result;
}
