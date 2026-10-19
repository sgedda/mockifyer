#!/usr/bin/env node
/**
 * One-off sync: port CSS + client JS + shell markup from unused-local-atlas/index.html
 * into packages/mockifyer-core/src/utils/atlas-doc-html.ts
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const previewPath = path.join(root, 'unused-local-atlas/index.html');
const targetPath = path.join(root, 'packages/mockifyer-core/src/utils/atlas-doc-html.ts');

const html = fs.readFileSync(previewPath, 'utf8');

const styleMatch = html.match(/<style>\s*([\s\S]*?)\s*<\/style>/);
if (!styleMatch) throw new Error('No <style> block in preview HTML');
const css = styleMatch[1].trim();

const scripts = [...html.matchAll(/<script(?![^>]*type="application\/json")[^>]*>([\s\S]*?)<\/script>/g)];
if (!scripts.length) throw new Error('No client script in preview HTML');
const clientJs = scripts[scripts.length - 1][1].trim();

const appMatch = html.match(/<div id="atlas-app">([\s\S]*?)<\/div>\s*<script type="application\/json"/);
if (!appMatch) throw new Error('No #atlas-app block in preview HTML');
const atlasAppInner = appMatch[1].trim();

function escapeForTemplateLiteral(s) {
  return s.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${');
}

let ts = fs.readFileSync(targetPath, 'utf8');

const sharedCssReplacement = `function sharedCss(): string {
  return \`
${escapeForTemplateLiteral(css)}
\`.trim();
}`;

const interactiveReplacement = `function interactiveClientScript(): string {
  return \`
${escapeForTemplateLiteral(clientJs)}
\`.trim();
}`;

ts = ts.replace(
  /function sharedCss\(\): string \{[\s\S]*?\`\.trim\(\);\n\}/,
  sharedCssReplacement
);

ts = ts.replace(
  /function interactiveClientScript\(\): string \{[\s\S]*?\`\.trim\(\);\n\}/,
  interactiveReplacement
);

const atlasAppBlock = `<div id="atlas-app">
${atlasAppInner}
</div>
<script type="application/json" id="atlas-data">\${json}</script>
<script>
\${interactiveClientScript()}
</script>`;

ts = ts.replace(
  /const body = `\n<div id="atlas-app">[\s\S]*?\$\{interactiveClientScript\(\)\}\n<\/script>`;/,
  `const body = \`\n${escapeForTemplateLiteral(atlasAppBlock)}\`;`
);

fs.writeFileSync(targetPath, ts);
console.log('Updated', targetPath);
console.log('CSS lines:', css.split('\n').length, 'JS lines:', clientJs.split('\n').length);
