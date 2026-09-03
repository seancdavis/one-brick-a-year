import { describe, expect, it } from 'vitest';
import { DEFAULT_PROFILE, parsePersonalization, serialize, type Personalization } from './personalize';

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
