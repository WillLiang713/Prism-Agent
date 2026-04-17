import test from 'node:test';
import assert from 'node:assert/strict';

import { normalizeAssistantMarkdown } from './assistantMarkdown';

test('replaces standalone horizontal-rule markers with plain paragraph spacing', () => {
  const input = ['第一段', '', '---', '', '第二段'].join('\n');

  assert.equal(normalizeAssistantMarkdown(input), '第一段\n\n第二段');
});

test('normalizes star and underscore horizontal-rule markers the same way', () => {
  const input = ['甲', '', '***', '', '乙', '', '___', '', '丙'].join('\n');

  assert.equal(normalizeAssistantMarkdown(input), '甲\n\n乙\n\n丙');
});

test('does not rewrite fence content that contains horizontal-rule markers', () => {
  const input = ['说明', '', '```md', '---', '```', '', '结尾'].join('\n');

  assert.equal(normalizeAssistantMarkdown(input), input);
});
