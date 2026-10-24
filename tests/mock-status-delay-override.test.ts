import type { MockData } from '@sgedda/mockifyer-core';

describe('Mock Status Override and Delay Types', () => {
  it('MockData type includes statusOverride field', () => {
    const mockData: MockData = {
      request: {
        method: 'GET',
        url: 'https://api.example.com/test',
        headers: {},
      },
      response: {
        status: 200,
        data: { message: 'success' },
        headers: {},
      },
      timestamp: new Date().toISOString(),
      statusOverride: 500,
    };

    expect(mockData.statusOverride).toBe(500);
    expect(mockData.response.status).toBe(200);
  });

  it('MockData type includes responseDelayMs field', () => {
    const mockData: MockData = {
      request: {
        method: 'GET',
        url: 'https://api.example.com/test',
        headers: {},
      },
      response: {
        status: 200,
        data: { message: 'success' },
        headers: {},
      },
      timestamp: new Date().toISOString(),
      responseDelayMs: 1000,
    };

    expect(mockData.responseDelayMs).toBe(1000);
  });

  it('MockData type allows both statusOverride and responseDelayMs', () => {
    const mockData: MockData = {
      request: {
        method: 'GET',
        url: 'https://api.example.com/test',
        headers: {},
      },
      response: {
        status: 200,
        data: { message: 'success' },
        headers: {},
      },
      timestamp: new Date().toISOString(),
      statusOverride: 429,
      responseDelayMs: 2000,
    };

    expect(mockData.statusOverride).toBe(429);
    expect(mockData.responseDelayMs).toBe(2000);
  });

  it('MockData type allows fields to be optional', () => {
    const mockData: MockData = {
      request: {
        method: 'GET',
        url: 'https://api.example.com/test',
        headers: {},
      },
      response: {
        status: 200,
        data: { message: 'success' },
        headers: {},
      },
      timestamp: new Date().toISOString(),
    };

    expect(mockData.statusOverride).toBeUndefined();
    expect(mockData.responseDelayMs).toBeUndefined();
  });
});
