// Synthesized sound only — no audio files. Every method is a safe no-op
// when the Web Audio API is unavailable or before enable() has run. The
// AudioContext is created lazily, inside enable(), and enable() must always
// be called from a user gesture — browsers refuse to start audio otherwise.

const MASTER_GAIN = 0.4;
const DISABLE_RAMP_S = 0.08;
const ENABLE_RAMP_S = 0.08;

const HUM_RAMP_S = 0.08;
const HUM_LOWPASS_HZ = 600;

const TICK_DURATION_S = 0.03;
const TICK_BUFFER_S = 0.05; // long enough to cover the burst, reused every tick
const TICK_FILTER_HZ = 1800;
const TICK_DETUNE_RATIO = 0.1; // ±10%
const TICK_Q = 6;

const CHIME_NOTES_HZ = [659, 988]; // E5, B5
const CHIME_GAP_S = 0.18;
const CHIME_NOTE_S = 0.4;
const CHIME_PEAK_GAIN = 0.5;

const FINISH_NOTES_HZ = [329.63, 493.88, 659.25]; // E4, B4, E5
const FINISH_HOLD_S = 1.5;
const FINISH_PEAK_GAIN = 0.22;

export interface Audio {
  enable(): Promise<boolean>;
  disable(): void;
  tick(): void;
  hum(gain: number, hz: number): void;
  chime(): void;
  finish(): void;
}

type AudioContextCtor = typeof AudioContext;

function getAudioContextCtor(): AudioContextCtor | null {
  if (typeof AudioContext !== 'undefined') return AudioContext;
  if (typeof window !== 'undefined') {
    const legacy = (window as typeof window & { webkitAudioContext?: AudioContextCtor }).webkitAudioContext;
    if (legacy) return legacy;
  }
  return null;
}

function buildNoiseBuffer(ctx: AudioContext): AudioBuffer {
  const length = Math.ceil(ctx.sampleRate * TICK_BUFFER_S);
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) {
    data[i] = Math.random() * 2 - 1;
  }
  return buffer;
}

// A sine note that ramps in fast and decays exponentially — the shared
// shape behind chime() and finish().
function playNote(ctx: AudioContext, destination: AudioNode, hz: number, startAt: number, duration: number, peakGain: number): void {
  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.value = hz;

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0, startAt);
  gain.gain.linearRampToValueAtTime(peakGain, startAt + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);

  osc.connect(gain);
  gain.connect(destination);
  osc.start(startAt);
  osc.stop(startAt + duration + 0.05);
}

// The two-note "sound is on" confirmation. Shared by chime() (a landmark was
// just crossed) and enable() (the user just turned sound on) so there is
// exactly one definition of what a chime sounds like.
function playChime(ctx: AudioContext, destination: AudioNode): void {
  const now = ctx.currentTime;
  playNote(ctx, destination, CHIME_NOTES_HZ[0], now, CHIME_NOTE_S, CHIME_PEAK_GAIN);
  playNote(ctx, destination, CHIME_NOTES_HZ[1], now + CHIME_GAP_S, CHIME_NOTE_S, CHIME_PEAK_GAIN);
}

