import { describe, expect, it } from 'vitest';
import { BEATS } from './beats';
import { beforePhraseFor, tallerThan } from './comparisons';
import { buildLandmarks } from './landmarks';
import { DEFAULT_COLOR_ID } from './lego-colors';

const profile = { name: 'Kid', ageYears: 8, homeMeters: 8, colorId: DEFAULT_COLOR_ID };
const landmarks = buildLandmarks(profile);

describe('tallerThan', () => {
  it('says "not as tall as a door yet" when nothing has been passed', () => {
    expect(tallerThan(0.005, landmarks)).toBe('not as tall as a door yet');
  });

  it('names the tallest passed thing, e.g. the Empire State Building at 576 m', () => {
    expect(tallerThan(576, landmarks)).toBe('taller than the Empire State Building!');
  });

  it('uses the personal home label', () => {
    // Between the giraffe (5.5 m) and the default 8 m home, so the home wins.
    expect(tallerThan(10, landmarks)).toBe('taller than your home!');
  });

  it('phrases planes, space, earth-wide, and around correctly, not generically from the label', () => {
    // Past the highest bird (12,000 m) but below the ozone layer (20,000 m).
    expect(tallerThan(12000, landmarks)).toBe('higher than any bird has flown!');
    // Past space (100,000 m) but below the ISS (400,000 m).
    expect(tallerThan(150000, landmarks)).toBe('past the edge of space!');
    // Past earth-wide (12,742,000 m) but below around (40,075,000 m).
    expect(tallerThan(13000000, landmarks)).toBe('as tall as the Earth is wide!');
    // Past around, the tallest thing there is.
    expect(tallerThan(50000000, landmarks)).toBe('longer than the way around the Earth!');
  });

  it('treats a "laid flat" thing as eligible like any other', () => {
    // Past the marathon (42,200 m) but below where meteors burn up (80,000 m).
    expect(tallerThan(50000, landmarks)).toBe('laid flat, as long as a marathon!');
  });
});

describe('beforePhraseFor', () => {
  it('below the first beat, uses the profile age as the threshold', () => {
    // The real list starts at the last birthday (1 year), so the age
    // fallback only shows below that; an empty list exercises both sides.
    expect(beforePhraseFor(0.5, BEATS, 8)).toBe('in your lifetime');
    expect(beforePhraseFor(5, [], 8)).toBe('in your lifetime');
    expect(beforePhraseFor(30, [], 8)).toBe("in your grandparents' time");
  });

  it("uses a beat's own beforePhrase where the candidate list gave one", () => {
    expect(beforePhraseFor(5000, BEATS, 8)).toBe('before anyone wrote anything down');
    expect(beforePhraseFor(5100, BEATS, 8)).toBe('before anyone wrote anything down');
  });

  it('falls back to "before " plus the title where a beat has no phrase', () => {
    // The first iPhone (19 years) carries no footer phrase of its own.
    expect(beforePhraseFor(20, BEATS, 8)).toBe('before the first iPhone');
  });

  it('picks the most recent beat crossed, not the first', () => {
    // Past writing, humans, and the asteroid, but not yet T. rex.
    expect(beforePhraseFor(67e6, BEATS, 8)).toBe('before the dinosaurs died');
  });
});
