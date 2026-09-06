#!/usr/bin/env node
// Turns the two ticked candidate lists in docs/content/ into the TypeScript
// array literals the data files hold, so the lists can be regenerated after
// Sean re-ticks them:
//
//   node scripts/candidates-to-data.mjs
//
// It prints two blocks to stdout — BEATS (time events, for src/lib/beats.ts)
// and THINGS (physical comparisons, for src/lib/landmarks.ts) — which are
// pasted in and then hand-edited: titles, icons, and any line the candidate
// list didn't supply are the developer's job, and the script marks them TODO.
//
// Only `- [x]` items are kept. Ids are pinned by the tables below so a
// regenerated list never renames a row that is already in the data files.
// The "Beyond the stack", "Mind-benders", and "Personalization ideas"
// sections are not stack data and are skipped.

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const EVENTS_FILE = path.join(ROOT, 'docs/content/candidate-events.md');
const HEIGHTS_FILE = path.join(ROOT, 'docs/content/candidate-heights.md');

const SKIP_SECTION = /^##\s+(Beyond the stack|Mind-benders|Personalization ideas)/;
const FLAT_SECTION = /^##\s+Laid on its side/;

// Ids are hand-owned: the slugifier below is only a starting point for a
// newly ticked row. These tables pin the id every current row already has,
// so re-running the script reproduces the files instead of renaming
// everything. Add a row here when you settle on its id.
const EVENT_IDS = new Map([
  ['your last birthday', 'birthday'],
  ['your whole life', 'life'],
  ['Minecraft comes out', 'minecraft'],
  ['the first iPhone', 'iphone'],
  ['YouTube starts', 'youtube'],
  ['the year 2000', 'y2k'],
  ['the first emoji', 'emoji'],
  ['the first Toy Story movie', 'toy-story'],
  ['the first Moon landing', 'moon-landing'],
  ['the LEGO brick as we know it', 'lego-brick'],
  ['the first computer', 'computer'],
  ['sliced bread', 'sliced-bread'],
  ['the first television', 'television'],
  ['the first airplane', 'airplane'],
  ['the Eiffel Tower opens', 'eiffel-opens'],
  ['the light bulb', 'light-bulb'],
  ['the first photograph', 'photograph'],
  ['the first bicycle', 'bicycle'],
  ['the Mona Lisa is painted', 'mona-lisa'],
  ['the printing press', 'printing-press'],
  ['chess is invented', 'chess'],
  ['the number zero is written down', 'zero'],
  ['Cleopatra', 'cleopatra'],
  ['the Great Wall of China begins', 'great-wall'],
  ['the first Olympic Games', 'olympics'],
  ['the alphabet', 'alphabet'],
  ['the last woolly mammoths', 'mammoths'],
  ['the Great Pyramid', 'pyramid'],
  ['the oldest living tree sprouts', 'oldest-tree'],
  ['people start writing things down', 'writing'],
  ['the wheel', 'wheel'],
  ['cheese', 'cheese'],
  ['the oldest chewing gum', 'chewing-gum'],
  ['the oldest shoes', 'shoes'],
  ['the last Ice Age ends', 'ice-age-ends'],
  ['farming begins', 'farming'],
  ['bread', 'bread'],
  ['dogs', 'dogs'],
  ['the oldest toy? a carved bird', 'oldest-toy'],
  ['the Neanderthals disappear', 'neanderthals'],
  ['people reach Australia', 'australia'],
  ['people leave Africa', 'out-of-africa'],
  ['bows and arrows', 'bows'],
  ['the oldest drawing', 'oldest-drawing'],
  ['the oldest jewelry', 'jewelry'],
  ['the first people', 'humans'],
  ['people control fire', 'fire'],
  ['Homo erectus', 'homo-erectus'],
  ['the Ice Ages begin', 'ice-ages'],
  ['Lucy', 'lucy'],
  ['the first stone tools', 'stone-tools'],
  ['the Grand Canyon starts being carved', 'grand-canyon'],
  ['our last shared grandparent with chimpanzees', 'chimp-ancestor'],
  ['the first apes', 'apes'],
  ["whales' ancestors walk into the sea", 'whales'],
  ['the first primates', 'primates'],
  ['the world gets very hot', 'petm'],
  ['Titanoboa', 'titanoboa'],
  ['the asteroid hits the dinosaurs', 'asteroid'],
  ['T. rex', 't-rex'],
  ['Velociraptor', 'velociraptor'],
  ['Spinosaurus', 'spinosaurus'],
  ['bees', 'bees'],
  ['Saturn gets its rings', 'saturn-rings'],
  ['the first flowers', 'flowers'],
  ['Stegosaurus', 'stegosaurus'],
  ['the first bird', 'first-bird'],
  ['the Atlantic Ocean starts to open', 'atlantic'],
  ['the first mammals', 'mammals'],
  ['the first dinosaurs', 'dinosaurs'],
  ['all the land is one continent', 'pangaea'],
  ['the first eggs with shells', 'eggs'],
  ['the first sharks that look like sharks', 'modern-sharks'],
  ['a fish walks onto land', 'fish-on-land'],
  ['the first trees and forests', 'trees'],
  ['the first insects', 'insects'],
  ['the first land animals', 'land-animals'],
  ['the first sharks', 'sharks'],
  ['the first land plants', 'land-plants'],
  ['the first fish', 'fish'],
  ['the Cambrian explosion', 'cambrian'],
  ['the first animals', 'animals'],
  ['the first living thing made of many cells', 'many-cells'],
  ['the boring billion begins', 'boring-billion'],
  ['the first complex cells', 'complex-cells'],
  ['a natural nuclear reactor', 'natural-reactor'],
  ['the air gets oxygen', 'oxygen'],
  ['the first continents you could stand on', 'continents'],
  ['the oldest fossils', 'oldest-fossils'],
  ['the first life', 'life-first'],
  ['the oldest rocks', 'oldest-rocks'],
  ['the first oceans', 'oceans'],
  ['the oldest thing on Earth', 'oldest-thing'],
  ['the Moon is made', 'moon-made'],
  ['a day was six hours long', 'six-hour-day'],
  ['the Earth is born', 'earth-born'],
]);

