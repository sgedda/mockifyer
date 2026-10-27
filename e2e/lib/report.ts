import { readFileSync } from 'node:fs';
import path from 'node:path';
import { ASSERTS_ANNOTATION, isActor, type Actor, type Annotation } from './docs';
import { APP_VIDEO_ATTACHMENT, DASHBOARD_VIDEO_ATTACHMENT } from './videos';

/** Repository root; absolute paths under it are written as REPO_ROOT_PLACEHOLDER in generated docs. */
export const REPO_ROOT = path.resolve(__dirname, '../..');
export const REPO_ROOT_PLACEHOLDER = '<repo>';
/** The e2e package folder, relative to the repository root. */
export const E2E_DIR = path.relative(REPO_ROOT, path.resolve(__dirname, '..'));

interface ReportAttachment { name: string; path?: string }
interface ReportResult { status: string; duration: number; retry: number; annotations?: Annotation[]; attachments: ReportAttachment[] }
interface ReportTest { projectName: string; status: string; annotations: Annotation[]; results: ReportResult[] }
interface ReportSpec { title: string; file: string; line: number; tags: string[]; tests: ReportTest[] }
interface ReportSuite { title: string; specs?: ReportSpec[]; suites?: ReportSuite[] }
export interface PlaywrightReport {
  config: { argv?: string[]; metadata?: { cwd?: string; env?: Record<string, string> } };
  suites: ReportSuite[];
  stats: { startTime: string; duration: number; expected: number; unexpected: number; flaky: number; skipped: number };
}

/** One test (one project) of the run, last attempt. */
export interface TestRun {
  title: string;
  describe: string;
  /** Spec path relative to e2e/tests. */
  file: string;
  line: number;
  project: string;
  tags: string[];
  /** Playwright outcome: expected, unexpected, flaky or skipped. */
  outcome: string;
  /** Status of the last attempt: passed, failed, timedOut, skipped, interrupted. */
  status: string;
  retry: number;
  durationMs: number;
  asserts?: string;
  steps: Array<{ actor: Actor; description: string }>;
  notes: Annotation[];
  appVideo?: string;
  dashboardVideo?: string;
  trace?: string;
}

export function readReport(file: string): PlaywrightReport {
  return JSON.parse(readFileSync(file, 'utf8'));
}

function* specsOf(suite: ReportSuite, describe: string[] = []): Generator<{ spec: ReportSpec; describe: string[] }> {
  for (const spec of suite.specs ?? []) yield { spec, describe };
  for (const child of suite.suites ?? []) yield* specsOf(child, [...describe, child.title]);
}

/** Static annotations from the test declaration plus runtime ones pushed via test.info(), deduplicated. */
function annotationsOf(test: ReportTest, last?: ReportResult): Annotation[] {
  const seen = new Set<string>();
  return [...test.annotations, ...(last?.annotations ?? [])].filter((a) => {
    const key = `${a.type}\u0000${a.description ?? ''}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function testRuns(report: PlaywrightReport): TestRun[] {
  const runs: TestRun[] = [];
  for (const suite of report.suites) {
    for (const { spec, describe } of specsOf(suite)) {
      for (const test of spec.tests) {
        const last = test.results.at(-1);
        const attachment = (name: string) => last?.attachments.find((a) => a.name === name)?.path;
        const annotations = annotationsOf(test, last);
        runs.push({
          title: spec.title,
          describe: describe.join(' › '),
          file: spec.file,
          line: spec.line,
          project: test.projectName,
          tags: spec.tags.map((t) => (t.startsWith('@') ? t : `@${t}`)),
          outcome: test.status,
          status: last?.status ?? 'skipped',
          retry: last?.retry ?? 0,
          durationMs: last?.duration ?? 0,
          asserts: annotations.find((a) => a.type === ASSERTS_ANNOTATION)?.description,
          steps: annotations.flatMap((a) => (isActor(a.type) ? [{ actor: a.type, description: a.description ?? '' }] : [])),
          notes: annotations.filter((a) => a.type !== ASSERTS_ANNOTATION && !isActor(a.type)),
          appVideo: attachment(APP_VIDEO_ATTACHMENT),
          dashboardVideo: attachment(DASHBOARD_VIDEO_ATTACHMENT),
          trace: attachment('trace'),
        });
      }
    }
  }
  return runs;
}
