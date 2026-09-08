import { describe, expect, it } from 'vitest';
import { DEFAULT_COLOR_ID } from './lego-colors';
import {
  DEFAULT_PROFILE,
  fillTokens,
  hasPersonalizationKeys,
  LINE_TOKENS,
  mergeParams,
  parsePersonalization,
  serialize,
  shouldScrubUrl,
  type Personalization,
} from './personalize';

describe('parsePersonalization', () => {
  it('applies defaults when nothing is provided', () => {
    expect(parsePersonalization(new URLSearchParams(), null)).toEqual(DEFAULT_PROFILE);
  });

  it('lets stored values override defaults', () => {
    const stored = serialize({ ageYears: 10, homeMeters: 4, colorId: 'bright-blue' });
    expect(parsePersonalization(new URLSearchParams(), stored)).toEqual({
      ageYears: 10,
      homeMeters: 4,
      colorId: 'bright-blue',
    });
  });

  it('lets URL params override stored values', () => {
    const stored = serialize({ ageYears: 10, homeMeters: 4, colorId: 'bright-blue' });
    const params = new URLSearchParams('age=12');
    expect(parsePersonalization(params, stored)).toEqual({
      ageYears: 12,
      homeMeters: 4, // not present in the URL, falls back to stored
      colorId: 'bright-blue', // not present in the URL, falls back to stored
    });
  });

  it.each(['0', '121', 'abc', '7.5'])('falls back to the default age for %s', (age) => {
    const params = new URLSearchParams({ age });
    expect(parsePersonalization(params, null).ageYears).toBe(DEFAULT_PROFILE.ageYears);
  });

  it('ignores a name key still present on the URL', () => {
    const params = new URLSearchParams({ name: 'Ada', age: '9' });
    expect(parsePersonalization(params, null)).toEqual({ ...DEFAULT_PROFILE, ageYears: 9 });
  });

  it('ignores a name key still present in stored JSON', () => {
    const stored = JSON.stringify({ name: 'Ada', ageYears: 9, homeMeters: 8, colorId: DEFAULT_COLOR_ID });
    expect(parsePersonalization(new URLSearchParams(), stored)).toEqual({ ...DEFAULT_PROFILE, ageYears: 9 });
  });

  it('falls back to the default home height when out of range or not a number', () => {
    for (const home of ['0', '1001', 'abc']) {
      const params = new URLSearchParams({ home });
      expect(parsePersonalization(params, null).homeMeters).toBe(DEFAULT_PROFILE.homeMeters);
    }
  });

  it('accepts a recognized color id from the URL', () => {
    const params = new URLSearchParams({ color: 'dark-green' });
    expect(parsePersonalization(params, null).colorId).toBe('dark-green');
  });

  it.each(['nope', '', 'Bright Red'])('falls back to the default color for an unrecognized id (%j)', (color) => {
    const params = new URLSearchParams({ color });
    expect(parsePersonalization(params, null).colorId).toBe(DEFAULT_COLOR_ID);
  });

  it('rejects malformed stored JSON without throwing', () => {
    expect(parsePersonalization(new URLSearchParams(), 'not json')).toEqual(DEFAULT_PROFILE);
    expect(parsePersonalization(new URLSearchParams(), 'null')).toEqual(DEFAULT_PROFILE);
  });

  it('round-trips through serialize, including color', () => {
    const profile: Personalization = { ageYears: 9, homeMeters: 30, colorId: 'bright-purple' };
    expect(parsePersonalization(new URLSearchParams(), serialize(profile))).toEqual(profile);
  });
});

