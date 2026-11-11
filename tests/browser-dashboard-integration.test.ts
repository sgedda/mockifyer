/**
 * Integration test: browser client connects to dashboard.
 * Tests that browser clients can report traffic and appear in Client Connections.
 */

import type { Server } from 'http';
import { createServer } from '../packages/mockifyer-dashboard/src/server';
import { BrowserDashboardClient } from '../packages/mockifyer-core/src/utils/dashboard-client.browser';
import path from 'path';
import fs from 'fs';
import os from 'os';

describe('Browser Dashboard Integration', () => {
  let app: any;
  let server: Server;
  let mockDataPath: string;
  const port = 13002; // Use a different port to avoid conflicts
  const dashboardUrl = `http://localhost:${port}`;

  beforeAll((done) => {
    // Create a temporary mock-data directory
    mockDataPath = path.join(os.tmpdir(), `mockifyer-browser-integration-${Date.now()}`);
    fs.mkdirSync(mockDataPath, { recursive: true });
    fs.mkdirSync(path.join(mockDataPath, 'default'), { recursive: true });

    // Create a basic scenario-config.json
    fs.writeFileSync(
      path.join(mockDataPath, 'scenario-config.json'),
      JSON.stringify({ activeScenario: 'default' })
    );

    // Create the dashboard app with sqlite provider for client lanes
    const publicDir = path.join(__dirname, '../packages/mockifyer-dashboard/public');
    app = createServer(publicDir, mockDataPath, {
      provider: 'sqlite',
    });

    // Set CORS to allow all origins
    process.env.MOCKIFYER_DASHBOARD_CORS = '*';

    server = app.listen(port, () => {
      console.log(`Test dashboard started on port ${port}`);
      done();
    });
  });

  afterAll((done) => {
    server.close(() => {
      // Cleanup
      fs.rmSync(mockDataPath, { recursive: true, force: true });
      delete process.env.MOCKIFYER_DASHBOARD_CORS;
      done();
    });
  });

  it('browser client can connect and check health', async () => {
    const client = new BrowserDashboardClient({
      dashboardBaseUrl: dashboardUrl,
      clientId: 'browser-test-client',
    });

    const healthy = await client.health();
    expect(healthy).toBe(true);
  });

  it('browser client can fetch scenario config', async () => {
    const client = new BrowserDashboardClient({
      dashboardBaseUrl: dashboardUrl,
      clientId: 'browser-test-client',
    });

    const config = await client.getScenarioConfig();
    // Sqlite provider may use _scratch as default
    expect(config.currentScenario).toBeTruthy();
    expect(typeof config.currentScenario).toBe('string');
  });

  it('browser client can post network event', async () => {
    const client = new BrowserDashboardClient({
      dashboardBaseUrl: dashboardUrl,
      clientId: 'browser-test-client',
    });

    // Post a network event
    await client.postNetworkEvent({
      transport: 'fetch',
      method: 'GET',
      url: 'https://api.example.com/data',
      source: 'mock-hit',
      status: 200,
      clientId: 'browser-test-client',
    });

    // Give it a moment to process
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Verify the event was recorded by fetching network events
    const response = await fetch(`${dashboardUrl}/api/network-events?clientId=browser-test-client`);
    expect(response.ok).toBe(true);

    const data = (await response.json()) as {
      events: Array<{ clientId?: string; url?: string }>;
    };
    expect(data.events).toBeDefined();
    expect(data.events.length).toBeGreaterThan(0);
    expect(data.events.some((e) => e.clientId === 'browser-test-client')).toBe(true);
  });

  it('browser client traffic is recorded in network events', async () => {
    const clientId = `browser-traffic-${Date.now()}`;
    const client = new BrowserDashboardClient({
      dashboardBaseUrl: dashboardUrl,
      clientId,
    });

    // Post a network event with the client ID
    await client.postNetworkEvent({
      transport: 'fetch',
      method: 'GET',
      url: 'https://api.example.com/test',
      source: 'mock-hit',
      status: 200,
      clientId,
    });

    // Give it time to be persisted
    await new Promise((resolve) => setTimeout(resolve, 300));

    // Fetch network events for this client
    const response = await fetch(`${dashboardUrl}/api/network-events?clientId=${encodeURIComponent(clientId)}`);
    expect(response.ok).toBe(true);

    const data = (await response.json()) as {
      events: Array<{ clientId?: string; url?: string }>;
    };
    
    // Verify the client's traffic was recorded
    expect(data.events).toBeDefined();
    const clientEvent = data.events.find(e => e.clientId === clientId);
    expect(clientEvent).toBeDefined();
    expect(clientEvent?.url).toBe('https://api.example.com/test');
  });

  it('browser client can switch scenarios', async () => {
    const client = new BrowserDashboardClient({
      dashboardBaseUrl: dashboardUrl,
      clientId: 'scenario-switch-test',
    });

    // Create a new scenario
    const response = await fetch(`${dashboardUrl}/api/scenario-config/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scenario: 'test-scenario', deriveFrom: 'default' }),
    });
    expect(response.ok).toBe(true);

    // Set scenario for the client lane
    await client.setClientLaneScenario('scenario-switch-test', 'test-scenario');

    // Verify the scenario was set
    const lanes = await client.getClientLanes();
    const lane = lanes.lanes.find((l) => l.clientId === 'scenario-switch-test');
    expect(lane?.scenario).toBe('test-scenario');
  });

  it('browser client follows scenario changes via polling', async () => {
    const client = new BrowserDashboardClient({
      dashboardBaseUrl: dashboardUrl,
      clientId: 'polling-test',
    });

    // Set up a lane with a scenario
    await client.setClientLaneScenario('polling-test', 'default');

    // Poll for scenario
    let scenario = await client.pollClientLaneScenario('polling-test');
    expect(scenario).toBe('default');

    // Change scenario
    await client.setClientLaneScenario('polling-test', 'test-scenario');

    // Poll again - should see the new scenario
    scenario = await client.pollClientLaneScenario('polling-test');
    expect(scenario).toBe('test-scenario');
  });
});
