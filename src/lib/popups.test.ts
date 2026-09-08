import { describe, expect, it } from 'vitest';
import { BEATS, type Beat } from './beats';
import type { Compaction } from './compaction';
import { BRICK_M, TOTAL_YEARS } from './constants';
import type { ThingLandmark } from './landmarks';
import { popupsFor, selectionAfterArrivals, type PinModel, type PopupSelection, type PopupSide } from './popups';

// effectiveRenderUnit clamps the unit down to the largest power of ten at
// most `bricks`, so a test that wants a coarse unit has to hand popupsFor a
// year count big enough to actually be drawn at it.
function at(unit: number): Compaction {
  return { unit, transition: null };
}

function beat(id: string, atYears: number): Beat {
  return { id, atYears, title: id, line: `${id} line`, icon: 'bricks', paper: 'mustard' };
}

function thing(id: string, meters: number): ThingLandmark {
  return {
    id,
    meters,
    years: meters / BRICK_M,
    label: id,
    icon: 'bricks',
    paper: 'navy',
    kind: 'thing',
    orientation: 'tall',
    tallerThanPhrase: `taller than ${id}!`,
  };
}

function sel(right: PopupSelection['right'], left: PopupSelection['left'] = 'latest'): PopupSelection {
  return { right, left };
}

// The id of whatever a side has open — an event on the right, a thing on the
// left — or null when nothing is.
function openId(side: PopupSide): string | null {
  const { open } = side;
  if (!open) return null;
  return open.side === 'right' ? open.event.id : open.thing.id;
}

// A pin's members widened to the one type both sides can be walked as.
function membersOf(pin: PinModel): (Beat | ThingLandmark)[] {
  return pin.members;
}

// Every id a side's pins stand for, in pin order.
function pinIds(side: PopupSide): string[] {
  return side.pins.flatMap((pin) => membersOf(pin).map((m) => m.id));
}