export function createAudio(): Audio {
  const Ctor = getAudioContextCtor();

  let ctx: AudioContext | null = null;
  let master: GainNode | null = null;
  let noiseBuffer: AudioBuffer | null = null;
  let humOsc: OscillatorNode | null = null;
  let humGain: GainNode | null = null;
  let enabled = false;

  // Bumped by every enable() that starts a fresh attempt and by every
  // disable() call, and captured at call time; an in-flight enable() only
  // applies the outcome of its own context.resume() if its generation is
  // still the current one by the time that promise settles. A second
  // enable() while one is already in flight just returns the same pending
  // promise (see pendingEnable below), so it never bumps the generation
  // itself — the only thing that can supersede an in-flight attempt is a
  // disable(), which is why disable() always wins over it.
  let generation = 0;

  // Concurrent enable() calls (the scroll-input path and the raw
  // pointerdown/keydown listener can both fire for the same gesture) share
  // this one in-flight promise, so only one resume() happens and the
  // confirmation chime plays once. Cleared as soon as it settles.
  let pendingEnable: Promise<boolean> | null = null;

  function ensureHum(context: AudioContext, destination: AudioNode): { osc: OscillatorNode; gain: GainNode } {
    if (humOsc && humGain) return { osc: humOsc, gain: humGain };

    const osc = context.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.value = 110;

    const lowpass = context.createBiquadFilter();
    lowpass.type = 'lowpass';
    lowpass.frequency.value = HUM_LOWPASS_HZ;

    const gain = context.createGain();
    gain.gain.value = 0;

    osc.connect(lowpass);
    lowpass.connect(gain);
    gain.connect(destination);
    osc.start();

    humOsc = osc;
    humGain = gain;
    return { osc, gain };
  }

  return {
    enable(): Promise<boolean> {
      if (!Ctor) return Promise.resolve(false);
      if (pendingEnable) return pendingEnable;

      const myGeneration = ++generation;
      const wasEnabled = enabled;

      const attempt = (async () => {
        if (!ctx) {
          ctx = new Ctor();
          master = ctx.createGain();
          master.gain.value = MASTER_GAIN;
          master.connect(ctx.destination);
          noiseBuffer = buildNoiseBuffer(ctx);
        } else if (master) {
          // A prior disable() may have ramped this to 0 (and, once its own
          // ramp finished, suspended the context) — cancel that and ramp back
          // up to the audible level rather than leaving it silenced.
          const now = ctx.currentTime;
          master.gain.cancelScheduledValues(now);
          master.gain.setValueAtTime(master.gain.value, now);
          master.gain.linearRampToValueAtTime(MASTER_GAIN, now + ENABLE_RAMP_S);
        }

        if (!ctx || !master) return false;
        const context = ctx;
        const destination = master;

        let running: boolean;
        try {
          await context.resume();
          running = context.state === 'running';
        } catch {
          // Browsers can reject resume() (e.g. no user gesture yet, or the
          // gesture didn't count) — that's a failure to enable, not a crash.
          running = false;
        }

        // Only apply this attempt's outcome if nothing — another enable(),
        // or a disable() — has superseded it while resume() was in flight.
        if (myGeneration === generation) {
          enabled = running;
          // Confirms sound is on the instant it's actually audible, but only
          // on a genuine off->on transition, so the one-time "apply the
          // stored preference" call on the first scroll (src/main.ts)
          // doesn't chime a second time when the user already turned sound
          // on via the HUD toggle.
          if (running && !wasEnabled) playChime(context, destination);
          return running;
        }
        return enabled;
      })();

      pendingEnable = attempt;
      void attempt.finally(() => {
        if (pendingEnable === attempt) pendingEnable = null;
      });

      return attempt;
    },

    disable() {
      generation++;
      // Discard any in-flight enable() rather than leaving it to resolve on
      // its own: without this, a disable() followed quickly by a new
      // enable() would hit the `if (pendingEnable) return pendingEnable`
      // check above and hand back the very attempt disable() just
      // superseded, instead of starting the fresh resume + gain restore
      // the new enable() call is supposed to perform.
      pendingEnable = null;
      enabled = false;
      if (!ctx || !master) return;

      const context = ctx;
      const now = context.currentTime;
      master.gain.cancelScheduledValues(now);
      master.gain.setValueAtTime(master.gain.value, now);
      master.gain.linearRampToValueAtTime(0, now + DISABLE_RAMP_S);

      // Suspend once the ramp finishes, unless enable() re-armed it first.
      setTimeout(() => {
        if (!enabled) void context.suspend();
      }, DISABLE_RAMP_S * 1000);
    },

    tick() {
      if (!enabled || !ctx || !master || !noiseBuffer) return;
      const now = ctx.currentTime;

      const source = ctx.createBufferSource();
      source.buffer = noiseBuffer;

      const detune = 1 + (Math.random() * 2 - 1) * TICK_DETUNE_RATIO;
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = TICK_FILTER_HZ * detune;
      filter.Q.value = TICK_Q;

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(1, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + TICK_DURATION_S);

      source.connect(filter);
      filter.connect(gain);
      gain.connect(master);

      source.start(now);
      source.stop(now + TICK_DURATION_S + 0.02);
    },

    hum(gain: number, hz: number) {
      if (!enabled || !ctx || !master) return;
      const { osc, gain: gainNode } = ensureHum(ctx, master);

      const now = ctx.currentTime;
      osc.frequency.setTargetAtTime(hz, now, HUM_RAMP_S / 3);
      gainNode.gain.cancelScheduledValues(now);
      gainNode.gain.setValueAtTime(gainNode.gain.value, now);
      gainNode.gain.linearRampToValueAtTime(gain, now + HUM_RAMP_S);
    },

    chime() {
      if (!enabled || !ctx || !master) return;
      playChime(ctx, master);
    },

    finish() {
      if (!enabled || !ctx || !master) return;
      const now = ctx.currentTime;
      for (const hz of FINISH_NOTES_HZ) {
        playNote(ctx, master, hz, now, FINISH_HOLD_S, FINISH_PEAK_GAIN);
      }
    },
  };
}
