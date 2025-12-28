import { HTTPClient } from '@sgedda/mockifyer-core';
import { setupMockifyer as setupMockifyerAxios } from '@sgedda/mockifyer-axios';
import { setupMockifyer as setupMockifyerFetch } from '@sgedda/mockifyer-fetch';
import axios from 'axios';
import path from 'path';
import fs from 'fs';

export interface Fixture {
  id: number;
  homeTeam: string;
  awayTeam: string;
  date: string;
  venue: string;
  status: string;
  score?: {
    home: number;
    away: number;
  };
}

export interface Team {
  id: number;
  name: string;
  country: string;
  logo?: string;
  founded?: number;
}

export interface Standing {
  position: number;
  team: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
}

// Cache for initialized Mockifyer instances (to avoid re-initializing)
const initializedCache = new Set<string>();

function getClientCacheKey(clientType: string, scope: string): string {
  return `${clientType}:${scope}`;
}

function ensureMockifyerInitialized(clientType: 'axios' | 'fetch', scope: 'local' | 'global'): void {
  const cacheKey = getClientCacheKey(clientType, scope);
  
  // Return if already initialized
  if (initializedCache.has(cacheKey)) {
    console.log(`[FootballUnified] Mockifyer already initialized for ${cacheKey}`);
    return;
  }

  // Resolve mock data path
  let mockDataPath: string;
  
  if (process.env.MOCKIFYER_PATH) {
    mockDataPath = path.isAbsolute(process.env.MOCKIFYER_PATH) 
      ? process.env.MOCKIFYER_PATH 
      : path.join(process.cwd(), process.env.MOCKIFYER_PATH);
  } else if (process.env.RAILWAY_ENVIRONMENT || fs.existsSync('/persisted/mock-data')) {
    mockDataPath = '/persisted/mock-data';
  } else {
    mockDataPath = path.join(process.cwd(), 'persisted', 'mock-data');
  }

  console.log(`[FootballUnified] Initializing Mockifyer:`, {
    clientType,
    scope,
    mockDataPath,
    mockEnabled: process.env.MOCKIFYER_ENABLED === 'true',
    mockRecord: process.env.MOCKIFYER_RECORD === 'true'
  });

  const apiKey = process.env.FOOTBALL_API_KEY || '';

  // Configure Mockifyer based on clientType and scope
  const config: any = {
    mockDataPath: mockDataPath,
    recordMode: process.env.MOCKIFYER_RECORD === 'true',
    failOnMissingMock: false,
    similarMatchRequiredParams: ['season', 'league', 'team', 'days', 'id'], // 'id' is for team endpoint
    defaultHeaders: {
      'x-rapidapi-key': apiKey,
      'x-rapidapi-host': 'v3.football.api-sports.io'
    }
  };

  // Set global patching based on scope
  if (clientType === 'axios') {
    config.useGlobalAxios = scope === 'global';
    if (scope === 'global') {
      config.axiosInstance = axios;
    }
  } else if (clientType === 'fetch') {
    config.useGlobalFetch = scope === 'global';
  }

  // Add additional config options if Mockifyer is enabled
  if (process.env.MOCKIFYER_ENABLED === 'true') {
    config.recordSameEndpoints = process.env.MOCKIFYER_RECORD_SAME_ENDPOINTS === 'true';
    if (config.useSimilarMatch === undefined && process.env.MOCKIFYER_USE_SIMILAR_MATCH === 'true') {
      config.useSimilarMatch = true;
    }
    config.useSimilarMatchCheckResponse = process.env.MOCKIFYER_USE_SIMILAR_MATCH_CHECK_RESPONSE === 'true';
    if (!config.similarMatchRequiredParams || config.similarMatchRequiredParams.length === 0) {
      config.similarMatchRequiredParams = ['season', 'league'];
    }
  }

  // Initialize Mockifyer (this patches global axios/fetch if scope is global)
  if (clientType === 'axios') {
    setupMockifyerAxios(config);
  } else if (clientType === 'fetch') {
    setupMockifyerFetch(config);
  } else {
    throw new Error(`Unsupported clientType: ${clientType}`);
  }
  
  // Mark as initialized
  initializedCache.add(cacheKey);
  
  console.log(`[FootballUnified] Mockifyer initialized for ${cacheKey}`);
}