describe('popupsFor: right side (time events)', () => {
  it('opens the one passed event, with nothing else as a pin', () => {
    const beats = [beat('a', 12)];
    const result = popupsFor({ beats, things: [], years: 40, heightM: 0, compaction: at(1), selection: sel('latest') });

    expect(result.right.open?.bricksFromGround).toBe(12);
    expect(openId(result.right)).toBe('a');
    expect(result.right.pins).toEqual([]);
  });

  it('keeps only the latest event open; older ones become pins with the right count', () => {
    const beats = [beat('a', 12), beat('b', 30)];
    const result = popupsFor({ beats, things: [], years: 40, heightM: 0, compaction: at(1), selection: sel('latest') });

    expect(openId(result.right)).toBe('b');
    expect(result.right.pins).toHaveLength(1);
    expect(result.right.pins[0].bricksFromGround).toBe(12);
    expect(membersOf(result.right.pins[0])).toHaveLength(1);
  });

  it('opens the newest fact of a compacted brick and pins the rest of that same brick', () => {
    // At unit 10, 21, 26 and 27 all land in drawn brick 2. The most recently
    // passed of them — the highest atYears — is what the page is saying, so
    // it opens; its brick still carries a pin, for the two it left behind.
    const beats = [beat('oldest', 21), beat('middle', 26), beat('newest', 27)];
    const result = popupsFor({ beats, things: [], years: 100, heightM: 0, compaction: at(10), selection: sel('latest') });

    expect(openId(result.right)).toBe('newest');
    expect(result.right.open?.bricksFromGround).toBe(2);
    expect(result.right.pins).toHaveLength(1);
    expect(result.right.pins[0].bricksFromGround).toBe(2);
    expect(pinIds(result.right)).toEqual(['oldest', 'middle']);
  });

  it('keeps the same event open across a compaction regroup', () => {
    const beats = [beat('oldest', 21), beat('middle', 26), beat('newest', 27)];
    const args = { beats, things: [], years: 100, heightM: 0 };

    const fine = popupsFor({ ...args, compaction: at(1), selection: sel('latest') });
    const coarse = popupsFor({ ...args, compaction: at(10), selection: sel('latest') });
    expect(openId(fine.right)).toBe('newest');
    expect(openId(coarse.right)).toBe('newest');

    // The same holds for a specifically selected fact: regrouping the bricks
    // underneath a reader must not swap what they are reading.
    const fineSelected = popupsFor({ ...args, compaction: at(1), selection: sel('oldest') });
    const coarseSelected = popupsFor({ ...args, compaction: at(10), selection: sel('oldest') });
    expect(openId(fineSelected.right)).toBe('oldest');
    expect(openId(coarseSelected.right)).toBe('oldest');
    expect(pinIds(coarseSelected.right)).toEqual(['middle', 'newest']);
  });

  it('bundles two events sharing a drawn brick into one pin, ascending by year within it', () => {
    // At unit 10, both 41 and 47 land in drawn brick 4; 90 lands in brick 9.
    const beats = [beat('later-in-bundle', 47), beat('earlier-in-bundle', 41), beat('c', 90)];
    const result = popupsFor({ beats, things: [], years: 100, heightM: 0, compaction: at(10), selection: sel('latest') });

    expect(openId(result.right)).toBe('c');
    expect(result.right.pins).toHaveLength(1);
    expect(result.right.pins[0].bricksFromGround).toBe(4);
    expect(pinIds(result.right)).toEqual(['earlier-in-bundle', 'later-in-bundle']);
  });

  it('opens a specifically selected id, not just the latest', () => {
    const beats = [beat('a', 12), beat('b', 30), beat('c', 90)];
    const result = popupsFor({ beats, things: [], years: 100, heightM: 0, compaction: at(1), selection: sel('a') });

    expect(openId(result.right)).toBe('a');
    const pinBricks = result.right.pins.map((p) => p.bricksFromGround).sort((x, y) => x - y);
    expect(pinBricks).toEqual([30, 90]);
  });

  it('opens nothing when the selected id is no longer passed, leaving src/main.ts to fall back', () => {
    const beats = [beat('a', 12), beat('b', 30)];
    const result = popupsFor({ beats, things: [], years: 20, heightM: 0, compaction: at(1), selection: sel('b') });

    expect(result.right.open).toBeNull();
    expect(pinIds(result.right)).toEqual(['a']);
  });

  it('removes an event (and its pin) once undo drops it below', () => {
    const beats = [beat('a', 12), beat('b', 30)];
    const before = popupsFor({ beats, things: [], years: 40, heightM: 0, compaction: at(1), selection: sel('latest') });
    expect(openId(before.right)).toBe('b');
    expect(before.right.pins).toHaveLength(1);

    const after = popupsFor({ beats, things: [], years: 20, heightM: 0, compaction: at(1), selection: sel('latest') });
    expect(openId(after.right)).toBe('a');
    expect(after.right.pins).toEqual([]);
  });

  it('gives nothing when nothing has been passed', () => {
    const result = popupsFor({
      beats: [beat('a', 12)],
      things: [],
      years: 0,
      heightM: 0,
      compaction: at(1),
      selection: sel('latest'),
    });

    expect(result.right.open).toBeNull();
    expect(result.right.pins).toEqual([]);
  });

  it('folds the whole finished stack into a handful of bundle pins, each event exactly once', () => {
    const result = popupsFor({
      beats: BEATS,
      things: [],
      years: TOTAL_YEARS,
      heightM: 0,
      compaction: at(1e9),
      selection: sel('latest'),
    });

    expect(result.right.pins.length).toBeLessThanOrEqual(6);

    // The open event and the pins partition every passed beat between them.
    const ids = [openId(result.right) ?? '', ...pinIds(result.right)];
    expect(ids).toHaveLength(BEATS.length);
    expect(new Set(ids).size).toBe(BEATS.length);

    // Each pin holds exactly the events of its own drawn brick, and no two
    // pins share a brick.
    const pinBricks = result.right.pins.map((p) => p.bricksFromGround);
    expect(new Set(pinBricks).size).toBe(pinBricks.length);
    for (const pin of result.right.pins) {
      for (const member of membersOf(pin)) {
        const years = 'atYears' in member ? member.atYears : member.years;
        expect(Math.floor(years / 1e9)).toBe(pin.bricksFromGround);
      }
    }
  });
});

