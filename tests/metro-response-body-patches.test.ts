import { EventEmitter } from 'events';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  getMetroNetworkEventBuffer,
  METRO_RESPONSE_BODY_PATCHES_PATH,
  resetMetroNetworkEventBuffer,
} from '@sgedda/mockifyer-core';
import { createMockSyncMiddleware } from '../packages/mockifyer-fetch/src/metro-sync-middleware';

interface FakeResponse {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
  setHeader(name: string, value: string): void;
  end(chunk?: string): void;
}

function fakeResponse(onEnd: () => void): FakeResponse {
  return {
    statusCode: 200,
    headers: {},
    body: '',
    setHeader(name, value) {
      this.headers[name.toLowerCase()] = value;
    },
    end(chunk) {
      this.body = chunk ?? '';
      onEnd();
    },
  };
}

async function post(
  middleware: ReturnType<typeof createMockSyncMiddleware>,
  url: string,
  payload: unknown
): Promise<FakeResponse> {
  const req = Object.assign(new EventEmitter(), { url, method: 'POST', headers: {} });
  let res!: FakeResponse;
  const done = new Promise<void>((resolve) => {
    res = fakeResponse(resolve);
  });
  middleware(req, res, () => undefined);
  req.emit('data', Buffer.from(JSON.stringify(payload)));
  req.emit('end');
  await done;
  return res;
}

describe('Metro POST response-bodies', () => {
  let projectRoot: string;

  beforeEach(() => {
    resetMetroNetworkEventBuffer();
    projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'mockifyer-metro-patches-'));
  });

  afterEach(() => {
    resetMetroNetworkEventBuffer();
    fs.rmSync(projectRoot, { recursive: true, force: true });
  });

  it('fills response bodies on buffered hops and skips unknown ids', async () => {
    const buffer = getMetroNetworkEventBuffer();
    buffer.append({
      id: 'hop-1',
      requestId: 'req-1',
      timestamp: '2026-09-28T08:00:00.000Z',
      scenario: 'default',
      transport: 'fetch',
      method: 'POST',
      url: 'https://api.example.com/graphql',
      source: 'upstream',
    });
    const patchesSeen = jest.fn();
    buffer.subscribePatches(patchesSeen);
    const middleware = createMockSyncMiddleware({ projectRoot, atlasKey: false, dashboardKey: false });

    const res = await post(middleware, METRO_RESPONSE_BODY_PATCHES_PATH, {
      patches: [
        { id: 'hop-1', requestId: 'req-1', responseBodyPreview: '{"users":[]}' },
        { id: 'gone', responseBodyPreview: '{}' },
        { nope: true },
      ],
    });

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toEqual({ success: true, patched: 1, ignored: 1 });
    expect(buffer.list()[0].responseBodyPreview).toBe('{"users":[]}');
    expect(patchesSeen).toHaveBeenCalledTimes(1);
  });

  it('rejects invalid JSON', async () => {
    const middleware = createMockSyncMiddleware({ projectRoot, atlasKey: false, dashboardKey: false });
    const req = Object.assign(new EventEmitter(), {
      url: METRO_RESPONSE_BODY_PATCHES_PATH,
      method: 'POST',
      headers: {},
    });
    let res!: FakeResponse;
    const done = new Promise<void>((resolve) => {
      res = fakeResponse(resolve);
    });
    middleware(req, res, () => undefined);
    req.emit('data', Buffer.from('{not json'));
    req.emit('end');
    await done;
    expect(res.statusCode).toBe(400);
  });
});
