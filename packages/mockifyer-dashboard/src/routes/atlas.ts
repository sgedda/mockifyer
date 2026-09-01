import express, { Request, Response } from 'express';
import { getCurrentScenario, type AtlasEvent, type AtlasUsageAnnotation } from '@sgedda/mockifyer-core';
import { getDashboardContext } from '../utils/dashboard-context';
import { getAtlasStore, isAtlasPrefetchEvent } from '../utils/atlas-store';

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

export { router as atlasRouter };
