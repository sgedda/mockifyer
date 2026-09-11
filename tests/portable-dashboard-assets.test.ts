import fs from 'fs';
import http from 'http';
import os from 'os';
import path from 'path';
import type { AddressInfo } from 'net';
import vm from 'vm';
import {
  PORTABLE_ASSET_BOOT_MARKER,
  injectPortableDashboardAssets,
  resolvePortableDashboardAssetUrl,
} from '../packages/mockifyer-dashboard/frontend/src/lib/portable-dashboard-assets';

const RELATIVE_HTML = `<!doctype html>
<html>
<head>
  <script type="module" crossorigin src="./assets/main-QnIA1sRA.js"></script>
  <link rel="stylesheet" crossorigin href="./assets/main-Cj6LkZgN.css">
</head>
<body><div id="root"></div></body>
</html>`;

interface CollectedAssets {
  scripts: string[];
  links: string[];
}

function httpGet(
  server: http.Server,
  urlPath: string
): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const { port } = server.address() as AddressInfo;
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port,
        path: urlPath,
        method: 'GET',
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk) => chunks.push(chunk as Buffer));
        res.on('end', () =>
          resolve({ status: res.statusCode ?? 0, body: Buffer.concat(chunks).toString('utf8') })
        );
      }
    );
    req.on('error', reject);
    req.end();
  });
}

function runBoot(html: string, pathname: string): CollectedAssets {
  const scripts: string[] = [];
  const links: string[] = [];
  const bootMatch = html.match(
    new RegExp(`<script>/\\*${PORTABLE_ASSET_BOOT_MARKER}\\*/([\\s\\S]*?)</script>`)
  );
  if (!bootMatch) {
    throw new Error('portable asset boot script not found');
  }
  const document = {
    head: {
      appendChild(el: { tagName: string; src?: string; href?: string }) {
        if (el.tagName === 'script' && el.src) scripts.push(el.src);
        if (el.tagName === 'link' && el.href) links.push(el.href);
      },
    },
    createElement(tag: string) {
      return {
        tagName: tag,
        rel: '',
        type: '',
        crossOrigin: '',
        src: '',
        href: '',
      };
    },
  };
  vm.runInNewContext(bootMatch[1], {
    document,
    location: { pathname },
  });
  return { scripts, links };
}

describe('portable dashboard assets (host SPA fallback)', () => {
  it('maps trailing-slash Overrides URLs onto /mockifyer/assets/*', () => {
    expect(
      resolvePortableDashboardAssetUrl('/mockifyer/overrides/', './assets/main-QnIA1sRA.js')
    ).toBe('/mockifyer/assets/main-QnIA1sRA.js');
    expect(
      resolvePortableDashboardAssetUrl('/mockifyer/overrides', 'assets/main-QnIA1sRA.js')
    ).toBe('/mockifyer/assets/main-QnIA1sRA.js');
    expect(resolvePortableDashboardAssetUrl('/overrides', './assets/main.js')).toBe(
      '/assets/main.js'
    );
  });

  it('strips relative ./assets tags and boots absolute URLs', () => {
    const html = injectPortableDashboardAssets(RELATIVE_HTML);
    expect(html).not.toContain('src="./assets/');
    expect(html).not.toContain('href="./assets/');
    expect(html).toContain(PORTABLE_ASSET_BOOT_MARKER);

    const nested = runBoot(html, '/mockifyer/overrides/');
    expect(nested.scripts).toEqual(['/mockifyer/assets/main-QnIA1sRA.js']);
    expect(nested.links).toEqual(['/mockifyer/assets/main-Cj6LkZgN.css']);

    const standalone = runBoot(html, '/overrides');
    expect(standalone.scripts).toEqual(['/assets/main-QnIA1sRA.js']);
  });
});

describe('host SPA fallback still serves /mockifyer/assets', () => {
  it('keeps the real bundle at /mockifyer/assets even when nested assets return HTML', async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mockifyer-host-spa-'));
    const publicDir = path.join(tmp, 'public');
    const assetsDir = path.join(publicDir, 'assets');
    fs.mkdirSync(assetsDir, { recursive: true });
    const bundle = 'export const ok = true;\n';
    fs.writeFileSync(path.join(assetsDir, 'main-QnIA1sRA.js'), bundle);
    fs.writeFileSync(
      path.join(publicDir, 'index.html'),
      injectPortableDashboardAssets(RELATIVE_HTML)
    );

    const server = await new Promise<http.Server>((resolve) => {
      const s = http.createServer((req, res) => {
        const urlPath = (req.url ?? '/').split('?')[0];
        if (!urlPath.startsWith('/mockifyer')) {
          res.statusCode = 404;
          res.end('host miss');
          return;
        }
        const rel = urlPath.slice('/mockifyer'.length) || '/';
        const filePath = path.join(publicDir, rel);
        if (rel.startsWith('/assets/') && fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
          res.statusCode = 200;
          res.setHeader('Content-Type', 'text/javascript');
          res.end(fs.readFileSync(filePath));
          return;
        }
        res.statusCode = 200;
        res.setHeader('Content-Type', 'text/html');
        res.end(fs.readFileSync(path.join(publicDir, 'index.html')));
      });
      s.listen(0, '127.0.0.1', () => resolve(s));
    });

    try {
      const nested = await httpGet(server, '/mockifyer/overrides/assets/main-QnIA1sRA.js');
      expect(nested.status).toBe(200);
      expect(nested.body).toContain('id="root"');
      expect(nested.body).not.toContain('export const ok');

      const real = await httpGet(server, '/mockifyer/assets/main-QnIA1sRA.js');
      expect(real.status).toBe(200);
      expect(real.body).toContain('export const ok');

      const page = await httpGet(server, '/mockifyer/overrides/');
      const boot = runBoot(page.body, '/mockifyer/overrides/');
      expect(boot.scripts).toEqual(['/mockifyer/assets/main-QnIA1sRA.js']);
    } finally {
      await new Promise<void>((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      });
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });
});
