import {
  getOutboundMockifyerClientIdHeader,
  getOutboundMockifyerDeviceIdHeader,
  resolveActivationMode,
  shouldApplyMockifyer,
  type MockifyerConfig,
} from '@sgedda/mockifyer-core';
import { setupMockifyer } from '@sgedda/mockifyer-fetch';
import fs from 'fs';
import os from 'os';
import path from 'path';

describe('activation-mode', () => {
  const baseConfig: MockifyerConfig = {
    mockDataPath: './mock-data',
    recordMode: false,
  };

  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.MOCKIFYER_ACTIVATION_MODE;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('resolveActivationMode defaults to always', () => {
    expect(resolveActivationMode({})).toBe('always');
    expect(resolveActivationMode({ activationMode: undefined })).toBe('always');
  });

  it('resolveActivationMode uses config when env unset', () => {
    expect(resolveActivationMode({ ...baseConfig, activationMode: 'off' })).toBe('off');
    expect(resolveActivationMode({ ...baseConfig, activationMode: 'client_id_header' })).toBe(
      'client_id_header'
    );
  });

  it('resolveActivationMode env wins over config', () => {
    process.env.MOCKIFYER_ACTIVATION_MODE = 'off';
    expect(resolveActivationMode({ ...baseConfig, activationMode: 'always' })).toBe('off');
  });

  it('getOutboundMockifyerClientIdHeader is case-insensitive on plain object', () => {
    expect(getOutboundMockifyerClientIdHeader({ 'X-Mockifyer-Client-Id': ' lane-a ' })).toBe('lane-a');
    expect(getOutboundMockifyerClientIdHeader({ 'x-mockifyer-client-id': '' })).toBeUndefined();
  });

  it('getOutboundMockifyerDeviceIdHeader reads plain object and Headers', () => {
    expect(getOutboundMockifyerDeviceIdHeader({ 'X-Mockifyer-Device-Id': ' dev-1 ' })).toBe('dev-1');
    expect(getOutboundMockifyerDeviceIdHeader({ 'x-mockifyer-device-id': '' })).toBeUndefined();
    const h = new Headers();
    h.set('x-mockifyer-device-id', 'ulid-xyz');
    expect(getOutboundMockifyerDeviceIdHeader(h)).toBe('ulid-xyz');
  });

  it('shouldApplyMockifyer client_id_header requires header or proxy lane', () => {
    expect(shouldApplyMockifyer('client_id_header', {})).toBe(false);
    expect(shouldApplyMockifyer('client_id_header', { 'x-mockifyer-client-id': 'x' })).toBe(true);
    expect(
      shouldApplyMockifyer('client_id_header', {}, {
        useProxyLane: { proxyBaseUrl: 'http://localhost:3002', resolvedClientId: 'rn-lane' },
      })
    ).toBe(true);
    expect(
      shouldApplyMockifyer('client_id_header', {}, {
        useProxyLane: { proxyBaseUrl: 'http://localhost:3002', resolvedClientId: '   ' },
      })
    ).toBe(false);
  });

  it('shouldApplyMockifyer always and off', () => {
    expect(shouldApplyMockifyer('always', {})).toBe(true);
    expect(shouldApplyMockifyer('off', { 'x-mockifyer-client-id': 'x' })).toBe(false);
  });

  it('does not route through the dashboard proxy when activation mode is off', async () => {
    const mockDataPath = fs.mkdtempSync(path.join(os.tmpdir(), 'mockifyer-activation-'));
    const originalFetch = global.fetch;
    delete (global as any).__mockifyer_original_fetch;

    const fetchMock = jest.fn().mockResolvedValue({
      status: 204,
      statusText: 'No Content',
      headers: new Headers(),
      text: async () => '',
    } as Response);
    global.fetch = fetchMock as unknown as typeof fetch;

    try {
      const client = setupMockifyer({
        mockDataPath,
        recordMode: false,
        activationMode: 'off',
        useGlobalFetch: false,
        proxy: {
          baseUrl: 'http://dashboard.local/mockifyer',
        },
      });

      const response = await client.get('https://api.example.com/items');

      expect(response.status).toBe(204);
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(fetchMock.mock.calls[0][0]).toBe('https://api.example.com/items');
      expect(fetchMock.mock.calls[0][1]?.method).toBe('GET');
    } finally {
      global.fetch = originalFetch;
      delete (global as any).__mockifyer_original_fetch;
      fs.rmSync(mockDataPath, { recursive: true, force: true });
    }
  });
});
