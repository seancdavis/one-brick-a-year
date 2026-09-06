// The HUD: the big years-ago number, the scroll prompt, the footer strip
// (how tall / how long ago, with comparison copy plugged in from outside),
// and the "next up" teaser. Sound, restart, "my facts", and the color chips
// all now live behind src/menu.ts's single corner tab, mounted into the
// `menuSlot` this returns — src/hud.ts no longer knows anything about them.
// Look and copy match docs/design/picture-book.dc.html. DOM glue only.

import { fmtInt, fmtMeters } from './lib/format';
import { bricksFor, heightM, initialSim, type SimState } from './lib/sim';

export function createHud(root: HTMLElement): {
  update(sim: SimState): void;
  setHasScrolled(hasScrolled: boolean): void;
  setComparisons(c: { tall: string; ago: string }): void;
  setNext(text: string | null): void;
  // Where src/main.ts mounts src/menu.ts's tab and panel — sits in the same
  // top-right column as the teaser (see .hud-side in src/style.css) so the
  // menu flows beneath the teaser's actual rendered height rather than a
  // guessed fixed offset.
  menuSlot: HTMLElement;
  // The bottom (in viewport px) of every HUD block that could crowd the
  // stage's usable top: the top-left number block and the top-right
  // teaser-plus-menu group. src/main.ts feeds these straight into
  // src/lib/layout.ts's stageTopFor (round 5's "Stage top clear of the HUD").
  cornerBottoms(): number[];
} {
  const big = document.createElement('div');
  big.className = 'hud-big';
  const yearsEl = document.createElement('div');
  yearsEl.className = 'hud-years';
  const agoLabel = document.createElement('div');
  agoLabel.className = 'hud-ago';
  agoLabel.textContent = 'years ago!';
  big.append(yearsEl, agoLabel);

  const teaser = document.createElement('div');
  teaser.className = 'hud-teaser';
  teaser.hidden = true;
  const teaserLabel = document.createElement('div');
  teaserLabel.className = 'hud-teaser-label';
  teaserLabel.textContent = 'next up';
  const teaserValue = document.createElement('div');
  teaserValue.className = 'hud-teaser-value';
  teaser.append(teaserLabel, teaserValue);

  const menuSlot = document.createElement('div');
  menuSlot.className = 'menu-slot';

  // Below 700px, the teaser and the menu share one right-aligned column (see
  // .hud-side in src/style.css) so the menu flows beneath the teaser's
  // actual rendered height instead of a guessed fixed offset.
  const side = document.createElement('div');
  side.className = 'hud-side';
  side.append(teaser, menuSlot);

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

  root.append(big, side, footer, prompt);

  function paint(sim: SimState): void {
    const bricks = bricksFor(sim.years);
    yearsEl.textContent = fmtInt(bricks);
    tallValue.textContent = fmtMeters(heightM(sim));
    agoValue.textContent = `${fmtInt(bricks)} years`;
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
    setNext(text: string | null) {
      teaser.hidden = text === null;
      teaserValue.textContent = text ?? '';
    },
    menuSlot,
    cornerBottoms() {
      return [big.getBoundingClientRect().bottom, side.getBoundingClientRect().bottom];
    },
  };
}
