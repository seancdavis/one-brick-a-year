// Personalization: age, home height, and brick color, used to build the
// "your whole life" and "your home" landmarks and the brick tower color.
// Never a name — the page never names the reader, so it stays shareable with
// anyone (docs/autopilot/2026-09-08-quiet-corner.md). Pure — no DOM, no
// localStorage reads/writes here. src/main.ts owns reading/writing
// localStorage and the URL; this module only parses and validates whatever
// strings it is handed.

import { DEFAULT_COLOR_ID, LEGO_COLORS } from './lego-colors';

export interface Personalization {
  ageYears: number;
  homeMeters: number;
  colorId: string;
}

export const DEFAULT_PROFILE: Personalization = {
  ageYears: 8,
  homeMeters: 8,
  colorId: DEFAULT_COLOR_ID,
};

// localStorage key src/main.ts reads/writes the serialized profile under.
export const STORAGE_KEY = 'oby:profile';

// Home height select options (src/start-screen.ts). Values match the
// landmark table's "home" row default (two-story, 8 m).
export const HOME_OPTIONS: readonly { label: string; meters: number }[] = [
  { label: 'a one-story home', meters: 4 },
  { label: 'a two-story home', meters: 8 },
  { label: 'an apartment building', meters: 30 },
];

function parseAge(raw: string | null | undefined): number | null {
  if (raw == null) return null;
  const trimmed = raw.trim();
  if (!/^-?\d+$/.test(trimmed)) return null; // integers only: "7.5" and "abc" both fail here
  const n = Number(trimmed);
  if (n < 1 || n > 120) return null;
  return n;
}

function parseHome(raw: string | null | undefined): number | null {
  if (raw == null) return null;
  const trimmed = raw.trim();
  if (trimmed === '') return null;
  const n = Number(trimmed);
  if (!Number.isFinite(n) || n < 1 || n > 1000) return null;
  return n;
}

function parseColor(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const trimmed = raw.trim();
  return LEGO_COLORS.some((c) => c.id === trimmed) ? trimmed : null;
}

// Stored JSON may hold numbers (what `serialize` writes) or, from an older
// or hand-edited value, strings. Coerce either to a string before running
// the same validation URL params go through, so there is one rule set.
function toValidatable(value: unknown): string | null {
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  return null;
}

function parseStored(stored: string | null): Partial<Personalization> {
  if (!stored) return {};

  let parsed: unknown;
  try {
    parsed = JSON.parse(stored);
  } catch {
    return {};
  }
  if (typeof parsed !== 'object' || parsed === null) return {};

  const record = parsed as Record<string, unknown>;
  const result: Partial<Personalization> = {};

  // A `name` key from an older stored profile (or a hand-edited value) is
  // simply not read: this profile never carries a name.
  const ageYears = parseAge(toValidatable(record.ageYears));
  if (ageYears !== null) result.ageYears = ageYears;

  const homeMeters = parseHome(toValidatable(record.homeMeters));
  if (homeMeters !== null) result.homeMeters = homeMeters;

  const colorId = parseColor(toValidatable(record.colorId));
  if (colorId !== null) result.colorId = colorId;

  return result;
}

// Precedence: URL params override stored JSON, which overrides defaults. A
// `name` key on either source is simply never read here — this profile never
// carries a name. `URLSearchParams` is available in Node, so this stays pure
// and testable.
export function parsePersonalization(params: URLSearchParams, stored: string | null): Personalization {
  const fromStored = parseStored(stored);

  const ageYears = parseAge(params.get('age')) ?? fromStored.ageYears ?? DEFAULT_PROFILE.ageYears;
  const homeMeters = parseHome(params.get('home')) ?? fromStored.homeMeters ?? DEFAULT_PROFILE.homeMeters;
  const colorId = parseColor(params.get('color')) ?? fromStored.colorId ?? DEFAULT_PROFILE.colorId;

  return { ageYears, homeMeters, colorId };
}

export function serialize(p: Personalization): string {
  return JSON.stringify(p);
}

// The tokens a beat's line (src/lib/beats.ts) may contain. `{age}` is the
// profile age as a plain number. `{brickAge}` is the complete "N brick(s)"
// phrase ("one brick", "nine bricks", "100 bricks"), for a line that wants
// the picture-book brick count rather than a bare number. There is no name
// token: a line addresses the reader as "you" directly instead. A line's
// tokens are checked against this list in beats.test.ts, so a typo can never
// ship as literal braces on screen.
export const LINE_TOKENS = ['{age}', '{brickAge}'] as const;

const ONES = [
  'zero',
  'one',
  'two',
  'three',
  'four',
  'five',
  'six',
  'seven',
  'eight',
  'nine',
  'ten',
  'eleven',
  'twelve',
  'thirteen',
  'fourteen',
  'fifteen',
  'sixteen',
  'seventeen',
  'eighteen',
  'nineteen',
];

const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];

// Spells out an age under 100 ("nine", "twenty-one") so a brick phrase reads
// as a picture-book sentence rather than a number; 100 and up stay digits —
// see fillTokens' {age} handling below.
function spellAge(age: number): string {
  if (age < 20) return ONES[age];
  const tens = Math.floor(age / 10);
  const ones = age % 10;
  return ones === 0 ? TENS[tens] : `${TENS[tens]}-${ONES[ones]}`;
}

// Fills a beat's line in for one profile. Unknown braces are left alone —
// there is a test that no line has any.
export function fillTokens(line: string, profile: Personalization): string {
  const age = profile.ageYears;

  // The complete "N brick(s)" phrase reads like a picture book — "nine
  // bricks", "one brick" (singular) — below 100; a life that long spelled
  // out would be unreadable, so 100 and up stay digits.
  const brickAge = age < 100 ? `${spellAge(age)} brick${age === 1 ? '' : 's'}` : `${age} bricks`;

  return line.replaceAll('{brickAge}', brickAge).replaceAll('{age}', String(age));
}

// The URL keys this page recognizes for personalization. A `name` key on
// either the query string or the fragment is not one of them, so it's
// dropped like any other unrecognized key (tracking params, a stray
// "#about" anchor) — this profile never carries a name.
export const PERSONALIZATION_KEYS = ['age', 'home', 'color'] as const;

export function hasPersonalizationKeys(params: URLSearchParams): boolean {
  return PERSONALIZATION_KEYS.some((key) => params.has(key));
}

// Combines the query string and the fragment into one set of params, kept
// to the recognized keys. A link can carry both at once (e.g. a
// query string added by a share target, plus a hand-written fragment) — the
// fragment wins per field, since it's the form that never reaches a server
// log.
export function mergeParams(query: URLSearchParams, fragment: URLSearchParams): URLSearchParams {
  const merged = new URLSearchParams();
  for (const key of PERSONALIZATION_KEYS) {
    const value = fragment.has(key) ? fragment.get(key) : query.get(key);
    if (value !== null) merged.set(key, value);
  }
  return merged;
}