// Cache for HTTP clients (only used for local scope)
const clientCache = new Map<string, HTTPClient>();

function getHTTPClient(clientType: 'axios' | 'fetch'): HTTPClient {
  const cacheKey = getClientCacheKey(clientType, 'local');
  
  // Return cached client if available
  if (clientCache.has(cacheKey)) {
    return clientCache.get(cacheKey)!;
  }

  // Resolve mock data path
  let mockDataPath: string;
  
  if (process.env.MOCKIFYER_PATH) {
    mockDataPath = path.isAbsolute(process.env.MOCKIFYER_PATH) 
      ? process.env.MOCKIFYER_PATH 
      : path.join(process.cwd(), process.env.MOCKIFYER_PATH);
  } else if (process.env.RAILWAY_ENVIRONMENT || fs.existsSync('/persisted/mock-data')) {
    mockDataPath = '/persisted/mock-data';
  } else {
    mockDataPath = path.join(process.cwd(), 'persisted', 'mock-data');
  }

  const apiKey = process.env.FOOTBALL_API_KEY || '';

  // Configure Mockifyer for local HTTP client
  const config: any = {
    mockDataPath: mockDataPath,
    recordMode: process.env.MOCKIFYER_RECORD === 'true',
    failOnMissingMock: false,
    useGlobalAxios: false,
    useGlobalFetch: false,
    similarMatchRequiredParams: ['season', 'league', 'team', 'days', 'id'], // 'id' is for team endpoint
    defaultHeaders: {
      'x-rapidapi-key': apiKey,
      'x-rapidapi-host': 'v3.football.api-sports.io'
    }
  };

  // Add additional config options if Mockifyer is enabled
  if (process.env.MOCKIFYER_ENABLED === 'true') {
    config.recordSameEndpoints = process.env.MOCKIFYER_RECORD_SAME_ENDPOINTS === 'true';
    if (config.useSimilarMatch === undefined && process.env.MOCKIFYER_USE_SIMILAR_MATCH === 'true') {
      config.useSimilarMatch = true;
    }
    config.useSimilarMatchCheckResponse = process.env.MOCKIFYER_USE_SIMILAR_MATCH_CHECK_RESPONSE === 'true';
    if (!config.similarMatchRequiredParams || config.similarMatchRequiredParams.length === 0) {
      config.similarMatchRequiredParams = ['season', 'league'];
    }
  }

  // Create HTTP client for local scope
  let httpClient: HTTPClient;
  if (clientType === 'axios') {
    httpClient = setupMockifyerAxios(config);
  } else if (clientType === 'fetch') {
    httpClient = setupMockifyerFetch(config);
  } else {
    throw new Error(`Unsupported clientType: ${clientType}`);
  }
  
  // Cache the client
  clientCache.set(cacheKey, httpClient);
  
  return httpClient;
}

