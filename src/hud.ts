// The HUD: a big years-ago counter, the brick/height readout, the
// press-and-hold prompt, and controls (currently just "Change", which
// reopens the start screen; later slices add sound and start-over here).
// Ports the prototype's HUD markup and copy (docs/prototype/brick-stack.html).
// DOM glue only.

import { fmtInt, fmtMeters } from './lib/format';
import { heightM, initialSim, type SimState } from './lib/sim';

export function createHud(
  root: HTMLElement,
  opts: { onChange: () => void },
): { update(sim: SimState): void; hidePrompt(): void } {
  const hud = document.createElement('div');
  hud.className = 'hud';
  hud.setAttribute('aria-live', 'off');

  const years = document.createElement('div');
  years.className = 'big';

  const row = document.createElement('div');
  row.className = 'row';
  const bricks = document.createElement('b');
  const height = document.createElement('b');
  row.append('years ago', document.createElement('br'), bricks, ' bricks · ', height, ' tall');

  const controls = document.createElement('div');
  controls.className = 'hud-controls';

  const changeButton = document.createElement('button');
  changeButton.type = 'button';
  changeButton.className = 'hud-button';
  changeButton.textContent = 'Change';
  changeButton.addEventListener('click', opts.onChange);
  controls.append(changeButton);

  hud.append(years, row, controls);

  const prompt = document.createElement('div');
  prompt.className = 'prompt';
  prompt.append(
    'Press and hold anywhere.',
    document.createElement('br'),
    'Every brick is one year, going back in time.',
  );

  root.append(hud, prompt);

  function paint(sim: SimState): void {
    years.textContent = fmtInt(sim.years);
    bricks.textContent = fmtInt(sim.years);
    height.textContent = fmtMeters(heightM(sim));
  }

  paint(initialSim());

  return {
    update: paint,
    hidePrompt() {
      prompt.classList.add('off');
    },
  };
}
