// Validates and clamps the JSON bodies for both session endpoints. Pure —
// no DOM, no database — so it can be unit tested the same way src/lib/
// modules are. Every field is optional and either dropped to null or
// clamped into range rather than rejecting the whole payload, except for
// two hard rejections: a non-object body, and any body carrying a `name`
// key at all — sessions never store the child's name, so a payload that
// even mentions one is refused outright rather than silently stripped.

// Mirrors src/lib/constants.ts's TOTAL_YEARS. Duplicated (not imported)
// because this module lives under netlify/ and must not depend on src/.
const TOTAL_YEARS = 4.6e9;

const MAX_DURATION_MS = 86_400_000; // 24 hours: a generous upper bound, not an expected session length.
const MAX_COLOR_ID_LENGTH = 40;
const COLOR_ID_PATTERN = /^[a-z-]+$/;
const VIEWPORT_MIN = 0;
const VIEWPORT_MAX = 10000;
const AGE_MIN = 1;
const AGE_MAX = 120;
const HOME_MIN = 1;
const HOME_MAX = 1000;

export type DeviceKind = 'phone' | 'tablet' | 'desktop';
export type BrowserFamily = 'chrome' | 'safari' | 'firefox' | 'edge' | 'other';

const DEVICE_KINDS: ReadonlySet<string> = new Set<DeviceKind>(['phone', 'tablet', 'desktop']);
const BROWSER_FAMILIES: ReadonlySet<string> = new Set<BrowserFamily>(['chrome', 'safari', 'firefox', 'edge', 'other']);

export interface SessionStart {
  ageYears: number | null;
  homeMeters: number | null;
  colorId: string | null;
  soundOn: boolean | null;
  inputKind: 'wheel' | 'touch' | 'keyboard' | null;
  viewportW: number | null;
  viewportH: number | null;
  deviceKind: DeviceKind | null;
  browserFamily: BrowserFamily | null;
}

export interface SessionEnd {
  durationMs: number;
  yearsReached: number;
  finished: boolean;
}

// Accepts a JSON body only if it's a plain object with no `name` key
// anywhere at its top level. Returns the body as a loosely-typed record for
// the field parsers below to pick through; returns null to signal the
// whole payload is rejected.
function asRecord(body: unknown): Record<string, unknown> | null {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) return null;
  const record = body as Record<string, unknown>;
  if (Object.prototype.hasOwnProperty.call(record, 'name')) return null;
  return record;
}

function parseIntInRange(value: unknown, min: number, max: number): number | null {
  if (typeof value !== 'number' || !Number.isInteger(value)) return null;
  if (value < min || value > max) return null;
  return value;
}

function parseAge(value: unknown): number | null {
  return parseIntInRange(value, AGE_MIN, AGE_MAX);
}

function parseHome(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  if (value < HOME_MIN || value > HOME_MAX) return null;
  return value;
}

function parseColorId(value: unknown): string | null {
  if (typeof value !== 'string' || value.length > MAX_COLOR_ID_LENGTH) return null;
  return COLOR_ID_PATTERN.test(value) ? value : null;
}

function parseSoundOn(value: unknown): boolean | null {
  return typeof value === 'boolean' ? value : null;
}

function parseInputKind(value: unknown): SessionStart['inputKind'] {
  return value === 'wheel' || value === 'touch' || value === 'keyboard' ? value : null;
}

function parseViewport(value: unknown): number | null {
  return parseIntInRange(value, VIEWPORT_MIN, VIEWPORT_MAX);
}

function parseDeviceKind(value: unknown): DeviceKind | null {
  return typeof value === 'string' && DEVICE_KINDS.has(value) ? (value as DeviceKind) : null;
}

function parseBrowserFamily(value: unknown): BrowserFamily | null {
  return typeof value === 'string' && BROWSER_FAMILIES.has(value) ? (value as BrowserFamily) : null;
}

export function parseSessionStart(body: unknown): SessionStart | null {
  const record = asRecord(body);
  if (record === null) return null;

  return {
    ageYears: parseAge(record.ageYears),
    homeMeters: parseHome(record.homeMeters),
    colorId: parseColorId(record.colorId),
    soundOn: parseSoundOn(record.soundOn),
    inputKind: parseInputKind(record.inputKind),
    viewportW: parseViewport(record.viewportW),
    viewportH: parseViewport(record.viewportH),
    deviceKind: parseDeviceKind(record.deviceKind),
    browserFamily: parseBrowserFamily(record.browserFamily),
  };
}

// Clamps to [min, max], falling back to min when the value is missing or
// not a finite number — used for SessionEnd's fields, which (unlike
// SessionStart's) are required, so there's no null to fall back to.
function clampToRange(value: unknown, min: number, max: number): number {
  const n = typeof value === 'number' && Number.isFinite(value) ? value : min;
  return Math.min(max, Math.max(min, n));
}

function clampIntToRange(value: unknown, min: number, max: number): number {
  const n = typeof value === 'number' && Number.isFinite(value) ? Math.round(value) : min;
  return Math.min(max, Math.max(min, n));
}

export function parseSessionEnd(body: unknown): SessionEnd | null {
  const record = asRecord(body);
  if (record === null) return null;

  return {
    durationMs: clampIntToRange(record.durationMs, 0, MAX_DURATION_MS),
    yearsReached: clampToRange(record.yearsReached, 0, TOTAL_YEARS),
    finished: Boolean(record.finished),
  };
}
