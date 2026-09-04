// Pointer + keyboard hold detection: press-and-hold anywhere, or hold Space
// or Enter. DOM glue only — maps DOM events to src/lib/hold-state.ts's
// HoldEvent shape and applies its pure reducer, which owns the actual hold
// rules (see hold-state.test.ts).

import { INITIAL_HOLD, reduceHold, type HoldEvent, type HoldState } from './lib/hold-state';

// Interactive elements (HUD buttons, links, form controls) should keep their
// own pointer/keyboard behavior instead of starting or stealing a hold.
// `[data-hold-ignore]` marks a whole region (the start and end screens) as
// off-limits too, so tapping their padding or label text can't be mistaken
// for the first hold.
function isInteractiveTarget(node: EventTarget | null): boolean {
  if (!(node instanceof Element)) return false;
  return node.closest('button, input, select, a, [data-hold-ignore]') !== null;
}

function isHeld(state: HoldState): boolean {
  return state.pointerDown || state.keys.length > 0;
}

export function createHoldInput(target: HTMLElement | Window, onChange: (held: boolean) => void): () => void {
  let state: HoldState = INITIAL_HOLD;

  function apply(event: HoldEvent, sourceEvent: Event): void {
    const wasHeld = isHeld(state);
    const result = reduceHold(state, event);
    state = result.state;
    if (result.preventDefault) sourceEvent.preventDefault();
    if (result.held !== wasHeld) {
      onChange(result.held);
    }
  }

  function onPointerDown(e: Event) {
    apply({ type: 'pointerdown', onInteractive: isInteractiveTarget((e as PointerEvent).target) }, e);
  }

  function onPointerUp(e: Event) {
    apply({ type: 'pointerup', onInteractive: false }, e);
  }

  function onPointerCancel(e: Event) {
    apply({ type: 'pointercancel', onInteractive: false }, e);
  }

  function onKeyDown(e: Event) {
    const ke = e as KeyboardEvent;
    apply({ type: 'keydown', code: ke.code, onInteractive: isInteractiveTarget(ke.target) }, e);
  }

  function onKeyUp(e: Event) {
    const ke = e as KeyboardEvent;
    apply({ type: 'keyup', code: ke.code, onInteractive: isInteractiveTarget(ke.target) }, e);
  }

  function onBlur(e: Event) {
    apply({ type: 'blur', onInteractive: false }, e);
  }

  target.addEventListener('pointerdown', onPointerDown);
  target.addEventListener('pointerup', onPointerUp);
  target.addEventListener('pointercancel', onPointerCancel);
  target.addEventListener('keydown', onKeyDown);
  target.addEventListener('keyup', onKeyUp);
  // Listen on window specifically: losing focus should release the hold no
  // matter what element this input was bound to.
  window.addEventListener('blur', onBlur);

  return () => {
    target.removeEventListener('pointerdown', onPointerDown);
    target.removeEventListener('pointerup', onPointerUp);
    target.removeEventListener('pointercancel', onPointerCancel);
    target.removeEventListener('keydown', onKeyDown);
    target.removeEventListener('keyup', onKeyUp);
    window.removeEventListener('blur', onBlur);
  };
}
