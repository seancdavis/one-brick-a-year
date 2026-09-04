// Pure scroll -> years-per-second pacing math. No DOM — src/input.ts turns
// raw wheel/touch-drag/keyboard events into a deltaPx, and src/main.ts folds
// those into a ScrollState every frame and turns the tracked velocity into a
// years-per-second rate for src/lib/sim.ts's step(). Nothing here reads a
// clock itself: every function takes the current time in seconds as an
// argument, so it stays trivially testable.

export interface ScrollState {
  velocity: number; // tracked scroll speed, in px per second; decays toward 0 without input
  lastAt: number; // seconds — when velocity was last updated (a push or a decay)
}

export const INITIAL_SCROLL: ScrollState = { velocity: 0, lastAt: 0 };

// With no further input, the tracked velocity halves every this many
// seconds — an exponential decay, not a linear one, so a quick flick still
// registers as a brief burst of speed instead of vanishing instantly.
export const SCROLL_HALF_LIFE_S = 0.5;

// Below this tracked speed, decay snaps velocity to exactly 0 instead of
// approaching it asymptotically forever — otherwise a frame is never
// truly idle (see decayVelocity), and callers that key a redraw off
// `rate > 0` would redraw every frame indefinitely after the last scroll.
export const IDLE_VELOCITY_PX_S = 2;

// Years per second, per px per second of tracked velocity, at 0 years
// (progressGain(0) === 1 below, so at years = 0 the rate is exactly
// SCROLL_GAIN * velocity). Tuned together with progressGain against
// scroll-state.test.ts: a sustained 1,500 px/s scroll needs to still read as
// individual bricks arriving ten seconds in (years < 200 at t = 10s) yet
// finish all 4.6e9 years between 60 and 120 simulated seconds later.
export const SCROLL_GAIN = 0.0016;

// How fast progressGain grows per year already stacked — see progressGain.
// Internal to that formula; not part of the exported pacing contract.
const PROGRESS_GAIN_K = 0.09;

// Multiplies SCROLL_GAIN * velocity to produce the actual years-per-second
// rate. Grows linearly with years — smooth and strictly increasing — so the
// same physical scroll speed moves faster and faster as the stack gets
// taller: the early stack shows individual bricks, the late stack floods.
// Years spans about 9.7 orders of magnitude (0 to 4.6e9), and covering that
// range in around a minute and a half needs the rate to grow close to
// proportionally with years; combined with a sustained scroll this makes
// years-per-second an exponential ramp in time, which is what lands both
// ends of the pacing target (see SCROLL_GAIN's comment and
// scroll-state.test.ts).
export function progressGain(years: number): number {
  return 1 + PROGRESS_GAIN_K * years;
}

function decayFactor(elapsedSeconds: number): number {
  return Math.exp(-(Math.LN2 / SCROLL_HALF_LIFE_S) * elapsedSeconds);
}

// Applies exponential decay to `state.velocity` for the time elapsed since
// `state.lastAt`, without adding anything. src/main.ts calls this once every
// frame so the tracked speed keeps fading even between scroll events (which
// can land less often than frames, or stop altogether).
export function decayVelocity(state: ScrollState, atSeconds: number): ScrollState {
  const elapsed = Math.max(0, atSeconds - state.lastAt);
  const decayed = state.velocity * decayFactor(elapsed);
  return { velocity: decayed < IDLE_VELOCITY_PX_S ? 0 : decayed, lastAt: atSeconds };
}

// Folds one scroll event into the tracked velocity: decays the existing
// velocity to `atSeconds` (see decayVelocity), then blends in this push's
// own implied rate — |deltaPx| divided by the time since the velocity was
// last touched — as an exponential low-pass filter:
//
//   velocity' = decayed + impliedRate * (1 - decayFactor(elapsed))
//
// That is the exact discretization of dv/dt = k * (impliedRate - v), for
// k = ln(2) / SCROLL_HALF_LIFE_S, whose steady state for a constant implied
// rate is that rate itself. So a steady stream of deltas summing to
// 1,500 px per second — however it's chopped into individual events —
// settles the tracked velocity near 1,500 px/s, regardless of how often
// pushes land or what SCROLL_HALF_LIFE_S is. When two pushes land at (or
// effectively at) the same timestamp, elapsed is 0 and impliedRate is
// undefined, so the update instead uses that formula's own limit as elapsed
// approaches 0: velocity += |deltaPx| * ln(2) / SCROLL_HALF_LIFE_S.
export function pushScroll(state: ScrollState, deltaPx: number, atSeconds: number): ScrollState {
  const elapsed = Math.max(0, atSeconds - state.lastAt);
  const decay = decayFactor(elapsed);
  const magnitude = Math.abs(deltaPx);
  const impulse = elapsed > 1e-9 ? (magnitude / elapsed) * (1 - decay) : magnitude * (Math.LN2 / SCROLL_HALF_LIFE_S);
  return { velocity: state.velocity * decay + impulse, lastAt: atSeconds };
}

// Converts a tracked scroll velocity into a years-per-second sim rate. Never
// negative — a near-zero decayed velocity, or a caller handing this a
// negative years (never happens in practice), just yields ~0.
export function yearsPerSecond(velocityPxPerS: number, years: number): number {
  return Math.max(0, SCROLL_GAIN * velocityPxPerS * progressGain(years));
}
