import type { MockReplayMode, MockResponseDateOverride } from '@/types'

export interface MockResponseUpdateInput {
  responseData: unknown
  responseDateOverrides?: MockResponseDateOverride[] | null
  replayMode?: MockReplayMode | null
  scenario?: string
}

/**
 * Body for the editor Save path.
 *
 * The response payload is always nested under `responseData`. A recorded JSON
 * object often has its own `responseData`, `statusOverride`, `responseDelayMs`,
 * or `replayMode` fields; those are part of the saved body, not dashboard
 * settings. Callers that change only status or delay use {@link buildMockBehaviorUpdate}.
 */
export function buildMockResponseUpdate(input: MockResponseUpdateInput): {
  body: Record<string, unknown>
  scenario?: string
} {
  const body: Record<string, unknown> = {
    responseData: input.responseData,
  }
  if (input.responseDateOverrides !== undefined) {
    body.responseDateOverrides = input.responseDateOverrides
  }
  if (input.replayMode !== undefined) {
    body.replayMode = input.replayMode
  }
  return { body, scenario: input.scenario }
}

/** Partial PUT for status override and response delay. Does not touch the stored body. */
export function buildMockBehaviorUpdate(updates: {
  statusOverride?: number | null
  responseDelayMs?: number | null
}): Record<string, unknown> {
  const body: Record<string, unknown> = {}
  if (updates.statusOverride !== undefined) {
    body.statusOverride = updates.statusOverride
  }
  if (updates.responseDelayMs !== undefined) {
    body.responseDelayMs = updates.responseDelayMs
  }
  return body
}
