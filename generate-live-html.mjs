#!/usr/bin/env node
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';
import crypto from 'crypto';

const { buildAtlasLiveStreamHtml } = await import('./packages/mockifyer-core/dist/index.js');

const version = process.argv[2] || 'after';
const outputDir = `/tmp/atlas-comparison/${version}`;

console.log(`Generating ${version.toUpperCase()} live HTML...`);

const liveHtml = buildAtlasLiveStreamHtml({
  streamPath: '/mock-stream',
  title: 'Live Metro Hops',
});

fs.writeFileSync(join(outputDir, 'live.html'), liveHtml, 'utf8');

const md5 = crypto.createHash('md5').update(liveHtml).digest('hex');
console.log(`Generated ${version} live.html (md5: ${md5})`);
console.log(`Saved to ${outputDir}/live.html`);
