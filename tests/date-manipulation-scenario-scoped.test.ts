import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  createServeTimeClock,
  initializeDateManipulation,
  resetDateManipulation,
  setRuntimeDateManipulation,
} from '@sgedda/mockifyer-core';

const FIXED_DATE = '2024-12-25T12:00:00.000Z';
const REAL_TIME_TOLERANCE_MS = 2000;

function expectRealTime(date: Date): void {
  expect(Math.abs(date.getTime() - Date.now())).toBeLessThan(REAL_TIME_TOLERANCE_MS);
}

describe('createServeTimeClock (serve-time date overrides)', () => {
  let mockDataPath: string;

  beforeEach(() => {
    mockDataPath = fs.mkdtempSync(path.join(os.tmpdir(), 'mockifyer-serve-clock-'));
    resetDateManipulation();
    delete process.env.MOCKIFYER_SCENARIO;
    delete process.env.MOCKIFYER_DATE;
    delete process.env.MOCKIFYER_DATE_OFFSET;
  });

  afterEach(() => {
    resetDateManipulation();
    fs.rmSync(mockDataPath, { recursive: true, force: true });
  });

  function selectScenario(name: string, dateConfig?: Record<string, unknown>): void {
    fs.mkdirSync(path.join(mockDataPath, name), { recursive: true });
    fs.writeFileSync(
      path.join(mockDataPath, 'scenario-config.json'),
      JSON.stringify({ currentScenario: name })
    );
    if (dateConfig) {
      fs.writeFileSync(
        path.join(mockDataPath, name, 'date-config.json'),
        JSON.stringify({ dateManipulation: dateConfig })
      );
    }
  }

  it('uses real time when nothing configures a date', () => {
    const config = { mockDataPath, disableDateConfigFileFallback: false };
    initializeDateManipulation(config);

    expectRealTime(createServeTimeClock(config)());
  });

  it('keeps an explicit setupMockifyer date without a selected scenario', () => {
    const config = { mockDataPath, dateManipulation: { fixedDate: FIXED_DATE } };
    initializeDateManipulation(config);

    expect(createServeTimeClock(config)().toISOString()).toBe(FIXED_DATE);
  });

  it('does not apply another scenario date-config.json when none is selected', () => {
    fs.mkdirSync(path.join(mockDataPath, 'checkout'), { recursive: true });
    fs.writeFileSync(
      path.join(mockDataPath, 'checkout', 'date-config.json'),
      JSON.stringify({ dateManipulation: { fixedDate: FIXED_DATE } })
    );
    const config = { mockDataPath, disableDateConfigFileFallback: false };
    initializeDateManipulation(config);

    expectRealTime(createServeTimeClock(config)());
  });

  it('applies the date-config.json of the selected scenario', () => {
    selectScenario('checkout', { fixedDate: FIXED_DATE });
    const config = { mockDataPath, disableDateConfigFileFallback: false };
    initializeDateManipulation(config);

    expect(createServeTimeClock(config)().toISOString()).toBe(FIXED_DATE);
  });

  it('follows a scenario switch without recreating the clock', () => {
    selectScenario('checkout', { fixedDate: FIXED_DATE });
    const config = { mockDataPath, disableDateConfigFileFallback: false };
    initializeDateManipulation(config);
    const clock = createServeTimeClock(config);
    expect(clock().toISOString()).toBe(FIXED_DATE);

    selectScenario('browse');
    expectRealTime(clock());
  });

  it('uses the dashboard-resolved date in proxy mode regardless of local scenario files', () => {
    const config = { mockDataPath, proxy: { baseUrl: 'http://localhost:3002' } };
    initializeDateManipulation(config);
    setRuntimeDateManipulation({ fixedDate: FIXED_DATE }, 'lane-scenario');

    expect(createServeTimeClock(config)().toISOString()).toBe(FIXED_DATE);
  });
});
