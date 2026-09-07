/** Matches core `SCRATCH_SCENARIO` — ephemeral unscoped traffic bucket. */
export const SCRATCH_SCENARIO = '_scratch'

export function isScratchScenario(scenario: string | null | undefined): boolean {
  return typeof scenario === 'string' && scenario.trim() === SCRATCH_SCENARIO
}

/** Label for pickers / badges; keep raw id in title tooltips. */
export function scenarioDisplayName(scenario: string): string {
  if (isScratchScenario(scenario)) {
    return 'Temporary (unscoped)'
  }
  return scenario
}

export function formatScratchTtlHours(ttlSec: number | undefined): string {
  const sec = ttlSec && ttlSec > 0 ? ttlSec : 60 * 60 * 24
  const hours = Math.max(1, Math.round(sec / 3600))
  return hours === 24 ? '24 hours' : `${hours} hours`
}
