import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { setupMockifyer } from '@sgedda/mockifyer-axios';
import { resetDateManipulation } from '@sgedda/mockifyer-core';
import type { MockData } from '@sgedda/mockifyer-core';

describe('axios live response date overrides', () => {
  let mockDataPath: string;
  let upstream: MockAdapter;

  beforeEach(() => {
    mockDataPath = fs.mkdtempSync(path.join(os.tmpdir(), 'mockifyer-axios-live-dates-'));
    upstream = new MockAdapter(axios.create());
  });

  afterEach(() => {
    upstream.restore();
    fs.rmSync(mockDataPath, { recursive: true, force: true });
    resetDateManipulation();
  });

  it('applies responseDateOverrides to passthrough axios responses in mock mode', async () => {
    const url = 'https://api.example.test/subscription';
    const axiosInstance = axios.create();
    upstream = new MockAdapter(axiosInstance);
    upstream.onGet(url).reply(200, {
      plan: 'pro',
      trialEndsAt: '2000-01-01T00:00:00.000Z',
    });

    const scenarioPath = path.join(mockDataPath, 'default');
    fs.mkdirSync(scenarioPath, { recursive: true });

    const passthroughMock: MockData = {
      request: {
        method: 'GET',
        url,
        headers: {},
      },
      response: {
        status: 200,
        data: {
          plan: 'recorded',
          trialEndsAt: '1999-01-01T00:00:00.000Z',
        },
        headers: {},
      },
      timestamp: '2024-01-01T00:00:00.000Z',
      alwaysUseRealApi: true,
      responseDateOverrides: [
        {
          path: 'trialEndsAt',
          offsetDays: 7,
        },
      ],
    };

    fs.writeFileSync(path.join(scenarioPath, 'subscription.json'), JSON.stringify(passthroughMock, null, 2));

    const client = setupMockifyer({
      mockDataPath,
      recordMode: false,
      axiosInstance,
      dateManipulation: {
        fixedDate: '2026-01-15T09:30:00.000Z',
      },
    });

    const response = await client.get(url);

    expect(response.status).toBe(200);
    expect(response.data).toEqual({
      plan: 'pro',
      trialEndsAt: '2026-01-22T09:30:00.000Z',
    });
  });
});
