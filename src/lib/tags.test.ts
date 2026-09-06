import { describe, expect, it } from 'vitest';
import { BEATS, type Beat } from './beats';
import type { Compaction } from './compaction';
import { TOTAL_YEARS } from './constants';
import { bricksFor } from './sim';
import { tagsFor } from './tags';

// effectiveRenderUnit clamps the unit down to the largest power of ten at
// most `bricks`, so a test that wants a coarse unit has to hand tagsFor a
// brick count big enough to actually be drawn at it.
function at(unit: number): Compaction {
  return { unit, transition: null };
}

function beat(id: string, atYears: number): Beat {
  return { id, atYears, title: id, line: `${id} line`, icon: 'bricks', paper: 'mustard' };
}

describe('tagsFor', () => {
  it('gives a passed event one tag, on the course for its year', () => {
    const beats = [beat('a', 12)];
    const models = tagsFor(beats, 40, at(1), bricksFor(40));

    expect(models).toHaveLength(1);
    expect(models[0].kind).toBe('tag');
    expect(models[0].bricksFromGround).toBe(12);
    expect(models[0].events.map((e) => e.id)).toEqual(['a']);
  });

  it('bundles two events that fall inside the same drawn brick', () => {
    // At unit 10 both 41 and 47 land in drawn brick 4.
    const beats = [beat('a', 41), beat('b', 47)];
    const models = tagsFor(beats, 100, at(10), bricksFor(100));

    expect(models).toHaveLength(1);
    expect(models[0].kind).toBe('bundle');
    expect(models[0].bricksFromGround).toBe(4);
    expect(models[0].events.map((e) => e.id)).toEqual(['a', 'b']);
  });

  it('splits the same two events back into two tags once the tower expands', () => {
    const beats = [beat('a', 41), beat('b', 47)];
    const models = tagsFor(beats, 100, at(1), bricksFor(100));

    expect(models.map((m) => m.kind)).toEqual(['tag', 'tag']);
    expect(models.map((m) => m.bricksFromGround)).toEqual([41, 47]);
    expect(models.flatMap((m) => m.events.map((e) => e.id))).toEqual(['a', 'b']);
  });

  it('lists a bundle ascending by years however the events were authored', () => {
    const beats = [beat('later', 47), beat('earlier', 41)];
    const models = tagsFor(beats, 100, at(10), bricksFor(100));

    expect(models[0].events.map((e) => e.id)).toEqual(['earlier', 'later']);
  });

  it('drops an event whose tag has been scrolled back below', () => {
    const beats = [beat('a', 12), beat('b', 30)];

    expect(tagsFor(beats, 40, at(1), bricksFor(40)).map((m) => m.bricksFromGround)).toEqual([12, 30]);
    expect(tagsFor(beats, 20, at(1), bricksFor(20)).map((m) => m.bricksFromGround)).toEqual([12]);
    expect(tagsFor(beats, 12, at(1), bricksFor(12)).map((m) => m.bricksFromGround)).toEqual([12]);
    expect(tagsFor(beats, 11, at(1), bricksFor(11))).toEqual([]);
  });

  it('gives nothing when nothing has been passed', () => {
    expect(tagsFor([beat('a', 12)], 0, at(1), 0)).toEqual([]);
  });

  it('folds the whole finished stack into a handful of bundles, each event exactly once', () => {
    const bricks = bricksFor(TOTAL_YEARS);
    const models = tagsFor(BEATS, TOTAL_YEARS, at(1e9), bricks);

    expect(models.length).toBeLessThanOrEqual(6);

    const ids = models.flatMap((m) => m.events.map((e) => e.id));
    expect(ids).toHaveLength(BEATS.length);
    expect(new Set(ids).size).toBe(BEATS.length);

    // Ascending, and every model's brick is the one its own events land in.
    const bricksFromGround = models.map((m) => m.bricksFromGround);
    expect([...bricksFromGround].sort((a, b) => a - b)).toEqual(bricksFromGround);
    for (const model of models) {
      for (const event of model.events) {
        expect(Math.floor(event.atYears / 1e9)).toBe(model.bricksFromGround);
      }
      expect(model.kind).toBe(model.events.length > 1 ? 'bundle' : 'tag');
    }
  });
});