describe('mergeParams', () => {
  it('reads query values when the fragment has no personalization keys', () => {
    // ?age=8&home=4#about
    const query = new URLSearchParams('age=8&home=4');
    const fragment = new URLSearchParams('about');
    const merged = mergeParams(query, fragment);
    expect(merged.get('age')).toBe('8');
    expect(merged.get('home')).toBe('4');
    expect(merged.has('color')).toBe(false);
  });

  it('combines a query key and a fragment key', () => {
    // ?age=8#home=4
    const query = new URLSearchParams('age=8');
    const fragment = new URLSearchParams('home=4');
    const merged = mergeParams(query, fragment);
    expect(merged.get('age')).toBe('8');
    expect(merged.get('home')).toBe('4');
  });

  it('lets the fragment win over the query for the same key', () => {
    // ?age=8#age=9
    const query = new URLSearchParams('age=8');
    const fragment = new URLSearchParams('age=9');
    const merged = mergeParams(query, fragment);
    expect(merged.get('age')).toBe('9');
  });

  it('drops keys that are not recognized personalization keys, including a leftover name', () => {
    const query = new URLSearchParams('utm_source=newsletter&name=Ada');
    const fragment = new URLSearchParams('foo=bar');
    const merged = mergeParams(query, fragment);
    expect(Array.from(merged.keys())).toEqual([]);
  });
});

describe('fillTokens', () => {
  const profile: Personalization = { ageYears: 9, homeMeters: 8, colorId: DEFAULT_COLOR_ID };

  it('fills {age} with the profile age as a plain number', () => {
    expect(fillTokens('You are {age} years old.', profile)).toBe('You are 9 years old.');
  });

  it('spells out an age under 100 for {brickAge}', () => {
    expect(fillTokens('Your whole life is {brickAge} tall.', profile)).toBe('Your whole life is nine bricks tall.');
  });

  it('singularizes "brick" for an age of one', () => {
    const oneYearOld: Personalization = { ...profile, ageYears: 1 };
    expect(fillTokens('Your whole life is {brickAge} tall.', oneYearOld)).toBe(
      'Your whole life is one brick tall.',
    );
  });

  it('keeps digits for an age of 100 or more, even for {brickAge}', () => {
    const centenarian: Personalization = { ...profile, ageYears: 100 };
    expect(fillTokens('Your whole life is {brickAge} tall.', centenarian)).toBe(
      'Your whole life is 100 bricks tall.',
    );
  });

  it('fills every occurrence of a token', () => {
    expect(fillTokens('{age} and {age}.', profile)).toBe('9 and 9.');
  });

  it('leaves a line with no tokens alone', () => {
    expect(fillTokens('No jaws.', profile)).toBe('No jaws.');
  });

  it('leaves an unknown token alone rather than mangling the line', () => {
    expect(fillTokens('Hello {nope}.', profile)).toBe('Hello {nope}.');
  });

  it('replaces every token it advertises', () => {
    for (const token of LINE_TOKENS) {
      expect(fillTokens(token, profile)).not.toContain('{');
    }
  });
});

describe('hasPersonalizationKeys', () => {
  it('is false for a plain anchor fragment', () => {
    expect(hasPersonalizationKeys(new URLSearchParams('about'))).toBe(false);
  });

  it('is true when a recognized key is present', () => {
    expect(hasPersonalizationKeys(new URLSearchParams('home=4'))).toBe(true);
  });

  it('is true when only the color key is present', () => {
    expect(hasPersonalizationKeys(new URLSearchParams('color=black'))).toBe(true);
  });
});

describe('shouldScrubUrl', () => {
  it('is true for a query carrying only a name key', () => {
    expect(shouldScrubUrl(new URLSearchParams('name=Ada'), new URLSearchParams())).toBe(true);
  });

  it('is true for a fragment carrying only a name key', () => {
    expect(shouldScrubUrl(new URLSearchParams(), new URLSearchParams('name=Ada'))).toBe(true);
  });

  it('is true when a recognized key is present alongside no name', () => {
    expect(shouldScrubUrl(new URLSearchParams('age=9'), new URLSearchParams())).toBe(true);
  });

  it('is false when neither source carries a recognized key or a name', () => {
    expect(shouldScrubUrl(new URLSearchParams('utm_source=newsletter'), new URLSearchParams('about'))).toBe(false);
  });

  it('is false for two empty sources', () => {
    expect(shouldScrubUrl(new URLSearchParams(), new URLSearchParams())).toBe(false);
  });
});