// Helper function to extract headers from axios/fetch response (same robust logic as weather-unified)
function extractHeaders(response: any, clientType: 'axios' | 'fetch', scope: 'local' | 'global'): Record<string, string> {
  const headers: Record<string, string> = {};
  let isMocked = false;

  if (scope === 'global' && clientType === 'axios') {
    // CRITICAL: Check config first - this is the most reliable way
    // The adapter sets __mockifyer_isMock on the config, which survives axios transformations
    const isMockedFromConfig = !!(response.config as any).__mockifyer_isMock;
    const preservedHeaders = (response.config as any).__mockifyer_headers as Record<string, string> | undefined;
    
    console.log('[FootballUnified] Mock detection from config:', {
      hasConfig: !!response.config,
      __mockifyer_isMock: (response.config as any).__mockifyer_isMock,
      isMocked: isMockedFromConfig,
      hasPreservedHeaders: !!preservedHeaders,
      preservedHeadersCount: preservedHeaders ? Object.keys(preservedHeaders).length : 0
    });
    
    const respHeaders = response.headers as any;
    
    // Start with config value - this is the most reliable
    let isMockedFromResponse = isMockedFromConfig;
    
    // Method 1: Try toJSON() first (most reliable if available)
    if (respHeaders && typeof respHeaders.toJSON === 'function') {
      try {
        const headersObj = respHeaders.toJSON();
        if (headersObj && typeof headersObj === 'object' && !Array.isArray(headersObj)) {
          Object.entries(headersObj).forEach(([key, value]) => {
            if (value !== undefined && value !== null) {
              const lowerKey = key.toLowerCase();
              headers[lowerKey] = String(value);
              if (lowerKey === 'x-mockifyer') {
                isMockedFromResponse = String(value) === 'true';
              }
            }
          });
          if (Object.keys(headers).length > 0) {
            console.log('[FootballUnified] ✅ Extracted', Object.keys(headers).length, 'headers using toJSON()');
          }
        }
      } catch (e) {
        console.warn('[FootballUnified] toJSON() failed:', e);
      }
    }
    
    // Method 2: Try forEach if toJSON didn't work
    if (Object.keys(headers).length === 0 && respHeaders && typeof respHeaders.forEach === 'function') {
      respHeaders.forEach((value: string, key: string) => {
        if (value !== undefined && value !== null) {
          const lowerKey = key.toLowerCase();
          headers[lowerKey] = String(value);
          if (lowerKey === 'x-mockifyer') {
            isMockedFromResponse = String(value) === 'true';
          }
        }
      });
      if (Object.keys(headers).length > 0) {
        console.log('[FootballUnified] ✅ Extracted', Object.keys(headers).length, 'headers using forEach()');
      }
    }
    
    // Method 3: Try get() method for specific headers
    if (!isMockedFromResponse && respHeaders && typeof respHeaders.get === 'function') {
      try {
        const mockHeader = respHeaders.get('x-mockifyer');
        if (mockHeader !== undefined && mockHeader !== null) {
          isMockedFromResponse = String(mockHeader) === 'true' || mockHeader === true;
          headers['x-mockifyer'] = String(mockHeader);
          console.log('[FootballUnified] ✅ Found x-mockifyer using get():', mockHeader);
        }
      } catch (e) {
        console.warn('[FootballUnified] get() failed:', e);
      }
    }
    
    // Method 4: Try Object.entries as last resort (but skip if it's AxiosHeaders - won't work)
    if (Object.keys(headers).length === 0 && respHeaders && typeof respHeaders === 'object' && respHeaders.constructor?.name !== 'AxiosHeaders') {
      try {
        const entries = Object.entries(respHeaders);
        entries.forEach(([key, value]) => {
          if (value !== undefined && value !== null && typeof value === 'string') {
            const lowerKey = key.toLowerCase();
            headers[lowerKey] = String(value);
            if (lowerKey === 'x-mockifyer') {
              isMockedFromResponse = String(value) === 'true';
            }
          }
        });
        if (Object.keys(headers).length > 0) {
          console.log('[FootballUnified] ✅ Extracted', Object.keys(headers).length, 'headers using Object.entries()');
        }
      } catch (e) {
        console.warn('[FootballUnified] Object.entries() failed:', e);
      }
    }
    
    // If headers are empty but we have preserved headers from config, use those
    if (Object.keys(headers).length === 0 && preservedHeaders && Object.keys(preservedHeaders).length > 0) {
      console.log('[FootballUnified] ⚠️ Response headers empty, using preserved headers from config');
      Object.assign(headers, preservedHeaders);
      if (headers['x-mockifyer']) {
        isMockedFromResponse = headers['x-mockifyer'] === 'true';
      }
    }
    
    // Ensure x-mockifyer is set if we detected it's mocked
    if (isMockedFromResponse && !headers['x-mockifyer']) {
      headers['x-mockifyer'] = 'true';
      console.log('[FootballUnified] Added x-mockifyer header because isMockedFromResponse=true');
    }
    
    isMocked = isMockedFromResponse;
  } else {
    // For local scope or fetch, headers should be plain object
    if (response.headers) {
      Object.entries(response.headers).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          headers[key.toLowerCase()] = String(value);
          if (key.toLowerCase() === 'x-mockifyer') {
            isMocked = String(value) === 'true';
          }
        }
      });
    }
  }

  // Ensure x-mockifyer is set if we detected it's mocked
  if (isMocked && !headers['x-mockifyer']) {
    headers['x-mockifyer'] = 'true';
  }

  return headers;
}

