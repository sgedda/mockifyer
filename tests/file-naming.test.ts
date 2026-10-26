import { clampRecordingFilename, getMockFilePath, MAX_FILE_NAME_BYTES } from '@sgedda/mockifyer-core';
import type { MockData } from '@sgedda/mockifyer-core';

function mockWithUrl(url: string): MockData {
  return {
    request: { method: 'GET', url, headers: {} },
    response: { status: 200, data: { ok: true }, headers: {} },
    timestamp: '2026-10-25T04:00:00.000Z',
  };
}

describe('recording filenames', () => {
  it('leaves short flat names unchanged', () => {
    const filename = '2026-10-25_04-00-00_GET_api_example_com_test.json';
    expect(clampRecordingFilename(filename, 'GET:https://api.example.com/test')).toBe(filename);
  });

  it('shortens over-long names without colliding distinct URLs', () => {
    const prefix = '2026-10-25T04-00-00-123Z_GET_api_example_com_search_q_';
    const left = `${prefix}${'a'.repeat(400)}.json`;
    const right = `${prefix}${'b'.repeat(400)}.json`;
    const leftName = clampRecordingFilename(left, 'GET:left');
    const rightName = clampRecordingFilename(right, 'GET:right');

    expect(Buffer.byteLength(leftName)).toBeLessThanOrEqual(MAX_FILE_NAME_BYTES);
    expect(Buffer.byteLength(rightName)).toBeLessThanOrEqual(MAX_FILE_NAME_BYTES);
    expect(leftName).not.toBe(rightName);
    expect(leftName.endsWith('.json')).toBe(true);
  });

  it('clamps a single URL path segment so the directory entry can be created', () => {
    const segment = 'b'.repeat(300);
    const other = `${'b'.repeat(300)}X`;
    const left = getMockFilePath(
      mockWithUrl(`https://cdn.example.com/${segment}/asset`),
      '2026-10-25_04-00-00'
    );
    const right = getMockFilePath(
      mockWithUrl(`https://cdn.example.com/${other}/asset`),
      '2026-10-25_04-00-00'
    );

    for (const part of left.dir.split('/')) {
      expect(Buffer.byteLength(part)).toBeLessThanOrEqual(MAX_FILE_NAME_BYTES);
    }
    expect(left.dir).not.toBe(right.dir);
    expect(Buffer.byteLength(left.filename)).toBeLessThanOrEqual(MAX_FILE_NAME_BYTES);
  });
});