const THING_IDS = new Map([
  ['one LEGO brick', 'brick'],
  ['a LEGO minifigure', 'minifigure'],
  ['a crayon', 'crayon'],
  ['a banana', 'banana'],
  ['a pencil', 'pencil'],
  ['a basketball', 'basketball'],
  ['a cat', 'cat'],
  ['a school ruler', 'ruler'],
  ['a big dog', 'dog'],
  ['a grown-up', 'grown-up'],
  ['a door', 'door'],
  ['a ceiling', 'ceiling'],
  ['a basketball hoop', 'hoop'],
  ['a giraffe', 'giraffe'],
  ['your home', 'home'],
  ['a school bus, stood on end', 'school-bus'],
  ['a Brachiosaurus, head up', 'brachiosaurus'],
  ['a blue whale', 'blue-whale'],
  ['the Statue of Liberty, the statue alone', 'liberty-statue'],
  ['the Leaning Tower of Pisa', 'pisa'],
  ['the biggest tree, General Sherman', 'general-sherman'],
  ['the Statue of Liberty', 'liberty'],
  ['Big Ben', 'big-ben'],
  ['the tallest tree, Hyperion', 'hyperion'],
  ['the Great Pyramid', 'great-pyramid'],
  ['the Space Needle', 'space-needle'],
  ['the Eiffel Tower', 'eiffel'],
  ['the Empire State Building', 'empire-state'],
  ['the tallest building on Earth', 'burj'],
  ['Angel Falls', 'angel-falls'],
  ['the Grand Canyon, top to bottom', 'grand-canyon-deep'],
  ['Mount Fuji', 'fuji'],
  ['Denali', 'denali'],
  ['Mount Everest', 'everest'],
  ['the deepest ocean', 'deepest-ocean'],
  ['where airplanes fly', 'planes'],
  ['the highest a bird has flown', 'highest-bird'],
  ['the ozone layer', 'ozone'],
  ['the highest balloon jump', 'balloon-jump'],
  ['a marathon', 'marathon'],
  ['where meteors burn up', 'meteors'],
  ['the highest clouds', 'highest-clouds'],
  ['space begins', 'space'],
  ['the space station', 'iss'],
  ['most satellites', 'satellites'],
  ['the Great Barrier Reef', 'barrier-reef'],
  ['the Moon, side to side', 'moon-wide'],
  ['the Appalachian Trail', 'appalachian'],
  ['the Mississippi River', 'mississippi'],
  ['the Amazon River', 'amazon'],
  ['the Nile', 'nile'],
  ['the Great Wall of China, the main wall', 'great-wall-flat'],
  ['as wide as the whole Earth', 'earth-wide'],
  ['from the North Pole to the South Pole', 'pole-to-pole'],
  ['all the way around the Earth', 'around'],
]);