export async function getFixturesUnified(
  season?: number,
  teamId?: number,
  date?: string,
  clientType: 'axios' | 'fetch' = 'axios',
  scope: 'local' | 'global' = 'local'
): Promise<{ data: Fixture[]; headers: Record<string, string> }> {
  try {
    const apiKey = process.env.FOOTBALL_API_KEY || '';
    const baseUrl = 'https://v3.football.api-sports.io';

    if (!apiKey) {
      console.warn('[FootballUnified] WARNING: FOOTBALL_API_KEY is not set! API calls will fail.');
    }

    // Ensure Mockifyer is initialized (patches global axios/fetch if scope is global)
    ensureMockifyerInitialized(clientType, scope);

    const params: any = {};
    if (season) params.season = season.toString();
    if (teamId) params.team = teamId.toString();
    if (date) params.date = date;

    console.log('[FootballUnified] Making fixtures request:', {
      url: `${baseUrl}/fixtures`,
      params,
      clientType,
      scope,
      mockEnabled: process.env.MOCKIFYER_ENABLED === 'true',
      mockRecord: process.env.MOCKIFYER_RECORD === 'true'
    });

    let response: any;
    
    if (scope === 'global') {
      if (clientType === 'axios') {
        const axiosResponse = await axios.get(`${baseUrl}/fixtures`, {
          params,
          headers: {
            'x-rapidapi-key': apiKey,
            'x-rapidapi-host': 'v3.football.api-sports.io'
          }
        });
        
        // Extract headers using robust logic
        const headers = extractHeaders(axiosResponse, clientType, scope);
        const isMocked = !!(axiosResponse.config as any).__mockifyer_isMock || headers['x-mockifyer'] === 'true';
        
        response = {
          data: axiosResponse.data,
          status: axiosResponse.status,
          statusText: axiosResponse.statusText,
          headers: headers,
          __isMocked: isMocked // Store mock status
        } as any;
      } else { // fetch
        const fetchResponse = await fetch(`${baseUrl}/fixtures?${new URLSearchParams(params).toString()}`, {
          headers: {
            'x-rapidapi-key': apiKey,
            'x-rapidapi-host': 'v3.football.api-sports.io'
          }
        });
        
        const data = await fetchResponse.json();
        const headers: Record<string, string> = {};
        fetchResponse.headers.forEach((value, key) => {
          headers[key.toLowerCase()] = value;
        });
        
        response = {
          data,
          status: fetchResponse.status,
          statusText: fetchResponse.statusText,
          headers
        };
      }
    } else { // local scope
      const httpClient = getHTTPClient(clientType);
      response = await httpClient.get(`${baseUrl}/fixtures`, {
        params,
        headers: {
          'x-rapidapi-key': apiKey,
          'x-rapidapi-host': 'v3.football.api-sports.io'
        }
      });
    }

    const fixtures: Fixture[] = (response.data.response || []).map((fixture: any) => ({
      id: fixture.fixture.id,
      homeTeam: fixture.teams.home.name,
      awayTeam: fixture.teams.away.name,
      date: fixture.fixture.date,
      venue: fixture.fixture.venue?.name || 'TBD',
      status: fixture.fixture.status.long,
      score: fixture.goals.home !== null ? {
        home: fixture.goals.home,
        away: fixture.goals.away
      } : undefined
    }));

    // Check for mockifyer header (case-insensitive)
    // First check __isMocked flag (set from config detection), then fall back to headers
    let isMocked = !!(response as any).__isMocked;
    const originalHeaders = (response as any).__originalHeaders || response.headers;
    
    // If not set from flag, check headers
    if (!isMocked && originalHeaders) {
      if (typeof originalHeaders.get === 'function') {
        const mockHeader = originalHeaders.get('x-mockifyer');
        isMocked = mockHeader === 'true' || mockHeader === true;
      } else if (originalHeaders['x-mockifyer'] || originalHeaders['X-Mockifyer'] || originalHeaders['X-MOCKIFYER']) {
        isMocked = String(originalHeaders['x-mockifyer'] || originalHeaders['X-Mockifyer'] || originalHeaders['X-MOCKIFYER']) === 'true';
      }
    }
    
    // Check converted headers as fallback
    if (!isMocked && response.headers) {
      isMocked = response.headers['x-mockifyer'] === 'true';
    }
    
    // Ensure x-mockifyer header is in final headers if mocked
    const finalHeaders: Record<string, string> = { ...(response.headers || {}) };
    if (isMocked) {
      finalHeaders['x-mockifyer'] = 'true';
      // Also extract other mock metadata if available
      if (originalHeaders) {
        if (typeof originalHeaders.get === 'function') {
          const timestamp = originalHeaders.get('x-mockifyer-timestamp');
          const filename = originalHeaders.get('x-mockifyer-filename');
          const filepath = originalHeaders.get('x-mockifyer-filepath');
          if (timestamp) finalHeaders['x-mockifyer-timestamp'] = String(timestamp);
          if (filename) finalHeaders['x-mockifyer-filename'] = String(filename);
          if (filepath) finalHeaders['x-mockifyer-filepath'] = String(filepath);
        } else {
          if (originalHeaders['x-mockifyer-timestamp']) finalHeaders['x-mockifyer-timestamp'] = String(originalHeaders['x-mockifyer-timestamp']);
          if (originalHeaders['x-mockifyer-filename']) finalHeaders['x-mockifyer-filename'] = String(originalHeaders['x-mockifyer-filename']);
          if (originalHeaders['x-mockifyer-filepath']) finalHeaders['x-mockifyer-filepath'] = String(originalHeaders['x-mockifyer-filepath']);
        }
      }
    }

    return {
      data: fixtures,
      headers: finalHeaders
    };
  } catch (error: any) {
    console.error('[FootballUnified] Fixtures Error:', {
      message: error.message,
      status: error.response?.status,
      data: error.response?.data
    });
    throw new Error(`Failed to fetch fixtures: ${error.message}`);
  }
}

