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
  type Personalization,
} from './personalize';

describe('parsePersonalization', () => {
  it('applies defaults when nothing is provided', () => {
    expect(parsePersonalization(new URLSearchParams(), null)).toEqual(DEFAULT_PROFILE);
  });

  it('lets stored values override defaults', () => {
    const stored = serialize({ name: 'Stored', ageYears: 10, homeMeters: 4, colorId: 'bright-blue' });
    expect(parsePersonalization(new URLSearchParams(), stored)).toEqual({
      name: 'Stored',
      ageYears: 10,
      homeMeters: 4,
      colorId: 'bright-blue',
    });
  });

  it('lets URL params override stored values', () => {
    const stored = serialize({ name: 'Stored', ageYears: 10, homeMeters: 4, colorId: 'bright-blue' });
    const params = new URLSearchParams('name=FromUrl&age=12');
    expect(parsePersonalization(params, stored)).toEqual({
      name: 'FromUrl',
      ageYears: 12,
      homeMeters: 4, // not present in the URL, falls back to stored
      colorId: 'bright-blue', // not present in the URL, falls back to stored
    });
  });

  it.each(['0', '121', 'abc', '7.5'])('falls back to the default age for %s', (age) => {
    const params = new URLSearchParams({ age });
    expect(parsePersonalization(params, null).ageYears).toBe(DEFAULT_PROFILE.ageYears);
  });

  it('trims an over-long name to 24 characters', () => {
    const longName = 'a'.repeat(30);
    const params = new URLSearchParams({ name: longName });
    expect(parsePersonalization(params, null).name).toBe('a'.repeat(24));
  });

  it.each(['', '   '])('falls back to "you" for an empty name (%j)', (name) => {
    const params = new URLSearchParams({ name });
    expect(parsePersonalization(params, null).name).toBe('you');
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
    const profile: Personalization = { name: 'Ellie', ageYears: 9, homeMeters: 30, colorId: 'bright-purple' };
    expect(parsePersonalization(new URLSearchParams(), serialize(profile))).toEqual(profile);
  });
});

describe('mergeParams', () => {
  it('reads query values when the fragment has no personalization keys', () => {
    // ?name=Ada&age=8#about
    const query = new URLSearchParams('name=Ada&age=8');
    const fragment = new URLSearchParams('about');
    const merged = mergeParams(query, fragment);
    expect(merged.get('name')).toBe('Ada');
    expect(merged.get('age')).toBe('8');
    expect(merged.has('home')).toBe(false);
  });

  it('combines a query key and a fragment key', () => {
    // ?age=8#name=Ada
    const query = new URLSearchParams('age=8');
    const fragment = new URLSearchParams('name=Ada');
    const merged = mergeParams(query, fragment);
    expect(merged.get('name')).toBe('Ada');
    expect(merged.get('age')).toBe('8');
  });

  it('lets the fragment win over the query for the same key', () => {
    // ?name=Ada#name=Bea
    const query = new URLSearchParams('name=Ada');
    const fragment = new URLSearchParams('name=Bea');
    const merged = mergeParams(query, fragment);
    expect(merged.get('name')).toBe('Bea');
  });

  it('drops keys that are not recognized personalization keys', () => {
    const query = new URLSearchParams('utm_source=newsletter&name=Ada');
    const fragment = new URLSearchParams('foo=bar');
    const merged = mergeParams(query, fragment);
    expect(Array.from(merged.keys())).toEqual(['name']);
  });
});

describe('fillTokens', () => {
  const named: Personalization = { name: 'Ada', ageYears: 9, homeMeters: 8, colorId: DEFAULT_COLOR_ID };

  it('fills {name} with the profile name', () => {
    expect(fillTokens('Minecraft is older than {name}.', named)).toBe('Minecraft is older than Ada.');
  });

  it('reads naturally with the default name', () => {
    expect(fillTokens('Minecraft is older than {name}.', DEFAULT_PROFILE)).toBe('Minecraft is older than you.');
  });

  it('capitalizes {Name}, so the default reads "You"', () => {
    expect(fillTokens('{Name} were not born yet.', DEFAULT_PROFILE)).toBe('You were not born yet.');
    expect(fillTokens('{Name} were not born yet.', named)).toBe('Ada were not born yet.');
  });

  it('fills {age} with the profile age as a plain number outside a brick phrase', () => {
    expect(fillTokens('You are {age} years old.', named)).toBe('You are 9 years old.');
  });

  it('spells out an age under 100 in a brick phrase', () => {
    expect(fillTokens('Your whole life is {age} bricks tall.', named)).toBe('Your whole life is nine bricks tall.');
  });

  it('singularizes "brick" for an age of one', () => {
    const oneYearOld: Personalization = { ...named, ageYears: 1 };
    expect(fillTokens('Your whole life is {age} bricks tall.', oneYearOld)).toBe(
      'Your whole life is one brick tall.',
    );
  });

  it('keeps digits for an age of 100 or more, even in a brick phrase', () => {
    const centenarian: Personalization = { ...named, ageYears: 100 };
    expect(fillTokens('Your whole life is {age} bricks tall.', centenarian)).toBe(
      'Your whole life is 100 bricks tall.',
    );
  });

  it('fills every occurrence of a token', () => {
    expect(fillTokens('{name} and {name}, aged {age} and {age}.', named)).toBe('Ada and Ada, aged 9 and 9.');
  });

  it('leaves a line with no tokens alone', () => {
    expect(fillTokens('No jaws.', named)).toBe('No jaws.');
  });

  it('leaves an unknown token alone rather than mangling the line', () => {
    expect(fillTokens('Hello {nope}.', named)).toBe('Hello {nope}.');
  });

  it('falls back to "you" for a blank name', () => {
    const blank: Personalization = { ...named, name: '   ' };
    expect(fillTokens('older than {name}', blank)).toBe('older than you');
  });

  it('replaces every token it advertises', () => {
    for (const token of LINE_TOKENS) {
      expect(fillTokens(token, named)).not.toContain('{');
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
