/**
 * CORS-friendly public APIs verified for WebContainer (browser) networking.
 *
 * Both respond with Access-Control-Allow-Origin when Origin is present:
 * - jsonplaceholder.typicode.com → echoes Origin
 * - api.open-meteo.com → *
 */
export const USERS_URL = 'https://jsonplaceholder.typicode.com/users/1';
export const WEATHER_URL =
  'https://api.open-meteo.com/v1/forecast?latitude=52.52&longitude=13.41&current=temperature_2m';

/** Selective recording allowlist — only these patterns get full response bodies. */
export const RECORD_RESPONSES_PATTERNS = [
  'jsonplaceholder.typicode.com/users*',
  'api.open-meteo.com/v1/forecast*',
];
