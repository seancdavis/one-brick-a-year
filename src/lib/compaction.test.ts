import { describe, expect, it } from 'vitest';
import {
  BRICK_PX,
  COMPACT_MS,
  courseHeightPx,
  drawnBricks,
  effectiveRenderUnit,
  EXPAND_FRACTION,
  INITIAL_COMPACTION,
  MAX_DRAWN,
  pxPerMeter,
  renderCourses,
  renderUnit,
  stepCompaction,
  unitLabel,
  visualUnit,
  type Compaction,
} from './compaction';
import { TOTAL_YEARS } from './constants';

const DT_MS = 1000 / 60;

// Steps until no transition is in flight, so tests can assert on the
// settled unit rather than mid-transition state.
function settle(c: Compaction, bricks: number, frames: number, reducedMotion = false): Compaction {
  let next = c;
  for (let i = 0; i < frames; i++) {
    next = stepCompaction(next, bricks, DT_MS, reducedMotion);
  }
  return next;
}

describe('drawnBricks', () => {
  it('floors bricks divided by unit', () => {
    expect(drawnBricks(25, 10)).toBe(2);
    expect(drawnBricks(9, 10)).toBe(0);
  });
});

describe('stepCompaction', () => {
  it('goes from unit 1 to unit 10 once drawn bricks at unit 1 exceed MAX_DRAWN, after the transition completes', () => {
    const bricks = MAX_DRAWN + 1;
    let c = settle(INITIAL_COMPACTION, bricks, 1);
    expect(c.transition).not.toBeNull();
    expect(c.unit).toBe(1); // still mid-transition, not yet finalized

    c = settle(c, bricks, 60);
    expect(c.transition).toBeNull();
    expect(c.unit).toBe(10);
  });

  it('does not start a transition while drawn bricks are at or below MAX_DRAWN', () => {
    const c = settle(INITIAL_COMPACTION, MAX_DRAWN, 10);
    expect(c.unit).toBe(1);
    expect(c.transition).toBeNull();
  });

  it('returns to unit 1 only once drawn bricks at unit 1 are at or below 80% of MAX_DRAWN, not merely below MAX_DRAWN', () => {
    // Drive to unit 10 first (200 bricks: drawn count at unit 10 is exactly
    // MAX_DRAWN, so it settles there instead of cascading further).
    const c = settle(INITIAL_COMPACTION, MAX_DRAWN * 10, 60);
    expect(c.unit).toBe(10);

    // Just below MAX_DRAWN (19 bricks at unit 1) is not <= 80% of it (16):
    // no expansion yet.
    const justBelowMax = MAX_DRAWN - 1;
    const stillCompacted = settle(c, justBelowMax, 60);
    expect(stillCompacted.unit).toBe(10);

    // At exactly EXPAND_FRACTION * MAX_DRAWN, it expands back.
    const atThreshold = Math.floor(MAX_DRAWN * EXPAND_FRACTION);
    const expanded = settle(c, atThreshold, 60);
    expect(expanded.unit).toBe(1);
  });

  it('completes a transition in one step under reduced motion', () => {
    const bricks = MAX_DRAWN + 1;
    const c = stepCompaction(INITIAL_COMPACTION, bricks, DT_MS, true);
    expect(c.transition).toBeNull();
    expect(c.unit).toBe(10);
  });

  it('a full build from 0 to TOTAL_YEARS, stepped in chunks, ends with a power-of-ten unit and drawn bricks within MAX_DRAWN', () => {
    let c: Compaction = INITIAL_COMPACTION;
    const totalBricks = Math.floor(TOTAL_YEARS);
    const CHUNK_BRICKS = 5e7;

    for (let bricks = 0; bricks <= totalBricks; bricks += CHUNK_BRICKS) {
      for (let i = 0; i < 40; i++) {
        c = stepCompaction(c, bricks, DT_MS * 3, false);
      }
    }
    // Flush any transition still in flight at the final brick count.
    c = settle(c, totalBricks, 60);

    expect(c.transition).toBeNull();
    expect(Number.isInteger(Math.log10(c.unit))).toBe(true);
    expect([1e8, 1e9]).toContain(c.unit);
    expect(drawnBricks(totalBricks, c.unit)).toBeLessThanOrEqual(MAX_DRAWN);
  });
});

