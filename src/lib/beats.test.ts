import { describe, expect, it } from 'vitest';
import { BEATS, beatsCrossed, buildBeats, timeLabel } from './beats';
import { ICON_IDS } from './icon-paths';
import { DEFAULT_COLOR_ID } from './lego-colors';
import { LINE_TOKENS } from './personalize';
import type { PaperColor } from './landmarks';

const PAPER_COLOR_NAMES: readonly PaperColor[] = ['navy', 'leaf', 'mustard', 'coral'];
const TIME_PAPER_NAMES: readonly PaperColor[] = ['mustard', 'coral'];

// docs/autopilot/2026-09-06-content-and-tags.md's copy rules.
const MAX_LINE_LENGTH = 140;
const MIN_TITLE_WORDS = 2;
const MAX_TITLE_WORDS = 5;

const profile = { name: 'Kid', ageYears: 8, homeMeters: 8, colorId: DEFAULT_COLOR_ID };

// Counts sentence-ending punctuation in a line, ignoring the two kinds of
// "." that aren't one: a single-letter (or short-title) abbreviation like
// "T." or "Mr." followed by more text, and a decimal point between digits.
// A run of terminators ("...", "?!") counts as a single sentence end.
function countSentences(line: string): number {
  const stripped = line
    .replace(/\b(?:[A-Z]|Mr|Mrs|Ms|Dr|Jr|Sr|St)\.(?=\s)/g, '')
    .replace(/(\d)\.(\d)/g, '$1$2');
  return stripped.match(/[.!?]+/g)?.length ?? 0;
}

describe('BEATS', () => {
  it('holds at least the ninety time events the round asked for', () => {
    expect(BEATS.length).toBeGreaterThanOrEqual(90);
  });

  it('gives every beat a unique id', () => {
    const ids = BEATS.map((b) => b.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('is sorted ascending by atYears', () => {
    for (let i = 1; i < BEATS.length; i++) {
      expect(BEATS[i].atYears).toBeGreaterThanOrEqual(BEATS[i - 1].atYears);
    }
  });

  it('gives every beat a title of two to five words with no period', () => {
    for (const beat of BEATS) {
      const words = beat.title.trim().split(/\s+/);
      expect(words.length, beat.id).toBeGreaterThanOrEqual(MIN_TITLE_WORDS);
      expect(words.length, beat.id).toBeLessThanOrEqual(MAX_TITLE_WORDS);
      expect(beat.title.endsWith('.'), beat.id).toBe(false);
    }
  });

  it('gives every beat a line no longer than 140 characters', () => {
    for (const beat of BEATS) {
      expect(beat.line.length, beat.id).toBeGreaterThan(0);
      expect(beat.line.length, beat.id).toBeLessThanOrEqual(MAX_LINE_LENGTH);
    }
  });

  it('gives every line at most two sentences', () => {
    for (const beat of BEATS) {
      expect(countSentences(beat.line), beat.id).toBeLessThanOrEqual(2);
    }
  });

  it('uses only known tokens in lines', () => {
    for (const beat of BEATS) {
      for (const token of beat.line.match(/\{[^}]*\}/g) ?? []) {
        expect(LINE_TOKENS, `${beat.id}: ${token}`).toContain(token);
      }
    }
  });

  it('never writes a date or "BCE" into a line', () => {
    for (const beat of BEATS) {
      expect(beat.line, beat.id).not.toContain('BCE');
    }
  });

  it('gives every beat an icon that exists and one of the two time paper colors', () => {
    for (const beat of BEATS) {
      expect(ICON_IDS, beat.id).toContain(beat.icon);
      expect(TIME_PAPER_NAMES, beat.id).toContain(beat.paper);
      expect(PAPER_COLOR_NAMES).toContain(beat.paper);
    }
  });

  it('alternates paper color down the list so neighbors differ', () => {
    for (let i = 1; i < BEATS.length; i++) {
      expect(BEATS[i].paper, BEATS[i].id).not.toBe(BEATS[i - 1].paper);
    }
  });

  it('keeps every id that was already on the stack', () => {
    const ids = new Set(BEATS.map((b) => b.id));
    for (const id of ['life', 'writing', 'humans', 'asteroid', 'dinosaurs', 'animals', 'oxygen', 'life-first']) {
      expect(ids, id).toContain(id);
    }
  });

  it('gives every beforePhrase, where present, non-empty copy', () => {
    for (const beat of BEATS) {
      if (beat.beforePhrase === undefined) continue;
      expect(beat.beforePhrase.length, beat.id).toBeGreaterThan(0);
    }
  });
});

describe('timeLabel', () => {
  it('lowercases an ordinary opening word', () => {
    expect(timeLabel('The first people')).toBe('the first people');
    expect(timeLabel('People start writing')).toBe('people start writing');
    expect(timeLabel('Your whole life')).toBe('your whole life');
  });

  it('keeps the capital on a name, and never touches a capital further in', () => {
    expect(timeLabel('T. rex')).toBe('T. rex');
    expect(timeLabel('Minecraft comes out')).toBe('Minecraft comes out');
    expect(timeLabel('Titanoboa, the giant snake')).toBe('Titanoboa, the giant snake');
    expect(timeLabel('The first Moon landing')).toBe('the first Moon landing');
    expect(timeLabel('The first iPhone')).toBe('the first iPhone');
  });
});

describe('buildBeats', () => {
  it('substitutes the profile age for the "life" beat and keeps the list sorted', () => {
    const beats = buildBeats({ ...profile, ageYears: 40 });
    expect(beats.find((b) => b.id === 'life')?.atYears).toBe(40);
    for (let i = 1; i < beats.length; i++) {
      expect(beats[i].atYears).toBeGreaterThanOrEqual(beats[i - 1].atYears);
    }
  });

  it('leaves every other beat alone', () => {
    const beats = buildBeats(profile);
    expect(beats.filter((b) => b.id !== 'life')).toEqual(BEATS.filter((b) => b.id !== 'life'));
  });
});

describe('beatsCrossed', () => {
  it('crosses the writing beat between 4,900 and 5,100 years', () => {
    expect(beatsCrossed(4900, 5100).map((b) => b.id)).toEqual(['writing']);
  });

  it('crosses every beat in ascending order from 0 to 4.6e9', () => {
    const crossed = beatsCrossed(0, 4.6e9);
    expect(crossed.map((b) => b.id)).toEqual(BEATS.map((b) => b.id));
  });

  it('yields nothing crossing 5,100 to 5,100 after already crossing 4,900 to 5,100', () => {
    expect(beatsCrossed(4900, 5100).map((b) => b.id)).toEqual(['writing']);
    expect(beatsCrossed(5100, 5100)).toEqual([]);
  });

  it('yields nothing on a second, non-overlapping call once a beat has already been crossed', () => {
    expect(beatsCrossed(4900, 5100).map((b) => b.id)).toEqual(['writing']);
    expect(beatsCrossed(5100, 5400)).toEqual([]);
  });

  it('crosses the profile-aware list when one is passed', () => {
    const beats = buildBeats({ ...profile, ageYears: 12 });
    expect(beatsCrossed(11, 13, beats).map((b) => b.id)).toEqual(['life']);
    expect(beatsCrossed(11, 13, BEATS)).toEqual([]);
  });
});
