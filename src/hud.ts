// The HUD: the big years-ago number, the scroll prompt on the hill, and the
// footer strip (how tall / how long ago, with comparison copy plugged in from
// outside). Sound, restart, "my facts", and the color chips live behind
// src/menu.ts's single corner tab, mounted into the `menuSlot` this returns —
// src/hud.ts knows nothing about them.
// Look and copy match docs/design/picture-book.dc.html. DOM glue only.

import { fmtCount, fmtInt, fmtMeters } from './lib/format';
import { bricksFor, heightM, initialSim, type SimState } from './lib/sim';

// The floor for a footer measurement, matching .hud-footer's own min-height
// in src/style.css: a reading taken before the footer has laid out (or before
// its fonts have landed) can come back short, and the ground line above it
// must never drop into the strip.
const FOOTER_MIN_HEIGHT_PX = 64;

export function createHud(root: HTMLElement): {
  update(sim: SimState): void;
  setHasScrolled(hasScrolled: boolean): void;
  setComparisons(c: { tall: string; ago: string }): void;
  // Where the prompt's own box sits, in viewport px: src/main.ts derives it
  // from the stage's ground line (src/render/stage.ts's BAND_PROMPT_TOP_PX),
  // so the prompt lands in the ground band on the hill rather than guessing
  // an offset from the bottom of the screen.
  setPromptTop(y: number): void;
  // Where src/main.ts mounts src/menu.ts's tab and panel: the top-right
  // corner, and nothing else (.menu-slot in src/style.css).
  menuSlot: HTMLElement;
  // The bottom (in viewport px) of the big number block — the one HUD block
  // that reaches far enough down to crowd the stage's usable top. src/main.ts
  // feeds it straight into src/lib/layout.ts's stageTopFor, which keeps every
  // canvas icon clear of it.
  numberBlockBottom(): number;
  // How tall the footer strip renders right now, floored at its CSS
  // min-height. src/main.ts lifts the ground line by this much so the ground
  // band below it is never covered.
  footerHeight(): number;
} {
  const big = document.createElement('div');
  big.className = 'hud-big';
  const yearsEl = document.createElement('div');
  yearsEl.className = 'hud-years';
  const agoLabel = document.createElement('div');
  agoLabel.className = 'hud-ago';
  agoLabel.textContent = 'years ago!';
  big.append(yearsEl, agoLabel);

  const menuSlot = document.createElement('div');
  menuSlot.className = 'menu-slot';

  const prompt = document.createElement('div');
  prompt.className = 'prompt';
  prompt.textContent = 'Scroll to build. Scroll back to undo.';

  const footer = document.createElement('div');
  footer.className = 'hud-footer';

  const leftCell = document.createElement('div');
  leftCell.className = 'hud-footer-cell';
  const tallLabel = document.createElement('span');
  tallLabel.className = 'hud-footer-label';
  tallLabel.textContent = 'how tall?';
  const tallValue = document.createElement('span');
  tallValue.className = 'hud-footer-value';
  const tallComparison = document.createElement('span');
  tallComparison.className = 'hud-footer-comparison';
  tallComparison.textContent = '...';
  leftCell.append(tallLabel, tallValue, tallComparison);

  const rightCell = document.createElement('div');
  rightCell.className = 'hud-footer-cell';
  const agoComparison = document.createElement('span');
  agoComparison.className = 'hud-footer-comparison';
  agoComparison.textContent = '...';
  const agoValue = document.createElement('span');
  agoValue.className = 'hud-footer-value';
  const agoLabelEl = document.createElement('span');
  agoLabelEl.className = 'hud-footer-label';
  agoLabelEl.textContent = 'how long ago?';
  rightCell.append(agoComparison, agoValue, agoLabelEl);

  footer.append(leftCell, rightCell);

  root.append(big, menuSlot, footer, prompt);

  function paint(sim: SimState): void {
    const bricks = bricksFor(sim.years);
    yearsEl.textContent = fmtInt(bricks);
    tallValue.textContent = fmtMeters(heightM(sim));
    agoValue.textContent = fmtCount(bricks, 'year');
  }

  paint(initialSim());

  return {
    update: paint,
    // The prompt and the footer are two faces of the same "have we scrolled
    // yet" state, so one call toggles both: hasScrolled true hides the
    // prompt and shows the footer, false (a replay) puts them back.
    setHasScrolled(hasScrolled: boolean) {
      prompt.classList.toggle('off', hasScrolled);
      footer.classList.toggle('visible', hasScrolled);
    },
    setComparisons(c: { tall: string; ago: string }) {
      tallComparison.textContent = c.tall;
      agoComparison.textContent = c.ago;
    },
    setPromptTop(y: number) {
      prompt.style.top = `${Math.round(y)}px`;
    },
    menuSlot,
    numberBlockBottom() {
      return big.getBoundingClientRect().bottom;
    },
    footerHeight() {
      return Math.max(FOOTER_MIN_HEIGHT_PX, footer.getBoundingClientRect().height);
    },
  };
}