describe('visualUnit', () => {
  it('is continuous: equals from at elapsed 0 and to at COMPACT_MS', () => {
    const c: Compaction = { unit: 1, transition: { from: 1, to: 10, elapsedMs: 0 } };
    expect(visualUnit(c)).toBeCloseTo(1, 10);

    const done: Compaction = { unit: 1, transition: { from: 1, to: 10, elapsedMs: COMPACT_MS } };
    expect(visualUnit(done)).toBeCloseTo(10, 10);
  });

  it('equals unit when idle', () => {
    expect(visualUnit({ unit: 100, transition: null })).toBe(100);
  });
});

describe('pxPerMeter', () => {
  it('is a tenth at unit 10 compared to unit 1', () => {
    const base = pxPerMeter({ unit: 1, transition: null });
    const compacted = pxPerMeter({ unit: 10, transition: null });
    expect(compacted).toBeCloseTo(base / 10, 10);
  });
});

describe('renderUnit', () => {
  it('is unit when idle', () => {
    expect(renderUnit({ unit: 100, transition: null })).toBe(100);
  });

  it('is the finer (smaller) of from and to during a compaction, where to > from', () => {
    const c: Compaction = { unit: 1, transition: { from: 1, to: 10, elapsedMs: 200 } };
    expect(renderUnit(c)).toBe(1);
  });

  it('is the finer (smaller) of from and to during an expansion, where to < from', () => {
    const c: Compaction = { unit: 10, transition: { from: 10, to: 1, elapsedMs: 200 } };
    expect(renderUnit(c)).toBe(1);
  });
});

describe('renderCourses', () => {
  it('matches drawnBricks when idle', () => {
    expect(renderCourses(25, { unit: 10, transition: null })).toBe(drawnBricks(25, 10));
  });

  it('draws every fine brick, unchanged in count, through a compaction (shrinking, not disappearing)', () => {
    const start: Compaction = { unit: 1, transition: { from: 1, to: 10, elapsedMs: 0 } };
    const end: Compaction = { unit: 1, transition: { from: 1, to: 10, elapsedMs: COMPACT_MS } };
    expect(renderCourses(25, start)).toBe(25);
    expect(renderCourses(25, end)).toBe(25);
  });

  it('a 16-brick expansion from 10 to 1 renders 16 courses growing from 3px to 30px each', () => {
    const start: Compaction = { unit: 10, transition: { from: 10, to: 1, elapsedMs: 0 } };
    const end: Compaction = { unit: 10, transition: { from: 10, to: 1, elapsedMs: COMPACT_MS } };
    expect(renderCourses(16, start)).toBe(16);
    expect(renderCourses(16, end)).toBe(16);
    expect(courseHeightPx(16, start)).toBeCloseTo(3, 10);
    expect(courseHeightPx(16, end)).toBeCloseTo(30, 10);
  });

  it('is never zero for bricks a state can actually reach: idle at or above its own unit, or mid-transition', () => {
    expect(renderCourses(1, { unit: 1, transition: null })).toBeGreaterThan(0);
    expect(renderCourses(10, { unit: 10, transition: null })).toBeGreaterThan(0);
    expect(renderCourses(9, { unit: 1, transition: { from: 1, to: 10, elapsedMs: 0 } })).toBeGreaterThan(0);
    expect(renderCourses(16, { unit: 10, transition: { from: 10, to: 1, elapsedMs: 0 } })).toBeGreaterThan(0);
    expect(renderCourses(16, { unit: 10, transition: { from: 10, to: 1, elapsedMs: COMPACT_MS } })).toBeGreaterThan(0);
  });

  it('never drops to zero as bricks decrease during an active 10 -> 1 expansion (e.g. 12 down to 9)', () => {
    const c: Compaction = { unit: 10, transition: { from: 10, to: 1, elapsedMs: 100 } };
    expect(renderCourses(12, c)).toBeGreaterThan(0);
    expect(renderCourses(9, c)).toBeGreaterThan(0);
  });
});

