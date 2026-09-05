// Footer comparison copy: "how tall?" and "how long ago?" plain-language
// phrases the HUD's footer plugs in next to the raw numbers
// (src/hud.ts's setComparisons). Pure — no DOM.

import type { Beat } from './beats';
import type { Landmark } from './landmarks';

// The tallest passed "thing" landmark, phrased "taller than {label}!" — every
// thing's label already carries its own article ("the Eiffel Tower", "a
// door", "your home"), so the phrase reads naturally without stripping or
// adding one. Below the shortest thing (the ruler), nothing has been passed
// yet.
export function tallerThan(heightM: number, landmarks: Landmark[]): string {
  let tallest: Landmark | null = null;
  for (const landmark of landmarks) {
    if (landmark.kind !== 'thing' || landmark.meters > heightM) continue;
    if (!tallest || landmark.meters > tallest.meters) tallest = landmark;
  }

  if (!tallest) return 'not as tall as a door yet';
  return `taller than ${tallest.label}!`;
}

// The most recent beat's beforePhrase, e.g. "before the first people". Below
// the first beat, there's no milestone to name yet, so this falls back to
// the profile's own age instead: an eight-year-old sees "in your lifetime"
// up to eight years, "in your grandparents' time" beyond it.
export function beforePhraseFor(years: number, beats: readonly Beat[], ageYears: number): string {
  let mostRecent: Beat | null = null;
  for (const beat of beats) {
    if (beat.atYears > years) continue;
    if (!mostRecent || beat.atYears > mostRecent.atYears) mostRecent = beat;
  }
  if (mostRecent) return mostRecent.beforePhrase;

  return years <= ageYears ? 'in your lifetime' : "in your grandparents' time";
}
