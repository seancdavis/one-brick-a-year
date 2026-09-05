import { describe, expect, it } from 'vitest';
import { colorById, DEFAULT_COLOR_ID, LEGO_COLORS, shade } from './lego-colors';

describe('LEGO_COLORS', () => {
  it('has exactly 12 colors', () => {
    expect(LEGO_COLORS.length).toBe(12);
  });

  it('has unique ids', () => {
    const ids = LEGO_COLORS.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('has valid 6-digit hex values', () => {
    for (const color of LEGO_COLORS) {
      expect(color.hex).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });

  it('includes the default color id', () => {
    expect(LEGO_COLORS.some((c) => c.id === DEFAULT_COLOR_ID)).toBe(true);
  });
});

describe('colorById', () => {
  it('finds a color by id', () => {
    expect(colorById('bright-blue')).toEqual({ id: 'bright-blue', name: 'Bright Blue', hex: '#0055BF' });
  });

  it('falls back to the default color for an unknown id', () => {
    expect(colorById('nope').id).toBe(DEFAULT_COLOR_ID);
  });
});

describe('shade', () => {
  it('lightens toward white for a positive amount', () => {
    const base = '#808080';
    const lighter = shade(base, 0.5);
    expect(parseInt(lighter.slice(1), 16)).toBeGreaterThan(parseInt(base.slice(1), 16));
  });

  it('darkens toward black for a negative amount', () => {
    const base = '#808080';
    const darker = shade(base, -0.5);
    expect(parseInt(darker.slice(1), 16)).toBeLessThan(parseInt(base.slice(1), 16));
  });

  it('reaches white and black at the extremes', () => {
    expect(shade('#123456', 1)).toBe('#ffffff');
    expect(shade('#123456', -1)).toBe('#000000');
  });

  it('is a no-op at amount 0', () => {
    expect(shade('#123456', 0)).toBe('#123456');
  });
});
