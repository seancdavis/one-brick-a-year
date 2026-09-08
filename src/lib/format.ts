// Human-friendly formatting for years, meters, and counts.
// Ports the prototype's fmtYears/fmtM functions (docs/prototype/brick-stack.html) verbatim in behavior.

export function fmtYears(years: number): string {
  if (years >= 1e9) {
    return `${trimTrailingZero(Math.round(years / 1e8) / 10)} billion years`;
  }
  if (years >= 1e6) {
    return `${trimTrailingZero(Math.round(years / 1e5) / 10)} million years`;
  }
  if (years >= 1000) {
    return `${Math.round(years).toLocaleString('en-US')} years`;
  }
  const n = Math.round(years);
  return `${n} ${n === 1 ? 'year' : 'years'}`;
}

export function fmtMeters(meters: number): string {
  if (meters < 1) {
    return `${(meters * 100).toFixed(1)} cm`;
  }
  if (meters < 1000) {
    return `${meters < 10 ? meters.toFixed(2) : Math.round(meters)} m`;
  }
  return `${Math.round(meters / 1000).toLocaleString('en-US')} km`;
}

export function fmtInt(n: number): string {
  return Math.round(n).toLocaleString('en-US');
}

// A whole count with its own noun, singular at exactly one: "1 brick",
// "1,204 bricks", "1 year". Unlike fmtYears this never abbreviates the number
// — the HUD's counter and a thing's brick count both show the exact figure —
// and the noun's plural is its "s" form, which is all this page counts.
export function fmtCount(n: number, noun: string): string {
  const whole = Math.round(n);
  return `${fmtInt(whole)} ${whole === 1 ? noun : `${noun}s`}`;
}

// fmtYears already singularizes a one-year gap ("1 year"), so this only
// appends "ago". Shared by the popups and their opened card (src/popups.ts)
// and the scrapbook (src/scrapbook.ts) so both read the same way.
export function yearsAgo(years: number): string {
  return `${fmtYears(years)} ago`;
}

function trimTrailingZero(n: number): string {
  return n.toString().replace(/\.0$/, '');
}

// Counts sentence-ending punctuation in a line of copy, ignoring the two
// kinds of "." that aren't one: a single-letter (or short-title)
// abbreviation like "T." or "Mr." followed by more text, and a decimal point
// between digits. A run of terminators ("...", "?!") counts as a single
// sentence end. Shared by src/lib/beats.test.ts and src/lib/landmarks.test.ts
// to enforce the "at most two sentences" copy rule (docs/principles.md's
// "Facts" section) on both a beat's line and a thing's funLine.
export function countSentences(line: string): number {
  const stripped = line
    .replace(/\b(?:[A-Z]|Mr|Mrs|Ms|Dr|Jr|Sr|St)\.(?=\s)/g, '')
    .replace(/(\d)\.(\d)/g, '$1$2');
  return stripped.match(/[.!?]+/g)?.length ?? 0;
}
