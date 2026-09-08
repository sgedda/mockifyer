import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  hydrateAtlasPackRuntimeFromDisk,
  listAtlasPacksFromDisk,
  readAtlasPackConfig,
  registerAtlasPacks,
  resetAtlasPackRuntime,
  setActiveAtlasPack,
  writeAtlasPackConfig,
  writeAtlasPackToDisk,
  getActiveAtlasPack,
  type AtlasPack,
} from '../packages/mockifyer-core/src';

describe('atlas pack filesystem', () => {
  let dir: string;

  beforeEach(() => {
    resetAtlasPackRuntime();
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'atlas-packs-'));
  });

  afterEach(() => {
    resetAtlasPackRuntime();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  const pack = (): AtlasPack => ({
    id: 'award-trip',
    label: 'Award trip',
    updatedAt: '2026-01-01T00:00:00.000Z',
    overlays: [
      {
        path: 'trips',
        select: { field: 'id', values: ['trip-award'] },
        pins: [{ id: 'trip-award', data: { id: 'trip-award', cabin: 'BUSINESS' } }],
      },
    ],
  });

  it('writes and lists packs under _atlas/packs', () => {
    writeAtlasPackToDisk(dir, pack());
    const listed = listAtlasPacksFromDisk(dir);
    expect(listed).toHaveLength(1);
    expect(listed[0]?.id).toBe('award-trip');
    expect(fs.existsSync(path.join(dir, '_atlas', 'packs', 'award-trip.json'))).toBe(true);
  });

  it('hydrates runtime from disk + pack-config', () => {
    writeAtlasPackToDisk(dir, pack());
    writeAtlasPackConfig(dir, { currentPack: 'award-trip' });
    hydrateAtlasPackRuntimeFromDisk(dir, {
      reset: resetAtlasPackRuntime,
      registerAtlasPacks,
      setActiveAtlasPack,
    });
    expect(readAtlasPackConfig(dir).currentPack).toBe('award-trip');
    expect(getActiveAtlasPack()?.id).toBe('award-trip');
  });
});
