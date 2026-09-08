import { describe, expect, it } from 'vitest';
import { countSentences, fmtCount, fmtInt, fmtMeters, fmtYears, yearsAgo } from './format';

describe('fmtYears', () => {
  it('formats billions', () => {
    expect(fmtYears(4.6e9)).toBe('4.6 billion years');
  });

  it('formats millions', () => {
    expect(fmtYears(66e6)).toBe('66 million years');
  });

  it('formats thousands with a comma', () => {
    expect(fmtYears(5000)).toBe('5,000 years');
  });

  it('formats small numbers plainly', () => {
    expect(fmtYears(31)).toBe('31 years');
  });

  it('singularizes exactly one year', () => {
    expect(fmtYears(1)).toBe('1 year');
  });
});

describe('fmtCount', () => {
  it('singularizes exactly one', () => {
    expect(fmtCount(1, 'brick')).toBe('1 brick');
    expect(fmtCount(1, 'year')).toBe('1 year');
  });

  it('pluralizes everything else, zero included', () => {
    expect(fmtCount(0, 'brick')).toBe('0 bricks');
    expect(fmtCount(2, 'year')).toBe('2 years');
  });

  it('keeps the exact number, with thousands separators and never abbreviated', () => {
    expect(fmtCount(1234567, 'brick')).toBe('1,234,567 bricks');
  });

  it('rounds to the nearest whole before deciding singular or plural', () => {
    expect(fmtCount(1.4, 'brick')).toBe('1 brick');
    expect(fmtCount(1.6, 'brick')).toBe('2 bricks');
  });
});

describe('fmtMeters', () => {
  it('formats sub-meter values as centimeters', () => {
    expect(fmtMeters(0.077)).toBe('7.7 cm');
  });

  it('formats small meter values with two decimals', () => {
    expect(fmtMeters(2.0)).toBe('2.00 m');
  });

  it('formats larger meter values rounded', () => {
    expect(fmtMeters(48)).toBe('48 m');
  });

  it('formats kilometers rounded', () => {
    expect(fmtMeters(633600)).toBe('634 km');
  });

  it('formats large kilometers with a comma', () => {
    expect(fmtMeters(44160000)).toBe('44,160 km');
  });
});

describe('fmtInt', () => {
  it('adds thousands separators', () => {
    expect(fmtInt(1234567)).toBe('1,234,567');
  });

  it('rounds to the nearest integer', () => {
    expect(fmtInt(4.6)).toBe('5');
  });
});

describe('yearsAgo', () => {
  it('singularizes exactly one year', () => {
    expect(yearsAgo(1)).toBe('1 year ago');
  });

  it('appends "ago" to fmtYears otherwise', () => {
    expect(yearsAgo(57)).toBe('57 years ago');
    expect(yearsAgo(5000)).toBe('5,000 years ago');
    expect(yearsAgo(4.6e9)).toBe('4.6 billion years ago');
  });
});

describe('countSentences', () => {
  it('counts plain sentence terminators', () => {
    expect(countSentences('One sentence.')).toBe(1);
    expect(countSentences('Two sentences. Right here.')).toBe(2);
  });

  it('does not count a decimal point between digits', () => {
    expect(countSentences('It weighs 4.6 billion years worth of bricks.')).toBe(1);
  });

  it('does not count a short-title or single-letter abbreviation', () => {
    expect(countSentences('T. rex lived here. So did Mrs. Jones.')).toBe(2);
  });

  it('counts a run of terminators as one sentence end', () => {
    expect(countSentences('Really?! Yes.')).toBe(2);
  });

  it('gives zero for a line with no terminator', () => {
    expect(countSentences('No punctuation here')).toBe(0);
  });
});
