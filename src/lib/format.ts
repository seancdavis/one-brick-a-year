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
  return `${Math.round(years)} years`;
}

// fmtYears with its magnitude words abbreviated: "4.6B years", "66M years",
// "5K years". For the one place the full form doesn't fit — a landmark label
// whose years have wrapped to their own line on a narrow canvas
// (src/render/stage.ts) — where dropping "billion" to "B" is a far better
// trade than ellipsizing the number itself. Below a thousand there is nothing
// to abbreviate, so it reads exactly as fmtYears does.
export function fmtYearsCompact(years: number): string {
  if (years >= 1e9) {
    return `${trimTrailingZero(Math.round(years / 1e8) / 10)}B years`;
  }
  if (years >= 1e6) {
    return `${trimTrailingZero(Math.round(years / 1e5) / 10)}M years`;
  }
  if (years >= 1000) {
    return `${trimTrailingZero(Math.round(years / 100) / 10)}K years`;
  }
  return `${Math.round(years)} years`;
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

// fmtYears says "1 years" for a single-year gap, which is right for a
// landmark label ("... · 1 years") but wrong in a sentence ("1 year ago").
// Shared by the popups and their opened card (src/popups.ts) and the scrapbook
// (src/scrapbook.ts) so both read the same way.
export function yearsAgo(years: number): string {
  return Math.round(years) === 1 ? '1 year ago' : `${fmtYears(years)} ago`;
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
