// The HUD: a big years-ago counter, the brick/height readout, the
// press-and-hold prompt, and controls (the sound toggle, and "Restart",
// which ends the session, resets the build, and reopens the start screen).
// Ports the prototype's HUD markup and copy (docs/prototype/brick-stack.html).
// DOM glue only.

import { BRICK_M } from './lib/constants';
import { fmtInt, fmtMeters } from './lib/format';
import { bricksFor, initialSim, type SimState } from './lib/sim';

export function createHud(
  root: HTMLElement,
  opts: { onSoundToggle: () => void; onRestart: () => void },
): {
  update(sim: SimState): void;
  hidePrompt(): void;
  showPrompt(): void;
  setSound(enabled: boolean): void;
} {
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

  const soundButton = document.createElement('button');
  soundButton.type = 'button';
  soundButton.className = 'hud-button';
  soundButton.setAttribute('aria-pressed', 'false');
  soundButton.textContent = 'Sound off';
  soundButton.addEventListener('click', opts.onSoundToggle);

  const restartButton = document.createElement('button');
  restartButton.type = 'button';
  restartButton.className = 'hud-button';
  restartButton.textContent = 'Restart';
  restartButton.addEventListener('click', opts.onRestart);

  controls.append(soundButton, restartButton);

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
    const wholeBricks = bricksFor(sim.years);
    years.textContent = fmtInt(wholeBricks);
    bricks.textContent = fmtInt(wholeBricks);
    height.textContent = fmtMeters(wholeBricks * BRICK_M);
  }

  paint(initialSim());

  return {
    update: paint,
    hidePrompt() {
      prompt.classList.add('off');
    },
    showPrompt() {
      prompt.classList.remove('off');
    },
    setSound(enabled: boolean) {
      soundButton.setAttribute('aria-pressed', String(enabled));
      soundButton.textContent = enabled ? 'Sound on' : 'Sound off';
    },
  };
}
