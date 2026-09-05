// Footer comparison copy: "how tall?" and "how long ago?" plain-language
// phrases the HUD's footer plugs in next to the raw numbers
// (src/hud.ts's setComparisons). Pure — no DOM.

import type { Beat } from './beats';
import type { Landmark, ThingLandmark } from './landmarks';

// The tallest passed "thing" landmark's own tallerThanPhrase (e.g. "taller
// than the Eiffel Tower!", "higher than airplanes fly!", "past the edge of
// space!" — not every thing's phrase actually starts with "taller than", so
// this can't be built generically from the label). Below the shortest thing
// (the ruler), nothing has been passed yet.
export function tallerThan(heightM: number, landmarks: Landmark[]): string {
  let tallest: ThingLandmark | null = null;
  for (const landmark of landmarks) {
    if (landmark.kind !== 'thing' || landmark.meters > heightM) continue;
    if (!tallest || landmark.meters > tallest.meters) tallest = landmark;
  }

  if (!tallest) return 'not as tall as a door yet';
  return tallest.tallerThanPhrase;
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
