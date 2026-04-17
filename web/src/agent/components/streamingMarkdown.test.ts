import test from 'node:test';
import assert from 'node:assert/strict';

import { splitStreamingMarkdownForRender } from './streamingMarkdown';

test('splits stable heading and paragraph markdown away from trailing plain text', () => {
  const result = splitStreamingMarkdownForRender('# 标题\n\n第一段。\n\n第二');

  assert.equal(result.stableMarkdown, '# 标题\n\n第一段。\n\n');
  assert.equal(result.trailingText, '第二');
});

test('keeps an unclosed fenced code block in trailing plain text', () => {
  const result = splitStreamingMarkdownForRender('说明：\n\n```ts\nconst value = 1;');

  assert.equal(result.stableMarkdown, '说明：\n\n');
  assert.equal(result.trailingText, '```ts\nconst value = 1;');
});

test('treats completed lists as stable markdown but keeps the unfinished next item plain', () => {
  const result = splitStreamingMarkdownForRender('- 第一项\n- 第二项\n- 第');

  assert.equal(result.stableMarkdown, '- 第一项\n- 第二项\n');
  assert.equal(result.trailingText, '- 第');
});
