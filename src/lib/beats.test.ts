import { describe, expect, it } from 'vitest';
import { BEATS, beatsCrossed } from './beats';

describe('BEATS', () => {
  it('is sorted ascending by atYears', () => {
    for (let i = 1; i < BEATS.length; i++) {
      expect(BEATS[i].atYears).toBeGreaterThan(BEATS[i - 1].atYears);
    }
  });

  it('gives every beat a non-empty beforePhrase', () => {
    for (const beat of BEATS) {
      expect(typeof beat.beforePhrase).toBe('string');
      expect(beat.beforePhrase.length).toBeGreaterThan(0);
    }
  });
});

describe('beatsCrossed', () => {
  it('crosses the writing beat exactly once between 4,000 and 6,000 years', () => {
    const crossed = beatsCrossed(4000, 6000);
    expect(crossed.map((b) => b.id)).toEqual(['writing']);
  });

  it('crosses all seven beats in ascending order from 0 to 4.6e9', () => {
    const crossed = beatsCrossed(0, 4.6e9);
    expect(crossed.map((b) => b.id)).toEqual(BEATS.map((b) => b.id));
    expect(crossed).toHaveLength(7);
  });

  it('yields nothing crossing 6,000 to 6,000 after already crossing 4,000 to 6,000', () => {
    expect(beatsCrossed(4000, 6000).map((b) => b.id)).toEqual(['writing']);
    expect(beatsCrossed(6000, 6000)).toEqual([]);
  });

  it('yields nothing on a second, non-overlapping call once a beat has already been crossed', () => {
    expect(beatsCrossed(4000, 6000).map((b) => b.id)).toEqual(['writing']);
    expect(beatsCrossed(6000, 8000)).toEqual([]);
  });
});