describe('popupsFor: left side (physical things)', () => {
  it('opens the tallest passed thing when several pass at once', () => {
    const things = [thing('a', 1), thing('b', 5), thing('c', 3)];
    const result = popupsFor({
      beats: [],
      things,
      years: 0,
      heightM: 10,
      compaction: at(1),
      selection: sel('latest', 'latest'),
    });

    expect(openId(result.left)).toBe('b');
    expect(result.left.open?.side).toBe('left');
    expect(pinIds(result.left).sort()).toEqual(['a', 'c']);
    expect(result.left.pins.every((p) => membersOf(p).length === 1)).toBe(true);
  });

  it('opens the thing matching a selected id, not just the tallest', () => {
    const things = [thing('a', 1), thing('b', 5), thing('c', 3)];
    const result = popupsFor({
      beats: [],
      things,
      years: 0,
      heightM: 10,
      compaction: at(1),
      selection: sel('latest', 'a'),
    });

    expect(openId(result.left)).toBe('a');
  });

  it('bundles two things sharing a drawn brick into one pin, keeping every member', () => {
    const a = thing('a', 5);
    const b = thing('b', 5.001); // close enough to floor into the same brick as `a` at unit 1
    const c = thing('c', 20);
    const result = popupsFor({
      beats: [],
      things: [a, b, c],
      years: 0,
      heightM: 25,
      compaction: at(1),
      selection: sel('latest', 'latest'),
    });

    expect(openId(result.left)).toBe('c');
    expect(result.left.pins).toHaveLength(1);
    expect(pinIds(result.left)).toEqual(['a', 'b']);
  });

  it('gives nothing when nothing has passed', () => {
    const things = [thing('a', 5)];
    const result = popupsFor({
      beats: [],
      things,
      years: 0,
      heightM: 0,
      compaction: at(1),
      selection: sel('latest', 'latest'),
    });

    expect(result.left.open).toBeNull();
    expect(result.left.pins).toEqual([]);
  });

  it('removes a thing (and its pin) once undo drops the height below it', () => {
    const things = [thing('a', 2), thing('b', 5)];
    const before = popupsFor({
      beats: [],
      things,
      years: 0,
      heightM: 6,
      compaction: at(1),
      selection: sel('latest', 'latest'),
    });
    expect(openId(before.left)).toBe('b');
    expect(before.left.pins).toHaveLength(1);

    const after = popupsFor({
      beats: [],
      things,
      years: 0,
      heightM: 3,
      compaction: at(1),
      selection: sel('latest', 'latest'),
    });
    expect(openId(after.left)).toBe('a');
    expect(after.left.pins).toEqual([]);
  });
});

describe('popupsFor: both sides at once', () => {
  it('keeps one open popup per side, independently of the other', () => {
    const beats = [beat('a', 12), beat('b', 30)];
    const things = [thing('t1', 2), thing('t2', 5)];
    const result = popupsFor({
      beats,
      things,
      years: 40,
      heightM: 6,
      compaction: at(1),
      selection: sel('latest', 'latest'),
    });

    expect(openId(result.right)).toBe('b');
    expect(openId(result.left)).toBe('t2');
  });
});

describe('PopupSelection', () => {
  it('has no null state on either side (compile-time only, enforced by npm run typecheck)', () => {
    // @ts-expect-error right must be an id or 'latest', never null
    const invalidRight: PopupSelection = { right: null, left: 'latest' };
    // @ts-expect-error left must be an id or 'latest', never null
    const invalidLeft: PopupSelection = { right: 'latest', left: null };
    expect(invalidRight).toBeTruthy();
    expect(invalidLeft).toBeTruthy();
  });
});

describe('selectionAfterArrivals', () => {
  it('takes a pinned side back to its latest fact when something arrives on it', () => {
    expect(selectionAfterArrivals({ right: 'a', left: 't1' }, { right: true, left: false })).toEqual({
      right: 'latest',
      left: 't1',
    });
  });

  it('leaves both sides alone when nothing arrived', () => {
    expect(selectionAfterArrivals({ right: 'latest', left: 't1' }, { right: false, left: false })).toEqual({
      right: 'latest',
      left: 't1',
    });
  });
});
