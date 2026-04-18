import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const css = readFileSync(resolve(process.cwd(), 'web/src/index.css'), 'utf8');

test('global scrollbar CSS includes hover, active glow, and reduced-motion handling', () => {
  assert.match(css, /::\-webkit-scrollbar-thumb:hover\s*\{/);
  assert.match(css, /::\-webkit-scrollbar-thumb:active\s*\{/);
  assert.match(css, /box-shadow:\s*0 0 0 4px hsl\(var\(--foreground\) \/ 0\.12\);/);
  assert.match(css, /transition:\s*background-color 140ms ease, box-shadow 140ms ease;/);
  assert.match(
    css,
    /@media \(prefers-reduced-motion: reduce\)\s*\{[\s\S]*::\-webkit-scrollbar-thumb\s*\{[\s\S]*transition: none;/,
  );
});
