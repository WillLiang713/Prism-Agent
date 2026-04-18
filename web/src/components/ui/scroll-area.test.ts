import assert from 'node:assert/strict';
import test from 'node:test';

import { scrollAreaThumbClassName, scrollBarBaseClassName } from './scroll-area';

test('shared ScrollArea exposes hover and pressed glow state classes', () => {
  assert.match(scrollBarBaseClassName, /\bgroup\/scrollbar\b/);
  assert.match(
    scrollAreaThumbClassName,
    /transition-\[background-color,box-shadow,opacity\]/,
  );
  assert.match(scrollAreaThumbClassName, /\bgroup-hover\/scrollbar:bg-border\/90\b/);
  assert.match(scrollAreaThumbClassName, /\bdata-\[state=visible\]:opacity-100\b/);
  assert.match(
    scrollAreaThumbClassName,
    /active:shadow-\[0_0_0_4px_hsl\(var\(--foreground\)_\/_0\.12\)\]/,
  );
});