describe('renderCourses x courseHeightPx (drawn height)', () => {
  it('is exactly continuous at both ends of a compaction and of an expansion, for bricks a multiple of the coarse unit', () => {
    const bricks = 20; // a multiple of the coarse unit (10) on both sides
    const heightAt = (b: number, c: Compaction) => renderCourses(b, c) * courseHeightPx(b, c);

    const idleFine: Compaction = { unit: 1, transition: null };
    const compactStart: Compaction = { unit: 1, transition: { from: 1, to: 10, elapsedMs: 0 } };
    const compactEnd: Compaction = { unit: 1, transition: { from: 1, to: 10, elapsedMs: COMPACT_MS } };
    const idleCoarse: Compaction = { unit: 10, transition: null };
    expect(heightAt(bricks, compactStart)).toBeCloseTo(heightAt(bricks, idleFine), 8);
    expect(heightAt(bricks, compactEnd)).toBeCloseTo(heightAt(bricks, idleCoarse), 8);

    const expandStart: Compaction = { unit: 10, transition: { from: 10, to: 1, elapsedMs: 0 } };
    const expandEnd: Compaction = { unit: 10, transition: { from: 10, to: 1, elapsedMs: COMPACT_MS } };
    expect(heightAt(bricks, expandStart)).toBeCloseTo(heightAt(bricks, idleCoarse), 8);
    expect(heightAt(bricks, expandEnd)).toBeCloseTo(heightAt(bricks, idleFine), 8);
  });

  it('for non-multiples, the jump at either end of either transition is less than one coarse brick (BRICK_PX)', () => {
    const bricks = 25; // not a multiple of the coarse unit (10)
    const heightAt = (b: number, c: Compaction) => renderCourses(b, c) * courseHeightPx(b, c);
    const idleCoarse: Compaction = { unit: 10, transition: null };

    const compactEnd: Compaction = { unit: 1, transition: { from: 1, to: 10, elapsedMs: COMPACT_MS } };
    const expandStart: Compaction = { unit: 10, transition: { from: 10, to: 1, elapsedMs: 0 } };
    expect(Math.abs(heightAt(bricks, compactEnd) - heightAt(bricks, idleCoarse))).toBeLessThan(BRICK_PX);
    expect(Math.abs(heightAt(bricks, expandStart) - heightAt(bricks, idleCoarse))).toBeLessThan(BRICK_PX);
  });
});

describe('effectiveRenderUnit', () => {
  it('never lets renderCourses floor to zero during a fast multi-level undo (a 1000 -> 100 expansion, bricks falling from 82 to 5)', () => {
    const c: Compaction = { unit: 1000, transition: { from: 1000, to: 100, elapsedMs: 250 } };
    for (let bricks = 82; bricks >= 5; bricks--) {
      expect(renderCourses(bricks, c)).toBeGreaterThan(0);
    }
  });

  it('a 100 -> 10 expansion with 9 bricks renders 9 courses (renderUnit alone would floor this to 0)', () => {
    const c: Compaction = { unit: 100, transition: { from: 100, to: 10, elapsedMs: 250 } };
    expect(renderUnit(c)).toBe(10);
    expect(drawnBricks(9, renderUnit(c))).toBe(0); // the bug this guards against
    expect(renderCourses(9, c)).toBe(9);
  });

  it('the legend unit matches the unit renderCourses actually drew with, in both cases above', () => {
    const expanding: Compaction = { unit: 1000, transition: { from: 1000, to: 100, elapsedMs: 250 } };
    const bricksA = 5;
    const unitA = effectiveRenderUnit(expanding, bricksA);
    expect(renderCourses(bricksA, expanding)).toBe(drawnBricks(bricksA, unitA));
    expect(unitLabel(unitA)).toBe('each brick is one year');

    const expandingOnce: Compaction = { unit: 100, transition: { from: 100, to: 10, elapsedMs: 250 } };
    const bricksB = 9;
    const unitB = effectiveRenderUnit(expandingOnce, bricksB);
    expect(renderCourses(bricksB, expandingOnce)).toBe(drawnBricks(bricksB, unitB));
    expect(unitLabel(unitB)).toBe('each brick is one year');
  });
});

describe('unitLabel', () => {
  it('describes each power-of-ten unit', () => {
    expect(unitLabel(1)).toBe('each brick is one year');
    expect(unitLabel(10)).toBe('each brick is 10 years');
    expect(unitLabel(100)).toBe('each brick is 100 years');
    expect(unitLabel(1000)).toBe('each brick is 1,000 years');
    expect(unitLabel(10000)).toBe('each brick is 10,000 years');
    expect(unitLabel(100000)).toBe('each brick is 100,000 years');
    expect(unitLabel(1e6)).toBe('each brick is 1 million years');
    expect(unitLabel(1e7)).toBe('each brick is 10 million years');
    expect(unitLabel(1e8)).toBe('each brick is 100 million years');
    expect(unitLabel(1e9)).toBe('each brick is 1 billion years');
  });
});
