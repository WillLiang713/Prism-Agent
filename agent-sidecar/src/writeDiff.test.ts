import assert from 'node:assert/strict';
import test from 'node:test';

import { createWriteUnifiedDiff } from './writeDiff.js';

test('creates added-line diff for a newly written file', () => {
  const diff = createWriteUnifiedDiff(
    {
      path: 'web/src/example.ts',
      existed: false,
      previousContent: null,
    },
    ['export const value = 1;', 'console.log(value);'].join('\n'),
  );

  assert.equal(
    diff,
    [
      'diff --git /dev/null b/web/src/example.ts',
      '--- /dev/null',
      '+++ b/web/src/example.ts',
      '@@ -0,0 +1,2 @@',
      '+export const value = 1;',
      '+console.log(value);',
    ].join('\n'),
  );
});

test('creates replacement diff for overwriting an existing file', () => {
  const diff = createWriteUnifiedDiff(
    {
      path: 'src/example.ts',
      existed: true,
      previousContent: ['const value = 1;', 'console.log(value);'].join('\n'),
    },
    ['const value = 2;', 'console.log("updated");'].join('\n'),
  );

  assert.equal(
    diff,
    [
      'diff --git a/src/example.ts b/src/example.ts',
      '--- a/src/example.ts',
      '+++ b/src/example.ts',
      '@@ -1,2 +1,2 @@',
      '-const value = 1;',
      '-console.log(value);',
      '+const value = 2;',
      '+console.log("updated");',
    ].join('\n'),
  );
});

test('returns no diff when content did not change', () => {
  const diff = createWriteUnifiedDiff(
    {
      path: 'src/example.ts',
      existed: true,
      previousContent: 'const value = 1;\n',
    },
    'const value = 1;\n',
  );

  assert.equal(diff, undefined);
});