const UNIT_M = { mm: 0.001, cm: 0.01, m: 1, km: 1000 };
const SCALE = { thousand: 1e3, million: 1e6, billion: 1e9 };

// A row whose years are "age" is the child's own life: it has no fixed
// number, so it sorts at the default profile age the same way BEATS authors
// it (src/lib/beats.ts's buildBeats swaps in the real one at runtime).
const DEFAULT_AGE_YEARS = 8;

function parseChecklist(text) {
  const items = [];
  let skipping = false;
  let flat = false;
  let current = null;

  for (const raw of text.split('\n')) {
    if (raw.startsWith('## ')) {
      current = null;
      skipping = SKIP_SECTION.test(raw);
      flat = FLAT_SECTION.test(raw);
      continue;
    }

    const box = raw.match(/^- \[([ xX])\]\s+(.*)$/);
    if (box) {
      current = null;
      if (skipping || box[1] === ' ') continue;
      current = { head: box[2].trim(), flat, fields: {} };
      items.push(current);
      continue;
    }

    // An indented "Key: value" line belongs to the item above it. The key
    // class excludes ":", so a value with its own colon still parses.
    const field = raw.match(/^\s+([A-Za-z ]+):\s*(.*)$/);
    if (field && current) current.fields[field[1].trim().toLowerCase()] = field[2].trim();
  }

  return items;
}

// "57", "4,590", "66,000,000", "about 1.05 billion", "at least 15,000".
function parseYears(text) {
  if (/^age$/i.test(text.trim())) return DEFAULT_AGE_YEARS;
  const match = text.match(/([\d][\d,.]*)\s*(thousand|million|billion)?/i);
  if (!match) return null;
  const n = Number(match[1].replace(/,/g, ''));
  if (!Number.isFinite(n)) return null;
  return match[2] ? n * SCALE[match[2].toLowerCase()] : n;
}

// "4 cm", "2 m", "12 km", "about 320 km", "1,857 m".
function parseMeters(text) {
  const match = text.match(/([\d][\d,.]*)\s*(mm|cm|km|m)\b/i);
  if (!match) return null;
  const n = Number(match[1].replace(/,/g, ''));
  if (!Number.isFinite(n)) return null;
  return n * UNIT_M[match[2].toLowerCase()];
}

// "the last woolly mammoths (about 4,000) — 4,000 (already on the stack)"
// splits into the name, whether it is already on the stack, and the tail
// holding the authoritative number.
function splitHead(head) {
  const already = /\(already on the stack\)/.test(head);
  const cleaned = head.replace(/\(already on the stack\)/, '').trim();
  const [first, ...rest] = cleaned.split('—');
  const name = first.trim().replace(/\s*\([^)]*\)\s*$/, '');
  return { name, already, tail: rest.join('—').trim() };
}

