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
