import express, { Request, Response } from 'express';
import { getCurrentScenario, type AtlasEvent, type AtlasUsageAnnotation } from '@sgedda/mockifyer-core';
import { getDashboardContext } from '../utils/dashboard-context';
import { getAtlasStore, isAtlasPrefetchEvent } from '../utils/atlas-store';
import {
  getAtlasGeneratedHopBody,
  getAtlasGeneratedStatus,
  listAtlasGeneratedHops,
  searchAtlasGeneratedBodies,
  summarizeAtlasDoc,
} from '../utils/atlas-generated';

const router = express.Router();

function parseLimit(raw: unknown, fallback = 500): number {
  const n = Number.parseInt(String(raw ?? ''), 10);
  if (!Number.isFinite(n) || n < 1) return fallback;
  return Math.min(n, 5000);
}

function resolveScenario(req: Request, mockDataPath: string): string {
  const q = req.query.scenario;
  if (typeof q === 'string' && q.trim()) return q.trim();
  const bodyScenario = req.body?.scenario;
  if (typeof bodyScenario === 'string' && bodyScenario.trim()) return bodyScenario.trim();
  return getCurrentScenario(mockDataPath);
}

function isAtlasEvent(value: unknown): value is AtlasEvent {
  if (!value || typeof value !== 'object') return false;
  const e = value as Record<string, unknown>;
  return e.kind === 'prefetch' || e.kind === 'presentation';
}

function isUsageAnnotation(value: unknown): value is AtlasUsageAnnotation {
  if (!value || typeof value !== 'object') return false;
  const a = value as Record<string, unknown>;
  return typeof a.requestId === 'string' && a.usage != null && typeof a.usage === 'object';
}

/** Auto-doc map (upserted structure — not the session log). */
router.get('/doc', (req: Request, res: Response) => {
  const { mockDataPath } = getDashboardContext(req);
  const scenario = resolveScenario(req, mockDataPath);
  const doc = getAtlasStore().getDoc(scenario);
  const summary = req.query.summary === '1' || req.query.summary === 'true';
  if (summary) {
    return res.json({
      scenario,
      ephemeral: true,
      summary: true,
      doc: summarizeAtlasDoc(doc),
    });
  }
  return res.json({ scenario, ephemeral: true, doc });
});

/** Clear auto-doc map for a scenario (does not clear session event log). */
router.delete('/doc', (req: Request, res: Response) => {
  const { mockDataPath } = getDashboardContext(req);
  const scenario = resolveScenario(req, mockDataPath);
  getAtlasStore().clearDoc(scenario);
  return res.json({ ok: true, scenario });
});

/** List atlas events (prefetch + presentation). */
router.get('/events', (req: Request, res: Response) => {
  const { mockDataPath } = getDashboardContext(req);
  const scenario = resolveScenario(req, mockDataPath);
  const sessionId = typeof req.query.sessionId === 'string' ? req.query.sessionId : undefined;
  const clientId = typeof req.query.clientId === 'string' ? req.query.clientId : undefined;
  const kind =
    req.query.kind === 'prefetch' || req.query.kind === 'presentation'
      ? req.query.kind
      : undefined;
  const limit = parseLimit(req.query.limit, 500);

  const store = getAtlasStore();
  const { events, ephemeral } = store.list({ scenario, sessionId, clientId, kind, limit });
  return res.json({ scenario, ephemeral, events });
});

/** Append one atlas event (SDK POST) — also upserts auto-doc. */
router.post('/events', (req: Request, res: Response) => {
  const { mockDataPath } = getDashboardContext(req);
  const scenario = resolveScenario(req, mockDataPath);
  const incoming = (req.body?.event ?? req.body) as unknown;

  if (!isAtlasEvent(incoming)) {
    return res.status(400).json({
      error: 'Request body must include an atlas event with kind "prefetch" or "presentation"',
    });
  }

  if (incoming.kind === 'prefetch') {
    if (!incoming.datasourceId || !incoming.requestId) {
      return res.status(400).json({ error: 'prefetch events require datasourceId and requestId' });
    }
  }
  if (incoming.kind === 'presentation') {
    if (!incoming.cms || typeof incoming.cms !== 'object') {
      return res.status(400).json({ error: 'presentation events require cms' });
    }
  }

  const store = getAtlasStore();
  const saved = store.append(scenario, {
    ...incoming,
    scenario: incoming.scenario || scenario,
  });
  return res.status(201).json({ ok: true, event: saved, doc: store.getDoc(scenario) });
});

