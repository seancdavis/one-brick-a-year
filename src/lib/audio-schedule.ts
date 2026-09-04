// Pure scheduling math for sound: how many brick ticks per second at a given
// pace, and the gain/pitch of the background hum. No Web Audio here —
// src/audio.ts turns these numbers into sound, src/main.ts drives both from
// the sim's rate each frame.

import { TOTAL_YEARS } from './constants';

export const TICK_CAP_PER_S = 12; // ticks never fire faster than this, however fast bricks stack
export const HUM_START_RATE = 1000; // years per second at which the hum starts fading in
export const HUM_MAX_RATE = TOTAL_YEARS; // rate at which hum gain and pitch reach their caps
export const HUM_MAX_GAIN = 0.35; // loudest the hum ever gets
export const HUM_MIN_HZ = 110; // hum pitch at HUM_START_RATE
export const HUM_MAX_HZ = 440; // hum pitch at HUM_MAX_RATE and above

// localStorage key src/main.ts reads/writes the sound preference under.
export const SOUND_STORAGE_KEY = 'oby:sound';
export const SOUND_DEFAULT_ENABLED = false;

// One tick per brick (so ticks match the rate 1:1) up to the cap, so a slow
// scroll ticks once per year and a fast one never turns into a buzz.
export function ticksPerSecond(yearsPerSecond: number): number {
  if (yearsPerSecond <= 0) return 0;
  return Math.min(yearsPerSecond, TICK_CAP_PER_S);
}

// Below HUM_START_RATE the pace is slow enough that individual ticks read
// fine on their own — no hum. Above it, gain and pitch rise together with
// log10 of how far the rate is past HUM_START_RATE, both capped at the
// values they reach at HUM_MAX_RATE (which the rate races well past before
// a sustained scroll finishes the stack).
export function humFor(yearsPerSecond: number): { gain: number; hz: number } {
  if (yearsPerSecond <= HUM_START_RATE) {
    return { gain: 0, hz: HUM_MIN_HZ };
  }

  const logRange = Math.log10(HUM_MAX_RATE / HUM_START_RATE);
  const t = Math.min(1, Math.log10(yearsPerSecond / HUM_START_RATE) / logRange);

  const gain = HUM_MAX_GAIN * t;
  const logHz = Math.log(HUM_MIN_HZ) + (Math.log(HUM_MAX_HZ) - Math.log(HUM_MIN_HZ)) * t;

  return { gain, hz: Math.exp(logHz) };
}
