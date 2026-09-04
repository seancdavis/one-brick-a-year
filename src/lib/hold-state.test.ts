import { describe, expect, it } from 'vitest';
import { INITIAL_HOLD, reduceHold } from './hold-state';

describe('reduceHold', () => {
  it('keydown Space elsewhere starts the hold and prevents default', () => {
    const result = reduceHold(INITIAL_HOLD, { type: 'keydown', code: 'Space', onInteractive: false });
    expect(result.held).toBe(true);
    expect(result.preventDefault).toBe(true);
    expect(result.state.keys).toEqual(['Space']);
  });

  it('releases the hold on keyup even when focus has moved to a button (the latch bug)', () => {
    const down = reduceHold(INITIAL_HOLD, { type: 'keydown', code: 'Space', onInteractive: false });
    // Focus moved to "Build it again" before the key-up fires.
    const up = reduceHold(down.state, { type: 'keyup', code: 'Space', onInteractive: true });

    expect(up.held).toBe(false);
    expect(up.preventDefault).toBe(true);
    expect(up.state.keys).toEqual([]);
  });

  it('suppresses repeats of an owned key regardless of target, without duplicating it', () => {
    const down = reduceHold(INITIAL_HOLD, { type: 'keydown', code: 'Enter', onInteractive: false });

    const repeatElsewhere = reduceHold(down.state, { type: 'keydown', code: 'Enter', onInteractive: false });
    expect(repeatElsewhere.held).toBe(true);
    expect(repeatElsewhere.preventDefault).toBe(true);
    expect(repeatElsewhere.state.keys).toEqual(['Enter']);

    // A key repeat that lands on the now-focused button must still be
    // suppressed, or it would also activate that button.
    const repeatOnButton = reduceHold(down.state, { type: 'keydown', code: 'Enter', onInteractive: true });
    expect(repeatOnButton.held).toBe(true);
    expect(repeatOnButton.preventDefault).toBe(true);
    expect(repeatOnButton.state.keys).toEqual(['Enter']);
  });

  it('ignores a keydown on an interactive target for a key not already owned', () => {
    const result = reduceHold(INITIAL_HOLD, { type: 'keydown', code: 'Space', onInteractive: true });
    expect(result.held).toBe(false);
    expect(result.preventDefault).toBe(false);
    expect(result.state).toEqual(INITIAL_HOLD);
  });

  it('ignores a keyup for a key that is not owned', () => {
    const result = reduceHold(INITIAL_HOLD, { type: 'keyup', code: 'Space', onInteractive: false });
    expect(result.held).toBe(false);
    expect(result.preventDefault).toBe(false);
    expect(result.state).toEqual(INITIAL_HOLD);
  });

  it('ignores a pointerdown on an interactive target', () => {
    const result = reduceHold(INITIAL_HOLD, { type: 'pointerdown', onInteractive: true });
    expect(result.held).toBe(false);
    expect(result.state.pointerDown).toBe(false);
  });

  it('blur clears everything', () => {
    const pointerDown = reduceHold(INITIAL_HOLD, { type: 'pointerdown', onInteractive: false });
    const withKey = reduceHold(pointerDown.state, { type: 'keydown', code: 'Space', onInteractive: false });
    const blurred = reduceHold(withKey.state, { type: 'blur', onInteractive: false });

    expect(blurred.held).toBe(false);
    expect(blurred.state).toEqual(INITIAL_HOLD);
  });

  it('combines pointer and key holds: releasing one leaves the other held', () => {
    const pointerDown = reduceHold(INITIAL_HOLD, { type: 'pointerdown', onInteractive: false });
    const alsoKey = reduceHold(pointerDown.state, { type: 'keydown', code: 'Space', onInteractive: false });
    expect(alsoKey.held).toBe(true);

    const pointerUp = reduceHold(alsoKey.state, { type: 'pointerup', onInteractive: false });
    expect(pointerUp.held).toBe(true); // the key is still held

    const keyUp = reduceHold(pointerUp.state, { type: 'keyup', code: 'Space', onInteractive: true });
    expect(keyUp.held).toBe(false);
  });
});
