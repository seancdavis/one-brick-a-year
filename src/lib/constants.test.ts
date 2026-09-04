import { describe, expect, it } from 'vitest';
import { BRICK_M, RATE0, RATE_K, SCALE_MAX_M, SCALE_MIN_M, TOTAL_YEARS, ZOOM_FACTOR, ZOOM_TRIGGER } from './constants';

describe('constants', () => {
  it('the camera scale range is ordered min below max', () => {
    expect(SCALE_MIN_M).toBeLessThan(SCALE_MAX_M);
  });

  it('ZOOM_TRIGGER is a fraction of the screen, between 0 and 1', () => {
    expect(ZOOM_TRIGGER).toBeGreaterThan(0);
    expect(ZOOM_TRIGGER).toBeLessThan(1);
  });

  it('ZOOM_FACTOR grows the visible scale', () => {
    expect(ZOOM_FACTOR).toBeGreaterThan(1);
  });

  it('BRICK_M is a positive height', () => {
    expect(BRICK_M).toBeGreaterThan(0);
  });

  it('TOTAL_YEARS is positive', () => {
    expect(TOTAL_YEARS).toBeGreaterThan(0);
  });

  it('RATE0 is a positive starting rate', () => {
    expect(RATE0).toBeGreaterThan(0);
  });

  it('RATE_K is a positive growth constant', () => {
    expect(RATE_K).toBeGreaterThan(0);
  });
});
