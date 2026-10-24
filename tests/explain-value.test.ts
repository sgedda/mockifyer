import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import fs from 'fs';
import path from 'path';
import { explainValue } from '../packages/mockifyer-dashboard/src/utils/explain-value';
import type { DashboardConfig } from '../packages/mockifyer-dashboard/src/utils/dashboard-context';
import type { MockData } from '../packages/mockifyer-core/src/types';

const TEST_MOCK_DATA_PATH = path.join(__dirname, 'fixtures', 'explain-value-test');
const TEST_SCENARIO = 'test-scenario';

describe('explainValue', () => {
  beforeEach(() => {
    const scenarioPath = path.join(TEST_MOCK_DATA_PATH, TEST_SCENARIO);
    if (!fs.existsSync(scenarioPath)) {
      fs.mkdirSync(scenarioPath, { recursive: true });
    }
  });

  afterEach(() => {
    if (fs.existsSync(TEST_MOCK_DATA_PATH)) {
      fs.rmSync(TEST_MOCK_DATA_PATH, { recursive: true, force: true });
    }
  });

  it('should find mock by URL and extract field overrides', async () => {
    const mockData: MockData = {
      url: 'https://api.example.com/weather?city=new-york',
      method: 'GET',
      status: 200,
      responseData: {
        temperature_2m: 20,
        humidity: 65,
        wind_speed: 10,
      },
      responseFieldOverrides: [
        {
          path: 'temperature_2m',
          value: -999,
        },
      ],
    };

    const mockFile = 'GET_api.example.com_weather_city_new-york.json';
    const scenarioPath = path.join(TEST_MOCK_DATA_PATH, TEST_SCENARIO);
    fs.writeFileSync(
      path.join(scenarioPath, mockFile),
      JSON.stringify(mockData, null, 2)
    );

    const config: DashboardConfig = { provider: 'filesystem' };

    const result = await explainValue(
      {
        scenario: TEST_SCENARIO,
        url: '/weather',
        fieldPath: 'temperature_2m',
      },
      config,
      TEST_MOCK_DATA_PATH
    );

    expect(result.scenario).toBe(TEST_SCENARIO);
    expect(result.origin.mockFile).toBe(mockFile);
    expect(result.modifications).toHaveLength(1);
    expect(result.modifications[0]).toMatchObject({
      type: 'field_override',
      path: 'temperature_2m',
      originalValue: 20,
      effectiveValue: -999,
    });
    expect(result.siblingFields).toMatchObject({
      temperature_2m: 20,
      humidity: 65,
      wind_speed: 10,
    });
  });

  it('should extract date overrides', async () => {
    const mockData: MockData = {
      url: 'https://api.example.com/trips',
      method: 'GET',
      status: 200,
      responseData: {
        trips: [
          {
            id: 'trip-1',
            departure: '2024-01-15T10:00:00Z',
            status: 'confirmed',
          },
        ],
      },
      responseDateOverrides: [
        {
          path: 'trips.0.departure',
          offsetDays: 7,
        },
      ],
    };

    const mockFile = 'GET_api.example.com_trips.json';
    const scenarioPath = path.join(TEST_MOCK_DATA_PATH, TEST_SCENARIO);
    fs.writeFileSync(
      path.join(scenarioPath, mockFile),
      JSON.stringify(mockData, null, 2)
    );

    const config: DashboardConfig = { provider: 'filesystem' };

    const result = await explainValue(
      {
        scenario: TEST_SCENARIO,
        url: '/trips',
        fieldPath: 'trips.0.departure',
      },
      config,
      TEST_MOCK_DATA_PATH
    );

    expect(result.modifications).toHaveLength(1);
    expect(result.modifications[0]).toMatchObject({
      type: 'date_override',
      path: 'trips.0.departure',
      details: {
        offsetDays: 7,
      },
    });
  });

  it('should report when mock not found', async () => {
    const config: DashboardConfig = { provider: 'filesystem' };

    const result = await explainValue(
      {
        scenario: TEST_SCENARIO,
        url: '/nonexistent',
      },
      config,
      TEST_MOCK_DATA_PATH
    );

    expect(result.notes).toContain('Mock file not found for the given request');
    expect(result.origin.mockFile).toBeUndefined();
    expect(result.modifications).toHaveLength(0);
  });

  it('should report when no modifications found', async () => {
    const mockData: MockData = {
      url: 'https://api.example.com/users',
      method: 'GET',
      status: 200,
      responseData: {
        users: [{ id: 1, name: 'Alice' }],
      },
    };

    const mockFile = 'GET_api.example.com_users.json';
    const scenarioPath = path.join(TEST_MOCK_DATA_PATH, TEST_SCENARIO);
    fs.writeFileSync(
      path.join(scenarioPath, mockFile),
      JSON.stringify(mockData, null, 2)
    );

    const config: DashboardConfig = { provider: 'filesystem' };

    const result = await explainValue(
      {
        scenario: TEST_SCENARIO,
        url: '/users',
      },
      config,
      TEST_MOCK_DATA_PATH
    );

    expect(result.notes).toContain('No field or date overrides found for this value');
    expect(result.modifications).toHaveLength(0);
  });

  it('should report passthrough mode', async () => {
    const mockData: MockData = {
      url: 'https://api.example.com/live',
      method: 'GET',
      status: 200,
      alwaysUseRealApi: true,
      responseData: {},
    };

    const mockFile = 'GET_api.example.com_live.json';
    const scenarioPath = path.join(TEST_MOCK_DATA_PATH, TEST_SCENARIO);
    fs.writeFileSync(
      path.join(scenarioPath, mockFile),
      JSON.stringify(mockData, null, 2)
    );

    const config: DashboardConfig = { provider: 'filesystem' };

    const result = await explainValue(
      {
        scenario: TEST_SCENARIO,
        url: '/live',
      },
      config,
      TEST_MOCK_DATA_PATH
    );

    expect(result.notes).toContain('Mock is set to always use real API (passthrough mode)');
  });

  it('should extract sibling fields at nested path', async () => {
    const mockData: MockData = {
      url: 'https://api.example.com/bookings',
      method: 'GET',
      status: 200,
      responseData: {
        bookings: [
          {
            id: 'booking-1',
            status: 'confirmed',
            price: 100,
            date: '2024-01-15',
          },
        ],
      },
    };

    const mockFile = 'GET_api.example.com_bookings.json';
    const scenarioPath = path.join(TEST_MOCK_DATA_PATH, TEST_SCENARIO);
    fs.writeFileSync(
      path.join(scenarioPath, mockFile),
      JSON.stringify(mockData, null, 2)
    );

    const config: DashboardConfig = { provider: 'filesystem' };

    const result = await explainValue(
      {
        scenario: TEST_SCENARIO,
        url: '/bookings',
        fieldPath: 'bookings.0.status',
      },
      config,
      TEST_MOCK_DATA_PATH
    );

    expect(result.siblingFields).toMatchObject({
      id: 'booking-1',
      status: 'confirmed',
      price: 100,
      date: '2024-01-15',
    });
  });

  it('should handle multiple field overrides', async () => {
    const mockData: MockData = {
      url: 'https://api.example.com/data',
      method: 'GET',
      status: 200,
      responseData: {
        value1: 10,
        value2: 20,
        value3: 30,
      },
      responseFieldOverrides: [
        {
          path: 'value1',
          value: 100,
        },
        {
          path: 'value2',
          value: 200,
        },
      ],
    };

    const mockFile = 'GET_api.example.com_data.json';
    const scenarioPath = path.join(TEST_MOCK_DATA_PATH, TEST_SCENARIO);
    fs.writeFileSync(
      path.join(scenarioPath, mockFile),
      JSON.stringify(mockData, null, 2)
    );

    const config: DashboardConfig = { provider: 'filesystem' };

    const result = await explainValue(
      {
        scenario: TEST_SCENARIO,
        url: '/data',
      },
      config,
      TEST_MOCK_DATA_PATH
    );

    expect(result.modifications).toHaveLength(2);
    expect(result.modifications[0].path).toBe('value1');
    expect(result.modifications[1].path).toBe('value2');
  });
});
