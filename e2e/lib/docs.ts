/**
 * Human-readable test descriptions, stored as Playwright annotations so they reach the JSON report.
 * scripts/build-run-artifacts.ts turns them into one Markdown file per test and the run summary.
 *
 *   test('title', documented('what it asserts', [[ACTOR.dashboardUi, 'Settings: ...'], [ACTOR.app, '44° shows']]), ...)
 */

/** Annotation type of the one-line summary of what a test asserts. */
export const ASSERTS_ANNOTATION = 'asserts';

/** Who performs a step; the annotation type of each step. */
export const ACTOR = {
  dashboardUi: 'dashboard-ui',
  dashboardApi: 'mockifyer-api',
  mcp: 'mockifyer-mcp',
  app: 'app',
  helper: 'helper',
} as const;
export type Actor = (typeof ACTOR)[keyof typeof ACTOR];

export const ACTOR_LABEL: Record<Actor, string> = {
  'dashboard-ui': 'Mockifyer dashboard UI',
  'mockifyer-api': 'Mockifyer dashboard API',
  'mockifyer-mcp': 'Mockifyer MCP server',
  app: 'WanderWeird app (demo)',
  helper: 'Helper (test harness / demo stack)',
};

export interface Annotation { type: string; description?: string }

/** Test details carrying the summary and the ordered steps. */
export function documented(asserts: string, steps: Array<[Actor, string]> = []): { annotation: Annotation[] } {
  return {
    annotation: [
      { type: ASSERTS_ANNOTATION, description: asserts },
      ...steps.map(([type, description]) => ({ type, description })),
    ],
  };
}

export function isActor(type: string): type is Actor {
  return Object.values(ACTOR).includes(type as Actor);
}
