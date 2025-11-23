import { HTTPClient } from '@sgedda/mockifyer';
import { setupMockifyer } from '@sgedda/mockifyer';
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

export class FootballService {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly httpClient: HTTPClient;

  constructor() {
    this.apiKey = process.env.FOOTBALL_API_KEY || '';
    this.baseUrl = 'https://v3.football.api-sports.io';
    
    if (!this.apiKey) {
      console.warn('[FootballService] WARNING: FOOTBALL_API_KEY is not set! API calls will fail.');
    }
    
    // Initialize mockifyer if enabled
    const mockDataPath = process.env.MOCKIFYER_PATH 
      ? (path.isAbsolute(process.env.MOCKIFYER_PATH) 
          ? process.env.MOCKIFYER_PATH 
          : path.join(process.cwd(), process.env.MOCKIFYER_PATH))
      : path.join(process.cwd(), 'mock-data');
    
    console.log('[FootballService] Mock data path:', {
      envPath: process.env.MOCKIFYER_PATH,
      resolvedPath: mockDataPath,
      cwd: process.cwd(),
      pathExists: fs.existsSync(mockDataPath)
    });
    
    if (process.env.MOCKIFYER_ENABLED === 'true') {
      this.httpClient = setupMockifyer({
        mockDataPath: mockDataPath,
        recordMode: process.env.MOCKIFYER_RECORD === 'true',
        failOnMissingMock: false,
        recordSameEndpoints: process.env.MOCKIFYER_RECORD_SAME_ENDPOINTS === 'true',
        useSimilarMatch: process.env.MOCKIFYER_USE_SIMILAR_MATCH === 'true',
        useSimilarMatchCheckResponse: process.env.MOCKIFYER_USE_SIMILAR_MATCH_CHECK_RESPONSE === 'true',
        // Require these parameters to match for similar matching (fundamental params that change the data)
        similarMatchRequiredParams: ['season', 'league', 'team'],
        defaultHeaders: {
          'x-rapidapi-key': this.apiKey,
          'x-rapidapi-host': 'v3.football.api-sports.io'
        }
      });
    } else {
      this.httpClient = setupMockifyer({
        mockDataPath: mockDataPath,
        recordMode: false,
        failOnMissingMock: false,
        defaultHeaders: {
          'x-rapidapi-key': this.apiKey,
          'x-rapidapi-host': 'v3.football.api-sports.io'
        }
      });
    }

    console.log('[FootballService] Initialized with:', {
      baseUrl: this.baseUrl,
      hasApiKey: !!this.apiKey,
      mockEnabled: process.env.MOCKIFYER_ENABLED,
      mockRecord: process.env.MOCKIFYER_RECORD,
      mockPath: process.env.MOCKIFYER_PATH
    });
  }

  async getFixtures(season?: number, teamId?: number, date?: string): Promise<{ data: Fixture[]; headers: Record<string, string> }> {
    try {
      console.log('[FootballService] Making fixtures request:', {
        url: `${this.baseUrl}/fixtures`,
        season,
        teamId,
        date,
        mockEnabled: process.env.MOCKIFYER_ENABLED,
        mockRecord: process.env.MOCKIFYER_RECORD
      });

      const params: any = {};
      if (season) params.season = season.toString();
      if (teamId) params.team = teamId.toString();
      if (date) params.date = date;

      console.log('[FootballService] API Key check:', {
        hasApiKey: !!this.apiKey,
        apiKeyLength: this.apiKey?.length || 0,
        apiKeyPrefix: this.apiKey?.substring(0, 10) || 'N/A'
      });

      const response = await this.httpClient.get(`${this.baseUrl}/fixtures`, {
        params,
        headers: {
          'x-rapidapi-key': this.apiKey,
          'x-rapidapi-host': 'api-football-v1.p.rapidapi.com'
        }
      });

      const isMocked = response.headers && (
        response.headers['x-mockifyer'] === 'true' ||
        response.headers['X-Mockifyer'] === 'true' ||
        response.headers['X-MOCKIFYER'] === 'true'
      );
      
      console.log('[FootballService] Received fixtures response:', {
        status: response.status,
        hasData: !!response.data,
        isMocked: isMocked
      });

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

      return {
        data: fixtures,
        headers: response.headers as Record<string, string>
      };
    } catch (error: any) {
      console.error('[FootballService] Fixtures Error:', {
        message: error.message,
        status: error.response?.status,
        data: error.response?.data
      });
      throw new Error(`Failed to fetch fixtures`);
    }
  }

  async getStandings(leagueId: number, season: number = new Date().getFullYear()): Promise<{ data: Standing[]; headers: Record<string, string> }> {
    try {
      console.log('[FootballService] Making standings request:', {
        url: `${this.baseUrl}/standings`,
        leagueId,
        season,
        mockEnabled: process.env.MOCKIFYER_ENABLED,
        mockRecord: process.env.MOCKIFYER_RECORD
      });

      const response = await this.httpClient.get(`${this.baseUrl}/standings`, {
        params: {
          league: leagueId.toString(),
          season: season.toString()
        },
        headers: {
          'x-rapidapi-key': this.apiKey,
          'x-rapidapi-host': 'v3.football.api-sports.io'
        }
      });

      const isMocked = response.headers && (
        response.headers['x-mockifyer'] === 'true' ||
        response.headers['X-Mockifyer'] === 'true' ||
        response.headers['X-MOCKIFYER'] === 'true'
      );
      
      console.log('[FootballService] Received standings response:', {
        status: response.status,
        hasData: !!response.data,
        isMocked: isMocked
      });

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

      return {
        data: standings,
        headers: response.headers as Record<string, string>
      };
    } catch (error: any) {
      console.error('[FootballService] Standings Error:', {
        message: error.message,
        status: error.response?.status,
        data: error.response?.data
      });
      throw new Error(`Failed to fetch standings`);
    }
  }

  async getTeamInfo(teamId: number): Promise<{ data: Team; headers: Record<string, string> }> {
    try {
      console.log('[FootballService] Making team info request:', {
        url: `${this.baseUrl}/teams`,
        teamId,
        mockEnabled: process.env.MOCKIFYER_ENABLED,
        mockRecord: process.env.MOCKIFYER_RECORD
      });

      const response = await this.httpClient.get(`${this.baseUrl}/teams`, {
        params: {
          id: teamId.toString()
        },
        headers: {
          'x-rapidapi-key': this.apiKey,
          'x-rapidapi-host': 'v3.football.api-sports.io'
        }
      });

      const isMocked = response.headers && (
        response.headers['x-mockifyer'] === 'true' ||
        response.headers['X-Mockifyer'] === 'true' ||
        response.headers['X-MOCKIFYER'] === 'true'
      );
      
      console.log('[FootballService] Received team info response:', {
        status: response.status,
        hasData: !!response.data,
        isMocked: isMocked
      });

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

      return {
        data: team,
        headers: response.headers as Record<string, string>
      };
    } catch (error: any) {
      console.error('[FootballService] Team Info Error:', {
        message: error.message,
        status: error.response?.status,
        data: error.response?.data
      });
      throw new Error(`Failed to fetch team information`);
    }
  }
}

export const footballService = new FootballService();