function slugify(name) {
  return name
    .toLowerCase()
    .replace(/^(the|a|an) /, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .split('-')
    .slice(0, 3)
    .join('-');
}

// The settled id for a row, or a slug for one that has not been given one
// yet — which the developer renames and adds to the table above.
function idFor(name, table, used) {
  const base = table.get(name) ?? slugify(name);
  if (!used.has(base)) {
    used.add(base);
    return base;
  }
  let n = 2;
  while (used.has(`${base}-${n}`)) n += 1;
  used.add(`${base}-${n}`);
  return `${base}-${n}`;
}

// A TypeScript string literal: single-quoted unless the text has an
// apostrophe, in which case double quotes read better than escapes.
function tsString(text) {
  if (text.includes("'") && !text.includes('"')) return `"${text}"`;
  return `'${text.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
}

function sourceComment(item) {
  const note = item.fields['source note'];
  return note ? `    // Source: ${note}.\n` : '    // Source: TODO.\n';
}

async function main() {
  const [eventsText, heightsText] = await Promise.all([
    readFile(EVENTS_FILE, 'utf8'),
    readFile(HEIGHTS_FILE, 'utf8'),
  ]);

  // Events and things live in different files, so an id only has to be
  // unique within its own list ("the Great Pyramid" is a beat and a thing).
  const usedEventIds = new Set();
  const usedThingIds = new Set();

  const events = parseChecklist(eventsText)
    .map((item) => {
      const { name, already, tail } = splitHead(item.head);
      const years = parseYears(tail) ?? parseYears(item.fields.bricks ?? '');
      return { item, name, already, years };
    })
    .sort((a, b) => (a.years ?? 0) - (b.years ?? 0));

  const things = parseChecklist(heightsText)
    .map((item) => {
      const { name, already, tail } = splitHead(item.head);
      const meters = parseMeters(tail);
      return { item, name, already, meters };
    })
    .sort((a, b) => (a.meters ?? 0) - (b.meters ?? 0));

  const out = [];

  out.push('// ---------- src/lib/beats.ts: BEATS ----------');
  out.push(`// ${events.length} ticked time events.`);
  events.forEach((entry, i) => {
    const id = idFor(entry.name, EVENT_IDS, usedEventIds);
    const line = entry.item.fields['card line'];
    const before = entry.item.fields['footer phrase'];
    out.push('  {');
    out.push(sourceComment(entry.item).trimEnd());
    out.push(`    id: ${tsString(id)},`);
    out.push(`    atYears: ${entry.years ?? 'TODO'}, // ${entry.name}`);
    out.push(`    title: 'TODO', // 2 to 5 words, no period`);
    out.push(`    line: ${line ? tsString(line) : "'TODO'"},`);
    if (before) out.push(`    beforePhrase: ${tsString(before)},`);
    if (!line) out.push('    needsReview: true,');
    out.push(`    icon: 'TODO',`);
    out.push(`    paper: '${i % 2 === 0 ? 'mustard' : 'coral'}',`);
    out.push('  },');
  });

  out.push('');
  out.push('// ---------- src/lib/landmarks.ts: THINGS ----------');
  out.push(`// ${things.length} ticked physical comparisons.`);
  things.forEach((entry, i) => {
    const id = idFor(entry.name, THING_IDS, usedThingIds);
    const phrase = entry.item.fields['footer phrase'];
    out.push('  {');
    out.push(sourceComment(entry.item).trimEnd());
    out.push(`    id: ${tsString(id)},`);
    out.push(`    label: ${tsString(entry.name)},`);
    out.push(`    icon: 'TODO',`);
    out.push(`    kind: 'thing',`);
    out.push(`    paper: '${i % 2 === 0 ? 'navy' : 'leaf'}',`);
    out.push(`    orientation: '${entry.item.flat ? 'flat' : 'tall'}',`);
    out.push(`    tallerThanPhrase: ${phrase ? tsString(phrase) : "'TODO'"},`);
    out.push(`    ...fromMeters(${entry.meters ?? 'TODO'}),`);
    out.push('  },');
  });

  process.stdout.write(`${out.join('\n')}\n`);
}

await main();
