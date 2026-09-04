import { describe, expect, it } from 'vitest';
import { parseSessionEnd, parseSessionStart } from './session-payload';

describe('parseSessionStart', () => {
  it('parses a fully valid payload', () => {
    expect(
      parseSessionStart({
        ageYears: 8,
        homeMeters: 8,
        colorId: 'bright-red',
        soundOn: true,
        inputKind: 'wheel',
        viewportW: 1024,
        viewportH: 768,
        deviceKind: 'desktop',
        browserFamily: 'chrome',
      }),
    ).toEqual({
      ageYears: 8,
      homeMeters: 8,
      colorId: 'bright-red',
      soundOn: true,
      inputKind: 'wheel',
      viewportW: 1024,
      viewportH: 768,
      deviceKind: 'desktop',
      browserFamily: 'chrome',
    });
  });

  it('fills every field with null when the body is empty', () => {
    expect(parseSessionStart({})).toEqual({
      ageYears: null,
      homeMeters: null,
      colorId: null,
      soundOn: null,
      inputKind: null,
      viewportW: null,
      viewportH: null,
      deviceKind: null,
      browserFamily: null,
    });
  });

  it.each([null, undefined, 'x', 42, []])('rejects a non-object body (%j)', (body) => {
    expect(parseSessionStart(body)).toBeNull();
  });

  it('rejects any body carrying a name key, however innocuous the value', () => {
    expect(parseSessionStart({ name: 'Ada', ageYears: 8 })).toBeNull();
    expect(parseSessionStart({ name: null })).toBeNull();
    expect(parseSessionStart({ name: undefined })).toBeNull();
  });

  it.each([0, 121, 1.5, -1, 'abc', null])('drops an out-of-range or non-integer age (%j)', (age) => {
    expect(parseSessionStart({ ageYears: age })?.ageYears).toBeNull();
  });

  it.each([1, 120])('accepts age at the boundary (%j)', (age) => {
    expect(parseSessionStart({ ageYears: age })?.ageYears).toBe(age);
  });

  it.each([0, 1001, 'abc', null])('drops an out-of-range or non-numeric home height (%j)', (home) => {
    expect(parseSessionStart({ homeMeters: home })?.homeMeters).toBeNull();
  });

  it('accepts a fractional home height within range', () => {
    expect(parseSessionStart({ homeMeters: 8.5 })?.homeMeters).toBe(8.5);
  });

  it.each(['Bright-Red', 'bright red', 'bright_red', '', 'a'.repeat(41), 123])(
    'drops an invalid color id (%j)',
    (colorId) => {
      expect(parseSessionStart({ colorId })?.colorId).toBeNull();
    },
  );

  it('accepts a well-formed color id up to 40 chars', () => {
    expect(parseSessionStart({ colorId: 'bright-yellowish-green' })?.colorId).toBe('bright-yellowish-green');
  });

  it.each(['on', 1, null])('drops a non-boolean soundOn (%j)', (soundOn) => {
    expect(parseSessionStart({ soundOn })?.soundOn).toBeNull();
  });

  it.each(['mouse', 'trackpad', 123, null])('drops an unrecognized inputKind (%j)', (inputKind) => {
    expect(parseSessionStart({ inputKind })?.inputKind).toBeNull();
  });

  it.each(['wheel', 'touch', 'keyboard'] as const)('accepts a recognized inputKind (%j)', (inputKind) => {
    expect(parseSessionStart({ inputKind })?.inputKind).toBe(inputKind);
  });

  it.each([-1, 10001, 800.5, 'abc'])('drops an out-of-range or non-integer viewport dimension (%j)', (v) => {
    const parsed = parseSessionStart({ viewportW: v, viewportH: v });
    expect(parsed?.viewportW).toBeNull();
    expect(parsed?.viewportH).toBeNull();
  });

  it.each([0, 10000])('accepts a viewport dimension at the boundary (%j)', (v) => {
    const parsed = parseSessionStart({ viewportW: v, viewportH: v });
    expect(parsed?.viewportW).toBe(v);
    expect(parsed?.viewportH).toBe(v);
  });

  it.each(['phone', 'tablet', 'desktop'] as const)('accepts an allowlisted deviceKind (%j)', (deviceKind) => {
    expect(parseSessionStart({ deviceKind })?.deviceKind).toBe(deviceKind);
  });

  it.each(['watch', 'Desktop', '', 123, null])('drops a deviceKind outside the allowlist (%j)', (deviceKind) => {
    expect(parseSessionStart({ deviceKind })?.deviceKind).toBeNull();
  });

  it.each(['chrome', 'safari', 'firefox', 'edge', 'other'] as const)(
    'accepts an allowlisted browserFamily (%j)',
    (browserFamily) => {
      expect(parseSessionStart({ browserFamily })?.browserFamily).toBe(browserFamily);
    },
  );

  it.each(['opera', 'Chrome', '', 123, null])('drops a browserFamily outside the allowlist (%j)', (browserFamily) => {
    expect(parseSessionStart({ browserFamily })?.browserFamily).toBeNull();
  });
});

describe('parseSessionEnd', () => {
  it('parses a fully valid payload', () => {
    expect(parseSessionEnd({ durationMs: 60000, yearsReached: 1000, finished: true })).toEqual({
      durationMs: 60000,
      yearsReached: 1000,
      finished: true,
    });
  });

  it('defaults every field when the body is empty', () => {
    expect(parseSessionEnd({})).toEqual({ durationMs: 0, yearsReached: 0, finished: false });
  });

  it.each([null, undefined, 'x', 42, []])('rejects a non-object body (%j)', (body) => {
    expect(parseSessionEnd(body)).toBeNull();
  });

  it('rejects any body carrying a name key', () => {
    expect(parseSessionEnd({ name: 'Ada', durationMs: 1000 })).toBeNull();
  });

  it('clamps a negative durationMs up to 0', () => {
    expect(parseSessionEnd({ durationMs: -500 })?.durationMs).toBe(0);
  });

  it('clamps a durationMs over 24 hours down to the max', () => {
    expect(parseSessionEnd({ durationMs: 999_999_999 })?.durationMs).toBe(86_400_000);
  });

  it('rounds a fractional durationMs', () => {
    expect(parseSessionEnd({ durationMs: 1234.6 })?.durationMs).toBe(1235);
  });

  it('falls back to 0 for a non-numeric durationMs', () => {
    expect(parseSessionEnd({ durationMs: 'abc' })?.durationMs).toBe(0);
  });

  it('clamps a negative yearsReached up to 0', () => {
    expect(parseSessionEnd({ yearsReached: -1 })?.yearsReached).toBe(0);
  });

  it('clamps yearsReached above TOTAL_YEARS down to it', () => {
    expect(parseSessionEnd({ yearsReached: 9e9 })?.yearsReached).toBe(4.6e9);
  });

  it('keeps a fractional yearsReached within range as-is', () => {
    expect(parseSessionEnd({ yearsReached: 1234.5 })?.yearsReached).toBe(1234.5);
  });

  it.each([
    [true, true],
    [false, false],
    [1, true],
    [0, false],
    ['yes', true],
    ['', false],
    [null, false],
    [undefined, false],
  ])('coerces finished (%j) to boolean %j', (input, expected) => {
    expect(parseSessionEnd({ finished: input })?.finished).toBe(expected);
  });
});
