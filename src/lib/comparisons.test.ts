import { describe, expect, it } from 'vitest';
import { BEATS } from './beats';
import { beforePhraseFor, tallerThan } from './comparisons';
import { buildLandmarks } from './landmarks';
import { DEFAULT_COLOR_ID } from './lego-colors';

const profile = { name: 'Kid', ageYears: 8, homeMeters: 8, colorId: DEFAULT_COLOR_ID };
const landmarks = buildLandmarks(profile);

describe('tallerThan', () => {
  it('says "not as tall as a door yet" when nothing has been passed', () => {
    expect(tallerThan(0.1, landmarks)).toBe('not as tall as a door yet');
  });

  it('names the tallest passed thing, e.g. the Eiffel Tower at 576 m', () => {
    expect(tallerThan(576, landmarks)).toBe('taller than the Eiffel Tower!');
  });

  it('uses the personal home label', () => {
    // Between the door (2 m) and the default 8 m home, so the home wins.
    expect(tallerThan(10, landmarks)).toBe('taller than your home!');
  });
});

describe('beforePhraseFor', () => {
  it('below the first beat, with no profile age, uses the 60-year default', () => {
    expect(beforePhraseFor(30, BEATS)).toBe('in your lifetime');
    expect(beforePhraseFor(4000, BEATS)).toBe("in your grandparents' time");
  });

  it('below the first beat, with a profile age, uses it as the threshold', () => {
    expect(beforePhraseFor(5, BEATS, 8)).toBe('in your lifetime');
    expect(beforePhraseFor(30, BEATS, 8)).toBe("in your grandparents' time");
  });

  it('on and above the first beat, uses its beforePhrase', () => {
    expect(beforePhraseFor(5000, BEATS)).toBe('before anyone wrote anything down');
    expect(beforePhraseFor(6000, BEATS)).toBe('before anyone wrote anything down');
  });

  it('picks the most recent beat crossed, not the first', () => {
    // Past writing, humans, and the asteroid, but not yet the first dinosaurs.
    expect(beforePhraseFor(70e6, BEATS)).toBe('before the asteroid hit');
  });
});
