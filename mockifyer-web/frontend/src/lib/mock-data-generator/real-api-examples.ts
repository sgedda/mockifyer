/**
 * Static captures of well-known public APIs for the playground Real API section.
 * Never fetched live — keeps “Nothing leaves your browser” true.
 */

import { findPreset, type PlaygroundPreset } from './defaults'

export interface RealApiExample {
  id: string
  name: string
  /** Display-only origin URL (not requested by the playground). */
  sourceUrl: string
  capturedNote: string
  context: string
  /** Exact JSON body as recorded. */
  recorded: unknown
  /** Matching playground preset when one exists. */
  preset?: PlaygroundPreset
}

const JSONPLACEHOLDER = findPreset('jsonplaceholder')!

/**
 * Open-Meteo forecast sample (Stockholm) — captured offline for demos.
 * Shape matches a typical `GET /v1/forecast` JSON body.
 */
const OPEN_METEO_RECORDED = {
  latitude: 59.3293,
  longitude: 18.0686,
  generationtime_ms: 0.42,
  utc_offset_seconds: 3600,
  timezone: 'Europe/Stockholm',
  timezone_abbreviation: 'CEST',
  elevation: 28.0,
  current_units: {
    time: 'iso8601',
    interval: 'seconds',
    temperature_2m: '°C',
    weather_code: 'wmo code',
  },
  current: {
    time: '2024-06-15T14:00',
    interval: 900,
    temperature_2m: 18.2,
    weather_code: 2,
  },
} as const

export const REAL_API_EXAMPLES: readonly RealApiExample[] = [
  {
    id: 'jsonplaceholder-user',
    name: JSONPLACEHOLDER.realApi!.name,
    sourceUrl: JSONPLACEHOLDER.realApi!.sourceUrl,
    capturedNote: JSONPLACEHOLDER.realApi!.capturedNote,
    context: JSONPLACEHOLDER.context,
    recorded: JSONPLACEHOLDER.sample,
    preset: JSONPLACEHOLDER,
  },
  {
    id: 'open-meteo-stockholm',
    name: 'Open-Meteo',
    sourceUrl:
      'https://api.open-meteo.com/v1/forecast?latitude=59.3293&longitude=18.0686&current=temperature_2m,weather_code',
    capturedNote:
      'Static capture of a Stockholm forecast response — not fetched live in the browser.',
    context: 'metric units, European cities',
    recorded: OPEN_METEO_RECORDED,
  },
] as const

export const DEFAULT_REAL_API_EXAMPLE = REAL_API_EXAMPLES[0]!

/**
 * `generate` always returns `unknown[]` (one synthetic record per count).
 * For the side-by-side “same structure” panel, mirror the sample root:
 * object sample → one object; array sample → the records array.
 */
export function mirrorGeneratedRoot(sample: unknown, records: unknown[]): unknown {
  if (Array.isArray(sample)) {
    return records
  }
  return records[0] ?? null
}
