import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PROFILE,
  hasPersonalizationKeys,
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
    const stored = serialize({ name: 'Stored', ageYears: 10, homeMeters: 4 });
    expect(parsePersonalization(new URLSearchParams(), stored)).toEqual({
      name: 'Stored',
      ageYears: 10,
      homeMeters: 4,
    });
  });

  it('lets URL params override stored values', () => {
    const stored = serialize({ name: 'Stored', ageYears: 10, homeMeters: 4 });
    const params = new URLSearchParams('name=FromUrl&age=12');
    expect(parsePersonalization(params, stored)).toEqual({
      name: 'FromUrl',
      ageYears: 12,
      homeMeters: 4, // not present in the URL, falls back to stored
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

  it('rejects malformed stored JSON without throwing', () => {
    expect(parsePersonalization(new URLSearchParams(), 'not json')).toEqual(DEFAULT_PROFILE);
    expect(parsePersonalization(new URLSearchParams(), 'null')).toEqual(DEFAULT_PROFILE);
  });

  it('round-trips through serialize', () => {
    const profile: Personalization = { name: 'Ellie', ageYears: 9, homeMeters: 30 };
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

describe('hasPersonalizationKeys', () => {
  it('is false for a plain anchor fragment', () => {
    expect(hasPersonalizationKeys(new URLSearchParams('about'))).toBe(false);
  });

  it('is true when a recognized key is present', () => {
    expect(hasPersonalizationKeys(new URLSearchParams('home=4'))).toBe(true);
  });
});
