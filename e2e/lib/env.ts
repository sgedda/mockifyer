export const DASHBOARD = process.env.MOCKIFYER_DASHBOARD_URL ?? 'http://127.0.0.1:3002';
export const GATEWAY = process.env.GATEWAY_URL ?? 'http://127.0.0.1:4200';
export const APP = process.env.APP_URL ?? 'http://127.0.0.1:8090';
/** Scenario the demo is left in (and must be restored to). */
export const BASE_SCENARIO = process.env.BASE_SCENARIO ?? 'guide-demo-2';
export const LANE = process.env.MOCKIFYER_CLIENT_ID ?? 'wanderweird-demo';
/** Open-Meteo Athens forecast, the mock behind the Atlantis Discover card. */
export const ATHENS_ENDPOINT_PREFIX = 'https://api.open-meteo.com/v1/forecast?latitude=37.9838';
export const ATHENS_ENDPOINT =
  'https://api.open-meteo.com/v1/forecast?latitude=37.9838' +
  '&longitude=23.7275&current=temperature_2m%2Cweather_code%2Cwind_speed_10m' +
  '&daily=temperature_2m_max%2Ctemperature_2m_min%2Cprecipitation_probability_max&timezone=auto&forecast_days=3';
/** The gateway -> wander-api hop behind the Atlantis Discover card, as the network log stores it. */
export const WANDER_DISCOVER_URL = 'http://127.0.0.1:4203/discover';
/** wander-api's improvised weather when the Open-Meteo hop fails (`source: 'fallback'`). */
export const WANDER_FALLBACK_TEMP = 18;
/** Values the demo data shows on the Atlantis card per scenario (see guide 4.14). */
export const EXPECTED_TEMP: Record<string, number> = { 'guide-demo-2': 99, heatwave: 44, 'rainy-weekend': 11 };
/** Optional: dashboard built from current main (see README "Testing main"). */
export const MAIN_DASHBOARD = process.env.MAIN_DASHBOARD_URL;
export const MAIN_MCP_CLI = process.env.MAIN_MCP_CLI;
