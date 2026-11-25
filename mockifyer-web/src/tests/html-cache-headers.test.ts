/**
 * HTML must be no-cache so redeploys do not leave browsers on stale index → missing locale chunks.
 */
import fs from 'fs';
import path from 'path';
import request from 'supertest';
import app from '../index';

describe('SPA / HTML cache headers', () => {
  const publicDir = path.join(__dirname, '../../public');
  const assetsDir = path.join(publicDir, 'assets');
  let tempHtml: string | null = null;
  let tempAsset: string | null = null;

  beforeAll(() => {
    fs.mkdirSync(assetsDir, { recursive: true });
    tempHtml = path.join(publicDir, `cache-header-probe-${process.pid}.html`);
    fs.writeFileSync(tempHtml, '<!doctype html><title>probe</title>', 'utf8');
    tempAsset = path.join(assetsDir, `probe-${process.pid}.js`);
    fs.writeFileSync(tempAsset, 'export default 1;', 'utf8');
  });

  afterAll(() => {
    if (tempHtml && fs.existsSync(tempHtml)) fs.unlinkSync(tempHtml);
    if (tempAsset && fs.existsSync(tempAsset)) fs.unlinkSync(tempAsset);
  });

  it('serves HTML with Cache-Control: no-cache', async () => {
    const name = path.basename(tempHtml!);
    const response = await request(app).get(`/${name}`);
    expect(response.status).toBe(200);
    expect(response.headers['cache-control']).toMatch(/no-cache/i);
  });

  it('serves hashed assets with long-lived immutable cache', async () => {
    const name = path.basename(tempAsset!);
    const response = await request(app).get(`/assets/${name}`);
    expect(response.status).toBe(200);
    expect(response.headers['cache-control']).toMatch(/immutable/i);
    expect(response.headers['cache-control']).toMatch(/max-age=31536000/i);
  });

  it('returns 404 for missing asset paths (does not SPA-fallback HTML)', async () => {
    const response = await request(app).get('/assets/es-DLLH7dfQ-missing.js');
    expect(response.status).toBe(404);
    expect(response.text).not.toMatch(/<!doctype html>/i);
  });
});
