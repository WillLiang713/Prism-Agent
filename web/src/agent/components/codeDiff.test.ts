import assert from 'node:assert/strict';
import test from 'node:test';

import { getDiffFileLabel, getDiffFileStatus, parseRenderedDiffLines, parseUnifiedDiff } from './codeDiff';

test('pairs removed and added lines into side by side modified rows', () => {
  const diff = [
    'diff --git a/src/example.ts b/src/example.ts',
    '--- a/src/example.ts',
    '+++ b/src/example.ts',
    '@@ -1,3 +1,3 @@',
    ' const value = 1;',
    "-console.log('old');",
    "+console.log('new');",
    ' export { value };',
  ].join('\n');

  const files = parseUnifiedDiff(diff);

  assert.equal(files.length, 1);
  assert.equal(files[0]?.additions, 1);
  assert.equal(files[0]?.deletions, 1);
  assert.equal(files[0]?.hunks.length, 1);

  const modifiedRow = files[0]?.hunks[0]?.rows[1];
  assert.deepEqual(modifiedRow, {
    id: 'diff-file-0-hunk-0-row-1',
    kind: 'modified',
    leftLineNumber: 2,
    rightLineNumber: 2,
    leftText: "console.log('old');",
    rightText: "console.log('new');",
  });
});

test('tracks newly created files and strips a/b prefixes from labels', () => {
  const diff = [
    'diff --git a/dev/null b/web/src/new-file.ts',
    '--- /dev/null',
    '+++ b/web/src/new-file.ts',
    '@@ -0,0 +1,2 @@',
    '+export const value = 1;',
    '+export const next = 2;',
  ].join('\n');

  const [file] = parseUnifiedDiff(diff);

  assert.equal(getDiffFileLabel(file!), 'web/src/new-file.ts');
  assert.equal(getDiffFileStatus(file!), 'new file');
  assert.equal(file?.additions, 2);
  assert.equal(file?.deletions, 0);
});

test('parses rendered edit diff lines with line numbers', () => {
  const lines = parseRenderedDiffLines(
    [' 536 @keyframes cloud-move {', '-538 to { transform: translateX(190%); }', '+538 to { transform: translateX(190%) scale(var(--scale)); }', '    ...'].join('\n'),
  );

  assert.deepEqual(lines, [
    {
      id: 'rendered-diff-line-0',
      kind: 'context',
      lineNumber: '536',
      text: '@keyframes cloud-move {',
    },
    {
      id: 'rendered-diff-line-1',
      kind: 'removed',
      lineNumber: '538',
      text: 'to { transform: translateX(190%); }',
    },
    {
      id: 'rendered-diff-line-2',
      kind: 'added',
      lineNumber: '538',
      text: 'to { transform: translateX(190%) scale(var(--scale)); }',
    },
    {
      id: 'rendered-diff-line-3',
      kind: 'ellipsis',
      lineNumber: '',
      text: '...',
    },
  ]);
});