export async function getStandingsUnified(
  leagueId: number,
  season: number = new Date().getFullYear(),
  clientType: 'axios' | 'fetch' = 'axios',
  scope: 'local' | 'global' = 'local'
): Promise<{ data: Standing[]; headers: Record<string, string> }> {
  try {
    const apiKey = process.env.FOOTBALL_API_KEY || '';
    const baseUrl = 'https://v3.football.api-sports.io';

    if (!apiKey) {
      console.warn('[FootballUnified] WARNING: FOOTBALL_API_KEY is not set! API calls will fail.');
    }

    // Ensure Mockifyer is initialized
    ensureMockifyerInitialized(clientType, scope);

    const params = {
      league: leagueId.toString(),
      season: season.toString()
    };

    console.log('[FootballUnified] Making standings request:', {
      url: `${baseUrl}/standings`,
      params,
      clientType,
      scope,
      mockEnabled: process.env.MOCKIFYER_ENABLED === 'true',
      mockRecord: process.env.MOCKIFYER_RECORD === 'true'
    });

    let response: any;
    
    if (scope === 'global') {
      if (clientType === 'axios') {
        const axiosResponse = await axios.get(`${baseUrl}/standings`, {
          params,
          headers: {
            'x-rapidapi-key': apiKey,
            'x-rapidapi-host': 'v3.football.api-sports.io'
          }
        });
        
        // Extract headers using robust logic
        const headers = extractHeaders(axiosResponse, clientType, scope);
        const isMocked = !!(axiosResponse.config as any).__mockifyer_isMock || headers['x-mockifyer'] === 'true';
        
        response = {
          data: axiosResponse.data,
          status: axiosResponse.status,
          statusText: axiosResponse.statusText,
          headers: headers,
          __isMocked: isMocked // Store mock status
        } as any;
      } else { // fetch
        const fetchResponse = await fetch(`${baseUrl}/standings?${new URLSearchParams(params).toString()}`, {
          headers: {
            'x-rapidapi-key': apiKey,
            'x-rapidapi-host': 'v3.football.api-sports.io'
          }
        });
        
        const data = await fetchResponse.json();
        const headers: Record<string, string> = {};
        fetchResponse.headers.forEach((value, key) => {
          headers[key.toLowerCase()] = value;
        });
        
        response = {
          data,
          status: fetchResponse.status,
          statusText: fetchResponse.statusText,
          headers
        };
      }
    } else { // local scope
      const httpClient = getHTTPClient(clientType);
      response = await httpClient.get(`${baseUrl}/standings`, {
        params,
        headers: {
          'x-rapidapi-key': apiKey,
          'x-rapidapi-host': 'v3.football.api-sports.io'
        }
      });
    }

    const standings: Standing[] = [];
    if (response.data.response && response.data.response[0]?.league?.standings) {
      const leagueStandings = response.data.response[0].league.standings[0];
      standings.push(...leagueStandings.map((team: any) => ({
        position: team.rank,
        team: team.team.name,
        played: team.all.played,
        won: team.all.win,
        drawn: team.all.draw,
        lost: team.all.lose,
        goalsFor: team.all.goals.for,
        goalsAgainst: team.all.goals.against,
        goalDifference: team.goalsDiff,
        points: team.points
      })));
    }

    // Check for mockifyer header (case-insensitive)
    let isMocked = !!(response as any).__isMocked;
    const originalHeaders = (response as any).__originalHeaders || response.headers;
    
    if (!isMocked && originalHeaders) {
      if (typeof originalHeaders.get === 'function') {
        const mockHeader = originalHeaders.get('x-mockifyer');
        isMocked = mockHeader === 'true' || mockHeader === true;
      } else if (originalHeaders['x-mockifyer'] || originalHeaders['X-Mockifyer'] || originalHeaders['X-MOCKIFYER']) {
        isMocked = String(originalHeaders['x-mockifyer'] || originalHeaders['X-Mockifyer'] || originalHeaders['X-MOCKIFYER']) === 'true';
      }
    }
    
    if (!isMocked && response.headers) {
      isMocked = response.headers['x-mockifyer'] === 'true';
    }
    
    const finalHeaders: Record<string, string> = { ...(response.headers || {}) };
    if (isMocked) {
      finalHeaders['x-mockifyer'] = 'true';
      if (originalHeaders) {
        if (typeof originalHeaders.get === 'function') {
          const timestamp = originalHeaders.get('x-mockifyer-timestamp');
          const filename = originalHeaders.get('x-mockifyer-filename');
          const filepath = originalHeaders.get('x-mockifyer-filepath');
          if (timestamp) finalHeaders['x-mockifyer-timestamp'] = String(timestamp);
          if (filename) finalHeaders['x-mockifyer-filename'] = String(filename);
          if (filepath) finalHeaders['x-mockifyer-filepath'] = String(filepath);
        } else {
          if (originalHeaders['x-mockifyer-timestamp']) finalHeaders['x-mockifyer-timestamp'] = String(originalHeaders['x-mockifyer-timestamp']);
          if (originalHeaders['x-mockifyer-filename']) finalHeaders['x-mockifyer-filename'] = String(originalHeaders['x-mockifyer-filename']);
          if (originalHeaders['x-mockifyer-filepath']) finalHeaders['x-mockifyer-filepath'] = String(originalHeaders['x-mockifyer-filepath']);
        }
      }
    }

    return {
      data: standings,
      headers: finalHeaders
    };
  } catch (error: any) {
    console.error('[FootballUnified] Standings Error:', {
      message: error.message,
      status: error.response?.status,
      data: error.response?.data
    });
    throw new Error(`Failed to fetch standings: ${error.message}`);
  }
}

