import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { setupMockifyer } from '@sgedda/mockifyer-axios';
import {
  MOCKIFYER_TRACE_DATA_KEY,
  MOCKIFYER_TRACE_RESPONSE_KEY,
  buildInlineRequestTrace,
  runWithMockifyerHopContext,
  type MockifyerHopContext,
} from '@sgedda/mockifyer-core';

describe('axios recordMode=false inline-trace unwrap', () => {
  let mockDataPath: string;
  let upstream: MockAdapter;

  beforeEach(() => {
    mockDataPath = fs.mkdtempSync(path.join(os.tmpdir(), 'mockifyer-axios-inline-unwrap-'));
    fs.mkdirSync(path.join(mockDataPath, 'default'), { recursive: true });
  });

  afterEach(() => {
    upstream?.restore();
    fs.rmSync(mockDataPath, { recursive: true, force: true });
  });

  it('unwraps nested mockifyerTrace on real upstream responses without matchedMock', async () => {
    const url = 'https://api.example.test/member/profile';
    const axiosInstance = axios.create();
    upstream = new MockAdapter(axiosInstance);

    const nestedEnvelope = {
      [MOCKIFYER_TRACE_DATA_KEY]: ['user-1', 'Ada'],
      [MOCKIFYER_TRACE_RESPONSE_KEY]: {
        requestId: 'member-root',
        hopCount: 1,
        incomplete: false,
        hops: [
          {
            index: 0,
            requestId: 'hop-db',
            parentRequestId: 'member-root',
            timestamp: '2026-01-01T00:00:00.000Z',
            method: 'GET',
            url: 'https://db.example/users/1',
            status: 200,
            source: 'upstream',
            transport: 'axios',
          },
        ],
      },
    };

    upstream.onGet(url).reply(200, nestedEnvelope);

    const client = setupMockifyer({
      mockDataPath,
      recordMode: false,
      failOnMissingMock: false,
      axiosInstance,
    });

    const ctx: MockifyerHopContext = {
      correlation: { requestId: 'graphql-root' },
      includeInlineTrace: true,
      includeInlineTraceBodies: false,
      inlineHops: [],
    };

    const response = await runWithMockifyerHopContext(ctx, () => client.get(url));

    expect(response.status).toBe(200);
    expect(response.data).toEqual(['user-1', 'Ada']);
    expect(response.data).not.toHaveProperty(MOCKIFYER_TRACE_RESPONSE_KEY);

    const trace = buildInlineRequestTrace(ctx);
    expect(trace).not.toBeNull();
    expect(trace!.hops.map((h) => h.url)).toEqual([
      url,
      'https://db.example/users/1',
    ]);
  });

  it('includes responseBodyPreview when includeInlineTraceBodies is on', async () => {
    const url = 'https://api.example.test/member/with-bodies';
    const axiosInstance = axios.create();
    upstream = new MockAdapter(axiosInstance);

    const nestedEnvelope = {
      [MOCKIFYER_TRACE_DATA_KEY]: 'user-2-admin',
      [MOCKIFYER_TRACE_RESPONSE_KEY]: {
        requestId: 'member-root',
        hopCount: 1,
        incomplete: false,
        hops: [
          {
            index: 0,
            requestId: 'hop-db',
            parentRequestId: 'member-root',
            timestamp: '2026-01-01T00:00:00.000Z',
            method: 'GET',
            url: 'https://db.example/users/2',
            status: 200,
            source: 'upstream',
            transport: 'axios',
            responseBodyPreview: '{"row":1}',
          },
        ],
      },
    };

    upstream.onGet(url).reply(200, nestedEnvelope);

    const client = setupMockifyer({
      mockDataPath,
      recordMode: false,
      failOnMissingMock: false,
      axiosInstance,
    });

    const ctx: MockifyerHopContext = {
      correlation: { requestId: 'graphql-root' },
      includeInlineTrace: true,
      includeInlineTraceBodies: true,
      inlineHops: [],
    };

    const response = await runWithMockifyerHopContext(ctx, () => client.get(url));

    expect(response.data).toEqual('user-2-admin');

    const trace = buildInlineRequestTrace(ctx);
    expect(trace).not.toBeNull();
    expect(trace!.hops[0].responseBodyPreview).toContain('user-2');
    expect(trace!.hops[0].responseBodyPreview).not.toContain('mockifyerTrace');
    expect(trace!.hops[1].responseBodyPreview).toBe('{"row":1}');
  });

  it('unwraps envelopes even when parent is not collecting inline trace', async () => {
    const url = 'https://api.example.test/member/plain';
    const axiosInstance = axios.create();
    upstream = new MockAdapter(axiosInstance);

    const envelope = {
      [MOCKIFYER_TRACE_DATA_KEY]: 'ok',
      [MOCKIFYER_TRACE_RESPONSE_KEY]: {
        requestId: 'x',
        hopCount: 0,
        incomplete: false,
        hops: [],
      },
    };

    upstream.onGet(url).reply(200, envelope);

    const client = setupMockifyer({
      mockDataPath,
      recordMode: false,
      failOnMissingMock: false,
      axiosInstance,
    });

    const response = await client.get(url);

    expect(response.data).toEqual('ok');
  });

  it('records underlying hops when activationMode is client_id_header and the inbound lane opted in', async () => {
    const url = 'https://downstream.example/items';
    const axiosInstance = axios.create();
    upstream = new MockAdapter(axiosInstance);
    upstream.onGet(url).reply(200, { items: [{ id: 1 }] });

    const client = setupMockifyer({
      mockDataPath,
      recordMode: false,
      failOnMissingMock: false,
      activationMode: 'client_id_header',
      axiosInstance,
      networkLog: { captureBodies: false },
    });

    const ctx: MockifyerHopContext = {
      inboundClientId: 'lane-from-caller',
      correlation: { requestId: 'bff-root' },
      includeInlineTrace: true,
      includeInlineTraceBodies: true,
      inlineHops: [],
    };

    const response = await runWithMockifyerHopContext(ctx, () => client.get(url));

    expect(response.data).toEqual({ items: [{ id: 1 }] });
    const trace = buildInlineRequestTrace(ctx);
    expect(trace).not.toBeNull();
    expect(trace!.hops.map((hop) => hop.url)).toEqual([url]);
    expect(trace!.hops[0].responseBodyPreview).toContain('items');
    expect(trace!.hops[0].parentRequestId).toBe('bff-root');
  });

  it('skips tracing for client_id_header when include-trace is off even with an inbound lane', async () => {
    const url = 'https://downstream.example/auth-token';
    const axiosInstance = axios.create();
    upstream = new MockAdapter(axiosInstance);
    const liveBody = { authToken: { jwtToken: 'live-token' } };
    upstream.onGet(url).reply(200, liveBody);

    const client = setupMockifyer({
      mockDataPath,
      recordMode: false,
      failOnMissingMock: false,
      activationMode: 'client_id_header',
      axiosInstance,
      networkLog: { captureBodies: false },
    });

    const ctx: MockifyerHopContext = {
      inboundClientId: 'lane-from-caller',
      correlation: { requestId: 'bff-root' },
      includeInlineTrace: false,
      inlineHops: [],
    };

    const response = await runWithMockifyerHopContext(ctx, () => client.get(url));

    expect(response.data).toEqual(liveBody);
    expect(buildInlineRequestTrace(ctx)).toBeNull();
  });

  it('skips underlying hops for client_id_header when no inbound lane or header is present', async () => {
    const url = 'https://downstream.example/skipped';
    const axiosInstance = axios.create();
    upstream = new MockAdapter(axiosInstance);
    upstream.onGet(url).reply(200, { items: [] });

    const client = setupMockifyer({
      mockDataPath,
      recordMode: false,
      failOnMissingMock: false,
      activationMode: 'client_id_header',
      axiosInstance,
    });

    const ctx: MockifyerHopContext = {
      correlation: { requestId: 'bff-root' },
      includeInlineTrace: true,
      includeInlineTraceBodies: true,
      inlineHops: [],
    };

    const response = await runWithMockifyerHopContext(ctx, () => client.get(url));

    expect(response.data).toEqual({ items: [] });
    expect(buildInlineRequestTrace(ctx)?.hops ?? []).toEqual([]);
  });
});
