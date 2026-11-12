/**
 * Test dashboard proxy URL-aware recordResponses matching.
 * Verifies that when recordResponses is an array of patterns, the dashboard
 * proxy correctly resolves it to boolean based on URL matching.
 */

import { buildDashboardProxyEnvelope } from '../packages/mockifyer-core/src/utils/dashboard-proxy-envelope';

describe('Dashboard proxy recordResponses URL-aware matching', () => {
  it('resolves true for matching hostname pattern', () => {
    const envelope = buildDashboardProxyEnvelope({
      url: 'https://api.example.com/users',
      method: 'GET',
      lane: undefined,
      deviceId: undefined,
      requestId: '123',
      parentRequestId: undefined,
      headers: {},
      body: undefined,
      scenario: undefined,
      recordOnMiss: undefined,
      recordResponses: ['api.example.com'],
      strictLaneScenario: false,
      upstreamTlsInsecure: false,
    });

    expect(envelope.recordResponses).toBe(true);
  });

  it('resolves false for non-matching hostname pattern', () => {
    const envelope = buildDashboardProxyEnvelope({
      url: 'https://other.example.com/users',
      method: 'GET',
      lane: undefined,
      deviceId: undefined,
      requestId: '123',
      parentRequestId: undefined,
      headers: {},
      body: undefined,
      scenario: undefined,
      recordOnMiss: undefined,
      recordResponses: ['api.example.com'],
      strictLaneScenario: false,
      upstreamTlsInsecure: false,
    });

    expect(envelope.recordResponses).toBe(false);
  });

  it('resolves true for matching wildcard subdomain', () => {
    const envelope = buildDashboardProxyEnvelope({
      url: 'https://sub.api.example.com/users',
      method: 'GET',
      lane: undefined,
      deviceId: undefined,
      requestId: '123',
      parentRequestId: undefined,
      headers: {},
      body: undefined,
      scenario: undefined,
      recordOnMiss: undefined,
      recordResponses: ['*.api.example.com'],
      strictLaneScenario: false,
      upstreamTlsInsecure: false,
    });

    expect(envelope.recordResponses).toBe(true);
  });

  it('resolves true for matching host+path glob', () => {
    const envelope = buildDashboardProxyEnvelope({
      url: 'https://api.example.com/v1/users',
      method: 'GET',
      lane: undefined,
      deviceId: undefined,
      requestId: '123',
      parentRequestId: undefined,
      headers: {},
      body: undefined,
      scenario: undefined,
      recordOnMiss: undefined,
      recordResponses: ['api.example.com/v1/*'],
      strictLaneScenario: false,
      upstreamTlsInsecure: false,
    });

    expect(envelope.recordResponses).toBe(true);
  });

  it('resolves false for non-matching path', () => {
    const envelope = buildDashboardProxyEnvelope({
      url: 'https://api.example.com/v2/users',
      method: 'GET',
      lane: undefined,
      deviceId: undefined,
      requestId: '123',
      parentRequestId: undefined,
      headers: {},
      body: undefined,
      scenario: undefined,
      recordOnMiss: undefined,
      recordResponses: ['api.example.com/v1/*'],
      strictLaneScenario: false,
      upstreamTlsInsecure: false,
    });

    expect(envelope.recordResponses).toBe(false);
  });

  it('resolves true for matching RegExp pattern', () => {
    const envelope = buildDashboardProxyEnvelope({
      url: 'https://api.example.com/users/123',
      method: 'GET',
      lane: undefined,
      deviceId: undefined,
      requestId: '123',
      parentRequestId: undefined,
      headers: {},
      body: undefined,
      scenario: undefined,
      recordOnMiss: undefined,
      recordResponses: [/api\.example\.com\/users\/\d+/],
      strictLaneScenario: false,
      upstreamTlsInsecure: false,
    });

    expect(envelope.recordResponses).toBe(true);
  });

  it('passes through boolean true', () => {
    const envelope = buildDashboardProxyEnvelope({
      url: 'https://any.example.com/anything',
      method: 'GET',
      lane: undefined,
      deviceId: undefined,
      requestId: '123',
      parentRequestId: undefined,
      headers: {},
      body: undefined,
      scenario: undefined,
      recordOnMiss: undefined,
      recordResponses: true,
      strictLaneScenario: false,
      upstreamTlsInsecure: false,
    });

    expect(envelope.recordResponses).toBe(true);
  });

  it('passes through boolean false', () => {
    const envelope = buildDashboardProxyEnvelope({
      url: 'https://any.example.com/anything',
      method: 'GET',
      lane: undefined,
      deviceId: undefined,
      requestId: '123',
      parentRequestId: undefined,
      headers: {},
      body: undefined,
      scenario: undefined,
      recordOnMiss: undefined,
      recordResponses: false,
      strictLaneScenario: false,
      upstreamTlsInsecure: false,
    });

    expect(envelope.recordResponses).toBe(false);
  });

  it('resolves false when empty array (no patterns match)', () => {
    const envelope = buildDashboardProxyEnvelope({
      url: 'https://any.example.com/anything',
      method: 'GET',
      lane: undefined,
      deviceId: undefined,
      requestId: '123',
      parentRequestId: undefined,
      headers: {},
      body: undefined,
      scenario: undefined,
      recordOnMiss: undefined,
      recordResponses: [],
      strictLaneScenario: false,
      upstreamTlsInsecure: false,
    });

    expect(envelope.recordResponses).toBe(false);
  });
});