export async function getTeamInfoUnified(
  teamId: number,
  clientType: 'axios' | 'fetch' = 'axios',
  scope: 'local' | 'global' = 'local'
): Promise<{ data: Team; headers: Record<string, string> }> {
  try {
    const apiKey = process.env.FOOTBALL_API_KEY || '';
    const baseUrl = 'https://v3.football.api-sports.io';

    if (!apiKey) {
      console.warn('[FootballUnified] WARNING: FOOTBALL_API_KEY is not set! API calls will fail.');
    }

    // Ensure Mockifyer is initialized
    ensureMockifyerInitialized(clientType, scope);

    const params = {
      id: teamId.toString()
    };

    console.log('[FootballUnified] Making team info request:', {
      url: `${baseUrl}/teams`,
      params,
      clientType,
      scope,
      mockEnabled: process.env.MOCKIFYER_ENABLED === 'true',
      mockRecord: process.env.MOCKIFYER_RECORD === 'true'
    });

    let response: any;
    
    if (scope === 'global') {
      if (clientType === 'axios') {
        const axiosResponse = await axios.get(`${baseUrl}/teams`, {
          params,
          headers: {
            'x-rapidapi-key': apiKey,
            'x-rapidapi-host': 'v3.football.api-sports.io'
          }
        });
        
        // Extract headers using robust logic
        const headers = extractHeaders(axiosResponse, clientType, scope);
        const isMocked = !!(axiosResponse.config as any).__mockifyer_isMock || headers['x-mockifyer'] === 'true';
        
        response = {
          data: axiosResponse.data,
          status: axiosResponse.status,
          statusText: axiosResponse.statusText,
          headers: headers,
          __isMocked: isMocked // Store mock status
        } as any;
      } else { // fetch
        const fetchResponse = await fetch(`${baseUrl}/teams?${new URLSearchParams(params).toString()}`, {
          headers: {
            'x-rapidapi-key': apiKey,
            'x-rapidapi-host': 'v3.football.api-sports.io'
          }
        });
        
        const data = await fetchResponse.json();
        const headers: Record<string, string> = {};
        fetchResponse.headers.forEach((value, key) => {
          headers[key.toLowerCase()] = value;
        });
        
        response = {
          data,
          status: fetchResponse.status,
          statusText: fetchResponse.statusText,
          headers
        };
      }
    } else { // local scope
      const httpClient = getHTTPClient(clientType);
      response = await httpClient.get(`${baseUrl}/teams`, {
        params,
        headers: {
          'x-rapidapi-key': apiKey,
          'x-rapidapi-host': 'v3.football.api-sports.io'
        }
      });
    }

    const teamData = response.data.response?.[0]?.team;
    if (!teamData) {
      throw new Error('Team not found');
    }

    const team: Team = {
      id: teamData.id,
      name: teamData.name,
      country: teamData.country,
      logo: teamData.logo,
      founded: teamData.founded
    };

    // Check for mockifyer header (case-insensitive)
    let isMocked = !!(response as any).__isMocked;
    const originalHeaders = (response as any).__originalHeaders || response.headers;
    
    if (!isMocked && originalHeaders) {
      if (typeof originalHeaders.get === 'function') {
        const mockHeader = originalHeaders.get('x-mockifyer');
        isMocked = mockHeader === 'true' || mockHeader === true;
      } else if (originalHeaders['x-mockifyer'] || originalHeaders['X-Mockifyer'] || originalHeaders['X-MOCKIFYER']) {
        isMocked = String(originalHeaders['x-mockifyer'] || originalHeaders['X-Mockifyer'] || originalHeaders['X-MOCKIFYER']) === 'true';
      }
    }
    
    if (!isMocked && response.headers) {
      isMocked = response.headers['x-mockifyer'] === 'true';
    }
    
    const finalHeaders: Record<string, string> = { ...(response.headers || {}) };
    if (isMocked) {
      finalHeaders['x-mockifyer'] = 'true';
      if (originalHeaders) {
        if (typeof originalHeaders.get === 'function') {
          const timestamp = originalHeaders.get('x-mockifyer-timestamp');
          const filename = originalHeaders.get('x-mockifyer-filename');
          const filepath = originalHeaders.get('x-mockifyer-filepath');
          if (timestamp) finalHeaders['x-mockifyer-timestamp'] = String(timestamp);
          if (filename) finalHeaders['x-mockifyer-filename'] = String(filename);
          if (filepath) finalHeaders['x-mockifyer-filepath'] = String(filepath);
        } else {
          if (originalHeaders['x-mockifyer-timestamp']) finalHeaders['x-mockifyer-timestamp'] = String(originalHeaders['x-mockifyer-timestamp']);
          if (originalHeaders['x-mockifyer-filename']) finalHeaders['x-mockifyer-filename'] = String(originalHeaders['x-mockifyer-filename']);
          if (originalHeaders['x-mockifyer-filepath']) finalHeaders['x-mockifyer-filepath'] = String(originalHeaders['x-mockifyer-filepath']);
        }
      }
    }

    return {
      data: team,
      headers: finalHeaders
    };
  } catch (error: any) {
    console.error('[FootballUnified] Team Info Error:', {
      message: error.message,
      status: error.response?.status,
      data: error.response?.data
    });
    throw new Error(`Failed to fetch team information: ${error.message}`);
  }
}

