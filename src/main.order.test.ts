// A guard on construction order, not on behavior. src/main.ts wires its
// modules together with `const x = createSomething(...)` calls whose options
// are full of callbacks naming each other. A callback that only runs from a
// later user interaction survives a forward reference; one a constructor
// invokes while building hits the referenced `const`'s temporal dead zone and
// throws before the first frame ever paints. The menu and the scrapbook are
// the pair that has actually gone wrong, so these two read the sources as
// text and hold exactly that pair in place.

import { describe, expect, it } from 'vitest';
import mainSource from './main.ts?raw';
import menuSource from './menu.ts?raw';

// The body of a `function name() { ... }` declared at createMenu's own indent,
// from its opening line to the two-space `}` that closes it.
function bodyOf(source: string, fnName: string): string {
  const body = new RegExp(`\\n  function ${fnName}\\(\\)[\\s\\S]*?\\n  \\}`).exec(source);
  if (!body) throw new Error(`src/menu.ts has no ${fnName}() at createMenu's indent`);
  return body[0];
}

describe('construction order', () => {
  it('constructs the scrapbook before the menu that reads its count', () => {
    const scrapbookAt = mainSource.indexOf('const scrapbook =');
    const menuAt = mainSource.indexOf('const menu =');

    expect(scrapbookAt).toBeGreaterThanOrEqual(0);
    expect(menuAt).toBeGreaterThanOrEqual(0);
    expect(scrapbookAt).toBeLessThan(menuAt);
  });

  it('reads the fact count only when the menu opens, never while it is built', () => {
    // One read, and it is inside paintFacts()...
    expect(menuSource.match(/opts\.factCount\(\)/g)).toHaveLength(1);
    expect(bodyOf(menuSource, 'paintFacts')).toContain('opts.factCount()');

    // ...which open() is the only caller of, so the count is never asked for
    // at construction — where src/main.ts's scrapbook is still in its
    // temporal dead zone.
    expect(menuSource.match(/(?<!function )\bpaintFacts\(\)/g)).toHaveLength(1);
    expect(bodyOf(menuSource, 'open')).toContain('paintFacts()');
  });
});
