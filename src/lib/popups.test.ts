import { describe, expect, it } from 'vitest';
import { BEATS, type Beat } from './beats';
import type { Compaction } from './compaction';
import { BRICK_M, TOTAL_YEARS } from './constants';
import type { ThingLandmark } from './landmarks';
import { popupsFor, type PopupSelection } from './popups';

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

describe('popupsFor: right side (time events)', () => {
  it('opens the one passed event, with nothing else as a pin', () => {
    const beats = [beat('a', 12)];
    const result = popupsFor({ beats, things: [], years: 40, heightM: 0, compaction: at(1), selection: sel('latest') });

    expect(result.right.open?.bricksFromGround).toBe(12);
    expect(result.right.open?.event?.id).toBe('a');
    expect(result.right.pins).toEqual([]);
  });

  it('keeps only the latest event open; older ones become pins with the right count', () => {
    const beats = [beat('a', 12), beat('b', 30)];
    const result = popupsFor({ beats, things: [], years: 40, heightM: 0, compaction: at(1), selection: sel('latest') });

    expect(result.right.open?.event?.id).toBe('b');
    expect(result.right.pins).toHaveLength(1);
    expect(result.right.pins[0].bricksFromGround).toBe(12);
    expect(result.right.pins[0].count).toBe(1);
  });

  it('opens the newest fact of a compacted brick and pins the rest of that same brick', () => {
    // At unit 10, 21, 26 and 27 all land in drawn brick 2. The most recently
    // passed of them — the highest atYears — is what the page is saying, so
    // it opens; its brick still carries a pin, for the two it left behind.
    const beats = [beat('oldest', 21), beat('middle', 26), beat('newest', 27)];
    const result = popupsFor({ beats, things: [], years: 100, heightM: 0, compaction: at(10), selection: sel('latest') });

    expect(result.right.open?.event?.id).toBe('newest');
    expect(result.right.open?.bricksFromGround).toBe(2);
    expect(result.right.pins).toHaveLength(1);
    expect(result.right.pins[0].bricksFromGround).toBe(2);
    expect(result.right.pins[0].count).toBe(2);
    expect(result.right.pins[0].events.map((e) => e.id)).toEqual(['oldest', 'middle']);
  });

  it('keeps the same event open across a compaction regroup', () => {
    const beats = [beat('oldest', 21), beat('middle', 26), beat('newest', 27)];
    const args = { beats, things: [], years: 100, heightM: 0 };

    const fine = popupsFor({ ...args, compaction: at(1), selection: sel('latest') });
    const coarse = popupsFor({ ...args, compaction: at(10), selection: sel('latest') });
    expect(fine.right.open?.event?.id).toBe('newest');
    expect(coarse.right.open?.event?.id).toBe('newest');

    // The same holds for a specifically selected fact: regrouping the bricks
    // underneath a reader must not swap what they are reading.
    const fineSelected = popupsFor({ ...args, compaction: at(1), selection: sel('oldest') });
    const coarseSelected = popupsFor({ ...args, compaction: at(10), selection: sel('oldest') });
    expect(fineSelected.right.open?.event?.id).toBe('oldest');
    expect(coarseSelected.right.open?.event?.id).toBe('oldest');
    expect(coarseSelected.right.pins.flatMap((p) => p.events.map((e) => e.id))).toEqual(['middle', 'newest']);
  });

  it('bundles two events sharing a drawn brick into one pin, ascending by year within it', () => {
    // At unit 10, both 41 and 47 land in drawn brick 4; 90 lands in brick 9.
    const beats = [beat('later-in-bundle', 47), beat('earlier-in-bundle', 41), beat('c', 90)];
    const result = popupsFor({ beats, things: [], years: 100, heightM: 0, compaction: at(10), selection: sel('latest') });

    expect(result.right.open?.event?.id).toBe('c');
    expect(result.right.pins).toHaveLength(1);
    expect(result.right.pins[0].bricksFromGround).toBe(4);
    expect(result.right.pins[0].count).toBe(2);
    expect(result.right.pins[0].events.map((e) => e.id)).toEqual(['earlier-in-bundle', 'later-in-bundle']);
  });

  it('opens a specifically selected id, not just the latest', () => {
    const beats = [beat('a', 12), beat('b', 30), beat('c', 90)];
    const result = popupsFor({ beats, things: [], years: 100, heightM: 0, compaction: at(1), selection: sel('a') });

    expect(result.right.open?.event?.id).toBe('a');
    const pinBricks = result.right.pins.map((p) => p.bricksFromGround).sort((x, y) => x - y);
    expect(pinBricks).toEqual([30, 90]);
  });

  it('opens nothing when the selection is null, even with events passed', () => {
    const beats = [beat('a', 12), beat('b', 30)];
    const result = popupsFor({ beats, things: [], years: 40, heightM: 0, compaction: at(1), selection: sel(null) });

    expect(result.right.open).toBeNull();
    expect(result.right.pins).toHaveLength(2);
  });

  it('opens nothing when the selected id is no longer passed, leaving src/main.ts to fall back', () => {
    const beats = [beat('a', 12), beat('b', 30)];
    const result = popupsFor({ beats, things: [], years: 20, heightM: 0, compaction: at(1), selection: sel('b') });

    expect(result.right.open).toBeNull();
    expect(result.right.pins.flatMap((p) => p.events.map((e) => e.id))).toEqual(['a']);
  });

  it('removes an event (and its pin) once undo drops it below', () => {
    const beats = [beat('a', 12), beat('b', 30)];
    const before = popupsFor({ beats, things: [], years: 40, heightM: 0, compaction: at(1), selection: sel('latest') });
    expect(before.right.open?.event?.id).toBe('b');
    expect(before.right.pins).toHaveLength(1);

    const after = popupsFor({ beats, things: [], years: 20, heightM: 0, compaction: at(1), selection: sel('latest') });
    expect(after.right.open?.event?.id).toBe('a');
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
    const ids = [result.right.open?.event?.id ?? '', ...result.right.pins.flatMap((p) => p.events.map((e) => e.id))];
    expect(ids).toHaveLength(BEATS.length);
    expect(new Set(ids).size).toBe(BEATS.length);

    // Each pin holds exactly the events of its own drawn brick, and no two
    // pins share a brick.
    const pinBricks = result.right.pins.map((p) => p.bricksFromGround);
    expect(new Set(pinBricks).size).toBe(pinBricks.length);
    for (const pin of result.right.pins) {
      for (const event of pin.events) {
        expect(Math.floor(event.atYears / 1e9)).toBe(pin.bricksFromGround);
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

    expect(result.left.open?.thing?.id).toBe('b');
    expect(result.left.open?.event).toBeUndefined();
    const pinIds = result.left.pins.flatMap((p) => p.things.map((t) => t.id)).sort();
    expect(pinIds).toEqual(['a', 'c']);
    expect(result.left.pins.every((p) => p.count === 1)).toBe(true);
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

    expect(result.left.open?.thing?.id).toBe('a');
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

    expect(result.left.open?.thing?.id).toBe('c');
    expect(result.left.pins).toHaveLength(1);
    expect(result.left.pins[0].things.map((t) => t.id)).toEqual(['a', 'b']);
    expect(result.left.pins[0].count).toBe(2);
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
    expect(before.left.open?.thing?.id).toBe('b');
    expect(before.left.pins).toHaveLength(1);

    const after = popupsFor({
      beats: [],
      things,
      years: 0,
      heightM: 3,
      compaction: at(1),
      selection: sel('latest', 'latest'),
    });
    expect(after.left.open?.thing?.id).toBe('a');
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

    expect(result.right.open?.event?.id).toBe('b');
    expect(result.left.open?.thing?.id).toBe('t2');
  });
});
