// Pure reducer for press-and-hold state (pointer and/or keyboard). No DOM —
// src/input.ts maps real events onto HoldEvent and applies this, so the
// tricky part (which key owns the hold, what a repeat does, what happens
// when focus lands on a button mid-hold) is testable without a browser.

export interface HoldState {
  pointerDown: boolean;
  keys: readonly string[];
}

export const INITIAL_HOLD: HoldState = { pointerDown: false, keys: [] };

export interface HoldEvent {
  type: 'pointerdown' | 'pointerup' | 'pointercancel' | 'keydown' | 'keyup' | 'blur';
  code?: string;
  onInteractive: boolean;
}

// Only these keys start or extend a hold.
const HOLD_KEYS = new Set(['Space', 'Enter']);

export function reduceHold(
  state: HoldState,
  e: HoldEvent,
): { state: HoldState; held: boolean; preventDefault: boolean } {
  let next = state;
  let preventDefault = false;

  switch (e.type) {
    case 'pointerdown':
      // Interactive targets (HUD buttons, links, form controls) keep their
      // own pointer behavior instead of starting a hold.
      if (!e.onInteractive) {
        next = { ...state, pointerDown: true };
      }
      break;

    case 'pointerup':
    case 'pointercancel':
      next = { ...state, pointerDown: false };
      break;

    case 'keydown': {
      const code = e.code;
      if (code && HOLD_KEYS.has(code)) {
        const owned = state.keys.includes(code);
        if (owned) {
          // A repeat of a key this hold already owns. Focus may well have
          // moved to a button (e.g. the end screen's "Build it again") by
          // now, but the hold still owns this key, so the repeat is always
          // suppressed — otherwise it would also activate that button.
          preventDefault = true;
        } else if (!e.onInteractive) {
          // A fresh key, pressed somewhere that isn't interactive: this
          // hold now owns it.
          next = { ...state, keys: [...state.keys, code] };
          preventDefault = true;
        }
        // A fresh key pressed on an interactive target (e.g. Space on a
        // focused button) is left alone entirely, so the button's own
        // keyboard activation keeps working.
      }
      break;
    }

    case 'keyup': {
      const code = e.code;
      if (code && HOLD_KEYS.has(code) && state.keys.includes(code)) {
        // Always release a key this hold owns, no matter where focus is
        // now — this is what keeps the hold from latching when the key-up
        // lands on a button (see hold-state.test.ts).
        next = { ...state, keys: state.keys.filter((k) => k !== code) };
        preventDefault = true;
      }
      break;
    }

    case 'blur':
      next = INITIAL_HOLD;
      break;
  }

  return { state: next, held: next.pointerDown || next.keys.length > 0, preventDefault };
}
