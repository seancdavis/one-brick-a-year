// The milestone card: announces a beat when the stack crosses it, without
// pausing the build. DOM glue only — the beat data lives in src/lib/beats.ts.

import type { Beat } from './lib/beats';

// How long a card stays up. When beats arrive faster than that (a fast
// scroll crosses several at once), later cards in the queue use the shorter
// minimum instead, so the queue catches back up to the stack.
const SHOW_MS = 4500;
const SHOW_MS_MIN = 2500;
// Matches the CSS transition duration on .beat-card in src/style.css.
const LEAVE_MS = 350;

export function createBeatCards(root: HTMLElement): { show(beat: Beat): void; clear(): void } {
  const card = document.createElement('div');
  card.className = 'beat-card';
  card.setAttribute('aria-live', 'polite');

  const title = document.createElement('div');
  title.className = 'beat-title';

  const line = document.createElement('div');
  line.className = 'beat-line';

  card.append(title, line);
  root.append(card);

  let queue: Beat[] = [];
  let showTimer: ReturnType<typeof setTimeout> | null = null;
  let leaveTimer: ReturnType<typeof setTimeout> | null = null;
  let active = false;
  // Alternates the card's paper-note tilt (-1.5deg / 1.5deg) each time a new
  // one is shown, so consecutive cards don't all lean the same way.
  let tiltAlt = false;

  function clearTimers(): void {
    if (showTimer !== null) {
      clearTimeout(showTimer);
      showTimer = null;
    }
    if (leaveTimer !== null) {
      clearTimeout(leaveTimer);
      leaveTimer = null;
    }
  }

  function showNext(): void {
    const beat = queue.shift();
    if (!beat) {
      active = false;
      return;
    }

    active = true;
    title.textContent = beat.title;
    line.textContent = beat.line;
    card.classList.toggle('beat-card--alt', tiltAlt);
    tiltAlt = !tiltAlt;
    card.classList.add('visible');

    // More than one beat still waiting behind this one: drain the queue
    // faster instead of letting it fall further behind the stack.
    const duration = queue.length > 1 ? SHOW_MS_MIN : SHOW_MS;

    showTimer = setTimeout(() => {
      card.classList.remove('visible');
      leaveTimer = setTimeout(showNext, LEAVE_MS);
    }, duration);
  }

  return {
    show(beat: Beat) {
      queue.push(beat);
      if (!active) showNext();
    },
    clear() {
      clearTimers();
      queue = [];
      active = false;
      card.classList.remove('visible');
    },
  };
}
