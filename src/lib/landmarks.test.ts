import { describe, expect, it } from 'vitest';
import { BEATS, timeLabel } from './beats';
import { BRICK_M } from './constants';
import { ICON_IDS } from './icon-paths';
import { DEFAULT_COLOR_ID } from './lego-colors';
import { buildLandmarks, type PaperColor } from './landmarks';

const PAPER_COLOR_NAMES: readonly PaperColor[] = ['navy', 'leaf', 'mustard', 'coral'];
const THING_PAPER_NAMES: readonly PaperColor[] = ['navy', 'leaf'];

const profile = { name: 'Kid', ageYears: 8, homeMeters: 8, colorId: DEFAULT_COLOR_ID };

describe('buildLandmarks', () => {
  it('sorts landmarks ascending by meters', () => {
    const landmarks = buildLandmarks(profile);
    for (let i = 1; i < landmarks.length; i++) {
      expect(landmarks[i].meters).toBeGreaterThanOrEqual(landmarks[i - 1].meters);
    }
  });

  it('keeps years and meters consistent with BRICK_M within 0.5%', () => {
    const landmarks = buildLandmarks(profile);
    for (const landmark of landmarks) {
      const expectedMeters = landmark.years * BRICK_M;
      const tolerance = Math.abs(expectedMeters) * 0.005;
      expect(Math.abs(landmark.meters - expectedMeters), landmark.id).toBeLessThanOrEqual(tolerance);
    }
  });

  it('gives every landmark a unique id', () => {
    const ids = buildLandmarks(profile).map((l) => l.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('gives every landmark a kind, with both kinds present', () => {
    const landmarks = buildLandmarks(profile);
    for (const landmark of landmarks) {
      expect(['thing', 'time']).toContain(landmark.kind);
    }
    expect(landmarks.some((l) => l.kind === 'thing')).toBe(true);
    expect(landmarks.some((l) => l.kind === 'time')).toBe(true);
  });

  it('gives every landmark one of the four cut-paper color names, and an icon that exists', () => {
    for (const landmark of buildLandmarks(profile)) {
      expect(PAPER_COLOR_NAMES, landmark.id).toContain(landmark.paper);
      expect(ICON_IDS, landmark.id).toContain(landmark.icon);
    }
  });

  it('gives every landmark a non-empty label', () => {
    for (const landmark of buildLandmarks(profile)) {
      expect(landmark.label.length, landmark.id).toBeGreaterThan(0);
    }
  });

  it('reflects the profile for personal landmarks', () => {
    const landmarks = buildLandmarks({ name: 'Kid', ageYears: 10, homeMeters: 4, colorId: DEFAULT_COLOR_ID });
    const life = landmarks.find((l) => l.id === 'life');
    const home = landmarks.find((l) => l.id === 'home');
    expect(life?.years).toBe(10);
    expect(home?.meters).toBe(4);
  });
});

describe('buildLandmarks: things', () => {
  const things = buildLandmarks(profile).filter((l) => l.kind === 'thing');

  it('holds at least the fifty-five physical comparisons the round asked for', () => {
    expect(things.length).toBeGreaterThanOrEqual(55);
  });

  it('gives every thing a non-empty phrase and one of the two thing paper colors', () => {
    for (const thing of things) {
      if (thing.kind !== 'thing') continue;
      expect(thing.tallerThanPhrase.length, thing.id).toBeGreaterThan(0);
      expect(thing.tallerThanPhrase.endsWith('!'), thing.id).toBe(true);
      expect(THING_PAPER_NAMES, thing.id).toContain(thing.paper);
    }
  });

  it('starts every "laid flat" phrase with "laid flat," and no upright one', () => {
    let flatCount = 0;
    for (const thing of things) {
      if (thing.kind !== 'thing') continue;
      if (thing.orientation === 'flat') {
        flatCount += 1;
        expect(thing.tallerThanPhrase.startsWith('laid flat,'), thing.id).toBe(true);
      } else {
        expect(thing.tallerThanPhrase.startsWith('laid flat'), thing.id).toBe(false);
      }
    }
    expect(flatCount).toBeGreaterThan(0);
  });

  it('keeps every thing id that was already on the stack', () => {
    const ids = new Set(things.map((t) => t.id));
    for (const id of [
      'ruler',
      'door',
      'home',
      'liberty',
      'eiffel',
      'burj',
      'everest',
      'planes',
      'space',
      'iss',
      'earth-wide',
      'around',
    ]) {
      expect(ids, id).toContain(id);
    }
  });

  it('keeps the exact phrases the footer depends on', () => {
    const phraseFor = (id: string) => {
      const thing = things.find((t) => t.id === id);
      return thing && thing.kind === 'thing' ? thing.tallerThanPhrase : null;
    };
    expect(phraseFor('door')).toBe('taller than a door!');
    expect(phraseFor('home')).toBe('taller than your home!');
    expect(phraseFor('planes')).toBe('higher than airplanes fly!');
    expect(phraseFor('space')).toBe('past the edge of space!');
    expect(phraseFor('earth-wide')).toBe('as tall as the Earth is wide!');
    expect(phraseFor('around')).toBe('longer than the way around the Earth!');
  });
});

describe('buildLandmarks: time events', () => {
  const times = buildLandmarks(profile).filter((l) => l.kind === 'time');

  it('derives one landmark per beat, with no tallerThanPhrase', () => {
    expect(times).toHaveLength(BEATS.length);
    for (const time of times) {
      expect('tallerThanPhrase' in time, time.id).toBe(false);
    }
  });

  it('labels each one with its beat title in the lowercase voice', () => {
    for (const beat of BEATS) {
      const landmark = times.find((t) => t.id === beat.id);
      expect(landmark?.label, beat.id).toBe(timeLabel(beat.title));
    }
  });

  it('keeps the labels the stack already showed', () => {
    const labelFor = (id: string) => times.find((t) => t.id === id)?.label;
    expect(labelFor('life')).toBe('your whole life');
    expect(labelFor('humans')).toBe('the first people');
    expect(labelFor('asteroid')).toBe('the asteroid hits the dinosaurs');
    expect(labelFor('dinosaurs')).toBe('the first dinosaurs');
    expect(labelFor('animals')).toBe('the first animals');
    expect(labelFor('oxygen')).toBe('the air gets oxygen');
    expect(labelFor('life-first')).toBe('the first life');
  });
});
