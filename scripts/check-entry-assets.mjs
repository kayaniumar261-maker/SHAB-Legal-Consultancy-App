import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const desktop = process.argv.includes('--desktop');
const html = fs.readFileSync('dist/index.html', 'utf8');
const entryAssets = [...html.matchAll(/(?:src|href)=["']([^"']*assets\/[^"']+)["']/g)].map(match => match[1]);
assert.ok(entryAssets.some(asset => asset.endsWith('.js')), 'Built JavaScript entry is missing.');
assert.ok(entryAssets.some(asset => asset.endsWith('.css')), 'Built stylesheet entry is missing.');
const pages = desktop
  ? ['file:///C:/SHAB/dist/index.html#/', 'file:///C:/SHAB/dist/index.html#/cases/example']
  : ['https://shab.example/', 'https://shab.example/staff', 'https://shab.example/auth/setup', 'https://shab.example/clients/example', 'https://shab.example/cases/example/edit'];
for (const page of pages) {
  for (const asset of entryAssets) {
    assert.ok(desktop ? asset.startsWith('./assets/') : asset.startsWith('/assets/'),
      'Wrong asset base for ' + (desktop ? 'desktop' : 'web') + ': ' + asset);
    const resolved = new URL(asset, page);
    const prefix = desktop ? '/C:/SHAB/dist/' : '/';
    assert.ok(resolved.pathname.startsWith(prefix + 'assets/'), 'Entry asset resolves outside the build: ' + page);
    const relative = decodeURIComponent(resolved.pathname.slice(prefix.length));
    assert.ok(fs.existsSync(path.join('dist', relative)), 'Missing built asset: ' + relative);
  }
}
console.log((desktop ? 'Desktop file' : 'Web nested-route') + ' entry asset checks passed.');
