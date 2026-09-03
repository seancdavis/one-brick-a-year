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

function trimTrailingZero(n: number): string {
  return n.toString().replace(/\.0$/, '');
}
