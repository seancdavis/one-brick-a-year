// Pointer + keyboard hold detection: press-and-hold anywhere, or hold Space/Enter.
// DOM glue only — the resulting boolean drives src/lib/sim.ts, which stays pure.

const HOLD_KEYS = new Set(['Space', 'Enter']);

// Interactive elements (HUD buttons, links, form controls) should keep their
// own pointer behavior instead of starting a hold.
function isInteractiveTarget(node: EventTarget | null): boolean {
  if (!(node instanceof Element)) return false;
  return node.closest('button, input, select, a') !== null;
}

export function createHoldInput(target: HTMLElement | Window, onChange: (held: boolean) => void): () => void {
  let held = false;

  function setHeld(next: boolean) {
    if (next === held) return;
    held = next;
    onChange(held);
  }

  function onPointerDown(e: Event) {
    const pe = e as PointerEvent;
    if (isInteractiveTarget(pe.target)) return;
    setHeld(true);
  }

  function onPointerUp() {
    setHeld(false);
  }

  function onPointerCancel() {
    setHeld(false);
  }

  function onKeyDown(e: Event) {
    const ke = e as KeyboardEvent;
    if (!HOLD_KEYS.has(ke.code)) return;
    ke.preventDefault();
    setHeld(true);
  }

  function onKeyUp(e: Event) {
    const ke = e as KeyboardEvent;
    if (!HOLD_KEYS.has(ke.code)) return;
    setHeld(false);
  }

  function onBlur() {
    setHeld(false);
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
