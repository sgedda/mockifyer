#!/usr/bin/env ts-node
/**
 * Build-time check: every PAGE_SEO route must have prerendered HTML with a
 * self-referencing canonical (not the homepage), unique title, and an H1.
 */

import fs from 'fs';
import path from 'path';
import { PAGE_SEO, SITE_URL } from '../frontend/src/lib/seo-config';

const HOMEPAGE_CANONICAL = `${SITE_URL}/`;

interface CheckFailure {
  route: string;
  reason: string;
}

function htmlPathForRoute(publicDir: string, routePath: string): string {
  if (routePath === '/') {
    return path.join(publicDir, 'index.html');
  }
  return path.join(publicDir, `${routePath.replace(/^\//, '')}.html`);
}

function verify(): void {
  const publicDir = path.join(__dirname, '../public');
  const failures: CheckFailure[] = [];
  const titles = new Map<string, string>();

  if (!fs.existsSync(path.join(publicDir, 'index.html'))) {
    console.error('❌ public/index.html missing — run frontend build + prerender first');
    process.exit(1);
  }

  if (!fs.existsSync(path.join(publicDir, '404.html'))) {
    failures.push({ route: '/404', reason: '404.html missing' });
  } else {
    const notFoundHtml = fs.readFileSync(path.join(publicDir, '404.html'), 'utf-8');
    if (!/name="robots"\s+content="[^"]*noindex/i.test(notFoundHtml)) {
      failures.push({ route: '/404', reason: 'missing noindex robots meta' });
    }
    if (!/<h1[\s>]/.test(notFoundHtml)) {
      failures.push({ route: '/404', reason: 'missing <h1>' });
    }
  }

  for (const routePath of Object.keys(PAGE_SEO)) {
    const filePath = htmlPathForRoute(publicDir, routePath);
    if (!fs.existsSync(filePath)) {
      failures.push({ route: routePath, reason: `missing file ${path.relative(publicDir, filePath)}` });
      continue;
    }

    const html = fs.readFileSync(filePath, 'utf-8');
    const titleMatch = html.match(/<title>(.*?)<\/title>/i);
    const canonicalMatch = html.match(/<link rel="canonical" href="([^"]+)"/i);
    const h1Match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
    const expectedCanonical =
      routePath === '/' ? HOMEPAGE_CANONICAL : `${SITE_URL}${routePath}`;

    if (!titleMatch?.[1]?.trim()) {
      failures.push({ route: routePath, reason: 'missing <title>' });
    } else {
      const title = titleMatch[1];
      const previous = titles.get(title);
      if (previous && previous !== routePath) {
        failures.push({
          route: routePath,
          reason: `duplicate title with ${previous}: ${title}`,
        });
      }
      titles.set(title, routePath);
    }

    if (!canonicalMatch?.[1]) {
      failures.push({ route: routePath, reason: 'missing canonical' });
    } else if (canonicalMatch[1] !== expectedCanonical) {
      failures.push({
        route: routePath,
        reason: `canonical is ${canonicalMatch[1]}, expected ${expectedCanonical}`,
      });
    } else if (routePath !== '/' && canonicalMatch[1] === HOMEPAGE_CANONICAL) {
      failures.push({
        route: routePath,
        reason: 'canonical points at homepage',
      });
    }

    if (!h1Match?.[1]?.trim()) {
      failures.push({ route: routePath, reason: 'missing <h1> in initial HTML' });
    }

    if (routePath !== '/' && /id="root"><\/div>/.test(html)) {
      failures.push({ route: routePath, reason: 'empty #root (SPA shell only)' });
    }
  }

  if (failures.length > 0) {
    console.error('❌ Prerender verification failed:\n');
    for (const failure of failures) {
      console.error(`  - ${failure.route}: ${failure.reason}`);
    }
    process.exit(1);
  }

  console.log(
    `✅ Prerender verification passed for ${Object.keys(PAGE_SEO).length} sitemap HTML routes + 404.html`
  );
}

if (require.main === module) {
  verify();
}

export { verify };
