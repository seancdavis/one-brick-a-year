// A guard on src/main.ts's construction order, not on its behavior.
//
// Every module src/main.ts wires together is built with a `const x =
// createSomething(...)` call, and the options object handed to one of those
// calls routinely names another one — `onScrapbook: () => scrapbook.open()`.
// A callback like that is fine when it only ever runs from a later user
// interaction. It is a crash when the constructor calls it while building:
// the referenced `const` is still in its temporal dead zone, and reading it
// throws a ReferenceError before the first frame ever paints.
//
// Rather than asking of every callback "does this run now or later?", main.ts
// keeps to plain construction order — anything a create… call's arguments
// name is already constructed above it — and this test holds it there. It
// reads main.ts as text and works at the regex level; it does not evaluate
// anything, so it cannot be fooled into running the app, and it deliberately
// does not try to tell an immediately-invoked callback from a deferred one.

import { describe, expect, it } from 'vitest';
import mainSource from './main.ts?raw';

// The create… calls whose arguments are checked. Each is a constructor that
// takes an options object full of callbacks, which is where a forward
// reference hides.
const GUARDED = ['createMenu', 'createPopups', 'createStartScreen'];

// Replaces the contents of every comment and string literal with spaces,
// leaving every other character at its original index. Comments mentioning a
// module by name, and any stray bracket inside a string, then can't be
// mistaken for code.
function blankCommentsAndStrings(source: string): string {
  const out = source.split('');
  let i = 0;
  const blankUntil = (end: number) => {
    for (; i < end && i < out.length; i++) {
      if (out[i] !== '\n') out[i] = ' ';
    }
  };

  while (i < out.length) {
    const two = source.slice(i, i + 2);
    if (two === '//') {
      const end = source.indexOf('\n', i);
      blankUntil(end === -1 ? out.length : end);
      continue;
    }
    if (two === '/*') {
      const end = source.indexOf('*/', i + 2);
      blankUntil(end === -1 ? out.length : end + 2);
      continue;
    }
    const quote = source[i];
    if (quote === "'" || quote === '"' || quote === '`') {
      i++;
      while (i < out.length && source[i] !== quote) {
        if (source[i] === '\\') {
          out[i] = ' ';
          i++;
        }
        if (i < out.length && source[i] !== '\n') out[i] = ' ';
        i++;
      }
      i++;
      continue;
    }
    i++;
  }

  return out.join('');
}

interface Construction {
  name: string;
  call: string;
  // Index of the `const` keyword.
  declIndex: number;
  // The call's argument list, and where it starts in the source.
  argsStart: number;
  argsEnd: number;
}

// Walks forward from the index of a `(` to its matching `)`.
function matchingParen(source: string, openIndex: number): number {
  let depth = 0;
  for (let i = openIndex; i < source.length; i++) {
    if (source[i] === '(') depth++;
    else if (source[i] === ')') {
      depth--;
      if (depth === 0) return i;
    }
  }
  return source.length;
}

function constructionsIn(source: string): Construction[] {
  const pattern = /\bconst\s+([A-Za-z_$][\w$]*)\s*=\s*(create[A-Za-z0-9_$]*)\s*\(/g;
  const found: Construction[] = [];
  for (const match of source.matchAll(pattern)) {
    const declIndex = match.index;
    const openIndex = declIndex + match[0].length - 1;
    found.push({
      name: match[1],
      call: match[2],
      declIndex,
      argsStart: openIndex + 1,
      argsEnd: matchingParen(source, openIndex),
    });
  }
  return found;
}

const source = blankCommentsAndStrings(mainSource);
const constructions = constructionsIn(source);

describe('src/main.ts construction order', () => {
  it('finds every guarded constructor call', () => {
    const calls = constructions.map((c) => c.call);
    for (const guarded of GUARDED) {
      expect(calls).toContain(guarded);
    }
  });

  it('constructs each module before any guarded call names it', () => {
    for (const site of constructions.filter((c) => GUARDED.includes(c.call))) {
      const args = source.slice(site.argsStart, site.argsEnd);

      for (const other of constructions) {
        const reference = new RegExp(`\\b${other.name}\\b`).exec(args);
        if (!reference) continue;

        const referenceIndex = site.argsStart + reference.index;
        // `${other.name}` is read inside `${site.call}(...)`, so its own
        // `const` has to come first — otherwise a callback the constructor
        // invokes while building hits the temporal dead zone.
        expect(
          other.declIndex,
          `${site.call}(...) references \`${other.name}\` before it is constructed`,
        ).toBeLessThan(referenceIndex);
      }
    }
  });
});