/** Append usage annotation (SDK POST) — upserts screens into auto-doc. */
router.post('/usage', (req: Request, res: Response) => {
  const { mockDataPath } = getDashboardContext(req);
  const scenario = resolveScenario(req, mockDataPath);
  const incoming = (req.body?.annotation ?? req.body) as unknown;
  if (!isUsageAnnotation(incoming)) {
    return res.status(400).json({ error: 'Request body must include annotation with requestId and usage' });
  }
  const store = getAtlasStore();
  const saved = store.appendUsage(scenario, {
    ...incoming,
    scenario: incoming.scenario || scenario,
  });
  return res.status(201).json({ ok: true, annotation: saved, doc: store.getDoc(scenario) });
});

router.get('/usage', (req: Request, res: Response) => {
  const { mockDataPath } = getDashboardContext(req);
  const scenario = resolveScenario(req, mockDataPath);
  const usage = getAtlasStore().listUsage(scenario);
  return res.json({ scenario, usage });
});

/** Clear atlas events for a scenario (optional sessionId). Does not clear auto-doc. */
router.delete('/events', (req: Request, res: Response) => {
  const { mockDataPath } = getDashboardContext(req);
  const scenario = resolveScenario(req, mockDataPath);
  const sessionId = typeof req.query.sessionId === 'string' ? req.query.sessionId : undefined;
  const store = getAtlasStore();
  const removed = store.clear({ scenario, sessionId });
  return res.json({ ok: true, removed, scenario, sessionId: sessionId ?? null });
});

/** List session ids for a scenario. */
router.get('/sessions', (req: Request, res: Response) => {
  const { mockDataPath } = getDashboardContext(req);
  const scenario = resolveScenario(req, mockDataPath);
  const store = getAtlasStore();
  const sessions = store.listSessions(scenario);
  return res.json({ scenario, sessions });
});

/**
 * CMS tree for a session (presentation events nested by parentId).
 * Query: sessionId (required).
 */
router.get('/tree', (req: Request, res: Response) => {
  const { mockDataPath } = getDashboardContext(req);
  const scenario = resolveScenario(req, mockDataPath);
  const sessionId = typeof req.query.sessionId === 'string' ? req.query.sessionId.trim() : '';
  if (!sessionId) {
    return res.status(400).json({ error: 'sessionId is required' });
  }

  const store = getAtlasStore();
  const tree = store.getTree(scenario, sessionId);
  const { events } = store.list({ scenario, sessionId, limit: 5000 });
  const prefetches = events.filter(isAtlasPrefetchEvent);

  return res.json({
    scenario,
    sessionId,
    tree,
    prefetches,
    presentationCount: events.length - prefetches.length,
    prefetchCount: prefetches.length,
  });
});

/**
 * Atlas HTML generate status under mock-data/atlas-html
 * (index.html, atlas.har, atlas-events.json, bodies-search.json).
 */
router.get('/generated', (req: Request, res: Response) => {
  const { mockDataPath } = getDashboardContext(req);
  return res.json(getAtlasGeneratedStatus(mockDataPath));
});

/** Slim hop list from atlas-events.json (+ which hops have body-search text). */
router.get('/generated/hops', (req: Request, res: Response) => {
  const { mockDataPath } = getDashboardContext(req);
  const limit = parseLimit(req.query.limit, 200);
  const onlyWithBodies =
    req.query.onlyWithBodies === '1' || req.query.onlyWithBodies === 'true';
  return res.json(listAtlasGeneratedHops(mockDataPath, { limit, onlyWithBodies }));
});

/**
 * Search bodies-search.json from Atlas generate (full-ish payloads when capture/spill ran).
 * Query: q (required), limit (default 25).
 */
router.get('/generated/bodies/search', (req: Request, res: Response) => {
  const { mockDataPath } = getDashboardContext(req);
  const q = typeof req.query.q === 'string' ? req.query.q : '';
  if (!q.trim()) {
    return res.status(400).json({ error: 'q query parameter is required' });
  }
  const limit = parseLimit(req.query.limit, 25);
  const includeHop = req.query.includeHop !== '0' && req.query.includeHop !== 'false';
  return res.json(searchAtlasGeneratedBodies(mockDataPath, q, { limit, includeHop }));
});

/**
 * Full body search text (+ spill files when present) for one generated hop id.
 * Query: maxChars (default 32000).
 */
router.get('/generated/bodies/:eventId', (req: Request, res: Response) => {
  const { mockDataPath } = getDashboardContext(req);
  const eventId = String(req.params.eventId ?? '').trim();
  if (!eventId) {
    return res.status(400).json({ error: 'eventId is required' });
  }
  const maxCharsRaw = Number.parseInt(String(req.query.maxChars ?? ''), 10);
  const maxChars = Number.isFinite(maxCharsRaw) ? maxCharsRaw : undefined;
  const result = getAtlasGeneratedHopBody(mockDataPath, eventId, { maxChars });
  if (!result.exists) {
    return res.status(404).json(result);
  }
  if (!result.found) {
    return res.status(404).json(result);
  }
  return res.json(result);
});

export { router as atlasRouter };
