import { describe, expect, it } from 'vitest';
import {
  COMPACT_MS,
  drawnBricks,
  EXPAND_FRACTION,
  INITIAL_COMPACTION,
  MAX_DRAWN,
  pxPerMeter,
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
