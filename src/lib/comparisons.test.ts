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

  it('phrases planes, space, earth-wide, and around correctly, not generically from the label', () => {
    // Past planes (11,000 m) but below space (100,000 m).
    expect(tallerThan(12000, landmarks)).toBe('higher than airplanes fly!');
    // Past space (100,000 m) but below the ISS (400,000 m).
    expect(tallerThan(150000, landmarks)).toBe('past the edge of space!');
    // Past earth-wide (12,742,000 m) but below around (40,075,000 m).
    expect(tallerThan(13000000, landmarks)).toBe('as tall as the Earth is wide!');
    // Past around, the tallest thing there is.
    expect(tallerThan(50000000, landmarks)).toBe('longer than the way around the Earth!');
  });
});

describe('beforePhraseFor', () => {
  it('below the first beat, uses the profile age as the threshold', () => {
    expect(beforePhraseFor(5, BEATS, 8)).toBe('in your lifetime');
    expect(beforePhraseFor(30, BEATS, 8)).toBe("in your grandparents' time");
  });

  it('on and above the first beat, uses its beforePhrase regardless of age', () => {
    expect(beforePhraseFor(5000, BEATS, 8)).toBe('before anyone wrote anything down');
    expect(beforePhraseFor(6000, BEATS, 8)).toBe('before anyone wrote anything down');
  });

  it('picks the most recent beat crossed, not the first', () => {
    // Past writing, humans, and the asteroid, but not yet the first dinosaurs.
    expect(beforePhraseFor(70e6, BEATS, 8)).toBe('before the dinosaurs died');
  });
});
