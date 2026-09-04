// The end screen: shown once the stack reaches TOTAL_YEARS. Reference for
// look and copy is docs/prototype/brick-stack.html's `.done` overlay. DOM
// glue only — src/main.ts decides when to show/hide it.

import { DEFAULT_PROFILE, type Personalization } from './lib/personalize';

const COPY_LABEL_RESET_MS = 2000;

function nameLine(profile: Personalization): string {
  if (profile.name === DEFAULT_PROFILE.name) {
    return `You were the first ${profile.ageYears}.`;
  }
  const name = profile.name.charAt(0).toUpperCase() + profile.name.slice(1);
  return `${name}, you were the first ${profile.ageYears}.`;
}

export function createEndScreen(
  root: HTMLElement,
  onAgain: () => void,
): { show(profile: Personalization): void; hide(): void } {
  const overlay = document.createElement('div');
  overlay.className = 'end-screen';
  overlay.hidden = true;
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-labelledby', 'end-screen-big');
  // A tap on the overlay's own label text or padding must not reach the
  // window hold listener and count as the user's first hold.
  overlay.setAttribute('data-hold-ignore', '');

  const panel = document.createElement('div');
  panel.className = 'end-panel';

  const big = document.createElement('div');
  big.id = 'end-screen-big';
  big.className = 'end-big';
  big.textContent = '4,600,000,000 bricks.';

  const aroundLine = document.createElement('p');
  aroundLine.className = 'end-line';
  aroundLine.textContent =
    'That stack goes all the way around the Earth, and keeps going for another 4,000 kilometers.';

  const youLine = document.createElement('p');
  youLine.className = 'end-line';

  const actions = document.createElement('div');
  actions.className = 'end-actions';

  const againButton = document.createElement('button');
  againButton.type = 'button';
  againButton.className = 'end-button';
  againButton.textContent = 'Build it again';
  againButton.addEventListener('click', onAgain);

  const copyButton = document.createElement('button');
  copyButton.type = 'button';
  copyButton.className = 'end-button';
  copyButton.textContent = 'Copy link';
  copyButton.addEventListener('click', handleCopy);

  actions.append(againButton, copyButton);
  panel.append(big, aroundLine, youLine, actions);
  overlay.append(panel);
  root.append(overlay);

  let copyResetTimer: ReturnType<typeof setTimeout> | null = null;

  function resetCopyLabel(): void {
    if (copyResetTimer !== null) {
      clearTimeout(copyResetTimer);
      copyResetTimer = null;
    }
    copyButton.textContent = 'Copy link';
  }

  function handleCopy(): void {
    // Never the name, never query params — the bare page URL only.
    const url = location.origin + location.pathname;
    const clipboard = navigator.clipboard;
    if (!clipboard?.writeText) return; // no Clipboard API: leave the label alone

    clipboard
      .writeText(url)
      .then(() => {
        copyButton.textContent = 'Copied';
        if (copyResetTimer !== null) clearTimeout(copyResetTimer);
        copyResetTimer = setTimeout(() => {
          copyButton.textContent = 'Copy link';
          copyResetTimer = null;
        }, COPY_LABEL_RESET_MS);
      })
      .catch(() => {
        // Write failed (permissions, insecure context, etc.) — leave the
        // label as "Copy link" rather than claim success.
      });
  }

  return {
    show(profile) {
      youLine.textContent = nameLine(profile);
      overlay.hidden = false;
      againButton.focus();
    },
    hide() {
      overlay.hidden = true;
      resetCopyLabel();
    },
  };
}
