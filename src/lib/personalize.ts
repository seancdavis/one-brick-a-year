// Personalization: the child's name, age, home height, and brick color, used
// to build the "your whole life" and "your home" landmarks, the brick tower
// color, and (later) the end screen copy. Pure — no DOM, no localStorage
// reads/writes here. src/main.ts owns reading/writing localStorage and the
// URL; this module only parses and validates whatever strings it is handed.

import { DEFAULT_COLOR_ID, LEGO_COLORS } from './lego-colors';

export interface Personalization {
  name: string;
  ageYears: number;
  homeMeters: number;
  colorId: string;
}

export const DEFAULT_PROFILE: Personalization = {
  name: 'you',
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

const MAX_NAME_LENGTH = 24;

function parseName(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const trimmed = raw.trim().slice(0, MAX_NAME_LENGTH);
  return trimmed.length > 0 ? trimmed : null;
}

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

  const name = parseName(toValidatable(record.name));
  if (name !== null) result.name = name;

  const ageYears = parseAge(toValidatable(record.ageYears));
  if (ageYears !== null) result.ageYears = ageYears;

  const homeMeters = parseHome(toValidatable(record.homeMeters));
  if (homeMeters !== null) result.homeMeters = homeMeters;

  const colorId = parseColor(toValidatable(record.colorId));
  if (colorId !== null) result.colorId = colorId;

  return result;
}

// Precedence: URL params override stored JSON, which overrides defaults.
// `URLSearchParams` is available in Node, so this stays pure and testable.
export function parsePersonalization(params: URLSearchParams, stored: string | null): Personalization {
  const fromStored = parseStored(stored);

  const name = parseName(params.get('name')) ?? fromStored.name ?? DEFAULT_PROFILE.name;
  const ageYears = parseAge(params.get('age')) ?? fromStored.ageYears ?? DEFAULT_PROFILE.ageYears;
  const homeMeters = parseHome(params.get('home')) ?? fromStored.homeMeters ?? DEFAULT_PROFILE.homeMeters;
  const colorId = parseColor(params.get('color')) ?? fromStored.colorId ?? DEFAULT_PROFILE.colorId;

  return { name, ageYears, homeMeters, colorId };
}

export function serialize(p: Personalization): string {
  return JSON.stringify(p);
}

// The tokens a beat's line (src/lib/beats.ts) may contain. `{name}` is the
// child's name, or the default "you" — so "older than {name}" reads "older
// than you" until a name is typed in. `{Name}` is the same value at the
// start of a sentence, where the default has to become "You". `{age}` is the
// profile age as a plain number. `{brickAge}` is the complete "N brick(s)"
// phrase ("one brick", "nine bricks", "100 bricks"), for a line that wants
// the picture-book brick count rather than a bare number. A line's tokens
// are checked against this list in beats.test.ts, so a typo can never ship
// as literal braces on screen.
//
// No substitution changes the verb after it, so lines keep the token out of
// the subject slot ("older than {name}", never "{Name} is eight") — that
// would need "You are" for the default name and "Ada is" for a real one.
export const LINE_TOKENS = ['{age}', '{brickAge}', '{name}', '{Name}'] as const;

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

// Fills a beat's line in for one child. Unknown braces are left alone —
// there is a test that no line has any.
export function fillTokens(line: string, profile: Personalization): string {
  const name = profile.name.trim() === '' ? DEFAULT_PROFILE.name : profile.name;
  const capitalized = name.charAt(0).toUpperCase() + name.slice(1);
  const age = profile.ageYears;

  // The complete "N brick(s)" phrase reads like a picture book — "nine
  // bricks", "one brick" (singular) — below 100; a life that long spelled
  // out would be unreadable, so 100 and up stay digits.
  const brickAge = age < 100 ? `${spellAge(age)} brick${age === 1 ? '' : 's'}` : `${age} bricks`;

  return line
    .replaceAll('{brickAge}', brickAge)
    .replaceAll('{age}', String(age))
    .replaceAll('{Name}', capitalized)
    .replaceAll('{name}', name);
}

// The URL keys this page recognizes for personalization. Anything else on
// the query string or in the fragment (tracking params, a stray "#about"
// anchor) is not a personalization source and gets dropped.
export const PERSONALIZATION_KEYS = ['name', 'age', 'home', 'color'] as const;

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
