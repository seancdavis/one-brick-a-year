import { describe, expect, it } from 'vitest';
import { BRICK_M, SMOOTH_S, SMOOTH_SNAP_YEARS, TOTAL_YEARS } from './constants';

describe('constants', () => {
  it('BRICK_M is a positive height', () => {
    expect(BRICK_M).toBeGreaterThan(0);
  });

  it('TOTAL_YEARS is positive', () => {
    expect(TOTAL_YEARS).toBeGreaterThan(0);
  });

  it('SMOOTH_S is a positive time constant', () => {
    expect(SMOOTH_S).toBeGreaterThan(0);
  });

  it('SMOOTH_SNAP_YEARS is a small positive threshold', () => {
    expect(SMOOTH_SNAP_YEARS).toBeGreaterThan(0);
  });
});
