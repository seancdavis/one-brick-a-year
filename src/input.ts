// Scroll input: mouse wheel, trackpad (also delivered as wheel events),
// touch/pointer drag, and a handful of keys as an accessible equivalent.
// DOM glue only — every gesture is reduced to a signed page-scroll delta
// (positive = scrolling down, matching a wheel event's native deltaY sign)
// and handed to onScroll, which src/main.ts folds into src/lib/sim.ts's
// applyScroll. No hold, no click-to-build: scroll replaces everything, and
// either direction works — down undoes, up builds.

export type ScrollKind = 'wheel' | 'touch' | 'keyboard';

// A wheel event's deltaY is in px only when deltaMode is 0 (DOM_DELTA_PIXEL).
// Line mode (1, some browsers/devices) and the rare page mode (2) need
// converting to an approximate px figure first.
const WHEEL_LINE_PX = 16;
const WHEEL_PAGE_PX = 400;

// Fixed step per keydown for the keyboard equivalent (repeats count, since
// each repeat fires its own keydown). Positive follows page-scroll-down
// semantics (undoes); negative builds. ArrowDown/PageDown undo,
// ArrowUp/PageUp/Space build.
const KEY_STEP_PX = 40;
const KEY_DELTAS: Record<string, number> = {
  ArrowDown: KEY_STEP_PX,
  PageDown: KEY_STEP_PX,
  ArrowUp: -KEY_STEP_PX,
  PageUp: -KEY_STEP_PX,
  Space: -KEY_STEP_PX,
};

// Interactive elements (HUD buttons, links, form controls) keep their own
// pointer/keyboard behavior instead of being read as a scroll gesture.
// `[data-scroll-ignore]` marks a whole region (the start and end screens) as
// off-limits too, so tapping their padding or label text isn't mistaken for
// a drag or a keypress that should build the stack.
function isInteractiveTarget(node: EventTarget | null): boolean {
  if (!(node instanceof Element)) return false;
  return node.closest('button, input, select, a, [data-scroll-ignore]') !== null;
}

function normalizeWheelDeltaY(e: WheelEvent): number {
  if (e.deltaMode === 1) return e.deltaY * WHEEL_LINE_PX;
  if (e.deltaMode === 2) return e.deltaY * WHEEL_PAGE_PX;
  return e.deltaY;
}

export function createScrollInput(target: Window, onScroll: (deltaPx: number, kind: ScrollKind) => void): () => void {
  let dragPointerId: number | null = null;
  let lastY = 0;

  function onWheel(e: Event): void {
    const we = e as WheelEvent;
    if (isInteractiveTarget(we.target)) return;
    we.preventDefault();
    const deltaPx = normalizeWheelDeltaY(we);
    if (deltaPx !== 0) onScroll(deltaPx, 'wheel');
  }

  function onPointerDown(e: Event): void {
    const pe = e as PointerEvent;
    if (isInteractiveTarget(pe.target)) return;
    dragPointerId = pe.pointerId;
    lastY = pe.clientY;
  }

  function onPointerMove(e: Event): void {
    if (dragPointerId === null) return;
    const pe = e as PointerEvent;
    if (pe.pointerId !== dragPointerId) return;
    // Finger moving up (clientY decreasing) reads as a positive page delta —
    // the same page-scroll-down semantics a wheel event's deltaY carries —
    // so dragging your finger up undoes, matching normal page-scroll feel.
    const deltaPx = lastY - pe.clientY;
    lastY = pe.clientY;
    if (deltaPx !== 0) onScroll(deltaPx, 'touch');
  }

  function onPointerEnd(e: Event): void {
    const pe = e as PointerEvent;
    if (pe.pointerId !== dragPointerId) return;
    dragPointerId = null;
  }

  function onKeyDown(e: Event): void {
    const ke = e as KeyboardEvent;
    const deltaPx = KEY_DELTAS[ke.code];
    if (deltaPx === undefined) return;
    if (isInteractiveTarget(ke.target)) return;
    ke.preventDefault();
    onScroll(deltaPx, 'keyboard');
  }

  // { passive: false } so preventDefault() above actually stops the page
  // itself from scrolling under the wheel gesture.
  target.addEventListener('wheel', onWheel, { passive: false });
  target.addEventListener('pointerdown', onPointerDown);
  target.addEventListener('pointermove', onPointerMove);
  target.addEventListener('pointerup', onPointerEnd);
  target.addEventListener('pointercancel', onPointerEnd);
  target.addEventListener('keydown', onKeyDown);

  return () => {
    target.removeEventListener('wheel', onWheel);
    target.removeEventListener('pointerdown', onPointerDown);
    target.removeEventListener('pointermove', onPointerMove);
    target.removeEventListener('pointerup', onPointerEnd);
    target.removeEventListener('pointercancel', onPointerEnd);
    target.removeEventListener('keydown', onKeyDown);
  };
}
