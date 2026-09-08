// The start screen: a full-screen overlay collecting the child's name, age,
// and home height before the build begins, and reopened from the HUD's
// "Restart" button. DOM glue only — validation is delegated to
// src/lib/personalize.ts, so there is exactly one place that decides what a
// valid profile looks like.

import { createColorPicker } from './color-picker';
import { DEFAULT_PROFILE, HOME_OPTIONS, parsePersonalization, type Personalization } from './lib/personalize';

const SWATCH_SIZE_PX = 28;

export function createStartScreen(
  root: HTMLElement,
  onStart: (p: Personalization) => void,
): { open(profile: Personalization, opts?: { dismissible?: boolean }): void; close(): void; isOpen(): boolean } {
  const overlay = document.createElement('div');
  overlay.className = 'start-screen';
  overlay.hidden = true;
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-labelledby', 'start-screen-title');
  // A tap or drag on the overlay's own label text or padding must not reach
  // the window scroll listener and count as the user's first scroll.
  overlay.setAttribute('data-scroll-ignore', '');

  const form = document.createElement('form');
  form.className = 'start-form';
  form.setAttribute('novalidate', ''); // parsePersonalization does the real validation

  const title = document.createElement('h1');
  title.id = 'start-screen-title';
  title.className = 'start-title';
  title.textContent = 'One Brick a Year';

  const blurb = document.createElement('p');
  blurb.className = 'start-blurb';
  blurb.textContent = 'One LEGO brick for every year, going back in time. Scroll to build the stack.';

  const nameSpan = document.createElement('span');
  nameSpan.textContent = 'Your name';
  const nameInput = document.createElement('input');
  nameInput.type = 'text';
  nameInput.name = 'name';
  nameInput.maxLength = 24;
  nameInput.autocomplete = 'off';
  nameInput.placeholder = 'e.g. Ellie';
  const nameField = document.createElement('label');
  nameField.className = 'start-field';
  nameField.append(nameSpan, nameInput);

  const ageSpan = document.createElement('span');
  ageSpan.textContent = 'How old are you?';
  const ageInput = document.createElement('input');
  ageInput.type = 'number';
  ageInput.name = 'age';
  ageInput.min = '1';
  ageInput.max = '120';
  ageInput.step = '1';
  ageInput.inputMode = 'numeric';
  const ageField = document.createElement('label');
  ageField.className = 'start-field';
  ageField.append(ageSpan, ageInput);

  const homeSpan = document.createElement('span');
  homeSpan.textContent = 'How tall is your home?';
  const homeSelect = document.createElement('select');
  homeSelect.name = 'home';
  for (const option of HOME_OPTIONS) {
    const el = document.createElement('option');
    el.value = String(option.meters);
    el.textContent = option.label;
    homeSelect.append(el);
  }
  const homeField = document.createElement('label');
  homeField.className = 'start-field';
  homeField.append(homeSpan, homeSelect);

  let selectedColorId = DEFAULT_PROFILE.colorId;
  const colorSpan = document.createElement('span');
  colorSpan.textContent = 'Brick color';
  const colorPicker = createColorPicker(SWATCH_SIZE_PX, selectedColorId, (colorId) => {
    selectedColorId = colorId;
  });
  const colorField = document.createElement('div');
  colorField.className = 'start-field';
  colorField.append(colorSpan, colorPicker.el);

  const submit = document.createElement('button');
  submit.type = 'submit';
  submit.className = 'start-button';
  submit.textContent = 'Start stacking';

  form.append(title, blurb, nameField, ageField, homeField, colorField, submit);
  overlay.append(form);
  root.append(overlay);

  let isOpenFlag = false;
  let dismissible = true;

  function handleSubmit(e: Event): void {
    e.preventDefault();
    // Build the same shape parsePersonalization reads from the URL, so the
    // form goes through the exact validation URL params do.
    const params = new URLSearchParams();
    const name = nameInput.value.trim();
    if (name) params.set('name', name);
    if (ageInput.value) params.set('age', ageInput.value);
    if (homeSelect.value) params.set('home', homeSelect.value);
    params.set('color', selectedColorId);
    onStart(parsePersonalization(params, null));
  }

  function handleKeydown(e: Event): void {
    const ke = e as KeyboardEvent;
    if (ke.key !== 'Escape' || !dismissible) return;
    hide();
  }

  function hide(): void {
    if (!isOpenFlag) return;
    isOpenFlag = false;
    overlay.hidden = true;
    overlay.removeEventListener('keydown', handleKeydown);
  }

  form.addEventListener('submit', handleSubmit);

  return {
    open(profile, opts) {
      dismissible = opts?.dismissible ?? true;
      // Personalization no longer carries a name, so this field never has
      // one to prefill.
      nameInput.value = '';
      ageInput.value = String(profile.ageYears);
      homeSelect.value = String(profile.homeMeters);
      selectedColorId = profile.colorId;
      colorPicker.setSelected(selectedColorId);

      isOpenFlag = true;
      overlay.hidden = false;
      overlay.addEventListener('keydown', handleKeydown);
      nameInput.focus();
    },
    close: hide,
    isOpen: () => isOpenFlag,
  };
}
